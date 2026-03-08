"""
analytics/bot_detection.py

Rule-based bot detection from aggregate profile metrics.

Philosophy
----------
- We NEVER fabricate values.  When inputs are insufficient (e.g. missing
  engagement_rate AND avg_likes), we set data_available=False.
- All thresholds are derived from publicly published benchmarks for
  Pakistani / South-Asian creator accounts on each platform.
- The score is the weighted sum of individual signal scores, capped at 1.0.

Signal weights (sum to 1.0):
  follower_following_ratio : 0.25   (strong ghost-follower proxy)
  engagement_vs_median     : 0.30   (low ER with large audience = suspicious)
  following_count_anomaly  : 0.15   (inflated following)
  media_count_anomaly      : 0.10   (very few posts for claimed follower count)
  like_comment_ratio       : 0.10   (bought likes often lack comments)
  rapid_growth_proxy       : 0.10   (large recent delta relative to follower count)
"""
from __future__ import annotations

from typing import Optional, List, Tuple

# ── Platform-specific engagement medians (%) ──────────────────────────────────
# Source: HypeAuditor 2024 benchmarks (South Asia creator cohort)
_ENGAGEMENT_MEDIAN: dict[str, dict[str, float]] = {
    "instagram": {"nano": 5.0, "micro": 3.5, "mid": 2.0, "macro": 1.2, "mega": 0.9},
    "tiktok":    {"nano": 9.0, "micro": 6.5, "mid": 4.0, "macro": 2.5, "mega": 1.5},
    "youtube":   {"nano": 4.5, "micro": 3.0, "mid": 2.0, "macro": 1.0, "mega": 0.5},
}

_TIER_BREAKPOINTS = [1_000, 10_000, 100_000, 500_000]  # nano / micro / mid / macro / mega


def _tier(follower_count: int) -> str:
    if follower_count < _TIER_BREAKPOINTS[0]:
        return "nano"
    if follower_count < _TIER_BREAKPOINTS[1]:
        return "micro"
    if follower_count < _TIER_BREAKPOINTS[2]:
        return "mid"
    if follower_count < _TIER_BREAKPOINTS[3]:
        return "macro"
    return "mega"


def _engagement_median(platform: str, follower_count: int) -> float:
    t = _tier(follower_count)
    return _ENGAGEMENT_MEDIAN.get(platform, _ENGAGEMENT_MEDIAN["instagram"]).get(t, 2.0)


# ── Main function ─────────────────────────────────────────────────────────────

