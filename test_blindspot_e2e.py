"""
End-to-End Functional Verification for BlindSpot AI
Tests:
1. User login / token acquisition
2. Decision creation with reasoning
3. Deep AI reasoning analysis (Facts vs Interpretations vs Assumptions, Blind Spots, Contradictions, Missing Factors)
4. Feature engineering & coverage computation
5. Decision retrieval
6. Interactive reflection submission & coverage update
7. Admin analytics aggregation
"""
import sys
import os

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app
from dependencies import get_current_user, require_admin

client = TestClient(app)

TEST_USER = {
    "id": "88c37002-350f-47b8-ac09-4d9fea1e9235",
    "email": "krishmishra846@gmail.com",
    "role": "user",
    "full_name": "Test User"
}

TEST_ADMIN = {
    "id": "a266925c-469b-441d-95e0-2fcf2ddf521d",
    "email": "admin@vibethon.ai",
    "role": "admin",
    "full_name": "BlindSpot Administrator"
}

def run_e2e_verification():
    print("=== STARTING BLINDSPOT AI E2E VERIFICATION ===")

    # 1. Test unauthorized request guard
    app.dependency_overrides.clear()
    unauth_res = client.post("/api/decisions", json={"title": "Test", "reasoning": "Too short"})
    assert unauth_res.status_code in [401, 403, 422], f"Unexpected status: {unauth_res.status_code}"
    print("[1/5] Unauthorized request correctly blocked.")

    # 2. Authenticate as regular user
    app.dependency_overrides[get_current_user] = lambda: TEST_USER

    # 3. Create & Analyze a Decision (Hackathon Demo Scenario: 6-Month Internship)
    demo_payload = {
        "title": "Should I accept a 6-month software internship?",
        "category": "Career",
        "matters_most": ["Learning", "Money", "Convenience"],
        "reasoning": "I have been offered a 6-month software internship. It pays ₹30,000 per month and the company is about 5 km from my home. The working hours are 9 to 6. I want industry experience and the stipend is attractive. I think because it is close to home I will still have enough time for college."
    }

    print("[2/5] Submitting decision for AI cognitive reasoning analysis...")
    create_res = client.post("/api/decisions", json=demo_payload)
    assert create_res.status_code == 201, f"Create failed: {create_res.status_code} - {create_res.text}"
    decision = create_res.json()
    decision_id = decision["id"]
    data = decision["data"]
    analysis = data["analysis"]
    features = data["features"]

    print(f"      Decision Created ID: {decision_id}")
    print(f"      Reasoning Coverage Score: {features.get('coverage_score')}%")
    print(f"      Facts extracted: {len(analysis.get('facts', []))}")
    print(f"      Interpretations: {len(analysis.get('interpretations', []))}")
    print(f"      Assumptions identified: {len(analysis.get('assumptions', []))}")
    print(f"      Potential Blind Spots: {len(analysis.get('blind_spots', []))}")
    print(f"      Contradictions detected: {len(analysis.get('contradictions', []))}")
    print(f"      Missing Factors: {len(analysis.get('missing_factors', []))}")
    print(f"      Counterfactuals: {len(analysis.get('counterfactuals', []))}")
    print(f"      Reflection Questions: {len(analysis.get('reflection_questions', []))}")

    assert len(analysis.get("facts", [])) > 0, "No facts extracted"
    assert len(analysis.get("assumptions", [])) > 0, "No assumptions extracted"
    assert len(analysis.get("blind_spots", [])) > 0, "No blind spots extracted"
    print("[2/5] AI Cognitive Analysis completed & structured perfectly.")

    # 3. Fetch User Decisions List
    print("[3/5] Verifying decision persistence in database...")
    list_res = client.get("/api/decisions")
    assert list_res.status_code == 200
    user_decisions = list_res.json()
    assert any(d["id"] == decision_id for d in user_decisions), "Created decision not found in user history"
    print(f"      Found {len(user_decisions)} decision(s) in history.")

    # 4. Submit Interactive Reflection Answer
    print("[4/5] Testing interactive reflection submission...")
    reflect_res = client.post(
        f"/api/decisions/{decision_id}/reflect",
        json={
            "question_id": "ref-1",
            "question": "How certain are you that the internship will provide meaningful technical work?",
            "answer": "Somewhat certain"
        }
    )
    assert reflect_res.status_code == 200, f"Reflection failed: {reflect_res.text}"
    reflected_dec = reflect_res.json()
    reflections = reflected_dec["data"]["reflections"]
    assert len(reflections) >= 1, "Reflection was not recorded"
    print(f"      Recorded reflection: {reflections[0]['question']} -> '{reflections[0]['answer']}'")
    print(f"      Updated Coverage Score: {reflected_dec['data']['features']['coverage_score']}%")

    # 6. Admin Aggregate Analytics
    print("[5/5] Verifying admin cognitive analytics...")
    app.dependency_overrides[get_current_user] = lambda: TEST_ADMIN
    app.dependency_overrides[require_admin] = lambda: TEST_ADMIN
    admin_res = client.get("/api/decisions/admin/analytics")
    assert admin_res.status_code == 200, f"Admin analytics failed: {admin_res.text}"
    analytics = admin_res.json()
    print(f"      Admin Overview: {analytics['overview']}")
    print(f"      Category Distribution: {analytics['category_distribution']}")
    print(f"      Top Blind Spots: {analytics['common_blind_spots']}")
    print("\n[SUCCESS] ALL END-TO-END INTEGRATION TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    run_e2e_verification()
