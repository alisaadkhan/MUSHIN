import { isSuperAdmin, performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
import { logApiUsageAsync } from "../_shared/telemetry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";
import { checkRateLimit, corsHeaders, tooManyRequests } from "../_shared/rate_limit.ts";
import { assertNoSecretsInRequestBody } from "../_shared/secrets.ts";
import { inferNiche } from "../_shared/niche.ts";
import { extractCity } from "../_shared/geo.ts";
import { extractFollowers } from "../_shared/followers.ts";
import { getBenchmarkEngagement } from "../_shared/engagement.ts";
import { extractUsername, isValidPlatform, DOMAIN_MAP, isTikTokProfileUrl } from "../_shared/platform.ts";
import { computeSearchScore, computeSearchScoreV2, snippetRelevanceScore, detectSearchIntent, computeRecencySignal } from "../_shared/ranking.ts";
import { normalizeQuery, detectLanguage } from "../_shared/language.ts";
import { getTagScore, normalizeTags } from "../_shared/tag_intelligence.ts";
import { expandSerperQueries, extractContactEmail, detectSocialLinks } from "../_shared/query_expander.ts";
let redis: Redis | null = null;
if (Deno.env.get("UPSTASH_REDIS_REST_URL") && Deno.env.get("UPSTASH_REDIS_REST_TOKEN")) {
  redis = new Redis({
    url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
    token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
  });
}

// RC-06: Load explicit preview origins from env — never use *.vercel.app wildcard.
const PREVIEW_ORIGINS_SI: Set<string> = new Set(
  (Deno.env.get("ALLOWED_PREVIEW_ORIGINS") ?? "")
    .split(",").map((s: string) => s.trim()).filter(Boolean)
);
function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const appUrl = Deno.env.get("APP_URL") || "https://mushin.app";
  const allowed = new Set<string>([
    appUrl,
    "http://localhost:5173",
    "http://localhost:3000",
    ...PREVIEW_ORIGINS_SI,
  ]);
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": allowed.has(origin) ? origin : appUrl,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  let statusCode = 200;
  let userId: string | undefined = undefined;
  let workspaceIdStr: string | undefined = undefined;

  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const requestBody = await req.json();
    assertNoSecretsInRequestBody(requestBody, "search-influencers");
    const rawQuery = requestBody?.query ?? "";
    const rawPlatform = requestBody?.platform ?? "";

    const rawSanitized = rawQuery.trim().replace(/[^a-zA-Z0-9\s\u0600-\u06FF.-]/g, "").trim();
    // Normalize query: collapse name variants and detect language
    const sanitized = rawSanitized ? normalizeQuery(rawSanitized) || rawSanitized : rawSanitized;
    const queryLanguage = detectLanguage(rawSanitized);
    // Hard caps: minimum 2 chars, maximum 200 chars to prevent quota burn
    if (!sanitized || sanitized.length < 2 || sanitized.length > 200 || !rawPlatform) {
      return new Response(
        JSON.stringify({
          error: !rawPlatform
            ? "Please select at least one platform to search creators."
            : "query and platform are required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate platform against strict allowlist — prevents injected values in DB queries
    const platform = rawPlatform.toLowerCase().trim();
    if (!isValidPlatform(platform)) {
      return new Response(
        JSON.stringify({ error: "Invalid platform. Must be one of: instagram, tiktok, youtube, twitch." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const query = sanitized;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      statusCode = 401;
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const t0 = performance.now();
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      statusCode = 401;
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    userId = userData.user.id;

    // Reject if user is restricted
    const { data: profile } = await supabase.from("profiles").select("is_restricted").eq("id", userId).single();
    if (profile?.is_restricted) {
      statusCode = 403;
      return new Response(JSON.stringify({ error: "Account restricted. Contact support." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerIsSuperAdmin = await isSuperAdmin(userData.user.id);

    const { data: workspaceId, error: wsError } = await supabase.rpc("get_user_workspace_id");
    if (wsError || !workspaceId) {
      statusCode = 400;
      return new Response(JSON.stringify({ error: "No workspace found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    workspaceIdStr = workspaceId;

    // Dual-layer rate limit: both per-IP and per-workspace must pass.
    if (!callerIsSuperAdmin) {
      const ipRate = await checkRateLimit(ip, "search");
      const workspaceRate = await checkRateLimit(workspaceId as string, "search", { isWorkspace: true });
      if (!ipRate.allowed || !workspaceRate.allowed) {
        statusCode = 429;
        return tooManyRequests(Math.max(ipRate.retryAfter ?? 0, workspaceRate.retryAfter ?? 0), corsHeaders);
      }
    }

    const serviceClient = await performPrivilegedWrite({
        authHeader: req.headers.get("Authorization"),
        action: "gateway:privileged-client-bootstrap",
      endpoint: "search-influencers",
      ipAddress: ip,
        execute: async (_ctx, client) => client,
    });

    const { data: workspace } = await serviceClient
      .from("workspaces")
      .select("search_credits_remaining")
      .eq("id", workspaceId)
      .single();

    // 1. Behavioral Anomaly Detection
    // If a workspace does more than 30 searches in 5 minutes, flag as anomalous
    const fiveMinsAgo = new Date(Date.now() - 5 * 60000).toISOString();
    const { count: recentSearches } = await serviceClient
      .from("search_history")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", fiveMinsAgo);

    if (recentSearches && recentSearches > 30) {
      await serviceClient.from("anomaly_logs").insert({
        workspace_id: workspaceId,
        user_id: userData.user.id,
        event_type: "velocity_spike",
        severity: "high",
        details: { searches_last_5m: recentSearches, ip_address: ip },
      });
      console.warn(`[search-influencers] High velocity anomaly for WS ${workspaceId} (IP: ${ip})`);
      return new Response(JSON.stringify({ error: "Search rate limit exceeded. Please slow down." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { platform: _platformIgnored, location: rawLocation, followerRange, engagementRange } = requestBody;
    // Sanitize location ΓÇö strip anything that isn't letters/spaces/hyphens
    const location = typeof rawLocation === "string"
      ? rawLocation.replace(/[^a-zA-Z\s-]/g, "").trim().slice(0, 50)
      : "";

    const cacheKey = `search:${query.toLowerCase().trim()}:${platform}:${location || "any"}:${followerRange || "any"}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const t1 = performance.now();
          await supabase.from("admin_audit_log").insert({
            action: "search", admin_user_id: userData.user.id,
            details: { query, platform, location, latency_ms: Math.round(t1 - t0), cached: true }
          }); // { error } silently ignored ΓÇö audit log best-effort
          return new Response(JSON.stringify({ results: cached, cached: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (e) { console.warn("Redis Fetch Error", e); }
    }

    // ── DB-First Search ───────────────────────────────────────────────────────
    // Before spending a Serper credit, check the local creator database.
    // If we already have ≥ MIN_DB_RESULTS enriched profiles for this query,
    // return them immediately. This dramatically reduces external API usage
    // once the creator index grows.
    // RC-03: Lowered from 20 to 5 — niche/city queries rarely have 20 enriched
    // profiles; using stubs with follower data is better than always falling to Serper.
    const MIN_DB_RESULTS = 5;
    const queryNicheDataPre = inferNiche(query, "", query);
    const queryNichePre = queryNicheDataPre.confidence >= 0.3 ? queryNicheDataPre.niche : null;
    const queryCityPre = extractCity(`${query} ${location || ""}`, query)
      ?? (location && location !== "All Pakistan" ? location : null);

    // Parse follower range for DB query
    const rangeMap: Record<string, [number, number]> = {
      "1k-10k":     [1_000,     10_000],
      "10k-50k":    [10_000,    50_000],
      "50k-100k":   [50_000,    100_000],
      "100k-500k":  [100_000,   500_000],
      "100k+":      [100_000,   Infinity],
      "500k+":      [500_000,   Infinity],
    };
    const [dbMinFollowers, dbMaxFollowers] = (followerRange && rangeMap[followerRange])
      ? rangeMap[followerRange] : [0, 9_999_999_999];

    // Parse engagement rate range
    const engRangeMap: Record<string, [number, number]> = {
      "0-2":  [0, 2],
      "2-5":  [2, 5],
      "5-10": [5, 10],
      "10+":  [10, 999],
    };
    const [minEr] = (engagementRange && engRangeMap[engagementRange])
      ? engRangeMap[engagementRange] : [0, 999];

    // Extract tags from query for DB tag matching
    const queryWords = query.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(w => w.length > 2);

    try {
      const { data: dbRows } = await serviceClient.rpc("tag_match_influencers", {
        p_platform:      platform,
        p_tags:          queryWords,
        p_niche:         queryNichePre,
        p_min_followers: dbMinFollowers === Infinity ? 0 : dbMinFollowers,
        p_max_followers: dbMaxFollowers === Infinity ? 9_999_999_999 : dbMaxFollowers,
        p_min_er:        minEr,
        p_city:          queryCityPre ?? null,
        p_limit:         80,
      });

      const dbResults = (dbRows ?? []) as any[];
      // RC-03: Include stubs that have follower data — they're useful for ranking
      // even without full profile enrichment. Only truly empty stubs are excluded.
      const enrichedDbResults = dbResults.filter(
        (r: any) => r.enrichment_status === "success" || r.follower_count != null
      );

      if (enrichedDbResults.length >= MIN_DB_RESULTS) {
        // Log which tier produced results for observability
        const fullyEnriched = dbResults.filter((r: any) => r.enrichment_status === "success").length;
        console.log(`[search-influencers] DB-first HIT: ${fullyEnriched} enriched + ${enrichedDbResults.length - fullyEnriched} stubs with follower data`);
        console.log(`[search-influencers] DB-first hit: ${enrichedDbResults.length} enriched profiles, skipping Serper`);

        // Re-use ranking infrastructure on DB results
        const queryIntentPre = detectSearchIntent(query);
        const queryLanguagePre = detectLanguage(query);

        const scoredDbResults = enrichedDbResults.map((r: any) => {
          const creatorTags = r.tags ?? [];
          const tagScore = getTagScore(query, creatorTags);
          const score = computeSearchScoreV2({
            query,
            displayName:                  r.full_name ?? r.username,
            username:                     r.username,
            engagementRate:               r.engagement_rate ?? null,
            followerCount:                r.follower_count ?? null,
            isRealEngagement:             true,
            platform,
            niche:                        r.primary_niche ?? null,
            queryNiche:                   queryNichePre,
            city:                         r.city ?? null,
            queryCity:                    queryCityPre,
            tags:                         creatorTags,
            semanticSimilarity:           snippetRelevanceScore(query, r.bio ?? ""),
            precomputedAuthenticityScore: null,
            precomputedEngagementQuality: null,
            recencySignal:                computeRecencySignal(r.last_enriched_at ?? null),
            intent:                       queryIntentPre,
          });
          return {
            title:            r.full_name ?? r.username,
            link:             `https://www.${platform === "youtube" ? "youtube.com/@" : platform === "instagram" ? "instagram.com/" : platform === "tiktok" ? "tiktok.com/@" : "twitch.tv/"}${r.username}`,
            snippet:          r.bio ?? "",
            username:         r.username,
            platform,
            imageUrl:         r.avatar_url ?? null,
            bio:              r.bio ?? null,
            full_name:        r.full_name ?? null,
            extracted_followers: r.follower_count ?? null,
            engagement_rate:  r.engagement_rate ?? null,
            engagement_source: "real_enriched" as const,
            city_extracted:   r.city ?? null,
            niche:            r.primary_niche ?? null,
            is_enriched:      true,
            enrichment_status: "success",
            last_enriched_at: r.last_enriched_at ?? null,
            is_stale:         r.last_enriched_at
              ? (Date.now() - new Date(r.last_enriched_at).getTime()) > 30 * 86400000
              : false,
            tags:             creatorTags,
            _search_score:    score,
            _tag_score:       tagScore,
            _query_language:  queryLanguagePre,
            _intent:          queryIntentPre.intent,
            _source:          "db",
          };
        }).sort((a: any, b: any) => b._search_score - a._search_score).slice(0, 50);

        // Log search + cache results
        const writeOps = [
          serviceClient.from("search_history").insert({
            workspace_id: workspaceId, query, platform,
            location: location || null, result_count: scoredDbResults.length, filters: {},
          }),
          serviceClient.from("credits_usage").insert({ workspace_id: workspaceId, action_type: "search", amount: 1 }),
        ];
        if (!callerIsSuperAdmin) {
          writeOps.push(serviceClient.rpc("consume_search_credit", { ws_id: workspaceId }).catch(() => null));
        }
        await Promise.all(writeOps);

        if (redis && scoredDbResults.length > 0) {
          redis.set(cacheKey, JSON.stringify(scoredDbResults), { ex: 1800 }).catch(() => null);
        }

        return new Response(
          JSON.stringify({ results: scoredDbResults, credits_remaining: callerIsSuperAdmin ? Number.MAX_SAFE_INTEGER : (workspace?.search_credits_remaining || 1) - 1, source: "db" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[search-influencers] DB-first miss (${enrichedDbResults.length} enriched / ${dbResults.length} total), falling through to Serper`);
    } catch (dbErr: any) {
      console.warn("[search-influencers] DB-first lookup failed:", dbErr.message);
      // Non-fatal — fall through to Serper
    }

    // Deduct credit BEFORE Serper call ΓÇö prevents free searches if downstream crashes
    if (!callerIsSuperAdmin) {
      try {
        await serviceClient.rpc("consume_search_credit", { ws_id: workspaceId });
      } catch (error: any) {
        if (error.code === "P0001") {
          return new Response(JSON.stringify({ error: "Insufficient credits" }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw error;
      }
    }

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    if (!SERPER_API_KEY) {
      return new Response(JSON.stringify({ error: "Serper API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build a safe, plain-text Serper query. Avoid boolean OR syntax — some
    // Serper configurations reject it, producing non-2xx responses.
    const NON_PAKISTAN_LOCATIONS = ["usa", "uk", "india", "canada", "australia",
      "europe", "america", "united states", "united kingdom", "uae", "dubai", "us", "global"];
    const queryLower = query.toLowerCase();
    const hasForeignLocation = NON_PAKISTAN_LOCATIONS.some(loc => queryLower.includes(loc));

    // City-specific query gets city name appended so Serper returns local results
    const cityForQuery = (location && location !== "All Pakistan") ? location : "";

    // Generate query variants via the expansion engine.
    // Run PRIMARY + all expansions in parallel for broader creator discovery.
    // This surfaces creators who appear under different search phrasings
    // (e.g. "tech youtuber" vs "tech influencer" vs "technology reviewer").
    // RC-05: Pass detected niche so expansion generates niche-specific queries
    // (e.g. "food blogger lahore" → Food niche terms, not General's "content creator").
    const queryVariants = hasForeignLocation
      ? [{ query: `${query} ${platform} influencer`.trim(), strategy: "primary" as const, weight: 1.0 }]
      : expandSerperQueries(query, platform, cityForQuery, queryNichePre ?? "General");

    const primaryVariant = queryVariants[0];
    console.log("Serper queries to run:", queryVariants.map(v => `[${v.strategy}] ${v.query}`).join(" | "));

    let serperData: any = { organic: [], knowledgeGraph: null };
    const profileImageMap: Map<string, string> = new Map();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      // Run ALL query variants in parallel to maximise discovery coverage.
      // Each variant targets a different phrasing so we surface creators that
      // only appear under specific query forms.
      const searchFetches = queryVariants.map(variant =>
        fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ q: variant.query, num: 100, gl: "pk", hl: "en" }),
          signal: controller.signal,
        })
      );

      // Images fetch runs alongside search fetches (no credit impact on images)
      const imagesFetch = fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q: `${query} ${platform} Pakistan influencer profile picture`, num: 20, gl: "pk" }),
        signal: controller.signal,
      });

      const allResponses = await Promise.all([...searchFetches, imagesFetch]);
      clearTimeout(timeout);

      const imageRes = allResponses[allResponses.length - 1];
      const searchResponses = allResponses.slice(0, -1);

      // Check primary result — if it fails, abort the whole search
      if (!searchResponses[0].ok) {
        const errText = await searchResponses[0].text();
        console.error("Serper primary API error:", searchResponses[0].status, errText);
        return new Response(
          JSON.stringify({ results: [], credits_remaining: (workspace?.search_credits_remaining || 1) - 1 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const primaryData = await searchResponses[0].json();
      serperData = { organic: primaryData.organic ?? [], knowledgeGraph: primaryData.knowledgeGraph ?? null };

      // Merge all expansion results
      for (let i = 1; i < searchResponses.length; i++) {
        if (searchResponses[i].ok) {
          const expansionData = await searchResponses[i].json();
          const extra: any[] = expansionData.organic ?? [];
          serperData.organic = [...serperData.organic, ...extra];
          console.log(`[${queryVariants[i]?.strategy}] added ${extra.length} results`);
        }
      }

      const imageData = imageRes.ok ? await imageRes.json() : { images: [] };
      for (const img of (imageData.images || [])) {
        if (img.link && img.imageUrl) profileImageMap.set(img.link, img.imageUrl);
      }
    } catch (serperErr: any) {
      console.error("Serper fetch failed:", serperErr?.message);
      return new Response(
        JSON.stringify({ results: [], credits_remaining: (workspace?.search_credits_remaining || 1) - 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const organic = serperData.organic || [];
    const knowledgeGraph = serperData.knowledgeGraph ?? null;

    const expectedDomain = DOMAIN_MAP[platform];

    const platformFiltered = expectedDomain
      ? organic.filter((item: any) => {
        if (!item.link?.includes(expectedDomain)) return false;
        if (platform === "tiktok") {
          if (!isTikTokProfileUrl(item.link)) return false;
        }
        return true;
      })
      : organic;

    const PAKISTAN_KEYWORDS = [
      "pakistan", "karachi", "lahore", "islamabad", "rawalpindi", "faisalabad",
      "multan", "peshawar", "quetta", "sialkot", "gujranwala", "hyderabad",
      "bahawalpur", "paki", "pakistani", "isb", "lhr", "khi",
      "punjab", "sindh", "balochistan", "kpk", "khyber",
    ];
    // Indian city/country signals ΓÇö used to exclude non-Pakistani creators
    const INDIA_SIGNALS = [
      "india", "indian", "indians",
      "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad india",
      "chennai", "kolkata", "pune", "ahmedabad", "jaipur", "surat",
      "bharat", "hindustan", "rupee india",
      "youtube india", "instagram india", "tiktok india",
      "indian gamer", "indian creator", "indian influencer",
    ];

    const selectedCity = (location && location !== "All Pakistan") ? location.toLowerCase() : null;
    const tier1: any[] = [], tier2: any[] = [];
    // tier3 (no Pakistan signal) intentionally dropped ΓÇö only show verified Pakistani creators

    for (const item of platformFiltered) {
      const text = ((item.title || "") + " " + (item.snippet || "")).toLowerCase();
      const hasPakistanSignal = PAKISTAN_KEYWORDS.some(kw => text.includes(kw));
      const hasIndiaSignal = INDIA_SIGNALS.some(kw => text.includes(kw));
      // Hard reject India-only signals
      if (hasIndiaSignal && !hasPakistanSignal) continue;
      if (selectedCity && text.includes(selectedCity)) tier1.push(item);
      // tier2: has Pakistan signal, or no geo signal at all (give benefit of doubt for platform-matched URLs)
      else tier2.push(item);
    }

    // Quality score each result before slicing
    // Higher score = more likely to be a real influencer profile (not a listicle or news article)
    function qualityScore(item: any): number {
      let score = 0;
      const text = ((item.title || "") + " " + (item.snippet || "")).toLowerCase();
      const link = (item.link || "").toLowerCase();

      // Has a clean profile URL structure (not a list/article page)
      if (!link.includes("list") && !link.includes("article") && !link.includes("news")) score += 15;

      // Snippet contains follower count (strong signal it's a profile)
      if (/\d+[km]?\s*(followers?|subscribers?|subs)/i.test(item.snippet || "")) score += 25;

      // Title looks like a person/brand name (not a blog post title)
      if (!/(top \d+|best|list of|how to|what is|review)/i.test(item.title || "")) score += 10;

      // Has a thumbnail (profile pages typically do)
      if (item.thumbnailUrl || item.imageUrl) score += 10;

      // Contains Pakistan signal in snippet (content relevance)
      if (PAKISTAN_KEYWORDS.some(kw => text.includes(kw))) score += 15;

      // Snippet length is substantial (real profile descriptions are longer)
      if ((item.snippet || "").length > 80) score += 10;

      // Penalize aggregator sites
      if (/(hypeauditor|socialblade|noxinfluencer|influencermarketinghub|statista)/i.test(link)) score -= 30;
      if (/(wikipedia|news|blog|article|press)/i.test(link)) score -= 20;

      return score;
    }

    // Sort each tier by quality before merging
    const sortByQuality = (arr: any[]) => [...arr].sort((a, b) => qualityScore(b) - qualityScore(a));

    // Filter out items with very low quality scores (< 10 = likely not a real profile)
    const qualityFilter = (arr: any[]) => arr.filter(item => qualityScore(item) >= 10);

    // Result count targets: 20 minimum, 50 maximum per platform
    const MIN_RESULTS = 20;
    const MAX_RESULTS = 50;

    // Build ranked candidates list: tier-1 (city match) first, then tier-2
    const candidates = [
      ...sortByQuality(qualityFilter(tier1)),
      ...sortByQuality(qualityFilter(tier2)),
    ];

    const finalResults = candidates.slice(0, MAX_RESULTS);

    // If below minimum, relax quality threshold completely and fill up from remaining
    if (finalResults.length < MIN_RESULTS) {
      const relaxedCandidates = [
        ...sortByQuality(tier1),
        ...sortByQuality(tier2),
      ];
      const seen = new Set(finalResults.map((r: any) => r.link));
      for (const item of relaxedCandidates) {
        if (finalResults.length >= MAX_RESULTS) break;
        if (!seen.has(item.link)) { seen.add(item.link); finalResults.push(item); }
      }
      console.log(`[search] Relaxed quality filter: ${candidates.length} → ${finalResults.length} results`);
    }

    const rawResults = await Promise.all(
      finalResults.map(async (item: any) => {
        const username = extractUsername(item.link, platform);
        if (!username) return null;

        let title = item.title || "";

        if (platform === "youtube" && username.startsWith("UC")) {
          try {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 2000);
            const res = await fetch(
              `https://www.youtube.com/oembed?url=https://www.youtube.com/channel/${username}&format=json`,
              { signal: ctrl.signal }
            );
            clearTimeout(tid);
            if (res.ok) {
              const d = await res.json();
              if (d.author_name) title = d.author_name;
            }
          } catch { /* noop */ }
        }

        const snippetText = title + " " + (item.snippet || "");
        const nicheData = inferNiche(title, item.snippet || "", query);
        const city_extracted = extractCity(snippetText, query);

        const imageUrl =
          (knowledgeGraph?.imageUrl && platformFiltered.indexOf(item) === 0
            ? knowledgeGraph.imageUrl : null) ||
          item.thumbnailUrl || item.imageUrl ||
          profileImageMap.get(item.link) || null;

        // Extract contact email from Google snippet when available
        const contact_email = extractContactEmail(snippetText) ?? null;

        // Detect cross-platform social profile links mentioned in the snippet
        const social_links = detectSocialLinks(snippetText, platform);

        return {
          title,
          link: item.link || "",
          snippet: item.snippet || "",
          username,
          platform,
          displayUrl: item.link || "",
          extracted_followers: extractFollowers(snippetText),
          imageUrl,
          niche: nicheData.niche,
          niche_confidence: parseFloat(nicheData.confidence.toFixed(2)),
          city_extracted,
          contact_email,
          social_links,
          engagement_rate: null, // will be filled in the merge step below
          _follower_count_raw: extractFollowers(snippetText), // needed for benchmark lookup
          _quality_score: qualityScore(item),  // internal — used for transparency
        };
      })
    );

    const results = rawResults.filter(Boolean);
    const seen = new Set();
    const uniqueResults = results.filter((r: any) => {
      // Normalize to lowercase + strip leading @ before dedup so that
      // expansion queries returning the same profile in different casing
      // are correctly recognised as duplicates.
      const normalizedUsername = r.username.toLowerCase().replace(/^@/, "");
      const key = `${r.platform}:${normalizedUsername}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Early exit when no results — avoids .in('username', []) Postgres crash
    if (uniqueResults.length === 0) {
      await serviceClient.from("search_history").insert({
        workspace_id: workspaceId, query, platform,
        location: location || null, result_count: 0, filters: {},
      });
      return new Response(
        JSON.stringify({
          results: [],
          credits_remaining: (workspace?.search_credits_remaining || 1) - 1,
          _search_meta: { fallback_tier: 0, tier_label: "no_serper_results", variants_run: queryVariants.length, dedup_before: rawResults.filter(Boolean).length, dedup_after: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Content language filter — validate against strict allowlist first
    const ALLOWED_CONTENT_LANGUAGES = ["any", "urdu", "english", "bilingual"] as const;
    type ContentLanguage = typeof ALLOWED_CONTENT_LANGUAGES[number];
    const rawContentLanguage: unknown = requestBody?.contentLanguage;
    const contentLanguage: ContentLanguage | null =
      typeof rawContentLanguage === "string" && ALLOWED_CONTENT_LANGUAGES.includes(rawContentLanguage as ContentLanguage)
        ? (rawContentLanguage as ContentLanguage)
        : null;

    // Helper: apply content-language filter to a candidate set
    const applyLangFilter = (candidates: any[]): any[] => {
      if (!contentLanguage || contentLanguage === "any") return candidates;
      const URDU_CHARS = /[\u0600-\u06FF]/;
      return candidates.filter((r: any) => {
        const lang: string = (r._query_language || "").toLowerCase();
        const snippet: string = r.snippet || r.bio || "";
        const hasUrdu = URDU_CHARS.test(snippet) || lang.includes("urdu") || lang.includes("roman");
        const hasEnglish = /[a-zA-Z]{3,}/.test(snippet);
        if (!hasUrdu && !hasEnglish) return true; // no signal — keep
        if (contentLanguage === "urdu")      return hasUrdu;
        if (contentLanguage === "english")   return hasEnglish && !hasUrdu;
        if (contentLanguage === "bilingual") return hasUrdu && hasEnglish;
        return true;
      });
    };

    // Helper: apply follower range filter (soft — only hard-drop confirmed out-of-range)
    const applyFollowerFilter = (candidates: any[], range: string): any[] => {
      if (!range || range === "any" || !rangeMap[range]) return candidates;
      const [min, max] = rangeMap[range];
      return candidates.filter((r: any) => {
        if (r.extracted_followers == null) return true; // unknown FC: keep, score penalised
        return r.extracted_followers >= min && (max === Infinity || r.extracted_followers <= max);
      });
    };

    // Helper: apply engagement filter (soft — skip benchmark estimates)
    const applyEngagementFilter = (candidates: any[], range: string): any[] => {
      if (!range || range === "any" || !engRangeMap[range]) return candidates;
      const [minEng, maxEng] = engRangeMap[range];
      return candidates.filter((r: any) => {
        if (!r.engagement_rate || r.engagement_source === "benchmark_estimate") return true;
        return r.engagement_rate >= minEng && r.engagement_rate <= maxEng;
      });
    };

    // Minimum result threshold that satisfies the user (below this → try next tier)
    const TIER_MIN = 3;
    const hasFollowerFilter  = !!(followerRange  && followerRange  !== "any" && rangeMap[followerRange]);
    const hasEngagementFilter = !!(engagementRange && engagementRange !== "any" && engRangeMap[engagementRange]);

    interface FallbackTier { tier: number; label: string; result: any[] }
    let activeTier: FallbackTier = { tier: 0, label: "none", result: [] };

    // Tier 1 — all filters applied (strict)
    {
      let t = applyFollowerFilter(uniqueResults, followerRange);
      t = applyEngagementFilter(t, engagementRange);
      t = applyLangFilter(t);
      console.log(`[search] T1 strict: ${t.length} results`);
      if (t.length >= TIER_MIN || (!hasFollowerFilter && !hasEngagementFilter)) {
        activeTier = { tier: 1, label: "strict", result: t };
      }
    }

    // Tier 2 — relax engagement only (keep follower filter)
    if (!activeTier.tier && hasEngagementFilter) {
      let t = applyFollowerFilter(uniqueResults, followerRange);
      t = applyLangFilter(t);
      console.log(`[search] T2 relax-engagement: ${t.length} results`);
      if (t.length >= TIER_MIN) activeTier = { tier: 2, label: "relax_engagement", result: t };
    }

    // Tier 3 — relax follower only (keep engagement filter)
    if (!activeTier.tier && hasFollowerFilter) {
      let t = applyEngagementFilter(uniqueResults, engagementRange);
      t = applyLangFilter(t);
      console.log(`[search] T3 relax-follower: ${t.length} results`);
      if (t.length >= TIER_MIN) activeTier = { tier: 3, label: "relax_follower", result: t };
    }

    // Tier 4 — relax both follower + engagement (language only)
    if (!activeTier.tier && (hasFollowerFilter || hasEngagementFilter)) {
      const t = applyLangFilter(uniqueResults);
      console.log(`[search] T4 relax-both: ${t.length} results`);
      if (t.length >= TIER_MIN) activeTier = { tier: 4, label: "relax_follower_engagement", result: t };
    }

    // Tier 5 — full relax: all filters off, pure relevance ranking
    if (!activeTier.tier) {
      console.log(`[search] T5 full-relax: ${uniqueResults.length} results`);
      activeTier = { tier: 5, label: "full_relax", result: uniqueResults };
    }

    const TIER_LABELS: Record<number, string> = {
      1: "strict", 2: "relax_engagement", 3: "relax_follower",
      4: "relax_follower_engagement", 5: "full_relax",
    };
    console.log(`[search] Fallback tier ${activeTier.tier} (${activeTier.label}): ${activeTier.result.length} candidates after fallback`);

    // Track whether follower filter was actually applied in the winning tier
    const followerFilterActive = activeTier.tier <= 3 && hasFollowerFilter;
    const filteredResults: any[] = activeTier.result;

    // Merge real profile data (avatar, bio, follower count, engagement) for enriched creators
    const usernames = uniqueResults.map((r: any) => r.username.replace("@", ""));

    const [{ data: enrichedProfiles }, { data: cachedEvals }, { data: cachedRows }] = await Promise.all([
      serviceClient
        .from("influencer_profiles")
        .select("platform, username, avatar_url, bio, follower_count, engagement_rate, enrichment_status, full_name, city, last_enriched_at, enrichment_ttl_days")
        .eq("platform", platform)
        // No enrichment_status filter — include stubs so follower_count is available for cards
        // is_enriched on each result is derived from profile?.enrichment_status === "success"
        .in("username", usernames),
      serviceClient
        .from("influencer_evaluations")
        .select("platform, username, evaluation")
        .eq("platform", platform)
        .in("username", usernames),
      // Fetch pre-computed quality scores + tags from cache for v2 ranking
      serviceClient
        .from("influencers_cache")
        .select("platform, username, tags, authenticity_score, engagement_quality_score")
        .eq("platform", platform)
        .in("username", usernames.map((u: string) => u.replace("@", ""))),
    ]);

    const profileMap = new Map();
    for (const p of (enrichedProfiles || [])) {
      profileMap.set(`${p.platform}:@${p.username}`, p);
    }
    const cacheQualityMap = new Map();
    for (const c of (cachedRows || [])) {
      cacheQualityMap.set(`${c.platform}:@${c.username}`, c);
    }
    const evalMap = new Map();
    for (const p of (cachedEvals || [])) {
      const er = p.evaluation?.engagement_rate ?? p.evaluation?.estimated_er;
      if (er != null) evalMap.set(`${p.platform}:@${p.username}`, er);
    }

    const enrichedResults = filteredResults.map((r: any) => {
      const key = `${r.platform}:${r.username}`;
      const profile = profileMap.get(key);
      const evalEr = evalMap.get(key);
      const engagementMeta = (() => {
        if (evalEr != null) return { engagement_rate: evalEr, engagement_is_estimated: false, engagement_source: 'real_eval' };
        if (profile?.engagement_rate != null) return { engagement_rate: profile.engagement_rate, engagement_is_estimated: false, engagement_source: 'real_enriched' };
        const fc = profile?.follower_count ?? r._follower_count_raw ?? null;
        const bm = getBenchmarkEngagement(r.platform, fc);
        return { engagement_rate: bm.rate, engagement_is_estimated: true, engagement_source: 'benchmark_estimate', engagement_benchmark_bucket: bm.bucket };
      })();

      const isFullyEnriched = profile?.enrichment_status === "success";
      return {
        ...r,
        // Only use DB image/bio/full_name when fully enriched ΓÇö stubs have no real data
        imageUrl: isFullyEnriched ? (profile?.avatar_url ?? r.imageUrl) : r.imageUrl,
        bio: isFullyEnriched ? (profile?.bio ?? null) : null,
        extracted_followers: profile?.follower_count ?? r._follower_count_raw,
        ...engagementMeta,
        city_extracted: profile?.city ?? r.city_extracted,
        full_name: isFullyEnriched ? (profile?.full_name ?? null) : null,
        is_enriched: isFullyEnriched,
        enrichment_status: profile?.enrichment_status ?? null,
        last_enriched_at: profile?.last_enriched_at ?? null,
        is_stale: profile?.last_enriched_at
          ? (Date.now() - new Date(profile.last_enriched_at).getTime()) > (profile.enrichment_ttl_days ?? 30) * 86400000
          : false,
      };
    });

    // Infer query niche and city for multi-factor relevance scoring.
    // inferNiche scans NICHE_KEYWORDS against the query text.
    const queryNicheData = inferNiche(query, "", query);
    const queryNiche = queryNicheData.confidence >= 0.3 ? queryNicheData.niche : null;
    // extractCity checks PAKISTAN_CITIES aliases against the combined query + location string.
    const queryCity = extractCity(`${query} ${location || ""}`, query)
      ?? (location && location !== "All Pakistan" ? location : null);

    // Detect search intent once — used by all result rankings below.
    const queryIntent = detectSearchIntent(query);
    console.log(`[search-influencers] intent=${queryIntent.intent} confidence=${queryIntent.confidence.toFixed(2)}`);

    // v2 Multi-factor ranking — see _shared/ranking.ts for full scoring logic.
    // Formula: keywordRel×0.35 + tagStrength×0.20 + semanticSim×0.20
    //        + engQuality×0.15 + authenticity×0.10
    // RC-01/02 scoring: apply score penalties for out-of-preferred-range results
    // so they sort to the bottom rather than being hard-dropped entirely.
    const followerPenalty = (r: any): number => {
      if (!followerFilterActive || !rangeMap[followerRange]) return 1.0;
      if (r.extracted_followers == null) return 0.6; // unknown follower count — mild penalty
      const [min, max] = rangeMap[followerRange];
      if (r.extracted_followers < min * 0.5 || (max !== Infinity && r.extracted_followers > max * 2)) return 0.2;
      if (r.extracted_followers < min || (max !== Infinity && r.extracted_followers > max)) return 0.5;
      return 1.0;
    };

    const sortedResults = enrichedResults
      .filter((r: any) => {
        // Hard reject: verified real engagement data below absolute bot floor (0.3 %)
        if (r.is_enriched && r.engagement_source !== "benchmark_estimate" &&
            (r.engagement_rate ?? 100) < 0.3) return false;
        return true;
      })
      .map((r: any) => {
        const cacheKey2 = `${r.platform}:${r.username}`;
        const cached = cacheQualityMap.get(cacheKey2);
        const creatorTags = cached?.tags ? normalizeTags(cached.tags) : [];
        const tagScore = getTagScore(query, creatorTags);

        const baseScore = computeSearchScoreV2({
          query,
          displayName:                  r.title ?? "",
          username:                     r.username ?? "",
          engagementRate:               r.engagement_rate ?? null,
          followerCount:                r.extracted_followers ?? null,
          isRealEngagement:             r.engagement_source !== "benchmark_estimate",
          platform,
          niche:                        r.niche ?? null,
          queryNiche,
          city:                         r.city_extracted ?? null,
          queryCity,
          tags:                         creatorTags,
          semanticSimilarity:           snippetRelevanceScore(query, r.snippet ?? ""),
          precomputedAuthenticityScore: cached?.authenticity_score ?? null,
          precomputedEngagementQuality: cached?.engagement_quality_score ?? null,
          recencySignal:                computeRecencySignal(r.last_enriched_at ?? null),
          intent:                       queryIntent,
        });
        // RC-01: multiply by follower-range penalty so out-of-range creators sort last
        const score = baseScore * followerPenalty(r);
        return {
          ...r,
          _search_score: score,
          _tag_score: tagScore,
          _query_language: queryLanguage,
          _intent: queryIntent.intent,
          tags: creatorTags,
          // Expose filter meta to frontend for contextual messaging
          _follower_filter_active: followerFilterActive,
          _follower_in_range: r.extracted_followers != null
            ? (() => { if (!rangeMap[followerRange]) return true; const [mn,mx] = rangeMap[followerRange]; return r.extracted_followers >= mn && (mx === Infinity || r.extracted_followers <= mx); })()
            : null,
        };
      })
      .sort((a: any, b: any) => b._search_score - a._search_score);

    console.log(`[search] Final results: ${sortedResults.length} (post-scoring), deduped from ${uniqueResults.length} unique, ${uniqueResults.length - filteredResults.length} soft-filtered`);

    // @deprecated v1 formula (computeSearchScore) kept for reference — remove after 2026-04-06
    // nameSim×0.35 + engQuality×0.25 + authenticity×0.15
    //   + growthStability×0.10 + nicheMatch×0.10 + locationMatch×0.05 − botRisk×0.40

    // Batch upsert instead of N sequential awaits (was O(n) round-trips)
    if (uniqueResults.length > 0) {
      const nowIso = new Date().toISOString();
      const cacheRows = uniqueResults.map((r: any) => ({
        platform: r.platform, username: r.username,
        city_extracted: r.city_extracted ?? null,
        last_seen_at: nowIso,
        data: {
          title: r.title, link: r.link, snippet: r.snippet,
          displayUrl: r.displayUrl, imageUrl: r.imageUrl,
          niche: r.niche, niche_confidence: r.niche_confidence,
          city_extracted: r.city_extracted, followers: r.extracted_followers ?? null,
          engagement_rate: r.engagement_rate,
        },
      }));
      const { error: cacheErr } = await serviceClient.from("influencers_cache")
        .upsert(cacheRows, { onConflict: "platform,username" });
      if (cacheErr) console.warn("Cache upsert failed:", cacheErr.message);

      // Upsert follower-count stubs to influencer_profiles so profile pages can display
      // follower counts even before enrichment runs. For existing stubs we DO update
      // metadata (niche, city, followers, last_seen_at) since the filter already
      // excludes enriched profiles — so ignoreDuplicates is NOT used here.
      const stubRows = uniqueResults
        .filter((r: any) => {
          const existing = profileMap.get(`${r.platform}:${r.username}`);
          return r._follower_count_raw != null && existing?.enrichment_status !== "success";
        })
        .map((r: any) => ({
          platform: r.platform,
          username: r.username.replace("@", ""),
          follower_count: r._follower_count_raw,
          primary_niche: r.niche && r.niche !== "General" ? r.niche : null,
          city: r.city_extracted || null,
          enrichment_status: "stub",
          last_seen_at: nowIso,
        }));
      if (stubRows.length > 0) {
        const { error: stubErr } = await serviceClient
          .from("influencer_profiles")
          .upsert(stubRows, { onConflict: "platform,username" });
        if (stubErr) console.warn("Stub profile upsert failed:", stubErr.message);
      }
    }

    await serviceClient.from("search_history").insert({
      workspace_id: workspaceId, query, platform,
      location: location || null,
      // result_count reflects what the user actually sees (post-filter)
      result_count: sortedResults.length,
      filters: { followerRange: followerRange || null },
    });

    await serviceClient.from("credits_usage").insert({
      workspace_id: workspaceId, action_type: "search", amount: 1,
    });

    if (redis && sortedResults.length > 0) {
      try {
        // Cache SORTED + filtered results (same as what is returned to client)
        await redis.set(cacheKey, JSON.stringify(sortedResults), { ex: 3600 });
        const batch = redis.pipeline();
        for (const result of sortedResults) {
          if (!result.username) continue;
          const cleanUsername = result.username.replace("@", "");
          const tKey = `tag:${cleanUsername}:${platform}`;
          batch.sadd(tKey, cacheKey);
          batch.expire(tKey, 3600);
        }
        await batch.exec();
      } catch (e) { console.warn("Redis Save Error", e); }
    }

    const t1 = performance.now();
    await serviceClient.from("admin_audit_log").insert({
      action: "search", admin_user_id: userData.user.id,
      details: { query, platform, location, latency_ms: Math.round(t1 - t0), result_count: enrichedResults.length, cached: false }
    }); // { error } silently ignored

    return new Response(
      JSON.stringify({
        results: sortedResults,
        credits_remaining: (workspace?.search_credits_remaining || 1) - 1,
        _search_meta: {
          fallback_tier: activeTier.tier,
          tier_label: activeTier.label,
          variants_run: queryVariants.length,
          dedup_before: rawResults.filter(Boolean).length,
          dedup_after: uniqueResults.length,
          filtered_after_tier: filteredResults.length,
          result_count: sortedResults.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Unexpected error:", err);
    statusCode = 500;
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    // SEC-14: Asynchronously log API usage telemetry without blocking the response
    logApiUsageAsync({
      endpoint: "search-influencers",
      request_id: crypto.randomUUID(),
      latency_ms: Date.now() - startTime,
      status_code: statusCode,
      user_id: userId,
      workspace_id: workspaceIdStr
    });
  }
});
