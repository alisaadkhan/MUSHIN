/**
 * trending-niches-analyzer/index.ts
 *
 * Trending Niches Analyzer
 * ─────────────────────────
 * Runs on a pg_cron schedule (every 12 hours). Analyzes the creator database
 * to identify trending niches by looking at:
 *
 *   1. Most common tags across recently indexed creators (last 30 days)
 *   2. Tags associated with high-engagement creators
 *   3. Niche diversity (how many distinct creators per niche)
 *
 * Results are written to the trending_niches table for use by the UI
 * (niche suggestion chips, search autocomplete, campaign targeting).
 *
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORMS = ["youtube", "instagram", "tiktok", "twitch", "all"] as const;

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
    .insert({ run_type: "trending_analysis", status: "running" })
    .select("id")
    .single();
  const runId: number = runRow?.id ?? 0;

  try {
    const now = new Date().toISOString();
    const cutoff30d = new Date(Date.now() - 30 * 86400_000).toISOString();

    // ── 1. Fetch creators indexed in the last 30 days ──────────────────────
    const { data: recentProfiles, error: profileErr } = await serviceClient
      .from("influencer_profiles")
      .select("platform, primary_niche, tags, engagement_rate, follower_count, last_seen_at")
      .gte("last_seen_at", cutoff30d)
      .not("tags", "is", null)
      .limit(5000);

    if (profileErr) throw profileErr;

    const profiles = recentProfiles ?? [];
    console.log(`[trending-analyzer] Run ${runId}: analyzing ${profiles.length} recent profiles`);

    if (profiles.length === 0) {
      await finishRun(serviceClient, runId, "success", 0);
      return new Response(JSON.stringify({ run_id: runId, message: "No recent profiles found" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 2. Aggregate tag statistics per platform ────────────────────────────
    // Structure: platform → tag → { count, totalEngagement, creatorSet }
    type TagStats = { count: number; totalEngagement: number; creatorSet: Set<string> };
    const tagMap = new Map<string, Map<string, TagStats>>();

    for (const pfKey of ["all", "youtube", "instagram", "tiktok", "twitch"]) {
      tagMap.set(pfKey, new Map());
    }

    for (const profile of profiles) {
      const tags: string[] = profile.tags ?? [];
      const er: number = profile.engagement_rate ?? 0;
      const plat: string = profile.platform ?? "unknown";
      const username: string = (profile as any).username ?? Math.random().toString();

      for (const rawTag of tags) {
        const tag = rawTag.toLowerCase().trim();
        if (!tag || tag.length < 2 || tag.length > 40) continue;

        for (const scope of ["all", plat]) {
          const scopeMap = tagMap.get(scope);
          if (!scopeMap) continue;

          const existing = scopeMap.get(tag) ?? { count: 0, totalEngagement: 0, creatorSet: new Set() };
          existing.count++;
          existing.totalEngagement += er;
          existing.creatorSet.add(username);
          scopeMap.set(tag, existing);
        }
      }

      // Also add primary_niche as a synthetic tag
      if (profile.primary_niche) {
        const nicheTag = profile.primary_niche.toLowerCase().trim();
        for (const scope of ["all", plat]) {
          const scopeMap = tagMap.get(scope);
          if (!scopeMap) continue;
          const existing = scopeMap.get(nicheTag) ?? { count: 0, totalEngagement: 0, creatorSet: new Set() };
          existing.count++;
          existing.totalEngagement += er;
          existing.creatorSet.add(username);
          scopeMap.set(nicheTag, existing);
        }
      }
    }

    // ── 3. Compute trend scores and build upsert rows ──────────────────────
    // trend_score = log(count+1) * (1 + avgEngagement/10) — balances volume × quality
    const upsertRows: any[] = [];
    let tagsAnalyzed = 0;

    for (const [platform, stats] of tagMap.entries()) {
      // Sort by count descending, take top 100 per platform
      const sorted = Array.from(stats.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 100);

      for (const [tag, s] of sorted) {
        const avgEr = s.count > 0 ? s.totalEngagement / s.count : 0;
        const trendScore = Math.log(s.count + 1) * (1 + avgEr / 10);

        upsertRows.push({
          tag,
          platform,
          trend_score:     Math.round(trendScore * 100) / 100,
          discovery_count: s.count,
          creator_count:   s.creatorSet.size,
          avg_engagement:  Math.round(avgEr * 100) / 100,
          last_updated:    now,
        });
        tagsAnalyzed++;
      }
    }

    // ── 4. Batch upsert to trending_niches ─────────────────────────────────
    const CHUNK = 100;
    let upsertErrors = 0;
    for (let i = 0; i < upsertRows.length; i += CHUNK) {
      const { error } = await serviceClient
        .from("trending_niches")
        .upsert(upsertRows.slice(i, i + CHUNK), {
          onConflict: "tag,platform",
        });
      if (error) {
        console.warn(`[trending-analyzer] Upsert chunk error:`, error.message);
        upsertErrors++;
      }
    }

    // ── 5. Prune stale entries (tags not seen in 60 days) ─────────────────
    const cutoff60d = new Date(Date.now() - 60 * 86400_000).toISOString();
    await serviceClient
      .from("trending_niches")
      .delete()
      .lt("last_updated", cutoff60d);

    await finishRun(serviceClient, runId, "success", tagsAnalyzed);

    console.log(`[trending-analyzer] Run ${runId} done. tags_analyzed=${tagsAnalyzed} errors=${upsertErrors}`);

    return new Response(
      JSON.stringify({ run_id: runId, profiles_analyzed: profiles.length, tags_analyzed: tagsAnalyzed, upsert_errors: upsertErrors }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[trending-analyzer] Fatal:", err);
    await finishRun(serviceClient, runId, "error", 0, err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

async function finishRun(client: any, runId: number, status: string, tagsAnalyzed: number, errorMsg?: string) {
  await client.from("discovery_runs").update({
    status,
    completed_at:   new Date().toISOString(),
    creators_found: tagsAnalyzed,
    meta:           errorMsg ? { error: errorMsg } : undefined,
  }).eq("id", runId);
}
