// ============================================================
// MUSHIN — discover-creators Edge Function
// Deno / TypeScript (Supabase Edge Runtime)
//
// Architecture: Cache-First OSINT Coordinator
//   1. Check creators_cache for fresh matches → return instantly
//   2. Cache miss → Serper dork queries (rapid discovery)
//   3. Handles → Apify profile scrapers (deep enrichment)
//   4. Score → Upsert → Return
// ============================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { assertNoSecretsInRequestBody, getSecret } from "../_shared/secrets.ts";
import {
  createPrivilegedClient,
  requireJwt,
  requireWorkspaceMembership,
} from "../_shared/privileged_gateway.ts";
import { enforceGlobalRateLimit } from "../_shared/global_rate_limit.ts";
import { buildCorsHeaders as sharedBuildCorsHeaders } from "../_shared/cors.ts";
import { logUserActivity } from "../_shared/activity_logger.ts";

// ── Constants ────────────────────────────────────────────────
const STALE_HOURS          = 24;
const CACHE_MIN_RESULTS    = 5;    // serve cache if ≥ 5 fresh results exist
const SERPER_MAX_RESULTS   = 15;   // results per Serper query
const MAX_DORKS            = 12;     // cap parallel Serper calls
const CACHE_RPC_LIMIT      = 48;   // candidates from DB before client-side cap
const RESULT_TARGET_MIN    = 20;    // min creators returned (when enough data exists)
const RESULT_TARGET_MAX    = 30;    // max creators returned per search
const APIFY_TIMEOUT_SECS   = 90;   // max time to wait for Apify actor run
const MAX_HANDLES_PER_BATCH = 28;  // Apify scrape batch size (fits ~30-result target)
const LIVE_SEARCH_CREDIT_COST = 1; // search credits per live OSINT run

// Apify actor IDs
const APIFY_ACTORS = {
  instagram: "apify/instagram-profile-scraper",
  tiktok:    "clockworks/free-tiktok-scraper",
  youtube:   "bernardo/youtube-scraper",
} as const;

// Pakistani cities for geo-signal matching
const PAKISTAN_CITIES = [
  "Karachi","Lahore","Islamabad","Rawalpindi","Faisalabad",
  "Multan","Peshawar","Quetta","Sialkot","Hyderabad",
];

// ── Types ─────────────────────────────────────────────────────
interface SearchFilters {
  query?:             string;
  platforms?:         string[];
  niches?:            string[];
  cities?:            string[];
  minFollowers?:      number;
  maxFollowers?:      number;
  maxFakeFollowerPct?: number;
  minMushinScore?:    number;
  hasEmail?:          boolean;
  hasWhatsApp?:       boolean;
  verifiedOnly?:      boolean;
  /** platform:handle keys from the client to reduce repeat surfaced creators */
  exclude_handles?:   string[];
}

interface TimingLog {
  cacheMs:   number;
  serperMs:  number;
  apifyMs:   number;
  scoringMs: number;
  totalMs:   number;
}

interface MUSHINScoreResult {
  total:       number;
  authenticity: number;
  engagement:  number;
  growth:      number;
  audienceSize: number;
}

// ── Helpers ───────────────────────────────────────────────────
async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildCorsHeaders(req: Request): Record<string, string> {
  return sharedBuildCorsHeaders(req);
}

function normalizePlatformHandleKey(platform: string, handle: string): string {
  const p = (platform || "instagram").toLowerCase();
  const h = (handle || "").toLowerCase().replace(/^@/, "").trim();
  return `${p}:${h}`;
}

function excludeSetFromRequest(filters: SearchFilters): Set<string> {
  const set = new Set<string>();
  const raw = filters.exclude_handles;
  if (!Array.isArray(raw)) return set;
  const defaultPlatform = (filters.platforms?.[0] ?? "instagram").toLowerCase();
  for (const item of raw.slice(0, 120)) {
    const s = String(item).trim().toLowerCase();
    if (!s) continue;
    if (s.includes(":")) {
      const idx = s.indexOf(":");
      const pl = s.slice(0, idx);
      const h = s.slice(idx + 1).replace(/^@/, "");
      if (pl && h) set.add(normalizePlatformHandleKey(pl, h));
    } else {
      set.add(normalizePlatformHandleKey(defaultPlatform, s));
    }
  }
  return set;
}

function filterCreatorsByExclude(rows: unknown[], ex: Set<string>): unknown[] {
  if (!ex.size || !Array.isArray(rows)) return rows;
  return rows.filter((row) => {
    const r = row as Record<string, unknown>;
    const platform = String(r.platform ?? "instagram");
    const handle = String(r.handle ?? r.username ?? "");
    const key = normalizePlatformHandleKey(platform, handle);
    return !ex.has(key);
  });
}

function pickResultCount(seed: number, min: number, max: number): number {
  const span = max - min + 1;
  return min + (Math.abs(seed) % span);
}

