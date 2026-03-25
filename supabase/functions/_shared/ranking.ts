/**
 * _shared/ranking.ts
 *
 * Multi-factor search ranking engine for Mushin influencer discovery.
 *
 * ── v3 formula (current, 2026-03-07) ────────────────────────────────────────
 * Final Score =
 *   (Keyword Relevance   × 0.30)  — name + tags + niche + location (unified)
 * + (Semantic Relevance  × 0.25)  — snippet word-overlap + trigram proxy
 * + (Engagement Quality  × 0.15)  — engagement vs platform benchmark
 * + (Authenticity Score  × 0.15)  — 1 − bot risk
 * + (Recency Signal      × 0.10)  — freshness of enrichment data
 * + (Intent Match        × 0.05)  — alignment with detected search intent
 *
 * Keyword Relevance (sub-formula, v3):
 *   nameSim × 0.55 + tagStrength × 0.20 + nicheMatch × 0.15 + locMatch × 0.10
 *
 * Intent categories: name_search | niche_discovery | location_search | brand_campaign
 *
 * ── v2 formula (deprecated 2026-03-07) ──────────────────────────────────────
 * keywordRel×0.35 + tagStrength×0.20 + semanticSim×0.20
 *   + engQuality×0.15 + auth×0.10
 *
 * ── v1 formula (deprecated 2026-04-06) ─────────────────────────────────────
 * nameSim×0.35 + engQuality×0.25 + authenticity×0.15
 *   + growthStability×0.10 + nicheMatch×0.10 + locationMatch×0.05
 *   − botRisk×0.40
 *
 * Consumers: search-influencers
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Search intent categories detected from the raw query string. */
export type SearchIntent =
  | "name_search"      // creator name lookup
  | "niche_discovery"  // category / niche browsing
  | "location_search"  // geo-focused discovery
  | "brand_campaign";  // brand collaboration / sponsorship search

export interface SearchIntentResult {
  intent: SearchIntent;
  /** Detection confidence [0, 1]. */
  confidence: number;
}

export interface RankingInput {
  /** Raw search query string (may include Urdu / Roman-Urdu). */
  query: string;
  /** Creator's display name (from oEmbed or Serper title). */
  displayName: string;
  /** Creator handle (with or without leading @). */
  username: string;
  /** Engagement rate percentage (e.g. 3.5 = 3.5%). Null when unknown. */
  engagementRate: number | null;
  /** Follower count. Null for unknown. */
  followerCount: number | null;
  /** True when engagement comes from real enrichment, false for benchmark estimates. */
  isRealEngagement: boolean;
  /** Platform identifier. */
  platform: string;
  /** Creator's detected niche (e.g. "Fashion", "Tech"). */
  niche: string | null;
  /** Niche inferred from the search query. Null when query has no clear niche. */
  queryNiche: string | null;
  /** Creator's detected city (canonical, e.g. "Lahore"). */
  city: string | null;
  /** City extracted from the query or location filter. Null when not specified. */
  queryCity: string | null;
  /**
   * Creator's normalised tags (from influencers_cache.tags).
   * Pass [] when tags are unavailable — tag layer contributes 0.
   */
  tags?: string[];
  /**
   * Pre-computed semantic (embedding cosine) similarity in [0, 1].
   * Typically sourced from creator_lookalikes or a query-embedding ANN call.
   * Pass null when not available — semantic layer falls back to 0.
   */
  semanticSimilarity?: number | null;
  /**
   * Pre-computed authenticity score [0, 1] stored in influencers_cache.
   * When provided it overrides the rule-based fallback.  Pass null to use
   * the rule-based `computeBotRisk()` calculation.
   */
  precomputedAuthenticityScore?: number | null;
  /**
   * Pre-computed engagement quality score [0, 1] stored in influencers_cache.
   * When provided it overrides the live benchmark calculation.  Pass null to
   * use the live `engagementQualityScore()` calculation.
   */
  precomputedEngagementQuality?: number | null;
  /**
   * Pre-detected search intent used to compute the intent_match_score layer.
   * Detect with `detectSearchIntent(query)`.  Pass null for a 0.5 neutral score.
   */
  intent?: SearchIntentResult | null;

