/**
 * _shared/language.ts
 *
 * Language detection and query normalization for Mushin search.
 *
 * Detects:
 *   - "urdu"      — Arabic-script Urdu (U+0600–U+06FF block)
 *   - "roman-urdu"— Latin-script Urdu vocabulary (aap, hai, kya, nahi …)
 *   - "english"   — default for everything else
 *
 * Normalization:
 *   - Collapses common Pakistani name spelling variants (Hira/Hera/Heera → hira)
 *   - Roman-Urdu phonetic canonicalization (ph→f, kh→k, etc.)
 *   - Strip diacritics via simple character map
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DetectedLanguage = "english" | "urdu" | "roman-urdu";

export interface LanguageAnalysis {
  language: DetectedLanguage;
  confidence: number; // 0–1
  /** Query after normalization (safe to use downstream). */
  normalizedQuery: string;
  /** Whether the query contains Urdu Unicode characters. */
  hasUrduScript: boolean;
}

// ---------------------------------------------------------------------------
// Urdu Unicode block detection
// ---------------------------------------------------------------------------

const URDU_RANGE_START = 0x0600;
const URDU_RANGE_END = 0x06ff;

function countUrduChars(text: string): number {
  let count = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= URDU_RANGE_START && cp <= URDU_RANGE_END) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Roman-Urdu vocabulary heuristics
// ---------------------------------------------------------------------------

/**
 * High-frequency Roman-Urdu words that reliably distinguish from English.
 * Single characters and extremely short tokens are excluded to reduce
 * false positives on English text.
 */
const ROMAN_URDU_MARKERS: ReadonlyArray<string> = [
  // Pronouns / common verbs
  "aap", "hum", "yeh", "woh", "kya", "hai", "hain", "nahi", "nahin",
  "kaise", "kyun", "kaisa", "kaisi", "kab", "kahan", "kaun",
  // Common phrases
  "mashallah", "subhanallah", "alhamdulillah", "inshallah",
  "bhai", "yaar", "dost", "sahab", "chalo", "theek", "bilkul",
  // Food / lifestyle
  "biryani", "karahi", "paratha", "roti", "chai", "lassi",
  // Greetings
  "assalam", "walaikum", "salam", "khuda",
  // Cities (Roman forms are strong signals)
  "lahori", "karachiite", "isloo",
  // Content vocabulary
  "vlogs", "vlogger", "pakistani",
];

const ROMAN_URDU_PATTERN = new RegExp(
  `\\b(${ROMAN_URDU_MARKERS.join("|")})\\b`,
  "i",
);

// ---------------------------------------------------------------------------
// Name variant normalization map
// ---------------------------------------------------------------------------

/**
 * Maps spelling variants of common Pakistani given names to a canonical form.
 * Key: LOWERCASED variant. Value: canonical form (also lowercase).
 *
 * The table covers only unambiguous single-name variants.  Full-name matching
 * should tokenize first, normalize each token, then rejoin.
 */
const NAME_VARIANT_MAP: Readonly<Record<string, string>> = {
  // Hira
  hera: "hira", heera: "hira", heira: "hira",
  // Fatima
  fatema: "fatima", faatima: "fatima", fateema: "fatima",
  // Ayesha
  aisha: "ayesha", aysha: "ayesha", aaisha: "ayesha", aiesha: "ayesha",
  // Zainab
  zaynab: "zainab", zenab: "zainab", zainub: "zainab",
  // Amna
  amna: "amna",  // canonical; variants below:
  aamna: "amna",
  // Rabia
  robia: "rabia", rabiya: "rabia",
  // Mehwish
  mahwish: "mehwish", mehvish: "mehwish",
  // Hamza
  hamzah: "hamza",
  // Muhammad
  mohammad: "muhammad", mohammed: "muhammad", muhammed: "muhammad",
  mohamad: "muhammad",
  // Usman
  osman: "usman", uthman: "usman",
  // Ali
  // (no common misspellings; kept for completeness)
  // Hassan
  hasan: "hassan",
  // Hussain
  husain: "hussain", husayn: "hussain",
  // Zubair
  zubayr: "zubair",
  // Bilal
  billal: "bilal", bilaal: "bilal",
  // Noor
  nur: "noor", noura: "noor",
  // Sana
  // (unique; skip)
  // Mahnoor
  mahnur: "mahnoor", mahnour: "mahnoor",
  // Aroha / Arooha
  aruha: "aroha", arooha: "aroha",
};

