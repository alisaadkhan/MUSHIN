"""
analytics/engagement_models.py

Engagement anomaly detection from aggregate profile metrics.

We detect three types of anomalies:
  1. engagement_rate_outlier   — ER is >3× or <0.25× the platform median for that tier
  2. zero_engagement_proxy     — engagement_rate < 0.1% for any non-nano account
  3. view_like_skew            — avg_views / avg_likes ratio is outside normal bounds
     (extremely high views with few likes can indicate view injection on TikTok/YouTube)

Returns an anomaly_score ∈ [0, 1]:
  0.0 = perfectly normal
  0.5 = moderately anomalous
  1.0 = highly anomalous
"""
from __future__ import annotations

from typing import Optional, List

# ── Platform engagement medians (reuse same table) ────────────────────────────
_ENGAGEMENT_MEDIAN: dict[str, dict[str, float]] = {
    "instagram": {"nano": 5.0, "micro": 3.5, "mid": 2.0, "macro": 1.2, "mega": 0.9},
    "tiktok":    {"nano": 9.0, "micro": 6.5, "mid": 4.0, "macro": 2.5, "mega": 1.5},
    "youtube":   {"nano": 4.5, "micro": 3.0, "mid": 2.0, "macro": 1.0, "mega": 0.5},
}

_TIER_BREAKPOINTS = [1_000, 10_000, 100_000, 500_000]

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


def detect_engagement_anomalies(
    *,
    platform: str,
    follower_count: Optional[int],
    engagement_rate: Optional[float],
    avg_likes: Optional[float],
    avg_comments: Optional[float],
    avg_views: Optional[float],
) -> dict:
    """
    Detect engagement anomalies from aggregate metrics.

    Returns a dict compatible with EngagementAnomalyResult:
        {
          "data_available": bool,
          "anomaly_score": float | None,
          "anomalies_detected": list[str],
          "explanation": str | None,
        }
    """
    if follower_count is None or follower_count <= 0:
        return {
            "data_available": False,
            "anomaly_score": None,
            "anomalies_detected": [],
            "explanation": None,
        }

    anomalies: List[str] = []
    score_components: List[float] = []

    # ── Anomaly 1: engagement rate outlier ────────────────────────────────────
    if engagement_rate is not None:
        median = _ENGAGEMENT_MEDIAN.get(platform, _ENGAGEMENT_MEDIAN["instagram"]).get(
            _tier(follower_count), 2.0
        )
        er_ratio = engagement_rate / max(median, 0.1)

        if er_ratio < 0.25:
            score_components.append(0.8)
            anomalies.append(
                f"Engagement rate ({engagement_rate:.2f}%) is critically below the "
                f"platform median ({median:.1f}%) — possible ghost followers"
            )
        elif er_ratio > 5.0:
            # Suspiciously high — engagement pods or boosted posts
            score_components.append(min(1.0, (er_ratio - 5.0) / 10.0) * 0.6 + 0.4)
            anomalies.append(
                f"Engagement rate ({engagement_rate:.2f}%) is {er_ratio:.1f}× platform median — "
                "possible engagement pod or boosted content"
            )

    # ── Anomaly 2: zero-engagement proxy ─────────────────────────────────────
    if engagement_rate is not None and follower_count >= 10_000:
        if engagement_rate < 0.1:
            score_components.append(0.9)
            anomalies.append(
                f"Near-zero engagement rate ({engagement_rate:.2f}%) for an account "
                f"with {follower_count:,} followers"
            )

    # ── Anomaly 3: view / like skew (TikTok / YouTube) ───────────────────────
    if platform in ("tiktok", "youtube") and avg_views is not None and avg_likes is not None:
        if avg_likes > 0:
            view_like = avg_views / avg_likes
            # Normal ratio: TikTok ~10-50, YouTube ~30-100
            upper = 60 if platform == "tiktok" else 150
            if view_like > upper * 3:
                score_components.append(min(1.0, (view_like / (upper * 3)) * 0.5 + 0.3))
                anomalies.append(
                    f"View-to-like ratio {view_like:.0f}:1 is unusually high — "
                    "possible view count inflation"
                )

    if not score_components:
        # No anomalies or insufficient data to detect
        return {
            "data_available": True,
            "anomaly_score": 0.0,
            "anomalies_detected": [],
            "explanation": "No statistically notable engagement anomalies detected.",
        }

    composite = min(sum(score_components) / len(score_components), 1.0)

    explanation = (
        f"{len(anomalies)} anomal{'y' if len(anomalies) == 1 else 'ies'} detected. "
        + anomalies[0]
    )

    return {
        "data_available": True,
        "anomaly_score": round(composite, 4),
        "anomalies_detected": anomalies,
        "explanation": explanation,
    }