  // ── Reserved for future ranking signals ─────────────────────────────────
  /**
   * Platform match score [0, 1] for future multi-platform search.
   * When a user selects a specific platform, results on that platform receive
   * a bonus.  Reserved — pass null for current single-platform searches.
   */
  platformMatchScore?: number | null;
  /**
   * Recency signal [0, 1] derived from last_enriched_at or recent posting
   * activity.  Higher = more recently active creator.
   * Reserved for activity-based ranking. Pass null when not available.
   */
  recencySignal?: number | null;
}

// ---------------------------------------------------------------------------
// Urdu / Roman-Urdu query expansion
// ---------------------------------------------------------------------------

/**
 * Roman-Urdu ↔ Urdu ↔ English equivalence table for Pakistani creator niches.
 * Used to expand search queries so FTS and snippet matching cover all variants.
 */
const QUERY_ALIASES: Record<string, string[]> = {
  fashion:   ["فیشن", "فیشون", "style", "ootd", "clothing"],
  tech:      ["ٹیک", "ٹیکنالوجی", "technology", "gadget", "review", "unboxing"],
  beauty:    ["بیوٹی", "خوبصورتی", "makeup", "skincare", "glam"],
  food:      ["کھانا", "کھانے", "کھانا پکانا", "foodie", "recipe", "cooking"],
  fitness:   ["فٹنس", "صحت", "gym", "workout", "exercise", "health"],
  travel:    ["سفر", "ٹریول", "trip", "explore", "tourism", "adventure"],
  gaming:    ["گیمنگ", "گیمر", "pubg", "free fire", "esports", "valorant"],
  education: ["تعلیم", "ایجوکیشن", "tutorial", "learn", "course"],
  lifestyle: ["لائف اسٹائل", "زندگی", "vlog", "daily life"],
  music:     ["موسیقی", "گانا", "گانے", "میوزک", "singer", "rap"],
  comedy:    ["مزاح", "مزاحیہ", "funny", "humor", "prank", "skit"],
  cricket:   ["کرکٹ", "psl", "pcb"],
};

/**
 * Expand a search query to include Roman-Urdu and Urdu equivalents.
 * Returns the original query with any discovered aliases appended.
 * The expanded string is only used for downstream text matching — it is not
 * shown to the user and is not stored.
 */
export function expandQueryTerms(query: string): string {
  const lower = query.toLowerCase();
  const extras = new Set<string>();
  for (const [primary, aliases] of Object.entries(QUERY_ALIASES)) {
    const allTerms = [primary, ...aliases];
    if (allTerms.some((t) => lower.includes(t.toLowerCase()))) {
      for (const alias of allTerms) {
        if (!lower.includes(alias.toLowerCase())) extras.add(alias);
      }
    }
  }
  return extras.size > 0 ? `${query} ${[...extras].join(" ")}` : query;
}

// ---------------------------------------------------------------------------
// Trigram similarity (mirrors pg_trgm algorithm)
// ---------------------------------------------------------------------------

function buildTrigrams(str: string): Set<string> {
  const padded = ` ${str.toLowerCase().trim()} `;
  const set: Set<string> = new Set();
  for (let i = 0; i < padded.length - 2; i++) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

/**
 * Dice-coefficient trigram similarity [0, 1].
 * Equivalent to PostgreSQL's pg_trgm `similarity()` function.
 */
export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = buildTrigrams(a);
  const tb = buildTrigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const total = ta.size + tb.size;
  return total === 0 ? 0 : (2 * shared) / total;
}

// ---------------------------------------------------------------------------
// Scoring dimensions
// ---------------------------------------------------------------------------

