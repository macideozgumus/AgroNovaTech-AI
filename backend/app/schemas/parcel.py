from pydantic import BaseModel
from typing import List, Optional

class ParcelBase(BaseModel):
    parcel_id: str
    village_id: str
    owner_name: Optional[str] = None
    area_decare: float
    crop_type: str
    latitude: float
    longitude: float
    neighbor_ids: List[str] = []

class ParcelResponse(ParcelBase):
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    recommendation: Optional[str] = None

class ParcelCreate(ParcelBase):
    pass