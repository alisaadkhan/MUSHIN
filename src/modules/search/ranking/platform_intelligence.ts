/**
 * ranking/platform_intelligence.ts
 *
 * Platform-aware scoring boosts for Mushin creator ranking.
 *
 * Each platform has distinct engagement signals that matter for commercial
 * relevance.  This module converts raw platform metrics into a normalised
 * boost score [0, 0.25] that gets mixed into the composite ranking formula.
 *
 * Boost logic per platform:
 *   YouTube   — view velocity + long-form engagement depth
 *   Instagram — comment authenticity + reel watch signal
 *   TikTok    — completion rate proxy + share momentum
 *
 * The score is designed to be ADDITIVE (max +0.25 to the final score)
 * so it can never alone determine ranking — it only tips near-equal results.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformIntelligenceInput {
  platform: string;
  followerCount: number | null;
  engagementRate: number | null;
  /** avg_likes per post */
  avgLikes: number | null;
  /** avg_comments per post */
  avgComments: number | null;
  /** avg_views per post/video */
  avgViews: number | null;
  /** avg_shares per post (TikTok / reels) */
  avgShares?: number | null;
  /** post count (used for YouTube frequency signal) */
  postsCount?: number | null;
  /** account age in days (used for velocity calculations) */
  accountAgeDays?: number | null;
}

export interface PlatformIntelligenceResult {
  /** Additive boost [0, 0.25]. */
  boost: number;
  /** Human-readable key signals that drove the boost. */
  signals: string[];
  /** Which sub-score dominated. */
  dominantSignal: string;
}

// ---------------------------------------------------------------------------
// Platform-specific engagement benchmarks
// Benchmarks are conservative — for ranking we reward above-average, not
// simply average performance.
// ---------------------------------------------------------------------------

const YOUTUBE_BENCHMARKS = {
  /** View-to-subscriber ratio that qualifies as "good velocity". */
  viewSubsRatioGood:      0.10,  // 10% of subs watch each video
  viewSubsRatioExcellent: 0.30,  // 30%+ subs reach = viral
  /** Comments-per-1000-views that indicates genuine long-form engagement. */
  commentsPerKviewsGood:  1.5,
};

const INSTAGRAM_BENCHMARKS = {
  /** Comment / like ratio that suggests authentic (non-bot) audience. */
  commentLikeRatioGood:      0.02,  // 2%+ comments to likes
  commentLikeRatioExcellent: 0.05,
  /** Engagement rate thresholds (reels proxy). */
  erGood:      2.5,
  erExcellent: 5.5,
};

const TIKTOK_BENCHMARKS = {
  /** Share / like ratio as a proxy for content virality. */
  sharelikeRatioGood:      0.03,  // 3%+
  sharelikeRatioExcellent: 0.10,
  /** View / follower ratio — proxy for For-You-Page reach. */
  viewFollowerRatioGood:      1.0,  // at least 100% of followers see it
  viewFollowerRatioExcellent: 3.0,  // 3× = strong FYP push
  erGood:      5.0,
  erExcellent: 9.0,
};

// ---------------------------------------------------------------------------
// Sub-scorers per platform
// ---------------------------------------------------------------------------

function scoreYouTube(input: PlatformIntelligenceInput): PlatformIntelligenceResult {
  const signals: string[] = [];
  let boost = 0.0;

  const followers = input.followerCount ?? 0;
  const views = input.avgViews;
  const comments = input.avgComments;

  // 1. View velocity (view-to-subscriber ratio)
  if (views !== null && followers > 0) {
    const vsr = views / followers;
    if (vsr >= YOUTUBE_BENCHMARKS.viewSubsRatioExcellent) {
      boost += 0.15;
      signals.push(`Excellent view velocity (${(vsr * 100).toFixed(0)}% of subs per video)`);
    } else if (vsr >= YOUTUBE_BENCHMARKS.viewSubsRatioGood) {
      boost += 0.08;
      signals.push(`Good view velocity (${(vsr * 100).toFixed(0)}% of subs per video)`);
    }
  }

  // 2. Long-form engagement depth (comments per 1K views)
  if (comments !== null && views !== null && views > 0) {
    const cpkv = (comments / views) * 1000;
    if (cpkv >= YOUTUBE_BENCHMARKS.commentsPerKviewsGood) {
      boost += 0.10;
      signals.push(`Strong post-view engagement (${cpkv.toFixed(1)} comments/1K views)`);
    } else if (cpkv >= 0.5) {
      boost += 0.04;
      signals.push(`Moderate post-view engagement`);
    }
  }

  // 3. Posting frequency (content consistency)
  if (input.accountAgeDays && input.postsCount) {
    const postsPerMonth = (input.postsCount / input.accountAgeDays) * 30;
    if (postsPerMonth >= 4) {
      boost += 0.05;
      signals.push(`Consistent upload cadence (~${postsPerMonth.toFixed(0)} videos/month)`);
    }
  }

  return {
    boost: Math.min(0.25, boost),
    signals,
    dominantSignal: signals[0] ?? "view_velocity",
  };
}

