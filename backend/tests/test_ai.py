def test_summarize_empty_payload_rejected(operator_client):
    """Verify summarize endpoint rejects empty requests without data or content."""
    res = operator_client.post("/api/ai/summarize", json={})
    assert res.status_code == 400

def test_suggest_schema_requires_prompt(operator_client):
    """Verify suggest-schema endpoint enforces non-empty problem statement."""
    res = operator_client.post("/api/ai/suggest-schema", json={})
    assert res.status_code == 422

def test_ai_query_structure_validation(operator_client):
    """Verify natural language query validation rejects missing queries."""
    res = operator_client.post("/api/ai/query", json={"entity_name": "incidents"})
    assert res.status_code == 422