/**
 * Best-of trigram similarity between the search query and the creator's
 * display name / handle.  Range: [0, 1].
 *
 * Improvement: adds an exact-token bonus when any query word (≥3 chars)
 * appears verbatim in the display name or handle, compensating for cases
 * where trigram similarity alone under-scores partial-name queries.
 */
function nameSimScore(query: string, displayName: string, username: string): number {
  const q  = query.toLowerCase();
  const dn = displayName.toLowerCase();
  const un = username.replace(/^@/, "").toLowerCase();

  const trigramBest = Math.max(trigramSimilarity(q, dn), trigramSimilarity(q, un));

  // Exact token hit: any query word (≥3 chars) found verbatim in name / handle
  const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
  const hasExactToken =
    tokens.length > 0 && tokens.some((t) => dn.includes(t) || un.includes(t));

  return Math.min(1, trigramBest + (hasExactToken ? 0.20 : 0));
}

/**
 * Engagement quality score [0, 1].
 *
 * Scores against platform-specific benchmarks.
 * Estimated (benchmark) engagement is discounted 25 % because it is
 * less reliable evidence of real audience activity.
 */
function engagementQualityScore(
  platform: string,
  rate: number | null,
  _followers: number | null,
  isReal: boolean,
): number {
  if (rate == null) return 0.30; // neutral for unknown

  // Thresholds: [excellent, good, poor] engagement rates
  const thresholds: Record<string, [number, number, number]> = {
    instagram: [5.0, 2.5, 0.5],
    tiktok:    [8.0, 5.0, 1.2],
    youtube:   [4.0, 2.5, 0.5],
  };
  const [exc, good, poor] = thresholds[platform] ?? [5.0, 2.5, 0.5];

  let base: number;
  if (rate >= exc)  base = 1.00;
  else if (rate >= good) base = 0.65 + 0.35 * ((rate - good) / (exc - good));
  else if (rate >= poor) base = 0.25 + 0.40 * ((rate - poor) / (good - poor));
  else base = 0.05;

  // Benchmark estimates carry 25 % confidence discount
  return isReal ? base : base * 0.75;
}

/**
 * Rule-based bot risk signal [0, 1].
 *
 * Signals used:
 *   - Large following with engagement below platform floor
 *   - Engagement rate below absolute minimum (0.3 %)
 *
 * Risk is only non-zero when real (not estimated) engagement data is available.
 * Without real data we cannot confirm fraud, so risk defaults to 0.
 */
export function computeBotRisk(
  rate: number | null,
  followers: number | null,
  platform: string,
  isReal: boolean,
): number {
  if (!isReal || rate == null || followers == null) return 0;

  const floors: Record<string, number> = {
    instagram: 0.50,
    tiktok:    1.20,
    youtube:   0.40,
  };
  const floor = floors[platform] ?? 0.50;

  let risk = 0;
  if (followers > 50_000  && rate < floor)         risk += 0.30;
  if (followers > 200_000 && rate < floor * 0.6)   risk += 0.25;
  if (rate < 0.30)                                  risk += 0.20;
  return Math.min(1, risk);
}

/** Audience authenticity score [0, 1] = 1 − bot risk. */
function audienceAuthenticityScore(input: RankingInput): number {
  return 1 - computeBotRisk(
    input.engagementRate, input.followerCount,
    input.platform, input.isRealEngagement,
  );
}

/**
 * Follower growth stability score [0, 1].
 *
 * Uses data completeness and follower range as a proxy for organic growth:
 *   - Enriched + in healthy range  → 0.90 (strong signal)
 *   - Enriched outside range       → 0.50 (possible manipulation)
 *   - Estimated + in healthy range → 0.65 (reasonable)
 *   - Unknown / null               → 0.30 (no signal)
 */
