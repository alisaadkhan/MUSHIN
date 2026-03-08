/**
 * _shared/geo.ts
 *
 * Geography module — Pakistani city extraction used across multiple
 * edge functions. Centralised here so any city alias update applies
 * everywhere automatically.
 *
 * Consumers: search-influencers, enrich-influencer
 */

/** Canonical city → list of aliases / abbreviations used on social media. */
export const PAKISTAN_CITIES: Record<string, string[]> = {
  Lahore: ["lahore", "lhr", "lahori"],
  Karachi: ["karachi", "khi", "karachite"],
  Islamabad: ["islamabad", "isb", "islamabadi"],
  Rawalpindi: ["rawalpindi", "pindi", "rwp"],
  Peshawar: ["peshawar", "pesh", "peshawari"],
  Multan: ["multan", "multani"],
  Faisalabad: ["faisalabad", "lyallpur", "fsd"],
  Quetta: ["quetta"],
  Hyderabad: ["hyderabad", "hyd"],
  Sialkot: ["sialkot"],
  Gujranwala: ["gujranwala"],
};

/**
 * Flat list of Pakistani city names for quick bio scanning.
 * Kept in sync with PAKISTAN_CITIES — multi-word cities are included
 * as full phrases so partial matches don't fire.
 */
export const PK_CITIES: string[] = [
  "karachi", "lahore", "islamabad", "rawalpindi", "faisalabad", "multan",
  "peshawar", "quetta", "sialkot", "gujranwala", "hyderabad", "bahawalpur",
  "sargodha", "sukkur", "larkana", "sheikhupura", "jhang", "rahim yar khan",
  "gujrat", "kasur", "mardan", "mingora", "nawabshah", "mirpur", "okara",
  "abbottabad", "mansehra", "attock", "jhelum", "chakwal", "muzaffarabad",
];

/**
 * Extract a canonical Pakistani city name from a block of combined text
 * and the search query string.  Uses whole-word matching against
 * `PAKISTAN_CITIES` aliases.
 *
 * Used by: search-influencers (result cards)
 */
export function extractCity(text: string, query: string): string | null {
  const combined = `${text} ${query}`.toLowerCase();
  for (const [canonical, keywords] of Object.entries(PAKISTAN_CITIES)) {
    for (const kw of keywords) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(combined)) return canonical;
    }
  }
  return null;
}

/**
 * Extract a canonical city from a free-text bio string.
 * Uses the broader `PK_CITIES` flat list with word-boundary enforcement.
 *
 * Used by: enrich-influencer (bio fields), extract-brand-mentions (future)
 */
export function extractCityFromBio(bio: string): string | null {
  if (!bio) return null;
  const lower = bio.toLowerCase();
  for (const city of PK_CITIES) {
    const idx = lower.indexOf(city);
    if (idx === -1) continue;
    const before = idx > 0 ? lower[idx - 1] : " ";
    const after = idx + city.length < lower.length ? lower[idx + city.length] : " ";
    // Skip if surrounded by word characters (avoids partial matches)
    if (/\w/.test(before) || /\w/.test(after)) continue;
    return city
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return null;
}
