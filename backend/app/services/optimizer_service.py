from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Literal, Optional, TypedDict

from backend.app.decision_engine import compute_rules_score
from backend.app.services.village_service import (
    get_all_parcel_ids,
    get_crop_map,
    get_layout,
    get_neighbor_details,
    get_neighbor_ids,
    get_parcel_crop,
    list_parcels,
)

CropKey = Literal["corn", "sunflower", "wheat", "barley"]
PlanType = Literal["balanced", "low_risk", "yield_balance"]
RiskLevel = Literal["OK", "RISKY", "CRITICAL"]

CROP_LABELS: dict[CropKey, str] = {
    "corn": "Mısır",
    "sunflower": "Ayçiçeği",
    "wheat": "Buğday",
    "barley": "Arpa",
}

INCOMPATIBLE_HIGH = {("corn", "sunflower"), ("sunflower", "corn")}
INCOMPATIBLE_MEDIUM = {
    ("corn", "wheat"),
    ("wheat", "corn"),
    ("sunflower", "wheat"),
    ("wheat", "sunflower"),
}
CROP_OPTIONS: tuple[CropKey, ...] = ("corn", "sunflower", "wheat", "barley")

YIELD_GAIN: dict[CropKey, int] = {"corn": 18, "sunflower": 14, "wheat": 10, "barley": 8}
WATER_FIT: dict[CropKey, int] = {"corn": 5, "sunflower": 10, "wheat": 16, "barley": 18}

PLAN_META: dict[PlanType, dict[str, str]] = {
    "balanced": {
        "title": "En Dengeli Plan",
        "badge": "Graph + ML",
        "summary": "Komşu etkisini azaltan ve ürün dağılımını dengeleyen araştırma planı.",
        "emphasis": "Rotasyon ve komşu çeşitliliği öncelikli",
    },
    "low_risk": {
        "title": "En Düşük Riskli Plan",
        "badge": "Rules First",
        "summary": "Kritik alanları daha güvenli ürünlere çekerek temkinli başlangıç sunar.",
        "emphasis": "Riskli parselleri yumuşatan güvenli kurgu",
    },
    "yield_balance": {
        "title": "Verim / Risk Dengeli",
        "badge": "Hybrid Ready",
        "summary": "Verim potansiyelini korurken sınır baskısını azaltan dengeli öneri.",
        "emphasis": "Mısır potansiyeli ile kontrollü dağılım",
    },
}

PLAN_WEIGHTS: dict[PlanType, dict[str, float]] = {
    "balanced": {
        "risk": 0.30,
        "neighbor": 0.30,
        "rotation": 0.20,
        "yield": 0.10,
        "diversity": 0.10,
        "water": 0.05,
    },
    "low_risk": {
        "risk": 0.45,
        "neighbor": 0.25,
        "rotation": 0.20,
        "yield": 0.00,
        "diversity": 0.05,
        "water": 0.10,
    },
    "yield_balance": {
        "risk": 0.30,
        "neighbor": 0.20,
        "rotation": 0.15,
        "yield": 0.25,
        "diversity": 0.05,
        "water": 0.10,
    },
}


class GraphNode(TypedDict):
    parcel_id: str
    field_block: str
    planned_crop: str


class GraphEdge(TypedDict):
    source: str
    target: str
    adjacency_type: Literal["INTRA_BLOCK", "INTER_BLOCK"]
    weight: float


class GraphModel(TypedDict):
    village_id: str
    layout_position: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ParcelPlan(TypedDict):
    parcel_id: str
    crop: CropKey
    risk_score: int
    risk_level: RiskLevel
    explanation: list[str]


class ResearchPlan(TypedDict):
    id: str
    plan_type: PlanType
    title: str
    badge: str
    summary: str
    emphasis: str
    balanced_count: int
    risky_count: int
    critical_count: int
    reason_list: list[str]
    selections: list[ParcelPlan]


@dataclass
class ParcelCandidate:
    score: float
    risk_score: int
    risk_level: RiskLevel
    explanations: list[str]


def _risk_level(score: int) -> RiskLevel:
    if score >= 70:
        return "CRITICAL"
    if score >= 40:
        return "RISKY"
    return "OK"


def _pair_penalty(a: str, b: str) -> int:
    if a == b:
        return 18
    if (a, b) in INCOMPATIBLE_HIGH:
        return 26
    if (a, b) in INCOMPATIBLE_MEDIUM:
        return 14
    return 4


def _rotation_penalty(current_crop: str, candidate_crop: CropKey) -> int:
    return 18 if current_crop == candidate_crop else 6


