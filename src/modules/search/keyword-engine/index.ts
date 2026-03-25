/**
 * Keyword Engine — query expansion, tokenisation, and synonym utilities.
 *
 * This module is the client-side mirror of supabase/functions/_shared/query_expander.ts.
 * It provides the same expansion logic for UI-side query suggestions and
 * for generating preview variants without hitting the edge function.
 *
 * The actual Serper calls and multi-variant merging happen server-side.
 * This module is used for:
 *   - Suggest chips shown before a search (e.g. "Try: tech review Karachi")
 *   - Analytics display of which variant produced results
 *   - Unit-testable expansion logic (no network required)
 */

// Re-export hooks consumed by this sub-domain
export { useSavedSearches } from "@/hooks/useSavedSearches";
export { useSearchHistory } from "@/hooks/useSearchHistory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueryVariantStrategy =
  | "primary"
  | "site_operator"
  | "synonym"
  | "urdu_expansion";

export interface QueryVariant {
  query: string;
  strategy: QueryVariantStrategy;
  /** Relative weight when scoring results from this variant [0, 1]. */
  weight: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_DOMAINS: Record<string, string> = {
  youtube:   "youtube.com",
  instagram: "instagram.com",
  tiktok:    "tiktok.com",
};

const CREATOR_SYNONYMS: Record<string, string[]> = {
  youtube:   ["youtuber", "vlogger", "channel", "creator"],
  instagram: ["blogger", "content creator", "creator"],
  tiktok:    ["tiktoker", "creator", "content creator"],
};

export const NICHE_SITE_KEYWORDS: Record<string, string[]> = {
  Food:        ['"food blogger"', '"food vlog"', '"recipe"', '"street food"'],
  Fashion:     ['"fashion blogger"', '"outfit"', '"ootd"'],
  Beauty:      ['"beauty"', '"makeup tutorial"', '"skincare"'],
  Tech:        ['"tech review"', '"unboxing"', '"gadget"'],
  Gaming:      ['"gaming"', '"gameplay"', '"pubg"'],
  Fitness:     ['"fitness"', '"workout"', '"gym"'],
  Travel:      ['"travel vlog"', '"travel blogger"'],
  Education:   ['"tutorial"', '"learn"', '"course"'],
  Lifestyle:   ['"vlog"', '"lifestyle"', '"daily vlog"'],
  Music:       ['"singer"', '"music"', '"ost"'],
  Comedy:      ['"funny"', '"comedy"', '"prank"'],
  Cricket:     ['"cricket"', '"psl"'],
  Finance:     ['"finance"', '"investment"'],
  Health:      ['"health"', '"wellness"', '"nutrition"'],
  Photography: ['"photography"', '"photographer"'],
  Art:         ['"art"', '"artist"'],
  Sports:      ['"sports"', '"athlete"'],
  News:        ['"news"', '"journalist"'],
  Automotive:  ['"cars"', '"auto review"'],
  General:     ['"influencer"', '"content creator"'],
};

const NICHE_URDU_TERMS: Record<string, string[]> = {
  Food:      ["khana", "recipe Pakistani"],
  Fashion:   ["fashion Pakistani", "style Pakistan"],
  Beauty:    ["beauty Pakistan", "makeup Pakistan"],
  Tech:      ["technology Pakistan", "tech review Pakistan"],
  Gaming:    ["gaming Pakistan", "pubg Pakistan"],
  Fitness:   ["fitness Pakistan", "gym Pakistan"],
  Travel:    ["travel Pakistan", "safar Pakistan"],
  Education: ["education Pakistan", "tutorial Pakistan"],
  Lifestyle: ["lifestyle Pakistan", "Pakistani vlogger"],
  Music:     ["music Pakistan", "Pakistani singer"],
  Comedy:    ["comedy Pakistan", "funny Pakistani"],
  Cricket:   ["cricket Pakistan", "psl Pakistan"],
};

// ---------------------------------------------------------------------------
// Core expansion function (client-side mirror of _shared/query_expander.ts)
// ---------------------------------------------------------------------------

/**
 * Generate an ordered list of Serper query variants for a creator search.
 * Mirrors the server-side logic in `_shared/query_expander.ts`.
 *
 * @param query         Sanitised user query string.
 * @param platform      "youtube" | "instagram" | "tiktok"
 * @param city          Optional city (e.g. "Lahore"), or "" for none.
 * @param detectedNiche Optional niche (e.g. "Tech"). Defaults to "General".
 */
export function expandSerperQueries(
  query: string,
  platform: string,
  city = "",
  detectedNiche = "General",
): QueryVariant[] {
  const domain = PLATFORM_DOMAINS[platform] ?? "";
  const cityPart = city && city !== "All Pakistan" ? city : "";
  const synonyms = CREATOR_SYNONYMS[platform] ?? ["creator"];

  const variants: QueryVariant[] = [];

  // Primary
  const primaryParts = [query, platform, "influencer", "Pakistani", cityPart, "Pakistan"]
    .filter(Boolean);
  variants.push({ query: primaryParts.join(" ").trim(), strategy: "primary", weight: 1.0 });

  // Synonym expansion
  const synParts = [query, platform, synonyms.join(" "), cityPart, "Pakistan"].filter(Boolean);
  variants.push({ query: synParts.join(" ").trim(), strategy: "synonym", weight: 0.85 });

  // Site operator
  if (domain) {
    const nicheKws = NICHE_SITE_KEYWORDS[detectedNiche] ?? NICHE_SITE_KEYWORDS["General"];
    const keyword = nicheKws[0] ?? '"influencer"';
    const siteParts = [`site:${domain}`, keyword, cityPart, "Pakistan"].filter(Boolean);
    variants.push({ query: siteParts.join(" ").trim(), strategy: "site_operator", weight: 0.90 });
  }

  // Urdu/Roman-Urdu expansion
  const urduTerms = NICHE_URDU_TERMS[detectedNiche];
  if (urduTerms) {
    const urduParts = [urduTerms[0], platform, cityPart].filter(Boolean);
    variants.push({ query: urduParts.join(" ").trim(), strategy: "urdu_expansion", weight: 0.75 });
  }

  return variants;
}

/**
 * Build a human-readable suggestion string for UI chips.
 * Example: "Try: site:youtube.com \"tech review\" Karachi Pakistan"
 */
export function buildQuerySuggestion(variant: QueryVariant): string {
  return `Try: ${variant.query}`;
}

/**
 * Extract all unique query strings from a variants array.
 */
export function extractQueryStrings(variants: QueryVariant[]): string[] {
  return [...new Set(variants.map(v => v.query))];
}

// ---------------------------------------------------------------------------
// Email extraction (client-side utility for displaying extracted emails)
// ---------------------------------------------------------------------------

/**
 * Extract the first contact email found in a text blob.
 * Used to display emails on search result cards when they appear in snippets.
 */
export function extractContactEmail(text: string): string | null {
  if (!text) return null;
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const BLOCKLIST = new Set(["noreply", "no-reply", "support", "info", "hello", "contact"]);
  const matches = text.match(EMAIL_RE);
  if (!matches) return null;
  for (const m of matches) {
    const localPart = m.split("@")[0].toLowerCase();
    if (BLOCKLIST.has(localPart)) continue;
    if (m.toLowerCase().endsWith(".png") || m.toLowerCase().endsWith(".jpg")) continue;
    return m;
  }
  return null;
}
