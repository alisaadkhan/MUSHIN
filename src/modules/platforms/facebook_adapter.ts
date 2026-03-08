/**
 * src/modules/platforms/facebook_adapter.ts
 *
 * Facebook platform adapter — BETA
 *
 * Facebook is a future platform for Mushin (roadmap Q3 2026).
 * This stub provides type definitions and placeholder functions
 * so the module can be imported and tested without errors.
 *
 * isBeta = true — all functions return graceful stubs.
 */

export const FACEBOOK_ADAPTER_IS_BETA = true;

export type FacebookFollowerTier = "nano" | "micro" | "mid" | "macro" | "mega";

/** Placeholder ER benchmarks — to be calibrated when live data is available */
export const FACEBOOK_ER_BENCHMARKS: Record<FacebookFollowerTier, { low: number; avg: number; high: number }> = {
  nano:  { low: 3.0,  avg: 6.0,  high: 12.0 },
  micro: { low: 1.5,  avg: 3.5,  high: 7.0  },
  mid:   { low: 0.8,  avg: 2.0,  high: 4.0  },
  macro: { low: 0.4,  avg: 1.2,  high: 2.5  },
  mega:  { low: 0.2,  avg: 0.8,  high: 1.5  },
};

export interface FacebookRawMetrics {
  followerCount: number | null;
  pageFollowers?: number | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  avgShares?: number | null;
  avgReach?: number | null;
}

export interface FacebookNormalisedMetrics {
  followerTier: FacebookFollowerTier;
  engagementRate: number | null;
  erBenchmark: { low: number; avg: number; high: number };
  isBeta: true;
}

export function classifyFacebookTier(followerCount: number): FacebookFollowerTier {
  if (followerCount < 10_000)    return "nano";
  if (followerCount < 100_000)   return "micro";
  if (followerCount < 1_000_000) return "mid";
  if (followerCount < 10_000_000) return "macro";
  return "mega";
}

/** Beta stub — returns partial metrics */
export function normaliseFacebookMetrics(raw: FacebookRawMetrics): FacebookNormalisedMetrics {
  const tier = classifyFacebookTier(raw.followerCount ?? 0);

  let engagementRate: number | null = null;
  const reach = raw.avgReach ?? raw.followerCount;
  if (reach && reach > 0) {
    const likes = raw.avgLikes ?? 0;
    const comments = raw.avgComments ?? 0;
    const shares = raw.avgShares ?? 0;
    engagementRate = Math.round(((likes + comments + shares) / reach) * 10000) / 100;
  }

  return {
    followerTier: tier,
    engagementRate,
    erBenchmark: FACEBOOK_ER_BENCHMARKS[tier],
    isBeta: true,
  };
}