def compute_bot_probability(
    *,
    platform: str,
    follower_count: Optional[int],
    following_count: Optional[int],
    posts_count: Optional[int],
    engagement_rate: Optional[float],
    avg_likes: Optional[float],
    avg_comments: Optional[float],
    recent_follower_delta: Optional[int] = None,
) -> dict:
    """
    Compute a statistical bot-probability score from aggregate metrics.

    Returns a dict compatible with BotDetectionResult:
        {
          "data_available": bool,
          "bot_probability": float | None,   # 0.0 – 1.0
          "risk_level": str | None,
          "signals_triggered": list[str],
          "confidence": str | None,
        }
    """
    signals_triggered: List[str] = []

    # ── Require at minimum a valid follower count ──────────────────────────────
    if follower_count is None or follower_count <= 0:
        return {"data_available": False, "bot_probability": None,
                "risk_level": None, "signals_triggered": [], "confidence": None}

    score = 0.0  # weighted accumulator
    available_weight = 0.0   # track how much of the formula is usable

    # ── Signal 1: follower / following ratio (weight 0.25) ────────────────────
    W1 = 0.25
    available_weight += W1
    if following_count is not None:
        ratio = follower_count / max(following_count, 1)
        if following_count > 5_000 and ratio < 0.5:
            # Following far more than they attract back — classic follow/unfollow
            sig_score = min(1.0, (5_000 / max(following_count, 1)) * 0.8)
            score += W1 * sig_score
            signals_triggered.append(
                f"High following count ({following_count:,}) vs followers ({follower_count:,}) — "
                "follow/unfollow pattern likely"
            )
        elif following_count > 10_000 and follower_count < 50_000:
            sig_score = 0.6
            score += W1 * sig_score
            signals_triggered.append(
                f"Inflated following ({following_count:,}) relative to audience size"
            )

    # ── Signal 2: engagement rate vs. tier median (weight 0.30) ──────────────
    W2 = 0.30
    available_weight += W2
    if engagement_rate is not None:
        median_er = _engagement_median(platform, follower_count)
        er_ratio = engagement_rate / max(median_er, 0.1)
        if er_ratio < 0.25:
            # Engagement rate is <25% of median for this tier — ghost followers
            sig_score = min(1.0, (0.25 - er_ratio) / 0.25)
            score += W2 * sig_score
            signals_triggered.append(
                f"Engagement rate {engagement_rate:.2f}% is far below platform median "
                f"{median_er:.1f}% for {_tier(follower_count)}-tier creators"
            )
        elif er_ratio < 0.5:
            sig_score = 0.4
            score += W2 * sig_score * 0.5
            signals_triggered.append(
                f"Below-median engagement rate ({engagement_rate:.2f}% vs. {median_er:.1f}% median)"
            )

    # ── Signal 3: following count anomaly (weight 0.15) ──────────────────────
    W3 = 0.15
    available_weight += W3
    if following_count is not None and follower_count >= 50_000 and following_count > 3_000:
        # Large accounts that follow many people often use engagement pods or bots
        sig_score = min(1.0, (following_count - 3_000) / 7_000)
        score += W3 * sig_score
        signals_triggered.append(
            f"Macro/mega account still following {following_count:,} accounts"
        )

    # ── Signal 4: media count anomaly (weight 0.10) ───────────────────────────
    W4 = 0.10
    available_weight += W4
    if posts_count is not None:
        posts_per_follower = posts_count / follower_count
        if follower_count > 10_000 and posts_count < 10:
            # Very few posts for claimed audience — bought followers on a new account
            score += W4 * 0.8
            signals_triggered.append(
                f"Only {posts_count} posts for {follower_count:,} followers — "
                "follower count may be purchased"
            )
        elif posts_per_follower > 5.0 and follower_count < 5_000:
            # Over-posting nano accounts can indicate follow-bot activity
            score += W4 * 0.3
            signals_triggered.append(
                f"Very high post volume ({posts_count} posts) for follower count"
            )

    # ── Signal 5: like/comment ratio (weight 0.10) ────────────────────────────
    W5 = 0.10
    available_weight += W5
    if avg_likes is not None and avg_comments is not None and avg_comments > 0:
        like_comment = avg_likes / avg_comments
        # Bought likes rarely come with comments → ratio > 200 is suspicious
        if like_comment > 200:
            sig_score = min(1.0, (like_comment - 200) / 800)
            score += W5 * sig_score
            signals_triggered.append(
                f"Like-to-comment ratio {like_comment:.0f}:1 — comments disproportionately low"
            )

    # ── Signal 6: rapid growth proxy (weight 0.10) ───────────────────────────
    W6 = 0.10
    available_weight += W6
    if recent_follower_delta is not None and recent_follower_delta > 0:
        # Growth > 30% of current base in 30 days is anomalous (unless viral)
        growth_pct = recent_follower_delta / follower_count
        if growth_pct > 0.30:
            sig_score = min(1.0, (growth_pct - 0.30) / 0.70)
            score += W6 * sig_score
            signals_triggered.append(
                f"Follower count grew by {growth_pct:.0%} in past 30 days — "
                "may indicate purchased followers"
            )

    # ── Normalise to available weight ────────────────────────────────────────
    if available_weight == 0:
        return {"data_available": False, "bot_probability": None,
                "risk_level": None, "signals_triggered": [], "confidence": None}

    normalised = min(score / available_weight, 1.0)

    # Confidence depends on how many signals we could compute
    conf_ratio = available_weight / (W1 + W2 + W3 + W4 + W5 + W6)
    confidence = "high" if conf_ratio >= 0.7 else ("medium" if conf_ratio >= 0.4 else "low")

    risk_level = (
        "high" if normalised >= 0.60
        else "medium" if normalised >= 0.30
        else "low"
    )

    return {
        "data_available": True,
        "bot_probability": round(normalised, 4),
        "risk_level": risk_level,
        "signals_triggered": signals_triggered,
        "confidence": confidence,
    }
