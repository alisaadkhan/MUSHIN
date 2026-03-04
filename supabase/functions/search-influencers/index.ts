import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";
import { checkRateLimit, corsHeaders } from "../_shared/rate_limit.ts";

const NICHE_KEYWORDS: Record<string, [string, number][]> = {
  Food: [
    ["food", 3], ["recipe", 3], ["cooking", 3], ["cook", 2], ["chef", 3],
    ["eat", 2], ["eating", 2], ["foodie", 3], ["food vlog", 5], ["street food", 5],
    ["biryani", 5], ["nihari", 5], ["karahi", 5], ["desi food", 5], ["halal", 2],
    ["baking", 3], ["bakery", 3], ["restaurant review", 4], ["cafe", 2], ["cuisine", 3],
    ["mukbang", 4], ["food review", 5], ["food blogger", 5], ["food photography", 4],
    ["what i eat", 4], ["shawarma", 4], ["sehri", 4], ["iftar", 4], ["dawat", 4],
    ["khana", 4], ["pakwan", 4], ["taste test", 4],
  ],
  Fashion: [
    ["fashion", 3], ["style", 2], ["outfit", 3], ["ootd", 4], ["clothing", 2],
    ["wear", 2], ["dress", 2], ["hoodie", 2], ["streetwear", 4],
    ["mehndi", 3], ["shalwar", 4], ["kurta", 4], ["dupatta", 4], ["abaya", 4],
    ["model", 2], ["lookbook", 4], ["fashion blogger", 5], ["thrifting", 4],
    ["wardrobe", 3], ["aesthetic", 2], ["trend", 2], ["fashion week", 5],
  ],
  Beauty: [
    ["beauty", 3], ["makeup", 4], ["skincare", 4], ["cosmetics", 4],
    ["lipstick", 4], ["foundation", 3], ["eyeshadow", 4], ["glam", 3],
    ["glow", 2], ["beauty blogger", 5], ["contouring", 4], ["blush", 3],
    ["serum", 3], ["moisturizer", 3], ["facials", 3], ["haircare", 3],
    ["hair tutorial", 4], ["get ready with me", 5],
  ],
  Tech: [
    ["tech", 3], ["technology", 3], ["gadget", 4], ["software", 3],
    ["programming", 4], ["coding", 4], ["developer", 3], ["ai", 2],
    ["smartphone", 4], ["unboxing", 4], ["laptop", 4], ["iphone", 4],
    ["android", 3], ["startup", 2], ["tech review", 5], ["benchmark", 3],
  ],
  Fitness: [
    ["fitness", 4], ["gym", 4], ["workout", 4], ["exercise", 4],
    ["health", 2], ["muscle", 3], ["yoga", 4], ["running", 3],
    ["bodybuilding", 5], ["athlete", 3], ["trainer", 3], ["diet plan", 4],
    ["weight loss", 4], ["transformation", 3], ["calisthenics", 5], ["personal trainer", 5],
  ],
  Travel: [
    ["travel", 3], ["traveler", 4], ["adventure", 2], ["explore", 2],
    ["destination", 3], ["tourism", 3], ["trip", 2], ["wanderlust", 4],
    ["travel vlog", 5], ["tour guide", 4], ["backpacker", 4], ["vacation", 3],
    ["swat", 3], ["naran", 3], ["hunza", 4], ["lahore tour", 4], ["travel blogger", 5],
  ],
  Gaming: [
    ["gaming", 4], ["gamer", 4], ["esports", 4], ["twitch", 4],
    ["playstation", 4], ["xbox", 4], ["fortnite", 4], ["pubg", 5],
    ["gameplay", 4], ["free fire", 5], ["valorant", 4],
    ["let's play", 4], ["game review", 5], ["minecraft", 4],
  ],
  Music: [
    ["musician", 4], ["singer", 4], ["song", 3], ["rap", 4],
    ["album", 4], ["concert", 3], ["band", 3], ["bollywood", 4],
    ["coke studio", 5], ["ost", 4], ["cover song", 5], ["vocals", 3],
    ["naat", 5], ["nasheed", 5], ["music video", 5],
    ["recording artist", 5], ["music producer", 5], ["dj", 3], ["lyrics", 3],
  ],
  Education: [
    ["education", 4], ["learning", 3], ["teaching", 4], ["school", 2],
    ["university", 3], ["tutor", 4], ["lecture", 4], ["ielts", 5],
    ["o level", 4], ["a level", 4], ["skill development", 4],
    ["online course", 5], ["educational", 4],
  ],
  Comedy: [
    ["comedian", 5], ["comedy", 4], ["funny", 4], ["humor", 4], ["meme", 3],
    ["prank video", 5], ["sketch comedy", 5], ["stand-up", 5],
    ["laughter", 3], ["joke", 4], ["skit", 5], ["roast", 4], ["parody", 4],
    ["funny video", 5], ["make you laugh", 4], ["comedy channel", 5], ["standup", 5],
  ],
  Parenting: [
    ["mommy blogger", 5], ["parenting", 4], ["baby", 3], ["toddler", 4],
    ["mama", 3], ["mum", 3], ["bachay", 4], ["family life", 4], ["new mom", 5],
    ["pregnancy", 4], ["childcare", 5], ["motherhood", 5], ["newborn", 5],
  ],
  Entertainment: [
    ["lip sync", 4], ["dance challenge", 5], ["entertainment channel", 5],
    ["viral video", 4], ["trending video", 3], ["prank show", 5],
    ["reaction video", 5], ["variety show", 5], ["talk show", 5],
    ["interview show", 5], ["vlogger", 3], ["challenge", 3], ["fyp", 3],
  ],
  Lifestyle: [
    ["lifestyle", 4], ["luxury", 3], ["home decor", 4], ["interior design", 4],
    ["family", 2], ["relationship", 3], ["mindset", 3], ["motivation", 2],
    ["self care", 4], ["morning routine", 4], ["day in my life", 5],
    ["vlog", 3], ["lifestyle blogger", 5], ["productivity", 3],
  ],
  Finance: [
    ["finance", 4], ["money", 3], ["investment", 4], ["stock market", 5],
    ["crypto", 4], ["business", 2], ["entrepreneur", 4], ["saving", 3],
    ["passive income", 4], ["forex", 5], ["trading", 4], ["financial", 4],
  ],
  Health: [
    ["wellness", 4], ["mental health", 5], ["nutrition", 4], ["diet", 3],
    ["therapy", 4], ["doctor", 4], ["medicine", 3], ["herbal", 3],
    ["natural remedies", 4], ["hakeem", 4], ["healthcare", 4], ["medical", 3],
  ],
  Sports: [
    ["sports", 3], ["cricket", 5], ["football", 4], ["soccer", 4],
    ["tennis", 4], ["hockey", 4], ["psl", 5], ["ipl", 4], ["match", 3],
    ["kabaddi", 5], ["badminton", 4], ["wrestling", 3], ["sports analyst", 5],
  ],
  News: [
    ["news", 3], ["current affairs", 5], ["politics", 4], ["journalist", 5],
    ["anchor", 4], ["breaking news", 5], ["news update", 4], ["reporter", 4],
    ["geo news", 5], ["ary news", 5], ["analysis", 3], ["political analyst", 5],
  ],
  Photography: [
    ["photography", 4], ["photographer", 5], ["camera review", 5],
    ["portrait", 4], ["landscape photography", 5], ["photo editing", 4],
    ["lightroom", 5], ["photoshoot", 4], ["cinematography", 5],
  ],
  Art: [
    ["artist", 3], ["drawing", 4], ["painting", 4], ["sketch", 3],
    ["illustration", 4], ["calligraphy", 5], ["digital art", 5],
    ["graphic design", 4], ["animation", 4],
  ],
};

