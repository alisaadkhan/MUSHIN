"""
app.py — Mushin Python Analytics Microservice v3

Endpoints:
  GET  /health                       — liveness probe
  POST /analyze                      — bot detection + engagement anomaly
  POST /analyze_growth               — creator growth velocity score
  POST /analyze_brand_fit            — brand-creator affinity score
  POST /analyze_brand_safety         — brand safety risk assessment
  POST /analyze_trend_velocity       — content trend velocity
  POST /predict/audience-growth      — audience growth projection (Phase 6)
  POST /predict/audience-demographics— audience demographic estimation (Phase 6)
  POST /predict/brand-fit            — brand fit prediction (Phase 6)

Authentication:
  X-Analytics-Secret header (env var ANALYTICS_SECRET).
  If ANALYTICS_SECRET is not set, auth checking is skipped (dev mode).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from schemas.request_schema import (
    AnalysisRequest,
    AudienceDemographicsRequest,
    AudienceGrowthRequest,
    BrandFitPredictionRequest,
    BrandFitRequest,
    BrandSafetyRequest,
    GrowthRequest,
    TrendRequest,
)
from schemas.response_schema import (
    AnalyticsResponse,
    AudienceDemographicsResponse,
    AudienceGrowthResponse,
    BotDetectionResult,
    BrandFitPredictionResponse,
    BrandFitResponse,
    BrandSafetyResponse,
    EngagementAnomalyResult,
    GrowthResponse,
    TrendVelocityResponse,
)
from analytics.bot_detection import compute_bot_probability
from analytics.engagement_models import detect_engagement_anomalies
from analytics.growth_models import compute_growth_velocity_score
from analytics.audience_affinity_models import analyze_brand_fit
from analytics.brand_safety_models import analyze_brand_safety
from analytics.trend_detection_models import analyze_content_trend_velocity
from analytics.audience_growth_predictor import (
    predict_audience_growth,
    predict_audience_demographics,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Mushin Analytics",
    description="Statistical influencer analytics microservice",
    version="3.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Edge function is the only caller; restrict in prod via ANALYTICS_SECRET
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

ANALYTICS_SECRET = os.getenv("ANALYTICS_SECRET", "")


def _check_auth(request: Request) -> None:
    """Verify the shared secret header when ANALYTICS_SECRET is configured."""
    if not ANALYTICS_SECRET:
        return  # dev mode — skip auth
    provided = request.headers.get("x-analytics-secret", "")
    if provided != ANALYTICS_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid analytics secret")


# ── Health ────────────────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/health")
def health():
    return {"status": "ok", "service": "mushin-analytics", "version": "3.0.0"}


# ── Analyze endpoint ──────────────────────────────────────────────────────────
@app.post("/analyze", response_model=AnalyticsResponse)
def analyze(body: AnalysisRequest, request: Request):
    _check_auth(request)

    m = body.metrics
    p = body.platform

    # ── Bot detection ─────────────────────────────────────────────────────────
    bot_raw = compute_bot_probability(
        platform=p,
        follower_count=m.follower_count,
        following_count=m.following_count,
        posts_count=m.posts_count,
        engagement_rate=m.engagement_rate,
        avg_likes=m.avg_likes,
        avg_comments=m.avg_comments,
        recent_follower_delta=m.recent_follower_delta,
    )
    bot_result = BotDetectionResult(**bot_raw)

    # ── Engagement anomaly ────────────────────────────────────────────────────
    eng_raw = detect_engagement_anomalies(
        platform=p,
        follower_count=m.follower_count,
        engagement_rate=m.engagement_rate,
        avg_likes=m.avg_likes,
        avg_comments=m.avg_comments,
        avg_views=m.avg_views,
    )
    eng_result = EngagementAnomalyResult(**eng_raw)

    logger.info(
        "analyze %s/@%s bot=%s er_anomaly=%s",
        p,
        body.username,
        bot_result.risk_level,
        eng_result.anomaly_score,
    )

    return AnalyticsResponse(
        platform=p,
        username=body.username,
        bot_detection=bot_result,
        engagement_anomaly=eng_result,
        analyzed_at=_now(),
    )


# ── /analyze_growth ───────────────────────────────────────────────────────────
@app.post("/analyze_growth", response_model=GrowthResponse)
def analyze_growth(body: GrowthRequest, request: Request):
    _check_auth(request)

    raw = compute_growth_velocity_score(
        platform=body.platform,
        follower_count=body.follower_count,
        recent_follower_delta=body.recent_follower_delta,
        engagement_rate=body.engagement_rate,
        engagement_rate_prev=body.engagement_rate_prev,
        posts_count=body.posts_count,
        account_age_days=body.account_age_days,
    )

    logger.info(
        "analyze_growth %s/@%s tier=%s score=%s",
        body.platform, body.username,
        raw.get("growth_tier"), raw.get("growth_score"),
    )

    return GrowthResponse(
        username=body.username,
        platform=body.platform,
        data_available=raw.get("data_available", False),
        growth_score=raw.get("growth_score"),
        growth_tier=raw.get("growth_tier"),
        confidence_level=raw.get("confidence_level"),
        signals=raw.get("signals", []),
        analyzed_at=_now(),
    )


# ── /analyze_brand_fit ────────────────────────────────────────────────────────
@app.post("/analyze_brand_fit", response_model=BrandFitResponse)
def analyze_brand_fit_endpoint(body: BrandFitRequest, request: Request):
    _check_auth(request)

    raw = analyze_brand_fit(
        platform=body.platform,
        follower_count=body.follower_count,
        engagement_rate=body.engagement_rate,
        primary_niche=body.primary_niche,
        brand_vertical=body.brand_vertical,
        bot_probability=body.bot_probability,
        target_audience_size=body.target_audience_size,
    )

    logger.info(
        "analyze_brand_fit %s/@%s affinity=%s conf=%s",
        body.platform, body.username,
        raw.get("affinity_score"), raw.get("confidence_score"),
    )

    return BrandFitResponse(
        username=body.username,
        platform=body.platform,
        data_available=raw.get("data_available", False),
        affinity_score=raw.get("affinity_score"),
        confidence_score=raw.get("confidence_score"),
        breakdown=raw.get("breakdown"),
        recommendation=raw.get("recommendation"),
        analyzed_at=_now(),
    )


# ── /analyze_brand_safety ─────────────────────────────────────────────────────
@app.post("/analyze_brand_safety", response_model=BrandSafetyResponse)
def analyze_brand_safety_endpoint(body: BrandSafetyRequest, request: Request):
    _check_auth(request)

    raw = analyze_brand_safety(
        bio=body.bio,
        primary_niche=body.primary_niche,
        follower_count=body.follower_count,
        engagement_rate=body.engagement_rate,
        account_age_days=body.account_age_days,
        bot_probability=body.bot_probability,
    )

    logger.info(
        "analyze_brand_safety @%s rating=%s risk=%.2f",
        body.username,
        raw.get("risk_rating"), raw.get("risk_score", 0),
    )

    return BrandSafetyResponse(
        username=body.username,
        data_available=raw.get("data_available", False),
        risk_score=raw.get("risk_score"),
        risk_rating=raw.get("risk_rating"),
        flags=raw.get("flags", []),
        confidence=raw.get("confidence"),
        analyzed_at=_now(),
    )


# ── /analyze_trend_velocity ───────────────────────────────────────────────────
@app.post("/analyze_trend_velocity", response_model=TrendVelocityResponse)
def analyze_trend_velocity(body: TrendRequest, request: Request):
    _check_auth(request)

    raw = analyze_content_trend_velocity(
        platform=body.platform,
        primary_niche=body.primary_niche,
        follower_count=body.follower_count,
        recent_follower_delta=body.recent_follower_delta,
        engagement_rate=body.engagement_rate,
        engagement_rate_prev=body.engagement_rate_prev,
    )

    logger.info(
        "analyze_trend_velocity %s/@%s label=%s score=%s",
        body.platform, body.username,
        raw.get("content_trend_label"), raw.get("trend_velocity_score"),
    )

    return TrendVelocityResponse(
        username=body.username,
        platform=body.platform,
        data_available=raw.get("data_available", False),
        trend_velocity_score=raw.get("trend_velocity_score"),
        content_trend_label=raw.get("content_trend_label"),
        niche_trend_index=raw.get("niche_trend_index"),
        signals=raw.get("signals", []),
        analyzed_at=_now(),
    )


# ── /predict/audience-growth ────────────────────────────────────────────────────
error_note = "Audience growth forecasting endpoint (Phase 6)"


@app.post("/predict/audience-growth", response_model=AudienceGrowthResponse)
def predict_audience_growth_endpoint(body: AudienceGrowthRequest, request: Request):
    _check_auth(request)

    raw = predict_audience_growth(
        platform=body.platform,
        follower_count=body.follower_count,
        recent_follower_delta=body.recent_follower_delta,
        engagement_rate=body.engagement_rate,
        posts_count=body.posts_count,
        account_age_days=body.account_age_days,
        niche=body.primary_niche,
    )

    logger.info(
        "predict_audience_growth %s/@%s outlook=%s projection=%s",
        body.platform, body.username,
        raw.get("growth_outlook"), raw.get("audience_change_projection"),
    )

    return AudienceGrowthResponse(
        username=body.username,
        platform=body.platform,
        prediction_available=raw.get("prediction_available", False),
        confidence_score=raw.get("confidence_score"),
        audience_change_projection=raw.get("audience_change_projection"),
        growth_rate_projection=raw.get("growth_rate_projection"),
        growth_outlook=raw.get("growth_outlook"),
        signals=raw.get("signals", []),
        predicted_at=_now(),
    )


# ── /predict/audience-demographics ───────────────────────────────────────────────
@app.post("/predict/audience-demographics", response_model=AudienceDemographicsResponse)
def predict_audience_demographics_endpoint(body: AudienceDemographicsRequest, request: Request):
    _check_auth(request)

    raw = predict_audience_demographics(
        platform=body.platform or "",
        primary_niche=body.primary_niche,
        follower_count=body.follower_count,
        account_age_days=body.account_age_days,
    )

    logger.info(
        "predict_audience_demographics @%s niche=%s available=%s",
        body.username, body.primary_niche, raw.get("prediction_available"),
    )

    return AudienceDemographicsResponse(
        username=body.username,
        prediction_available=raw.get("prediction_available", False),
        confidence_score=raw.get("confidence_score"),
        dominant_age_range=raw.get("dominant_age_range"),
        gender_skew=raw.get("gender_skew"),
        audience_type=raw.get("audience_type"),
        source=raw.get("source", "curated_niche_index"),
        note=raw.get("note"),
        predicted_at=_now(),
    )


# ── /predict/brand-fit ──────────────────────────────────────────────────────────────
@app.post("/predict/brand-fit", response_model=BrandFitPredictionResponse)
def predict_brand_fit_endpoint(body: BrandFitPredictionRequest, request: Request):
    _check_auth(request)

    # Re-use existing analyze_brand_fit model for the score computation
    raw = analyze_brand_fit(
        platform=body.platform,
        follower_count=body.follower_count,
        engagement_rate=body.engagement_rate,
        primary_niche=body.primary_niche,
        brand_vertical=body.brand_vertical,
        bot_probability=body.bot_probability,
        target_audience_size=body.target_audience_size,
    )

    # Map recommendation label from affinity score
    affinity = raw.get("affinity_score", 0) or 0
    recommendation = (
        "strong_match" if affinity >= 0.70 else
        "potential_match" if affinity >= 0.45 else
        "weak_match"
    )

    logger.info(
        "predict_brand_fit %s/@%s recommendation=%s affinity=%.2f",
        body.platform, body.username, recommendation, affinity,
    )

    return BrandFitPredictionResponse(
        username=body.username,
        platform=body.platform,
        prediction_available=raw.get("data_available", False),
        affinity_score=raw.get("affinity_score"),
        confidence_score=raw.get("confidence_score"),
        recommendation=recommendation,
        breakdown=raw.get("breakdown"),
        signals=list(raw.get("breakdown", {}).keys()) if raw.get("breakdown") else [],
        predicted_at=_now(),
    )
