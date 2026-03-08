"""
analytics/growth_models.py

Creator Growth Velocity Intelligence.

Philosophy
──────────
- No fabrication: all signals derived from metrics the caller provides.
- When data is insufficient (e.g. no follower delta), that signal is omitted
  and its weight redistributed to available signals.
- Returns confidence_level so callers can decide whether to surface the score.

Growth Score Formula (weights sum to 1.0 over available signals):
  follower_acceleration    × 0.40   — net growth relative to current base
  engagement_stability     × 0.35   — consistency (low ER variance = stable)
  content_consistency      × 0.25   — regular posting cadence

Output range: [0, 1]
  0.0 – 0.29  = declining / stagnant
  0.30 – 0.59 = stable
  0.60 – 0.79 = accelerating
  0.80 – 1.00 = high-growth creator
"""
from __future__ import annotations

from typing import Optional

# ── Benchmarks ─────────────────────────────────────────────────────────────
# Growth percentages per 30-day window considered healthy for each tier.
_GROWTH_BENCHMARKS: dict[str, dict] = {
    "nano":  {"floor": 0.02, "good": 0.08, "excellent": 0.20},  # 2–20%
    "micro": {"floor": 0.01, "good": 0.05, "excellent": 0.12},
    "mid":   {"floor": 0.005,"good": 0.02, "excellent": 0.06},
    "macro": {"floor": 0.002,"good": 0.01, "excellent": 0.03},
    "mega":  {"floor": 0.001,"good": 0.005,"excellent": 0.015},
}

_TIER_BREAKPOINTS = [1_000, 10_000, 100_000, 500_000]


def _tier(follower_count: int) -> str:
    if follower_count < _TIER_BREAKPOINTS[0]:   return "nano"
    if follower_count < _TIER_BREAKPOINTS[1]:   return "micro"
    if follower_count < _TIER_BREAKPOINTS[2]:   return "mid"
    if follower_count < _TIER_BREAKPOINTS[3]:   return "macro"
    return "mega"


def compute_growth_velocity_score(
    *,
    platform: str,
    follower_count: Optional[int],
    recent_follower_delta: Optional[int] = None,
    engagement_rate: Optional[float] = None,
    engagement_rate_prev: Optional[float] = None,     # previous period ER (optional)
    posts_count: Optional[int] = None,
    account_age_days: Optional[int] = None,
) -> dict:
    """
    Compute a growth velocity score for a creator from aggregate metrics.

    Returns:
        {
          "data_available": bool,
          "growth_score": float | None,           # 0.0 – 1.0
          "growth_tier": str | None,              # declining | stable | accelerating | high-growth
          "confidence_level": str | None,         # low | medium | high
          "signals": list[str],                   # human-readable drivers
        }
    """
    if follower_count is None or follower_count <= 0:
        return {
            "data_available": False,
            "growth_score": None,
            "growth_tier": None,
            "confidence_level": None,
            "signals": [],
        }

    tier = _tier(follower_count)
    benchmarks = _GROWTH_BENCHMARKS[tier]

    signals: list[str] = []
    subscores: list[tuple[float, float]] = []   # (subscore, weight)
    total_weight_available = 0.0

    # ── Signal 1: Follower acceleration (weight 0.40) ─────────────────────────
    W1 = 0.40
    if recent_follower_delta is not None:
        total_weight_available += W1
        growth_pct = recent_follower_delta / follower_count
        b = benchmarks

        if growth_pct >= b["excellent"]:
            s1 = 1.0
            signals.append(
                f"Exceptional growth: +{growth_pct:.1%} in 30 days "
                f"(excellent for {tier}-tier)"
            )
        elif growth_pct >= b["good"]:
            s1 = 0.70
            signals.append(f"Healthy growth: +{growth_pct:.1%} in 30 days")
        elif growth_pct >= b["floor"]:
            s1 = 0.40
            signals.append(f"Moderate growth: +{growth_pct:.1%} in 30 days")
        elif growth_pct >= 0:
            s1 = 0.15
            signals.append(f"Stagnant growth: +{growth_pct:.1%} in 30 days")
        else:
            s1 = 0.0
            signals.append(f"Declining: {growth_pct:.1%} in 30 days")

        subscores.append((s1, W1))

    # ── Signal 2: Engagement stability (weight 0.35) ──────────────────────────
    W2 = 0.35
    if engagement_rate is not None:
        total_weight_available += W2
        # If we have both current and previous ER, compute stability
        if engagement_rate_prev is not None and engagement_rate_prev > 0:
            variance = abs(engagement_rate - engagement_rate_prev) / engagement_rate_prev
            if variance <= 0.10:
                s2 = 1.0
                signals.append(f"Very stable engagement (±{variance:.0%} change)")
            elif variance <= 0.25:
                s2 = 0.70
                signals.append(f"Stable engagement (±{variance:.0%} change)")
            elif variance <= 0.50:
                s2 = 0.40
            else:
                s2 = 0.15
                signals.append(f"Volatile engagement (±{variance:.0%} swing)")
        else:
            # Only current ER available — use absolute benchmark
            if platform == "tiktok":
                thresholds = (9.0, 5.0, 2.0)
            elif platform == "youtube":
                thresholds = (4.0, 2.0, 0.8)
            else:  # instagram + default
                thresholds = (5.0, 2.5, 0.8)

            if engagement_rate >= thresholds[0]:
                s2 = 0.90
            elif engagement_rate >= thresholds[1]:
                s2 = 0.65
            elif engagement_rate >= thresholds[2]:
                s2 = 0.35
            else:
                s2 = 0.10

        subscores.append((s2, W2))

    # ── Signal 3: Content consistency (weight 0.25) ───────────────────────────
    W3 = 0.25
    if posts_count is not None and account_age_days is not None and account_age_days > 0:
        total_weight_available += W3
        posts_per_week = (posts_count / account_age_days) * 7

        # Ideal cadence varies by platform
        if platform == "tiktok":
            ideal_min, ideal_max = 3, 14
        elif platform == "youtube":
            ideal_min, ideal_max = 0.5, 4
        else:   # instagram
            ideal_min, ideal_max = 1, 7

        if ideal_min <= posts_per_week <= ideal_max:
            s3 = 1.0
            signals.append(
                f"Consistent posting ({posts_per_week:.1f} posts/week ideal range)"
            )
        elif posts_per_week < ideal_min:
            s3 = max(0, posts_per_week / ideal_min)
        else:
            # Over-posting: slight penalty
            s3 = max(0.3, 1.0 - (posts_per_week - ideal_max) / ideal_max * 0.5)

        subscores.append((s3, W3))

    if not subscores:
        return {
            "data_available": False,
            "growth_score": None,
            "growth_tier": None,
            "confidence_level": None,
            "signals": [],
        }

    # Normalise to available weight so missing signals don't deflate score
    raw_score = sum(s * w for s, w in subscores) / total_weight_available
    growth_score = round(min(raw_score, 1.0), 4)

    # Confidence depends on how many signals contributed
    conf_ratio = total_weight_available / (W1 + W2 + W3)
    confidence = (
        "high" if conf_ratio >= 0.75
        else "medium" if conf_ratio >= 0.40
        else "low"
    )

    # Label
    if growth_score >= 0.80:
        tier_label = "high-growth"
    elif growth_score >= 0.60:
        tier_label = "accelerating"
    elif growth_score >= 0.30:
        tier_label = "stable"
    else:
        tier_label = "declining"

    return {
        "data_available": True,
        "growth_score": growth_score,
        "growth_tier": tier_label,
        "confidence_level": confidence,
        "signals": signals,
    }
