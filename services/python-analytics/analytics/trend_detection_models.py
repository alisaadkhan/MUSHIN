"""
analytics/trend_detection_models.py

Content Trend Velocity Detection.

Detects whether a creator is riding a current trend or creating evergreen
content, based on available aggregate metrics.

Since we don't have raw post timestamps or hashtag APIs, we use proxy signals:
  - recent_follower_delta vs. older baseline (acceleration)
  - engagement_rate delta (ER was higher recently?)
  - niche_trend_index (some niches are structurally trending in Pakistan)

Output: trend_velocity_score [0, 1]
  0.0 = declining / anti-trend
  0.5 = stationary / unclear
  1.0 = strong trend riding

Returns content_trend_label:
  "trending"   ≥ 0.70
  "stable"     0.40 – 0.70
  "declining"  < 0.40
"""
from __future__ import annotations

from typing import Optional

# Current trend weights per niche in Pakistan (2026-Q1 market signal)
# Updated quarterly. Based on Serper trending query volumes.
_NICHE_TREND_INDEX: dict[str, float] = {
    "tech":        0.90,
    "ai":          0.95,
    "gaming":      0.85,
    "cricket":     0.80,
    "fashion":     0.75,
    "beauty":      0.72,
    "food":        0.70,
    "fitness":     0.68,
    "finance":     0.65,
    "travel":      0.60,
    "lifestyle":   0.58,
    "education":   0.62,
    "comedy":      0.55,
    "music":       0.57,
    "photography": 0.50,
    "news":        0.52,
    "sports":      0.63,
    "automotive":  0.48,
    "art":         0.45,
}


def analyze_content_trend_velocity(
    *,
    platform: str,
    primary_niche: Optional[str],
    follower_count: Optional[int],
    recent_follower_delta: Optional[int] = None,
    engagement_rate: Optional[float] = None,
    engagement_rate_prev: Optional[float] = None,
) -> dict:
    """
    Analyze content trend velocity for a creator.

    Returns:
        {
          "data_available": bool,
          "trend_velocity_score": float | None,   # 0.0 – 1.0
          "content_trend_label": str | None,      # "trending" | "stable" | "declining"
          "niche_trend_index": float | None,      # raw niche heat [0, 1]
          "signals": list[str],
        }
    """
    if follower_count is None or follower_count <= 0:
        return {
            "data_available": False,
            "trend_velocity_score": None,
            "content_trend_label": None,
            "niche_trend_index": None,
            "signals": [],
        }

    signals: list[str] = []
    components: list[tuple[float, float]] = []   # (score, weight)
    total_weight = 0.0

    # ── Signal 1: Follower acceleration (weight 0.45) ─────────────────────
    W1 = 0.45
    if recent_follower_delta is not None:
        total_weight += W1
        growth_pct = recent_follower_delta / follower_count
        # Map to [0, 1] — 15%+ growth = full trend score
        s1 = min(1.0, max(0.0, growth_pct / 0.15))
        if s1 >= 0.80:
            signals.append(f"Rapid follower acceleration (+{growth_pct:.1%}) aligns with trending content")
        elif s1 >= 0.40:
            signals.append(f"Moderate growth (+{growth_pct:.1%}) suggests trend exposure")
        components.append((s1, W1))

    # ── Signal 2: Engagement acceleration (weight 0.30) ───────────────────
    W2 = 0.30
    if engagement_rate is not None and engagement_rate_prev is not None and engagement_rate_prev > 0:
        total_weight += W2
        er_delta = (engagement_rate - engagement_rate_prev) / engagement_rate_prev
        # +50%+ ER growth = 1.0 trend signal; -25% = 0.0
        s2 = min(1.0, max(0.0, (er_delta + 0.25) / 0.75))
        if er_delta > 0.20:
            signals.append(f"Engagement rate grew {er_delta:.0%} — trending content effect")
        elif er_delta < -0.20:
            signals.append(f"Engagement dropped {er_delta:.0%} — possible content fatigue")
        components.append((s2, W2))

    # ── Signal 3: Niche trend index (weight 0.25) ─────────────────────────
    W3 = 0.25
    niche_index = None
    if primary_niche:
        total_weight += W3
        niche_index = _NICHE_TREND_INDEX.get(primary_niche.lower(), 0.50)
        components.append((niche_index, W3))
        if niche_index >= 0.75:
            signals.append(f"{primary_niche} is a high-demand niche in Pakistan (Q1 2026)")
        elif niche_index >= 0.55:
            signals.append(f"{primary_niche} niche shows stable Pakistani market demand")

    if not components:
        return {
            "data_available": False,
            "trend_velocity_score": None,
            "content_trend_label": None,
            "niche_trend_index": niche_index,
            "signals": [],
        }

    score = sum(s * w for s, w in components) / total_weight
    trend_velocity = round(min(score, 1.0), 4)

    label = (
        "trending"  if trend_velocity >= 0.70
        else "stable"   if trend_velocity >= 0.40
        else "declining"
    )

    return {
        "data_available": True,
        "trend_velocity_score": trend_velocity,
        "content_trend_label": label,
        "niche_trend_index": niche_index,
        "signals": signals,
    }
