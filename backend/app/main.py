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
from backend.app.services.harvest_service import (
    create_harvest_plan,
    delete_harvest_plan,
    list_harvest_plans,
    update_harvest_plan,
)
from backend.app.services.optimizer_service import (
    CropKey,
    ResearchPlan,
    build_graph,
)
from backend.app.services.llm_service import (
    chat_about_plan,
    explain_plan_with_llm,
    generate_what_if_analysis,
    get_llm_provider_status,
)
from backend.app.services.rules_service import validate_plan
from backend.app.services.scenario_service import create_scenario, get_scenario, list_scenarios, recommend_scenarios
from backend.app.services.village_service import (
    VALID_LAYOUTS,
    ensure_parcel,
    ensure_village,
    get_all_parcel_ids,
    get_crop_map,
    get_layout,
    get_neighbor_details,
    get_neighbor_ids,
    get_parcel_crop,
    init_village_data,
    list_field_parcels as village_list_field_parcels,
    list_subparcels as village_list_subparcels,
    delete_parcel as village_delete_parcel,
    list_parcels as village_list_parcels,
    subdivide_parcel as village_subdivide_parcel,
    subdivide_field as village_subdivide_field,
    undo_last_split as village_undo_last_split,
    update_parcel_name as village_update_parcel_name,
    update_parcel_crop as village_update_parcel_crop,
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


def _model_to_dict(model: BaseModel) -> dict:
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


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


class AIStatusResponse(BaseModel):
    enabled: bool
    provider: Optional[str]
    reason: str


class CoordinatePoint(BaseModel):
    lat: float
    lng: float


class ParcelItem(BaseModel):
    parcel_id: str
    field_block: Literal["A", "B"]
    planned_crop: str
    display_name: Optional[str] = None
    owner_user_id: Optional[str] = None
    parent_parcel_id: Optional[str] = None
    area_m2: Optional[float] = None
    geometry: Optional[list[list[float]]] = None
    centroid: Optional[CoordinatePoint] = None
    split_strategy: Optional[str] = None
    subparcel_index: Optional[int] = None
    is_subparcel: bool = False


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
    neighbors: dict[str, list[dict[str, str | float]]]


class ParcelSubdivideRequest(BaseModel):
    requested_count: int = Field(ge=2, le=24)
    split_strategy: str = "equal_grid"


class ParcelSubdivideResponse(BaseModel):
    parcel_id: str
    requested_count: int
    split_strategy: str
    subparcels: list[ParcelItem]


class FieldSubdivideResponse(BaseModel):
    field_block: Literal["A", "B"]
    requested_count: int
    split_strategy: str
    parcels: list[ParcelItem]


class ParcelMutationResponse(BaseModel):
    parcel_id: str
    parcels: list[ParcelItem]


class SubparcelCropUpdateRequest(BaseModel):
    planned_crop: CropKey


class ParcelNameUpdateRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=40)


class RiskSummaryResponse(BaseModel):
    parcel_id: str
    season: str
    risk_score: int
    risk_level: Literal["OK", "RISKY", "CRITICAL"]
    area_weighted_score: float
    child_count: int
    dominant_crop: str
    subparcels: list[DecisionResponse]


class ScoreRequest(BaseModel):
    village_id: str
    season: str
    parcel_id: str
    ml_score: Optional[float] = Field(default=None, ge=0, le=100)
    ml_confidence: Optional[float] = Field(default=None, ge=0, le=1)
    crop_overrides: Optional[dict[str, CropKey]] = None


class DecisionResponse(BaseModel):
    parcel_id: str
    season: str
    risk_score: int
    risk_level: Literal["OK", "RISKY", "CRITICAL"]
    reason_codes: list[str]
    confidence: Optional[float]
    model_version: str
    decision_source: Literal["rules_only", "hybrid"]


class ScenarioRecommendRequest(BaseModel):
    village_id: str
    season: str


class ScenarioParcelSelection(BaseModel):
    parcel_id: str
    crop: CropKey
    risk_score: int
    risk_level: Literal["OK", "RISKY", "CRITICAL"]
    explanation: list[str]


