// Similarity — name and text matching utilities.
//
// Implements the same trigram algorithm used by PostgreSQL's pg_trgm extension
// and mirrored in _shared/ranking.ts (server-side Deno).  Having the same
// algorithm client-side lets the frontend sort/filter pre-fetched results
// without an additional network round-trip.

// ---------------------------------------------------------------------------
// Core trigram implementation
// ---------------------------------------------------------------------------

/** Compute the set of character trigrams for a padded, lower-cased string. */
function buildTrigrams(str: string): Set<string> {
  const padded = ` ${str.toLowerCase().trim()} `;
  const result: Set<string> = new Set();
  for (let i = 0; i < padded.length - 2; i++) {
    result.add(padded.slice(i, i + 3));
  }
  return result;
}

/**
 * Dice-coefficient trigram similarity.
 *
 * Returns a value in [0, 1] that is equivalent to PostgreSQL's
 * `similarity(a, b)` from the pg_trgm extension.
 *
 * Examples:
 *   trigramSimilarity("fashion", "fashion")   → 1.0
 *   trigramSimilarity("sarah", "sara")        → ~0.67
 *   trigramSimilarity("tech", "fashion")      → 0.0
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
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalise a string for similarity comparison.
 *
 * - Lowercases
 * - Preserves Urdu Unicode block (U+0600–U+06FF)
 * - Replaces other non-alphanumeric characters with spaces
 * - Collapses whitespace
 */
export function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Creator name similarity
// ---------------------------------------------------------------------------

/**
 * Best-of trigram similarity between a search query and a creator's
 * display name and username handle.
 *
 * Takes the maximum of the two comparisons so that a strong match on
 * either field surfaces the creator even if the other field is unrelated.
 *
 * Range: [0, 1].
 */
export function creatorNameSimilarity(
  query: string,
  displayName: string,
  username: string,
): number {
  const q = normalizeForSearch(query);
  return Math.max(
    trigramSimilarity(q, normalizeForSearch(displayName)),
    trigramSimilarity(q, normalizeForSearch(username.replace(/^@/, ""))),
  );
}