// ---------------------------------------------------------------------------
// Roman-Urdu phonetic canonicalization
// ---------------------------------------------------------------------------

/**
 * Normalizes Roman-Urdu spelling variants at the character-cluster level.
 *
 * Rules (applied in order):
 *   "aa" long-a → "a"      (except "aa" as a specific name token → kept)
 *   "ph"        → "f"
 *   "kh"        → "k"      (beware of English words like "khaki")
 *   "gh"        → "g"
 *   "ch"        → "ch"     (already fine; skip)
 *   "ei"/"ai" mid-word → "e"  (e.g. "beichna" → "bechna")
 *   double consonants → single (e.g. "billal" → "bilal")
 *
 * This is applied ONLY to detected Roman-Urdu queries, not English.
 */
function canonicalizeRomanUrdu(text: string): string {
  return text
    .replace(/ph/gi, "f")
    .replace(/(?<![sc])kh/gi, "k")   // "kh" → "k" but not "sch", "ckh"
    .replace(/gh(?=[aeiou])/gi, "g") // "gh" before vowel → "g"
    .replace(/aa/gi, "a")            // long-a collapse
    .replace(/ee/gi, "i")            // long-i collapse
    .replace(/oo(?!n)/gi, "u")       // long-u collapse (keep "noon", "moon" etc.)
    .replace(/([bcdfghjklmnprstvwxyz])\1+/gi, "$1"); // double consonants
}

// ---------------------------------------------------------------------------
// Diacritic strip (basic ASCII-safe transliteration)
// ---------------------------------------------------------------------------

const DIACRITIC_MAP: Readonly<Record<string, string>> = {
  à: "a", á: "a", â: "a", ä: "a", ã: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", ö: "o", õ: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ñ: "n", ç: "c",
};

function stripDiacritics(text: string): string {
  return text
    .split("")
    .map((ch) => DIACRITIC_MAP[ch] ?? ch)
    .join("");
}

// ---------------------------------------------------------------------------
// Name token normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a single name token using the variant map.
 * Works on one word at a time (caller tokenizes first).
 */
function normalizeNameToken(token: string): string {
  const lower = token.toLowerCase().trim();
  return NAME_VARIANT_MAP[lower] ?? lower;
}

/**
 * Normalize a full name (space-separated) by normalizing each token.
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(normalizeNameToken)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the language of a search query and return analysis + normalized form.
 *
 * Detection priority:
 *   1. Urdu Unicode characters → "urdu"
 *   2. Roman-Urdu vocabulary markers → "roman-urdu"
 *   3. Default → "english"
 */
export function analyzeLanguage(query: string): LanguageAnalysis {
  const trimmed = query.trim();
  const totalChars = [...trimmed].filter((c) => c.trim()).length;

  const urduCount = countUrduChars(trimmed);
  const hasUrduScript = urduCount > 0;

  if (hasUrduScript) {
    const urduRatio = urduCount / Math.max(totalChars, 1);
    return {
      language: "urdu",
      confidence: Math.min(1, urduRatio * 2), // ≥50% Urdu chars → confidence 1
      normalizedQuery: trimmed, // Urdu script: preserve as-is
      hasUrduScript: true,
    };
  }

  if (ROMAN_URDU_PATTERN.test(trimmed)) {
    const normalized = canonicalizeRomanUrdu(stripDiacritics(trimmed.toLowerCase()));
    return {
      language: "roman-urdu",
      confidence: 0.80, // marker match is high confidence
      normalizedQuery: normalized,
      hasUrduScript: false,
    };
  }

  // English (or unrecognized script → treat as English)
  const normalized = stripDiacritics(trimmed.toLowerCase());
  return {
    language: "english",
    confidence: 0.90,
    normalizedQuery: normalized,
    hasUrduScript: false,
  };
}

/**
 * Shorthand: normalize a query string regardless of language.
 * Returns the normalized string ready for downstream matching.
 */
export function normalizeQuery(query: string): string {
  return analyzeLanguage(query).normalizedQuery;
}

/**
 * Detect language only (no normalization overhead).
 */
export function detectLanguage(query: string): DetectedLanguage {
  return analyzeLanguage(query).language;
}