function jsonResponse(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function getIpAddress(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-real-ip")
    ?? null;
}

function getIdempotencyKey(req: Request): string | null {
  return (
    req.headers.get("x-idempotency-key")
    ?? req.headers.get("idempotency-key")
    ?? null
  );
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  // Fisher–Yates shuffle with deterministic PRNG (xorshift32)
  const out = [...arr];
  let x = (seed | 0) || 123456789;
  const rand = () => {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return ((x >>> 0) / 0x100000000);
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function seedToInt(seed: string): Promise<number> {
  const h = await sha256(seed);
  return (parseInt(h.slice(0, 8), 16) | 0);
}

// ════════════════════════════════════════════════════════════
// MUSHIN SCORE ENGINE
// Weighted composite score (0–100) from raw scraper data.
// ════════════════════════════════════════════════════════════
function calculateMUSHINScore(params: {
  followers:         number;
  engagementRate:    number;   // % (e.g. 4.25)
  growthRate30d:     number;   // % change
  fakeFollowerPct:   number;   // % (0–100)
  hasEmail:          boolean;
  hasWhatsApp:       boolean;
  verified:          boolean;
}): MUSHINScoreResult {
  const { followers, engagementRate, growthRate30d, fakeFollowerPct, hasEmail, hasWhatsApp, verified } = params;

  // ── 1. Authenticity score (35% weight) ────────────────────
  // Heavily penalises fake followers. 0% fake = 1.0, 40%+ = 0.0
  const authenticityRaw = Math.max(0, 1 - fakeFollowerPct / 40);
  const authenticityScore = authenticityRaw * 35;

  // ── 2. Engagement score (30% weight) ──────────────────────
  // <1%=0, 1-2%=12, 2-4%=20, 4-7%=26, 7-10%=29, 10%+=30
  let engagementScore: number;
  if      (engagementRate >= 10) engagementScore = 30;
  else if (engagementRate >= 7)  engagementScore = 29;
  else if (engagementRate >= 4)  engagementScore = 26;
  else if (engagementRate >= 2)  engagementScore = 20;
  else if (engagementRate >= 1)  engagementScore = 12;
  else                           engagementScore = 0;

  // ── 3. Growth score (20% weight) ──────────────────────────
  // Negative growth = 0. 20%+ monthly = full 20.
  const growthScore = Math.min(20, Math.max(0, (growthRate30d / 20) * 20));

  // ── 4. Audience size score (15% weight) ───────────────────
  // Sweet spot: 50K–500K (micro/macro). Mega gets slight penalty.
  let audienceSizeScore: number;
  if      (followers >= 5_000_000) audienceSizeScore = 9;   // mega — less authentic avg
  else if (followers >= 1_000_000) audienceSizeScore = 11;  // macro-mega
  else if (followers >= 500_000)   audienceSizeScore = 13;  // macro
  else if (followers >= 50_000)    audienceSizeScore = 15;  // sweet spot
  else if (followers >= 10_000)    audienceSizeScore = 12;  // micro
  else                             audienceSizeScore = 6;   // nano

  // ── 5. Enrichment bonus (up to +5 total, capped) ──────────
  // Applied after primary weights to keep 0–100 range intact
  const enrichmentBonus = Math.min(5,
    (hasEmail    ? 2 : 0) +
    (hasWhatsApp ? 2 : 0) +
    (verified    ? 1 : 0)
  );

  // ── Final score ────────────────────────────────────────────
  const rawTotal = authenticityScore + engagementScore + growthScore + audienceSizeScore + enrichmentBonus;
  const total    = Math.round(Math.max(0, Math.min(100, rawTotal)));

  return {
    total,
    authenticity:  Math.round(authenticityScore),
    engagement:    Math.round(engagementScore),
    growth:        Math.round(growthScore),
    audienceSize:  Math.round(audienceSizeScore),
  };
}

// ════════════════════════════════════════════════════════════
// STEP 1: CACHE LOOKUP
// ════════════════════════════════════════════════════════════
async function checkCache(
  supabase: SupabaseClient,
  filters: SearchFilters
): Promise<{ data: unknown[]; hitCount: number; lookupMs: number }> {
  const start = Date.now();

  const { data, error } = await supabase.rpc("get_fresh_creators", {
    p_platforms:        filters.platforms        ?? [],
    p_cities:           filters.cities           ?? [],
    p_niches:           filters.niches           ?? [],
    p_min_followers:    filters.minFollowers      ?? 10_000,
    p_max_followers:    filters.maxFollowers      ?? 10_000_000,
    p_min_mushin_score: filters.minMushinScore    ?? 0,
    p_max_fake_pct:     filters.maxFakeFollowerPct ?? 100,
    p_has_email:        filters.hasEmail          ?? false,
    p_has_whatsapp:     filters.hasWhatsApp       ?? false,
    p_verified_only:    filters.verifiedOnly      ?? false,
    p_limit:            CACHE_RPC_LIMIT,
    p_stale_hours:      STALE_HOURS,
  });

  if (error) {
    console.error("[cache] RPC error:", error.message);
    return { data: [], hitCount: 0, lookupMs: Date.now() - start };
  }

  return {
    data:      data ?? [],
    hitCount:  (data ?? []).length,
    lookupMs:  Date.now() - start,
  };
}

// ════════════════════════════════════════════════════════════
// STEP 2: SERPER — RAPID DISCOVERY (Google Dorks)
// ════════════════════════════════════════════════════════════
function buildDorkQueries(filters: SearchFilters): { query: string; platform: string }[] {
  const queries: { query: string; platform: string }[] = [];

  const platforms  = filters.platforms?.length ? filters.platforms : ["instagram", "tiktok", "youtube"];
  const cities     = filters.cities?.length    ? filters.cities    : ["Karachi", "Lahore", "Islamabad"];
  const niches     = filters.niches?.length    ? filters.niches    : [];
  const rawQuery   = (filters.query ?? "").trim();

  const nicheStr = niches.slice(0, 3).join(" OR ");
  const queryStr = rawQuery.length >= 2 ? rawQuery.replace(/["]/g, "").slice(0, 80) : "";

  const siteMap: Record<string, string> = {
    instagram: "instagram.com",
    tiktok:    "tiktok.com",
    youtube:   "youtube.com",
  };

  for (const platform of platforms) {
    const site = siteMap[platform];
    if (!site) continue;

    for (const city of cities.slice(0, 3)) {   // max 3 cities per platform to limit Serper calls
      // Base dork: city signal + niche
      const nicheClause = nicheStr ? ` (${nicheStr})` : "";
      const queryClause = queryStr ? ` "${queryStr}"` : "";
      const emailClause = filters.hasEmail ? ` "@gmail.com" OR "@hotmail.com" OR "business email"` : "";

      // Dork variants by platform
      let query: string;
      if (platform === "instagram") {
        query = `site:${site} "${city}"${queryClause}${nicheClause}${emailClause} "followers"`;
      } else if (platform === "tiktok") {
        query = `site:${site}/@* "${city}"${queryClause}${nicheClause} "followers"`;
      } else {
        // YouTube channel pages
        query = `site:${site} "${city}"${queryClause}${nicheClause} ("Subscribe" OR "subscribers")`;
      }

      queries.push({ query, platform });

      // Secondary dork: Urdu/Pakistani signal
      const urduQuery = `site:${site} "${city}" "Pakistan"${queryClause}${nicheClause} ("creator" OR "influencer")`;
      queries.push({ query: urduQuery, platform });
    }
  }

  return queries.slice(0, MAX_DORKS);
}

async function runSerper(
  dorks: { query: string; platform: string }[],
  apiKey: string,
  excludeKeys: Set<string>,
): Promise<{ handle: string; platform: string; profileUrl: string; query: string }[]> {
  const results: { handle: string; platform: string; profileUrl: string; query: string }[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(
    dorks.map(async ({ query, platform }) => {
      try {
        const resp = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY":    apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q:   query,
            num: SERPER_MAX_RESULTS,
            gl:  "pk",   // geo: Pakistan
            hl:  "en",
          }),
        });

        if (!resp.ok) {
          console.error(`[serper] HTTP ${resp.status} for query: ${query}`);
          return;
        }

        const data = await resp.json();
        const organic: { link?: string; snippet?: string }[] = data.organic ?? [];

        for (const result of organic) {
          const link = result.link ?? "";
          const handle = extractHandle(link, platform);
          if (!handle) continue;

          const dedupKey = `${platform}:${handle}`;
          if (seen.has(dedupKey)) continue;
          if (excludeKeys.has(dedupKey)) continue;
          seen.add(dedupKey);

          // Basic heuristic: skip very short handles or obvious non-creator pages
          if (handle.length < 3 || ["explore","reels","reel","shorts","trending"].includes(handle)) continue;

          results.push({ handle, platform, profileUrl: link, query });
        }
      } catch (err) {
        console.error(`[serper] fetch error for "${query}":`, err);
      }
    })
  );

  return results;
}

function extractHandle(url: string, platform: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname;

    if (platform === "instagram") {
      // instagram.com/username or instagram.com/p/... (skip posts)
      const m = path.match(/^\/([^\/\?]+)\/?$/);
      if (!m || m[1] === "p") return null;
      return `@${m[1].toLowerCase()}`;
    }

    if (platform === "tiktok") {
      // tiktok.com/@username
      const m = path.match(/^\/@([^\/\?]+)\/?$/);
      if (!m) return null;
      return `@${m[1].toLowerCase()}`;
    }

    if (platform === "youtube") {
      // youtube.com/c/ChannelName or youtube.com/@handle or youtube.com/channel/UCxxx
      const m =
        path.match(/^\/c\/([^\/\?]+)/) ||
        path.match(/^\/@([^\/\?]+)/) ||
        path.match(/^\/channel\/([^\/\?]+)/);
      if (!m) return null;
      return `@${m[1].toLowerCase()}`;
    }

    return null;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// STEP 3: APIFY — DEEP ENRICHMENT
// Batches handles into Apify actor runs per platform.
// Uses run-sync-get-dataset-items for synchronous results.
// ════════════════════════════════════════════════════════════
async function enrichWithApify(
  handles: { handle: string; platform: string; profileUrl: string; query: string }[],
  apifyToken: string
): Promise<{ profiles: unknown[]; runIds: string[] }> {
  // Group by platform
  const grouped: Record<string, typeof handles> = {};
  for (const h of handles) {
    (grouped[h.platform] ??= []).push(h);
  }

  const allProfiles: unknown[] = [];
  const runIds: string[] = [];

  await Promise.allSettled(
    Object.entries(grouped).map(async ([platform, items]) => {
      const actorId = APIFY_ACTORS[platform as keyof typeof APIFY_ACTORS];
      if (!actorId) return;

      // Process in batches
      for (let i = 0; i < items.length; i += MAX_HANDLES_PER_BATCH) {
        const batch = items.slice(i, i + MAX_HANDLES_PER_BATCH);
        const input = buildApifyInput(platform, batch);

        try {
          const runId = await startApifyRun(actorId, input, apifyToken);
          if (runId) runIds.push(runId);

          const results = await pollApifyResults(runId, apifyToken);
          const normalized = results.map((r: unknown) =>
            normalizeApifyProfile(r, platform, batch)
          ).filter(Boolean);

          allProfiles.push(...normalized);
        } catch (err) {
          console.error(`[apify] error for ${platform} batch:`, err);
        }
      }
    })
  );

  return { profiles: allProfiles, runIds };
}

function buildApifyInput(
  platform: string,
  items: { handle: string; profileUrl: string }[]
): Record<string, unknown> {
  const usernames = items.map((i) => i.handle.replace(/^@/, ""));
  const urls      = items.map((i) => i.profileUrl);

  if (platform === "instagram") {
    return {
      usernames,
      resultsLimit: MAX_HANDLES_PER_BATCH,
    };
  }

  if (platform === "tiktok") {
    return {
      profiles: urls,
      resultsPerPage: 1,
      profilesPerQuery: 1,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    };
  }

  if (platform === "youtube") {
    return {
      startUrls: urls.map((url) => ({ url })),
      maxResults: 1,
    };
  }

  return {};
}

async function startApifyRun(
  actorId: string,
  input: Record<string, unknown>,
  token: string
): Promise<string> {
  const encodedId = encodeURIComponent(actorId);
  const url = `https://api.apify.com/v2/acts/${encodedId}/runs?token=${token}&timeout=${APIFY_TIMEOUT_SECS}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Apify start failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return data.data?.id ?? "";
}

async function pollApifyResults(runId: string, token: string): Promise<unknown[]> {
  if (!runId) return [];

  const maxPolls   = 30;
  const pollDelay  = 3000; // ms

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollDelay));

    const statusResp = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    );
    const statusData = await statusResp.json();
    const status: string = statusData.data?.status ?? "";

    if (status === "SUCCEEDED") {
      // Fetch dataset items
      const itemsResp = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}&format=json`
      );
      return await itemsResp.json();
    }

    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      console.error(`[apify] run ${runId} ended with status: ${status}`);
      return [];
    }

    // RUNNING or READY — continue polling
    console.log(`[apify] run ${runId} status: ${status} (poll ${i + 1}/${maxPolls})`);
  }

  console.error(`[apify] run ${runId} timed out after ${maxPolls} polls`);
  return [];
}