def build_graph(village_id: str) -> GraphModel:
    nodes: list[GraphNode] = [dict(parcel) for parcel in list_parcels(village_id)]
    seen: set[tuple[str, str, str]] = set()
    edges: list[GraphEdge] = []

    for parcel_id in get_all_parcel_ids():
        for detail in get_neighbor_details(parcel_id):
            neighbor_id = detail["parcel_id"]
            adjacency_type = detail["adjacency_type"]
            edge = tuple(sorted((parcel_id, neighbor_id)) + [adjacency_type])
            if edge not in seen:
                seen.add(edge)
                edges.append(
                    {
                        "source": edge[0],
                        "target": edge[1],
                        "adjacency_type": adjacency_type,
                        "weight": max(1.0, detail["shared_boundary_ratio"] * (1.35 if adjacency_type == "INTER_BLOCK" else 1.0)),
                    }
                )

    return {"village_id": village_id, "layout_position": get_layout(), "nodes": nodes, "edges": edges}


def _evaluate_candidate(parcel_id: str, candidate_crop: CropKey, strategy: PlanType, selections: dict[str, CropKey]) -> ParcelCandidate:
    weights = PLAN_WEIGHTS[strategy]
    current_crop = get_parcel_crop(parcel_id)
    intra_ids, inter_ids = get_neighbor_ids(parcel_id)
    crop_map = get_crop_map(active_only=True)

    intra_high = intra_medium = intra_same = 0
    inter_high = inter_medium = inter_same = 0
    neighbor_penalty = 0

    for neighbor_id in intra_ids:
        neighbor_crop = selections.get(neighbor_id, crop_map[neighbor_id])
        pair_penalty = _pair_penalty(candidate_crop, neighbor_crop)
        neighbor_penalty += pair_penalty
        if candidate_crop == neighbor_crop:
            intra_same += 1
        elif (candidate_crop, neighbor_crop) in INCOMPATIBLE_HIGH:
            intra_high += 1
        elif (candidate_crop, neighbor_crop) in INCOMPATIBLE_MEDIUM:
            intra_medium += 1

    for neighbor_id in inter_ids:
        neighbor_crop = selections.get(neighbor_id, crop_map[neighbor_id])
        pair_penalty = int(_pair_penalty(candidate_crop, neighbor_crop) * 1.15)
        neighbor_penalty += pair_penalty
        if candidate_crop == neighbor_crop:
            inter_same += 1
        elif (candidate_crop, neighbor_crop) in INCOMPATIBLE_HIGH:
            inter_high += 1
        elif (candidate_crop, neighbor_crop) in INCOMPATIBLE_MEDIUM:
            inter_medium += 1

    projected_counts = Counter(crop_map.values())
    projected_counts.update(selections.values())
    projected_counts[candidate_crop] += 1
    village_crop_diversity = len([crop for crop, count in projected_counts.items() if count > 0])
    same_crop_ratio = projected_counts[candidate_crop] / max(len(crop_map), 1)

    base_risk_score, _ = compute_rules_score(
        intra_high=intra_high,
        intra_medium=intra_medium,
        intra_same=intra_same,
        inter_high=inter_high,
        inter_medium=inter_medium,
        inter_same=inter_same,
        same_crop_ratio=same_crop_ratio,
        village_crop_diversity=village_crop_diversity,
    )

    rotation_penalty = _rotation_penalty(current_crop, candidate_crop)
    diversity_bonus = 18 if projected_counts[candidate_crop] <= 4 else 8 if projected_counts[candidate_crop] <= 6 else 0

    weighted_score = (
        weights["risk"] * base_risk_score
        + weights["neighbor"] * neighbor_penalty
        + weights["rotation"] * rotation_penalty
        - weights["yield"] * YIELD_GAIN[candidate_crop]
        - weights["diversity"] * diversity_bonus
        - weights["water"] * WATER_FIT[candidate_crop]
    )

    risk_score = int(max(18, min(96, round(base_risk_score + rotation_penalty * 0.4 + neighbor_penalty * 0.25))))
    risk_level = _risk_level(risk_score)
    explanations = explain_plan(
        parcel_id=parcel_id,
        crop=candidate_crop,
        current_crop=current_crop,
        risk_level=risk_level,
        rotation_penalty=rotation_penalty,
        neighbor_penalty=neighbor_penalty,
        diversity_bonus=diversity_bonus,
        strategy=strategy,
    )

    return ParcelCandidate(score=weighted_score, risk_score=risk_score, risk_level=risk_level, explanations=explanations)


