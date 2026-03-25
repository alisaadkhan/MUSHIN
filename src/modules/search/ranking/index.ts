// Ranking — relevance score computation, result ordering, deduplication
//
// New: multi-factor scoring (sortByScore, ScoredSearchResult).
// The server's computeSearchScoreV2 (_shared/ranking.ts) attaches a
// _search_score field to every result; client-side code should sort by that.

export type RankSignal = "followers" | "engagement" | "relevance_score" | "fraud_risk";

/** Search intent categories (mirrors _shared/ranking.ts SearchIntent). */
export type SearchIntent =
  | "name_search"
  | "niche_discovery"
  | "location_search"
  | "brand_campaign";

export interface SearchIntentResult {
  intent: SearchIntent;
  confidence: number;
}

/**
 * @deprecated Use sortByScore() instead.
 * Legacy single-signal sort retained for backward compatibility.
 * Will be removed after 2026-04-06 validation window.
 */
export function rankResults<T extends { relevance_score?: number }>(
  results: T[],
  signal: RankSignal = "relevance_score",
): T[] {
  return [...results].sort((a, b) => {
    const av = (a as Record<string, number>)[signal] ?? 0;
    const bv = (b as Record<string, number>)[signal] ?? 0;
    return bv - av;
  });
}

// ---------------------------------------------------------------------------
// Multi-factor scoring (new)
// ---------------------------------------------------------------------------

/**
 * Shape of a search result that carries a server-computed ranking score.
 * The _search_score field is attached by the search-influencers edge function.
 */
export interface ScoredSearchResult {
  /** Composite commercial relevance score [0, 1] from the multi-factor engine. */
  _search_score: number;
}

/**
 * Sort pre-scored search results by server-computed _search_score descending.
 *
 * Results missing _search_score fall to the bottom (treated as 0).
 * This is the preferred sort for all search result rendering.
 */
export function sortByScore<T extends Partial<ScoredSearchResult>>(results: T[]): T[] {
  return [...results].sort((a, b) => (b._search_score ?? 0) - (a._search_score ?? 0));
}

// ---------------------------------------------------------------------------
// Snippet relevance (client-side mirror of _shared/ranking.ts)
// ---------------------------------------------------------------------------

/**
 * Compute word-overlap relevance between a search query and a result snippet [0, 1].
 *
 * Blends three signals:
 *   - exact term-hit rate   (0.60 weight)
 *   - partial term-hit rate (0.15 weight)
 *   - trigram overlap       (0.25 weight)
 *
 * Used for client-side highlighting and optional score display.
 * The edge function uses the same algorithm to populate `_search_score`
 * via `computeSearchScoreV2`.
 */
