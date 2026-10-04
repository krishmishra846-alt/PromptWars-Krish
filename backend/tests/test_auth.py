def test_unauthenticated_protected_endpoint(client):
    """Ensure sensitive endpoints reject requests without authorization tokens."""
    res = client.get("/api/auth/me")
    assert res.status_code == 401

def test_send_otp_missing_fields(client):
    """Verify registration OTP validation rejects empty body."""
    res = client.post("/api/auth/send-otp", json={})
    assert res.status_code == 422

def test_operator_access_me(operator_client):
    """Verify authenticated operator can access own profile."""
    res = operator_client.get("/api/auth/me")
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "operator@vibethon.dev"
    assert data["role"] == "authenticated"

def test_admin_access_me(admin_client):
    """Verify administrator identity resolution."""
    res = admin_client.get("/api/auth/me")
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "admin@vibethon.dev"
    assert data["role"] == "admin"
