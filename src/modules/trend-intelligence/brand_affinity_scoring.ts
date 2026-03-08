/**
 * src/modules/trend-intelligence/brand_affinity_scoring.ts
 *
 * Brand Intelligence Layer — Creator × Brand Affinity Scoring
 *
 * Predicts brand–creator compatibility for campaign matching.
 * Signals:
 *   - Niche–brand vertical compatibility (weight: 0.35)
 *   - Audience size suitability          (weight: 0.30)
 *   - Engagement quality                 (weight: 0.20)
 *   - Sponsorship history                (weight: 0.15)
 *
 * Design invariants:
 *   - NEVER fabricate sponsorship history — only score from signals provided
 *   - confidence < 0.60 → uncertain=true → caller shows "Insufficient data"
 *   - All scores ∈ [0, 1], recommendation is one of three enum values
 *   - source_verified and data_origin always present
 */

export interface BrandAffinityInput {
  platform: "instagram" | "tiktok" | "youtube" | "twitch" | "facebook" | "twitter";
  followerCount: number | null;
  engagementRate: number | null;
  creatorNiche: string | null;
  brandVertical: string | null;
  /** Target audience size the brand wants to reach */
  targetAudienceSize?: "nano" | "micro" | "mid" | "macro" | "mega" | null;
  /** Number of past sponsorship posts detected (0 if unknown) */
  pastSponsorshipCount?: number | null;
  /** Bot probability [0–1] — used to assess engagement quality */
  botProbability?: number | null;
}

export interface BrandAffinityResult {
  /** Composite affinity score [0, 1] */
  affinityScore: number;
  recommendation: "strong_match" | "potential_match" | "weak_match";
  confidence: number;
  uncertain: boolean;
  breakdown: {
    nicheCompatibility: number | null;
    audienceSizeFit: number | null;
    engagementQuality: number | null;
    sponsorshipHistory: number | null;
  };
  signals: string[];
  sourceVerified: boolean;
  dataOrigin: "computed_from_profile_signals";
}

// ---------------------------------------------------------------------------
// Niche–brand vertical compatibility matrix (mirrors campaign_forecast.ts)
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

// Follower tier lookup
function _tierFromFollowers(count: number | null): "nano" | "micro" | "mid" | "macro" | "mega" | null {
  if (count == null) return null;
  if (count <= 10_000)     return "nano";
  if (count <= 50_000)     return "micro";
  if (count <= 250_000)    return "mid";
  if (count <= 1_000_000)  return "macro";
  return "mega";
}

// Audience size fit — how well does creator's reach match brand's target
function _audienceSizeFit(
  followerCount: number | null,
  targetAudienceSize: string | null | undefined,
): number | null {
  if (followerCount == null) return null;
  const creatorTier = _tierFromFollowers(followerCount);
  if (!targetAudienceSize || !creatorTier) {
    // No target specified — score on absolute reach
    if (followerCount >= 100_000) return 0.80;
    if (followerCount >= 10_000)  return 0.70;
    return 0.55;
  }
  return creatorTier === targetAudienceSize ? 0.90 : 0.40;
}

// Engagement quality — uses ER and bot probability together
function _engagementQuality(
  engagementRate: number | null,
  botProbability: number | null,
): number | null {
  if (engagementRate == null) return null;
  let base =
    engagementRate >= 6 ? 0.90 :
    engagementRate >= 4 ? 0.75 :
    engagementRate >= 2 ? 0.60 :
    engagementRate >= 1 ? 0.45 : 0.25;
  if (botProbability != null) {
    base -= botProbability * 0.30; // bot risk reduces engagement quality
  }
  return Math.max(0, Math.min(1, base));
}

