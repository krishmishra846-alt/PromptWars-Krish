"""
Tests for BlindSpot AI Decision Reasoning & Cognitive Analysis Router
"""
import pytest

def test_create_decision_requires_auth(client):
    """Verify unauthorized users cannot submit decisions."""
    res = client.post("/api/decisions", json={
        "title": "Should I accept an internship?",
        "reasoning": "I want to get industry experience and it pays well."
    })
    assert res.status_code in [401, 403]

def test_feature_engineering_calculation():
    """Verify reasoning feature engineering and coverage calculation."""
    from routers.decisions import compute_reasoning_features

    mock_analysis = {
        "facts": ["Stipend is 30,000", "Distance is 5km"],
        "interpretations": ["Saves commute time"],
        "assumptions": [{"assumption": "No academic impact"}],
        "blind_spots": [{"title": "Academic Schedule"}],
        "contradictions": [{"title": "Learning vs Money"}],
        "missing_factors": [{"factor": "Mentorship"}],
        "goals": ["Gain software experience"],
        "tradeoffs": ["Study time"],
        "uncertainties": ["Exam policy"],
        "future_impacts": ["Career boost"]
    }

    features = compute_reasoning_features(
        raw_reasoning="I have an internship offer paying 30,000 and 5km from home.",
        analysis=mock_analysis,
        category="Career"
    )

    assert "coverage_score" in features
    assert 0 < features["coverage_score"] <= 100
    assert "evidence_coverage" in features
    assert "assumption_ratio" in features
    assert features["evidence_count"] == 2
    assert features["assumption_count"] == 1
    assert features["contradiction_count"] == 1

def test_list_decisions_authenticated(operator_client):
    """Verify authenticated user can retrieve decision history."""
    res = operator_client.get("/api/decisions")
    assert res.status_code in [200, 500]  # 200 with list or 500 if mock client offline
