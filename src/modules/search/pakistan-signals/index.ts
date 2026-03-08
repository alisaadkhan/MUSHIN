// Pakistan Signals — Pakistan-specific market intelligence for search ranking.
//
// Covers:
//   - Roman-Urdu / Urdu / English query expansion
//   - City detection from query text
//   - Niche detection from query text
//   - Bot risk scoring for audience authenticity
//   - Location boost computation

// ---------------------------------------------------------------------------
// Bilingual equivalence table
// ---------------------------------------------------------------------------

/**
 * Roman-Urdu ↔ Urdu ↔ English equivalence for Pakistani creator niches.
 *
 * Usage: when a user searches "beauty bloggers Karachi" or
 * "بیوٹی Karachi", both map to the same niche and expand the FTS coverage.
 */
export const URDU_ROMAN_EQUIVALENTS: Record<string, string[]> = {
  fashion:   ["فیشن", "فیشون", "style", "ootd", "clothing", "wear"],
  tech:      ["ٹیک", "ٹیکنالوجی", "technology", "gadget", "review", "unboxing", "tech review"],
  beauty:    ["بیوٹی", "خوبصورتی", "makeup", "skincare", "glam", "cosmetics"],
  food:      ["کھانا", "کھانے", "کھانا پکانا", "foodie", "recipe", "cooking", "chef"],
  fitness:   ["فٹنس", "صحت", "gym", "workout", "exercise", "health", "trainer"],
  travel:    ["سفر", "ٹریول", "trip", "explore", "tourism", "adventure", "wanderlust"],
  gaming:    ["گیمنگ", "گیمر", "pubg", "free fire", "esports", "valorant", "gameplay"],
  education: ["تعلیم", "ایجوکیشن", "tutorial", "learn", "course", "study"],
  lifestyle: ["لائف اسٹائل", "زندگی", "vlog", "daily life", "روزمرہ"],
  music:     ["موسیقی", "گانا", "گانے", "میوزک", "singer", "rap", "ost", "musician"],
  comedy:    ["مزاح", "مزاحیہ", "funny", "humor", "prank", "skit", "roast"],
  cricket:   ["کرکٹ", "psl", "pcb", "pakistan cricket"],
};

// ---------------------------------------------------------------------------
// City data
// ---------------------------------------------------------------------------

/** Pakistani cities ranked by influencer market density. */
export const PAKISTAN_CITIES_RANKED: string[] = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Hyderabad",
  "Sialkot",
  "Gujranwala",
  "Bahawalpur",
  "Sargodha",
  "Abbottabad",
];

/** City aliases used in social media bios (lowercase for matching). */
const CITY_ALIASES: Record<string, string[]> = {
  Karachi:    ["karachi", "khi", "karachite", "کراچی"],
  Lahore:     ["lahore", "lhr", "lahori", "لاہور"],
  Islamabad:  ["islamabad", "isb", "islamabadi", "اسلام آباد"],
  Rawalpindi: ["rawalpindi", "pindi", "rwp", "راولپنڈی"],
  Faisalabad: ["faisalabad", "fsd", "lyallpur", "فیصل آباد"],
  Multan:     ["multan", "multani", "ملتان"],
  Peshawar:   ["peshawar", "pesh", "peshawari", "پشاور"],
  Quetta:     ["quetta", "کوئٹہ"],
  Hyderabad:  ["hyderabad", "hyd", "حیدر آباد"],
  Sialkot:    ["sialkot", "سیالکوٹ"],
  Gujranwala: ["gujranwala", "گوجرانوالہ"],
  Bahawalpur: ["bahawalpur", "بہاولپور"],
  Abbottabad: ["abbottabad", "ایبٹ آباد"],
};

// ---------------------------------------------------------------------------
// Query expansion
// ---------------------------------------------------------------------------

/**
 * Expand a search query to include Roman-Urdu and Urdu equivalents.
 *
 * If the user types "fashion influencers Lahore", this returns:
 * "fashion influencers Lahore فیشن فیشون style ootd clothing wear"
 *
 * The expanded string is used for broader text matching only — not displayed.
 */
export function expandQueryTerms(query: string): string {
  const lower = query.toLowerCase();
  const extras = new Set<string>();

  for (const [primary, aliases] of Object.entries(URDU_ROMAN_EQUIVALENTS)) {
    const allTerms = [primary, ...aliases];
    if (allTerms.some((t) => lower.includes(t.toLowerCase()))) {
      for (const alias of allTerms) {
        if (!lower.includes(alias.toLowerCase())) extras.add(alias);
      }
    }
  }

  return extras.size > 0 ? `${query} ${[...extras].join(" ")}` : query;
}

// ---------------------------------------------------------------------------
// City & niche detection
// ---------------------------------------------------------------------------

/**
 * Detect a canonical Pakistani city from free-text query.
 *
 * Example: "tech reviewers karachi" → "Karachi"
 */
export function detectQueryCity(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    for (const alias of aliases) {
      if (lower.includes(alias.toLowerCase())) return canonical;
    }
  }
  return null;
}

/**
 * Detect the primary niche from a search query string.
 *
 * Covers English, Roman-Urdu, and Urdu terms.
 * Returns canonical English niche (e.g. "fashion", "tech") or null.
 *
 * Examples:
 *   "beauty bloggers Karachi" → "beauty"
 *   "gaming streamers Urdu"   → "gaming"
 *   "فیشن influencers Lahore" → "fashion"
 */
export function detectQueryNiche(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [niche, aliases] of Object.entries(URDU_ROMAN_EQUIVALENTS)) {
    const allTerms = [niche, ...aliases];
    if (allTerms.some((t) => lower.includes(t.toLowerCase()))) return niche;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Location boost
// ---------------------------------------------------------------------------

/**
 * Compute a location-based ranking boost [0, 1].
 *
 *   1.0 — creator city matches the query city
 *   0.5 — no city filter active (neutral)
 *   0.25 — filter active but creator city unknown
 *   0.2  — cities present but mismatched
 */
export function computeLocationBoost(
  creatorCity: string | null,
  queryCity: string | null,
): number {
  if (!queryCity)    return 0.50;
  if (!creatorCity)  return 0.25;
  return creatorCity.toLowerCase() === queryCity.toLowerCase() ? 1.0 : 0.20;
}

// ---------------------------------------------------------------------------
// Audience authenticity
// ---------------------------------------------------------------------------

/**
 * Rule-based bot risk score [0, 1] for audience authenticity.
 *
 * Higher score = stronger evidence of fraudulent audience.
 * Only meaningful when real (non-estimated) engagement data is available.
 *
 * Signals:
 *   - Large following with engagement below platform floor        → +0.30
 *   - Very large following with engagement at critical low point  → +0.25
 *   - Engagement rate below absolute minimum (0.3 %)             → +0.20
 */
export function computeBotRisk(
  engagementRate: number | null,
  followerCount: number | null,
  platform: string,
  isRealEngagement: boolean,
): number {
  if (!isRealEngagement || engagementRate == null || followerCount == null) return 0;

  const floors: Record<string, number> = {
    instagram: 0.50,
    tiktok:    1.20,
    youtube:   0.40,
  };
  const floor = floors[platform] ?? 0.50;

  let risk = 0;
  if (followerCount > 50_000  && engagementRate < floor)         risk += 0.30;
  if (followerCount > 200_000 && engagementRate < floor * 0.60)  risk += 0.25;
  if (engagementRate < 0.30)                                     risk += 0.20;
  return Math.min(1, risk);
}
