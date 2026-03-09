from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .rules_v2 import clamp


@dataclass
class HybridOutput:
    risk_score: int
    confidence: Optional[float]
    decision_source: str
    model_version: str


def combine_rules_with_ml(
    rules_score: float,
    ml_score: Optional[float],
    ml_confidence: Optional[float],
) -> HybridOutput:
    if ml_score is None or ml_confidence is None:
        return HybridOutput(
            risk_score=round(clamp(rules_score)),
            confidence=None,
            decision_source="rules_only",
            model_version="rules_v2",
        )

    confidence = clamp(float(ml_confidence), 0.0, 1.0)
    lam = clamp(0.2 + (0.6 * confidence), 0.2, 0.8)
    merged = ((1 - lam) * clamp(rules_score)) + (lam * clamp(float(ml_score)))

    return HybridOutput(
        risk_score=round(clamp(merged)),
        confidence=confidence,
        decision_source="hybrid",
        model_version="hybrid_v1",
    )