// ── Profile normalizers — map Apify response → our DB schema ─
function normalizeApifyProfile(
  raw: unknown,
  platform: string,
  sourceItems: { handle: string; profileUrl: string; query: string }[]
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  try {
    if (platform === "instagram") return normalizeInstagram(r, sourceItems);
    if (platform === "tiktok")    return normalizeTikTok(r, sourceItems);
    if (platform === "youtube")   return normalizeYouTube(r, sourceItems);
    return null;
  } catch (err) {
    console.error("[normalize] error:", err, raw);
    return null;
  }
}

function normalizeInstagram(
  r: Record<string, unknown>,
  sourceItems: { handle: string; profileUrl: string; query: string }[]
): Record<string, unknown> | null {
  const username: string = (r.username as string) ?? "";
  if (!username) return null;

  const handle = `@${username.toLowerCase()}`;
  const source = sourceItems.find((s) => s.handle === handle || s.handle === `@${username}`);

  const followers      = Number(r.followersCount     ?? r.followers ?? 0);
  const following      = Number(r.followingCount     ?? r.following ?? 0);
  const postCount      = Number(r.postsCount         ?? r.mediaCount ?? 0);
  const bio: string    = (r.biography as string)     ?? "";
  const fullName       = (r.fullName as string)      ?? username;
  const verified       = Boolean(r.verified ?? r.isVerified);
  const profileUrl     = `https://instagram.com/${username}`;
  const avatarUrl      = (r.profilePicUrl as string) ?? "";

  // Engagement rate: (avg_likes + avg_comments) / followers * 100
  const avgLikes    = Number(r.avgLikes    ?? (r as any).averageLikes    ?? 0);
  const avgComments = Number(r.avgComments ?? (r as any).averageComments ?? 0);
  const engRate     = followers > 0
    ? Math.round(((avgLikes + avgComments) / followers) * 10000) / 100
    : 0;

  // Fake follower estimate — Apify doesn't provide this directly.
  // Heuristic: suspiciously low engagement relative to followers.
  const fakeFollowerPct = estimateFakeFollowers(followers, engRate);

  // OSINT enrichment from bio
  const email     = extractEmail(bio);
  const whatsapp  = extractWhatsApp(bio);
  const website   = (r.externalUrl as string) ?? null;

  // City detection from bio text + location field
  const locationStr = `${bio} ${(r.city as string) ?? ""} ${(r.location as string) ?? ""}`;
  const city        = detectPakistaniCity(locationStr);

  // Niche detection from bio
  const niches = detectNiches(bio, fullName);

  // Platform data blob
  const reelViews   = Number((r as any).reelViews ?? (r as any).igtvViews ?? 0);
  const platformData = {
    avgLikes,
    avgComments,
    reelViews,
    storiesReach: 0,   // not available from public scraper
    thumbnails:   [],  // populated by frontend from CDN
  };

  const scoreParams = {
    followers, engagementRate: engRate, growthRate30d: 0,
    fakeFollowerPct, hasEmail: Boolean(email), hasWhatsApp: Boolean(whatsapp), verified,
  };
  const score = calculateMUSHINScore(scoreParams);

  return {
    platform: "instagram",
    handle,
    display_name:               fullName,
    avatar_url:                 avatarUrl,
    bio,
    verified,
    city,
    niches,
    followers,
    following_count:            following,
    post_count:                 postCount,
    engagement_rate:            engRate,
    growth_rate_30d:            0,
    platform_data:              platformData,
    fake_follower_pct:          fakeFollowerPct,
    mushin_score:               score.total,
    score_components:           { authenticity: score.authenticity, engagement: score.engagement, growth: score.growth, audienceSize: score.audienceSize },
    enrichment_email:           email,
    enrichment_email_source:    email ? "bio" : null,
    enrichment_whatsapp:        whatsapp,
    enrichment_has_website:     Boolean(website),
    enrichment_website_url:     website,
    enrichment_linked_handles:  detectCrossPlatformLinks(bio),
    discovered_via:             "serper",
    serper_query:               source?.query ?? null,
    profile_url:                profileUrl,
  };
}

