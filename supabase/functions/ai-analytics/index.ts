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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json();
    const { platform, username, metrics = {}, workspace_id, force_refresh = false } = body;

    if (!platform || !username) {
      return new Response(JSON.stringify({ error: "platform and username are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Python service URL ────────────────────────────────────────────────────
    const pythonUrl = Deno.env.get("PYTHON_ANALYTICS_URL");
    if (!pythonUrl) {
      // Service not configured — graceful degradation
      return new Response(
        JSON.stringify({
          available: false,
          reason: "Statistical analytics requires the Python analytics service. Use the Evaluate button for AI-based insights.",
          bot_detection: { data_available: false },
          engagement_anomaly: { data_available: false },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Cache lookup (7-day) ──────────────────────────────────────────────────
    const cacheExpiry = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from("influencer_evaluations")
        .select("python_analytics, python_analytics_at")
        .eq("platform", platform)
        .eq("username", username)
        .eq("workspace_id", workspace_id ?? user.id)
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

    // ── Credits (atomic deduction) ────────────────────────────────────────────
    const targetWorkspace = workspace_id ?? user.id;
    const { data: creditData, error: creditError } = await supabase.rpc(
      "consume_search_credit",
      { p_workspace_id: targetWorkspace, p_amount: ANALYTICS_CREDIT_COST }
    );

    if (creditError || creditData === false) {
      return new Response(
        JSON.stringify({ available: false, reason: "Insufficient credits for analytics. Please top up your credits.", bot_detection: { data_available: false }, engagement_anomaly: { data_available: false } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Call Python service ───────────────────────────────────────────────────
    const secret = Deno.env.get("ANALYTICS_SECRET") ?? "";
    let pythonResult: Record<string, unknown>;

    try {
      const resp = await fetch(`${pythonUrl}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-analytics-secret": secret } : {}),
        },
        body: JSON.stringify({ platform, username, metrics }),
        signal: AbortSignal.timeout(10_000), // 10-second timeout
      });

      if (!resp.ok) {
        throw new Error(`Python service returned ${resp.status}`);
      }
      pythonResult = await resp.json() as Record<string, unknown>;
    } catch (err) {
      console.error("[ai-analytics] Python service error:", err);

      // Refund credits on Python service failure
      await supabase.rpc("consume_search_credit", {
        p_workspace_id: targetWorkspace,
        p_amount: -ANALYTICS_CREDIT_COST,
      }).catch(() => { /* best-effort refund */ });

      return new Response(
        JSON.stringify({
          available: false,
          reason: "Analytics service temporarily unavailable",
          bot_detection: { data_available: false },
          engagement_anomaly: { data_available: false },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Persist to cache ──────────────────────────────────────────────────────
    await supabase
      .from("influencer_evaluations")
      .upsert(
        {
          platform,
          username,
          workspace_id: targetWorkspace,
          python_analytics: pythonResult,
          python_analytics_at: new Date().toISOString(),
          // Keep other evaluation fields untouched by only upserting the analytics cols
        },
        { onConflict: "platform,username,workspace_id", ignoreDuplicates: false }
      )
      .catch((e) => console.warn("[ai-analytics] cache persist failed:", e));

    return new Response(
      JSON.stringify({ ...pythonResult, available: true, cached: false }),
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
