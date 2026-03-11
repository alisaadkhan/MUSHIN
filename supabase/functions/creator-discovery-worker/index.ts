/**
 * creator-discovery-worker/index.ts
 *
 * Automated Creator Discovery Worker
 * ───────────────────────────────────
 * Runs on a pg_cron schedule (every 6 hours). Discovers new creators by
 * running a curated set of niche queries through Serper, then upserts
 * discovered creators into the local database index.
 *
 * This gradually grows the Mushin creator database so future searches
 * return results from the local index instead of hitting Serper every time.
 *
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";
import { expandSerperQueries } from "../_shared/query_expander.ts";
import { inferNiche } from "../_shared/niche.ts";
import { extractCity } from "../_shared/geo.ts";
import { extractFollowers } from "../_shared/followers.ts";
import { extractUsername, DOMAIN_MAP } from "../_shared/platform.ts";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "https://mushin.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Discovery seed queries ─────────────────────────────────────────────────
// Each entry covers a popular niche + platform combination.
// These are rotated so each 6-hour run covers a different slice.
const SEED_QUERIES: Array<{ query: string; platform: string; niche: string }> = [
  // YouTube
  { query: "tech youtuber Pakistan",         platform: "youtube",   niche: "Technology" },
  { query: "fitness influencer Pakistan",    platform: "youtube",   niche: "Fitness" },
  { query: "cooking channel Pakistan",       platform: "youtube",   niche: "Food" },
  { query: "travel vlogger Pakistan",        platform: "youtube",   niche: "Travel" },
  { query: "gaming youtuber Pakistan",       platform: "youtube",   niche: "Gaming" },
  { query: "education youtuber Pakistan",    platform: "youtube",   niche: "Education" },
  { query: "beauty youtuber Pakistan",       platform: "youtube",   niche: "Beauty" },
  { query: "fashion youtuber Pakistan",      platform: "youtube",   niche: "Fashion" },
  { query: "finance youtuber Pakistan",      platform: "youtube",   niche: "Finance" },
  { query: "comedy youtuber Pakistan",       platform: "youtube",   niche: "Comedy" },
  // Instagram
  { query: "fashion blogger Pakistan",       platform: "instagram", niche: "Fashion" },
  { query: "food blogger Pakistan",          platform: "instagram", niche: "Food" },
  { query: "fitness influencer Pakistan",    platform: "instagram", niche: "Fitness" },
  { query: "beauty influencer Pakistan",     platform: "instagram", niche: "Beauty" },
  { query: "lifestyle influencer Pakistan",  platform: "instagram", niche: "Lifestyle" },
  { query: "travel influencer Pakistan",     platform: "instagram", niche: "Travel" },
  { query: "motivational influencer Pakistan", platform: "instagram", niche: "Motivation" },
  { query: "tech influencer Pakistan",       platform: "instagram", niche: "Technology" },
  // TikTok
  { query: "Pakistani tiktoker comedy",      platform: "tiktok",    niche: "Comedy" },
  { query: "food tiktoker Pakistan",         platform: "tiktok",    niche: "Food" },
  { query: "fashion tiktoker Pakistan",      platform: "tiktok",    niche: "Fashion" },
  { query: "beauty tiktoker Pakistan",       platform: "tiktok",    niche: "Beauty" },
  { query: "gaming tiktoker Pakistan",       platform: "tiktok",    niche: "Gaming" },
  // Twitch
  { query: "Pakistani twitch streamer",      platform: "twitch",    niche: "Gaming" },
  { query: "Urdu twitch streamer Pakistan",  platform: "twitch",    niche: "Gaming" },
];

// Per-run limits (controls Serper credit spend)
const QUERIES_PER_RUN = 8;           // queries to execute per 6h window
const RESULTS_PER_QUERY = 10;        // Serper num results per query
const SERPER_TIMEOUT_MS = 8_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Internal-only endpoint — requires service role key OR worker secret
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

  const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
  if (!SERPER_API_KEY) {
    return new Response(JSON.stringify({ error: "SERPER_API_KEY not configured" }), {
      status: 503, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── Log run start ──────────────────────────────────────────────────────────
  const { data: runRow, error: runInsertErr } = await serviceClient
    .from("discovery_runs")
    .insert({ run_type: "scheduled_discovery", status: "running" })
    .select("id")
    .single();
  if (runInsertErr) console.error("[discovery-worker] Failed to insert discovery_run row:", runInsertErr.message);
  const runId: number | null = runRow?.id ?? null;

  let queriesRun = 0, creatorsFound = 0, creatorsNew = 0, creatorsUpdated = 0, errorCount = 0;

  try {
    // ── Select seed queries for this run (rotate by hour-of-day modulo) ──────
    const hourSlot = Math.floor(Date.now() / (6 * 3600_000)) % Math.ceil(SEED_QUERIES.length / QUERIES_PER_RUN);
    const startIdx = hourSlot * QUERIES_PER_RUN;
    const seedsThisRun = SEED_QUERIES.slice(startIdx, startIdx + QUERIES_PER_RUN);

    // Build full variant list: each seed → 2 Serper queries (primary + synonym)
    const taskQueue: Array<{ query: string; platform: string; niche: string }> = [];
    for (const seed of seedsThisRun) {
      const variants = expandSerperQueries(seed.query, seed.platform, "", seed.niche).slice(0, 2);
      for (const v of variants) {
        taskQueue.push({ query: v.query, platform: seed.platform, niche: seed.niche });
      }
    }

    console.log(`[discovery-worker] Run ${runId}: ${taskQueue.length} Serper queries planned`);

    // ── Execute all Serper queries in controlled parallel batches (5 at once) ─
    const BATCH_SIZE = 5;
    const allResults: Array<{ platform: string; niche: string; item: any }> = [];

    for (let i = 0; i < taskQueue.length; i += BATCH_SIZE) {
      const batch = taskQueue.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(task => runSerperQuery(task.query, RESULTS_PER_QUERY, SERPER_API_KEY, SERPER_TIMEOUT_MS)
          .then(items => items.map(item => ({ platform: task.platform, niche: task.niche, item })))
        )
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled") allResults.push(...r.value);
        else { errorCount++; console.warn("[discovery-worker] Serper error:", (r as any).reason?.message); }
      }
      queriesRun += batch.length;
    }

    creatorsFound = allResults.length;
    console.log(`[discovery-worker] Run ${runId}: ${creatorsFound} raw results from Serper`);

    // ── Parse and deduplicate ─────────────────────────────────────────────────
    const seenKey = new Set<string>();
    const toUpsert: any[] = [];

    for (const { platform, niche, item } of allResults) {
      const username = extractUsername(item.link, platform);
      if (!username) continue;

      const cleanUsername = username.replace(/^@/, "").toLowerCase();
      const dedupeKey = `${platform}:${cleanUsername}`;
      if (seenKey.has(dedupeKey)) continue;
      seenKey.add(dedupeKey);

      const followerCount = extractFollowers(item.snippet ?? "");
      const nicheData = inferNiche(item.title ?? "", item.snippet ?? "", platform);
      const city = extractCity(`${item.title ?? ""} ${item.snippet ?? ""}`, platform);

      const channelUrl = buildChannelUrl(platform, cleanUsername);

      toUpsert.push({
        platform,
        username:         cleanUsername,
        channel_url:      channelUrl,
        follower_count:   followerCount ?? null,
        primary_niche:    niche !== "General" ? niche : (nicheData.confidence >= 0.3 ? nicheData.niche : null),
        city:             city ?? null,
        enrichment_status: "stub",
        last_seen_at:     new Date().toISOString(),
        // first_seen_at is set by DB DEFAULT on INSERT — upsert won't overwrite it
      });
    }

    console.log(`[discovery-worker] Run ${runId}: ${toUpsert.length} unique creators to upsert`);

    if (toUpsert.length > 0) {
      // ── Check which are genuinely new vs existing ─────────────────────────
      const usernames = toUpsert.map(r => r.username);
      const platforms = [...new Set(toUpsert.map(r => r.platform))];
      const { data: existing } = await serviceClient
        .from("influencer_profiles")
        .select("platform, username")
        .in("username", usernames)
        .in("platform", platforms);

      const existingKeys = new Set(
        (existing ?? []).map((r: any) => `${r.platform}:${r.username}`)
      );
      creatorsNew = toUpsert.filter(r => !existingKeys.has(`${r.platform}:${r.username}`)).length;
      creatorsUpdated = toUpsert.length - creatorsNew;

      // ── Batch upsert in chunks of 50 ─────────────────────────────────────
      const CHUNK = 50;
      for (let i = 0; i < toUpsert.length; i += CHUNK) {
        const chunk = toUpsert.slice(i, i + CHUNK);
        const { error } = await serviceClient
          .from("influencer_profiles")
          .upsert(chunk, {
            onConflict: "platform,username",
            // Don't overwrite first_seen_at — it's set on INSERT only
            // Don't overwrite enrichment_status if already 'success'
          });
        if (error) {
          console.warn(`[discovery-worker] Upsert chunk ${i} error:`, error.message);
          errorCount++;
        }
      }

      // ── Also upsert to influencers_cache for DB-first search coverage ─────
      const cacheRows = toUpsert.map(r => ({
        platform:       r.platform,
        username:       r.username,
        city_extracted: r.city ?? null,
        last_seen_at:   r.last_seen_at,
        data: {
          niche:           r.primary_niche,
          followers:       r.follower_count,
        },
      }));
      for (let i = 0; i < cacheRows.length; i += CHUNK) {
        const { error } = await serviceClient
          .from("influencers_cache")
          .upsert(cacheRows.slice(i, i + CHUNK), { onConflict: "platform,username" });
        if (error) console.warn("[discovery-worker] Cache upsert error:", error.message);
      }
    }

    // ── Mark run complete ──────────────────────────────────────────────────────
    if (runId !== null) {
      await serviceClient.from("discovery_runs").update({
        status:           "success",
        completed_at:     new Date().toISOString(),
        queries_run:      queriesRun,
        creators_found:   creatorsFound,
        creators_new:     creatorsNew,
        creators_updated: creatorsUpdated,
        error_count:      errorCount,
      }).eq("id", runId);
    }

    console.log(`[discovery-worker] Run ${runId} done. new=${creatorsNew} updated=${creatorsUpdated} errors=${errorCount}`);

    return new Response(
      JSON.stringify({ run_id: runId, queries_run: queriesRun, creators_found: creatorsFound, creators_new: creatorsNew, creators_updated: creatorsUpdated, error_count: errorCount }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[discovery-worker] Fatal error:", err);
    if (runId !== null) {
      await serviceClient.from("discovery_runs").update({
        status: "error", completed_at: new Date().toISOString(),
        queries_run: queriesRun, creators_found: creatorsFound,
        error_count: errorCount + 1,
        meta: { error: err.message },
      }).eq("id", runId);
    }

    return safeErrorResponse(err, "[creator-discovery-worker]", CORS);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function runSerperQuery(query: string, num: number, apiKey: string, timeoutMs: number): Promise<any[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num, gl: "pk" }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Serper ${res.status}`);
    const data = await res.json();
    return data.organic ?? [];
  } finally {
    clearTimeout(timer);
  }
}

function buildChannelUrl(platform: string, username: string): string | null {
  const u = username.replace(/^@/, "");
  switch (platform) {
    case "youtube":   return `https://www.youtube.com/@${u}`;
    case "instagram": return `https://www.instagram.com/${u}`;
    case "tiktok":    return `https://www.tiktok.com/@${u}`;
    case "twitch":    return `https://www.twitch.tv/${u}`;
    default:          return null;
  }
}