export function snippetRelevanceScore(query: string, snippet: string): number {
  if (!query || !snippet) return 0;

  const queryTerms = query
    .toLowerCase()
    .split(/[\s,;:!?()[\]{}/\\|<>+=*&^%$#@~`'"]+/)
    .filter((t) => t.length >= 3);

  if (queryTerms.length === 0) return 0;

  const snippetLower = snippet.toLowerCase();

  const exactHits = queryTerms.filter((t) => snippetLower.includes(t)).length;
  const termHitRate = exactHits / queryTerms.length;

  // Head hit rate — terms in the first 100 chars carry stronger signal
  const snippetHead = snippetLower.slice(0, 100);
  const headHits = queryTerms.filter((t) => snippetHead.includes(t)).length;
  const headRate = headHits / queryTerms.length;

  const snippetWords = snippetLower.split(/\s+/);
  const partialHits = queryTerms.filter(
    (t) => !snippetLower.includes(t) && snippetWords.some((w) => w.startsWith(t) || t.startsWith(w)),
  ).length;
  const partialRate = partialHits / queryTerms.length;

  // Simple trigram overlap: count shared 3-grams between query and snippet head
  function trigrams(s: string): Set<string> {
    const p = ` ${s} `;
    const set = new Set<string>();
    for (let i = 0; i < p.length - 2; i++) set.add(p.slice(i, i + 3));
    return set;
  }
  const ta = trigrams(query.toLowerCase().slice(0, 80));
  const tb = trigrams(snippetLower.slice(0, 200));
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const trigramScore = (ta.size + tb.size) === 0 ? 0 : (2 * shared) / (ta.size + tb.size);

  return Math.min(1, termHitRate * 0.45 + headRate * 0.15 + partialRate * 0.10 + trigramScore * 0.30);
}

// ---------------------------------------------------------------------------
// Intent detection (client mirror of _shared/ranking.ts detectSearchIntent)
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
 * Detect the likely search intent from a query string.
 * Client-side mirror of the Deno `detectSearchIntent` in `_shared/ranking.ts`.
 */
export function detectSearchIntent(query: string): SearchIntentResult {
  const lower = query.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => w.length >= 3);

  if (BRAND_SIGNALS_RE.test(lower)) {
    return { intent: "brand_campaign", confidence: 0.85 };
  }

  const nicheWords = meaningful.filter((w) => NICHE_WORDS_SET.has(w));
  const hasLocation = LOCATION_NAMES_RE.test(lower);

  if (hasLocation && nicheWords.length === 0 && meaningful.length <= 3) {
    return { intent: "location_search", confidence: 0.75 };
  }

  if (nicheWords.length >= 1) {
    const nicheRatio = meaningful.length > 0 ? nicheWords.length / meaningful.length : 0;
    if (nicheRatio >= 0.35) {
      return { intent: "niche_discovery", confidence: Math.min(0.90, 0.45 + nicheRatio * 0.55) };
    }
  }

  const hasHandle = /@\w+/.test(query);
  if (hasHandle) return { intent: "name_search", confidence: 0.95 };
  const hasProperNoun = /\b[A-Z][a-z]{2,}\b/.test(query);
  if (hasProperNoun && nicheWords.length === 0) {
    return { intent: "name_search", confidence: 0.70 };
  }

  return { intent: "niche_discovery", confidence: 0.35 };
}

// ---------------------------------------------------------------------------
// Recency signal (client mirror of _shared/ranking.ts computeRecencySignal)
// ---------------------------------------------------------------------------

/**
 * Compute a recency signal [0, 1] from a creator's last enrichment timestamp.
 * Returns 0.5 (neutral) when unavailable.
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
    return 0.5;
  }
}

// Phase 5 — platform intelligence boost
export { computePlatformIntelligenceBoost } from "./platform_intelligence";
export type { PlatformIntelligenceInput, PlatformIntelligenceResult } from "./platform_intelligence";

// ---------------------------------------------------------------------------
// Ranking v4 Formula (Phase 6)
// ---------------------------------------------------------------------------

/**
 * Input signals for the v4 composite ranking formula.
 * All scores must be in [0, 1].
 */
export interface RankingV4Input {
  keywordRelevance: number;
  semanticRelevance: number;
  engagementQuality: number;
  authenticityScore: number;
  recencySignal: number;
  intentMatch: number;
  /** New in v4: trend velocity from predictive intelligence [0, 1] */
  trendVelocity?: number | null;
  /** New in v4: platform intelligence boost [0, 0.25] */
  platformIntelligenceBoost?: number | null;
}

/** v4 ranking formula weight constants. Weights sum to 1.0. */
export const RANKING_V4_WEIGHTS = {
  keywordRelevance:          0.25,
  semanticRelevance:         0.20,
  engagementQuality:         0.15,
  authenticityScore:         0.15,
  recencySignal:             0.10,
  intentMatch:               0.05,  // unchanged from v3 — keyword/semantic reduction funds new signals
  trendVelocity:             0.05,  // new in v4 (predictive intelligence)
  platformIntelligenceBoost: 0.05,  // new in v4 (platform signals)
} as const;

/**
 * Compute the v4 composite ranking score.
 *
 * v4 =
 *   0.25 × keyword_relevance
 *   + 0.20 × semantic_relevance
 *   + 0.15 × engagement_quality
 *   + 0.15 × authenticity_score
 *   + 0.10 × recency_signal
 *   + 0.10 × intent_match
 *   + 0.05 × trend_velocity (defaults to neutral 0.50 when unavailable)
 *   + 0.05 × platform_intelligence_boost (defaults to 0 when unavailable)
 *
 * Output clamped to [0, 1].
 */
export function computeRankingScoreV4(input: RankingV4Input): number {
  const w = RANKING_V4_WEIGHTS;
  // trend_velocity defaults to 0.50 (neutral) when not supplied
  const trendV = input.trendVelocity ?? 0.50;
  // platform boost defaults to 0 when unavailable (additive signal)
  const platBoost = input.platformIntelligenceBoost ?? 0;

  const score =
    input.keywordRelevance  * w.keywordRelevance +
    input.semanticRelevance * w.semanticRelevance +
    input.engagementQuality * w.engagementQuality +
    input.authenticityScore * w.authenticityScore +
    input.recencySignal     * w.recencySignal +
    input.intentMatch       * w.intentMatch +
    trendV                  * w.trendVelocity +
    platBoost               * w.platformIntelligenceBoost;

  return Math.max(0, Math.min(1, score));
}

// ---------------------------------------------------------------------------
// Search result quality tiers (Phase 5)
// ---------------------------------------------------------------------------

/** Quality tier label for a scored search result */
export type QualityTier = "elite" | "good" | "low";

/** Display properties for a quality tier badge */
export interface QualityTierBadge {
  tier: QualityTier;
  label: "Elite Match" | "Good Match" | "Low Confidence";
  colorClass: string;
}

/**
 * Classify a search result's _search_score into a quality tier.
 *
 * Thresholds:
 *  - Elite:          score >= 0.75 (green)
 *  - Good:           score >= 0.50 (blue)
 *  - Low confidence: score <  0.50 (gray)
 *
 * Returns null when score is unavailable.
 */
export function getQualityTier(score: number | null | undefined): QualityTierBadge | null {
  if (score == null) return null;
  if (score >= 0.75) {
    return { tier: "elite", label: "Elite Match", colorClass: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  }
  if (score >= 0.50) {
    return { tier: "good", label: "Good Match", colorClass: "bg-blue-100 text-blue-700 border-blue-200" };
  }
  return { tier: "low", label: "Low Confidence", colorClass: "bg-muted text-muted-foreground border-border" };
}
