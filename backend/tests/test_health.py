def test_root_endpoint(client):
    """Test API gateway root endpoint and response status."""
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert "version" in data
    assert "docs_url" in data

def test_health_check_endpoint(client):
    """Test system health check endpoint."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "supabase_configured" in data
    assert "groq_configured" in data
    assert "gemini_configured" in data

def test_security_headers_present(client):
    """Verify OWASP-compliant security headers and performance timing headers."""
    res = client.get("/")
    assert res.status_code == 200
    assert "x-content-type-options" in res.headers
    assert res.headers["x-content-type-options"] == "nosniff"
    assert "x-frame-options" in res.headers
    assert res.headers["x-frame-options"] == "DENY"
    assert "x-xss-protection" in res.headers
    assert "x-process-time-ms" in res.headers

def test_openapi_docs_accessible(client):
    """Test Swagger OpenAPI schema is registered and accessible."""
    res = client.get("/openapi.json")
    assert res.status_code == 200
    data = res.json()
    assert "paths" in data
    assert "/api/schemas" in data["paths"]
    assert "/api/entities/{entity_name}" in data["paths"]
    assert "/api/ai/summarize" in data["paths"]
