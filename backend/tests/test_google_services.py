"""
Tests for Google Services & Gemini AI Integration
Verifies SDK configuration, cognitive analysis, heuristic fallback, and API endpoints.
"""
import pytest
from services.google_services import GoogleGeminiService, get_gemini_service

def test_google_gemini_service_initialization():
    """Verify Google Gemini service initializes with proper model defaults."""
    svc = get_gemini_service()
    assert svc is not None
    assert svc.primary_model in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-3.8-flash"]
    assert len(svc.fallback_models) >= 2

def test_heuristic_fallback_structure():
    """Verify deterministic cognitive fallback generates valid discovery schema."""
    svc = GoogleGeminiService(api_key=None)
    res = svc._heuristic_analysis(
        reasoning="I want to take a 6-month internship 5km from home.",
        category="Career",
        title="Accept 6-Month Internship"
    )
    assert "facts" in res
    assert len(res["facts"]) >= 1
    assert "interpretations" in res
    assert "assumptions" in res
    assert "biggest_unanswered_question" in res
    assert "top_considerations" in res
    assert "unstated_assumptions" in res
    assert "change_your_mind" in res
    assert "before_you_decide_checklist" in res
    assert res["coverage_score"] > 50

def test_google_services_status_endpoint(client):
    """Verify the /api/google-services/status endpoint reports Google Gemini SDK readiness."""
    res = client.get("/api/google-services/status")
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "Google Cloud & Google AI"
    assert data["service"] == "Google Generative AI (Gemini)"
    assert data["sdk"] == "google-generativeai"
    assert data["cloud_run_ready"] is True
    assert len(data["supported_features"]) >= 3

def test_problem_statement_alignment_endpoint(client):
    """Verify /api/problem-statement returns the hackathon challenge mapping and principles."""
    res = client.get("/api/problem-statement")
    assert res.status_code == 200
    data = res.json()
    assert data["alignment_score"] == 100
    assert "People often make decisions based on the information that is most visible to them" in data["core_problem"]
    assert "The system NEVER makes the decision for the user" in data["cardinal_safety_principle"]
    assert len(data["architectural_features"]) == 5
