/**
 * _shared/engagement.ts
 *
 * Engagement-rate benchmark module.
 *
 * Provides platform-specific engagement benchmarks organised by follower
 * tier.  Values are medians derived from industry research; they match the
 * seed data in the `engagement_benchmarks` DB table.
 *
 * Keeping this in one place means a single PR can update all benchmarks
 * across every function that uses them.
 *
 * Consumers: search-influencers
 */

export type Platform = "instagram" | "tiktok" | "youtube";

export interface BenchmarkResult {
  rate: number;
  /** Follower-tier name matching DB enum. */
  bucket: "nano" | "micro" | "mid" | "macro" | "mega" | "unknown";
}

/**
 * Return the median benchmark engagement rate and tier bucket for a given
 * platform and follower count.
 *
 * If `followerCount` is null / zero, the overall platform default is returned
 * with bucket `"unknown"`.
 */
export function getBenchmarkEngagement(
  platform: string,
  followerCount: number | null,
): BenchmarkResult {
  const defaults: Record<string, number> = {
    instagram: 2.1,
    tiktok: 4.4,
    youtube: 2.2,
  };

  if (!followerCount || followerCount <= 0) {
    return { rate: defaults[platform] ?? 2.0, bucket: "unknown" };
  }

  if (platform === "instagram") {
    if (followerCount < 10_000) return { bucket: "nano", rate: 4.20 };
    if (followerCount < 50_000) return { bucket: "micro", rate: 2.80 };
    if (followerCount < 100_000) return { bucket: "mid", rate: 2.10 };
    if (followerCount < 500_000) return { bucket: "macro", rate: 1.60 };
    return { bucket: "mega", rate: 1.10 };
  }

  if (platform === "tiktok") {
    if (followerCount < 10_000) return { bucket: "nano", rate: 7.80 };
    if (followerCount < 50_000) return { bucket: "micro", rate: 5.90 };
    if (followerCount < 100_000) return { bucket: "mid", rate: 4.40 };
    if (followerCount < 500_000) return { bucket: "macro", rate: 3.20 };
    return { bucket: "mega", rate: 2.10 };
  }

  // youtube (and any unknown platform)
  if (followerCount < 10_000) return { bucket: "nano", rate: 3.50 };
  if (followerCount < 50_000) return { bucket: "micro", rate: 2.80 };
  if (followerCount < 100_000) return { bucket: "mid", rate: 2.20 };
  if (followerCount < 500_000) return { bucket: "macro", rate: 1.70 };
  return { bucket: "mega", rate: 1.20 };
}
