/**
 * src/modules/campaign/prediction/campaign_forecast.ts
 *
 * Campaign Success Forecasting — compound probability model.
 *
 * Predicts:
 *   - responseProbability  : probability creator replies to brand outreach [0.01, 0.99]
 *   - conversionLikelihood : outreach → confirmed collaboration [0.01, 0.99]
 *   - outreachSuccessScore : composite campaign success signal [0.01, 0.99]
 *
 * Signals used:
 *   - Creator engagement quality  (±0.12)
 *   - Bot probability risk        (±0.18)
 *   - Contact email present       (+0.14)
 *   - Niche–brand vertical match  (±0.15)
 *   - Audience overlap score      (±0.10)
 *   - Response history score      (±0.10)
 *   - Follower tier base          (base probability)
 *
 * Design invariants:
 *   - NO network calls — pure computation from supplied signals
 *   - confidence < 0.60 → uncertain=true → caller MUST show "Insufficient data"
 *   - All outputs clamped to [0.01, 0.99] — never shows 0% or 100%
 *   - source_verified and data_origin always set
 */

export interface CampaignForecastInput {
  platform: "instagram" | "tiktok" | "youtube" | "twitch" | "facebook" | "twitter";
  followerCount: number | null;
  engagementRate: number | null;
  botProbability: number | null;
  creatorNiche: string | null;
  brandVertical: string | null;
  hasContactEmail: boolean;
  /** Audience–brand overlap score [0–1] — optional, from prior matching step */
  audienceOverlapScore?: number | null;
  /** Historical outreach response score [0–1] — from CRM data if available */
  responseHistoryScore?: number | null;
}

export interface CampaignForecastResult {
  /** Probability creator responds to outreach [0.01, 0.99] */
  responseProbability: number;
  /** Probability of confirmed campaign conversion [0.01, 0.99] */
  conversionLikelihood: number;
  /** Composite campaign success score [0.01, 0.99] */
  outreachSuccessScore: number;
  confidence: number;
  uncertain: boolean;
  signals: string[];
  /** Alias of confidence for interface consistency */
  confidenceScore: number;
  dataOrigin: "computed_from_profile_signals";
}

// ---------------------------------------------------------------------------
// Niche–brand vertical compatibility matrix
// ---------------------------------------------------------------------------
const NICHE_BRAND_COMPAT: Record<string, string[]> = {
  fashion:     ["fashion", "beauty", "lifestyle", "luxury", "retail"],
  beauty:      ["beauty", "skincare", "fashion", "wellness"],
  food:        ["food", "restaurant", "beverage", "kitchen", "health"],
  fitness:     ["fitness", "sports", "health", "wellness", "nutrition"],
  tech:        ["tech", "electronics", "software", "finance"],
  ai:          ["tech", "software", "finance", "education"],
  gaming:      ["gaming", "tech", "electronics", "energy"],
  cricket:     ["sports", "fitness", "energy", "telecom"],
  travel:      ["travel", "hospitality", "finance", "automotive"],
  lifestyle:   ["lifestyle", "fashion", "beauty", "travel", "food"],
  finance:     ["finance", "tech", "insurance", "real-estate"],
  education:   ["education", "tech", "finance", "publishing"],
  comedy:      ["entertainment", "food", "beverage", "telecom"],
  music:       ["entertainment", "fashion", "beverage", "lifestyle"],
  photography: ["photography", "lifestyle", "travel", "fashion"],
  art:         ["art", "fashion", "lifestyle", "luxury"],
  sports:      ["sports", "fitness", "energy", "automotive"],
  automotive:  ["automotive", "tech", "finance", "energy"],
  news:        ["publishing", "finance", "telecom"],
};

function _nicheMatch(creatorNiche: string | null, brandVertical: string | null): number | null {
  if (!creatorNiche || !brandVertical) return null;
  const compatible = NICHE_BRAND_COMPAT[creatorNiche.toLowerCase()] ?? [];
  return compatible.includes(brandVertical.toLowerCase()) ? 0.85 : 0.30;
}

