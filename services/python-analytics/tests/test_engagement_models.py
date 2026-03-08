"""
tests/test_engagement_models.py

Unit tests for analytics/engagement_models.py.
Run with: pytest tests/
"""
import pytest
from analytics.engagement_models import detect_engagement_anomalies


def eng(**kwargs) -> dict:
    defaults = dict(
        platform="instagram",
        follower_count=None,
        engagement_rate=None,
        avg_likes=None,
        avg_comments=None,
        avg_views=None,
    )
    return detect_engagement_anomalies(**{**defaults, **kwargs})


# ── data_available=False cases ────────────────────────────────────────────────

def test_no_follower_count_returns_unavailable():
    result = eng(follower_count=None)
    assert result["data_available"] is False
    assert result["anomaly_score"] is None


def test_zero_followers_unavailable():
    result = eng(follower_count=0)
    assert result["data_available"] is False


# ── Normal creator — no anomalies ─────────────────────────────────────────────

def test_normal_creator_no_anomalies():
    """Mid-tier Instagram creator with healthy ER — expect score near 0."""
    result = eng(
        platform="instagram",
        follower_count=80_000,
        engagement_rate=3.0,   # close to 2.0% median for mid-tier
        avg_likes=2_400,
        avg_comments=120,
    )
    assert result["data_available"] is True
    assert result["anomaly_score"] == 0.0
    assert result["anomalies_detected"] == []


# ── Ghost follower anomaly ────────────────────────────────────────────────────

def test_critically_low_engagement_anomaly():
    """0.15% ER for 100K account — critically low."""
    result = eng(
        platform="instagram",
        follower_count=100_000,
        engagement_rate=0.15,
    )
    assert result["data_available"] is True
    assert result["anomaly_score"] is not None
    assert result["anomaly_score"] > 0.5
    assert len(result["anomalies_detected"]) > 0


def test_zero_near_engagement_large_account():
    """0.05% ER for 50K account — near-zero proxy."""
    result = eng(
        platform="instagram",
        follower_count=50_000,
        engagement_rate=0.05,
    )
    assert result["data_available"] is True
    assert result["anomaly_score"] is not None
    assert result["anomaly_score"] > 0.0


# ── Suspicious spike anomaly ──────────────────────────────────────────────────

def test_extremely_high_er_anomaly():
    """30% ER for a 200K account — suspiciously high."""
    result = eng(
        platform="instagram",
        follower_count=200_000,
        engagement_rate=30.0,  # 15× median
    )
    assert result["data_available"] is True
    assert result["anomaly_score"] is not None and result["anomaly_score"] > 0.3


# ── TikTok view / like skew ───────────────────────────────────────────────────

def test_tiktok_normal_view_like_ratio():
    """TikTok: 100K views, 5K likes → ratio 20:1 — within normal range."""
    result = eng(
        platform="tiktok",
        follower_count=500_000,
        engagement_rate=5.0,
        avg_likes=5_000,
        avg_views=100_000,
    )
    assert result["data_available"] is True
    # No view/like anomaly at 20:1
    view_like_anomaly = any("view" in a.lower() for a in result["anomalies_detected"])
    assert not view_like_anomaly


def test_tiktok_inflated_views():
    """TikTok: 5M views, 1K likes → ratio 5000:1 — view injection."""
    result = eng(
        platform="tiktok",
        follower_count=100_000,
        engagement_rate=2.0,
        avg_likes=1_000,
        avg_views=5_000_000,
    )
    assert result["data_available"] is True
    assert result["anomaly_score"] is not None and result["anomaly_score"] > 0.0
    assert any("view" in a.lower() for a in result["anomalies_detected"])


# ── Explanation always present when anomalies exist ──────────────────────────

def test_explanation_set_when_anomaly_detected():
    result = eng(
        platform="instagram",
        follower_count=100_000,
        engagement_rate=0.1,
    )
    if result["anomaly_score"] is not None and result["anomaly_score"] > 0:
        assert result["explanation"] is not None
        assert len(result["explanation"]) > 10
