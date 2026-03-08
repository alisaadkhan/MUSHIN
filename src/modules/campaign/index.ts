/**
 * src/modules/campaign/index.ts
 * Barrel export for campaign intelligence modules
 */
export { estimateResponseProbability } from "./outreach_intelligence";
export type { OutreachInput, OutreachResult } from "./outreach_intelligence";

// Phase 6 — Campaign success forecasting
export { computeCampaignForecast } from "./prediction/campaign_forecast";
export type { CampaignForecastInput, CampaignForecastResult } from "./prediction/campaign_forecast";