function scoreInstagram(input: PlatformIntelligenceInput): PlatformIntelligenceResult {
  const signals: string[] = [];
  let boost = 0.0;

  const likes = input.avgLikes;
  const comments = input.avgComments;
  const er = input.engagementRate;

  // 1. Comment authenticity ratio (high comments / likes = real audience)
  if (likes !== null && likes > 0 && comments !== null) {
    const clr = comments / likes;
    if (clr >= INSTAGRAM_BENCHMARKS.commentLikeRatioExcellent) {
      boost += 0.15;
      signals.push(`Highly authentic audience (${(clr * 100).toFixed(1)}% comment-to-like ratio)`);
    } else if (clr >= INSTAGRAM_BENCHMARKS.commentLikeRatioGood) {
      boost += 0.08;
      signals.push(`Good comment-to-like ratio (${(clr * 100).toFixed(1)}%)`);
    }
  }

  // 2. Engagement rate (reel watch signal proxy)
  if (er !== null) {
    if (er >= INSTAGRAM_BENCHMARKS.erExcellent) {
      boost += 0.12;
      signals.push(`Excellent engagement rate (${er.toFixed(1)}%)`);
    } else if (er >= INSTAGRAM_BENCHMARKS.erGood) {
      boost += 0.06;
      signals.push(`Above-average engagement rate (${er.toFixed(1)}%)`);
    }
  }

  return {
    boost: Math.min(0.25, boost),
    signals,
    dominantSignal: signals[0] ?? "comment_authenticity",
  };
}

function scoreTikTok(input: PlatformIntelligenceInput): PlatformIntelligenceResult {
  const signals: string[] = [];
  let boost = 0.0;

  const followers = input.followerCount ?? 0;
  const likes = input.avgLikes;
  const shares = input.avgShares;
  const views = input.avgViews;
  const er = input.engagementRate;

  // 1. Share momentum (viral signal)
  if (shares !== null && likes !== null && likes > 0) {
    const slr = shares / likes;
    if (slr >= TIKTOK_BENCHMARKS.sharelikeRatioExcellent) {
      boost += 0.15;
      signals.push(`Viral share momentum (${(slr * 100).toFixed(1)}% share-to-like ratio)`);
    } else if (slr >= TIKTOK_BENCHMARKS.sharelikeRatioGood) {
      boost += 0.08;
      signals.push(`Good shareability (${(slr * 100).toFixed(1)}% share-to-like)`);
    }
  }

  // 2. For-You-Page reach (views / followers — completion rate proxy)
  if (views !== null && followers > 0) {
    const vfr = views / followers;
    if (vfr >= TIKTOK_BENCHMARKS.viewFollowerRatioExcellent) {
      boost += 0.12;
      signals.push(`Strong FYP reach (${vfr.toFixed(1)}× follower views per post)`);
    } else if (vfr >= TIKTOK_BENCHMARKS.viewFollowerRatioGood) {
      boost += 0.06;
      signals.push(`Good FYP reach (${vfr.toFixed(1)}× follower views)`);
    }
  }

  // 3. Engagement rate boost
  if (er !== null) {
    if (er >= TIKTOK_BENCHMARKS.erExcellent) {
      boost += 0.08;
      signals.push(`Excellent TikTok ER (${er.toFixed(1)}%)`);
    } else if (er >= TIKTOK_BENCHMARKS.erGood) {
      boost += 0.04;
    }
  }

  return {
    boost: Math.min(0.25, boost),
    signals,
    dominantSignal: signals[0] ?? "fyp_reach",
  };
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * Compute a platform-specific intelligence boost for a creator.
 *
 * @param input  Platform + metric data. All metric fields are optional.
 * @returns      PlatformIntelligenceResult with a boost value in [0, 0.25].
 *               Returns boost=0 when input lacks sufficient data.
 */
export function computePlatformIntelligenceBoost(
  input: PlatformIntelligenceInput,
): PlatformIntelligenceResult {
  const p = (input.platform ?? "").toLowerCase();

  if (p === "youtube") return scoreYouTube(input);
  if (p === "instagram") return scoreInstagram(input);
  if (p === "tiktok") return scoreTikTok(input);

  // Unknown / future platform — no boost
  return { boost: 0, signals: [], dominantSignal: "none" };
}