function followerGrowthStabilityScore(
  followers: number | null,
  platform: string,
  isReal: boolean,
): number {
  if (followers == null) return 0.30;

  const healthy: Record<string, [number, number]> = {
    instagram: [1_000,  5_000_000],
    tiktok:    [5_000, 10_000_000],
    youtube:   [1_000,  5_000_000],
  };
  const [lo, hi] = healthy[platform] ?? [1_000, 5_000_000];
  const inRange = followers >= lo && followers <= hi;

  if (isReal && inRange)  return 0.90;
  if (isReal && !inRange) return 0.50;
  if (inRange)            return 0.65;
  return 0.35;
}

/**
 * Niche match score.
 *   1.0 — exact match between creator and query niche
 *   0.5 — unknown on either side (neutral)
 *   0.2 — mismatch
 */
function nicheMatchScore(creatorNiche: string | null, queryNiche: string | null): number {
  if (!creatorNiche || !queryNiche) return 0.50;
  return creatorNiche.toLowerCase() === queryNiche.toLowerCase() ? 1.0 : 0.20;
}

/**
 * Location match score.
 *   1.0 — creator city matches filter city
 *   0.5 — no city filter active (neutral)
 *   0.25 — city filter active but creator city unknown
 *   0.0 — mismatch
 */
function locationMatchScore(creatorCity: string | null, queryCity: string | null): number {
  if (!queryCity) return 0.50;
  if (!creatorCity) return 0.25;
  return creatorCity.toLowerCase() === queryCity.toLowerCase() ? 1.0 : 0.0;
}

// ---------------------------------------------------------------------------
// Composite score — v1 (deprecated)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `computeSearchScoreV2`. Removal target: 2026-04-06.
 *
 * Compute the multi-factor commercial relevance score for a search result.
 *
 * Formula:
 *   raw = nameSim×0.35 + engQuality×0.25 + authenticity×0.15
 *       + growthStability×0.10 + nicheMatch×0.10 + locationMatch×0.05
 *   final = clamp(raw − botRisk×0.40, 0, 1)
 *
 * Higher score = higher commercial value and search relevance.
 */
export function computeSearchScore(input: RankingInput): number {
  const nameSim       = nameSimScore(input.query, input.displayName, input.username);
  const engQuality    = engagementQualityScore(
    input.platform, input.engagementRate, input.followerCount, input.isRealEngagement,
  );
  const authenticity    = audienceAuthenticityScore(input);
  const growthStability = followerGrowthStabilityScore(
    input.followerCount, input.platform, input.isRealEngagement,
  );
  const nicheMatch    = nicheMatchScore(input.niche, input.queryNiche);
  const locationMatch = locationMatchScore(input.city, input.queryCity);

  const raw =
    nameSim       * 0.35 +
    engQuality    * 0.25 +
    authenticity  * 0.15 +
    growthStability * 0.10 +
    nicheMatch    * 0.10 +
    locationMatch * 0.05;

  const botPenalty = computeBotRisk(
    input.engagementRate, input.followerCount,
    input.platform, input.isRealEngagement,
  ) * 0.40;

  return Math.max(0, Math.min(1, raw - botPenalty));
}

// ---------------------------------------------------------------------------
// Composite score — v2 (current)
// ---------------------------------------------------------------------------

/**
 * Compute the keyword relevance sub-score [0, 1].
 *
 * v3: absorbs tag match strength as a sub-component (previously a separate
 * top-level 0.20-weight layer in v2).
 *
 *   keywordRel = nameSim × 0.55 + tagStrength × 0.20 + nicheMatch × 0.15 + locMatch × 0.10
 */
