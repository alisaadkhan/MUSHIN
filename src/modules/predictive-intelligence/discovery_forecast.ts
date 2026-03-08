/**
 * src/modules/predictive-intelligence/discovery_forecast.ts
 *
 * Predictive Discovery Engine — Trend Velocity Score
 *
 * Formula (v1):
 *   trend_velocity =
 *     0.30 × growth_rate_projection
 *     + 0.25 × engagement_stability
 *     + 0.20 × posting_consistency
 *     + 0.15 × audience_retention_estimate
 *     + 0.10 × niche_trend_popularity
 *
 * Output clamped to [0, 1].
 *
 * Design invariants:
 *  - NO network calls — deterministic from supplied inputs
 *  - If confidence < 0.65 → caller MUST display "Prediction unavailable"
 *  - NEVER fabricate historical data — supply null when unavailable
 *  - source_verified, confidence_score, data_origin always set on every result
 */

export interface DiscoveryForecastInput {
  /** Platform of the creator */
  platform: "instagram" | "tiktok" | "youtube" | "twitch" | "facebook" | "twitter";
  /** Current follower count */
  followerCount: number | null;
  /** Net follower change in last 30 days (positive = growth) */
  recentFollowerDelta: number | null;
  /** Current engagement rate (0–100, e.g. 3.5 = 3.5%) */
  engagementRate: number | null;
  /** Previous period engagement rate for stability comparison (0–100) */
  engagementRatePrev: number | null;
  /** Total posts published on account */
  postsCount: number | null;
  /** Account age in days */
  accountAgeDays: number | null;
  /** Primary content niche for trend popularity lookup */
  primaryNiche: string | null;
  /** Average video/post views — optional, strengthens audience retention signal */
  avgViews: number | null;
}

export interface DiscoveryForecastResult {
  /** Composite trend velocity score [0, 1] */
  trendVelocityScore: number;
  /** Qualitative label */
  trendLabel: "surging" | "rising" | "stable" | "declining";
  /** Confidence in this prediction [0, 1] */
  confidence: number;
  /** Whether confidence is too low to display prediction (< 0.65) */
  uncertain: boolean;
  /** Breakdown of individual signal scores */
  breakdown: {
    growthRateProjection: number | null;
    engagementStability: number | null;
    postingConsistency: number | null;
    audienceRetentionEstimate: number | null;
    nicheTrendPopularity: number | null;
  };
  /** Human-readable signal explanations */
  signals: string[];
  /** Data provenance — always "computed_from_profile_signals" */
  dataOrigin: "computed_from_profile_signals";
  /** Whether all required inputs were non-null */
  sourceVerified: boolean;
}

// ---------------------------------------------------------------------------
// Niche trend popularity index
// Reflects Pakistani internet market as of 2026.
// Higher score = more trending / in-demand content category.
// ---------------------------------------------------------------------------
export const NICHE_TREND_POPULARITY_INDEX: Record<string, number> = {
  ai:           0.95,
  tech:         0.90,
  cricket:      0.88,
  gaming:       0.85,
  comedy:       0.82,
  finance:      0.80,
  sports:       0.80,
  food:         0.78,
  news:         0.77,
  fitness:      0.75,
  education:    0.73,
  beauty:       0.72,
  fashion:      0.70,
  travel:       0.68,
  lifestyle:    0.65,
  photography:  0.60,
  art:          0.58,
  automotive:   0.55,
};

const DEFAULT_NICHE_TREND = 0.50; // unknown niche → neutral

// ---------------------------------------------------------------------------
// Internal signal computations
// ---------------------------------------------------------------------------

function _computeGrowthRateProjection(
  followerCount: number | null,
  recentFollowerDelta: number | null,
): number | null {
  if (followerCount == null || recentFollowerDelta == null || followerCount <= 0) return null;
  const growthRate = recentFollowerDelta / followerCount; // monthly fraction

  // Map growth rate → [0, 1]
  if (growthRate <= -0.10) return 0.00;
  if (growthRate < 0)      return 0.30 + (growthRate / 0.10) * 0.30; // linear 0.30→0 for -10% to 0%
  if (growthRate <= 0.05)  return 0.30 + (growthRate / 0.05) * 0.35;
  if (growthRate <= 0.10)  return 0.65 + ((growthRate - 0.05) / 0.05) * 0.20;
  if (growthRate <= 0.20)  return 0.85 + ((growthRate - 0.10) / 0.10) * 0.15;
  return 1.00;
}

function _computeEngagementStability(
  engagementRate: number | null,
  engagementRatePrev: number | null,
): number | null {
  if (engagementRate == null) return null;

  // Base absolute ER score
  const baseScore =
    engagementRate >= 6 ? 0.88 :
    engagementRate >= 5 ? 0.82 :
    engagementRate >= 3 ? 0.72 :
    engagementRate >= 1 ? 0.55 : 0.25;

  if (engagementRatePrev == null) return baseScore;

  // Add stability delta: improved ER = bonus, dropped ER = penalty
  const relativeChange = engagementRatePrev > 0
    ? (engagementRate - engagementRatePrev) / engagementRatePrev
    : 0;
  const deltaBonus = Math.max(-0.20, Math.min(0.15, relativeChange * 0.5));
  return Math.max(0, Math.min(1, baseScore + deltaBonus));
}

function _computePostingConsistency(
  postsCount: number | null,
  accountAgeDays: number | null,
): number | null {
  if (postsCount == null || accountAgeDays == null || accountAgeDays <= 0) return null;
  const postsPerDay = postsCount / accountAgeDays;
  if (postsPerDay >= 2.0)  return 0.90;
  if (postsPerDay >= 1.0)  return 0.85;
  if (postsPerDay >= 0.5)  return 0.75;
  if (postsPerDay >= 0.25) return 0.60;
  if (postsPerDay >= 0.10) return 0.40;
  return 0.20;
}

