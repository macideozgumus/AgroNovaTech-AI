from fastapi import APIRouter

router = APIRouter()

# Demo risk skoru - AI ekibi bu mantigi dolduracak
CROP_COMPATIBILITY = {
    ("bugday", "arpa"): "uyumlu",
    ("bugday", "nohut"): "uyumlu",
    ("arpa", "nohut"): "uyumlu",
    ("bugday", "bugday"): "riskli",
    ("arpa", "arpa"): "riskli",
}

@router.get("/risk/{parcel_id}", tags=["Risk"])
def get_parcel_risk(parcel_id: str):
    """
    Belirli bir tarlanin risk skorunu dondurur.
    Su an demo veri - AI modeli buraya baglanacak.
    """
    # Demo veri - gercek hesaplama AI ekibinden gelecek
    demo_risk = {
        "P001": {
            "parcel_id": "P001",
            "crop_type": "bugday",
            "risk_score": 0.2,
            "risk_level": "dusuk",
            "neighbor_compatibility": "uyumlu",
            "recommendation": "Ekim planina devam edilebilir"
        },
        "P002": {
            "parcel_id": "P002",
            "crop_type": "arpa",
            "risk_score": 0.4,
            "risk_level": "orta",
            "neighbor_compatibility": "uyumlu",
            "recommendation": "Takip edilmeli"
        },
        "P003": {
            "parcel_id": "P003",
            "crop_type": "nohut",
            "risk_score": 0.1,
            "risk_level": "dusuk",
            "neighbor_compatibility": "uyumlu",
            "recommendation": "Ideal durum"
        }
    }

    if parcel_id in demo_risk:
        return demo_risk[parcel_id]
    return {"error": "Tarla bulunamadi"}


@router.get("/risk/village/{village_name}", tags=["Risk"])
def get_village_risk(village_name: str):
    """
    Koy genelindeki toplam risk durumunu dondurur.
    """
    return {
        "village_name": village_name,
        "overall_risk_score": 0.23,
        "overall_risk_level": "dusuk",
        "total_parcels": 3,
        "compatible_parcels": 3,
        "recommendation": "Koy genelinde ekim uyumu iyi durumda"
    }