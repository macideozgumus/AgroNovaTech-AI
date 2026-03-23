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
