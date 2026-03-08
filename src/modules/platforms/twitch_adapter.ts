/**
 * src/modules/platforms/twitch_adapter.ts
 *
 * Twitch platform adapter — BETA
 *
 * Twitch is a future platform for Mushin (roadmap Q3 2026).
 * This stub provides type definitions and placeholder functions
 * so the module can be imported and tested without errors.
 *
 * isBeta = true — all functions return graceful stubs.
 */

export const TWITCH_ADAPTER_IS_BETA = true;

export type TwitchFollowerTier = "nano" | "micro" | "mid" | "macro" | "mega";

/** Placeholder ER benchmarks — to be calibrated when live data is available */
export const TWITCH_ER_BENCHMARKS: Record<TwitchFollowerTier, { low: number; avg: number; high: number }> = {
  nano:  { low: 10.0, avg: 20.0, high: 40.0 },
  micro: { low: 5.0,  avg: 12.0, high: 25.0 },
  mid:   { low: 3.0,  avg: 7.0,  high: 15.0 },
  macro: { low: 1.5,  avg: 4.0,  high: 8.0  },
  mega:  { low: 0.8,  avg: 2.5,  high: 5.0  },
};

export interface TwitchRawMetrics {
  followerCount: number | null;
  avgViewers?: number | null;
  subscriberCount?: number | null;
  hoursStreamed?: number | null;
}

export interface TwitchNormalisedMetrics {
  followerTier: TwitchFollowerTier;
  /** Avg concurrent viewers / followers */
  viewerRatio: number | null;
  erBenchmark: { low: number; avg: number; high: number };
  isBeta: true;
}

export function classifyTwitchTier(followerCount: number): TwitchFollowerTier {
  if (followerCount < 1_000)    return "nano";
  if (followerCount < 10_000)   return "micro";
  if (followerCount < 100_000)  return "mid";
  if (followerCount < 1_000_000) return "macro";
  return "mega";
}

/** Beta stub — returns partial metrics */
export function normaliseTwitchMetrics(raw: TwitchRawMetrics): TwitchNormalisedMetrics {
  const tier = classifyTwitchTier(raw.followerCount ?? 0);

  let viewerRatio: number | null = null;
  if (raw.followerCount && raw.followerCount > 0 && raw.avgViewers) {
    viewerRatio = Math.round((raw.avgViewers / raw.followerCount) * 10000) / 10000;
  }

  return {
    followerTier: tier,
    viewerRatio,
    erBenchmark: TWITCH_ER_BENCHMARKS[tier],
    isBeta: true,
  };
}
