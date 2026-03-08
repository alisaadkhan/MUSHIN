/**
 * src/modules/platforms/tiktok_adapter.ts
 *
 * TikTok-specific metric normalisation and engagement benchmarks.
 * TikTok ER is typically higher than Instagram for the same follower count.
 */

export type TikTokFollowerTier = "nano" | "micro" | "mid" | "macro" | "mega";

/** Pakistani market TikTok ER benchmarks (views-based) */
export const TIKTOK_ER_BENCHMARKS: Record<TikTokFollowerTier, { low: number; avg: number; high: number }> = {
  nano:  { low: 5.0,  avg: 10.0, high: 20.0 },
  micro: { low: 3.5,  avg: 7.0,  high: 14.0 },
  mid:   { low: 2.0,  avg: 5.0,  high: 10.0 },
  macro: { low: 1.0,  avg: 3.0,  high: 6.0  },
  mega:  { low: 0.5,  avg: 2.0,  high: 4.0  },
};

export interface TikTokRawMetrics {
  followerCount: number | null;
  followingCount?: number | null;
  videoCount?: number | null;
  avgViews?: number | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  avgShares?: number | null;
}

export interface TikTokNormalisedMetrics {
  followerTier: TikTokFollowerTier;
  /** Views-based ER — primary TikTok metric */
  engagementRate: number | null;
  /** Share-to-like ratio — virality signal */
  shareToLikeRatio: number | null;
  /** Views / followers — FYP reach signal */
  viewsPerFollower: number | null;
  erBenchmark: { low: number; avg: number; high: number };
}

export function classifyTikTokTier(followerCount: number): TikTokFollowerTier {
  if (followerCount < 10_000)    return "nano";
  if (followerCount < 100_000)   return "micro";
  if (followerCount < 1_000_000) return "mid";
  if (followerCount < 10_000_000) return "macro";
  return "mega";
}

/**
 * Normalise raw TikTok metrics into a standard format for ranking.
 * TikTok ER is computed on views (not followers) since FYP distribution
 * reaches non-followers.
 */
export function normaliseTikTokMetrics(raw: TikTokRawMetrics): TikTokNormalisedMetrics {
  const tier = classifyTikTokTier(raw.followerCount ?? 0);

  let engagementRate: number | null = null;
  if (raw.avgViews && raw.avgViews > 0) {
    const likes = raw.avgLikes ?? 0;
    const comments = raw.avgComments ?? 0;
    const shares = raw.avgShares ?? 0;
    engagementRate = Math.round(((likes + comments + shares) / raw.avgViews) * 10000) / 100;
  }

  let shareToLikeRatio: number | null = null;
  if (raw.avgLikes && raw.avgLikes > 0 && raw.avgShares !== undefined) {
    shareToLikeRatio = Math.round(((raw.avgShares ?? 0) / raw.avgLikes) * 10000) / 10000;
  }

  let viewsPerFollower: number | null = null;
  if (raw.followerCount && raw.followerCount > 0 && raw.avgViews) {
    viewsPerFollower = Math.round((raw.avgViews / raw.followerCount) * 100) / 100;
  }

  return {
    followerTier: tier,
    engagementRate,
    shareToLikeRatio,
    viewsPerFollower,
    erBenchmark: TIKTOK_ER_BENCHMARKS[tier],
  };
}
