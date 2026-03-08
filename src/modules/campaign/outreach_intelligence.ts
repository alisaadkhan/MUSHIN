/**
 * src/modules/campaign/outreach_intelligence.ts
 *
 * Campaign Outreach Intelligence — estimates the probability that a creator
 * will respond to a brand collaboration outreach message.
 *
 * Inputs are derived from publicly available profile signals only.
 * Output: responseProbability ∈ [0, 1] (displayed as a percentage).
 *
 * Design constraints:
 *  - NO network calls — all scoring is deterministic from supplied inputs
 *  - If confidence < 0.60, caller MUST display "Insufficient data for prediction"
 *  - responseProbability is NEVER stored — always computed fresh per campaign
 */

export interface OutreachInput {
  /** Platform of the creator */
  platform: "instagram" | "tiktok" | "youtube" | "twitch" | "facebook";
  /** Follower count */
  followerCount: number | null;
  /** Engagement rate (0–100, e.g. 3.5 = 3.5%) */
  engagementRate: number | null;
  /** Bot probability from analytics (0–1) */
  botProbability: number | null;
  /** Whether a valid contact email is present in profile */
  hasContactEmail: boolean;
  /** Brand mentions detected in recent content (count) */
  brandMentionCount?: number | null;
  /** Whether creator has been tagged by brands before */
  hasPastCollabSignal?: boolean;
  /** Account age in days (older = more established = higher response rate) */
  accountAgeDays?: number | null;
}

export interface OutreachResult {
  /** Response probability ∈ [0, 1] */
  responseProbability: number;
  /** Readable label: "High" | "Moderate" | "Low" | "Unlikely" */
  responseLabel: "High" | "Moderate" | "Low" | "Unlikely";
  /** Confidence in the estimate (if < 0.60, display warning) */
  confidence: number;
  /** Whether confidence is too low to show prediction */
  uncertain: boolean;
  /** Human-readable signals that drove the score */
  signals: string[];
}

// ---------------------------------------------------------------------------
// Benchmarks — tuned for Pakistani influencer market
// ---------------------------------------------------------------------------

/** Follower tiers with base response probability */
const FOLLOWER_TIERS: Array<{ max: number; baseProb: number }> = [
  { max: 10_000,     baseProb: 0.70 }, // nano — almost always responsive
  { max: 50_000,     baseProb: 0.62 }, // micro — very approachable
  { max: 250_000,    baseProb: 0.50 }, // mid — selective but reachable
  { max: 1_000_000,  baseProb: 0.35 }, // macro — mostly via agency
  { max: Infinity,   baseProb: 0.18 }, // mega — agent required
];

/** Platform-specific base adjustments */
const PLATFORM_ADJUSTMENTS: Record<string, number> = {
  instagram:  0.00,  // baseline
  tiktok:    -0.05,  // less DM culture
  youtube:    0.03,  // email in descriptions common
  twitch:    -0.08,  // gaming audience, less brand-oriented
  facebook:   0.02,  // older platform, still responsive
};

function _getBaseProb(followerCount: number): number {
  for (const tier of FOLLOWER_TIERS) {
    if (followerCount <= tier.max) return tier.baseProb;
  }
  return 0.18;
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Estimate the response probability for a creator outreach.
 *
 * @param input - OutreachInput (all fields optional except platform)
 * @returns OutreachResult
 */
export function estimateResponseProbability(input: OutreachInput): OutreachResult {
  const signals: string[] = [];
  let adjustments = 0;
  let evidenceCount = 0;

  // ── Base probability from follower tier ────────────────────────────────────
  const fc = input.followerCount ?? 0;
  let base = _getBaseProb(fc);

  // ── Platform adjustment ────────────────────────────────────────────────────
  const platformAdj = PLATFORM_ADJUSTMENTS[input.platform] ?? 0;
  base += platformAdj;

  // ── Engagement rate signal (weight 0.25) ──────────────────────────────────
  if (input.engagementRate !== null && input.engagementRate !== undefined) {
    evidenceCount++;
    const er = input.engagementRate;
    if (er >= 5.0) {
      adjustments += 0.12;
      signals.push("High engagement rate — creator is active and community-driven");
    } else if (er >= 2.5) {
      adjustments += 0.05;
      signals.push("Solid engagement rate — indicates genuine audience connection");
    } else if (er < 1.0) {
      adjustments -= 0.08;
      signals.push("Low engagement rate — possible reduced posting activity");
    }
  }

  // ── Bot probability (weight 0.20) ─────────────────────────────────────────
  if (input.botProbability !== null && input.botProbability !== undefined) {
    evidenceCount++;
    const bp = input.botProbability;
    if (bp > 0.60) {
      adjustments -= 0.18;
      signals.push("High bot probability — account authenticity uncertain, may not respond");
    } else if (bp > 0.30) {
      adjustments -= 0.07;
      signals.push("Moderate bot signals detected — response rate may be reduced");
    } else {
      adjustments += 0.05;
      signals.push("Low bot probability — account appears authentic");
    }
  }

  // ── Contact email present (weight 0.20) ───────────────────────────────────
  if (input.hasContactEmail) {
    evidenceCount++;
    adjustments += 0.14;
    signals.push("Contact email present — creator is open to business inquiries");
  } else {
    adjustments -= 0.05;
    signals.push("No public email — DM-only contact, lower response rate");
  }

  // ── Past collab signal (weight 0.15) ──────────────────────────────────────
  if (input.hasPastCollabSignal === true) {
    evidenceCount++;
    adjustments += 0.10;
    signals.push("Past brand collaboration signals detected — proven partnership history");
  }

  // ── Brand mention count (weight 0.10) ────────────────────────────────────
  const bmc = input.brandMentionCount ?? 0;
  if (bmc > 0) {
    evidenceCount++;
    const boost = Math.min(bmc * 0.03, 0.09);
    adjustments += boost;
    signals.push(`${bmc} brand mention(s) detected — experience with sponsored content`);
  }

  // ── Account age (weight 0.10) ─────────────────────────────────────────────
  if (input.accountAgeDays !== null && input.accountAgeDays !== undefined) {
    evidenceCount++;
    const ageDays = input.accountAgeDays;
    if (ageDays >= 730) {
      adjustments += 0.04;
      signals.push("Established account (2+ years) — more likely to have inbox management");
    } else if (ageDays < 90) {
      adjustments -= 0.06;
      signals.push("New account (<90 days) — may not have brand inbox setup");
    }
  }

  // ── Final probability ─────────────────────────────────────────────────────
  const raw = base + adjustments;
  const responseProbability = Math.min(Math.max(Math.round(raw * 1000) / 1000, 0.01), 0.98);

  // ── Confidence computation ────────────────────────────────────────────────
  const confidence = Math.min(Math.round((0.40 + evidenceCount * 0.12) * 100) / 100, 0.95);
  const uncertain = confidence < 0.60;

  // ── Label ─────────────────────────────────────────────────────────────────
  let responseLabel: OutreachResult["responseLabel"];
  if (responseProbability >= 0.60) responseLabel = "High";
  else if (responseProbability >= 0.40) responseLabel = "Moderate";
  else if (responseProbability >= 0.20) responseLabel = "Low";
  else responseLabel = "Unlikely";

  return {
    responseProbability,
    responseLabel,
    confidence,
    uncertain,
    signals,
  };
}
