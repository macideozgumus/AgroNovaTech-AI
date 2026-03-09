from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class DecisionResult:
    parcel_id: str
    season: str
    risk_score: int
    risk_level: str
    reason_codes: list[str]
    confidence: Optional[float]
    model_version: str
    decision_source: str
