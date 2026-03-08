/**
 * src/modules/search/geo_intelligence.ts
 *
 * Location Intelligence Layer — confidence-scored city detection from
 * raw creator location strings found in profile bios and "location" fields.
 *
 * Problem: Pakistan creator profiles write cities in many ways:
 *   "karachi", "KHI", "Karachi, PK", "Krachi", "city of lights"
 *   Roman Urdu: "Lahore say hoon", "ISB main rehta hun"
 *   Urdu script: "کراچی", "لاہور", "اسلام آباد"
 *
 * Design rules:
 *  - confidence < 0.70 → uncertain = true → caller must show "Location data uncertain"
 *  - NEVER guess a city from insufficient evidence
 *  - NEVER fabricate a city match — unknown strings return uncertain
 *  - Score is deterministic and auditable (no ML, no fuzzy guessing)
 */

export interface GeoIntelligenceResult {
  /** Canonical English city name, e.g. "Karachi" */
  city: string | null;
  /** Confidence score ∈ [0, 1] */
  confidence: number;
  /** If true, caller MUST display "Location data uncertain" */
  uncertain: boolean;
  /** The match strategy that produced this result */
  matchStrategy: "exact" | "alias" | "roman_urdu" | "urdu_script" | "partial" | "none";
}

/** Extended city alias map — includes every common variant, typo, slang */
const CITY_GEO_MAP: Record<string, { confidence: number; aliases: string[] }> = {
  Karachi: {
    confidence: 1.0,
    aliases: [
      "karachi", "khi", "karachite", "karachiite", "city of lights",
      "mini pakistan", "کراچی", "krachi", "karaci", "karrachi",
      "karachi pk", "karachi pakistan", "karachii",
    ],
  },
  Lahore: {
    confidence: 1.0,
    aliases: [
      "lahore", "lhr", "lahori", "لاہور", "lahore pk", "lahore pakistan",
      "city of gardens", "dil dil pakistan lahore", "lahoree", "lahor",
    ],
  },
  Islamabad: {
    confidence: 1.0,
    aliases: [
      "islamabad", "isb", "islamabadi", "اسلام آباد", "islamabad pk",
      "federal capital", "capital city", "islamabad capital territory", "ict",
    ],
  },
  Rawalpindi: {
    confidence: 1.0,
    aliases: [
      "rawalpindi", "pindi", "rwp", "راولپنڈی", "rawalpindi pk",
      "pindi bhattian", "rawалпинди",
    ],
  },
  Faisalabad: {
    confidence: 1.0,
    aliases: [
      "faisalabad", "fsd", "lyallpur", "فیصل آباد", "faisalabad pk",
      "manchester of pakistan", "faisalabadi", "faisalabad pakistan",
    ],
  },
  Multan: {
    confidence: 1.0,
    aliases: [
      "multan", "multani", "ملتان", "multan pk", "city of saints",
      "city of sufi", "mtn", "multan pakistan",
    ],
  },
  Peshawar: {
    confidence: 1.0,
    aliases: [
      "peshawar", "pesh", "peshawari", "پشاور", "peshawar pk",
      "پشاور پاکستان", "peshawer", "peshawar kpk",
    ],
  },
  Quetta: {
    confidence: 1.0,
    aliases: [
      "quetta", "کوئٹہ", "quetta pk", "queta", "quetta balochistan",
    ],
  },
  Hyderabad: {
    confidence: 1.0,
    aliases: [
      "hyderabad", "hyd", "حیدر آباد", "hyderabad pk", "hyderabad sindh",
      "hyderabad pakistan",
    ],
  },
  Sialkot: {
    confidence: 1.0,
    aliases: [
      "sialkot", "سیالکوٹ", "sialkot pk", "sialkot pakistan",
    ],
  },
  Gujranwala: {
    confidence: 1.0,
    aliases: [
      "gujranwala", "گوجرانوالہ", "gujranwala pk", "gwl",
    ],
  },
  Bahawalpur: {
    confidence: 1.0,
    aliases: [
      "bahawalpur", "بہاولپور", "bwp", "bahawalpur pk",
    ],
  },
  Sargodha: {
    confidence: 1.0,
    aliases: [
      "sargodha", "سرگودھا", "sargodha pk",
    ],
  },
  Abbottabad: {
    confidence: 1.0,
    aliases: [
      "abbottabad", "ایبٹ آباد", "abbotabad", "abbotabbad", "abbottabad kpk",
    ],
  },
  Gujrat: {
    confidence: 1.0,
    aliases: [
      "gujrat", "گجرات", "gujrat pk",
    ],
  },
  Sukkur: {
    confidence: 1.0,
    aliases: [
      "sukkur", "سکھر", "sukkur sindh",
    ],
  },
  Larkana: {
    confidence: 1.0,
    aliases: [
      "larkana", "لاڑکانہ", "larkana sindh",
    ],
  },
  Mardan: {
    confidence: 1.0,
    aliases: [
      "mardan", "مردان", "mardan kpk",
    ],
  },
};

