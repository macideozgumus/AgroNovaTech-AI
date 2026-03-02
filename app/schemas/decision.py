from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.core.enums import JobStatus, RiskLevel
from app.schemas.common import ReasonItem, RecommendationItem


class DecisionScoreRequest(BaseModel):
    village_id: str
    season: str


class DecisionScoreResponse(BaseModel):
    ok: bool = True
    job_id: str
    status: JobStatus
    computed_at: datetime


class ParcelDecisionResponse(BaseModel):
    parcel_id: str
    season: str
    risk_score: int
    risk_level: RiskLevel
    reasons: list[ReasonItem]
    recommendations: list[RecommendationItem]
    confidence: Optional[float] = None
    model_version: str


class RiskDistribution(BaseModel):
    OK: int = 0
    RISKY: int = 0
    CRITICAL: int = 0
    UNKNOWN: int = 0


class VillageDecisionSummaryResponse(BaseModel):
    village_id: str
    season: str
    risk_distribution: RiskDistribution
    shared_recommendations: list[RecommendationItem]
    model_version: str

