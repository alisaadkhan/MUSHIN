/**
 * _shared/bot_signals.ts
 *
 * Bot-detection module — two exports:
 *
 * 1. `analyzeFullBotSignals`  — 16-signal heuristic analysis used by the
 *    `detect-bot-entendre` edge function.  Returns a detailed signal list,
 *    aggregate score (0–100), and data-quality confidence level.
 *
 * 2. `computeQuickBotScore`  — fast 6-factor check used during enrichment
 *    (enrich-influencer) where we only have the basic profile metrics and
 *    don't need a full signal breakdown.
 *
 * Isolating bot logic here means the scoring algorithm can be tuned once
 * and the fix propagates to both consumers automatically.
 *
 * Consumers: detect-bot-entendre, enrich-influencer
 */

// ── Shared types ───────────────────────────────────────────────────────────────

export interface BotAnalysisInput {
  username: string;
  platform: "instagram" | "youtube" | "tiktok";
  follower_count: number;
  following_count: number | null;
  posts_count: number | null;
  engagement_rate: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  account_age_days: number | null;
  bio: string | null;
  /** Number of clearly sponsored posts, if available from post data. */
  sponsored_post_count?: number | null;
  /** Total post count used for sponsored ratio calculation. */
  total_post_count?: number | null;
  /** Net follower change in the last 30 days (positive = growth). */
  recent_follower_delta?: number | null;
  /** Whether an abnormal 7-day growth spike was detected in follower_history. */
  has_growth_spike?: boolean | null;
}

export interface BotSignal {
  name: string;
  triggered: boolean;
  score: number;
  detail: string;
  severity: "low" | "medium" | "high";
}

export interface FullBotAnalysisResult {
  /** 0–100 probability score (higher = more likely bot / purchased followers). */
  score: number;
  signals: BotSignal[];
  confidence: "low" | "medium" | "high";
}

// ── Full 16-signal analysis ────────────────────────────────────────────────────

/**
 * Run the full 16-signal bot-detection analysis on a profile.
 * Used by `detect-bot-entendre` where we have comprehensive data.
 */