function normalizeTikTok(
  r: Record<string, unknown>,
  sourceItems: { handle: string; profileUrl: string; query: string }[]
): Record<string, unknown> | null {
  const username: string = (r.authorMeta as any)?.name
    ?? (r.name as string)
    ?? "";
  if (!username) return null;

  const handle    = `@${username.toLowerCase()}`;
  const source    = sourceItems.find((s) => s.handle === handle || s.handle === `@${username}`);
  const followers = Number((r.authorMeta as any)?.fans ?? r.followers ?? 0);
  const following = Number((r.authorMeta as any)?.following ?? 0);
  const bio: string = (r.authorMeta as any)?.signature ?? "";
  const fullName  = (r.authorMeta as any)?.nickName ?? username;
  const verified  = Boolean((r.authorMeta as any)?.verified);

  // TikTok engagement from video array
  const videos    = Array.isArray(r.videos) ? r.videos as any[] : [];
  const avgViews  = videos.length
    ? Math.round(videos.reduce((acc: number, v: any) => acc + (v.playCount ?? 0), 0) / videos.length)
    : 0;
  const avgLikes  = videos.length
    ? Math.round(videos.reduce((acc: number, v: any) => acc + (v.diggCount ?? 0), 0) / videos.length)
    : 0;
  const engRate   = followers > 0 ? Math.round((avgLikes / followers) * 10000) / 100 : 0;

  // Viral velocity: avg views ÷ followers
  const viralVelocity = followers > 0
    ? Math.round((avgViews / followers) * 10) / 10
    : 0;

  const videoHistory = videos.slice(-6).map((v: any) => v.playCount ?? 0);
  const fakeFollowerPct = estimateFakeFollowers(followers, engRate);

  const email    = extractEmail(bio);
  const whatsapp = extractWhatsApp(bio);
  const city     = detectPakistaniCity(bio);
  const niches   = detectNiches(bio, fullName);

  const platformData = {
    viralVelocity,
    avgViews,
    totalLikes: Number((r.authorMeta as any)?.heart ?? 0),
    videoHistory,
    completionRate: 0, // not available without Business API
  };

  const score = calculateMUSHINScore({
    followers, engagementRate: engRate, growthRate30d: 0,
    fakeFollowerPct, hasEmail: Boolean(email), hasWhatsApp: Boolean(whatsapp), verified,
  });

  return {
    platform: "tiktok",
    handle,
    display_name:               fullName,
    avatar_url:                 (r.authorMeta as any)?.avatar ?? "",
    bio,
    verified,
    city,
    niches,
    followers,
    following_count:            following,
    post_count:                 videos.length,
    engagement_rate:            engRate,
    growth_rate_30d:            0,
    platform_data:              platformData,
    fake_follower_pct:          fakeFollowerPct,
    mushin_score:               score.total,
    score_components:           { authenticity: score.authenticity, engagement: score.engagement, growth: score.growth, audienceSize: score.audienceSize },
    enrichment_email:           email,
    enrichment_email_source:    email ? "bio" : null,
    enrichment_whatsapp:        whatsapp,
    enrichment_has_website:     false,
    enrichment_website_url:     null,
    enrichment_linked_handles:  detectCrossPlatformLinks(bio),
    discovered_via:             "serper",
    serper_query:               source?.query ?? null,
    profile_url:                `https://tiktok.com/@${username}`,
  };
}