export function computeKeywordRelevance(input: RankingInput): number {
  const nameSim    = nameSimScore(input.query, input.displayName, input.username);
  const nicheMatch = nicheMatchScore(input.niche, input.queryNiche);
  const locMatch   = locationMatchScore(input.city, input.queryCity);

  // Tag strength (migrated from the v2 top-level layer into keyword relevance)
  const tagStrength = (() => {
    if (!input.tags || input.tags.length === 0) return 0;
    const queryTerms = input.query
      .toLowerCase()
      .split(/[\s,;:!?()+]+/)
      .filter((t) => t.length >= 3);
    const tagSet = new Set(input.tags);
    const exactHits  = queryTerms.filter((t) => tagSet.has(t)).length;
    const partialHits = queryTerms.filter(
      (t) => !tagSet.has(t) && input.tags!.some((tag) => tag.includes(t) || t.includes(tag)),
    ).length;
    const exactScore   = queryTerms.length > 0 ? exactHits  / queryTerms.length : 0;
    const partialScore = queryTerms.length > 0 ? partialHits / queryTerms.length : 0;
    return Math.min(1, exactScore * 0.40 + partialScore * 0.20);
  })();

  return nameSim * 0.55 + tagStrength * 0.20 + nicheMatch * 0.15 + locMatch * 0.10;
}

/**
 * Compute the composite search score (v3 formula).
 *
 * Formula (v3, 2026-03-07):
 *   score = keywordRel    × 0.30   (name + tags + niche + location)
 *         + semanticSim   × 0.25   (snippet word-overlap + trigram proxy)
 *         + engQuality    × 0.15   (engagement vs platform benchmark)
 *         + authenticity  × 0.15   (1 − bot risk)
 *         + recency       × 0.10   (freshness from last_enriched_at)
 *         + intentScore   × 0.05   (alignment with detected search intent)
 *   clamped to [0, 1]
 *
 * Null-safe fallbacks:
 *   - semanticSimilarity null          → 0
 *   - recencySignal null               → 0.5 (neutral)
 *   - intent null                      → 0.5 (neutral)
 *   - precomputedAuthenticityScore null → rule-based (1 − botRisk)
 *   - precomputedEngagementQuality null → live benchmark calculation
 */
export function computeSearchScoreV2(input: RankingInput): number {
  // Layer 1 — Keyword relevance (includes tag strength)
  const keywordRel = computeKeywordRelevance(input);

  // Layer 2 — Semantic similarity (snippet-based proxy)
  const semanticSim = Math.max(0, Math.min(1, input.semanticSimilarity ?? 0));

  // Layer 3 — Engagement quality
  const engQuality =
    input.precomputedEngagementQuality != null
      ? Math.max(0, Math.min(1, input.precomputedEngagementQuality))
      : engagementQualityScore(
          input.platform, input.engagementRate,
          input.followerCount, input.isRealEngagement,
        );

  // Layer 4 — Authenticity (1 − bot risk)
  const authenticity =
    input.precomputedAuthenticityScore != null
      ? Math.max(0, Math.min(1, input.precomputedAuthenticityScore))
      : audienceAuthenticityScore(input);

  // Layer 5 — Recency signal (0.5 neutral when not provided)
  const recency = Math.max(0, Math.min(1, input.recencySignal ?? 0.5));

  // Layer 6 — Intent match score (0.5 neutral when intent not provided)
  const intentScore =
    input.intent != null
      ? computeIntentMatchScore(input.intent, input)
      : 0.5;

  const score =
    keywordRel   * 0.30 +
    semanticSim  * 0.25 +
    engQuality   * 0.15 +
    authenticity * 0.15 +
    recency      * 0.10 +
    intentScore  * 0.05;

  return Math.max(0, Math.min(1, score));
}

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

const BRAND_SIGNALS_RE =
  /\b(brand|sponsor|collab|collaboration|partner|deal|campaign|ambassador|endorse)\b/i;
const LOCATION_NAMES_RE =
  /\b(karachi|lahore|islamabad|rawalpindi|faisalabad|multan|peshawar|quetta|sialkot|pakistan|pk)\b/i;
const NICHE_WORDS_SET = new Set([
  "fashion", "food", "beauty", "tech", "technology", "fitness", "travel",
  "gaming", "education", "lifestyle", "music", "comedy", "cricket",
  "finance", "health", "photography", "art", "sports", "news", "automotive",
]);