const NICHE_PRIORITY = [
  "Food", "Tech", "Gaming", "Sports", "Music", "Comedy", "Education",
  "Fitness", "Beauty", "Fashion", "Travel", "Finance", "Parenting",
  "Entertainment", "Health", "News", "Photography", "Art", "Lifestyle",
];

const THRESHOLD = 3;
const DOMINANCE_GAP = 2;

const QUERY_BOOSTS: Array<[string[], string]> = [
  [["tech", "technology", "gadget", "software", "coding", "developer"], "Tech"],
  [["gaming", "gamer", "game", "esports", "pubg", "free fire", "valorant"], "Gaming"],
  [["food", "recipe", "cooking", "chef", "foodie", "restaurant"], "Food"],
  [["fashion", "style", "outfit", "ootd", "clothing"], "Fashion"],
  [["fitness", "gym", "workout", "bodybuilding"], "Fitness"],
  [["beauty", "makeup", "skincare"], "Beauty"],
  [["comedy", "funny", "humor", "comedian"], "Comedy"],
  [["travel", "traveler", "tourism", "adventure"], "Travel"],
  [["music", "singer", "musician", "rap", "song"], "Music"],
  [["sports", "cricket", "football", "psl"], "Sports"],
  [["parenting", "mommy", "baby", "toddler", "mother"], "Parenting"],
  [["entertainment", "viral", "trending", "challenge"], "Entertainment"],
];

