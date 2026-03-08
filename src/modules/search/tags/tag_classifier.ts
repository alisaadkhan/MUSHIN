/**
 * src/modules/search/tags/tag_classifier.ts
 *
 * Extracts structured topic tags from creator bio text and raw hashtag strings.
 *
 * Design goals:
 *  - Zero network calls — purely string-based
 *  - Works on Roman Urdu + English mixed text (common on Pakistani profiles)
 *  - Returns normalised lowercase tags, deduplicated
 *  - Caps output to MAX_TAGS to keep downstream scoring bounded
 */

/** Maximum tags returned per extraction call */
const MAX_TAGS = 20;

/** Niche seed vocabulary — single canonical forms */
const NICHE_SEEDS: Record<string, string[]> = {
  tech: ["tech", "technology", "coding", "programming", "software", "hardware", "developer", "dev", "coder"],
  ai: ["ai", "artificialintelligence", "machinelearning", "deeplearning", "chatgpt", "llm", "datascience"],
  gaming: ["gaming", "gamer", "games", "esports", "pubg", "freefire", "mobilegaming", "pcgaming", "twitch"],
  cricket: ["cricket", "cricketer", "psl", "pcb", "t20", "testcricket", "odi"],
  fashion: ["fashion", "ootd", "style", "outfit", "streetstyle", "menswear", "womenswear", "modelling", "model"],
  beauty: ["beauty", "makeup", "skincare", "cosmetics", "glam", "beautycare", "tutorial"],
  food: ["food", "foodie", "cooking", "recipe", "chef", "homecooking", "baking", "foodphotography", "khana"],
  fitness: ["fitness", "gym", "workout", "bodybuilding", "yoga", "health", "exercise", "diet"],
  travel: ["travel", "traveller", "wanderlust", "adventure", "explore", "tourism", "backpacker", "vlog"],
  lifestyle: ["lifestyle", "vlogger", "vlog", "daily", "dayinthelife"],
  finance: ["finance", "investing", "stockmarket", "crypto", "forex", "investment", "money", "business"],
  education: ["education", "learning", "teacher", "academia", "students", "knowledge", "tutorial", "howto"],
  comedy: ["comedy", "funny", "memes", "humor", "standup", "comedian"],
  music: ["music", "musician", "singer", "artist", "hiphop", "rap", "rnb", "producer", "dj"],
  photography: ["photography", "photographer", "photo", "portrait", "landscape", "streetphotography"],
  art: ["art", "artist", "drawing", "illustration", "digitalart", "design", "creative"],
  sports: ["sports", "football", "soccer", "basketball", "athletics", "running"],
  automotive: ["car", "cars", "automobile", "automotive", "supercars", "bikes", "motorcycles"],
  news: ["news", "journalism", "politics", "current", "affairs"],
};

/** Build reverse lookup: seed word → canonical niche tag */
const _SEED_TO_TAG = new Map<string, string>();
for (const [niche, seeds] of Object.entries(NICHE_SEEDS)) {
  for (const seed of seeds) {
    _SEED_TO_TAG.set(seed.toLowerCase(), niche);
  }
}

/** Strip punctuation and split to raw tokens */
function _tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** Normalise a single hashtag string (remove # prefix, lowercase) */
function _normalizeHashtag(tag: string): string {
  return tag.replace(/^#+/, "").toLowerCase().trim();
}

/**
 * Extract tags from a bio string.
 * Detects niche categories from keyword presence.
 *
 * @param bio - Raw bio text (English or Roman Urdu)
 * @returns Array of canonical niche tags, max MAX_TAGS
 */
export function extractTagsFromBio(bio: string | null | undefined): string[] {
  if (!bio || bio.trim().length === 0) return [];

  const tokens = _tokenize(bio);
  const found = new Set<string>();

  for (const token of tokens) {
    const tag = _SEED_TO_TAG.get(token);
    if (tag) found.add(tag);
    if (found.size >= MAX_TAGS) break;
  }

  return Array.from(found).slice(0, MAX_TAGS);
}

/**
 * Extract tags from a raw hashtag list string (e.g. "#tech #food #fitness").
 * Handles both space-separated and comma-separated formats.
 *
 * @param hashtagText - Raw hashtag string from profile
 * @returns Array of canonical niche tags, max MAX_TAGS
 */
export function extractTagsFromHashtags(hashtagText: string | null | undefined): string[] {
  if (!hashtagText || hashtagText.trim().length === 0) return [];

  const parts = hashtagText
    .split(/[\s,;|]+/)
    .map(_normalizeHashtag)
    .filter((t) => t.length >= 2);

  const found = new Set<string>();

  for (const part of parts) {
    const known = _SEED_TO_TAG.get(part);
    if (known) {
      found.add(known);
    } else if (part.length <= 24) {
      // Keep raw hashtag if it's short enough to be a real topic tag
      found.add(part);
    }
    if (found.size >= MAX_TAGS) break;
  }

  return Array.from(found).slice(0, MAX_TAGS);
}

/**
 * Merge bio tags and hashtag tags into one deduplicated list.
 */
export function buildCreatorTagProfile(
  bio: string | null | undefined,
  hashtags: string | null | undefined
): string[] {
  const merged = new Set([...extractTagsFromBio(bio), ...extractTagsFromHashtags(hashtags)]);
  return Array.from(merged).slice(0, MAX_TAGS);
}