function normalizeYouTube(
  r: Record<string, unknown>,
  sourceItems: { handle: string; profileUrl: string; query: string }[]
): Record<string, unknown> | null {
  const channelId: string = (r.channelId as string) ?? (r.id as string) ?? "";
  const handle    = `@${((r.channelName as string) ?? channelId).toLowerCase().replace(/\s+/g, "")}`;
  const source    = sourceItems[0];

  const subscribers   = Number(r.numberOfSubscribers ?? r.subscribers ?? 0);
  const bio: string   = (r.description as string)  ?? "";
  const fullName      = (r.channelName as string)   ?? handle.replace("@", "");
  const verified      = Boolean(r.isVerified);
  const viewCount     = Number(r.viewCount ?? 0);
  const videoCount    = Number(r.numberOfVideos ?? 0);
  const profileUrl    = (r.channelUrl as string)    ?? `https://youtube.com/@${fullName}`;

  const avgViews      = videoCount > 0 ? Math.round(viewCount / videoCount) : 0;
  const engRate       = subscribers > 0 ? Math.round((avgViews / subscribers) * 100) : 0; // simplified

  const email    = extractEmail(bio);
  const whatsapp = extractWhatsApp(bio);
  const city     = detectPakistaniCity(bio);
  const niches   = detectNiches(bio, fullName);
  const fakeFollowerPct = estimateFakeFollowers(subscribers, engRate);

  const platformData = {
    avgViewDuration:      0, // requires YouTube Analytics API
    avgViews,
    subscriberGrowth30d:  0, // requires historical data
    growthHistory:        [],
    videosPerMonth:       Math.round(videoCount / 12), // crude estimate
  };

  const score = calculateMUSHINScore({
    followers: subscribers, engagementRate: engRate, growthRate30d: 0,
    fakeFollowerPct, hasEmail: Boolean(email), hasWhatsApp: Boolean(whatsapp), verified,
  });

  return {
    platform: "youtube",
    handle,
    display_name:               fullName,
    avatar_url:                 (r.channelThumbnailUrl as string) ?? "",
    bio,
    verified,
    city,
    niches,
    followers:                  subscribers,
    following_count:            0,
    post_count:                 videoCount,
    engagement_rate:            engRate,
    growth_rate_30d:            0,
    platform_data:              platformData,
    fake_follower_pct:          fakeFollowerPct,
    mushin_score:               score.total,
    score_components:           { authenticity: score.authenticity, engagement: score.engagement, growth: score.growth, audienceSize: score.audienceSize },
    enrichment_email:           email,
    enrichment_email_source:    email ? "description" : null,
    enrichment_whatsapp:        whatsapp,
    enrichment_has_website:     Boolean(r.links),
    enrichment_website_url:     null,
    enrichment_linked_handles:  detectCrossPlatformLinks(bio),
    discovered_via:             "serper",
    serper_query:               source?.query ?? null,
    profile_url:                profileUrl,
  };
}

// ── OSINT extraction helpers ──────────────────────────────────
function extractEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@(?:gmail|yahoo|hotmail|outlook|icloud|protonmail|live|msn|pk)\.(?:com|pk|net|org)\b/i);
  return m ? m[0].toLowerCase() : null;
}

function extractWhatsApp(text: string): string | null {
  // Match Pakistani numbers: +92 3xx xxxxxxx
  const m = text.match(/(?:whatsapp|wa\.me|contact|📱|📞)?[\s:]*(?:\+92|0092|0)[\s-]?3\d{2}[\s-]?\d{7}/i);
  if (!m) return null;
  return m[0].replace(/\s|-/g, "");
}

function detectCrossPlatformLinks(text: string): string[] {
  const links: string[] = [];
  const input = text || "";
  const patterns = [
    /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi,
    /https?:\/\/(?:www\.)?tiktok\.com\/@?[a-zA-Z0-9_.]+/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/@?[a-zA-Z0-9_.-]+/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/channel\/[a-zA-Z0-9_-]+/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/c\/[a-zA-Z0-9_.-]+/gi,
    /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.-]+/gi,
    /https?:\/\/(?:www\.)?x\.com\/[a-zA-Z0-9_]+/gi,
    /https?:\/\/(?:www\.)?twitter\.com\/[a-zA-Z0-9_]+/gi,
    /https?:\/\/(?:www\.)?linktr\.ee\/[a-zA-Z0-9_.-]+/gi,
  ];
  for (const re of patterns) {
    const m = input.match(re) ?? [];
    for (const url of m) links.push(url);
  }
  return [...new Set(links.map((u) => u.trim()))].slice(0, 10);
}

function detectPakistaniCity(text: string): string | null {
  const lower = text.toLowerCase();
  for (const city of PAKISTAN_CITIES) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  return null;
}

