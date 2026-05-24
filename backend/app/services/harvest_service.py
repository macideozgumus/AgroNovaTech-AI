from __future__ import annotations

from datetime import datetime
from typing import Literal, TypedDict

from fastapi import HTTPException

from backend.app.services.village_service import get_all_parcel_ids

HarvestStatus = Literal["planned", "active", "done"]


class HarvestPlanRecord(TypedDict):
    id: str
    title: str
    parcel_id: str
    planned_date: str
    notes: str
    status: HarvestStatus
    created_at: str


HARVEST_PLANS: dict[str, HarvestPlanRecord] = {}


def create_harvest_plan(title: str, parcel_id: str, planned_date: str, notes: str, status: HarvestStatus) -> HarvestPlanRecord:
    _validate_harvest_payload(title, parcel_id, planned_date, status)
    plan_id = f"harvest-{len(HARVEST_PLANS) + 1}"
    record: HarvestPlanRecord = {
        "id": plan_id,
        "title": title.strip(),
        "parcel_id": parcel_id,
        "planned_date": planned_date,
        "notes": notes.strip(),
        "status": status,
        "created_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
    }
    HARVEST_PLANS[plan_id] = record
    return record


def list_harvest_plans() -> list[HarvestPlanRecord]:
    return sorted(HARVEST_PLANS.values(), key=lambda item: item["id"], reverse=True)


def update_harvest_plan(plan_id: str, title: str, parcel_id: str, planned_date: str, notes: str, status: HarvestStatus) -> HarvestPlanRecord:
    if plan_id not in HARVEST_PLANS:
        raise HTTPException(status_code=404, detail="Harvest plan not found")
    _validate_harvest_payload(title, parcel_id, planned_date, status)
    updated: HarvestPlanRecord = {
        **HARVEST_PLANS[plan_id],
        "title": title.strip(),
        "parcel_id": parcel_id,
        "planned_date": planned_date,
        "notes": notes.strip(),
        "status": status,
    }
    HARVEST_PLANS[plan_id] = updated
    return updated


def delete_harvest_plan(plan_id: str) -> None:
    if plan_id not in HARVEST_PLANS:
        raise HTTPException(status_code=404, detail="Harvest plan not found")
    del HARVEST_PLANS[plan_id]


def _validate_harvest_payload(title: str, parcel_id: str, planned_date: str, status: HarvestStatus) -> None:
    if len(title.strip()) < 3:
        raise HTTPException(status_code=400, detail="Harvest title must be at least 3 characters")
    if parcel_id not in set(get_all_parcel_ids()):
        raise HTTPException(status_code=404, detail="Parcel not found")
    if len(planned_date.strip()) < 8:
        raise HTTPException(status_code=400, detail="Planned date is required")
    if status not in {"planned", "active", "done"}:
        raise HTTPException(status_code=400, detail="Invalid harvest status")
