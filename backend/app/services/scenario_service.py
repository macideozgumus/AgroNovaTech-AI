from __future__ import annotations

from datetime import datetime
from typing import Optional, TypedDict

from fastapi import HTTPException

from backend.app.services.optimizer_service import (
    CropKey,
    ResearchPlan,
    generate_balanced_plan,
    generate_low_risk_plan,
    generate_yield_risk_plan,
    score_plan,
)
from backend.app.services.village_service import ensure_village, get_all_parcel_ids


class ScenarioParcelInput(TypedDict):
    parcel_id: str
    crop: CropKey


class ScenarioRecord(TypedDict):
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
    parcels: list[dict]


SCENARIOS: dict[str, ScenarioRecord] = {}


def recommend_scenarios(village_id: str) -> list[ResearchPlan]:
    ensure_village(village_id)
    return [
        generate_balanced_plan(village_id),
        generate_low_risk_plan(village_id),
        generate_yield_risk_plan(village_id),
    ]


def _validate_parcels(items: list[ScenarioParcelInput]) -> dict[str, CropKey]:
    if not items:
        raise HTTPException(status_code=400, detail="Scenario parcels are required")
    valid_parcels = set(get_all_parcel_ids())
    selections: dict[str, CropKey] = {}
    for item in items:
        parcel_id = item["parcel_id"]
        crop = item["crop"]
        if parcel_id not in valid_parcels:
            raise HTTPException(status_code=404, detail=f"Parcel not found: {parcel_id}")
        selections[parcel_id] = crop
    return selections


def create_scenario(
    name: str,
    village_id: str,
    season: str,
    parcels: list[ScenarioParcelInput],
    plan_type: str = "custom",
) -> ScenarioRecord:
    ensure_village(village_id)
    clean_name = name.strip()
    if len(clean_name) < 3:
        raise HTTPException(status_code=400, detail="Scenario name must be at least 3 characters")

    selections = _validate_parcels(parcels)
    strategy = plan_type if plan_type in {"balanced", "low_risk", "yield_balance"} else "balanced"
    scored = score_plan(village_id, strategy, selections)
    created_at = datetime.now().strftime("%d.%m.%Y %H:%M")
    scenario_id = f"scenario-{len(SCENARIOS) + 1}"
    record: ScenarioRecord = {
        "id": scenario_id,
        "name": clean_name,
        "village_id": village_id,
        "season": season,
        "created_at": created_at,
        "summary": _build_summary(scored),
        "plan_type": plan_type,
        "balanced_count": scored["balanced_count"],
        "risky_count": scored["risky_count"],
        "critical_count": scored["critical_count"],
        "parcels": list(scored["selections"]),
    }
    SCENARIOS[scenario_id] = record
    return record


def list_scenarios(village_id: Optional[str] = None) -> list[ScenarioRecord]:
    records = list(SCENARIOS.values())
    if village_id:
        ensure_village(village_id)
        records = [item for item in records if item["village_id"] == village_id]
    return sorted(records, key=lambda item: item["id"], reverse=True)


def get_scenario(scenario_id: str) -> ScenarioRecord:
    record = SCENARIOS.get(scenario_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return record


def _build_summary(plan: ResearchPlan) -> str:
    if plan["critical_count"] == 0 and plan["risky_count"] <= 1:
        return "Bu senaryo köy geneline açılabilecek kadar dengeli görünüyor."
    if plan["critical_count"] <= 1:
        return "Senaryo uygulanabilir; birkaç parsel için saha takibi önerilir."
    return "Senaryoda kritik baskı devam ediyor; uygulamadan önce yeniden gözden geçirilmeli."
