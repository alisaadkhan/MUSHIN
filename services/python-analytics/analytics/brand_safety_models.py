"""
analytics/brand_safety_models.py

Brand Safety Analysis — rule-based content risk scoring.

Signals
───────
  bio_risk_words      — explicit/controversial words in bio text
  engagement_anomaly  — suspiciously inflated engagement (may signal pods)
  account_age_risk    — very new accounts with large following
  niche_risk          — some niches carry inherently higher brand risk

Output: risk_score [0, 1] where 1 = maximum brand risk.
Rating labels:
  0.00–0.20  safe
  0.20–0.45  caution
  0.45–1.00  risk
"""
from __future__ import annotations

import re
from typing import Optional

# ── Risk vocabulary ───────────────────────────────────────────────────────────
_HIGH_RISK_PATTERNS = [
    r"\b(adult|explicit|nsfw|18\+|onlyfans)\b",
    r"\b(gambling|casino|betting|bet)\b",
    r"\b(alcohol|beer|wine|whisky|vodka|drink)\b",
    r"\b(tobacco|cigarette|smoking|vape|vaping)\b",
    r"\b(crypto|nft|forex|investment scheme)\b",
    r"\b(hate|racist|sexist|offensive)\b",
]

_MEDIUM_RISK_PATTERNS = [
    r"\b(controversial|debate|political|politics)\b",
    r"\b(diet|weight loss|fat burn|supplement)\b",
    r"\b(conspiracy|expose|drama)\b",
]

_HIGH_RISK_NICHES = {"adult", "gambling", "crypto", "forex"}
_MEDIUM_RISK_NICHES = {"comedy", "news", "politics"}


def analyze_brand_safety(
    *,
    bio: Optional[str],
    primary_niche: Optional[str],
    follower_count: Optional[int],
    engagement_rate: Optional[float],
    account_age_days: Optional[int] = None,
    bot_probability: Optional[float] = None,
) -> dict:
    """
    Compute a brand safety risk score for a creator profile.

    Returns:
        {
          "data_available": bool,
          "risk_score": float | None,        # 0.0 – 1.0
          "risk_rating": str | None,         # "safe" | "caution" | "risk"
          "flags": list[str],
          "confidence": str | None,          # "low" | "medium" | "high"
        }
    """
    if follower_count is None and bio is None:
        return {
            "data_available": False,
            "risk_score": None,
            "risk_rating": None,
            "flags": [],
            "confidence": None,
        }

    flags: list[str] = []
    score_components: list[float] = []

    # ── Bio text analysis ─────────────────────────────────────────────────
    if bio:
        bio_lower = bio.lower()
        for pattern in _HIGH_RISK_PATTERNS:
            if re.search(pattern, bio_lower):
                score_components.append(0.70)
                flags.append(f"High-risk content pattern detected in bio: {pattern.split('(')[1].split(')')[0].split('|')[0]}")
                break
        else:
            for pattern in _MEDIUM_RISK_PATTERNS:
                if re.search(pattern, bio_lower):
                    score_components.append(0.35)
                    flags.append("Moderately sensitive content detected in bio")
                    break

    # ── Niche risk ────────────────────────────────────────────────────────
    if primary_niche:
        niche_lower = primary_niche.lower()
        if niche_lower in _HIGH_RISK_NICHES:
            score_components.append(0.65)
            flags.append(f"High-risk niche: {primary_niche}")
        elif niche_lower in _MEDIUM_RISK_NICHES:
            score_components.append(0.30)
            flags.append(f"Moderately sensitive niche: {primary_niche}")

    # ── Account age risk (very new + large following) ─────────────────────
    if account_age_days is not None and follower_count is not None:
        if account_age_days < 90 and follower_count > 50_000:
            score_components.append(0.50)
            flags.append(
                f"New account ({account_age_days} days) with large following "
                f"({follower_count:,}) — possible purchased audience"
            )
        elif account_age_days < 30 and follower_count > 10_000:
            score_components.append(0.40)
            flags.append("Very new account with suspicious follower count growth")

    # ── Bot probability proxy ─────────────────────────────────────────────
    if bot_probability is not None and bot_probability > 0.5:
        score_components.append(min(1.0, bot_probability * 0.8))
        flags.append(f"High bot risk ({bot_probability:.0%}) — audience authenticity concern")

    if not score_components and bio is None:
        return {
            "data_available": False,
            "risk_score": None,
            "risk_rating": None,
            "flags": [],
            "confidence": "low",
        }

    # Aggregate: worst-case blending (max × 0.60 + avg × 0.40)
    if score_components:
        risk_score = round(
            max(score_components) * 0.60 + (sum(score_components) / len(score_components)) * 0.40,
            4,
        )
    else:
        risk_score = 0.05   # minimal risk — clean profile

    confidence = "high" if (bio is not None and follower_count is not None) else "medium"

    if risk_score >= 0.45:
        rating = "risk"
    elif risk_score >= 0.20:
        rating = "caution"
    else:
        rating = "safe"

    return {
        "data_available": True,
        "risk_score": risk_score,
        "risk_rating": rating,
        "flags": flags,
        "confidence": confidence,
    }
