from __future__ import annotations

from dataclasses import dataclass

from app.core.enums import RecommendationType, RiskLevel
from app.core.reason_codes import REASON_TEXT_TR, ReasonCode
from app.schemas.common import ReasonItem, RecommendationItem
from app.schemas.decision import ParcelDecisionResponse


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def risk_level_from_score(score: int) -> RiskLevel:
    if score >= 70:
        return RiskLevel.CRITICAL
    if score >= 40:
        return RiskLevel.RISKY
    return RiskLevel.OK


def combine_rules_ml_risk(
    rules_score: float,
    ml_score: float | None = None,
    confidence_ml: float | None = None,
) -> int:
    """
    Contract v1:
    - ML yoksa final risk = rules risk
    - ML varsa lambda = clamp(0.2 + 0.6 * confidence_ml, 0.2, 0.8)
    """
    if ml_score is None or confidence_ml is None:
        return int(round(clamp(rules_score, 0, 100)))

    lam = clamp(0.2 + 0.6 * confidence_ml, 0.2, 0.8)
    final_score = (1 - lam) * rules_score + lam * ml_score
    return int(round(clamp(final_score, 0, 100)))


@dataclass
class EngineOutput:
    risk_score: int
    risk_level: str | RiskLevel
    reason_codes: list[str]
    recommendations: list[dict]
    confidence: float | None
    model_version: str


class DecisionEngineAdapter:
    """
    Backend <-> Rules/ML adapter.
    Memduh'un rules_v1 çıktısını API contract v1 formatına uyarlar.
    """

    def __init__(self, reason_text_map: dict[str, str] | None = None) -> None:
        self.reason_text_map = reason_text_map or REASON_TEXT_TR

    def map_reason_codes(self, reason_codes: list[str]) -> list[ReasonItem]:
        items: list[ReasonItem] = []
        for code in reason_codes:
            items.append(
                ReasonItem(
                    code=code,
                    text=self.reason_text_map.get(
                        code, self.reason_text_map[ReasonCode.UNKNOWN_DATA.value]
                    ),
                )
            )
        return items

    def map_recommendations(self, recommendations: list[dict]) -> list[RecommendationItem]:
        items: list[RecommendationItem] = []
        for rec in recommendations:
            rec_type = rec.get("type", RecommendationType.ACTION.value)
            text = rec.get("text", "")
            items.append(RecommendationItem(type=rec_type, text=text))
        return items

    def to_api_response(
        self,
        parcel_id: str,
        season: str,
        engine_output: EngineOutput | dict,
    ) -> ParcelDecisionResponse:
        payload = (
            engine_output.__dict__
            if isinstance(engine_output, EngineOutput)
            else dict(engine_output)
        )

        risk_score = int(payload.get("risk_score", 0))
        risk_level_raw = payload.get("risk_level")
        risk_level = (
            RiskLevel(risk_level_raw)
            if risk_level_raw in {level.value for level in RiskLevel}
            else risk_level_from_score(risk_score)
        )

        return ParcelDecisionResponse(
            parcel_id=parcel_id,
            season=season,
            risk_score=risk_score,
            risk_level=risk_level,
            reasons=self.map_reason_codes(payload.get("reason_codes", [])),
            recommendations=self.map_recommendations(payload.get("recommendations", [])),
            confidence=payload.get("confidence"),
            model_version=payload.get("model_version", "rules_v1"),
        )


def run_rules_v1(
    parcel_crop_id: str,
    neighbor_crop_ids: list[str],
    village_unique_crops_count: int,
) -> EngineOutput:
    score = 0
    reason_codes = []
    recommendations = []

    # Eğer parsel boşsa direkt dön
    if not parcel_crop_id:
        return EngineOutput(
            risk_score=0,
            risk_level=RiskLevel.UNKNOWN.value,
            reason_codes=["UNKNOWN_DATA"],
            recommendations=[],
            confidence=0.0,
            model_version="rules_v1",
        )

    # Kural-1: Komşu uyumsuzluk (c_wheat ile c_sunflower yan yanaysa)
    for neighbor in neighbor_crop_ids:
        if (parcel_crop_id == "c_wheat" and neighbor == "c_sunflower") or \
           (parcel_crop_id == "c_sunflower" and neighbor == "c_wheat"):
            score += 20
            if "NEIGHBOR_INCOMPATIBLE" not in reason_codes:
                reason_codes.append("NEIGHBOR_INCOMPATIBLE")
                recommendations.append({
                    "type": "CROP_SUGGESTION", 
                    "text": "Buğday ve Ayçiçek yan yana ekimi risklidir. Arpa önerilir."
                })

    # Kural-2: Aynı ürün yoğunluğu > %50 ise
    if neighbor_crop_ids:
        same_crop_count = neighbor_crop_ids.count(parcel_crop_id)
        if (same_crop_count / len(neighbor_crop_ids)) > 0.5:
            score += 15
            if "SAME_CROP_CLUSTERING" not in reason_codes:
                reason_codes.append("SAME_CROP_CLUSTERING")
                recommendations.append({
                    "type": "ACTION", 
                    "text": "Aynı ürün yoğunluğu yüksek. Ekim nöbeti (rotasyon) uygulayın."
                })

    # Kural-3: Köydeki farklı ürün sayısı > 3 ise
    if village_unique_crops_count > 3:
        score += 10
        reason_codes.append("HIGH_DIVERSITY_PRESSURE")

    # Skoru 0-100 arasına kilitle
    score = int(clamp(score, 0, 100))
    
    # Seviyeyi belirle
    risk_level = risk_level_from_score(score)

    return EngineOutput(
        risk_score=score,
        risk_level=risk_level.value if hasattr(risk_level, 'value') else risk_level,
        reason_codes=reason_codes,
        recommendations=recommendations,
        confidence=0.0,
        model_version="rules_v1",
    )