function inferNiche(title: string, snippet: string, query = ""): { niche: string; confidence: number } {
  const titleText = (title || "").toLowerCase().repeat(2);
  const snippetText = (snippet || "").toLowerCase();
  const text = `${titleText} ${snippetText}`;
  const lowerQuery = (query || "").toLowerCase();

  const scores: Record<string, number> = {};

  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    let score = 0;
    for (const [kw, weight] of keywords) {
      if (text.includes(kw)) score += weight;
    }
    if (score > 0) scores[niche] = score;
  }

  for (const [queryKws, niche] of QUERY_BOOSTS) {
    if (queryKws.some(k => lowerQuery.includes(k))) {
      scores[niche] = (scores[niche] ?? 0) + 4;
    }
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (sorted.length === 0) return { niche: "General", confidence: 0.1 };

  const [topNiche, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] ?? 0;

  if (topScore < THRESHOLD) return { niche: "General", confidence: Math.min(topScore / (THRESHOLD * 2), 0.4) };

  const baseConf = Math.min(0.5 + (topScore * 0.05), 0.95);

  if (topScore - secondScore < DOMINANCE_GAP && secondScore >= THRESHOLD) {
    const tied = sorted
      .filter(([, s]) => topScore - s < DOMINANCE_GAP && s >= THRESHOLD)
      .map(([n]) => n);
    for (const n of NICHE_PRIORITY) {
      if (tied.includes(n)) return { niche: n, confidence: baseConf - 0.2 }; // Uncertainty penalty
    }
  }

  return { niche: topNiche, confidence: baseConf };
}

const PAKISTAN_CITIES: Record<string, string[]> = {
  Lahore: ["lahore", "lhr", "lahori"],
  Karachi: ["karachi", "khi", "karachite"],
  Islamabad: ["islamabad", "isb", "islamabadi"],
  Rawalpindi: ["rawalpindi", "pindi", "rwp"],
  Peshawar: ["peshawar", "pesh", "peshawari"],
  Multan: ["multan", "multani"],
  Faisalabad: ["faisalabad", "lyallpur", "fsd"],
  Quetta: ["quetta"],
  Hyderabad: ["hyderabad", "hyd"],
  Sialkot: ["sialkot"],
  Gujranwala: ["gujranwala"],
};

function extractCity(text: string, query: string): string | null {
  const combined = `${text} ${query}`.toLowerCase();
  for (const [canonical, keywords] of Object.entries(PAKISTAN_CITIES)) {
    for (const kw of keywords) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(combined)) return canonical;
    }
  }
  return null;
}