class ScenarioPlanResponse(BaseModel):
    id: str
    plan_type: Literal["balanced", "low_risk", "yield_balance"]
    title: str
    badge: str
    summary: str
    emphasis: str
    balanced_count: int
    risky_count: int
    critical_count: int
    optimizer_score: float
    final_score: float
    final_rank: int
    reason_list: list[str]
    selections: list[ScenarioParcelSelection]
    rules_passed: bool
    rules_warnings: list[str]
    llm_provider: str
    llm_explanation: str
    what_if: list[str]


class ScenarioRecommendResponse(BaseModel):
    village_id: str
    season: str
    graph_node_count: int
    graph_edge_count: int
    plans: list[ScenarioPlanResponse]


class ScenarioCreateParcel(BaseModel):
    parcel_id: str
    crop: CropKey


class ScenarioCreateRequest(BaseModel):
    name: str
    village_id: str
    season: str
    plan_type: str = "custom"
    parcels: list[ScenarioCreateParcel]


class ScenarioItemResponse(BaseModel):
    id: str
    name: str
    village_id: str
    season: str
    created_at: str
    summary: str
    plan_type: str
    balanced_count: int
    risky_count: int
    critical_count: int
    parcels: list[ScenarioParcelSelection]


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioItemResponse]


class HarvestPlanRequest(BaseModel):
    title: str
    parcel_id: str
    planned_date: str
    notes: str = ""
    status: Literal["planned", "active", "done"] = "planned"


class HarvestPlanResponse(BaseModel):
    id: str
    title: str
    parcel_id: str
    planned_date: str
    notes: str
    status: Literal["planned", "active", "done"]
    created_at: str


class HarvestPlanListResponse(BaseModel):
    harvest_plans: list[HarvestPlanResponse]


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    init_village_data()


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


def _score_parcel_decision(
    parcel_id: str,
    season: str,
    crop_overrides: Optional[dict[str, CropKey]] = None,
    ml_score: Optional[float] = None,
    ml_confidence: Optional[float] = None,
    persist: bool = True,
) -> DecisionResponse:
    ensure_parcel(parcel_id)
    crop_overrides = crop_overrides or {}
    crop_map = get_crop_map(active_only=True)
    parcel_crop = crop_overrides.get(parcel_id, crop_map.get(parcel_id, get_parcel_crop(parcel_id)))
    neighbor_details = get_neighbor_details(parcel_id)

    intra_high = intra_medium = intra_same = 0.0
    inter_high = inter_medium = inter_same = 0.0
    reasons: list[str] = []

    for neighbor in neighbor_details:
        neighbor_id = neighbor["parcel_id"]
        neighbor_crop = crop_overrides.get(neighbor_id, crop_map[neighbor_id])
        pair_type = _classify_pair(parcel_crop, neighbor_crop)
        weight = max(1.0, neighbor["shared_boundary_ratio"] * 4.0)
        if neighbor["adjacency_type"] == "INTRA_BLOCK":
            if pair_type == "high":
                intra_high += weight
            elif pair_type == "medium":
                intra_medium += weight
            elif pair_type == "same":
                intra_same += weight
        else:
            if pair_type == "high":
                inter_high += weight
            elif pair_type == "medium":
                inter_medium += weight
            elif pair_type == "same":
                inter_same += weight

    if intra_high + intra_medium > 0:
        reasons.append("INTRA_BLOCK_CONFLICT")
    if inter_high + inter_medium > 0:
        reasons.append("INTER_BLOCK_BORDER_CONFLICT")
    if intra_same + inter_same >= 1.25:
        reasons.append("HIGH_DENSITY_CLUSTERING")

    projected_counts = Counter(crop_map.values())
    if parcel_id in crop_map:
        projected_counts[crop_map[parcel_id]] -= 1
        if projected_counts[crop_map[parcel_id]] <= 0:
            projected_counts.pop(crop_map[parcel_id], None)
    projected_counts[parcel_crop] += 1

    total_count = max(sum(projected_counts.values()), 1)
    same_crop_ratio = projected_counts[parcel_crop] / total_count
    village_crop_diversity = len([crop for crop, count in projected_counts.items() if count > 0])

    if same_crop_ratio > 0.45 or village_crop_diversity > 3:
        reasons.append("VILLAGE_DISTRIBUTION_PRESSURE")

    rules_score, _components = compute_rules_score(
        intra_high=int(round(intra_high)),
        intra_medium=int(round(intra_medium)),
        intra_same=int(round(intra_same)),
        inter_high=int(round(inter_high)),
        inter_medium=int(round(inter_medium)),
        inter_same=int(round(inter_same)),
        same_crop_ratio=same_crop_ratio,
        village_crop_diversity=village_crop_diversity,
    )

    hybrid = combine_rules_with_ml(rules_score, ml_score, ml_confidence)
    result = DecisionResult(
        parcel_id=parcel_id,
        season=season,
        risk_score=hybrid.risk_score,
        risk_level=_risk_level(hybrid.risk_score),
        reason_codes=sorted(set(reasons)),
        confidence=hybrid.confidence,
        model_version=hybrid.model_version,
        decision_source=hybrid.decision_source,
    )
    if persist:
        upsert_decision(result)
    return DecisionResponse(**result.__dict__)