// Sponsorship history — returns comfort-with-brands score
function _sponsorshipHistoryScore(pastSponsorshipCount: number | null | undefined): number | null {
  if (pastSponsorshipCount == null) return null;
  if (pastSponsorshipCount >= 10) return 0.90;
  if (pastSponsorshipCount >= 5)  return 0.75;
  if (pastSponsorshipCount >= 2)  return 0.60;
  if (pastSponsorshipCount >= 1)  return 0.50;
  return 0.30; // no prior sponsorships detected
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Score brand–creator affinity from publicly available profile signals.
 * Confident predictions require at least 2 of 4 signals available.
 */
export function computeBrandAffinity(input: BrandAffinityInput): BrandAffinityResult {
  const signals: string[] = [];
  let availableCount = 0;

  // Signal 1 — niche compatibility (weight 0.35)
  const nicheKey = input.creatorNiche?.toLowerCase() ?? null;
  const brandKey = input.brandVertical?.toLowerCase() ?? null;
  let nicheCompatibility: number | null = null;
  if (nicheKey && brandKey) {
    availableCount++;
    const compatible = NICHE_BRAND_COMPAT[nicheKey] ?? [];
    nicheCompatibility = compatible.includes(brandKey) ? 0.90 : 0.25;
    signals.push(
      nicheCompatibility >= 0.80
        ? `Strong niche match: ${input.creatorNiche} ↔ ${input.brandVertical}`
        : `Niche mismatch: ${input.creatorNiche} vs ${input.brandVertical}`,
    );
  }

  // Signal 2 — audience size fit (weight 0.30)
  const audienceSizeFit = _audienceSizeFit(input.followerCount, input.targetAudienceSize);
  if (audienceSizeFit != null) {
    availableCount++;
    signals.push(
      audienceSizeFit >= 0.80 ? "Audience size matches campaign target" :
      "Audience size does not match campaign target",
    );
  }

  // Signal 3 — engagement quality (weight 0.20)
  const engagementQuality = _engagementQuality(input.engagementRate, input.botProbability ?? null);
  if (engagementQuality != null) {
    availableCount++;
    signals.push(
      engagementQuality >= 0.70 ? "High engagement quality" :
      engagementQuality >= 0.45 ? "Average engagement quality" :
      "Low engagement quality",
    );
  }

  // Signal 4 — sponsorship history (weight 0.15)
  const sponsorshipHistory = _sponsorshipHistoryScore(input.pastSponsorshipCount);
  if (sponsorshipHistory != null) {
    availableCount++;
    signals.push(
      sponsorshipHistory >= 0.70 ? "Established brand collaboration history" :
      sponsorshipHistory >= 0.50 ? "Some prior sponsorship experience" :
      "No prior brand collaborations detected",
    );
  }

  // ── Confidence ────────────────────────────────────────────────────────────
  const confidence =
    availableCount >= 4 ? 0.88 :
    availableCount >= 3 ? 0.76 :
    availableCount >= 2 ? 0.62 : 0.35;
  const uncertain = confidence < 0.60;

  // ── Weighted score ────────────────────────────────────────────────────────
  const weighted: Array<{ score: number | null; weight: number }> = [
    { score: nicheCompatibility, weight: 0.35 },
    { score: audienceSizeFit,    weight: 0.30 },
    { score: engagementQuality,  weight: 0.20 },
    { score: sponsorshipHistory, weight: 0.15 },
  ];
  const available = weighted.filter((w) => w.score != null);
  const totalW = available.reduce((s, w) => s + w.weight, 0);
  const rawScore = totalW > 0
    ? available.reduce((s, w) => s + (w.score as number) * w.weight, 0) / totalW
    : 0;
  const affinityScore = Math.max(0, Math.min(1, rawScore));

  const recommendation: BrandAffinityResult["recommendation"] =
    affinityScore >= 0.70 ? "strong_match" :
    affinityScore >= 0.45 ? "potential_match" : "weak_match";

  const sourceVerified =
    input.followerCount != null &&
    input.engagementRate != null &&
    input.creatorNiche != null &&
    input.brandVertical != null;

  return {
    affinityScore,
    recommendation,
    confidence,
    uncertain,
    breakdown: { nicheCompatibility, audienceSizeFit, engagementQuality, sponsorshipHistory },
    signals,
    sourceVerified,
    dataOrigin: "computed_from_profile_signals",
  };
}
