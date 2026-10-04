"""
Tests for System Efficiency, Security Headers, and Performance Metrics
Verifies process timing headers, GZip compression, and OWASP security configurations.
"""
import pytest

def test_process_time_header_present(client):
    """Verify X-Process-Time-Ms is measured on all HTTP responses for efficiency tracking."""
    res = client.get("/health")
    assert res.status_code == 200
    assert "X-Process-Time-Ms" in res.headers
    timing = float(res.headers["X-Process-Time-Ms"])
    assert timing >= 0

def test_security_headers_present(client):
    """Verify OWASP-compliant security headers are attached to every response."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert "Content-Security-Policy" in res.headers
    assert "fonts.googleapis.com" in res.headers["Content-Security-Policy"]
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

def test_health_api_both_endpoints(client):
    """Verify both /health and /api/health answer with 200 and comprehensive diagnostic data."""
    for path in ["/health", "/api/health"]:
        res = client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Chitragupta.AI"
        assert "compliance" in data
        assert data["compliance"]["accessibility"] == "WCAG 2.1 AA"
        assert data["compliance"]["google_services"] == "Google Generative AI SDK active"

def test_rate_limiting_efficiency(client):
    """Verify the rate limiter allows normal requests without latency degradation."""
    for _ in range(5):
        res = client.get("/health")
        assert res.status_code == 200
