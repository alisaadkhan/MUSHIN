"""
tests/test_app_integration.py

Integration tests for the FastAPI app using HTTPX TestClient.
Run with: pytest tests/
"""
import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)


def test_health_returns_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_analyze_minimal_payload():
    """Minimal payload — only follower_count provided."""
    payload = {
        "platform": "instagram",
        "username": "testuser",
        "metrics": {"follower_count": 50000}
    }
    resp = client.post("/analyze", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["platform"] == "instagram"
    assert data["username"] == "testuser"
    assert "bot_detection" in data
    assert "engagement_anomaly" in data
    assert "analyzed_at" in data


def test_analyze_full_payload():
    payload = {
        "platform": "tiktok",
        "username": "pakinfluencer",
        "metrics": {
            "follower_count": 250000,
            "following_count": 500,
            "posts_count": 300,
            "engagement_rate": 5.5,
            "avg_likes": 12000,
            "avg_comments": 800,
            "avg_views": 150000,
            "recent_follower_delta": 5000
        },
        "primary_niche": "Fashion"
    }
    resp = client.post("/analyze", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    bot = data["bot_detection"]
    assert bot["data_available"] is True
    assert bot["bot_probability"] is not None
    assert 0.0 <= bot["bot_probability"] <= 1.0
    assert bot["risk_level"] in ("low", "medium", "high")


def test_analyze_no_follower_count_returns_unavailable():
    """When follower_count is absent, both sub-analyses must be unavailable."""
    payload = {
        "platform": "youtube",
        "username": "ghostchannel",
        "metrics": {"engagement_rate": 1.5}
    }
    resp = client.post("/analyze", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["bot_detection"]["data_available"] is False
    assert data["engagement_anomaly"]["data_available"] is False


def test_analyze_invalid_platform_rejected():
    """Invalid platform should fail Pydantic validation."""
    payload = {
        "platform": "snapchat",
        "username": "user",
        "metrics": {"follower_count": 1000}
    }
    resp = client.post("/analyze", json=payload)
    assert resp.status_code == 422