export function analyzeFullBotSignals(input: BotAnalysisInput): FullBotAnalysisResult {
  const signals: BotSignal[] = [];
  let totalScore = 0;

  const add = (
    name: string,
    triggered: boolean,
    score: number,
    detail: string,
    severity: "low" | "medium" | "high",
  ) => {
    signals.push({ name, triggered, score: triggered ? score : 0, detail, severity });
    if (triggered) totalScore += score;
  };

  const {
    follower_count, following_count, engagement_rate, avg_likes, avg_comments,
    account_age_days, bio, posts_count, sponsored_post_count, total_post_count,
    recent_follower_delta,
  } = input;

  // Signal 1: Follower/Following ratio
  if (following_count !== null && follower_count > 0) {
    const ratio = following_count / follower_count;
    add("high_following_ratio", ratio > 3, 20,
      `Following/follower ratio: ${ratio.toFixed(2)} (>3 is suspicious)`, "high");
    add("low_following_ratio", ratio < 0.01, 10,
      `Almost no following: ratio ${ratio.toFixed(3)}`, "low");
  }

  // Signal 2: Engagement anomalies
  if (engagement_rate !== null) {
    add("unrealistic_high_er",
      follower_count > 100_000 && engagement_rate > 20, 25,
      `${engagement_rate.toFixed(1)}% ER with ${(follower_count / 1000).toFixed(0)}K followers is unrealistic`, "high");
    add("dead_audience",
      follower_count > 10_000 && engagement_rate < 0.1, 20,
      `${engagement_rate.toFixed(2)}% ER — audience not engaging (likely bought followers)`, "high");
    add("low_er_large_account",
      follower_count > 50_000 && engagement_rate < 0.5, 10,
      `Below-average ER for account size`, "medium");
  }

  // Signal 3: Comment/like ratio
  if (avg_likes !== null && avg_comments !== null && avg_likes > 0) {
    const clRatio = avg_comments / avg_likes;
    add("no_comments",
      avg_likes > 100 && clRatio < 0.003, 15,
      `Comments nearly absent (${clRatio.toFixed(4)} per like)`, "medium");
  }

  // Signal 4: Round follower count
  add("round_followers",
    follower_count > 10_000 && follower_count % 1000 === 0, 8,
    `Exact round number: ${follower_count.toLocaleString()} (bots sold in round thousands)`, "low");

  // Signal 5: New account, large following
  if (account_age_days !== null) {
    add("new_account_spike",
      account_age_days < 180 && follower_count > 50_000, 22,
      `Account only ${account_age_days} days old with ${(follower_count / 1000).toFixed(0)}K followers`, "high");

    // Signal 6: Abnormal growth rate
    const growthPerDay = account_age_days > 0 ? follower_count / account_age_days : 0;
    add("abnormal_growth_rate",
      account_age_days > 30 && growthPerDay > 500, 15,
      `Avg ${Math.round(growthPerDay)} followers/day — organic growth rarely exceeds 200/day`, "medium");
  }

  // Signal 7: Sudden follower spike
  if (recent_follower_delta !== null && follower_count > 0) {
    const spikePct = (recent_follower_delta / follower_count) * 100;
    add("recent_spike",
      spikePct > 30 && recent_follower_delta > 5000, 18,
      `+${recent_follower_delta.toLocaleString()} followers in last 30 days (${spikePct.toFixed(1)}% spike)`, "high");
  }

  // Signal 8: Empty / minimal bio
  const bioLen = (bio || "").trim().length;
  add("empty_bio", bioLen < 5, 12, "No bio — weak signal but common in bot accounts", "low");
  add("minimal_bio", bioLen >= 5 && bioLen < 20, 5, "Very short bio", "low");

  // Signal 9: Post frequency
  if (posts_count !== null && account_age_days !== null && account_age_days > 7) {
    const postsPerDay = posts_count / account_age_days;
    add("excessive_posting",
      postsPerDay > 5, 10,
      `${postsPerDay.toFixed(1)} posts/day average — may indicate automated content`, "medium");
  }

  // Signal 10: Sponsored content ratio
  if (sponsored_post_count != null && total_post_count != null && total_post_count > 0) {
    const sponsoredPct = (sponsored_post_count / total_post_count) * 100;
    add("high_sponsored_ratio",
      sponsoredPct > 40, 8,
      `${sponsoredPct.toFixed(0)}% sponsored posts (>40% may mislead on organic reach)`, "low");
  }

  // Signal 11: Platform-specific ER benchmarks
  if (engagement_rate !== null) {
    const bench: Record<string, { low: number; high: number }> = {
      instagram: { low: 0.3, high: 15 },
      tiktok: { low: 0.5, high: 30 },
      youtube: { low: 0.2, high: 12 },
    };
    const b = bench[input.platform] ?? { low: 0.3, high: 15 };
    add("platform_er_outlier",
      engagement_rate > b.high && follower_count > 50_000, 18,
      `${engagement_rate.toFixed(1)}% ER exceeds ${input.platform} benchmark ceiling (${b.high}%)`, "high");
  }

  // Signal 12: TikTok like/view ratio
  if (avg_likes !== null && input.platform === "tiktok") {
    const avgViewsApprox = avg_likes > 0 ? avg_likes * 15 : null;
    if (avgViewsApprox && avg_likes / avgViewsApprox > 0.15) {
      add("tiktok_like_view_ratio", true, 12,
        `High like-to-view ratio suggests engagement pods or purchased likes`, "medium");
    }
  }

  // Signal 13: Username entropy
  const username = input.username || "";
  const hasNumbers = /\d{4,}/.test(username);
  const hasRandomChars = /[a-z]{2,}\d{3,}[a-z]*/i.test(username);
  add("suspicious_username",
    hasNumbers && hasRandomChars && username.length > 12, 8,
    `Username pattern (${username}) has numeric suffix common in auto-generated accounts`, "low");

  // Signal 14: Very low post rate for large account
  if (posts_count !== null && account_age_days !== null && account_age_days > 30) {
    const postsPerWeek = (posts_count / account_age_days) * 7;
    add("very_low_post_rate",
      postsPerWeek < 0.1 && follower_count > 50_000, 12,
      `Only ${postsPerWeek.toFixed(2)} posts/week — very large following with almost no content`, "medium");
  }

  // Signal 15: Followers per post ratio
  if (posts_count !== null && posts_count > 0) {
    const followersPerPost = follower_count / posts_count;
    add("abnormal_followers_per_post",
      followersPerPost > 50_000 && follower_count > 100_000, 10,
      `${Math.round(followersPerPost).toLocaleString()} followers per post — suggests bulk follower acquisition`, "medium");
  }

  // Signal 16: DB-backed follower growth spike
  if (input.has_growth_spike === true) {
    add("follower_growth_spike", true, 25,
      "Abnormal 7-day follower growth spike detected (highly indicative of purchased followers)", "high");
  }

  // Confidence: degrade when key inputs are missing
  const nullCount = [engagement_rate, following_count, account_age_days, avg_likes, avg_comments]
    .filter(v => v === null).length;
  let confidence: "low" | "medium" | "high" =
    nullCount >= 3 ? "low" : nullCount >= 1 ? "medium" : "high";
  if (input.has_growth_spike !== null && confidence === "low") confidence = "medium";

  return {
    score: Math.min(100, Math.round(totalScore)),
    signals,
    confidence,
  };
}

// ── Quick 6-factor check (used during enrichment) ──────────────────────────────

export interface QuickBotInput {
  followers: number;
  following: number;
  postsCount: number;
  engagementRate: number;
  bioLength: number;
}

/**
 * Fast, low-data-requirement bot probability estimate.
 * Used at enrichment time when detailed signal data isn't yet available.
 * Returns a 0–100 score; caller can derive audience_quality_score as `100 - score`.
 */
export function computeQuickBotScore(p: QuickBotInput): number {
  let score = 0;
  const { followers, following, postsCount, engagementRate, bioLength } = p;

  const ratio = followers > 0 ? following / followers : 10;
  if (ratio > 5) score += 25;
  else if (ratio > 2) score += 12;

  if (engagementRate > 20) score += 20;
  else if (engagementRate < 0.5 && followers > 10_000) score += 20;
  else if (engagementRate < 1 && followers > 50_000) score += 10;

  if (postsCount === 0) score += 20;
  else if (postsCount < 5) score += 8;

  if (bioLength === 0) score += 15;
  else if (bioLength < 10) score += 8;

  if (followers > 500_000 && following > 5_000) score += 10;

  return Math.min(score, 100);
}