/**
 * Detect the likely search intent from a raw query string.
 *
 * Categories:
 *   name_search      — creator name lookup (@handle or proper noun)
 *   niche_discovery  — category / niche browsing
 *   location_search  — geo-focused discovery (city, no niche)
 *   brand_campaign   — brand collaboration / sponsorship keywords
 *
 * Returns a SearchIntentResult with intent type and confidence [0, 1].
 */
export function detectSearchIntent(query: string): SearchIntentResult {
  const lower = query.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => w.length >= 3);

  // Brand / campaign — explicit collaboration keywords take highest priority
  if (BRAND_SIGNALS_RE.test(lower)) {
    return { intent: "brand_campaign", confidence: 0.85 };
  }

  const nicheWords = meaningful.filter((w) => NICHE_WORDS_SET.has(w));
  const hasLocation = LOCATION_NAMES_RE.test(lower);

  // Location-focused: city present but no niche, short query
  if (hasLocation && nicheWords.length === 0 && meaningful.length <= 3) {
    return { intent: "location_search", confidence: 0.75 };
  }

  // Niche discovery: niche term(s) dominate the query
  if (nicheWords.length >= 1) {
    const nicheRatio = meaningful.length > 0 ? nicheWords.length / meaningful.length : 0;
    if (nicheRatio >= 0.35) {
      return { intent: "niche_discovery", confidence: Math.min(0.90, 0.45 + nicheRatio * 0.55) };
    }
  }

  // Name search: @handle or capitalized proper noun without niche signal
  const hasHandle = /@\w+/.test(query);
  if (hasHandle) return { intent: "name_search", confidence: 0.95 };
  const hasProperNoun = /\b[A-Z][a-z]{2,}\b/.test(query);
  if (hasProperNoun && nicheWords.length === 0) {
    return { intent: "name_search", confidence: 0.70 };
  }

  // Default: niche discovery (most common search type on this platform)
  return { intent: "niche_discovery", confidence: 0.35 };
}

// ---------------------------------------------------------------------------
// Recency signal
// ---------------------------------------------------------------------------

/**
 * Compute a recency signal [0, 1] from a creator's last enrichment timestamp.
 * Null-safe — returns 0.5 (neutral) when timestamp is unavailable or invalid.
 *
 * Scale:
 *   ≤  7 days → 1.00  (very fresh)
 *   ≤ 30 days → 0.75
 *   ≤ 90 days → 0.50
 *   ≤180 days → 0.25
 *    > 180 days → 0.10  (stale)
 */
export function computeRecencySignal(lastEnrichedAt: string | null | undefined): number {
  if (!lastEnrichedAt) return 0.5;
  try {
    const ts = new Date(lastEnrichedAt).getTime();
    if (isNaN(ts)) return 0.5; // invalid date string → neutral
    const daysSince = (Date.now() - ts) / 86_400_000;
    if (daysSince <= 7)   return 1.00;
    if (daysSince <= 30)  return 0.75;
    if (daysSince <= 90)  return 0.50;
    if (daysSince <= 180) return 0.25;
    return 0.10;
  } catch {
    return 0.5; // invalid / unparseable date → neutral
  }
}

// ---------------------------------------------------------------------------
// Intent match scoring
// ---------------------------------------------------------------------------

/**
 * Score how well a creator matches the detected search intent [0, 1].
 * Scaled by `intent.confidence` so low-confidence detections contribute less.
 */