def _build_risk_summary(parcel_id: str, season: str) -> RiskSummaryResponse:
    ensure_parcel(parcel_id, active_only=False)
    subparcels = village_list_subparcels(parcel_id)
    target_ids = [item["parcel_id"] for item in subparcels] if subparcels else [parcel_id]
    decisions = [_score_parcel_decision(item_id, season, persist=False) for item_id in target_ids]
    parcel_by_id = {item["parcel_id"]: item for item in village_list_parcels("v1")}
    total_area = sum((parcel_by_id[item_id].get("area_m2") or 0.0) for item_id in target_ids)
    if total_area <= 0:
        total_area = float(len(target_ids))
    weighted_score = sum(
        decisions[index].risk_score * (parcel_by_id[target_ids[index]].get("area_m2") or 1.0)
        for index in range(len(target_ids))
    ) / total_area
    dominant_crop = Counter(parcel_by_id[item_id]["planned_crop"] for item_id in target_ids).most_common(1)[0][0]
    return RiskSummaryResponse(
        parcel_id=parcel_id,
        season=season,
        risk_score=int(round(weighted_score)),
        risk_level=_risk_level(int(round(weighted_score))),
        area_weighted_score=round(weighted_score, 2),
        child_count=len(target_ids),
        dominant_crop=dominant_crop,
        subparcels=decisions,
    )


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


@app.get("/api/v1/ai/status", response_model=AIStatusResponse)
def ai_status() -> AIStatusResponse:
    status = get_llm_provider_status()
    return AIStatusResponse(enabled=status.enabled, provider=status.provider, reason=status.reason)


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
    details = get_neighbor_details(parcel_id)
    return NeighborsResponse(
        parcel_id=parcel_id,
        season=season,
        layout_position=get_layout(),
        neighbors={
            "intra_block": [
                {
                    "parcel_id": item["parcel_id"],
                    "adjacency_type": "INTRA_BLOCK",
                    "shared_boundary_ratio": item["shared_boundary_ratio"],
                    "shared_boundary_m": item["shared_boundary_m"],
                }
                for item in details
                if item["adjacency_type"] == "INTRA_BLOCK"
            ],
            "inter_block": [
                {
                    "parcel_id": item["parcel_id"],
                    "adjacency_type": "INTER_BLOCK",
                    "shared_boundary_ratio": item["shared_boundary_ratio"],
                    "shared_boundary_m": item["shared_boundary_m"],
                }
                for item in details
                if item["adjacency_type"] == "INTER_BLOCK"
            ],
        },
    )


@app.post("/api/v1/decision/score", response_model=DecisionResponse)
def score_decision(payload: ScoreRequest) -> DecisionResponse:
    return _score_parcel_decision(
        parcel_id=payload.parcel_id,
        season=payload.season,
        crop_overrides=payload.crop_overrides,
        ml_score=payload.ml_score,
        ml_confidence=payload.ml_confidence,
        persist=True,
    )


