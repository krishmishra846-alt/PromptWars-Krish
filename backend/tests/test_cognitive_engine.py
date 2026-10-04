"""
Comprehensive Unit Tests for Chitragupta.AI Cognitive Reasoning Engine
Validates feature engineering, coverage formulas, contradiction logic, and edge-case resilience.
"""
import pytest
from routers.decisions import (
    compute_reasoning_features,
    _normalize_analysis_data,
    _build_deterministic_fallback_analysis
)

def test_feature_engineering_full_spectrum():
    """Verify reasoning feature calculation handles all cognitive dimensions."""
    mock_analysis = {
        "facts": ["Offered 6-month software internship", "Stipend is Rs 30,000", "Located 5km away"],
        "interpretations": ["Saves commute time", "Will still have time for studies"],
        "assumptions": [
            {"assumption": "Working hours won't clash with college exams"}
        ],
        "blind_spots": [
            {"title": "Academic Attendance Compliance"}
        ],
        "contradictions": [
            {"title": "Stated Learning Goal vs Salary Focus"}
        ],
        "missing_factors": [
            {"factor": "Senior Mentorship Availability"}
        ],
        "goals": ["Gain software experience"],
        "tradeoffs": ["Study hours vs work hours"],
        "uncertainties": ["Exam leave policy"],
        "future_impacts": ["Resume enhancement"]
    }

    features = compute_reasoning_features(
        raw_reasoning="I have an internship paying 30000 5km away.",
        analysis=mock_analysis,
        category="Career"
    )

    assert "coverage_score" in features
    assert 0 <= features["coverage_score"] <= 100
    assert features["evidence_count"] == 3
    assert features["assumption_count"] == 1
    assert features["blind_spot_count"] == 1
    assert features["contradiction_count"] == 1
    assert features["tradeoff_count"] >= 1
    assert features["evidence_coverage"] > 0
    assert features["assumption_ratio"] > 0

def test_deterministic_fallback_completeness():
    """Verify deterministic fallback engine produces complete, valid schemas."""
    fallback = _build_deterministic_fallback_analysis(
        title="Accept Software Internship",
        reasoning="Pays well and close to home.",
        category="Career",
        matters_most="Skill development"
    )

    assert "facts" in fallback
    assert len(fallback["facts"]) >= 1
    assert "interpretations" in fallback
    assert "assumptions" in fallback
    assert "blind_spots" in fallback
    assert "biggest_unanswered_question" in fallback
    assert "top_considerations" in fallback
    assert "unstated_assumptions" in fallback
    assert "change_your_mind" in fallback
    assert "before_you_decide_checklist" in fallback

def test_normalization_edge_cases():
    """Verify normalizer handles non-standard casing, empty arrays, and missing keys gracefully."""
    malformed = {
        "Facts": ["Point A"],
        "ASSUMPTIONS": ["Unverified leap"],
        "random_extra": 123
    }
    normalized = _normalize_analysis_data(malformed, category="Education")

    assert "facts" in normalized
    assert len(normalized["facts"]) == 1
    assert "assumptions" in normalized
    assert "blind_spots" in normalized
    assert "top_considerations" in normalized
    assert "coverage_score" in normalized
    assert normalized["coverage_score"] > 0

def test_empty_reasoning_resilience():
    """Verify cognitive analyzer gracefully handles minimal input without exceptions."""
    fallback = _build_deterministic_fallback_analysis(
        title="General Choice",
        reasoning="",
        category="Other",
        matters_most=""
    )
    assert fallback is not None
    assert isinstance(fallback["facts"], list)
    assert isinstance(fallback["assumptions"], list)
    assert isinstance(fallback["before_you_decide_checklist"], list)
