from fastapi import APIRouter
from app.schemas.decision import DecisionRequest, DecisionResponse
from app.decision_engine.rules_v1 import calculate_risk

router = APIRouter()

@router.post("/decisions", tags=["Decisions"])
def get_decision(request: DecisionRequest):
    """
    Verilen parsel ve komşu bilgilerine göre karar üretir.
    AI ekibi bu endpoint'e bağlanacak.
    """
    result = calculate_risk(request.crop_type, request.neighbor_crop_types)

    return DecisionResponse(
        parcel_id=request.parcel_id,
        crop_type=request.crop_type,
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        reason_code=result["reason_code"],
        recommendation=result["recommendation"],
        confidence=0.85  # Demo değer - AI modeli bunu dolduracak
    )