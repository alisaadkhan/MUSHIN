/**
 * _shared/query_expander.ts
 *
 * Query expansion engine for Mushin creator discovery.
 *
 * Generates multiple Serper query variants from a single user query to broaden
 * coverage without relying on a pre-built creator index.
 *
 * Strategy
 * ─────────
 *   primary       — "[query] [platform] influencer Pakistani [city] Pakistan"
 *   site_operator — "site:[domain] \"[niche_keyword]\" Pakistan [city]"
 *   synonym       — "[query] [platform] creator vlogger blogger [city] Pakistan"
 *   urdu          — "[roman_urdu_term] [platform] Pakistan [city]"
 *
 * Only the primary + one best-fit expansion are run per search request to
 * control Serper quota costs.  Results are merged and deduplicated before
 * ranking.
 */

export type QueryVariantStrategy =
  | "primary"
  | "site_operator"
  | "synonym"
  | "urdu_expansion"
  | "niche_expansion";

export interface QueryVariant {
  query: string;
  strategy: QueryVariantStrategy;
  /** Relative weight when merging scores from this variant [0, 1]. */
  weight: number;
}

// ---------------------------------------------------------------------------
// Platform domains
// ---------------------------------------------------------------------------

const PLATFORM_DOMAINS: Record<string, string> = {
  youtube:   "youtube.com",
  instagram: "instagram.com",
  tiktok:    "tiktok.com",
  twitch:    "twitch.tv",
};

// ---------------------------------------------------------------------------
// Creator synonyms
// ---------------------------------------------------------------------------

const CREATOR_SYNONYMS: Record<string, string[]> = {
  youtube:   ["creator", "vlogger", "youtuber", "channel"],
  instagram: ["creator", "blogger", "influencer", "content creator"],
  tiktok:    ["creator", "tiktoker", "content creator"],
  twitch:    ["streamer", "broadcaster", "gamer", "stream"],
};

// ---------------------------------------------------------------------------
// Niche → site-operator keyword mapping
// Maps a detected niche to a quoted search phrase that works well with
// site: operators on Google (via Serper).
// ---------------------------------------------------------------------------

const NICHE_SITE_KEYWORDS: Record<string, string[]> = {
  Food:        ['"food blogger"', '"food vlog"', '"recipe"', '"street food"'],
  Fashion:     ['"fashion blogger"', '"outfit"', '"ootd"', '"style"'],
  Beauty:      ['"beauty"', '"makeup tutorial"', '"skincare"'],
  Tech:        ['"tech review"', '"unboxing"', '"gadget"'],
  Gaming:      ['"gaming"', '"gameplay"', '"pubg"', '"free fire"'],
  Fitness:     ['"fitness"', '"workout"', '"gym"'],
  Travel:      ['"travel vlog"', '"explore"', '"travel blogger"'],
  Education:   ['"tutorial"', '"learn"', '"course"'],
  Lifestyle:   ['"vlog"', '"lifestyle"', '"daily vlog"'],
  Music:       ['"singer"', '"music"', '"ost"'],
  Comedy:      ['"funny"', '"comedy"', '"prank"'],
  Cricket:     ['"cricket"', '"psl"'],
  Finance:     ['"finance"', '"investment"', '"stocks"'],
  Health:      ['"health"', '"wellness"', '"nutrition"'],
  Photography: ['"photography"', '"photographer"'],
  Art:         ['"art"', '"artist"', '"drawing"'],
  Sports:      ['"sports"', '"athlete"'],
  News:        ['"news"', '"journalist"', '"reporter"'],
  Automotive:  ['"cars"', '"automobile"', '"auto review"'],
  General:     ['"influencer"', '"content creator"'],
};

// ---------------------------------------------------------------------------
// Roman-Urdu / Urdu query terms per niche
// ---------------------------------------------------------------------------

const NICHE_URDU_TERMS: Record<string, string[]> = {
  Food:      ["khana", "recipe Pakistani", "khaana banane"],
  Fashion:   ["fashion Pakistani", "style Pakistan", "ootd Pakistan"],
  Beauty:    ["beauty Pakistan", "makeup Pakistan"],
  Tech:      ["technology Pakistan", "tech review Pakistan"],
  Gaming:    ["gaming Pakistan", "pubg Pakistan"],
  Fitness:   ["fitness Pakistan", "gym Pakistan"],
  Travel:    ["travel Pakistan", "safar Pakistan"],
  Education: ["education Pakistan", "tutorial Pakistan"],
  Lifestyle: ["lifestyle Pakistan", "Pakistani vlogger"],
  Music:     ["music Pakistan", "Pakistani singer"],
  Comedy:    ["comedy Pakistan", "funny Pakistani"],
  Cricket:   ["cricket Pakistan", "psl Pakistan"],
};

