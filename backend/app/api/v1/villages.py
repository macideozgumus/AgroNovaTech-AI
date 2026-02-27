from fastapi import APIRouter
from app.api.v1.parcels import DEMO_PARCELS
from app.decision_engine.rules_v1 import calculate_risk

router = APIRouter()

DEMO_VILLAGE = {
    "village_id": "V001",
    "village_name": "Bilincli Ciftci Koyu",
    "district": "Ankara",
    "total_parcels": 8,
    "parcel_ids": ["P001","P002","P003","P004","P005","P006","P007","P008"]
}

def get_parcel_by_id(parcel_id: str):
    for p in DEMO_PARCELS:
        if p["parcel_id"] == parcel_id:
            return p
    return None

@router.get("/villages", tags=["Villages"])
def get_all_villages():
    """Tüm köyleri listeler."""
    return [DEMO_VILLAGE]

@router.get("/villages/{village_id}", tags=["Villages"])
def get_village(village_id: str):
    """Köy detayını getirir."""
    if village_id != "V001":
        return {"error": "Koy bulunamadi"}
    return DEMO_VILLAGE

@router.get("/villages/{village_id}/risk", tags=["Villages"])
def get_village_risk(village_id: str):
    """Köy genelindeki risk analizini döner."""
    if village_id != "V001":
        return {"error": "Koy bulunamadi"}

    risk_scores = []
    high_risk_parcels = []

    for parcel in DEMO_PARCELS:
        neighbor_crops = []
        for nid in parcel["neighbor_ids"]:
            neighbor = get_parcel_by_id(nid)
            if neighbor:
                neighbor_crops.append(neighbor["crop_type"])

        risk = calculate_risk(parcel["crop_type"], neighbor_crops)
        risk_scores.append(risk["risk_score"])

        if risk["risk_level"] == "yuksek":
            high_risk_parcels.append(parcel["parcel_id"])

    avg_risk = round(sum(risk_scores) / len(risk_scores), 2)

    if avg_risk <= 0.35:
        overall_level = "dusuk"
        recommendation = "Koy genelinde ekim uyumu iyi durumda."
    elif avg_risk <= 0.65:
        overall_level = "orta"
        recommendation = "Bazi parsellerde uyumsuzluk var, takip edilmeli."
    else:
        overall_level = "yuksek"
        recommendation = "Koy genelinde ciddi risk! Acil mudahale gerekebilir."

    return {
        "village_id": village_id,
        "village_name": "Bilincli Ciftci Koyu",
        "overall_risk_score": avg_risk,
        "overall_risk_level": overall_level,
        "total_parcels": len(DEMO_PARCELS),
        "high_risk_parcels": high_risk_parcels,
        "recommendation": recommendation
    }