@app.get("/api/v1/parcels/{parcel_id}/decision", response_model=DecisionResponse)
def get_decision(parcel_id: str, season: str) -> DecisionResponse:
    payload = repo_get_decision(parcel_id=parcel_id, season=season)
    if payload is None:
        raise HTTPException(status_code=404, detail="Decision not found for parcel+season")
    return DecisionResponse(**payload)


@app.post("/api/v1/parcels/{parcel_id}/subdivide", response_model=ParcelSubdivideResponse)
def subdivide_parcel(parcel_id: str, payload: ParcelSubdivideRequest) -> ParcelSubdivideResponse:
    subparcels = village_subdivide_parcel(parcel_id, payload.requested_count, payload.split_strategy)
    return ParcelSubdivideResponse(
        parcel_id=parcel_id,
        requested_count=payload.requested_count,
        split_strategy=payload.split_strategy,
        subparcels=[ParcelItem(**item) for item in subparcels],
    )


@app.post("/api/v1/fields/{field_block}/subdivide", response_model=FieldSubdivideResponse)
def subdivide_field(field_block: Literal["A", "B"], payload: ParcelSubdivideRequest) -> FieldSubdivideResponse:
    parcels = village_subdivide_field(field_block, payload.requested_count, payload.split_strategy)
    return FieldSubdivideResponse(
        field_block=field_block,
        requested_count=payload.requested_count,
        split_strategy=payload.split_strategy,
        parcels=[ParcelItem(**item) for item in parcels],
    )


@app.get("/api/v1/parcels/{parcel_id}/subparcels", response_model=ParcelListResponse)
def get_subparcels(parcel_id: str) -> ParcelListResponse:
    return ParcelListResponse(village_id="v1", parcels=[ParcelItem(**item) for item in village_list_subparcels(parcel_id)])


@app.put("/api/v1/subparcels/{parcel_id}/crop", response_model=ParcelItem)
def update_subparcel_crop(parcel_id: str, payload: SubparcelCropUpdateRequest) -> ParcelItem:
    return ParcelItem(**village_update_parcel_crop(parcel_id, payload.planned_crop))


@app.put("/api/v1/parcels/{parcel_id}/name", response_model=ParcelItem)
def update_parcel_name(parcel_id: str, payload: ParcelNameUpdateRequest) -> ParcelItem:
    return ParcelItem(**village_update_parcel_name(parcel_id, payload.display_name))


@app.post("/api/v1/parcels/{parcel_id}/undo", response_model=ParcelMutationResponse)
def undo_parcel_split(parcel_id: str) -> ParcelMutationResponse:
    parcels = village_undo_last_split(parcel_id)
    return ParcelMutationResponse(parcel_id=parcel_id, parcels=[ParcelItem(**item) for item in parcels])


@app.delete("/api/v1/parcels/{parcel_id}", response_model=ParcelMutationResponse)
def delete_parcel(parcel_id: str) -> ParcelMutationResponse:
    parcels = village_delete_parcel(parcel_id)
    return ParcelMutationResponse(parcel_id=parcel_id, parcels=[ParcelItem(**item) for item in parcels])


@app.get("/api/v1/parcels/{parcel_id}/risk-summary", response_model=RiskSummaryResponse)
def get_risk_summary(parcel_id: str, season: str = Query(...)) -> RiskSummaryResponse:
    return _build_risk_summary(parcel_id, season)


def _map_research_plan(plan: ResearchPlan, final_rank: int, neighbor_info: dict) -> ScenarioPlanResponse:
    validation = validate_plan(plan)
    explanation = explain_plan_with_llm(
        plan_data=plan,
        risk_reasons=validation.rules_warnings,
        neighbor_info=neighbor_info,
    )
    what_if = generate_what_if_analysis(
        plan_data=plan,
        conditions=["su seviyesi düşerse", "daha verimli senaryo gerekirse"],
    )
    return ScenarioPlanResponse(
        id=plan["id"],
        plan_type=plan["plan_type"],
        title=plan["title"],
        badge=plan["badge"],
        summary=plan["summary"],
        emphasis=plan["emphasis"],
        balanced_count=plan["balanced_count"],
        risky_count=plan["risky_count"],
        critical_count=plan["critical_count"],
        optimizer_score=validation.optimizer_score,
        final_score=validation.final_score,
        final_rank=final_rank,
        reason_list=plan["reason_list"],
        selections=[ScenarioParcelSelection(**item) for item in plan["selections"]],
        rules_passed=validation.rules_passed,
        rules_warnings=validation.rules_warnings,
        llm_provider=explanation.provider,
        llm_explanation=explanation.summary_tr,
        what_if=[item.impact_summary for item in what_if],
    )


