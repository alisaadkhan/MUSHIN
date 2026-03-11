/**
 * creator-refresh-monitor/index.ts
 *
 * Tiered Creator Refresh Monitor
 * ───────────────────────────────
 * Runs on a pg_cron schedule (every 4 hours). Selects creators due for a
 * refresh based on their tier:
 *
 *   high_growth  (≥ 500k followers)  → refresh every 24 hours
 *   active       (≥ 50k followers)   → refresh every 3 days
 *   inactive     (< 50k followers)   → refresh every 7 days
 *
 * Queues enrichment jobs via the existing enrichment_jobs table so the
 * process-enrichment-job worker handles the actual API calls.
 *
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "https://mushin.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Max profiles to queue per run (protects Apify credits)
const MAX_HIGH_GROWTH = 10;
const MAX_ACTIVE      = 15;
const MAX_INACTIVE    = 10;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const workerSecret = Deno.env.get("WORKER_SECRET") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const isAuthorized = (serviceKey && token === serviceKey) || (workerSecret && token === workerSecret);
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: runRow } = await serviceClient
    .from("discovery_runs")
    .insert({ run_type: "refresh", status: "running" })
    .select("id")
    .single();
  const runId: number = runRow?.id ?? 0;

  try {
    const now = new Date();
    const cutoff24h  = new Date(now.getTime() -  1 * 86400_000).toISOString();
    const cutoff3d   = new Date(now.getTime() -  3 * 86400_000).toISOString();
    const cutoff7d   = new Date(now.getTime() -  7 * 86400_000).toISOString();

    // Fetch due profiles for each tier in parallel
    const [highGrowthRes, activeRes, inactiveRes] = await Promise.all([
      // High growth: ≥500k, last enriched > 24h ago
      serviceClient
        .from("influencer_profiles")
        .select("id, platform, username, primary_niche, follower_count")
        .eq("enrichment_status", "success")
        .gte("follower_count", 500_000)
        .or(`last_enriched_at.is.null,last_enriched_at.lt.${cutoff24h}`)
        .order("follower_count", { ascending: false })
        .limit(MAX_HIGH_GROWTH),

      // Active: 50k–500k, last enriched > 3 days ago
      serviceClient
        .from("influencer_profiles")
        .select("id, platform, username, primary_niche, follower_count")
        .eq("enrichment_status", "success")
        .gte("follower_count", 50_000)
        .lt("follower_count", 500_000)
        .or(`last_enriched_at.is.null,last_enriched_at.lt.${cutoff3d}`)
        .order("follower_count", { ascending: false })
        .limit(MAX_ACTIVE),

      // Inactive: <50k, last enriched > 7 days ago
      serviceClient
        .from("influencer_profiles")
        .select("id, platform, username, primary_niche, follower_count")
        .eq("enrichment_status", "success")
        .lt("follower_count", 50_000)
        .or(`last_enriched_at.is.null,last_enriched_at.lt.${cutoff7d}`)
        .order("follower_count", { ascending: false })
        .limit(MAX_INACTIVE),
    ]);

    const allProfiles = [
      ...(highGrowthRes.data ?? []).map(p => ({ ...p, tier: "high_growth" })),
      ...(activeRes.data ?? []).map(p => ({ ...p, tier: "active" })),
      ...(inactiveRes.data ?? []).map(p => ({ ...p, tier: "inactive" })),
    ];

    console.log(`[refresh-monitor] Run ${runId}: ${allProfiles.length} profiles due for refresh`);

    let queued = 0;
    const SYSTEM_WORKSPACE = "00000000-0000-0000-0000-000000000000";

    for (const profile of allProfiles) {
      const { error } = await serviceClient
        .from("enrichment_jobs")
        .upsert({
          workspace_id:    SYSTEM_WORKSPACE,
          user_id:         SYSTEM_WORKSPACE,
          platform:        profile.platform,
          username:        profile.username,
          primary_niche:   profile.primary_niche,
          status:          "queued",
          next_attempt_at: new Date().toISOString(),
          meta: { tier: profile.tier, refresh_reason: "scheduled" },
        }, {
          onConflict: "platform,username,workspace_id",
          ignoreDuplicates: false, // update next_attempt_at if already queued
        });

      if (!error) queued++;
      else console.warn(`[refresh-monitor] Queue error for ${profile.platform}/${profile.username}:`, error.message);
    }

    // Update last_seen_at for all profiles being refreshed
    const refreshedUsernames = allProfiles.reduce<Record<string, string[]>>((acc, p) => {
      (acc[p.platform] = acc[p.platform] ?? []).push(p.username);
      return acc;
    }, {});

    for (const [plat, usernames] of Object.entries(refreshedUsernames)) {
      await serviceClient
        .from("influencer_profiles")
        .update({ last_seen_at: now.toISOString() })
        .eq("platform", plat)
        .in("username", usernames);
    }

    await serviceClient.from("discovery_runs").update({
      status:           "success",
      completed_at:     now.toISOString(),
      queries_run:      allProfiles.length,
      creators_updated: queued,
      creators_found:   allProfiles.length,
    }).eq("id", runId);

    console.log(`[refresh-monitor] Run ${runId} done. queued=${queued}/${allProfiles.length}`);

    return new Response(
      JSON.stringify({
        run_id:    runId,
        found:     allProfiles.length,
        queued,
        breakdown: {
          high_growth: (highGrowthRes.data ?? []).length,
          active:      (activeRes.data ?? []).length,
          inactive:    (inactiveRes.data ?? []).length,
        },
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[refresh-monitor] Fatal:", err);
    await serviceClient.from("discovery_runs").update({
      status: "error", completed_at: new Date().toISOString(),
      meta: { error: err.message },
    }).eq("id", runId);

    return safeErrorResponse(err, "[creator-refresh-monitor]", CORS);
  }
});
