from pydantic import BaseModel
from typing import List, Optional

class VillageBase(BaseModel):
    village_id: str
    village_name: str
    district: str
    parcel_ids: List[str] = []
    total_parcels: int = 0

class VillageResponse(VillageBase):
    overall_risk_score: Optional[float] = None
    overall_risk_level: Optional[str] = None
    recommendation: Optional[str] = None

class VillageCreate(VillageBase):
    pass