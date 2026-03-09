from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional


@dataclass
class DecisionInput:
    parcel_id: str
    season: str
    rule_score: float
    reason_codes: list[str]
    ml_score: Optional[float] = None
    ml_confidence: Optional[float] = None


@dataclass
class DecisionOutput:
    parcel_id: str
    season: str
    risk_score: int
    risk_level: str
    reason_codes: list[str]
    confidence: Optional[float]
    model_version: str
    decision_source: str


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _risk_level(score: float) -> str:
    if score >= 70:
        return "CRITICAL"
    if score >= 40:
        return "RISKY"
    return "OK"


def _normalize_reasons(reasons: Iterable[str]) -> list[str]:
    normalized = []
    for reason in reasons:
        token = reason.strip().upper()
        if token:
            normalized.append(token)
    return normalized


def compute_hybrid_decision(payload: DecisionInput) -> DecisionOutput:
    rules_score = _clamp(float(payload.rule_score), 0.0, 100.0)
    reasons = _normalize_reasons(payload.reason_codes)

    use_ml = payload.ml_score is not None and payload.ml_confidence is not None

    if use_ml:
        confidence = _clamp(float(payload.ml_confidence), 0.0, 1.0)
        lam = _clamp(0.2 + (0.6 * confidence), 0.2, 0.8)
        ml_score = _clamp(float(payload.ml_score), 0.0, 100.0)
        final_score = _clamp(((1 - lam) * rules_score) + (lam * ml_score), 0.0, 100.0)
        source = "hybrid"
        model_version = "hybrid_v1"
    else:
        confidence = None
        final_score = rules_score
        source = "rules_only"
        model_version = "rules_v2"

    return DecisionOutput(
        parcel_id=payload.parcel_id,
        season=payload.season,
        risk_score=round(final_score),
        risk_level=_risk_level(final_score),
        reason_codes=reasons,
        confidence=confidence,
        model_version=model_version,
        decision_source=source,
    )
