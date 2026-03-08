/**
 * src/modules/search/semantic-ranking/index.ts
 *
 * Client-side Semantic Similarity Layer.
 *
 * At query time we cannot run an embedding model in the browser, so this
 * module works with PRE-COMPUTED similarity scores from two DB sources:
 *
 *   1. `creator_lookalikes.similarity` — pairwise cosine similarities
 *      computed offline (nightly cron) and stored in the DB.
 *   2. `_search_semantic_score` — a score injected by the search-influencers
 *      edge function when a query-embedding ANN call is made.
 *
 * For client-side re-ranking of already-fetched results, this module exposes
 * utilities to sort by a semantic score field, and a raw cosine similarity
 * function for unit-testing purposes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WithSemanticScore {
  /** Pre-computed semantic (embedding) similarity in [0, 1]. */
  _semantic_score?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Cosine similarity (client-side, for pre-computed vectors)
// ---------------------------------------------------------------------------

/**
 * Compute cosine similarity between two equal-length numeric vectors.
 * Returns 0 for null / mismatched vectors.
 *
 * Used in unit tests and as an offline utility.  At query time the similarity
 * is expected to come from the DB (server-side ANN call).
 *
 * @param a — vector A (e.g. query embedding)
 * @param b — vector B (e.g. creator embedding)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
}

// ---------------------------------------------------------------------------
// Result re-ranking by semantic score
// ---------------------------------------------------------------------------

/**
 * Sort search results by `_semantic_score` descending.
 * Results without a score are placed after those with one (score treated as 0).
 *
 * This is a stable sort — equal scores preserve insertion order.
 */
export function sortBySemantic<T extends WithSemanticScore>(results: T[]): T[] {
  return [...results].sort(
    (a, b) => (b._semantic_score ?? 0) - (a._semantic_score ?? 0),
  );
}

/**
 * Extract the semantic score for a single result.
 * Returns 0 when the field is absent (backwards-compatible with non-semantic results).
 */
export function getSemanticScore(result: WithSemanticScore): number {
  return Math.max(0, Math.min(1, result._semantic_score ?? 0));
}

// ---------------------------------------------------------------------------
// Hybrid blending
// ---------------------------------------------------------------------------

/**
 * Blend a keyword score and a semantic score into a single hybrid score.
 *
 * `semanticWeight` controls the balance [0, 1]:
 *   - 0.0 → pure keyword result
 *   - 1.0 → pure semantic result
 *   - 0.5 → equal blend (default)
 *
 * This is used by the ranking-composer when fusing Layer 1 + Layer 3.
 */
export function blendScores(
  keywordScore: number,
  semanticScore: number,
  semanticWeight = 0.5,
): number {
  const kw = Math.max(0, Math.min(1, keywordScore));
  const sm = Math.max(0, Math.min(1, semanticScore));
  const w  = Math.max(0, Math.min(1, semanticWeight));
  return kw * (1 - w) + sm * w;
}