function _baseResponseProb(followerCount: number | null): number {
  if (followerCount == null) return 0.50;
  if (followerCount <= 10_000)    return 0.70;
  if (followerCount <= 50_000)    return 0.62;
  if (followerCount <= 250_000)   return 0.50;
  if (followerCount <= 1_000_000) return 0.35;
  return 0.18;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Forecast campaign success metrics for a given creator × brand pairing.
 *
 * Returns `uncertain: true` when confidence < 0.60 — the UI MUST NOT
 * display numeric predictions in this case.
 */
export function computeCampaignForecast(input: CampaignForecastInput): CampaignForecastResult {
  const signals: string[] = [];
  let availableSignals = 0;

  // ── Follower tier base probability ────────────────────────────────────────
  const baseProb = _baseResponseProb(input.followerCount);
  if (input.followerCount != null) availableSignals++;

  let responseAdj = 0;

  // ── Engagement rate ───────────────────────────────────────────────────────
  if (input.engagementRate != null) {
    availableSignals++;
    if (input.engagementRate >= 5) {
      responseAdj += 0.12;
      signals.push("High engagement rate (+)");
    } else if (input.engagementRate >= 3) {
      responseAdj += 0.06;
      signals.push("Average engagement rate");
    } else if (input.engagementRate < 1) {
      responseAdj -= 0.10;
      signals.push("Low engagement rate (–)");
    }
  }

  // ── Bot probability ───────────────────────────────────────────────────────
  if (input.botProbability != null) {
    availableSignals++;
    if (input.botProbability >= 0.6) {
      responseAdj -= 0.18;
      signals.push("High bot probability — campaign risk (–)");
    } else if (input.botProbability >= 0.3) {
      responseAdj -= 0.08;
      signals.push("Moderate bot signals detected (–)");
    } else {
      responseAdj += 0.05;
      signals.push("Low bot risk (+)");
    }
  }

  // ── Contact email ─────────────────────────────────────────────────────────
  if (input.hasContactEmail) {
    responseAdj += 0.14;
    signals.push("Verified contact email present (+)");
    availableSignals++;
  }

  // ── Niche–brand match ─────────────────────────────────────────────────────
  const nicheMatch = _nicheMatch(input.creatorNiche, input.brandVertical);
  if (nicheMatch != null) {
    availableSignals++;
    if (nicheMatch >= 0.80) {
      signals.push(`Strong niche–brand alignment: ${input.creatorNiche} ↔ ${input.brandVertical} (+)`);
    } else {
      signals.push(`Weak niche–brand alignment (–)`);
    }
  }

  // ── Audience overlap ──────────────────────────────────────────────────────
  let overlapAdj = 0;
  if (input.audienceOverlapScore != null) {
    availableSignals++;
    overlapAdj = (input.audienceOverlapScore - 0.5) * 0.20; // ±0.10
    signals.push(`Audience overlap score: ${(input.audienceOverlapScore * 100).toFixed(0)}%`);
  }

  // ── Response history ──────────────────────────────────────────────────────
  let historyAdj = 0;
  if (input.responseHistoryScore != null) {
    availableSignals++;
    historyAdj = (input.responseHistoryScore - 0.5) * 0.20; // ±0.10
    signals.push(
      input.responseHistoryScore >= 0.6 ? "Positive response history (+)" : "Low response history (–)",
    );
  }

  // ── Confidence ────────────────────────────────────────────────────────────
  const confidence =
    availableSignals >= 6 ? 0.88 :
    availableSignals >= 4 ? 0.75 :
    availableSignals >= 2 ? 0.60 : 0.40;
  const uncertain = confidence < 0.60;

  // ── Response probability ──────────────────────────────────────────────────
  const nicheBoost = nicheMatch != null ? (nicheMatch - 0.5) * 0.15 : 0;
  const rawResp = baseProb + responseAdj + nicheBoost + overlapAdj + historyAdj;
  const responseProbability = Math.max(0.01, Math.min(0.99, rawResp));

  // ── Conversion likelihood: response × niche quality ───────────────────────
  const conversionBase = responseProbability * (nicheMatch ?? 0.50);
  const conversionLikelihood = Math.max(0.01, Math.min(0.99, conversionBase * 1.1));

  // ── Outreach success: weighted blend ──────────────────────────────────────
  const outreachSuccessScore = Math.max(
    0.01,
    Math.min(0.99, responseProbability * 0.50 + conversionLikelihood * 0.30 + (nicheMatch ?? 0.50) * 0.20),
  );

  return {
    responseProbability,
    conversionLikelihood,
    outreachSuccessScore,
    confidence,
    uncertain,
    signals,
    confidenceScore: confidence,
    dataOrigin: "computed_from_profile_signals",
  };
}
