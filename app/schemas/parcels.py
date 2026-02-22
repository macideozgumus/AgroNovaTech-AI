from datetime import date

from pydantic import BaseModel

from app.core.enums import RiskLevel
from app.schemas.common import CenterPoint


class CropRef(BaseModel):
    crop_id: str
    crop_name: str


class ParcelListItem(BaseModel):
    parcel_id: str
    name: str
    status: RiskLevel
    crop: CropRef | None = None
    risk_score: int | None = None
    risk_level: RiskLevel | None = None


class VillageParcelsResponse(BaseModel):
    village_id: str
    season: str
    parcels: list[ParcelListItem]


class UpdateCropPlanRequest(BaseModel):
    season: str
    crop_id: str
    sowing_date: date | None = None


class UpdateCropPlanResponse(BaseModel):
    ok: bool = True
    parcel_id: str
    season: str


class VillageListItem(BaseModel):
    village_id: str
    name: str
    center: CenterPoint | None = None


class VillageListResponse(BaseModel):
    villages: list[VillageListItem]


class CropCatalogItem(BaseModel):
    crop_id: str
    crop_name: str


class CropCatalogResponse(BaseModel):
    crops: list[CropCatalogItem]

