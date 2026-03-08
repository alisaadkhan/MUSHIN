/**
 * src/modules/search/tags/tag_similarity_engine.ts
 *
 * Bidirectional query-to-creator tag similarity scorer.
 *
 * Algorithm:
 *  1. Forward pass:  how many of the creator's tags match query terms?
 *  2. Backward pass: how many query terms are covered by creator tags?
 *  3. Combine with F1-like harmonic mean weighted toward recall
 *     (creator-tag coverage of query is more important than precision).
 *
 * Score ∈ [0, 1]. Returns 0 for empty inputs (never crashes).
 */

/** Trigram character set for partial matching */
function _trigrams(s: string): Set<string> {
  const padded = `  ${s}  `;
  const result = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    result.add(padded.slice(i, i + 3));
  }
  return result;
}

/** Jaccard similarity of two trigram sets ∈ [0, 1] */
function _trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;
  const ta = _trigrams(a);
  const tb = _trigrams(b);
  let intersection = 0;
  for (const g of ta) if (tb.has(g)) intersection++;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Maximum trigram similarity between one query term and a list of tags */
function _bestTagMatch(queryTerm: string, tags: string[]): number {
  let best = 0;
  for (const tag of tags) {
    const sim = _trigramSimilarity(queryTerm, tag);
    if (sim > best) best = sim;
    if (best === 1.0) break;
  }
  return best;
}

/**
 * Compute bidirectional tag similarity between a search query and a creator's tag profile.
 *
 * @param query        - Raw search query string (e.g. "fitness coach karachi")
 * @param creatorTags  - Creator's tag list from buildCreatorTagProfile()
 * @returns similarity score ∈ [0, 1]
 */
export function queryTagSimilarity(query: string, creatorTags: string[]): number {
  if (!query || creatorTags.length === 0) return 0;

  const queryTerms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  if (queryTerms.length === 0) return 0;

  // Forward pass: for each creator tag, measure best query coverage
  let forwardSum = 0;
  for (const tag of creatorTags) {
    forwardSum += _bestTagMatch(tag, queryTerms);
  }
  const precision = forwardSum / creatorTags.length;

  // Backward pass: for each query term, measure best tag coverage
  let backwardSum = 0;
  for (const term of queryTerms) {
    backwardSum += _bestTagMatch(term, creatorTags);
  }
  const recall = backwardSum / queryTerms.length;

  if (precision + recall === 0) return 0;

  // Weighted harmonic mean — recall matters more (query coverage is key)
  const beta = 1.5;
  const beta2 = beta * beta;
  const f = ((1 + beta2) * (precision * recall)) / (beta2 * precision + recall);

  return Math.min(Math.round(f * 10000) / 10000, 1.0);
}

/**
 * Rank a list of {tags, ...} objects by tag similarity to a query,
 * returning items with their similarity scores in descending order.
 */
export function rankByTagSimilarity<T extends { tags?: string[] | null }>(
  query: string,
  items: T[]
): Array<T & { tagSimilarity: number }> {
  return items
    .map((item) => ({
      ...item,
      tagSimilarity: queryTagSimilarity(query, item.tags ?? []),
    }))
    .sort((a, b) => b.tagSimilarity - a.tagSimilarity);
}