/** Roman Urdu city phrases that strongly imply a city */
const ROMAN_URDU_CITY_PHRASES: Record<string, string> = {
  "karachi say": "Karachi",
  "karachi main": "Karachi",
  "karachi mein": "Karachi",
  "karachi wala": "Karachi",
  "karachi wali": "Karachi",
  "lahore say": "Lahore",
  "lahore main": "Lahore",
  "lahore mein": "Lahore",
  "lahore wala": "Lahore",
  "lahore wali": "Lahore",
  "isb say": "Islamabad",
  "islamabad say": "Islamabad",
  "islamabad main": "Islamabad",
  "pindi say": "Rawalpindi",
  "pindi main": "Rawalpindi",
  "faisalabad main": "Faisalabad",
  "faisalabad say": "Faisalabad",
  "multan say": "Multan",
  "multan main": "Multan",
  "peshawar say": "Peshawar",
  "peshawar main": "Peshawar",
};

/** Build flat alias → city lookup at module init (O(n) once, O(1) per lookup) */
const _ALIAS_LOOKUP = new Map<string, { city: string; baseConfidence: number }>();
for (const [city, data] of Object.entries(CITY_GEO_MAP)) {
  for (const alias of data.aliases) {
    _ALIAS_LOOKUP.set(alias.toLowerCase().trim(), {
      city,
      baseConfidence: data.confidence,
    });
  }
}

function _normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Detect a Pakistani city from a raw location string with confidence scoring.
 *
 * @param rawLocation - Creator's location string (bio, location field, etc.)
 * @returns GeoIntelligenceResult — always set, uncertain=true when confidence < 0.70
 */
export function detectLocationCity(rawLocation: string | null | undefined): GeoIntelligenceResult {
  const UNCERTAIN: GeoIntelligenceResult = {
    city: null,
    confidence: 0,
    uncertain: true,
    matchStrategy: "none",
  };

  if (!rawLocation || rawLocation.trim().length === 0) return UNCERTAIN;

  const norm = _normalize(rawLocation);

  // 1. Exact match on alias list (highest confidence)
  const exact = _ALIAS_LOOKUP.get(norm);
  if (exact) {
    return { city: exact.city, confidence: exact.baseConfidence, uncertain: false, matchStrategy: "exact" };
  }

  // 2. Roman Urdu phrase match (high confidence phrases)
  for (const [phrase, city] of Object.entries(ROMAN_URDU_CITY_PHRASES)) {
    if (norm.includes(phrase)) {
      return { city, confidence: 0.88, uncertain: false, matchStrategy: "roman_urdu" };
    }
  }

  // 3. Alias substring within the location string
  //    e.g. "Based in Karachi 🇵🇰" → match "karachi"
  //    Confidence reduced slightly because surrounding text might mislead
  let bestAlias: { city: string; confidence: number } | null = null;
  for (const [alias, data] of _ALIAS_LOOKUP.entries()) {
    // Only use aliases ≥ 4 chars to avoid false positives ("hyd" in "hyderabad")
    if (alias.length < 4) continue;
    if (norm.includes(alias)) {
      const conf = data.baseConfidence * 0.92; // slight reduction for substring
      if (!bestAlias || conf > bestAlias.confidence) {
        bestAlias = { city: data.city, confidence: conf };
      }
    }
  }
  if (bestAlias) {
    const uncertain = bestAlias.confidence < 0.70;
    return {
      city: bestAlias.city,
      confidence: Math.round(bestAlias.confidence * 1000) / 1000,
      uncertain,
      matchStrategy: "alias",
    };
  }

  // 4. Partial token match — last resort, low confidence
  //    Levenshtein-like: if a token within rawLocation starts with a city prefix
  const tokens = norm.split(/[\s,|/\\()]+/).filter((t) => t.length >= 4);
  for (const token of tokens) {
    for (const [alias, data] of _ALIAS_LOOKUP.entries()) {
      if (alias.length >= 5 && (alias.startsWith(token) || token.startsWith(alias.slice(0, 5)))) {
        const conf = data.baseConfidence * 0.65; // partial — low confidence
        if (conf >= 0.50) {
          return {
            city: data.city,
            confidence: Math.round(conf * 1000) / 1000,
            uncertain: true, // 0.65 < 0.70 threshold
            matchStrategy: "partial",
          };
        }
      }
    }
  }

  return UNCERTAIN;
}

/**
 * Match a creator's location against a query's target city.
 *
 * @param rawLocation - Creator's raw location string
 * @param queryCity   - Canonical city name to match against (e.g. "Karachi")
 * @returns Score ∈ [0, 1] — 0 = no match or uncertain
 */
export function computeLocationScore(rawLocation: string | null | undefined, queryCity: string | null): number {
  if (!queryCity || !rawLocation) return 0;

  const result = detectLocationCity(rawLocation);
  if (result.uncertain || !result.city) return 0;
  if (result.city.toLowerCase() === queryCity.toLowerCase()) return result.confidence;
  return 0;
}
