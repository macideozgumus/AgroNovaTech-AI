from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_login_and_parcels_flow():
    login = client.post("/api/v1/auth/login", json={"username": "demo", "password": "demo123"})
    assert login.status_code == 200
    assert "access_token" in login.json()
    assert login.json()["province"] == "Sakarya"

    parcels = client.get("/api/v1/villages/v1/parcels")
    assert parcels.status_code == 200
    assert len(parcels.json()["parcels"]) == 16


def test_layout_neighbors_score_decision_flow():
    put_layout = client.put("/api/v2/villages/v1/field-layout", json={"field_layout_position": "top"})
    assert put_layout.status_code == 200

    neighbors = client.get("/api/v2/parcels/a_p1/neighbors", params={"season": "2026_Spring"})
    assert neighbors.status_code == 200
    assert "neighbors" in neighbors.json()

    score = client.post(
        "/api/v1/decision/score",
        json={
            "village_id": "v1",
            "season": "2026_Spring",
            "parcel_id": "a_p1",
            "ml_score": 65,
            "ml_confidence": 0.7,
        },
    )
    assert score.status_code == 200
    assert score.json()["model_version"] in {"hybrid_v1", "rules_v2"}

    decision = client.get("/api/v1/parcels/a_p1/decision", params={"season": "2026_Spring"})
    assert decision.status_code == 200
    assert decision.json()["parcel_id"] == "a_p1"


def test_register_and_list_users_flow():
    register = client.post(
        "/api/v1/auth/register",
        json={
            "username": "backend_case",
            "password": "secure123",
            "province": "Ankara",
            "district": "Bala",
            "village": "Bala Asagi Koyu",
        },
    )
    assert register.status_code == 200
    assert register.json()["username"] == "backend_case"
    assert register.json()["district"] == "Bala"

    users = client.get("/api/v1/users")
    assert users.status_code == 200
    payload = users.json()["users"]
    assert any(item["username"] == "backend_case" for item in payload)

    ai_status = client.get("/api/v1/ai/status")
    assert ai_status.status_code == 200
    assert ai_status.json()["enabled"] is False
    assert ai_status.json()["provider"] is None


def test_invalid_contract_cases():
    bad_login = client.post("/api/v1/auth/login", json={"username": "demo", "password": "wrong"})
    assert bad_login.status_code == 401

    duplicate_register = client.post(
        "/api/v1/auth/register",
        json={
            "username": "demo",
            "password": "demo123",
            "province": "Sakarya",
            "district": "Serdivan",
            "village": "Kazimpasa Koyu",
        },
    )
    assert duplicate_register.status_code == 409

    bad_village = client.get("/api/v1/villages/unknown/parcels")
    assert bad_village.status_code == 404

    bad_neighbors = client.get("/api/v2/parcels/unknown/neighbors", params={"season": "2026_Spring"})
    assert bad_neighbors.status_code == 404


