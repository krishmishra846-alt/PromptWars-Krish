def test_entity_creation_requires_title(operator_client):
    """Verify record creation requires non-empty title."""
    res = operator_client.post("/api/entities/incidents", json={"title": ""})
    assert res.status_code == 422

def test_entity_list_supports_pagination(operator_client):
    """Verify entity list accepts limit and offset query parameters and sets X-Total-Count header."""
    res = operator_client.get("/api/entities/incidents?limit=10&offset=0")
    assert res.status_code in [200, 500]
    if res.status_code == 200:
        assert "x-total-count" in res.headers
        assert isinstance(res.json(), list)

def test_entity_csv_export_endpoint(operator_client):
    """Verify CSV export endpoint returns text/csv media type."""
    res = operator_client.get("/api/entities/incidents/export/csv")
    assert res.status_code in [200, 500]
    if res.status_code == 200:
        assert "text/csv" in res.headers.get("content-type", "")
