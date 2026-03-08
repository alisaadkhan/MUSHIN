/**
 * src/modules/search/tag-ranking/index.ts
 *
 * Client-side Tag Intelligence Layer.
 *
 * Mirrors the server-side `_shared/tag_intelligence.ts` for React Query
 * pre-filtering and client-side re-ranking without a round-trip.
 *
 * Tag Score formula:
 *   exactMatch × 0.40 + partialMatch × 0.20 + semanticTagSim × 0.10  → [0,1]
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum tags stored/processed per creator (kept in sync with server). */
export const MAX_TAGS = 20;

/**
 * Tags that carry no search signal — stripped before matching.
 * Kept in sync with `_shared/tag_intelligence.ts`.
 */
export const TAG_SPAM: ReadonlySet<string> = new Set([
  "viral", "trending", "fyp", "foryou", "foryoupage", "explore",
  "reels", "shorts", "tiktok", "instagram", "youtube",
  "follow", "followme", "like", "likeforlikes", "comment",
  "pakistan", "pk",
  "influencer", "creator",
]);

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a single raw tag string.
 * Returns null for empty or spam tags.
 */
export function normalizeTag(raw: string): string | null {
  const n = raw
    .toLowerCase()
    .replace(/[#@_\-\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n || TAG_SPAM.has(n)) return null;
  return n;
}

/**
 * Normalise and deduplicate an array of raw tags.
 * Result is capped at MAX_TAGS entries.
 */
export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawTags) {
    const n = normalizeTag(raw);
    if (n && !seen.has(n)) {
      seen.add(n);
      result.push(n);
      if (result.length >= MAX_TAGS) break;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Query term extraction
// ---------------------------------------------------------------------------

/** Minimum token length for a term to be useful. */
const MIN_TERM_LEN = 3;

const STOPWORDS = new Set(["the", "and", "for", "with", "from", "this", "that"]);

/**
 * Extract searchable terms from a raw query string.
 */
export function extractQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,;:!?()+]+/)
    .map((t) => t.replace(/[^a-z0-9\u0600-\u06ff]/g, "").trim())
    .filter((t) => t.length >= MIN_TERM_LEN && !STOPWORDS.has(t));
}

// ---------------------------------------------------------------------------
// Trigram similarity
// ---------------------------------------------------------------------------

function buildTrigrams(s: string): Set<string> {
  const padded = ` ${s} `;
  const result = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    result.add(padded.slice(i, i + 3));
  }
  return result;
}

/**
 * Dice-coefficient trigram similarity [0, 1].
 * Equivalent to pg_trgm `similarity()`.
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
// Tag match sub-scores
// ---------------------------------------------------------------------------

function exactMatchScore(queryTerms: string[], creatorTags: string[]): number {
  if (!queryTerms.length || !creatorTags.length) return 0;
  const tagSet = new Set(creatorTags);
  return queryTerms.filter((t) => tagSet.has(t)).length / queryTerms.length;
}

function partialMatchScore(queryTerms: string[], creatorTags: string[]): number {
  if (!queryTerms.length || !creatorTags.length) return 0;
  const tagSet = new Set(creatorTags);
  let hits = 0;
  for (const term of queryTerms) {
    if (tagSet.has(term)) continue;
    if (creatorTags.some((tag) => tag.includes(term) || term.includes(tag))) hits++;
  }
  return hits / queryTerms.length;
}

function semanticTagSimilarity(query: string, creatorTags: string[]): number {
  if (!creatorTags.length) return 0;
  return Math.max(...creatorTags.map((tag) => trigramSimilarity(query, tag)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TagScoreInput {
  query: string;
  /** Already-normalised creator tags. */
  creatorTags: string[];
}

export interface TagScoreResult {
  /** Composite tag score [0, 1]. */
  score: number;
  exactMatch: number;
  partialMatch: number;
  semanticSim: number;
  exactHits: number;
}

/**
 * Compute the tag intelligence score for a creator against a search query.
 *
 * Formula: exactMatch×0.40 + partialMatch×0.20 + semanticSim×0.10
 *
 * This contributes to the wider ranking formula via the 0.20 tag weight.
 */
export function computeTagScore(input: TagScoreInput): TagScoreResult {
  const { query, creatorTags } = input;
  if (!creatorTags.length) {
    return { score: 0, exactMatch: 0, partialMatch: 0, semanticSim: 0, exactHits: 0 };
  }

  const queryTerms  = extractQueryTerms(query);
  const normalQuery = query.toLowerCase().trim();

  const exactMatch   = exactMatchScore(queryTerms, creatorTags);
  const partialMatch = partialMatchScore(queryTerms, creatorTags);
  const semanticSim  = semanticTagSimilarity(normalQuery, creatorTags);
  const exactHits    = queryTerms.filter((t) => creatorTags.includes(t)).length;

  const score = Math.min(1,
    exactMatch   * 0.40 +
    partialMatch * 0.20 +
    semanticSim  * 0.10,
  );

  return { score, exactMatch, partialMatch, semanticSim, exactHits };
}

/** Shorthand — returns only the numeric score. */
export function getTagScore(query: string, creatorTags: string[]): number {
  return computeTagScore({ query, creatorTags }).score;
}