// ---------------------------------------------------------------------------
// Niche-specific content type terms for targeted query expansion
// These generate human-readable search queries for each niche, much like
// a user would naturally search (e.g. "tech youtuber pakistan").
// ---------------------------------------------------------------------------
const NICHE_CONTENT_TERMS: Record<string, string[]> = {
  Tech:        ["tech youtuber", "technology reviewer", "tech content creator", "ai tech creator", "gadget reviewer"],
  Gaming:      ["gaming streamer", "gaming youtuber", "gameplay creator", "pubg streamer", "gaming content creator"],
  Food:        ["food blogger", "food vlogger", "recipe creator", "chef influencer", "street food vlogger"],
  Beauty:      ["beauty creator", "makeup artist", "skincare influencer", "beauty vlogger"],
  Fashion:     ["fashion creator", "style blogger", "outfit influencer", "fashion vlogger"],
  Fitness:     ["fitness creator", "workout influencer", "gym vlogger", "fitness youtuber"],
  Travel:      ["travel vlogger", "travel content creator", "travel blogger", "explorer youtuber"],
  Education:   ["education creator", "tutorial maker", "learning channel", "educational youtuber"],
  Music:       ["music creator", "singer influencer", "musician vlogger", "music content creator"],
  Comedy:      ["comedy creator", "funny vlogger", "comedy channel", "entertainment creator"],
  Cricket:     ["cricket creator", "cricket vlogger", "cricket analyst", "cricket content creator"],
  Finance:     ["finance creator", "investment influencer", "finance youtuber", "money vlogger"],
  Lifestyle:   ["lifestyle vlogger", "daily vlogger", "life content creator", "lifestyle influencer"],
  Health:      ["health creator", "wellness influencer", "nutrition vlogger"],
  Photography: ["photography creator", "photographer vlogger", "photo content creator"],
  Sports:      ["sports vlogger", "athlete content creator", "sports creator"],
  General:     ["content creator", "youtube influencer", "social media creator"],
};


/**
 * Extract the first contact email address found in a text string.
 * Validates format; rejects common placeholder emails.
 */
export function extractContactEmail(text: string): string | null {
  if (!text) return null;
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const BLOCKLIST = new Set([
    "example@example.com", "test@test.com", "email@email.com",
    // Prefix-based matches (checked via lower.split("@")[0] + "@")
    "noreply@", "no-reply@", "support@", "info@",
    "hello@", "admin@", "contact@", "legal@",
    "privacy@", "abuse@", "postmaster@", "webmaster@",
    "feedback@", "help@", "press@", "media@",
  ]);
  const matches = text.match(EMAIL_RE);
  if (!matches) return null;
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (BLOCKLIST.has(lower)) continue;
    if (BLOCKLIST.has(lower.split("@")[0] + "@")) continue;
    // Skip suspiciously short or fake-looking domains
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".gif")) continue;
    return m;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core expansion function
// ---------------------------------------------------------------------------

/**
 * Generate an ordered list of Serper query variants for a creator search.
 *
 * @param query         Raw (already sanitised) user query.
 * @param platform      Validated platform string ("youtube" | "instagram" | "tiktok").
 * @param city          Optional city name (canonical, e.g. "Lahore"). Pass "" for none.
 * @param detectedNiche Optional niche detected from the query (e.g. "Tech").
 * @returns             Array of QueryVariant in priority order.
 *                      The caller should run primary + best expansion variant.
 */
