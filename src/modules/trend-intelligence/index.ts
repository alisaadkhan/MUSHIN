/**
 * src/modules/trend-intelligence/index.ts
 * Barrel export for the Trend Intelligence module (Phase 7)
 */
export {
  getNicheTrendData,
  getRisingNiches,
  getDecliningNiches,
  rankNichesByPopularity,
  NICHE_MARKET_INDEX,
} from "./niche_popularity_forecast";
export type { NicheTrendResult } from "./niche_popularity_forecast";

export { computeBrandAffinity } from "./brand_affinity_scoring";
export type { BrandAffinityInput, BrandAffinityResult } from "./brand_affinity_scoring";

export { generateDiscoverySuggestions } from "./discovery_suggestions";
export type { DiscoverySuggestion, DiscoveryContext } from "./discovery_suggestions";
