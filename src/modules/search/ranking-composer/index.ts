/**
 * src/modules/search/ranking-composer/index.ts
 *
 * Ranking Composer — assembles all four intelligence layers into a final score.
 *
 * This is the single source-of-truth for the Mushin search ranking formula.
 * All layer weights are exported as named constants so tests can assert against
 * them and future changes require only one edit point.
 *
 * ── v2 Formula ─────────────────────────────────────────────────────────────
 *
 *   Final Score =
 *     WEIGHT_KEYWORD   × keywordRelevance     (Layer 1)
 *   + WEIGHT_TAG       × tagMatchStrength     (Layer 2)
 *   + WEIGHT_SEMANTIC  × semanticSimilarity   (Layer 3)
 *   + WEIGHT_ENGAGEMENT× engagementQuality    (Layer 4a)
 *   + WEIGHT_AUTH      × authenticityScore    (Layer 4b)
 *
 * Weights must sum to 1.0.
 *
 * ── Keyword Relevance sub-formula ──────────────────────────────────────────
 *
 *   keywordRelevance =
 *     0.70 × nameSimilarity
 *   + 0.20 × nicheMatch
 *   + 0.10 × locationMatch
 *
 */

// ---------------------------------------------------------------------------
// Layer weight constants
// ---------------------------------------------------------------------------

/** Weight for Layer 1: Keyword Relevance (name, niche, location). */
export const WEIGHT_KEYWORD    = 0.35 as const;

/** Weight for Layer 2: Tag Match Strength. */
export const WEIGHT_TAG        = 0.20 as const;

/** Weight for Layer 3: Semantic (embedding) Similarity. */
export const WEIGHT_SEMANTIC   = 0.20 as const;

/** Weight for Layer 4a: Engagement Quality. */
export const WEIGHT_ENGAGEMENT = 0.15 as const;

/** Weight for Layer 4b: Authenticity Score. */
export const WEIGHT_AUTH       = 0.10 as const;

/** Sum of all layer weights — must equal 1.0. */
export const TOTAL_WEIGHT =
  WEIGHT_KEYWORD + WEIGHT_TAG + WEIGHT_SEMANTIC + WEIGHT_ENGAGEMENT + WEIGHT_AUTH;

// Compile-time check via literal type arithmetic is not possible in TS, but
// this runtime assertion will throw during module load in tests if weights drift.
if (Math.abs(TOTAL_WEIGHT - 1.0) > 1e-9) {
  throw new Error(
    `[ranking-composer] Layer weights do not sum to 1.0 — got ${TOTAL_WEIGHT}`,
  );
}

// ---------------------------------------------------------------------------
// Keyword relevance sub-formula weights
// ---------------------------------------------------------------------------

export const KEYWORD_W_NAME     = 0.70 as const;
export const KEYWORD_W_NICHE    = 0.20 as const;
export const KEYWORD_W_LOCATION = 0.10 as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayeredScoringInput {
  /**
   * Layer 1 — Keyword relevance [0, 1].
   * Sub-score: nameSim×0.70 + nicheMatch×0.20 + locationMatch×0.10
   */
  keywordRelevance: number;

  /**
   * Layer 2 — Tag match strength [0, 1].
   * 0 when creator has no tags.
   */
  tagMatchStrength: number;

  /**
   * Layer 3 — Semantic (embedding cosine) similarity [0, 1].
   * 0 when no embedding is available for this creator.
   */
  semanticSimilarity: number;

  /**
   * Layer 4a — Engagement quality [0, 1].
   * Score vs platform-specific benchmark.
   */
  engagementQuality: number;

  /**
   * Layer 4b — Audience authenticity [0, 1].
   * 1 = fully authentic; derived from bot risk signals.
   */
  authenticityScore: number;
}

export interface ComposedScore {
  /** Final clamped score [0, 1]. */
  final: number;
  /** Individual layer contributions (before weight multiplication). */
  layers: {
    keyword: number;
    tag: number;
    semantic: number;
    engagement: number;
    authenticity: number;
  };
  /** Weighted contribution of each layer to the final score. */
  weighted: {
    keyword: number;
    tag: number;
    semantic: number;
    engagement: number;
    authenticity: number;
  };
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

/**
 * Compose all four intelligence layers into a final search relevance score.
 *
 * All input scores must be in [0, 1].  Out-of-range values are clamped
 * before multiplication to avoid contaminating the final score.
 *
 * Returns a `ComposedScore` with the final score and a full breakdown for
 * debugging / explainability.
 */
export function composeScore(input: LayeredScoringInput): ComposedScore {
  const kw  = Math.max(0, Math.min(1, input.keywordRelevance));
  const tag = Math.max(0, Math.min(1, input.tagMatchStrength));
  const sem = Math.max(0, Math.min(1, input.semanticSimilarity));
  const eng = Math.max(0, Math.min(1, input.engagementQuality));
  const aut = Math.max(0, Math.min(1, input.authenticityScore));

  const wKw  = kw  * WEIGHT_KEYWORD;
  const wTag = tag * WEIGHT_TAG;
  const wSem = sem * WEIGHT_SEMANTIC;
  const wEng = eng * WEIGHT_ENGAGEMENT;
  const wAut = aut * WEIGHT_AUTH;

  const final = Math.max(0, Math.min(1, wKw + wTag + wSem + wEng + wAut));

  return {
    final,
    layers: {
      keyword:      kw,
      tag:          tag,
      semantic:     sem,
      engagement:   eng,
      authenticity: aut,
    },
    weighted: {
      keyword:      wKw,
      tag:          wTag,
      semantic:     wSem,
      engagement:   wEng,
      authenticity: wAut,
    },
  };
}

/**
 * Shorthand when only the numeric score is needed.
 */
export function composeScoreValue(input: LayeredScoringInput): number {
  return composeScore(input).final;
}

// ---------------------------------------------------------------------------
// Keyword relevance sub-formula
// ---------------------------------------------------------------------------

export interface KeywordRelevanceInput {
  /** Trigram / name-similarity score [0, 1]. */
  nameSimilarity: number;
  /** Niche match [0, 1]. */
  nicheMatch: number;
  /** Location match [0, 1]. */
  locationMatch: number;
}

/**
 * Compute the keyword relevance sub-score [0, 1].
 *
 *   keywordRelevance = nameSim×0.70 + nicheMatch×0.20 + locationMatch×0.10
 */
export function computeKeywordRelevance(input: KeywordRelevanceInput): number {
  const ns = Math.max(0, Math.min(1, input.nameSimilarity));
  const nm = Math.max(0, Math.min(1, input.nicheMatch));
  const lm = Math.max(0, Math.min(1, input.locationMatch));
  return ns * KEYWORD_W_NAME + nm * KEYWORD_W_NICHE + lm * KEYWORD_W_LOCATION;
}
