"""
tests/test_bot_detection.py

Unit tests for analytics/bot_detection.py.
Run with: pytest tests/
"""
import pytest
from analytics.bot_detection import compute_bot_probability


# ── Helper ────────────────────────────────────────────────────────────────────
def bot(**kwargs) -> dict:
    """Convenience wrapper — populates minimal required args, caller overrides."""
    defaults = dict(
        platform="instagram",
        follower_count=None,
        following_count=None,
        posts_count=None,
        engagement_rate=None,
        avg_likes=None,
        avg_comments=None,
        recent_follower_delta=None,
    )
    return compute_bot_probability(**{**defaults, **kwargs})


# ── data_available=False cases ────────────────────────────────────────────────

def test_no_follower_count_returns_unavailable():
    result = bot(follower_count=None)
    assert result["data_available"] is False
    assert result["bot_probability"] is None


def test_zero_follower_count_returns_unavailable():
    result = bot(follower_count=0)
    assert result["data_available"] is False


# ── Low-risk authentic creator ────────────────────────────────────────────────

def test_authentic_mid_tier_low_risk():
    """50K followers, 3.5% ER — healthy Instagram mid-tier creator."""
    result = bot(
        platform="instagram",
        follower_count=50_000,
        following_count=800,
        posts_count=200,
        engagement_rate=3.5,
        avg_likes=1_700,
        avg_comments=80,
    )
    assert result["data_available"] is True
    assert result["bot_probability"] is not None
    assert result["risk_level"] == "low"
    assert result["bot_probability"] < 0.30


# ── High-risk bot signals ─────────────────────────────────────────────────────

def test_ghost_follower_signal():
    """Very low ER (0.2%) for a 100K account — ghost followers."""
    result = bot(
        platform="instagram",
        follower_count=100_000,
        following_count=600,
        posts_count=300,
        engagement_rate=0.2,
        avg_likes=200,
        avg_comments=10,
    )
    assert result["data_available"] is True
    assert result["risk_level"] in ("medium", "high")
    assert any("below" in s.lower() or "ghost" in s.lower() for s in result["signals_triggered"])


def test_follow_unfollow_pattern():
    """High following count relative to followers — classic follow/unfollow."""
    result = bot(
        platform="instagram",
        follower_count=8_000,
        following_count=7_500,
        posts_count=50,
        engagement_rate=2.0,
    )
    assert result["data_available"] is True
    # Expect medium or high risk
    assert result["risk_level"] in ("medium", "high")
    assert len(result["signals_triggered"]) > 0


def test_few_posts_many_followers():
    """Only 5 posts but 50K followers — likely purchased."""
    result = bot(
        platform="instagram",
        follower_count=50_000,
        following_count=300,
        posts_count=5,
        engagement_rate=1.5,
    )
    assert result["data_available"] is True
    assert any("post" in s.lower() for s in result["signals_triggered"])


def test_rapid_growth_signal():
    """30% follower growth in 30 days — possible purchased followers."""
    result = bot(
        platform="tiktok",
        follower_count=100_000,
        following_count=400,
        posts_count=150,
        engagement_rate=4.5,
        recent_follower_delta=35_000,   # 35% growth
    )
    assert result["data_available"] is True
    assert any("grew" in s.lower() or "growth" in s.lower() for s in result["signals_triggered"])


def test_like_comment_ratio_signal():
    """Bought likes without comments: 5000 likes, 10 comments = 500:1 ratio."""
    result = bot(
        platform="instagram",
        follower_count=10_000,
        following_count=500,
        posts_count=100,
        engagement_rate=6.0,
        avg_likes=5_000,
        avg_comments=10,
    )
    assert result["data_available"] is True
    assert any("ratio" in s.lower() or "comment" in s.lower() for s in result["signals_triggered"])


# ── Boundary / confidence tests ───────────────────────────────────────────────

def test_confidence_high_when_all_fields_present():
    result = bot(
        platform="youtube",
        follower_count=200_000,
        following_count=100,
        posts_count=400,
        engagement_rate=1.8,
        avg_likes=3_600,
        avg_comments=200,
        recent_follower_delta=2_000,
    )
    assert result["data_available"] is True
    assert result["confidence"] == "high"


def test_confidence_medium_missing_some_fields():
    """Only follower_count + engagement_rate — partial data."""
    result = bot(
        platform="instagram",
        follower_count=25_000,
        engagement_rate=4.0,
    )
    assert result["data_available"] is True
    assert result["confidence"] in ("medium", "high")


def test_bot_probability_is_float_in_range():
    result = bot(
        platform="instagram",
        follower_count=10_000,
        engagement_rate=3.0,
    )
    if result["data_available"]:
        bp = result["bot_probability"]
        assert isinstance(bp, float)
        assert 0.0 <= bp <= 1.0
