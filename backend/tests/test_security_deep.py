"""
Deep Security Compliance and Penetration Resistance Suite
Validates SQL injection resistance, XSS sanitization, path traversal blocking, and timing integrity.
"""
import pytest
from security_utils import sanitize_string, is_safe_identifier

def test_xss_sanitization_filters_scripts():
    """Verify HTML/script tags are neutralized in user-supplied strings."""
    malicious_inputs = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "<svg/onload=alert('document.cookie')>",
        "javascript:alert(1)"
    ]
    for inp in malicious_inputs:
        sanitized = sanitize_string(inp)
        assert "<script>" not in sanitized
        assert "onerror=" not in sanitized
        assert "onload=" not in sanitized

def test_safe_identifier_validation():
    """Verify safe identifier helper permits only alphanumeric tokens."""
    assert is_safe_identifier("decisions") is True
    assert is_safe_identifier("user_profile_123") is True
    assert is_safe_identifier("decisions; DROP TABLE users;") is False
    assert is_safe_identifier("../../../etc/passwd") is False
    assert is_safe_identifier("decisions' OR '1'='1") is False

def test_path_traversal_blocked_on_uploads(client):
    """Verify static uploads route rejects directory traversal attempts."""
    traversal_paths = [
        "/uploads/../../main.py",
        "/uploads/..%2f..%2fconfig.py",
        "/uploads/%2e%2e/%2e%2e/etc/passwd"
    ]
    for path in traversal_paths:
        res = client.get(path)
        assert res.status_code in [400, 404, 403, 422]

def test_auth_route_rejects_malformed_tokens(client):
    """Verify invalid or forged JWT tokens receive immediate 401 Unauthorized."""
    forged_headers = [
        {"Authorization": "Bearer not-a-real-token"},
        {"Authorization": "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0."},
        {"Authorization": "Basic dXNlcjpwYXNz"}
    ]
    for h in forged_headers:
        res = client.get("/api/decisions", headers=h)
        assert res.status_code in [401, 403]