@app.post("/api/v1/scenario/recommend", response_model=ScenarioRecommendResponse)
def recommend_scenario(payload: ScenarioRecommendRequest) -> ScenarioRecommendResponse:
    graph = build_graph(payload.village_id)
    plans = recommend_scenarios(payload.village_id)
    ranked_plans = sorted(plans, key=lambda plan: validate_plan(plan).final_score, reverse=True)
    return ScenarioRecommendResponse(
        village_id=payload.village_id,
        season=payload.season,
        graph_node_count=len(graph["nodes"]),
        graph_edge_count=len(graph["edges"]),
        plans=[_map_research_plan(plan, index + 1, graph) for index, plan in enumerate(ranked_plans)],
    )


@app.post("/api/v1/scenarios", response_model=ScenarioItemResponse)
def create_scenario_endpoint(payload: ScenarioCreateRequest) -> ScenarioItemResponse:
    record = create_scenario(
        name=payload.name,
        village_id=payload.village_id,
        season=payload.season,
        parcels=[_model_to_dict(item) for item in payload.parcels],
        plan_type=payload.plan_type,
    )
    return ScenarioItemResponse(**record)


@app.get("/api/v1/scenarios", response_model=ScenarioListResponse)
def list_scenarios_endpoint(village_id: Optional[str] = None) -> ScenarioListResponse:
    return ScenarioListResponse(scenarios=[ScenarioItemResponse(**item) for item in list_scenarios(village_id)])


@app.get("/api/v1/scenarios/{scenario_id}", response_model=ScenarioItemResponse)
def get_scenario_endpoint(scenario_id: str) -> ScenarioItemResponse:
    return ScenarioItemResponse(**get_scenario(scenario_id))


@app.post("/api/v1/harvest-plans", response_model=HarvestPlanResponse)
def create_harvest_plan_endpoint(payload: HarvestPlanRequest) -> HarvestPlanResponse:
    return HarvestPlanResponse(**create_harvest_plan(**_model_to_dict(payload)))


@app.get("/api/v1/harvest-plans", response_model=HarvestPlanListResponse)
def list_harvest_plans_endpoint() -> HarvestPlanListResponse:
    return HarvestPlanListResponse(harvest_plans=[HarvestPlanResponse(**item) for item in list_harvest_plans()])


@app.put("/api/v1/harvest-plans/{plan_id}", response_model=HarvestPlanResponse)
def update_harvest_plan_endpoint(plan_id: str, payload: HarvestPlanRequest) -> HarvestPlanResponse:
    return HarvestPlanResponse(**update_harvest_plan(plan_id, **_model_to_dict(payload)))


@app.delete("/api/v1/harvest-plans/{plan_id}")
def delete_harvest_plan_endpoint(plan_id: str) -> dict[str, str]:
    delete_harvest_plan(plan_id)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Scenario Chat — Doğal dil diyaloğu (LLM explanation layer)
# ---------------------------------------------------------------------------


class ScenarioChatRequest(BaseModel):
    plan_id: str
    user_message: str
    village_id: str
    season: str


class ScenarioChatResponse(BaseModel):
    reply: str
    suggestions: list[str]
    provider: str


@app.post("/api/v1/scenario/chat", response_model=ScenarioChatResponse)
def scenario_chat(payload: ScenarioChatRequest) -> ScenarioChatResponse:
    result = chat_about_plan(
        plan_id=payload.plan_id,
        user_message=payload.user_message,
        context={
            "village_id": payload.village_id,
            "season": payload.season,
        },
    )
    return ScenarioChatResponse(
        reply=result.reply,
        suggestions=result.suggestions,
        provider=result.provider,
    )
