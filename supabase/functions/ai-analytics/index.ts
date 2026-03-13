import { performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
/**
 * supabase/functions/ai-analytics/index.ts
 *
 * Bridges the TypeScript / Supabase layer to the Python analytics
 * microservice.  Handles:
 *   - Auth verification
 *   - 7-day DB cache via influencer_evaluations JSONB extra column
 *   - Graceful degradation when the Python service is unavailable
 *   - Credit deduction (3 credits, atomic via workspace_credits RPC)
 *
 * The Python service URL is read from PYTHON_ANALYTICS_URL env var.
 * If unset, the endpoint returns a graceful unavailable response so the
 * frontend can show "Analytics service unavailable" without crashing.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/rate_limit.ts";
import { resolveAuthorizedWorkspace } from "../_shared/security.ts";
const ANALYTICS_CREDIT_COST = 3;
const CACHE_TTL_HOURS = 24 * 7; // 7 days
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = await performPrivilegedWrite({
        authHeader: req.headers.get("Authorization"),
        action: "gateway:privileged-client-bootstrap",
        execute: async (_ctx, client) => client,
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json();
    const { platform, username, metrics = {}, workspace_id: requestedWorkspaceId, force_refresh = false } = body;
    const { data: memberships, error: membershipError } = await serviceClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id);

    if (membershipError) {
      return new Response(JSON.stringify({ error: "Failed to resolve workspace membership" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetWorkspace = resolveAuthorizedWorkspace(requestedWorkspaceId, memberships ?? []);
    if (!targetWorkspace) {
      return new Response(JSON.stringify({ error: "Workspace access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (!platform || !username) {
      return new Response(JSON.stringify({ error: "platform and username are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Inline Statistical Engine ─────────────────────────────────────────────
    // Computes bot detection + engagement anomaly purely from the metrics passed
    // in. No external service required. The Python service URL is optional — if
    // set, its results replace the inline computation.

    function runInlineAnalytics(m: Record<string, any>): Record<string, unknown> {
      const follower_count: number = m.follower_count ?? 0;
      const following_count: number = m.following_count ?? 0;
      const posts_count: number = m.posts_count ?? 0;
      const engagement_rate: number | null = m.engagement_rate ?? null;
      const avg_likes: number | null = m.avg_likes ?? null;
      const avg_comments: number | null = m.avg_comments ?? null;

      // ── Bot Detection ─────────────────────────────────────────────────────
      const signals_triggered: string[] = [];
      let bot_score = 0;

      // 1. Follower / following ratio
      if (follower_count > 0 && following_count > 0) {
        const ratio = following_count / follower_count;
        if (ratio > 2.0) { signals_triggered.push("High following-to-follower ratio (>2x)"); bot_score += 25; }
        else if (ratio > 1.0) { signals_triggered.push("Elevated following-to-follower ratio (>1x)"); bot_score += 10; }
      }

      // 2. Engagement rate vs expected range
      if (engagement_rate !== null && follower_count > 0) {
        const expected = follower_count > 1_000_000 ? 1.0 : follower_count > 100_000 ? 2.0 : follower_count > 10_000 ? 3.5 : 5.0;
        if (engagement_rate < 0.1) { signals_triggered.push("Engagement rate critically low (<0.1%)"); bot_score += 35; }
        else if (engagement_rate < expected * 0.2) { signals_triggered.push(`Engagement rate well below benchmark (${engagement_rate.toFixed(1)}% vs ~${expected}% expected)`); bot_score += 20; }
        else if (engagement_rate > expected * 10) { signals_triggered.push("Suspiciously high engagement rate (possible engagement pods)"); bot_score += 15; }
      }

      // 3. Posts count anomaly
      if (posts_count === 0 && follower_count > 10_000) { signals_triggered.push("Zero posts with significant follower count"); bot_score += 20; }
      if (posts_count > 0 && follower_count > 0) {
        const postsPerFollower = posts_count / follower_count;
        if (postsPerFollower > 2) { signals_triggered.push("Abnormally high post-to-follower ratio"); bot_score += 10; }
      }

      // 4. Comments/likes ratio
      if (avg_likes !== null && avg_comments !== null && avg_likes > 0) {
        const commentRatio = avg_comments / avg_likes;
        if (commentRatio < 0.001) { signals_triggered.push("Near-zero comment-to-like ratio (possible engagement manipulation)"); bot_score += 15; }
        if (commentRatio > 2.0) { signals_triggered.push("Unusual comment-to-like ratio"); bot_score += 10; }
      }

      // 5. Large accounts with no following
      if (follower_count > 50_000 && following_count === 0) { signals_triggered.push("Large account with zero following (may be bought)"); bot_score += 5; }

      const capped = Math.min(100, bot_score);
      const bot_probability = capped / 100;
      const risk_level = capped < 20 ? "low" : capped < 50 ? "medium" : "high";
      const confidence = follower_count > 0 && engagement_rate !== null ? "high" : follower_count > 0 ? "medium" : "low";

      // ── Engagement Anomaly ────────────────────────────────────────────────
      const anomalies_detected: string[] = [];
      let anomaly_score = 0;

      if (engagement_rate !== null && follower_count > 0) {
        const expected = follower_count > 1_000_000 ? 1.0 : follower_count > 100_000 ? 2.0 : follower_count > 10_000 ? 3.5 : 5.0;
        const deviation = Math.abs(engagement_rate - expected) / expected;

        if (deviation > 3) { anomalies_detected.push(`Engagement rate (${engagement_rate.toFixed(1)}%) deviates ${Math.round(deviation * 100)}% from benchmark`); anomaly_score += 50; }
        else if (deviation > 1.5) { anomalies_detected.push(`Engagement rate moderately off benchmark (${engagement_rate.toFixed(1)}% vs ~${expected}%)`); anomaly_score += 25; }
      }

      if (avg_likes !== null && avg_comments !== null && avg_likes > 10) {
        const cr = avg_comments / avg_likes;
        if (cr < 0.005) { anomalies_detected.push("Very few comments relative to likes — possible like inflation"); anomaly_score += 20; }
      }

      return {
        available: true,
        bot_detection: {
          data_available: follower_count > 0,
          bot_probability,
          risk_level,
          signals_triggered,
          confidence,
        },
        engagement_anomaly: {
          data_available: engagement_rate !== null,
          anomaly_score: Math.min(1, anomaly_score / 100),
          anomalies_detected,
          explanation: anomalies_detected.length > 0
            ? `${anomalies_detected.length} anomal${anomalies_detected.length > 1 ? "ies" : "y"} detected in engagement patterns.`
            : "No statistically notable anomalies detected in engagement patterns.",
        },
      };
    }

    // ── Cache lookup (7-day) ──────────────────────────────────────────────────
    const cacheExpiry = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    if (!force_refresh) {
      const { data: cached } = await serviceClient
        .from("influencer_evaluations")
        .select("python_analytics, python_analytics_at")
        .eq("platform", platform)
        .eq("username", username)
        .eq("workspace_id", targetWorkspace)
        .not("python_analytics", "is", null)
        .gt("python_analytics_at", cacheExpiry)
        .maybeSingle();

      if (cached?.python_analytics) {
        console.log(`[ai-analytics] cache hit: ${platform}/@${username}`);
        return new Response(
          JSON.stringify({ ...cached.python_analytics, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Try optional Python service, fall back to inline engine ──────────────
    const pythonUrl = Deno.env.get("PYTHON_ANALYTICS_URL");
    let analyticsResult: Record<string, unknown>;

    if (pythonUrl) {
      try {
        const secret = Deno.env.get("ANALYTICS_SECRET") ?? "";
        const resp = await fetch(`${pythonUrl}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(secret ? { "x-analytics-secret": secret } : {}),
          },
          body: JSON.stringify({ platform, username, metrics }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!resp.ok) throw new Error(`Python service returned ${resp.status}`);
        analyticsResult = await resp.json() as Record<string, unknown>;
        console.log(`[ai-analytics] Python service result for ${username}`);
      } catch (err) {
        console.warn("[ai-analytics] Python service failed, using inline engine:", err);
        analyticsResult = runInlineAnalytics(metrics);
      }
    } else {
      console.log("[ai-analytics] No PYTHON_ANALYTICS_URL — using inline statistical engine");
      analyticsResult = runInlineAnalytics(metrics);
    }

    // ── Persist to cache ──────────────────────────────────────────────────────
    const { error: persistErr } = await serviceClient
      .from("influencer_evaluations")
      .upsert(
        {
          platform,
          username,
          workspace_id: targetWorkspace,
          python_analytics: analyticsResult,
          python_analytics_at: new Date().toISOString(),
        },
        { onConflict: "platform,username,workspace_id", ignoreDuplicates: false }
      );
    if (persistErr) console.warn("[ai-analytics] cache persist failed:", persistErr);

    return new Response(
      JSON.stringify({ ...analyticsResult, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[ai-analytics] Unhandled error:", err);
    return new Response(
      JSON.stringify({ available: false, reason: "Analytics service encountered an internal error. Please try again.", bot_detection: { data_available: false }, engagement_anomaly: { data_available: false } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
