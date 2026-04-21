/**
 * src/modules/platforms/twitter_adapter.ts
 *
 * X (Twitter) Platform Adapter — Trend Intelligence Only (BETA)
 *
 * NOTE: This adapter is in BETA. It provides trend intelligence signals
 * based on engagement patterns. It does NOT use live Twitter data
 * in this version — all computations are from supplied profile metrics.
 *
 * @beta isBeta=true — all results carry isBeta flag
 */

export const TWITTER_ADAPTER_IS_BETA = true as const;

export type TwitterFollowerTier = "nano" | "micro" | "mid" | "macro" | "mega";

export interface TwitterRawMetrics {
  followerCount: number;
  avgLikes?: number | null;
  avgRetweets?: number | null;
  avgReplies?: number | null;
  avgImpressions?: number | null;
  postsCount?: number | null;
  accountAgeDays?: number | null;
}

export interface TwitterNormalisedMetrics {
  followerTier: TwitterFollowerTier;
  /** ER computed as (likes + retweets + replies) / impressions × 100 when impressions available */
  engagementRate: number;
  /** Retweet-to-like ratio — measures viral potential */
  retweetToLikeRatio: number | null;
  /** Impressions per follower — measures algorithmic reach */
  impressionsPerFollower: number | null;
  /** Whether this is a tweet-frequency active account (>1 post/day) */
  isActiveAccount: boolean;
  /** Beta flag — always true for Twitter adapter */
  isBeta: true;
}

/** Engagement rate benchmarks for X (Twitter) by follower tier */
export const TWITTER_ER_BENCHMARKS: Record<TwitterFollowerTier, { good: number; average: number; low: number }> = {
  nano:  { good: 3.0, average: 1.5, low: 0.5 },
  micro: { good: 2.0, average: 1.0, low: 0.3 },
  mid:   { good: 1.5, average: 0.8, low: 0.2 },
  macro: { good: 1.0, average: 0.5, low: 0.1 },
  mega:  { good: 0.8, average: 0.3, low: 0.05 },
};

/**
 * Classify a Twitter account by follower count into a tier.
 */
export function classifyTwitterTier(followerCount: number): TwitterFollowerTier {
  if (followerCount <= 10_000)    return "nano";
  if (followerCount <= 100_000)   return "micro";
  if (followerCount <= 1_000_000) return "mid";
  if (followerCount <= 10_000_000) return "macro";
  return "mega";
}

/**
 * Normalise raw Twitter metrics into a standardised format.
 * Used for trend intelligence signals only.
 *
 * @param raw - Raw metrics from profile data
 * @returns Normalised metrics with isBeta=true
 */
export function normaliseTwitterMetrics(raw: TwitterRawMetrics): TwitterNormalisedMetrics {
  const followerTier = classifyTwitterTier(raw.followerCount);

  const likes = raw.avgLikes ?? 0;
  const retweets = raw.avgRetweets ?? 0;
  const replies = raw.avgReplies ?? 0;
  const interactions = likes + retweets + replies;

  // Prefer impressions-based ER; fall back to follower-based
  let engagementRate: number;
  if (raw.avgImpressions != null && raw.avgImpressions > 0) {
    engagementRate = (interactions / raw.avgImpressions) * 100;
  } else if (raw.followerCount > 0) {
    engagementRate = (interactions / raw.followerCount) * 100;
  } else {
    engagementRate = 0;
  }

  // Retweet-to-like ratio (virality signal) — only when both available
  const retweetToLikeRatio =
    likes > 0 && raw.avgRetweets != null ? raw.avgRetweets / likes : null;

  // Impressions per follower (algorithmic reach)
  const impressionsPerFollower =
    raw.avgImpressions != null && raw.followerCount > 0
      ? raw.avgImpressions / raw.followerCount
      : null;

  // Active account check: >1 post/day over account lifetime
  const isActiveAccount =
    raw.postsCount != null && raw.accountAgeDays != null && raw.accountAgeDays > 0
      ? raw.postsCount / raw.accountAgeDays >= 1.0
      : false;

  return {
    followerTier,
    engagementRate: Math.min(100, engagementRate),
    retweetToLikeRatio,
    impressionsPerFollower,
    isActiveAccount,
    isBeta: true,
  };
}