function detectNiches(bio: string, name: string): string[] {
  const text   = `${bio} ${name}`.toLowerCase();
  const niches: string[] = [];

  const nicheMaps: [string, string[]][] = [
    ["Fashion & Style",       ["fashion","style","ootd","outfit","styling","couture","wear"]],
    ["Beauty & Skincare",     ["beauty","skincare","makeup","cosmetics","glam","skin","lip","brow"]],
    ["Food & Cooking",        ["food","recipe","cooking","chef","eat","restaurant","biryani","karahi"]],
    ["Tech & Gadgets",        ["tech","gadget","phone","review","unboxing","software","coding","dev"]],
    ["Gaming",                ["gaming","game","gamer","esport","pubg","fortnite","minecraft","playstation"]],
    ["Fitness & Health",      ["fitness","gym","workout","health","exercise","yoga","nutrition","diet"]],
    ["Comedy & Entertainment",["comedy","funny","meme","entertainment","humour","skit","vlog"]],
    ["Travel & Lifestyle",    ["travel","trip","explore","lifestyle","adventure","wanderlust","vacation"]],
    ["Islamic & Religious",   ["islamic","quran","deen","namaz","islamic","mufti","maulana","halal","ramadan"]],
    ["Finance & Business",    ["finance","business","investment","stock","trading","startup","money","wealth"]],
    ["Cricket & Sports",      ["cricket","psl","sports","football","team","match","wicket","batting"]],
    ["Automotive",            ["car","auto","vehicle","motor","drive","automotive","bike","moto"]],
    ["Parenting & Family",    ["parenting","family","kids","mom","dad","children","baby","motherhood"]],
    ["Music & Arts",          ["music","sing","artist","art","paint","creative","studio","album","song"]],
  ];

  for (const [niche, keywords] of nicheMaps) {
    if (keywords.some((kw) => text.includes(kw))) {
      niches.push(niche);
      if (niches.length >= 3) break; // cap at 3 niches per creator
    }
  }

  return niches;
}

function estimateFakeFollowers(followers: number, engagementRate: number): number {
  // Heuristic model based on industry benchmarks:
  // Expected engagement by size tier. Below expected = likely inflated by fakes.
  let expectedEng: number;
  if      (followers >= 1_000_000) expectedEng = 1.5;
  else if (followers >= 500_000)   expectedEng = 2.0;
  else if (followers >= 100_000)   expectedEng = 2.5;
  else if (followers >= 10_000)    expectedEng = 3.5;
  else                             expectedEng = 5.0;

  if (engagementRate >= expectedEng) return Math.max(0, Math.random() * 5); // healthy — low fake %

  // Scale fake% based on how far below expected
  const deficit   = expectedEng - engagementRate;
  const fakePct   = Math.min(60, Math.round((deficit / expectedEng) * 50 + Math.random() * 5));
  return fakePct;
}

// ════════════════════════════════════════════════════════════
// STEP 4: UPSERT TO DB
// ════════════════════════════════════════════════════════════
async function upsertProfiles(
  supabase: SupabaseClient,
  profiles: Record<string, unknown>[]
): Promise<void> {
  if (!profiles.length) return;

  const upsertPromises = profiles.map((p) =>
    supabase.rpc("upsert_creator", { p_data: p })
  );

  const results = await Promise.allSettled(upsertPromises);
  const errors  = results.filter((r) => r.status === "rejected");
  if (errors.length) {
    console.error(`[upsert] ${errors.length} upsert(s) failed`);
  }
}

// ════════════════════════════════════════════════════════════
// STEP 5: LOG QUERY
// ════════════════════════════════════════════════════════════
async function logQuery(
  supabase: SupabaseClient,
  params: {
    userId:             string | null;
    workspaceId:        string | null;
    queryHash:          string;
    filters:            SearchFilters;
    cacheHit:           boolean;
    cacheHitCount:      number;
    liveDiscoveryCount: number;
    serperCalls:        number;
    serperResultsRaw:   number;
    apifyRuns:          number;
    apifyProfilesScraped: number;
    timing:             TimingLog;
    resultCount:        number;
    error?:             string;
  }
): Promise<void> {
  await supabase.from("search_queries_log").insert({
    user_id:              params.userId,
    workspace_id:         params.workspaceId,
    query_hash:           params.queryHash,
    filters_json:         params.filters,
    cache_hit:            params.cacheHit,
    cache_hit_count:      params.cacheHitCount,
    live_discovery_count: params.liveDiscoveryCount,
    serper_calls:         params.serperCalls,
    serper_results_raw:   params.serperResultsRaw,
    apify_runs:           params.apifyRuns,
    apify_profiles_scraped: params.apifyProfilesScraped,
    total_duration_ms:    params.timing.totalMs,
    cache_lookup_ms:      params.timing.cacheMs,
    serper_ms:            params.timing.serperMs,
    apify_ms:             params.timing.apifyMs,
    scoring_ms:           params.timing.scoringMs,
    result_count:         params.resultCount,
    error:                params.error ?? null,
  });
}

async function getUserSearchCreditBalance(args: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}): Promise<number> {
  const { data, error } = await args.supabase.rpc("get_user_credit_balance", {
    p_user_id: args.userId,
    p_workspace_id: args.workspaceId,
    p_credit_type: "search",
  });
  if (error) throw error;
  return Number(data ?? 0);
}

async function debitLiveSearchCredits(args: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  queryHash: string;
  idempotencyKey: string | null;
  serperCalls: number;
  apifyRuns: number;
  resultCount: number;
}): Promise<{ debited: boolean; balanceAfter?: number; transactionId?: string }> {
  const { data, error } = await args.supabase.rpc("consume_user_credits", {
    p_user_id: args.userId,
    p_workspace_id: args.workspaceId,
    p_credit_type: "search",
    p_amount: LIVE_SEARCH_CREDIT_COST,
    p_action: "osint_search",
    p_idempotency_key: args.idempotencyKey,
    p_metadata: {
      module: "discover-creators",
      query_hash: args.queryHash,
      serper_calls: args.serperCalls,
      apify_runs: args.apifyRuns,
      result_count: args.resultCount,
    },
  });

  if (error) throw error;
  const payload = (data ?? {}) as any;
  if (!payload.success) return { debited: false };
  return {
    debited: true,
    balanceAfter: typeof payload.balance_after === "number" ? payload.balance_after : undefined,
    transactionId: typeof payload.transaction_id === "string" ? payload.transaction_id : undefined,
  };
}

