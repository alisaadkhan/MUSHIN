/**
 * _shared/tag_intelligence.ts
 *
 * Tag Intelligence Layer for Mushin search ranking.
 *
 * Tags are free-form string arrays (e.g. ["fashion", "ootd", "lahore"])
 * stored on influencer profiles and cache rows.  This module converts query
 * terms + a creator's tag set into a normalised [0, 1] match score.
 *
 * Score formula:
 *   Tag Score = exactMatch × 0.40 + partialMatch × 0.20 + semanticTagSim × 0.10
 *             capped at 1.0
 *
 * Called from:
 *   - search-influencers (server-side, during result scoring)
 *   - enrich-influencer  (server-side, writes computed tags)
 */

// ---------------------------------------------------------------------------
// Tag normalisation
// ---------------------------------------------------------------------------

/** Tags that carry no signal and should be stripped before matching. */
const TAG_SPAM: ReadonlySet<string> = new Set([
  "viral", "trending", "fyp", "foryou", "foryoupage", "explore",
  "reels", "shorts", "tiktok", "instagram", "youtube",
  "follow", "followme", "like", "likeforlikes", "comment",
  "pakistan", "pk",          // too broad for tag matching
  "influencer", "creator",
]);

/** Maximum number of tags stored/processed per creator. */
export const MAX_TAGS = 20;

/**
 * Normalise a raw tag string: lowercase, strip punctuation, trim whitespace.
 * Returns null if the result is empty or in the spam list.
 */
