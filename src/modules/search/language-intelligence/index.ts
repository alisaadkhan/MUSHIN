/**
 * src/modules/search/language-intelligence/index.ts
 *
 * Language detection and query normalization for the Mushin search pipeline.
 *
 * Detects three categories relevant to Pakistani influencer search:
 *   - "english"    — ASCII-dominant, no strong Urdu signal
 *   - "urdu"       — Arabic-script Urdu text
 *   - "roman-urdu" — Latin-script with Pakistani vocabulary markers
 *
 * Also provides name-clustering utilities to collapse common Pakistani name
 * spelling variants (Hira / Hera / Heera → "hira") so the same creator is
 * found regardless of the user's spelling preference.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DetectedLanguage = "english" | "urdu" | "roman-urdu";

export interface LanguageAnalysis {
  language: DetectedLanguage;
  /** Detection confidence [0, 1]. */
  confidence: number;
  /** Query normalised for downstream matching. */
  normalizedQuery: string;
  hasUrduScript: boolean;
}

// ---------------------------------------------------------------------------
// Urdu Unicode detection
// ---------------------------------------------------------------------------

function countUrduChars(text: string): number {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0600 && cp <= 0x06ff) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Roman-Urdu vocabulary markers
// ---------------------------------------------------------------------------

const ROMAN_URDU_MARKERS: readonly string[] = [
  "aap", "hum", "yeh", "woh", "kya", "hai", "hain", "nahi", "nahin",
  "kaise", "kyun", "kaisa", "kaisi", "kab", "kahan", "kaun",
  "mashallah", "subhanallah", "alhamdulillah", "inshallah",
  "bhai", "yaar", "dost", "sahab", "chalo", "theek", "bilkul",
  "biryani", "karahi", "paratha", "roti", "chai", "lassi",
  "assalam", "walaikum", "salam", "khuda",
  "lahori", "karachiite", "isloo",
  "vlogs", "vlogger", "pakistani",
];

const ROMAN_URDU_RE = new RegExp(
  `\\b(${ROMAN_URDU_MARKERS.join("|")})\\b`,
  "i",
);

// ---------------------------------------------------------------------------
// Pakistani name variant map
// ---------------------------------------------------------------------------

/**
 * Maps LOWERCASED spelling variants to a canonical lowercase form.
 * Purpose: ensure "Hira Baig", "Hera Baig", and "Heera Baig" all cluster.
 */
export const NAME_VARIANT_MAP: Readonly<Record<string, string>> = {
  // Hira
  hera: "hira", heera: "hira", heira: "hira",
  // Fatima
  fatema: "fatima", faatima: "fatima", fateema: "fatima",
  // Ayesha
  aisha: "ayesha", aysha: "ayesha", aaisha: "ayesha", aiesha: "ayesha",
  // Zainab
  zaynab: "zainab", zenab: "zainab", zainub: "zainab",
  // Amna
  aamna: "amna",
  // Rabia
  robia: "rabia", rabiya: "rabia",
  // Mehwish
  mahwish: "mehwish", mehvish: "mehwish",
  // Hamza
  hamzah: "hamza",
  // Muhammad
  mohammad: "muhammad", mohammed: "muhammad", muhammed: "muhammad", mohamad: "muhammad",
  // Usman
  osman: "usman", uthman: "usman",
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
  // Mahnoor
  mahnur: "mahnoor", mahnour: "mahnoor",
  // Aroha
  aruha: "aroha", arooha: "aroha",
};

// ---------------------------------------------------------------------------
// Diacritics
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
  return text.split("").map((ch) => DIACRITIC_MAP[ch] ?? ch).join("");
}

// ---------------------------------------------------------------------------
// Roman-Urdu phonetic canonicalization
// ---------------------------------------------------------------------------

function canonicalizeRomanUrdu(text: string): string {
  return text
    .replace(/ph/gi, "f")
    .replace(/(?<![sc])kh/gi, "k")
    .replace(/gh(?=[aeiou])/gi, "g")
    .replace(/aa/gi, "a")
    .replace(/ee/gi, "i")
    .replace(/oo(?!n)/gi, "u")
    .replace(/([bcdfghjklmnprstvwxyz])\1+/gi, "$1");
}

// ---------------------------------------------------------------------------
// Name normalisation
// ---------------------------------------------------------------------------

function normalizeNameToken(token: string): string {
  const lower = token.toLowerCase().trim();
  return NAME_VARIANT_MAP[lower] ?? lower;
}

/**
 * Normalize a full creator name by collapsing known spelling variants.
 *
 * @example
 *   normalizeName("Hera Baig") // → "hira baig"
 *   normalizeName("Mohammed Ali") // → "muhammad ali"
 */
export function normalizeName(name: string): string {
  return name.trim().split(/\s+/).map(normalizeNameToken).join(" ");
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * Analyse a query string for language and return a normalized form.
 *
 * Detection priority:
 *   1. Urdu Unicode chars → "urdu" (preserved as-is)
 *   2. Roman-Urdu vocabulary markers → "roman-urdu" (phonetically canonicalized)
 *   3. Default → "english" (diacritics stripped + lowercased)
 */
export function analyzeLanguage(query: string): LanguageAnalysis {
  const trimmed   = query.trim();
  const totalChars = [...trimmed].filter((c) => c.trim()).length || 1;
  const urduCount  = countUrduChars(trimmed);

  if (urduCount > 0) {
    const confidence = Math.min(1, (urduCount / totalChars) * 2);
    return {
      language: "urdu",
      confidence,
      normalizedQuery: trimmed,
      hasUrduScript: true,
    };
  }

  if (ROMAN_URDU_RE.test(trimmed)) {
    return {
      language: "roman-urdu",
      confidence: 0.80,
      normalizedQuery: canonicalizeRomanUrdu(stripDiacritics(trimmed.toLowerCase())),
      hasUrduScript: false,
    };
  }

  return {
    language: "english",
    confidence: 0.90,
    normalizedQuery: stripDiacritics(trimmed.toLowerCase()),
    hasUrduScript: false,
  };
}

/** Detect language only (no normalization overhead). */
export function detectLanguage(query: string): DetectedLanguage {
  return analyzeLanguage(query).language;
}

/**
 * Return the normalized query string ready for downstream matching.
 * Applies name variant collapsing + phonetic canonicalization.
 */
export function normalizeQuery(query: string): string {
  const { normalizedQuery, language } = analyzeLanguage(query);
  // Apply name-variant normalization to English and Roman-Urdu queries
  if (language !== "urdu") {
    const tokens = normalizedQuery.split(/\s+/);
    return tokens.map(normalizeNameToken).join(" ");
  }
  return normalizedQuery;
}
