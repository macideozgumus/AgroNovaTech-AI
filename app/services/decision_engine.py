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

