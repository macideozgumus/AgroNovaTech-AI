from typing import Any, Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict[str, Any]] = None


class ErrorResponse(BaseModel):
    ok: bool = False
    error: ErrorDetail


class CenterPoint(BaseModel):
    lat: float
    lng: float


class ReasonItem(BaseModel):
    code: str
    text: str


class RecommendationItem(BaseModel):
    type: str
    text: str