function _normalizeTag(raw: string): string | null {
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
    const n = _normalizeTag(raw);
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

/** Minimum token length to be considered a useful query term. */
const MIN_TERM_LEN = 3;

/**
 * Extract searchable terms from a raw query string.
 * Splits on whitespace and punctuation; filters short tokens and stopwords.
 */
export function extractQueryTerms(query: string): string[] {
  const STOPWORDS = new Set(["the", "and", "for", "with", "from", "this", "that"]);
  return query
    .toLowerCase()
    .split(/[\s,;:!?()+]+/)
    .map((t) => t.replace(/[^a-z0-9\u0600-\u06ff]/g, "").trim())
    .filter((t) => t.length >= MIN_TERM_LEN && !STOPWORDS.has(t));
}

// ---------------------------------------------------------------------------
// Trigram similarity (mirrors pg_trgm; no dependencies)
// ---------------------------------------------------------------------------

function buildTrigrams(s: string): Set<string> {
  const padded = ` ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

function trigramSim(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = buildTrigrams(a);
  const tb = buildTrigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared === 0 ? 0 : (2 * shared) / (ta.size + tb.size);
}

// ---------------------------------------------------------------------------
// Tag match sub-scores
// ---------------------------------------------------------------------------

/**
 * Exact match ratio: what fraction of query terms appear verbatim in tags?
 * [0, 1]
 */
function exactMatchScore(queryTerms: string[], creatorTags: string[]): number {
  if (!queryTerms.length || !creatorTags.length) return 0;
  const tagSet = new Set(creatorTags);
  const hits = queryTerms.filter((t) => tagSet.has(t)).length;
  return hits / queryTerms.length;
}

/**
 * Partial match ratio: what fraction of query terms are substrings of any tag?
 * Counts only tokens not already captured by exact match.
 * [0, 1]
 */
function partialMatchScore(queryTerms: string[], creatorTags: string[]): number {
  if (!queryTerms.length || !creatorTags.length) return 0;
  const tagSet = new Set(creatorTags);
  let hits = 0;
  for (const term of queryTerms) {
    if (tagSet.has(term)) continue; // already counted in exact
    const matched = creatorTags.some(
      (tag) => tag.includes(term) || term.includes(tag),
    );
    if (matched) hits++;
  }
  return hits / queryTerms.length;
}

/**
 * Semantic tag similarity: best trigram similarity between the full expanded
 * query string and each creator tag.
 * [0, 1]
 */
function semanticTagSimilarity(query: string, creatorTags: string[]): number {
  if (!creatorTags.length) return 0;
  let best = 0;
  for (const tag of creatorTags) {
    const sim = trigramSim(query, tag);
    if (sim > best) best = sim;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TagScoreInput {
  /** Raw search query (pre-normalisation is fine; we normalise internally). */
  query: string;
  /** Creator's normalised tags (call normalizeTags() first). */
  creatorTags: string[];
}

export interface TagScoreResult {
  /** Composite tag match score [0, 1]. */
  score: number;
  /** Exact match component [0, 1]. */
  exactMatch: number;
  /** Partial match component [0, 1]. */
  partialMatch: number;
  /** Semantic trigram component [0, 1]. */
  semanticSim: number;
  /** Number of exact matches found. */
  exactHits: number;
}

/**
 * Compute the full tag intelligence score for a creator against a query.
 *
 * Formula:
 *   score = exactMatch × 0.40 + partialMatch × 0.20 + semanticSim × 0.10
 *
 * Weights are designed so the tag layer contributes at most 0.20 to the
 * overall final score when multiplied by the outer 0.20 weight.
 *
 * Returns 0 immediately if the creator has no tags.
 */
export function computeTagScore(input: TagScoreInput): TagScoreResult {
  const { query, creatorTags } = input;

  if (!creatorTags.length) {
    return { score: 0, exactMatch: 0, partialMatch: 0, semanticSim: 0, exactHits: 0 };
  }

  const queryTerms = extractQueryTerms(query);
  const normalQuery = query.toLowerCase().trim();

  const exactMatch  = exactMatchScore(queryTerms, creatorTags);
  const partialMatch = partialMatchScore(queryTerms, creatorTags);
  const semanticSim  = semanticTagSimilarity(normalQuery, creatorTags);

  const exactHits = queryTerms.filter((t) => creatorTags.includes(t)).length;

  const score = Math.min(1,
    exactMatch  * 0.40 +
    partialMatch * 0.20 +
    semanticSim  * 0.10,
  );

  return { score, exactMatch, partialMatch, semanticSim, exactHits };
}

/**
 * Quick helper when only the score number is needed.
 */
export function getTagScore(query: string, creatorTags: string[]): number {
  return computeTagScore({ query, creatorTags }).score;
}

// ---------------------------------------------------------------------------
// Tag suggestion (for auto-tagging during enrichment)
// ---------------------------------------------------------------------------

/**
 * Niche → canonical tag set mapping.
 * Used to auto-assign baseline tags from detected niche during enrichment.
 */
export const NICHE_TAG_MAP: Readonly<Record<string, string[]>> = {
  fashion:   ["fashion", "style", "ootd", "clothing", "outfit"],
  beauty:    ["beauty", "makeup", "skincare", "glam", "cosmetics"],
  food:      ["food", "foodie", "recipe", "cooking", "restaurant"],
  fitness:   ["fitness", "gym", "workout", "health", "exercise"],
  travel:    ["travel", "adventure", "explore", "tourism", "trip"],
  gaming:    ["gaming", "gamer", "pubg", "esports", "gameplay"],
  tech:      ["tech", "technology", "gadgets", "review", "unboxing"],
  education: ["education", "tutorial", "learning", "course", "knowledge"],
  lifestyle: ["lifestyle", "vlog", "daily", "motivation", "routine"],
  music:     ["music", "singer", "rap", "song", "artist"],
  comedy:    ["comedy", "funny", "humor", "entertainment", "skit"],
  cricket:   ["cricket", "psl", "sports", "match", "batting"],
};

/**
 * Suggest tags for a creator based on detected niche + bio keywords.
 * Returns normalised, deduplicated tags capped at MAX_TAGS.
 */
export function suggestTags(niche: string | null, bioKeywords: string[]): string[] {
  const nicheTags = niche ? (NICHE_TAG_MAP[niche.toLowerCase()] ?? []) : [];
  const allRaw = [...nicheTags, ...bioKeywords];
  return normalizeTags(allRaw);
}
