from pydantic import BaseModel
from typing import List, Optional

class DecisionRequest(BaseModel):
    parcel_id: str
    crop_type: str
    neighbor_crop_types: List[str] = []

class DecisionResponse(BaseModel):
    parcel_id: str
    crop_type: str
    risk_score: float
    risk_level: str          # "dusuk", "orta", "yuksek"
    reason_code: str         # örn: "NEIGHBOR_CONFLICT"
    recommendation: str
    confidence: Optional[float] = None