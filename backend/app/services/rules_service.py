from __future__ import annotations

from dataclasses import dataclass
from statistics import mean

from backend.app.services.optimizer_service import CropKey, ResearchPlan
from backend.app.services.village_service import get_all_parcel_ids, get_crop_map, get_neighbor_ids

INCOMPATIBLE_HIGH = {("corn", "sunflower"), ("sunflower", "corn")}
INCOMPATIBLE_MEDIUM = {
    ("corn", "wheat"),
    ("wheat", "corn"),
    ("sunflower", "wheat"),
    ("wheat", "sunflower"),
}

HARD_RULE_INTER_BLOCK_HIGH_LIMIT = 2
HARD_RULE_TOTAL_HIGH_LIMIT = 3
SOFT_WARNING_PENALTY = 4.0
CRITICAL_PENALTY = 2.5
RISKY_PENALTY = 1.0


@dataclass
class PlanValidation:
    optimizer_score: float
    final_score: float
    rules_passed: bool
    rules_warnings: list[str]
    hard_rule_violation: bool


def _pair_kind(a: CropKey, b: CropKey) -> str:
    if a == b:
        return "same"
    if (a, b) in INCOMPATIBLE_HIGH:
        return "high"
    if (a, b) in INCOMPATIBLE_MEDIUM:
        return "medium"
    return "ok"


def build_selection_map(plan: ResearchPlan) -> dict[str, CropKey]:
    crop_map = get_crop_map(active_only=True)
    selections = {item["parcel_id"]: item["crop"] for item in plan["selections"]}
    for parcel_id in get_all_parcel_ids():
        selections.setdefault(parcel_id, crop_map[parcel_id])  # defensive fallback
    return selections


def validate_parcel_selection(parcel_id: str, crop: CropKey, selections: dict[str, CropKey]) -> list[str]:
    crop_map = get_crop_map(active_only=True)
    warnings: set[str] = set()
    intra_ids, inter_ids = get_neighbor_ids(parcel_id)
    intra_high = inter_high = total_high = 0
    same_neighbors = 0

    for neighbor_id in intra_ids:
        pair = _pair_kind(crop, selections.get(neighbor_id, crop_map[neighbor_id]))
        if pair == "high":
            intra_high += 1
            total_high += 1
        elif pair == "same":
            same_neighbors += 1

    for neighbor_id in inter_ids:
        pair = _pair_kind(crop, selections.get(neighbor_id, crop_map[neighbor_id]))
        if pair == "high":
            inter_high += 1
            total_high += 1
        elif pair == "same":
            same_neighbors += 1

    if intra_high > 0:
        warnings.add("INTRA_BLOCK_CONFLICT")
    if inter_high > 0:
        warnings.add("INTER_BLOCK_BORDER_CONFLICT")
    if same_neighbors >= 2:
        warnings.add("HIGH_DENSITY_CLUSTERING")
    if inter_high >= HARD_RULE_INTER_BLOCK_HIGH_LIMIT:
        warnings.add("HARD_INTER_BLOCK_HIGH_CONFLICT")
    if total_high >= HARD_RULE_TOTAL_HIGH_LIMIT:
        warnings.add("HARD_TOTAL_HIGH_CONFLICT")

    return sorted(warnings)


def build_rule_warnings(plan: ResearchPlan) -> list[str]:
    selections = build_selection_map(plan)
    warnings: set[str] = set()
    for item in plan["selections"]:
        warnings.update(validate_parcel_selection(item["parcel_id"], item["crop"], selections))

    if plan["critical_count"] > 0:
        warnings.add("CRITICAL_PARCELS_PRESENT")
    if plan["risky_count"] > max(2, len(plan["selections"]) // 3):
        warnings.add("RISK_CLUSTER_PRESENT")

    return sorted(warnings)


def compute_optimizer_score(plan: ResearchPlan) -> float:
    avg_risk = mean(item["risk_score"] for item in plan["selections"])
    base_score = 100.0 - avg_risk
    diversity_bonus = max(0.0, min(12.0, plan["balanced_count"] * 0.9))
    risk_penalty = (plan["critical_count"] * CRITICAL_PENALTY) + (plan["risky_count"] * RISKY_PENALTY)
    return round(max(0.0, min(100.0, base_score + diversity_bonus - risk_penalty)), 1)


def validate_plan(plan: ResearchPlan) -> PlanValidation:
    optimizer_score = compute_optimizer_score(plan)
    warnings = build_rule_warnings(plan)
    hard_rule_violation = any(code.startswith("HARD_") for code in warnings)
    soft_warning_count = len([code for code in warnings if not code.startswith("HARD_")])
    final_score = optimizer_score - (soft_warning_count * SOFT_WARNING_PENALTY)

    if hard_rule_violation:
        final_score -= 20.0

    final_score = round(max(0.0, min(100.0, final_score)), 1)
    return PlanValidation(
        optimizer_score=optimizer_score,
        final_score=final_score,
        rules_passed=not hard_rule_violation,
        rules_warnings=warnings,
        hard_rule_violation=hard_rule_violation,
    )