function _computeAudienceRetentionEstimate(
  followerCount: number | null,
  avgViews: number | null,
  engagementRate: number | null,
): number | null {
  if (followerCount == null) return null;

  // Prefer views/follower ratio when available
  if (avgViews != null && followerCount > 0) {
    const viewRatio = avgViews / followerCount;
    if (viewRatio >= 0.80) return 0.95;
    if (viewRatio >= 0.50) return 0.80;
    if (viewRatio >= 0.25) return 0.65;
    if (viewRatio >= 0.10) return 0.50;
    return 0.30;
  }

  // Fallback: use ER as retention proxy
  if (engagementRate == null) return null;
  if (engagementRate >= 6)  return 0.85;
  if (engagementRate >= 3)  return 0.70;
  if (engagementRate >= 1)  return 0.55;
  return 0.35;
}

function _computeNicheTrendPopularity(primaryNiche: string | null): number {
  if (!primaryNiche) return DEFAULT_NICHE_TREND;
  return NICHE_TREND_POPULARITY_INDEX[primaryNiche.toLowerCase().trim()] ?? DEFAULT_NICHE_TREND;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Compute a trend velocity score for a creator using predictive intelligence.
 *
 * Formula:
 *   trend_velocity =
 *     0.30 × growth_rate_projection
 *     + 0.25 × engagement_stability
 *     + 0.20 × posting_consistency
 *     + 0.15 × audience_retention_estimate
 *     + 0.10 × niche_trend_popularity
 *
 * If fewer than 3 of the 5 signals are available, confidence drops below
 * 0.65 and `uncertain` is set to true — caller MUST NOT render the score.
 */
export function computeTrendVelocityScore(input: DiscoveryForecastInput): DiscoveryForecastResult {
  const growthRateProjection = _computeGrowthRateProjection(
    input.followerCount, input.recentFollowerDelta,
  );
  const engagementStability = _computeEngagementStability(
    input.engagementRate, input.engagementRatePrev,
  );
  const postingConsistency = _computePostingConsistency(
    input.postsCount, input.accountAgeDays,
  );
  const audienceRetentionEstimate = _computeAudienceRetentionEstimate(
    input.followerCount, input.avgViews, input.engagementRate,
  );
  // Niche trend is always available (defaults to 0.50 for unknown niches)
  const nicheTrendPopularity = _computeNicheTrendPopularity(input.primaryNiche);

  const weightedSignals: Array<{ score: number | null; weight: number; label: string }> = [
    { score: growthRateProjection,      weight: 0.30, label: "Growth rate projection" },
    { score: engagementStability,       weight: 0.25, label: "Engagement stability" },
    { score: postingConsistency,        weight: 0.20, label: "Posting consistency" },
    { score: audienceRetentionEstimate, weight: 0.15, label: "Audience retention estimate" },
    { score: nicheTrendPopularity,      weight: 0.10, label: "Niche trend popularity" },
  ];

  const available = weightedSignals.filter((s) => s.score != null);
  const availableCount = available.length;

  // Confidence degrades as fewer signals are available
  const confidence =
    availableCount >= 5 ? 0.90 :
    availableCount >= 4 ? 0.78 :
    availableCount >= 3 ? 0.65 :
    availableCount >= 2 ? 0.45 : 0.20;

  const uncertain = confidence < 0.65;

  // Weighted average over available signals only (re-normalized)
  const totalWeight = available.reduce((s, sig) => s + sig.weight, 0);
  const weightedSum = available.reduce((s, sig) => s + (sig.score as number) * sig.weight, 0);
  const trendVelocityScore = Math.max(0, Math.min(1, totalWeight > 0 ? weightedSum / totalWeight : 0));

  // Trend label
  const trendLabel: DiscoveryForecastResult["trendLabel"] =
    trendVelocityScore >= 0.80 ? "surging" :
    trendVelocityScore >= 0.55 ? "rising" :
    trendVelocityScore >= 0.35 ? "stable" : "declining";

  // Human-readable signals
  const signals: string[] = [];
  if (growthRateProjection != null) {
    signals.push(
      growthRateProjection >= 0.70 ? "Strong follower growth momentum" :
      growthRateProjection >= 0.45 ? "Moderate follower growth" :
      "Slow or negative follower growth",
    );
  }
  if (engagementStability != null) {
    signals.push(
      engagementStability >= 0.70 ? "High and stable engagement rate" :
      engagementStability >= 0.50 ? "Moderate engagement stability" :
      "Low or declining engagement rate",
    );
  }
  if (postingConsistency != null) {
    signals.push(
      postingConsistency >= 0.75 ? "Consistent posting cadence" :
      "Irregular posting frequency detected",
    );
  }
  if (audienceRetentionEstimate != null) {
    signals.push(
      audienceRetentionEstimate >= 0.70 ? "High audience retention estimate" :
      "Below-average audience retention signals",
    );
  }
  signals.push(`Niche trend index: ${(nicheTrendPopularity * 100).toFixed(0)}%`);

  const sourceVerified =
    input.followerCount != null &&
    input.recentFollowerDelta != null &&
    input.engagementRate != null &&
    input.postsCount != null &&
    input.accountAgeDays != null;

  return {
    trendVelocityScore,
    trendLabel,
    confidence,
    uncertain,
    breakdown: {
      growthRateProjection,
      engagementStability,
      postingConsistency,
      audienceRetentionEstimate,
      nicheTrendPopularity,
    },
    signals,
    dataOrigin: "computed_from_profile_signals",
    sourceVerified,
  };
}