def score_plan(village_id: str, strategy: PlanType, base_selections: Optional[dict[str, CropKey]] = None) -> ResearchPlan:
    build_graph(village_id)
    selections: dict[str, CropKey] = {}
    active_parcel_ids = get_all_parcel_ids()
    crop_map = get_crop_map(active_only=True)
    if base_selections:
        for parcel_id, crop in base_selections.items():
            if parcel_id in active_parcel_ids:
                selections[parcel_id] = crop
        for parcel_id in active_parcel_ids:
            selections.setdefault(parcel_id, crop_map[parcel_id])

    ordered_parcels = list_parcels(village_id)
    if not base_selections:
        for parcel in ordered_parcels:
            parcel_id = parcel["parcel_id"]
            candidates = {crop: _evaluate_candidate(parcel_id, crop, strategy, selections) for crop in CROP_OPTIONS}
            best_crop = min(candidates.items(), key=lambda item: item[1].score)[0]
            selections[parcel_id] = best_crop

    rows: list[ParcelPlan] = []
    for parcel in ordered_parcels:
        parcel_id = parcel["parcel_id"]
        crop = selections[parcel_id]
        candidate = _evaluate_candidate(parcel_id, crop, strategy, selections)
        rows.append(
            {
                "parcel_id": parcel_id,
                "crop": crop,
                "risk_score": candidate.risk_score,
                "risk_level": candidate.risk_level,
                "explanation": candidate.explanations,
            }
        )

    balanced_count = len([row for row in rows if row["risk_level"] == "OK"])
    risky_count = len([row for row in rows if row["risk_level"] == "RISKY"])
    critical_count = len([row for row in rows if row["risk_level"] == "CRITICAL"])
    meta = PLAN_META[strategy]

    reason_list = [
        "Komşuluk kenarları graph modeli ile değerlendirildi.",
        "Rotasyon cezası mevcut ürün baskısını azaltacak şekilde hesaplandı.",
        "Plan skoru risk, verim, su uyumu ve çeşitlilik dengesiyle üretildi.",
    ]
    if strategy == "low_risk":
        reason_list[2] = "Risk ve su uyumu ağırlığı artırılarak güvenli dağılım seçildi."
    if strategy == "yield_balance":
        reason_list[2] = "Verim potansiyeli korunurken sınır baskısı kontrol altında tutuldu."

    return {
        "id": strategy,
        "plan_type": strategy,
        "title": meta["title"],
        "badge": meta["badge"],
        "summary": meta["summary"],
        "emphasis": meta["emphasis"],
        "balanced_count": balanced_count,
        "risky_count": risky_count,
        "critical_count": critical_count,
        "reason_list": reason_list,
        "selections": rows,
    }


def generate_balanced_plan(village_id: str) -> ResearchPlan:
    return score_plan(village_id, "balanced")


def generate_low_risk_plan(village_id: str) -> ResearchPlan:
    return score_plan(village_id, "low_risk")


def generate_yield_risk_plan(village_id: str) -> ResearchPlan:
    return score_plan(village_id, "yield_balance")


def explain_plan(
    parcel_id: str,
    crop: CropKey,
    current_crop: str,
    risk_level: RiskLevel,
    rotation_penalty: int,
    neighbor_penalty: int,
    diversity_bonus: int,
    strategy: PlanType,
) -> list[str]:
    crop_label = CROP_LABELS[crop]
    lines = [f"{parcel_id.upper()} için {crop_label} seçimi graph komşuluk etkisiyle puanlandı."]

    if crop == current_crop:
        lines.append("Mevcut ürün korundu; rotasyon cezası bu yüzden daha yüksek kaldı.")
    else:
        lines.append("Ürün değişimi rotasyon baskısını düşürerek senaryoyu daha dengeli yaptı.")

    if neighbor_penalty >= 45:
        lines.append("Komşu parsellerle sınır baskısı yüksek; bu alan sahada yakından izlenmeli.")
    elif neighbor_penalty >= 22:
        lines.append("Komşu etkisi orta seviyede; ekim aralığı ve sulama düzeni önemli.")
    else:
        lines.append("Komşu çeşitliliği yeterli görünüyor ve sınır baskısı kontrol altında.")

    if diversity_bonus >= 18:
        lines.append("Köy genelindeki ürün çeşitliliği bu seçimle güçleniyor.")

    if strategy == "low_risk":
        lines.append("Bu plan tipinde risk cezası daha baskın çalıştırıldı.")
    elif strategy == "yield_balance":
        lines.append("Bu plan tipinde verim ve risk birlikte optimize edildi.")
    else:
        lines.append("Bu plan tipinde komşuluk ve çeşitlilik dengesi önceliklendirildi.")

    if risk_level == "CRITICAL":
        lines.append("Bu parsel kritik bölgede kaldı; doğrudan uygulamadan önce tekrar kontrol edilmeli.")
    elif risk_level == "RISKY":
        lines.append("Parsel uygulanabilir ama saha takibi gerektiriyor.")
    else:
        lines.append("Parsel araştırma planında dengeli aday olarak öne çıkıyor.")

    return lines
