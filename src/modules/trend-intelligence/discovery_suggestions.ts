/**
 * src/modules/trend-intelligence/discovery_suggestions.ts
 *
 * Autonomous Discovery Suggestions — predictive recommendation engine.
 *
 * Generates dashboard recommendations:
 *   - Trending niches (from curated market index)
 *   - Brand campaign opportunities (from niche–vertical compat)
 *
 * Design invariants:
 *   - NEVER fabricates creator data or contact details
 *   - All suggestions are derived from curated static indices
 *   - confidence always set — caller MUST hide suggestions with confidence < 0.65
 *   - source_verified and data_origin always present
 */

import { getRisingNiches, getDecliningNiches, getNicheTrendData } from "./niche_popularity_forecast";

export interface DiscoverySuggestion {
  type: "niche_opportunity" | "brand_opportunity" | "niche_alert";
  title: string;
  reason: string;
  confidence: number;
  sourceVerified: boolean;
  dataOrigin: "curated_market_index";
}

export interface DiscoveryContext {
  /** Primary niche the brand/user works in */
  userNiche?: string | null;
  /** Brand vertical for campaign planning */
  userBrandVertical?: string | null;
  /** Niches from recent user searches */
  recentSearchNiches?: string[];
}

// ---------------------------------------------------------------------------
// Niche → compatible brand verticals (for opportunity suggestions)
// ---------------------------------------------------------------------------
const NICHE_BRAND_VERTICALS: Record<string, string[]> = {
  ai:          ["tech", "software", "education", "finance"],
  tech:        ["electronics", "software", "finance", "telecom"],
  gaming:      ["gaming", "electronics", "energy", "tech"],
  cricket:     ["sports", "fitness", "energy", "telecom"],
  finance:     ["finance", "insurance", "tech", "real-estate"],
  fitness:     ["health", "nutrition", "sports", "wellness"],
  food:        ["food", "beverage", "restaurant", "kitchen"],
  beauty:      ["skincare", "beauty", "fashion", "wellness"],
  fashion:     ["fashion", "luxury", "retail", "lifestyle"],
  education:   ["education", "publishing", "tech", "finance"],
  comedy:      ["entertainment", "food", "beverage", "telecom"],
  travel:      ["hospitality", "automotive", "finance", "travel"],
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate discovery suggestions based on a user/brand context.
 *
 * Returns suggestions for:
 *  - Rising niches the user should target
 *  - Brand campaign opportunities based on their niche/vertical
 *  - Declining niche alerts (avoid over-investing)
 */
export function generateDiscoverySuggestions(
  context: DiscoveryContext,
  options: { maxSuggestions?: number } = {},
): DiscoverySuggestion[] {
  const maxSuggestions = options.maxSuggestions ?? 8;
  const suggestions: DiscoverySuggestion[] = [];

  // ── 1. Rising niche opportunities ─────────────────────────────────────────
  const risingNiches = getRisingNiches(5);
  for (const niche of risingNiches) {
    if (suggestions.length >= maxSuggestions) break;
    suggestions.push({
      type: "niche_opportunity",
      title: `Rising niche: ${niche.niche.charAt(0).toUpperCase() + niche.niche.slice(1)}`,
      reason: `This niche is trending up in the Pakistani market (velocity: ${(niche.velocityScore * 100).toFixed(0)}%)`,
      confidence: niche.confidence,
      sourceVerified: niche.sourceVerified,
      dataOrigin: "curated_market_index",
    });
  }

  // ── 2. Brand campaign opportunities from user niche ────────────────────────
  if (context.userNiche) {
    const nicheKey = context.userNiche.toLowerCase().trim();
    const compatibleVerticals = NICHE_BRAND_VERTICALS[nicheKey];
    if (compatibleVerticals && suggestions.length < maxSuggestions) {
      const nicheData = getNicheTrendData(nicheKey);
      suggestions.push({
        type: "brand_opportunity",
        title: `Campaign verticals for ${context.userNiche} creators`,
        reason: `Brands in ${compatibleVerticals.slice(0, 3).join(", ")} historically collaborate with ${context.userNiche} creators`,
        confidence: nicheData.confidence,
        sourceVerified: nicheData.sourceVerified,
        dataOrigin: "curated_market_index",
      });
    }
  }

  // ── 3. Niche alerts — declining niches from recent searches ───────────────
  if (context.recentSearchNiches && context.recentSearchNiches.length > 0) {
    const decliningNiches = getDecliningNiches(3);
    const decliningSet = new Set(decliningNiches.map((n) => n.niche));
    for (const searchedNiche of context.recentSearchNiches) {
      if (suggestions.length >= maxSuggestions) break;
      if (decliningSet.has(searchedNiche.toLowerCase())) {
        const nicheData = getNicheTrendData(searchedNiche.toLowerCase());
        suggestions.push({
          type: "niche_alert",
          title: `Niche under pressure: ${searchedNiche}`,
          reason: `${searchedNiche} content is showing declining engagement trends. Consider diversifying.`,
          confidence: nicheData.confidence,
          sourceVerified: nicheData.sourceVerified,
          dataOrigin: "curated_market_index",
        });
      }
    }
  }

  return suggestions.slice(0, maxSuggestions);
}
