"""
analytics/audience_affinity_models.py

Audience Affinity Analysis — brand-fit scoring from aggregate metrics.

Rules
─────
- All signals derived from caller-supplied data. No external API calls.
- data_available=False when inputs are insufficient.
- confidence_score < 0.60 → caller should surface "Data confidence too low".

Signals used:
  niche_brand_alignment   — does creator niche match the brand vertical?
  authenticity_proxy      — bot probability (inverted) as audience quality signal
  audience_size_fit       — follower count relative to target campaign size
  engagement_quality      — ER vs. platform median for brand suitability
"""
from __future__ import annotations

from typing import Optional

# Niche → compatible brand verticals mapping
_NICHE_BRAND_VERTICALS: dict[str, list[str]] = {
    "fashion":     ["fashion", "clothing", "lifestyle", "beauty", "accessories", "luxury"],
    "beauty":      ["beauty", "skincare", "cosmetics", "haircare", "wellness"],
    "food":        ["food", "restaurant", "beverage", "nutrition", "cooking"],
    "tech":        ["technology", "electronics", "software", "gaming", "automotive"],
    "fitness":     ["fitness", "sports", "nutrition", "health", "wellness", "activewear"],
    "travel":      ["travel", "hospitality", "tourism", "automotive", "luggage"],
    "gaming":      ["gaming", "technology", "energy drinks", "peripherals"],
    "education":   ["education", "books", "online courses", "technology"],
    "lifestyle":   ["lifestyle", "home", "fashion", "beauty", "food"],
    "music":       ["music", "entertainment", "fashion", "lifestyle"],
    "comedy":      ["entertainment", "food", "beverage", "lifestyle"],
    "cricket":     ["sports", "beverages", "automotive", "healthcare"],
    "finance":     ["finance", "technology", "real estate", "consulting"],
}


def analyze_brand_fit(
    *,
    platform: str,
    follower_count: Optional[int],
    engagement_rate: Optional[float],
    primary_niche: Optional[str],
    brand_vertical: Optional[str],
    bot_probability: Optional[float] = None,
    target_audience_size: Optional[str] = None,   # "nano"|"micro"|"mid"|"macro"|"mega"
) -> dict:
    """
    Estimate brand-fit affinity score for a creator–brand pairing.

    Returns:
        {
          "data_available": bool,
          "affinity_score": float | None,   # 0.0 – 1.0
          "confidence_score": float | None,
          "breakdown": {
            "niche_alignment": float,
            "audience_quality": float,
            "size_fit": float,
            "engagement_quality": float,
          },
          "recommendation": str | None,
        }
    """
    if follower_count is None or follower_count <= 0:
        return {
            "data_available": False,
            "affinity_score": None,
            "confidence_score": None,
            "breakdown": {},
            "recommendation": None,
        }

    subscores: dict[str, float] = {}
    weight_used = 0.0
    total_weight = 0.0

    # ── Niche alignment (weight 0.35) ──────────────────────────────────────
    W_NICHE = 0.35
    total_weight += W_NICHE
    if primary_niche and brand_vertical:
        niche_lower = primary_niche.lower()
        vert_lower = brand_vertical.lower()
        compatible = _NICHE_BRAND_VERTICALS.get(niche_lower, [])
        if vert_lower in compatible:
            idx = compatible.index(vert_lower)
            subscores["niche_alignment"] = max(0.5, 1.0 - idx * 0.1)
        elif niche_lower == vert_lower:
            subscores["niche_alignment"] = 1.0
        else:
            subscores["niche_alignment"] = 0.1
        weight_used += W_NICHE

    # ── Audience quality (weight 0.30) ────────────────────────────────────
    W_AQ = 0.30
    total_weight += W_AQ
    if bot_probability is not None:
        audience_quality = 1.0 - min(bot_probability, 1.0)
        subscores["audience_quality"] = audience_quality
        weight_used += W_AQ

    # ── Size fit (weight 0.20) ────────────────────────────────────────────
    W_SIZE = 0.20
    total_weight += W_SIZE
    if target_audience_size:
        def tier(fc: int) -> str:
            if fc < 1_000:   return "nano"
            if fc < 10_000:  return "micro"
            if fc < 100_000: return "mid"
            if fc < 500_000: return "macro"
            return "mega"

        creator_tier = tier(follower_count)
        if creator_tier == target_audience_size:
            subscores["size_fit"] = 1.0
        elif abs(["nano","micro","mid","macro","mega"].index(creator_tier) -
                 ["nano","micro","mid","macro","mega"].index(target_audience_size)) == 1:
            subscores["size_fit"] = 0.60
        else:
            subscores["size_fit"] = 0.20
        weight_used += W_SIZE

    # ── Engagement quality (weight 0.15) ──────────────────────────────────
    W_EQ = 0.15
    total_weight += W_EQ
    if engagement_rate is not None:
        medians = {"instagram": 2.0, "tiktok": 4.0, "youtube": 2.0}
        median = medians.get(platform, 2.0)
        ratio = engagement_rate / max(median, 0.1)
        subscores["engagement_quality"] = min(1.0, ratio / 3.0)
        weight_used += W_EQ

    if not subscores:
        return {
            "data_available": False,
            "affinity_score": None,
            "confidence_score": None,
            "breakdown": {},
            "recommendation": None,
        }

    affinity = sum(subscores[k] * w for k, w in [
        ("niche_alignment", W_NICHE),
        ("audience_quality", W_AQ),
        ("size_fit", W_SIZE),
        ("engagement_quality", W_EQ),
    ] if k in subscores) / weight_used

    confidence = round(weight_used / total_weight, 3)
    affinity_score = round(min(affinity, 1.0), 4)

    if affinity_score >= 0.75:
        recommendation = "Strong brand fit — recommended for campaign shortlist"
    elif affinity_score >= 0.50:
        recommendation = "Moderate brand fit — suitable with targeted brief"
    elif affinity_score >= 0.30:
        recommendation = "Low brand fit — niche or audience mismatch"
    else:
        recommendation = "Poor fit — not recommended for this brand vertical"

    return {
        "data_available": True,
        "affinity_score": affinity_score,
        "confidence_score": confidence,
        "breakdown": {k: round(v, 4) for k, v in subscores.items()},
        "recommendation": recommendation,
    }
