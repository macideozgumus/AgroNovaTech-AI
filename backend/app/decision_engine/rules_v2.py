from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


HIGH_INCOMPATIBLE = {("c_wheat", "c_sunflower"), ("c_sunflower", "c_wheat")}
MEDIUM_INCOMPATIBLE = {("c_corn", "c_sunflower"), ("c_sunflower", "c_corn")}


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def risk_level_from_score(score: int) -> str:
    if score >= 70:
        return "CRITICAL"
    if score >= 40:
        return "RISKY"
    return "OK"


def combine_rules_ml_risk(
    rules_score: float,
    ml_score: Optional[float] = None,
    confidence_ml: Optional[float] = None,
) -> int:
    if ml_score is None or confidence_ml is None:
        return int(round(clamp(rules_score, 0, 100)))
    lam = clamp(0.2 + 0.6 * confidence_ml, 0.2, 0.8)
    final_score = (1 - lam) * rules_score + lam * ml_score
    return int(round(clamp(final_score, 0, 100)))


@dataclass
class EngineOutput:
    risk_score: int
    risk_level: str
    reason_codes: List[str]
    recommendations: List[Dict[str, str]]
    confidence: Optional[float]
    model_version: str


def _conflict_points(c1: str, c2: str, high: int, medium: int, same: int) -> int:
    if (c1, c2) in HIGH_INCOMPATIBLE:
        return high
    if (c1, c2) in MEDIUM_INCOMPATIBLE:
        return medium
    if c1 == c2:
        return same
    return 0


def _build_recommendations(reason_codes: List[str]) -> List[Dict[str, str]]:
    recs: List[Dict[str, str]] = []
    if "INTER_BLOCK_BORDER_CONFLICT" in reason_codes:
        recs.append({"type": "CROP_SUGGESTION", "text": "Sinir komsulugu icin arpa veya misir onerilir."})
    if "INTRA_BLOCK_CONFLICT" in reason_codes:
        recs.append({"type": "ACTION", "text": "Ayni blok icinde urun rotasyonu planlayin."})
    if "SAME_CROP_CLUSTERING" in reason_codes:
        recs.append({"type": "CROP_SUGGESTION", "text": "Monokultur riskini azaltmak icin urun cesitliligi artirin."})
    if not recs:
        recs.append({"type": "ACTION", "text": "Mevcut plan uygun gorunuyor, sezon takibi yapin."})
    return recs


def run_rules_v2(
    parcel_crop_id: str,
    intra_block_neighbor_crop_ids: List[str],
    inter_block_neighbor_crop_ids: List[str],
    village_unique_crops_count: int,
    total_parcel_count: int,
    same_crop_total_count: int,
    ml_score: Optional[float] = None,
    confidence_ml: Optional[float] = None,
) -> EngineOutput:
    if not parcel_crop_id:
        return EngineOutput(
            risk_score=0,
            risk_level="UNKNOWN",
            reason_codes=["UNKNOWN_DATA"],
            recommendations=[{"type": "WARNING", "text": "Once urun plani giriniz."}],
            confidence=None,
            model_version="rules_v2",
        )

    score = 0
    reason_codes: List[str] = []

    def add_reason(code: str) -> None:
        if code not in reason_codes:
            reason_codes.append(code)

    intra_score = 0
    for neighbor_crop in intra_block_neighbor_crop_ids:
        pts = _conflict_points(parcel_crop_id, neighbor_crop, high=20, medium=12, same=13)
        intra_score += pts
    if intra_score > 0:
        score += intra_score
        add_reason("INTRA_BLOCK_CONFLICT")

    inter_score = 0
    for neighbor_crop in inter_block_neighbor_crop_ids:
        pts = _conflict_points(parcel_crop_id, neighbor_crop, high=25, medium=15, same=16)
        inter_score += pts
    if inter_score > 0:
        score += inter_score
        add_reason("INTER_BLOCK_BORDER_CONFLICT")

    same_neighbor_count = (
        intra_block_neighbor_crop_ids.count(parcel_crop_id)
        + inter_block_neighbor_crop_ids.count(parcel_crop_id)
    )
    total_neighbors = len(intra_block_neighbor_crop_ids) + len(inter_block_neighbor_crop_ids)
    if total_neighbors > 0 and (same_neighbor_count / total_neighbors) > 0.5:
        score += 15
        add_reason("SAME_CROP_CLUSTERING")

    if total_parcel_count > 0 and (same_crop_total_count / total_parcel_count) >= 0.5:
        score += 15
        add_reason("SAME_CROP_CLUSTERING")

    if village_unique_crops_count > 3:
        score += 10
        add_reason("HIGH_DIVERSITY_PRESSURE")

    rules_score = int(clamp(score, 0, 100))
    final_score = combine_rules_ml_risk(rules_score, ml_score=ml_score, confidence_ml=confidence_ml)

    return EngineOutput(
        risk_score=final_score,
        risk_level=risk_level_from_score(final_score),
        reason_codes=reason_codes,
        recommendations=_build_recommendations(reason_codes),
        confidence=confidence_ml,
        model_version="rules_v2",
    )