export function computeIntentMatchScore(
  intent: SearchIntentResult,
  input: RankingInput,
): number {
  switch (intent.intent) {
    case "name_search": {
      const bestSim = Math.max(
        trigramSimilarity(input.query.toLowerCase(), input.displayName.toLowerCase()),
        trigramSimilarity(input.query.toLowerCase(), input.username.replace(/^@/, "").toLowerCase()),
      );
      return Math.min(1, bestSim * intent.confidence * 1.2);
    }
    case "niche_discovery": {
      const nicheExact =
        input.niche && input.queryNiche &&
        input.niche.toLowerCase() === input.queryNiche.toLowerCase();
      const nicheBase = nicheExact ? 1.0 : input.niche ? 0.30 : 0.50;
      // Mid-tier creators (10k–500k) tend to have better community engagement
      const tierBonus =
        input.followerCount != null &&
        input.followerCount >= 10_000 &&
        input.followerCount <= 500_000
          ? 0.15
          : 0;
      return Math.min(1, (nicheBase + tierBonus) * intent.confidence);
    }
    case "location_search": {
      const locExact =
        input.city && input.queryCity &&
        input.city.toLowerCase() === input.queryCity.toLowerCase();
      const locBase = locExact ? 1.0 : input.city ? 0.20 : 0.50;
      return Math.min(1, locBase * intent.confidence);
    }
    case "brand_campaign": {
      // Brands prefer: verified real data + larger following
      const verifiedBonus = input.isRealEngagement ? 0.30 : 0;
      const scaleBase =
        input.followerCount == null ? 0.15
        : input.followerCount >= 100_000 ? 0.60
        : input.followerCount >= 50_000  ? 0.45
        : input.followerCount >= 10_000  ? 0.30
        : 0.15;
      return Math.min(1, (verifiedBonus + scaleBase) * intent.confidence);
    }
    default:
      return 0.5;
  }
}

// ---------------------------------------------------------------------------
// Snippet-based semantic relevance (live proxy for embedding similarity)
// ---------------------------------------------------------------------------

/**
 * Compute word-overlap relevance between a search query and a result snippet [0, 1].
 *
 * Used as a *live* proxy for semantic similarity when vector embeddings
 * are not available.  Blends two signals:
 *   - term-hit rate   → fraction of query terms that appear in the snippet
 *   - trigram overlap → structural similarity between query and snippet head
 *
 * This populates `semanticSimilarity` in `computeSearchScoreV2`, activating
 * the 0.20-weight semantic layer for every search result.
 */
export function snippetRelevanceScore(query: string, snippet: string): number {
  if (!query || !snippet) return 0;

  const queryTerms = query
    .toLowerCase()
    .split(/[\s,;:!?()[\]{}/\\|<>+=*&^%$#@~`'"]+/)
    .filter((t) => t.length >= 3);

  if (queryTerms.length === 0) return 0;

  const snippetLower = snippet.toLowerCase();

  // Exact term hit rate — fraction of query terms found anywhere in snippet
  const exactHits = queryTerms.filter((t) => snippetLower.includes(t)).length;
  const termHitRate = exactHits / queryTerms.length;

  // Head hit rate — same signal but limited to first 100 chars (profile bio / title area).
  // Terms appearing early carry stronger signal than those buried in long descriptions.
  const snippetHead = snippetLower.slice(0, 100);
  const headHits = queryTerms.filter((t) => snippetHead.includes(t)).length;
  const headRate = headHits / queryTerms.length;

  // Partial term hit rate (any query term appears as substring of a snippet word)
  const partialHits = queryTerms.filter(
    (t) => !snippetLower.includes(t) && snippetLower.split(/\s+/).some((w) => w.startsWith(t) || t.startsWith(w)),
  ).length;
  const partialRate = partialHits / queryTerms.length;

  // Trigram comparison limited to first 200 chars of snippet (most signal)
  const trigramScore = trigramSimilarity(
    query.toLowerCase().slice(0, 80),
    snippetLower.slice(0, 200),
  );

  // Weights sum to 1.0. Head bonus replaces some flat term-hit weight so that
  // creaters whose bio leads with the query topic rank above those that bury it.
  return Math.min(1, termHitRate * 0.45 + headRate * 0.15 + partialRate * 0.10 + trigramScore * 0.30);
}