function extractFollowers(text: string): number | null {
  const patterns = [
    // ── Urdu/Arabic numerals and labels ─────────────────────────────────────
    // Handles: "۱.۲ ملین فالوورز", "١٢ ألف متابع" (Arabic), "28 ہزار فالورز" (Urdu)
    /([۰-۹0-9][۰-۹0-9,.]*)[\s]*(ملین|ملیون|میلیون)\b/i,    // Urdu/Persian million
    /([۰-۹0-9][۰-۹0-9,.]*)[\s]*(ہزار|ہزار)\b/i,             // Urdu thousand
    /([٠-٩0-9][٠-٩0-9,.]*)[\s]*(مليون|ألف)\b/i,             // Arabic
    // Hindi
    /([0-9][0-9,.]*)[\s]*(लाख|करोड़|हज़ार)\b/i,
    // ... existing patterns below ...
    /[·•]\s*(\d[\d,.]*)\s*([kKmMbB](?:illion)?)?\s*(followers?|subs(?:cribers?)?)/i,
    /(\d[\d,.]*)\s*([kKmMbB](?:illion)?)?\s*(followers?|subs(?:cribers?)?)/i,
    /(followers?|subs(?:cribers?)?)\s*:?\s*(\d[\d,.]*)\s*([kKmMbB](?:illion)?)?/i,
  ];
  for (const patt of patterns) {
    const m = text.match(patt);
    if (!m) continue;
    const isReversed = patt === patterns[2];
    let numStr: string, suffix: string;
    if (isReversed) { numStr = m[2]; suffix = m[3] || ""; }
    else { numStr = m[1]; suffix = m[2] || ""; }
    if (!numStr) continue;
    let num = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(num)) continue;
    const s = suffix.toLowerCase();
    const mult: Record<string, number> = {
      // English
      k: 1000, m: 1_000_000, b: 1_000_000_000,
      // Urdu/Persian
      'ہزار': 1000, 'ملین': 1_000_000, 'ملیون': 1_000_000, 'میلیون': 1_000_000,
      // Arabic  
      'ألف': 1000, 'مليون': 1_000_000,
      // Hindi
      'हज़ार': 1000, 'लाख': 100_000, 'करोड़': 10_000_000,
    };
    if (mult[s]) num *= mult[s];
    return Math.round(num);
  }
  return null;
}

function extractUsername(url: string, platform: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (platform === "youtube") {
      if (parts[0]?.startsWith("@")) return parts[0];
      if (["c", "channel", "user"].includes(parts[0])) return parts[1] || null;
      if (["watch", "playlist", "results", "feed", "shorts"].includes(parts[0])) return null;
      return parts[0] || null;
    }
    const name = parts[0];
    if (!name || ["p", "reel", "explore", "stories", "video", "tag", "search", "discover"].includes(name)) return null;
    return name.startsWith("@") ? name : `@${name}`;
  } catch {
    return null;
  }
}

// Benchmark-based engagement estimate — uses real industry data per platform/follower bucket
// Replaces hash function (which produced fake deterministic values unrelated to reality)
// Returns median ER for the platform+follower tier.
// Source: engagement_benchmarks table seeded in Phase 6 migration.
function getBenchmarkEngagement(platform: string, followerCount: number | null): { rate: number; bucket: string } {
  const defaultRates: Record<string, number> = { instagram: 2.1, tiktok: 4.4, youtube: 2.2 };
  if (!followerCount || followerCount <= 0) {
    return { rate: defaultRates[platform] ?? 2.0, bucket: 'unknown' };
  }
  // Bucket thresholds matching engagement_benchmarks seed data
  let bucket: string;
  let rate: number;
  if (platform === 'instagram') {
    if (followerCount < 10_000) { bucket = 'nano'; rate = 4.20; }
    else if (followerCount < 50_000) { bucket = 'micro'; rate = 2.80; }
    else if (followerCount < 100_000) { bucket = 'mid'; rate = 2.10; }
    else if (followerCount < 500_000) { bucket = 'macro'; rate = 1.60; }
    else { bucket = 'mega'; rate = 1.10; }
  } else if (platform === 'tiktok') {
    if (followerCount < 10_000) { bucket = 'nano'; rate = 7.80; }
    else if (followerCount < 50_000) { bucket = 'micro'; rate = 5.90; }
    else if (followerCount < 100_000) { bucket = 'mid'; rate = 4.40; }
    else if (followerCount < 500_000) { bucket = 'macro'; rate = 3.20; }
    else { bucket = 'mega'; rate = 2.10; }
  } else { // youtube
    if (followerCount < 10_000) { bucket = 'nano'; rate = 3.50; }
    else if (followerCount < 50_000) { bucket = 'micro'; rate = 2.80; }
    else if (followerCount < 100_000) { bucket = 'mid'; rate = 2.20; }
    else if (followerCount < 500_000) { bucket = 'macro'; rate = 1.70; }
    else { bucket = 'mega'; rate = 1.20; }
  }
  return { rate, bucket };
}