export function expandSerperQueries(
  query: string,
  platform: string,
  city = "",
  detectedNiche = "General",
): QueryVariant[] {
  const domain = PLATFORM_DOMAINS[platform] ?? "";
  const cityPart = city && city !== "All Pakistan" ? city : "";
  const synonyms = CREATOR_SYNONYMS[platform] ?? ["creator"];

  const variants: QueryVariant[] = [];

  // ── Primary (existing approach) ────────────────────────────────────────────
  const primaryParts = [query, platform, "influencer", "Pakistani", cityPart, "Pakistan"]
    .filter(Boolean);
  variants.push({
    query: primaryParts.join(" ").trim(),
    strategy: "primary",
    weight: 1.0,
  });

  // ── Synonym expansion ──────────────────────────────────────────────────────
  // Replaces "influencer" with creator synonyms for broader coverage
  const synParts = [query, platform, synonyms.join(" "), cityPart, "Pakistan"]
    .filter(Boolean);
  variants.push({
    query: synParts.join(" ").trim(),
    strategy: "synonym",
    weight: 0.85,
  });

  // ── Site operator ──────────────────────────────────────────────────────────
  // Most precise — returns only the target platform's own profile pages
  if (domain) {
    const nicheKws = NICHE_SITE_KEYWORDS[detectedNiche] ?? NICHE_SITE_KEYWORDS["General"];
    const keyword = nicheKws[0] ?? '"influencer"';
    const siteParts = [`site:${domain}`, keyword, cityPart, "Pakistan"]
      .filter(Boolean);
    variants.push({
      query: siteParts.join(" ").trim(),
      strategy: "site_operator",
      weight: 0.90,
    });
  }

  // ── Urdu / Roman-Urdu expansion ────────────────────────────────────────────
  const urduTerms = NICHE_URDU_TERMS[detectedNiche];
  if (urduTerms) {
    const urduParts = [urduTerms[0], platform, cityPart].filter(Boolean);
    variants.push({
      query: urduParts.join(" ").trim(),
      strategy: "urdu_expansion",
      weight: 0.75,
    });
  }

  // ── Niche-specific content-type expansion ───────────────────────────────────────────
  // Generates human-readable queries like "tech youtuber pakistan" or
  // "food blogger lahore pakistan" instead of generic platform+synonyms.
  const nicheTerms = NICHE_CONTENT_TERMS[detectedNiche] ?? NICHE_CONTENT_TERMS["General"];
  for (const term of nicheTerms.slice(0, 2)) {
    variants.push({
      query: [term, cityPart, "Pakistan"].filter(Boolean).join(" "),
      strategy: "niche_expansion",
      weight: 0.80,
    });
  }

  return variants;
}

// ---------------------------------------------------------------------------
// Social cross-link detection
// ---------------------------------------------------------------------------

/** Patterns that extract a platform handle or channel ID from a URL or @mention. */
const SOCIAL_PATTERNS: { platform: string; re: RegExp }[] = [
  { platform: "instagram", re: /(?:instagram\.com\/|instagram:\s*@?)([A-Za-z0-9._]{1,30})/i },
  { platform: "youtube",   re: /(?:youtube\.com\/(?:@|c\/|channel\/|user\/))([A-Za-z0-9_\-]{1,64})/i },
  { platform: "tiktok",    re: /(?:tiktok\.com\/@?)([A-Za-z0-9._]{1,30})/i },
  { platform: "twitter",   re: /(?:twitter\.com\/|x\.com\/|twitter:\s*@?)([A-Za-z0-9_]{1,15})/i },
  { platform: "facebook",  re: /(?:facebook\.com\/|fb\.com\/)([A-Za-z0-9.\-]{1,50})/i },
];

/** Generic @mention pattern — only used when no URL match is found. */
const MENTION_RE = /@([A-Za-z0-9._]{2,30})/g;

/**
 * Detect cross-platform social profile links mentioned in a text snippet.
 *
 * Returns an array of canonical profile URLs for platforms other than
 * `currentPlatform`.  Only includes results where we can extract a handle/ID
 * (avoids returning generic homepage links).
 *
 * Example:
 *   detectSocialLinks("Follow me on instagram.com/sara_pk", "youtube")
 *   → ["https://instagram.com/sara_pk"]
 */
export function detectSocialLinks(text: string, currentPlatform: string): string[] {
  if (!text) return [];
  const lower = currentPlatform.toLowerCase();
  const links: string[] = [];
  const seen = new Set<string>();

  for (const { platform, re } of SOCIAL_PATTERNS) {
    if (platform === lower) continue; // skip same-platform — already in result
    const m = text.match(re);
    if (m && m[1]) {
      const handle = m[1].replace(/^@/, "");
      // Build canonical URL
      const url = platform === "instagram" ? `https://instagram.com/${handle}`
        : platform === "youtube"   ? `https://youtube.com/@${handle}`
        : platform === "tiktok"    ? `https://tiktok.com/@${handle}`
        : platform === "twitter"   ? `https://x.com/${handle}`
        : platform === "facebook"  ? `https://facebook.com/${handle}`
        : null;
      if (url && !seen.has(url)) {
        seen.add(url);
        links.push(url);
      }
    }
  }

  return links;
}

/**
 * Pick the single best expansion variant to run alongside the primary query.
 * For most searches the site_operator variant gives the highest signal.
 * Falls back to synonym if site: operator is unavailable.
 */
export function pickBestExpansion(variants: QueryVariant[]): QueryVariant | null {
  // Prefer site_operator first, then synonym
  const preferred = ["site_operator", "synonym", "urdu_expansion"] as const;
  for (const strategy of preferred) {
    const found = variants.find(v => v.strategy === strategy);
    if (found) return found;
  }
  return null;
}
