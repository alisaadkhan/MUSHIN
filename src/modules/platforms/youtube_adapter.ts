/**
 * src/modules/platforms/youtube_adapter.ts
 *
 * YouTube-specific metric normalisation and engagement benchmarks.
 * All thresholds are tuned for the Pakistani creator market.
 */

export type YouTubeFollowerTier = "nano" | "micro" | "mid" | "macro" | "mega";

/** Engagement rate benchmarks by subscriber tier (Pakistani market) */
export const YOUTUBE_ER_BENCHMARKS: Record<YouTubeFollowerTier, { low: number; avg: number; high: number }> = {
  nano:  { low: 3.0,  avg: 6.0,  high: 12.0 }, // < 10K subs
  micro: { low: 2.0,  avg: 4.0,  high: 8.0  }, // 10K–100K
  mid:   { low: 1.5,  avg: 3.0,  high: 6.0  }, // 100K–1M
  macro: { low: 0.8,  avg: 2.0,  high: 4.0  }, // 1M–10M
  mega:  { low: 0.5,  avg: 1.2,  high: 2.5  }, // 10M+
};

export interface YouTubeRawMetrics {
  subscriberCount: number | null;
  viewCount: number | null;       // total channel views
  videoCount: number | null;
  avgViews?: number | null;       // avg views per video (30-day)
  avgLikes?: number | null;
  avgComments?: number | null;
}

export interface YouTubeNormalisedMetrics {
  followerTier: YouTubeFollowerTier;
  engagementRate: number | null;     // % (likes+comments / views * 100)
  viewsPerSubscriber: number | null; // video viewership ratio
  postsPerMonth: number | null;
  erBenchmark: { low: number; avg: number; high: number };
}

export function classifyYouTubeTier(subscriberCount: number): YouTubeFollowerTier {
  if (subscriberCount < 10_000)    return "nano";
  if (subscriberCount < 100_000)   return "micro";
  if (subscriberCount < 1_000_000) return "mid";
  if (subscriberCount < 10_000_000) return "macro";
  return "mega";
}

/**
 * Normalise raw YouTube metrics into a standard format for ranking.
 */
export function normaliseYouTubeMetrics(raw: YouTubeRawMetrics): YouTubeNormalisedMetrics {
  const tier = classifyYouTubeTier(raw.subscriberCount ?? 0);

  let engagementRate: number | null = null;
  if (raw.avgViews && raw.avgViews > 0 && raw.avgLikes !== undefined) {
    const likes = raw.avgLikes ?? 0;
    const comments = raw.avgComments ?? 0;
    engagementRate = Math.round(((likes + comments) / raw.avgViews) * 10000) / 100;
  }

  let viewsPerSubscriber: number | null = null;
  if (raw.subscriberCount && raw.subscriberCount > 0 && raw.avgViews) {
    viewsPerSubscriber = Math.round((raw.avgViews / raw.subscriberCount) * 1000) / 1000;
  }

  let postsPerMonth: number | null = null;
  if (raw.videoCount && raw.videoCount > 0) {
    // Estimate from total video count; assume active for 3 years avg
    postsPerMonth = Math.round((raw.videoCount / 36) * 10) / 10;
  }

  return {
    followerTier: tier,
    engagementRate,
    viewsPerSubscriber,
    postsPerMonth,
    erBenchmark: YOUTUBE_ER_BENCHMARKS[tier],
  };
}
