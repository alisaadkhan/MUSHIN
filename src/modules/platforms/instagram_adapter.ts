/**
 * src/modules/platforms/instagram_adapter.ts
 *
 * Instagram-specific metric normalisation and engagement benchmarks.
 * Tuned for Pakistani influencer market (2026 baselines).
 */

export type InstagramFollowerTier = "nano" | "micro" | "mid" | "macro" | "mega";

/** Industry-standard Pakistani market ER benchmarks for Instagram */
export const INSTAGRAM_ER_BENCHMARKS: Record<InstagramFollowerTier, { low: number; avg: number; high: number }> = {
  nano:  { low: 4.0,  avg: 8.0,  high: 15.0 },
  micro: { low: 2.5,  avg: 5.0,  high: 10.0 },
  mid:   { low: 1.5,  avg: 3.0,  high: 6.0  },
  macro: { low: 0.8,  avg: 1.8,  high: 3.5  },
  mega:  { low: 0.3,  avg: 1.0,  high: 2.0  },
};

export interface InstagramRawMetrics {
  followerCount: number | null;
  followingCount?: number | null;
  postsCount?: number | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  avgViews?: number | null;   // Reels views
}

export interface InstagramNormalisedMetrics {
  followerTier: InstagramFollowerTier;
  engagementRate: number | null;      // % (likes+comments / followers * 100)
  commentToLikeRatio: number | null;  // Authenticity signal
  reelsEngagementRate: number | null; // Views-based ER if available
  erBenchmark: { low: number; avg: number; high: number };
}

export function classifyInstagramTier(followerCount: number): InstagramFollowerTier {
  if (followerCount < 10_000)    return "nano";
  if (followerCount < 100_000)   return "micro";
  if (followerCount < 1_000_000) return "mid";
  if (followerCount < 10_000_000) return "macro";
  return "mega";
}

/**
 * Normalise raw Instagram metrics into a standard format for ranking.
 */
export function normaliseInstagramMetrics(raw: InstagramRawMetrics): InstagramNormalisedMetrics {
  const tier = classifyInstagramTier(raw.followerCount ?? 0);

  let engagementRate: number | null = null;
  if (raw.followerCount && raw.followerCount > 0) {
    const likes = raw.avgLikes ?? 0;
    const comments = raw.avgComments ?? 0;
    engagementRate = Math.round(((likes + comments) / raw.followerCount) * 10000) / 100;
  }

  let commentToLikeRatio: number | null = null;
  if (raw.avgLikes && raw.avgLikes > 0 && raw.avgComments !== undefined) {
    commentToLikeRatio = Math.round(((raw.avgComments ?? 0) / raw.avgLikes) * 10000) / 10000;
  }

  let reelsEngagementRate: number | null = null;
  if (raw.avgViews && raw.avgViews > 0 && raw.followerCount) {
    const likes = raw.avgLikes ?? 0;
    const comments = raw.avgComments ?? 0;
    reelsEngagementRate = Math.round(((likes + comments) / raw.avgViews) * 10000) / 100;
  }

  return {
    followerTier: tier,
    engagementRate,
    commentToLikeRatio,
    reelsEngagementRate,
    erBenchmark: INSTAGRAM_ER_BENCHMARKS[tier],
  };
}
