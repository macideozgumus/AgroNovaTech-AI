from __future__ import annotations

import time
from collections import Counter, deque
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.app.db.session import init_db
from backend.app.decision_engine import combine_rules_with_ml, compute_rules_score
from backend.app.models.decision_result import DecisionResult
from backend.app.repositories.decision_repository import get_decision as repo_get_decision
from backend.app.repositories.decision_repository import upsert_decision
from backend.app.services.auth_service import authenticate_user, list_users as auth_list_users, register_user
from backend.app.services.village_service import (
    PARCELS,
    PLOTS,
    VALID_LAYOUTS,
    ensure_parcel,
    ensure_village,
    get_layout,
    get_neighbor_ids,
    get_parcel_crop,
    list_parcels as village_list_parcels,
    update_layout,
)

app = FastAPI(title="AgroNova Mobile API", version="2.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    # Expo tunnel origins (https://*.exp.direct) and localhost variants.
    allow_origin_regex=r"^https://.*\.exp\.direct$|^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INCOMPATIBLE_HIGH = {("corn", "sunflower"), ("sunflower", "corn")}
INCOMPATIBLE_MEDIUM = {
    ("corn", "wheat"),
    ("wheat", "corn"),
    ("sunflower", "wheat"),
    ("wheat", "sunflower"),
}

LATENCY_SAMPLES_MS: deque[float] = deque(maxlen=100)


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    province: str
    district: str
    village: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    username: str
    province: str
    district: str
    village: str


class UserSummary(BaseModel):
    username: str
    province: str
    district: str
    village: str


class UsersResponse(BaseModel):
    users: list[UserSummary]


class ParcelItem(BaseModel):
    parcel_id: str
    field_block: Literal["A", "B"]
    planned_crop: str


class ParcelListResponse(BaseModel):
    village_id: str
    parcels: list[ParcelItem]


class FieldLayoutUpdateRequest(BaseModel):
    field_layout_position: Literal["top", "right", "bottom", "left"]


class FieldLayoutResponse(BaseModel):
    village_id: str
    field_layout_position: Literal["top", "right", "bottom", "left"]
    valid_positions: list[str]
    message: Optional[str] = None


class NeighborsResponse(BaseModel):
    parcel_id: str
    season: str
    layout_position: Literal["top", "right", "bottom", "left"]
    neighbors: dict[str, list[dict[str, str]]]


class ScoreRequest(BaseModel):
    village_id: str
    season: str
    parcel_id: str
    ml_score: Optional[float] = Field(default=None, ge=0, le=100)
    ml_confidence: Optional[float] = Field(default=None, ge=0, le=1)


class DecisionResponse(BaseModel):
    parcel_id: str
    season: str
    risk_score: int
    risk_level: Literal["OK", "RISKY", "CRITICAL"]
    reason_codes: list[str]
    confidence: Optional[float]
    model_version: str
    decision_source: Literal["rules_only", "hybrid"]


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.middleware("http")
async def track_latency(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    LATENCY_SAMPLES_MS.append(elapsed_ms)
    response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.2f}"
    response.headers["X-Latency-Target-Ms"] = "800"
    return response


def _risk_level(score: int) -> str:
    if score >= 70:
        return "CRITICAL"
    if score >= 40:
        return "RISKY"
    return "OK"


def _classify_pair(a: str, b: str) -> str:
    if a == b:
        return "same"
    if (a, b) in INCOMPATIBLE_HIGH:
        return "high"
    if (a, b) in INCOMPATIBLE_MEDIUM:
        return "medium"
    return "ok"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    username, user = authenticate_user(payload.username, payload.password)
    return LoginResponse(
        access_token=f"demo-token-{username}",
        username=username,
        province=user["province"],
        district=user["district"],
        village=user["village"],
    )


@app.post("/api/v1/auth/register", response_model=LoginResponse)
def register(payload: RegisterRequest) -> LoginResponse:
    username, user = register_user(
        username=payload.username,
        password=payload.password,
        province=payload.province,
        district=payload.district,
        village=payload.village,
    )
    return LoginResponse(
        access_token=f"demo-token-{username}",
        username=username,
        province=user["province"],
        district=user["district"],
        village=user["village"],
    )


@app.get("/api/v1/users", response_model=UsersResponse)
def list_users() -> UsersResponse:
    return UsersResponse(users=[UserSummary(**item) for item in auth_list_users()])


@app.get("/api/v1/villages/{village_id}/parcels", response_model=ParcelListResponse)
def list_parcels(village_id: str) -> ParcelListResponse:
    return ParcelListResponse(village_id=village_id, parcels=[ParcelItem(**item) for item in village_list_parcels(village_id)])


@app.get("/api/v1/metrics/latency")
def latency_metrics() -> dict:
    # Macide - Persembe ozgun requirement: p50 ve p95 latency metrikleri
    # p50 (medyan): isteklerin yarisi bu sureden hizli - tek yavас istegin ortalamayı bozmasını onler
    # p95: isteklerin %95'i bu sureden hizli - gercek performans siniri
    samples = sorted(LATENCY_SAMPLES_MS)
    avg = sum(samples) / len(samples) if samples else 0.0
    p50 = samples[len(samples) // 2] if samples else None
    p95 = samples[int(len(samples) * 0.95)] if samples else None
    return {
        "target_ms": 800,
        "sample_count": len(samples),
        "avg_ms": round(avg, 2),
        "p50_ms": round(p50, 2) if p50 is not None else None,
        "p95_ms": round(p95, 2) if p95 is not None else None,
        "latest_ms": round(samples[-1], 2) if samples else None,
        "under_target": avg < 800 if samples else True,
    }


@app.put("/api/v2/villages/{village_id}/field-layout", response_model=FieldLayoutResponse)
def put_field_layout(village_id: str, payload: FieldLayoutUpdateRequest) -> FieldLayoutResponse:
    next_position = update_layout(village_id, payload.field_layout_position)
    return FieldLayoutResponse(
        village_id=village_id,
        field_layout_position=next_position,
        valid_positions=sorted(VALID_LAYOUTS),
        message=f"Tarla B konumu {next_position} olarak guncellendi.",
    )


@app.get("/api/v2/villages/{village_id}/field-layout", response_model=FieldLayoutResponse)
def get_field_layout(village_id: str) -> FieldLayoutResponse:
    ensure_village(village_id)
    return FieldLayoutResponse(
        village_id=village_id,
        field_layout_position=get_layout(),
        valid_positions=sorted(VALID_LAYOUTS),
    )


@app.get("/api/v2/parcels/{parcel_id}/neighbors", response_model=NeighborsResponse)
def get_neighbors(parcel_id: str, season: str = Query(...)) -> NeighborsResponse:
    intra, inter = get_neighbor_ids(parcel_id)
    return NeighborsResponse(
        parcel_id=parcel_id,
        season=season,
        layout_position=get_layout(),
        neighbors={
            "intra_block": [{"parcel_id": n, "adjacency_type": "INTRA_BLOCK"} for n in intra],
            "inter_block": [{"parcel_id": n, "adjacency_type": "INTER_BLOCK"} for n in inter],
        },
    )


@app.post("/api/v1/decision/score", response_model=DecisionResponse)
def score_decision(payload: ScoreRequest) -> DecisionResponse:
    ensure_parcel(payload.parcel_id)

    intra_ids, inter_ids = get_neighbor_ids(payload.parcel_id)
    crop = get_parcel_crop(payload.parcel_id)

    intra_high = intra_medium = intra_same = 0
    inter_high = inter_medium = inter_same = 0

    reasons: list[str] = []

    for neighbor_id in intra_ids:
        pair_type = _classify_pair(crop, PLOTS[neighbor_id])
        if pair_type == "high":
            intra_high += 1
        elif pair_type == "medium":
            intra_medium += 1
        elif pair_type == "same":
            intra_same += 1

    for neighbor_id in inter_ids:
        pair_type = _classify_pair(crop, PLOTS[neighbor_id])
        if pair_type == "high":
            inter_high += 1
        elif pair_type == "medium":
            inter_medium += 1
        elif pair_type == "same":
            inter_same += 1

    if intra_high + intra_medium > 0:
        reasons.append("INTRA_BLOCK_CONFLICT")
    if inter_high + inter_medium > 0:
        reasons.append("INTER_BLOCK_BORDER_CONFLICT")
    if intra_same + inter_same > 0:
        reasons.append("HIGH_DENSITY_CLUSTERING")

    total_counts = Counter(PLOTS.values())
    same_crop_ratio = total_counts[crop] / len(PLOTS)
    village_crop_diversity = len(total_counts)

    if village_crop_diversity > 3:
        reasons.append("VILLAGE_DISTRIBUTION_PRESSURE")

    rules_score, _components = compute_rules_score(
        intra_high=intra_high,
        intra_medium=intra_medium,
        intra_same=intra_same,
        inter_high=inter_high,
        inter_medium=inter_medium,
        inter_same=inter_same,
        same_crop_ratio=same_crop_ratio,
        village_crop_diversity=village_crop_diversity,
    )

    hybrid = combine_rules_with_ml(rules_score, payload.ml_score, payload.ml_confidence)

    result = DecisionResult(
        parcel_id=payload.parcel_id,
        season=payload.season,
        risk_score=hybrid.risk_score,
        risk_level=_risk_level(hybrid.risk_score),
        reason_codes=sorted(set(reasons)),
        confidence=hybrid.confidence,
        model_version=hybrid.model_version,
        decision_source=hybrid.decision_source,
    )
    upsert_decision(result)

    return DecisionResponse(**result.__dict__)


@app.get("/api/v1/parcels/{parcel_id}/decision", response_model=DecisionResponse)
def get_decision(parcel_id: str, season: str) -> DecisionResponse:
    payload = repo_get_decision(parcel_id=parcel_id, season=season)
    if payload is None:
        raise HTTPException(status_code=404, detail="Decision not found for parcel+season")
    return DecisionResponse(**payload)