// ════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════
Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(req), status: 204 });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const wallStart = Date.now();

  const authHeader = req.headers.get("Authorization");
  const ipAddress = getIpAddress(req);
  const idempotencyKey = getIdempotencyKey(req);

  // ── Secrets ───────────────────────────────────────────────
  const serperKey = getSecret("SERPER_API_KEY", { endpoint: "discover-creators", required: false });
  const apifyToken = getSecret("APIFY_API_TOKEN", { endpoint: "discover-creators", required: false });

  // ── Parse request body ────────────────────────────────────
  let filters: SearchFilters;
  try {
    filters = await req.json();
    assertNoSecretsInRequestBody(filters, "discover-creators");
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }

  const qRaw = (filters.query ?? "").trim();
  if (qRaw.length > 200) {
    return jsonResponse(req, { error: "query too long (max 200 characters)" }, 400);
  }
  if (filters.platforms && filters.platforms.length > 4) {
    return jsonResponse(req, { error: "too many platforms (max 4)" }, 400);
  }

  const excludeKeys = excludeSetFromRequest(filters);

  // Enforce a sane lower bound server-side (UI "Any size" should be >= 1k)
  filters.minFollowers = Math.max(1_000, Number(filters.minFollowers ?? 1_000));

  // Canonical hash for deduplication / caching
  const queryHash = await sha256(JSON.stringify({
    query:       (filters.query ?? "").trim().toLowerCase(),
    platforms:   (filters.platforms  ?? []).sort(),
    niches:      (filters.niches     ?? []).sort(),
    cities:      (filters.cities     ?? []).sort(),
    minFollowers: filters.minFollowers ?? 10_000,
  }));

  // ── AuthN + AuthZ ─────────────────────────────────────────
  // We require JWT because Step B enforces user credits.
  let userId: string | null = null;
  let workspaceId: string | null = null;
  try {
    const auth = await requireJwt(authHeader);
    userId = auth.userId;
    const membership = await requireWorkspaceMembership(userId, null);
    workspaceId = membership.workspaceId;

    const rl = await enforceGlobalRateLimit({
      userId,
      ipAddress,
      endpoint: "discover-creators",
      isAdmin: false,
      isSuperAdmin: false,
    });
    if (!rl.allowed) {
      return jsonResponse(
        req,
        { error: "Rate limit exceeded", retry_after: rl.retryAfter },
        429,
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(req, { error: "Unauthorized", detail: message }, 401);
  }

  // ── Supabase client (service role for DB + OSINT cache) ────
  const supabase = createPrivilegedClient();

  const timing: TimingLog = { cacheMs: 0, serperMs: 0, apifyMs: 0, scoringMs: 0, totalMs: 0 };
  let serperCalls        = 0;
  let serperResultsRaw   = 0;
  let apifyRuns          = 0;
  let apifyProfilesScraped = 0;
  let cacheHit           = false;

  try {
    // ────────────────────────────────────────────────────────
    // 1. CACHE CHECK
    // ────────────────────────────────────────────────────────
    console.log("[discover] checking cache...");
    const cacheResult = await checkCache(supabase, filters);
    timing.cacheMs = cacheResult.lookupMs;

    if (cacheResult.hitCount >= CACHE_MIN_RESULTS) {
      cacheHit = true;
      console.log(`[discover] cache available (${cacheResult.hitCount}) — proceeding with live discovery for dynamic results`);
    } else {
      console.log(`[discover] cache MISS (${cacheResult.hitCount} stale results) — starting live discovery`);
    }

    // ────────────────────────────────────────────────────────
    // 1.5 CREDIT GATE (before any external calls)
    // ────────────────────────────────────────────────────────
    if (!serperKey || !apifyToken) {
      return jsonResponse(req, { error: "Missing required API secrets (SERPER_API_KEY, APIFY_API_TOKEN)" }, 500);
    }
    if (!userId || !workspaceId) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }
    const currentBalance = await getUserSearchCreditBalance({ supabase, userId, workspaceId });
    if (currentBalance < LIVE_SEARCH_CREDIT_COST) {
      timing.totalMs = Date.now() - wallStart;
      await logQuery(supabase, {
        userId,
        workspaceId,
        queryHash,
        filters,
        cacheHit: false,
        cacheHitCount: cacheResult.hitCount,
        liveDiscoveryCount: 0,
        serperCalls: 0,
        serperResultsRaw: 0,
        apifyRuns: 0,
        apifyProfilesScraped: 0,
        timing,
        resultCount: cacheResult.hitCount,
        error: "insufficient_credits",
      });
      return jsonResponse(
        req,
        {
          error: "Insufficient credits",
          code: "insufficient_credits",
          credit_type: "search",
          balance: currentBalance,
          required: LIVE_SEARCH_CREDIT_COST,
        },
        402,
      );
    }

    // ────────────────────────────────────────────────────────
    // 2. SERPER — DISCOVERY
    // ────────────────────────────────────────────────────────
    const shuffleSeed = await seedToInt(`${queryHash}:${idempotencyKey ?? crypto.randomUUID()}`);
    const serperStart = Date.now();
    const dorks       = buildDorkQueries(filters);
    serperCalls       = dorks.length;
    console.log(`[discover] running ${dorks.length} Serper dorks...`);

    const discoveredHandlesRaw = await runSerper(dorks, serperKey, excludeKeys);
    const discoveredHandles = seededShuffle(discoveredHandlesRaw, shuffleSeed);
    serperResultsRaw = discoveredHandles.length;
    timing.serperMs  = Date.now() - serperStart;
    console.log(`[discover] Serper found ${discoveredHandles.length} unique handles in ${timing.serperMs}ms`);

    if (!discoveredHandles.length) {
      // Nothing found — return whatever stale cache we have
      timing.totalMs = Date.now() - wallStart;
      await logQuery(supabase, {
        userId,
        workspaceId,
        queryHash, filters, cacheHit: false,
        cacheHitCount: 0, liveDiscoveryCount: 0,
        serperCalls, serperResultsRaw: 0, apifyRuns: 0, apifyProfilesScraped: 0,
        timing, resultCount: cacheResult.hitCount,
        error: "serper_no_results",
      });
      const wantStale = pickResultCount(shuffleSeed, RESULT_TARGET_MIN, RESULT_TARGET_MAX);
      let staleOut = filterCreatorsByExclude(cacheResult.data ?? [], excludeKeys);
      staleOut = seededShuffle(staleOut as unknown[], shuffleSeed ^ 0xdeadbeef).slice(
        0,
        Math.min(wantStale, staleOut.length),
      );
      return jsonResponse(req, {
        creators: staleOut,
        source:   "cache_stale",
        count:    staleOut.length,
        warning:  "Live discovery returned no results. Serving stale cache.",
        timing:   { total_ms: timing.totalMs },
      });
    }

    // ────────────────────────────────────────────────────────
    // 3. APIFY — DEEP ENRICHMENT
    // ────────────────────────────────────────────────────────
    const apifyStart = Date.now();
    console.log(`[discover] sending ${discoveredHandles.length} handles to Apify...`);

    const { profiles, runIds } = await enrichWithApify(discoveredHandles, apifyToken);
    apifyProfilesScraped       = profiles.length;
    apifyRuns                  = runIds.length;
    timing.apifyMs             = Date.now() - apifyStart;
    console.log(`[discover] Apify enriched ${profiles.length} profiles in ${timing.apifyMs}ms`);

    // ────────────────────────────────────────────────────────
    // 4. UPSERT ENRICHED PROFILES
    // ────────────────────────────────────────────────────────
    const scoringStart = Date.now();
    const minFollowers = Number(filters.minFollowers ?? 10_000);
    const validProfiles = (profiles.filter(Boolean) as Record<string, unknown>[])
      .filter((p) => Number((p as any).followers ?? 0) >= minFollowers);
    await upsertProfiles(supabase, validProfiles);
    timing.scoringMs = Date.now() - scoringStart;
    console.log(`[discover] upserted ${validProfiles.length} profiles in ${timing.scoringMs}ms`);

    // ────────────────────────────────────────────────────────
    // 5. FINAL CACHE READ — return freshly upserted results
    // ────────────────────────────────────────────────────────
    const finalResult = await checkCache(supabase, filters);
    timing.totalMs    = Date.now() - wallStart;

    console.log(`[discover] done — ${finalResult.hitCount} creators returned in ${timing.totalMs}ms`);

    // ────────────────────────────────────────────────────────
    // 6. CREDIT DEBIT (only for successful live discovery)
    // ────────────────────────────────────────────────────────
    // Definition of "successful": live path + returned at least 1 creator.
    let creditDebit: { debited: boolean; balanceAfter?: number; transactionId?: string } = { debited: false };
    if (finalResult.hitCount > 0) {
      creditDebit = await debitLiveSearchCredits({
        supabase,
        userId,
        workspaceId,
        queryHash,
        idempotencyKey,
        serperCalls,
        apifyRuns,
        resultCount: finalResult.hitCount,
      });
      if (!creditDebit.debited) {
        // Credits became insufficient due to a concurrent request. Fail closed.
        await logQuery(supabase, {
          userId,
          workspaceId,
          queryHash,
          filters,
          cacheHit: false,
          cacheHitCount: cacheResult.hitCount,
          liveDiscoveryCount: 0,
          serperCalls,
          serperResultsRaw,
          apifyRuns,
          apifyProfilesScraped,
          timing,
          resultCount: 0,
          error: "insufficient_credits_post_run",
        });
        return jsonResponse(
          req,
          { error: "Insufficient credits", code: "insufficient_credits" },
          402,
        );
      }
    }

    const wantN = pickResultCount(shuffleSeed, RESULT_TARGET_MIN, RESULT_TARGET_MAX);
    let creatorsOut = filterCreatorsByExclude(finalResult.data ?? [], excludeKeys);
    creatorsOut = seededShuffle(creatorsOut as unknown[], shuffleSeed ^ 0x9e3779b9).slice(
      0,
      Math.min(wantN, creatorsOut.length),
    );

    await logQuery(supabase, {
      userId,
      workspaceId,
      queryHash, filters, cacheHit: false,
      cacheHitCount: cacheResult.hitCount,
      liveDiscoveryCount: finalResult.hitCount,
      serperCalls, serperResultsRaw, apifyRuns, apifyProfilesScraped,
      timing, resultCount: creatorsOut.length,
    });

    await logUserActivity({
      req,
      userId,
      workspaceId,
      actionType: "search_run",
      status: "success",
      metadata: {
        module: "discover-creators",
        query_hash: queryHash,
        platforms: filters.platforms ?? [],
        cities: filters.cities ?? [],
        result_count: creatorsOut.length,
        serper_calls: serperCalls,
        apify_runs: apifyRuns,
        timing_ms: timing.totalMs,
      },
    });

    return jsonResponse(req, {
      creators: creatorsOut,
      source:   "live",
      count:    creatorsOut.length,
      credits: creditDebit.debited
        ? { debited: LIVE_SEARCH_CREDIT_COST, balance_after: creditDebit.balanceAfter }
        : { debited: 0 },
      timing: {
        total_ms:   timing.totalMs,
        cache_ms:   timing.cacheMs,
        serper_ms:  timing.serperMs,
        apify_ms:   timing.apifyMs,
        scoring_ms: timing.scoringMs,
      },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[discover] unhandled error:", message);
    timing.totalMs = Date.now() - wallStart;

    await logQuery(supabase, {
      userId,
      workspaceId,
      queryHash, filters, cacheHit: false,
      cacheHitCount: 0, liveDiscoveryCount: 0,
      serperCalls, serperResultsRaw, apifyRuns, apifyProfilesScraped,
      timing, resultCount: 0, error: message,
    });

    await logUserActivity({
      req,
      userId,
      workspaceId,
      actionType: "search_run",
      status: "error",
      metadata: {
        module: "discover-creators",
        query_hash: queryHash,
        error: message,
        serper_calls: serperCalls,
        apify_runs: apifyRuns,
        timing_ms: timing.totalMs,
      },
    });

    return jsonResponse(req, { error: "Internal error", detail: message }, 500);
  }
});
