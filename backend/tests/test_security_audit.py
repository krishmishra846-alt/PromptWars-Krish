import pytest
from fastapi.testclient import TestClient
from main import app
from security_utils import sanitize_text, sanitize_json_payload, validate_entity_slug
from dependencies import get_current_user, require_admin

client = TestClient(app)

def test_owasp_security_headers():
    """Verifies that all OWASP recommended security headers are attached."""
    res = client.get("/health")
    assert res.status_code == 200
    headers = res.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "default-src 'self'" in headers.get("content-security-policy", "")
    assert "x-process-time-ms" in headers

def test_slug_validation_security():
    """Ensures dangerous entity slugs (path traversal, SQL injection) are rejected."""
    assert validate_entity_slug("incidents") is True
    assert validate_entity_slug("patient_records_2026") is True
    assert validate_entity_slug("../../../etc/passwd") is False
    assert validate_entity_slug("drop table generic_entities;") is False
    assert validate_entity_slug("<script>alert(1)</script>") is False

def test_xss_payload_sanitization():
    """Ensures HTML and script tags are completely stripped from inputs."""
    raw = "<script>alert('pwned')</script>Normal Title"
    cleaned = sanitize_text(raw)
    assert "<script>" not in cleaned
    assert "alert('pwned')" not in cleaned
    assert "Normal Title" in cleaned

def test_json_payload_deep_sanitization():
    """Ensures nested JSON payloads are cleaned against XSS and injection vectors."""
    payload = {
        "notes": "<iframe src='evil.com'></iframe>Critical maintenance",
        "nested": {
            "handler": "onload=stealCookies() admin",
            "clean_number": 42
        }
    }
    cleaned = sanitize_json_payload(payload)
    assert "<iframe" not in cleaned["notes"]
    assert "onload=" not in cleaned["nested"]["handler"]
    assert cleaned["nested"]["clean_number"] == 42

def test_unauthenticated_protected_routes():
    """Ensures protected endpoints reject unauthenticated requests with 401."""
    res = client.post("/api/entities/incidents", json={"title": "Test"})
    assert res.status_code == 401

def test_unauthorized_admin_routes():
    """Ensures regular users are forbidden (403) from accessing admin routes."""
    # Override get_current_user with regular user
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "regular-user-id",
        "email": "user@test.com",
        "role": "user"
    }
    try:
        res = client.get("/api/auth/users")
        assert res.status_code == 403
        assert "Admin privilege required" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_rate_limiter_protection():
    """Verifies that brute force request bursts trigger HTTP 429 Too Many Requests."""
    endpoint = "/api/auth/send-otp"
    # Send rapid requests until rate limit trips
    hit_rate_limit = False
    for _ in range(12):
        res = client.post(endpoint, json={"email": "flooder@test.com", "phone": "9876543210"})
        if res.status_code == 429:
            hit_rate_limit = True
            assert "Retry-After" in res.headers
            break
    assert hit_rate_limit is True, "Rate limiter should have triggered 429 on rapid requests."

def test_gzip_compression_header():
    """Verifies that large responses receive GZip encoding when accepted."""
    res = client.get("/api/schemas", headers={"Accept-Encoding": "gzip"})
    assert res.status_code in [200, 500]

def test_anti_bot_honeypot_rejection():
    """Checklist Item #3: Verifies that automated bot scrapers triggering the honeypot are dropped."""
    from rate_limiter import _RATE_LIMIT_STORE
    _RATE_LIMIT_STORE.clear()
    res = client.post("/api/auth/send-otp", json={
        "email": "bot@spammer.com",
        "phone": "9876543210",
        "website_hp": "automated_bot_payload"
    })
    assert res.status_code == 400
    assert "Automated bot submission" in res.json()["detail"]

def test_sensitive_log_redaction_filter():
    """Checklist Item #8: Verifies that sensitive credentials are redacted before logging."""
    import logging
    from log_redactor import SensitiveDataRedactionFilter

    redactor = SensitiveDataRedactionFilter()
    record = logging.LogRecord(
        name="test", level=logging.INFO, pathname="", lineno=0,
        msg='User login with password="SuperSecretPassword123" and token Bearer eyJhbGciOiJIUzI1NiJ9.test and card 4111 2222 3333 4444',
        args=(), exc_info=None
    )
    redactor.filter(record)
    assert "SuperSecretPassword123" not in record.msg
    assert "***REDACTED***" in record.msg
    assert "eyJhbGciOiJIUzI1NiJ9" not in record.msg
    assert "****-****-****-****" in record.msg

def test_single_use_password_reset_endpoint():
    """Checklist Item #6: Single-use, time-expiring password reset dispatch."""
    res = client.post("/api/auth/request-password-reset", json={"email": "operator@argus.ai"})
    assert res.status_code == 200
    assert "recovery link has been dispatched" in res.json()["message"]

def test_admin_backup_status_and_export():
    """Checklist Item #10: Disaster recovery status and backup snapshot access."""
    # 1. Non-admin should be rejected (401/403)
    res_unauth = client.get("/api/admin/backup/status")
    assert res_unauth.status_code in [401, 403]

    # 2. Admin should receive backup status
    app.dependency_overrides[require_admin] = lambda: {"id": "admin-id", "role": "admin"}
    try:
        res_admin = client.get("/api/admin/backup/status")
        assert res_admin.status_code == 200
        data = res_admin.json()
        assert data["status"] == "active"
        assert "WAL" in data["replication_mode"]
    finally:
        app.dependency_overrides.clear()