def test_scenario_recommendation_and_crud_flow():
    recommend = client.post("/api/v1/scenario/recommend", json={"village_id": "v1", "season": "2026_Spring"})
    assert recommend.status_code == 200
    payload = recommend.json()
    assert payload["graph_node_count"] == 16
    assert len(payload["plans"]) == 3
    assert payload["plans"][0]["selections"]

    create = client.post(
        "/api/v1/scenarios",
        json={
            "name": "Ilkbahar Arastirma",
            "village_id": "v1",
            "season": "2026_Spring",
            "plan_type": "balanced",
            "parcels": [
                {"parcel_id": "a_p1", "crop": "wheat"},
                {"parcel_id": "a_p2", "crop": "barley"},
            ],
        },
    )
    assert create.status_code == 200
    created = create.json()
    assert created["name"] == "Ilkbahar Arastirma"
    assert created["balanced_count"] >= 0

    list_response = client.get("/api/v1/scenarios", params={"village_id": "v1"})
    assert list_response.status_code == 200
    assert any(item["id"] == created["id"] for item in list_response.json()["scenarios"])

    get_response = client.get(f"/api/v1/scenarios/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == created["id"]


def test_harvest_plan_crud_flow():
    create = client.post(
        "/api/v1/harvest-plans",
        json={
            "title": "Bugday Hasadi",
            "parcel_id": "a_p3",
            "planned_date": "2026-05-14",
            "notes": "Sabah ekibi ile basla",
            "status": "planned",
        },
    )
    assert create.status_code == 200
    created = create.json()
    assert created["status"] == "planned"

    list_response = client.get("/api/v1/harvest-plans")
    assert list_response.status_code == 200
    assert any(item["id"] == created["id"] for item in list_response.json()["harvest_plans"])

    update = client.put(
        f"/api/v1/harvest-plans/{created['id']}",
        json={
            "title": "Bugday Hasadi Revize",
            "parcel_id": "a_p3",
            "planned_date": "2026-05-15",
            "notes": "Ogleden sonra",
            "status": "active",
        },
    )
    assert update.status_code == 200
    assert update.json()["status"] == "active"

    delete = client.delete(f"/api/v1/harvest-plans/{created['id']}")
    assert delete.status_code == 200
    assert delete.json()["status"] == "deleted"


def test_scenario_harvest_and_ai_edge_cases():
    bad_recommend = client.post("/api/v1/scenario/recommend", json={"village_id": "unknown", "season": "2026_Spring"})
    assert bad_recommend.status_code == 404

    bad_scenario = client.post(
        "/api/v1/scenarios",
        json={
            "name": "ab",
            "village_id": "v1",
            "season": "2026_Spring",
            "parcels": [{"parcel_id": "unknown", "crop": "wheat"}],
        },
    )
    assert bad_scenario.status_code in {400, 404}

    bad_harvest = client.post(
        "/api/v1/harvest-plans",
        json={
            "title": "aa",
            "parcel_id": "unknown",
            "planned_date": "",
            "notes": "",
            "status": "planned",
        },
    )
    assert bad_harvest.status_code in {400, 404}

    bad_harvest_update = client.put(
        "/api/v1/harvest-plans/unknown",
        json={
            "title": "Deneme",
            "parcel_id": "a_p1",
            "planned_date": "2026-05-10",
            "notes": "",
            "status": "done",
        },
    )
    assert bad_harvest_update.status_code == 404


def test_scenario_chat_endpoint():
    """POST /api/v1/scenario/chat — açıklama katmanı doğal dil yanıt döner."""
    resp = client.post(
        "/api/v1/scenario/chat",
        json={
            "plan_id": "balanced_v1",
            "user_message": "Bu planı neden önerdin?",
            "village_id": "v1",
            "season": "2026_Spring",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "reply" in body
    assert isinstance(body["suggestions"], list)
    assert len(body["suggestions"]) > 0
    assert body["provider"] in {"fallback", "gemini"}
    assert "optimizer" in body["reply"] or "skor motoru" in body["reply"] or "planı" in body["reply"]


def test_scenario_chat_missing_fields():
    """Eksik user_message alanı ile 422 validation error beklenir."""
    resp = client.post(
        "/api/v1/scenario/chat",
        json={
            "plan_id": "balanced_v1",
            "village_id": "v1",
            "season": "2026_Spring",
        },
    )
    assert resp.status_code == 422


def test_scenario_plan_response_new_fields():
    """Recommend response'unda hybrid mimari alanları dolu olarak dönmeli."""
    resp = client.post("/api/v1/scenario/recommend", json={"village_id": "v1", "season": "2026_Spring"})
    assert resp.status_code == 200
    plans = resp.json()["plans"]
    assert len(plans) > 0
    first_plan = plans[0]
    assert "optimizer_score" in first_plan
    assert "final_score" in first_plan
    assert "final_rank" in first_plan
    assert "rules_passed" in first_plan
    assert "rules_warnings" in first_plan
    assert "llm_provider" in first_plan
    assert "llm_explanation" in first_plan
    assert "what_if" in first_plan
    assert isinstance(first_plan["optimizer_score"], (int, float))
    assert isinstance(first_plan["final_score"], (int, float))
    assert first_plan["final_rank"] == 1
    assert isinstance(first_plan["rules_passed"], bool)
    assert isinstance(first_plan["rules_warnings"], list)
    assert first_plan["llm_provider"] in {"fallback", "gemini"}
    assert isinstance(first_plan["llm_explanation"], str)
    assert first_plan["llm_explanation"]
    assert isinstance(first_plan["what_if"], list)
    assert len(first_plan["what_if"]) > 0