let redis: Redis | null = null;
if (Deno.env.get("UPSTASH_REDIS_REST_URL") && Deno.env.get("UPSTASH_REDIS_REST_TOKEN")) {
  redis = new Redis({
    url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
    token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const requestBody = await req.json();
    const rawQuery = requestBody?.query ?? "";
    const rawPlatform = requestBody?.platform ?? "";

    const sanitized = rawQuery.trim().replace(/[^a-zA-Z0-9\s\u0600-\u06FF\-\.]/g, "").trim();
    // Hard caps: minimum 2 chars, maximum 200 chars to prevent quota burn
    if (!sanitized || sanitized.length < 2 || sanitized.length > 200 || !rawPlatform) {
      return new Response(JSON.stringify({ error: "query and platform are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Validate platform against strict allowlist — prevents injected values in DB queries
    const ALLOWED_PLATFORMS = ["instagram", "tiktok", "youtube"];
    const platform = rawPlatform.toLowerCase().trim();
    if (!ALLOWED_PLATFORMS.includes(platform)) {
      return new Response(JSON.stringify({ error: "Invalid platform. Must be instagram, tiktok, or youtube." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const query = sanitized;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { allowed } = await checkRateLimit(ip, "search");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: workspaceId, error: wsError } = await supabase.rpc("get_user_workspace_id");
    if (wsError || !workspaceId) {
      return new Response(JSON.stringify({ error: "No workspace found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
    }

    const { platform: _platformIgnored, location: rawLocation, followerRange } = requestBody;
    // Sanitize location — strip anything that isn't letters/spaces/hyphens
    const location = typeof rawLocation === "string"
      ? rawLocation.replace(/[^a-zA-Z\s\-]/g, "").trim().slice(0, 50)
      : "";

    const cacheKey = `search:${query.toLowerCase().trim()}:${platform}:${location || "any"}:${followerRange || "any"}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const t1 = performance.now();
          await supabase.from("admin_audit_log").insert({
            action: "search", user_id: userData.user.id,
            details: { query, platform, location, latency_ms: Math.round(t1 - t0), cached: true }
          }).catch(() => {});
          return new Response(JSON.stringify({ results: cached, cached: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (e) { console.warn("Redis Fetch Error", e); }
    }

    // Deduct credit BEFORE Serper call — prevents free searches if downstream crashes
    try {
      await serviceClient.rpc("consume_search_credit", { ws_id: workspaceId });
    } catch (error: any) {
      if (error.code === "P0001") {
        return new Response(JSON.stringify({ error: "Insufficient credits" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw error;
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
    const serperQuery = hasForeignLocation
      ? `${query} ${platform} influencer`.trim()
      : [query, platform, "influencer", "Pakistani", cityForQuery, "Pakistan"]
          .filter(Boolean).join(" ").trim();

    console.log("Serper query:", serperQuery);

    let serperData: any = { organic: [], knowledgeGraph: null };
    let profileImageMap: Map<string, string> = new Map();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const [serperRes, imageRes] = await Promise.all([
        fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ q: serperQuery, num: 100, gl: "pk", hl: "en" }),
          signal: controller.signal,
        }),
        fetch("https://google.serper.dev/images", {
          method: "POST",
          headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ q: `${query} ${platform} Pakistan influencer profile picture`, num: 20, gl: "pk" }),
          signal: controller.signal,
        }),
      ]);
      clearTimeout(timeout);

      if (!serperRes.ok) {
        const errText = await serperRes.text();
        console.error("Serper API error:", serperRes.status, errText);
        // Return empty results instead of propagating 5xx — credit already consumed
        return new Response(JSON.stringify({ results: [], credits_remaining: (workspace?.search_credits_remaining || 1) - 1 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      serperData = await serperRes.json();
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

    const domainMap: Record<string, string> = {
      instagram: "instagram.com",
      tiktok: "tiktok.com",
      youtube: "youtube.com",
    };
    const expectedDomain = domainMap[platform];

    const TIKTOK_GARBAGE = [
      "tiktok.com/discover", "tiktok.com/tag/", "tiktok.com/music/",
      "tiktok.com/search", "tiktok.com/foryou", "tiktok.com/trending",
      "tiktok.com/explore", "vm.tiktok.com",
    ];

    const platformFiltered = expectedDomain
      ? organic.filter((item: any) => {
        if (!item.link?.includes(expectedDomain)) return false;
        if (platform === "tiktok") {
          const lower = item.link.toLowerCase();
          if (TIKTOK_GARBAGE.some(p => lower.includes(p))) return false;
          try {
            const firstPart = new URL(item.link).pathname.split("/").filter(Boolean)[0] || "";
            if (!firstPart.startsWith("@")) return false;
          } catch { return false; }
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
    // Indian city/country signals — used to exclude non-Pakistani creators
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
    // tier3 (no Pakistan signal) intentionally dropped — only show verified Pakistani creators

    for (const item of platformFiltered) {
      const text = ((item.title || "") + " " + (item.snippet || "")).toLowerCase();
      const hasPakistanSignal = PAKISTAN_KEYWORDS.some(kw => text.includes(kw));
      // Skip results that explicitly signal India
      const hasIndiaSignal = INDIA_SIGNALS.some(kw => text.includes(kw));
      if (hasIndiaSignal) continue; // hard reject — even Pakistani mentions won't save an Indian profile
      // Require a positive Pakistan signal for ALL results — city match alone isn't sufficient
      if (!hasPakistanSignal) continue;
      if (selectedCity && text.includes(selectedCity)) tier1.push(item);
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

    const finalResults = [
      ...sortByQuality(qualityFilter(tier1)),
      ...sortByQuality(qualityFilter(tier2)),
    ].slice(0, 50);  // tier3 dropped; keep more tier1+tier2 results

    const rawResults = await Promise.all(
      finalResults.map(async (item: any) => {
        let username = extractUsername(item.link, platform);
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
          engagement_rate: null, // will be filled in the merge step below
          _follower_count_raw: extractFollowers(snippetText), // needed for benchmark lookup
          _quality_score: qualityScore(item),  // internal — used for transparency
        };
      })
    );

    const results = rawResults.filter(Boolean);
    const seen = new Set();
    const uniqueResults = results.filter((r: any) => {
      const key = `${r.platform}:${r.username}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Early exit when no results — avoids .in('username', []) Postgres crash
    if (uniqueResults.length === 0) {
      await serviceClient.from("search_history").insert({
        workspace_id: workspaceId, query, platform,
        location: location || null, result_count: 0, filters: {},
      }).catch(() => {});
      return new Response(
        JSON.stringify({ results: [], credits_remaining: (workspace?.search_credits_remaining || 1) - 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rangeMap: Record<string, [number, number]> = {
      "1k-10k": [1_000, 10_000], "10k-50k": [10_000, 50_000],
      "50k-100k": [50_000, 100_000], "100k-500k": [100_000, 500_000],
      "100k+": [100_000, Infinity], "500k+": [500_000, Infinity],
    };
    let filteredResults = uniqueResults;
    if (followerRange && followerRange !== "any" && rangeMap[followerRange]) {
      const [min, max] = rangeMap[followerRange];
      filteredResults = uniqueResults.filter((r: any) =>
        r.extracted_followers != null && r.extracted_followers >= min && r.extracted_followers <= max
      );
    }

    // Merge real profile data (avatar, bio, follower count, engagement) for enriched creators
    const usernames = uniqueResults.map((r: any) => r.username.replace("@", ""));

    const [{ data: enrichedProfiles }, { data: cachedEvals }] = await Promise.all([
      serviceClient
        .from("influencer_profiles")
        .select("platform, username, avatar_url, bio, follower_count, engagement_rate, enrichment_status, full_name, city, last_enriched_at, enrichment_ttl_days")
        .eq("platform", platform)
        .eq("enrichment_status", "success")
        .in("username", usernames),
      serviceClient
        .from("influencer_evaluations")
        .select("platform, username, evaluation")
        .eq("platform", platform)
        .in("username", usernames),
    ]);

    const profileMap = new Map();
    for (const p of (enrichedProfiles || [])) {
      profileMap.set(`${p.platform}:@${p.username}`, p);
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

      return {
        ...r,
        imageUrl: profile?.avatar_url ?? r.imageUrl,
        bio: profile?.bio ?? null,
        extracted_followers: profile?.follower_count ?? r._follower_count_raw,
        ...engagementMeta,
        city_extracted: profile?.city ?? r.city_extracted,
        full_name: profile?.full_name ?? null,
        is_enriched: !!profile,
        enrichment_status: profile?.enrichment_status ?? null,
        last_enriched_at: profile?.last_enriched_at ?? null,
        is_stale: profile?.last_enriched_at
          ? (Date.now() - new Date(profile.last_enriched_at).getTime()) > (profile.enrichment_ttl_days ?? 30) * 86400000
          : false,
      };
    });

    // Sort: real high-engagement accounts first, then benchmark; filter suspected bots
    const sortedResults = enrichedResults
      .filter((r: any) => {
        // Exclude accounts with verified real data showing bot-like engagement (< 0.3%)
        if (r.is_enriched && r.engagement_source !== "benchmark_estimate" &&
            (r.engagement_rate ?? 100) < 0.3) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        // Real verified data before benchmarks
        const aIsReal = a.engagement_source !== "benchmark_estimate";
        const bIsReal = b.engagement_source !== "benchmark_estimate";
        if (aIsReal !== bIsReal) return aIsReal ? -1 : 1;
        // Within the same data-quality group, sort by engagement rate descending
        return (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0);
      });

    // Batch upsert instead of N sequential awaits (was O(n) round-trips)
    if (uniqueResults.length > 0) {
      const cacheRows = uniqueResults.map((r: any) => ({
        platform: r.platform, username: r.username,
        city_extracted: r.city_extracted ?? null,
        data: {
          title: r.title, link: r.link, snippet: r.snippet,
          displayUrl: r.displayUrl, imageUrl: r.imageUrl,
          niche: r.niche, niche_confidence: r.niche_confidence,
          city_extracted: r.city_extracted, followers: r.extracted_followers ?? null,
          engagement_rate: r.engagement_rate,
        },
      }));
      await serviceClient.from("influencers_cache")
        .upsert(cacheRows, { onConflict: "platform,username" })
        .catch((e: any) => console.warn("Cache upsert failed:", e?.message));
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
      action: "search", user_id: userData.user.id,
      details: { query, platform, location, latency_ms: Math.round(t1 - t0), result_count: enrichedResults.length, cached: false }
    });

    return new Response(
      JSON.stringify({ results: sortedResults, credits_remaining: (workspace?.search_credits_remaining || 1) - 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
