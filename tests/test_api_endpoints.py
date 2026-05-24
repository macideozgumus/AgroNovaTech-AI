import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.village_service import reset_village_data

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_demo_parcels():
    reset_village_data()


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


def test_subdivide_and_risk_summary_flow():
    subdivide = client.post(
        "/api/v1/parcels/a_p1/subdivide",
        json={"requested_count": 3, "split_strategy": "equal_grid"},
    )
    assert subdivide.status_code == 200
    payload = subdivide.json()
    assert payload["requested_count"] == 3
    assert len(payload["subparcels"]) == 3
    assert all(item["parent_parcel_id"] == "a_p1" for item in payload["subparcels"])

    parcels = client.get("/api/v1/villages/v1/parcels")
    assert parcels.status_code == 200
    parcel_ids = {item["parcel_id"] for item in parcels.json()["parcels"]}
    assert "a_p1" not in parcel_ids
    assert "a_p1_s1" in parcel_ids

    crop_update = client.put("/api/v1/subparcels/a_p1_s1/crop", json={"planned_crop": "barley"})
    assert crop_update.status_code == 200
    assert crop_update.json()["planned_crop"] == "barley"

    rename = client.put("/api/v1/parcels/a_p1_s1/name", json={"display_name": "Deneme Parseli"})
    assert rename.status_code == 200
    assert rename.json()["display_name"] == "Deneme Parseli"

    summary = client.get("/api/v1/parcels/a_p1/risk-summary", params={"season": "2026_Spring"})
    assert summary.status_code == 200
    body = summary.json()
    assert body["parcel_id"] == "a_p1"
    assert body["child_count"] == 3
    assert len(body["subparcels"]) == 3


def test_whole_field_subdivide_undo_and_delete_flow():
    subdivide = client.post(
        "/api/v1/fields/A/subdivide",
        json={"requested_count": 5, "split_strategy": "equal_grid"},
    )
    assert subdivide.status_code == 200
    payload = subdivide.json()
    assert payload["field_block"] == "A"
    assert len(payload["parcels"]) == 5
    assert payload["parcels"][0]["display_name"] == "Parsel 1"

    parcels = client.get("/api/v1/villages/v1/parcels").json()["parcels"]
    a_ids = {item["parcel_id"] for item in parcels if item["field_block"] == "A"}
    assert "a_p1" not in a_ids
    assert "field_a_root_s1" in a_ids

    deleted = client.delete("/api/v1/parcels/field_a_root_s1")
    assert deleted.status_code == 200
    remaining = {item["parcel_id"] for item in deleted.json()["parcels"]}
    assert "field_a_root_s1" not in remaining

    undo = client.post("/api/v1/parcels/field_a_root_s2/undo")
    assert undo.status_code == 200
    restored = {item["parcel_id"] for item in undo.json()["parcels"]}
    assert "a_p1" in restored
    assert "a_p8" in restored


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
    resp = client.post(
        "/api/v1/scenario/chat",
        json={
            "plan_id": "balanced_v1",
            "user_message": "Bu plani neden onerdin?",
            "village_id": "v1",
            "season": "2026_Spring",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "reply" in body
    assert isinstance(body["suggestions"], list)
