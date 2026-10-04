import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure backend folder is in python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from dependencies import get_current_user, require_admin, get_optional_user

# Mock user payloads
MOCK_OPERATOR = {
    "id": "mock-operator-uuid-1234",
    "email": "operator@vibethon.dev",
    "role": "authenticated",
    "full_name": "Test Operator"
}

MOCK_ADMIN = {
    "id": "mock-admin-uuid-5678",
    "email": "admin@vibethon.dev",
    "role": "admin",
    "full_name": "Security Administrator"
}

@pytest.fixture
def client():
    """Default test client with no auth overrides."""
    with TestClient(app) as c:
        yield c

@pytest.fixture
def operator_client():
    """Test client authenticated as regular operator."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_OPERATOR
    app.dependency_overrides[get_optional_user] = lambda: MOCK_OPERATOR
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def admin_client():
    """Test client authenticated as administrator."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_ADMIN
    app.dependency_overrides[require_admin] = lambda: MOCK_ADMIN
    app.dependency_overrides[get_optional_user] = lambda: MOCK_ADMIN
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
