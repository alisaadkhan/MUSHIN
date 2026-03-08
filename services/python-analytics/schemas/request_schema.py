"""
schemas/request_schema.py

Pydantic input models for all analytics endpoints.
All fields are optional so the service degrades gracefully when
the caller only has partial profile data.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field

_PLATFORM_PATTERN = "^(instagram|tiktok|youtube|twitch|facebook)$"


class ProfileMetrics(BaseModel):
    follower_count: Optional[int] = Field(None, ge=0)
    following_count: Optional[int] = Field(None, ge=0)
    posts_count: Optional[int] = Field(None, ge=0)
    engagement_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    avg_likes: Optional[float] = Field(None, ge=0)
    avg_comments: Optional[float] = Field(None, ge=0)
    avg_views: Optional[float] = Field(None, ge=0)
    # Follower delta for the last 30 days (positive = growth)
    recent_follower_delta: Optional[int] = None


class AnalysisRequest(BaseModel):
    platform: str = Field(..., pattern=_PLATFORM_PATTERN)
    username: str = Field(..., min_length=1, max_length=100)
    metrics: ProfileMetrics
    bio: Optional[str] = Field(None, max_length=4000)
    primary_niche: Optional[str] = None
    account_age_days: Optional[int] = Field(None, ge=0)


# ── New endpoint request models ────────────────────────────────────────────────

class GrowthRequest(BaseModel):
    """POST /analyze_growth"""
    platform: str = Field(..., pattern=_PLATFORM_PATTERN)
    username: str = Field(..., min_length=1, max_length=100)
    follower_count: Optional[int] = Field(None, ge=0)
    recent_follower_delta: Optional[int] = None
    engagement_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    engagement_rate_prev: Optional[float] = Field(None, ge=0.0, le=100.0)
    posts_count: Optional[int] = Field(None, ge=0)
    account_age_days: Optional[int] = Field(None, ge=0)


class BrandFitRequest(BaseModel):
    """POST /analyze_brand_fit"""
    platform: str = Field(..., pattern=_PLATFORM_PATTERN)
    username: str = Field(..., min_length=1, max_length=100)
    follower_count: Optional[int] = Field(None, ge=0)
    engagement_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    primary_niche: Optional[str] = None
    brand_vertical: Optional[str] = None
    bot_probability: Optional[float] = Field(None, ge=0.0, le=1.0)
    target_audience_size: Optional[str] = None   # "nano"|"micro"|"mid"|"macro"|"mega"


class BrandSafetyRequest(BaseModel):
    """POST /analyze_brand_safety"""
    username: str = Field(..., min_length=1, max_length=100)
    bio: Optional[str] = Field(None, max_length=4000)
    primary_niche: Optional[str] = None
    follower_count: Optional[int] = Field(None, ge=0)
    engagement_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    account_age_days: Optional[int] = Field(None, ge=0)
    bot_probability: Optional[float] = Field(None, ge=0.0, le=1.0)


class TrendRequest(BaseModel):
    """POST /analyze_trend_velocity"""
    platform: str = Field(..., pattern=_PLATFORM_PATTERN)
    username: str = Field(..., min_length=1, max_length=100)
    primary_niche: Optional[str] = None
    follower_count: Optional[int] = Field(None, ge=0)
    recent_follower_delta: Optional[int] = None
    engagement_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    engagement_rate_prev: Optional[float] = Field(None, ge=0.0, le=100.0)


# ── Phase 6 prediction endpoint models ───────────────────────────────────────

class AudienceGrowthRequest(BaseModel):
    """POST /predict/audience-growth"""
    platform: str = Field(..., pattern=_PLATFORM_PATTERN)
    username: str = Field(..., min_length=1, max_length=100)
    follower_count: Optional[int] = Field(None, ge=0)
    recent_follower_delta: Optional[int] = None
    engagement_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    posts_count: Optional[int] = Field(None, ge=0)
    account_age_days: Optional[int] = Field(None, ge=0)
    primary_niche: Optional[str] = None


class AudienceDemographicsRequest(BaseModel):
    """POST /predict/audience-demographics"""
    username: str = Field(..., min_length=1, max_length=100)
    primary_niche: Optional[str] = None
    follower_count: Optional[int] = Field(None, ge=0)
    platform: Optional[str] = Field(None, pattern=_PLATFORM_PATTERN)
    account_age_days: Optional[int] = Field(None, ge=0)


class BrandFitPredictionRequest(BaseModel):
    """POST /predict/brand-fit"""
    platform: str = Field(..., pattern=_PLATFORM_PATTERN)
    username: str = Field(..., min_length=1, max_length=100)
    follower_count: Optional[int] = Field(None, ge=0)
    engagement_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    primary_niche: Optional[str] = None
    brand_vertical: Optional[str] = None
    bot_probability: Optional[float] = Field(None, ge=0.0, le=1.0)
    target_audience_size: Optional[str] = None   # "nano"|"micro"|"mid"|"macro"|"mega"
    past_sponsorship_count: Optional[int] = Field(None, ge=0)
