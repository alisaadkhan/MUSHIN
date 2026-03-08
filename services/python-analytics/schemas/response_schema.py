"""
schemas/response_schema.py

Pydantic output models for all analytics endpoints.
data_available=False means the field lacks sufficient input to produce
a reliable result — the caller MUST surface this as "Data unavailable".
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BotDetectionResult(BaseModel):
    data_available: bool
    bot_probability: Optional[float] = Field(None, ge=0.0, le=1.0)
    risk_level: Optional[str] = None           # "low" | "medium" | "high"
    signals_triggered: List[str] = []
    confidence: Optional[str] = None           # "low" | "medium" | "high"


class EngagementAnomalyResult(BaseModel):
    data_available: bool
    anomaly_score: Optional[float] = Field(None, ge=0.0, le=1.0)  # 0=normal, 1=very anomalous
    anomalies_detected: List[str] = []
    explanation: Optional[str] = None


class AnalyticsResponse(BaseModel):
    platform: str
    username: str
    bot_detection: BotDetectionResult
    engagement_anomaly: EngagementAnomalyResult
    # ISO timestamp of when this analysis was produced
    analyzed_at: str


# ── New response models ────────────────────────────────────────────────────────

class GrowthResponse(BaseModel):
    """Response for POST /analyze_growth"""
    username: str
    platform: str
    data_available: bool
    growth_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    growth_tier: Optional[str] = None   # declining|stable|accelerating|high-growth
    confidence_level: Optional[str] = None
    signals: List[str] = []
    analyzed_at: str


class BrandFitResponse(BaseModel):
    """Response for POST /analyze_brand_fit"""
    username: str
    platform: str
    data_available: bool
    affinity_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    breakdown: Optional[Dict[str, Any]] = None
    recommendation: Optional[str] = None
    analyzed_at: str


class BrandSafetyResponse(BaseModel):
    """Response for POST /analyze_brand_safety"""
    username: str
    data_available: bool
    risk_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    risk_rating: Optional[str] = None   # safe|caution|risk
    flags: List[str] = []
    confidence: Optional[str] = None
    analyzed_at: str


class TrendVelocityResponse(BaseModel):
    """Response for POST /analyze_trend_velocity"""
    username: str
    platform: str
    data_available: bool
    trend_velocity_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    content_trend_label: Optional[str] = None  # trending|stable|declining
    niche_trend_index: Optional[float] = Field(None, ge=0.0, le=1.0)
    signals: List[str] = []
    analyzed_at: str


# ── Phase 6 prediction response models ─────────────────────────────────────────

class AudienceGrowthResponse(BaseModel):
    """Response for POST /predict/audience-growth"""
    username: str
    platform: str
    prediction_available: bool
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    audience_change_projection: Optional[int] = None
    growth_rate_projection: Optional[float] = None
    growth_outlook: Optional[str] = None   # declining|stable|growing|accelerating
    signals: List[str] = []
    predicted_at: str


class AudienceDemographicsResponse(BaseModel):
    """Response for POST /predict/audience-demographics"""
    username: str
    prediction_available: bool
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    dominant_age_range: Optional[str] = None
    gender_skew: Optional[str] = None     # male_skewed|female_skewed|balanced
    audience_type: Optional[str] = None   # professional|casual|enthusiast|youth
    source: str = "curated_niche_index"
    note: Optional[str] = None
    predicted_at: str


class BrandFitPredictionResponse(BaseModel):
    """Response for POST /predict/brand-fit"""
    username: str
    platform: str
    prediction_available: bool
    affinity_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    recommendation: Optional[str] = None   # strong_match|potential_match|weak_match
    breakdown: Optional[Dict[str, Any]] = None
    signals: List[str] = []
    predicted_at: str
