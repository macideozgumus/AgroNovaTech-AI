from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_login_and_parcels_flow():
    login = client.post("/api/v1/auth/login", json={"username": "demo", "password": "demo123"})
    assert login.status_code == 200
    assert "access_token" in login.json()

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
