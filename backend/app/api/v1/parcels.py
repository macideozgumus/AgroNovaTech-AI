from fastapi import APIRouter
from app.schemas.parcel import ParcelResponse
from app.decision_engine.rules_v1 import calculate_risk

router = APIRouter()

# 8 parsellik demo köy verisi (kaptan bunu istedi)
DEMO_PARCELS = [
    {"parcel_id": "P001", "village_id": "V001", "owner_name": "Ahmet Yilmaz",  "area_decare": 15.0, "crop_type": "bugday",  "latitude": 39.920, "longitude": 32.850, "neighbor_ids": ["P002", "P003"]},
    {"parcel_id": "P002", "village_id": "V001", "owner_name": "Fatma Kaya",    "area_decare": 10.0, "crop_type": "arpa",    "latitude": 39.921, "longitude": 32.851, "neighbor_ids": ["P001", "P004"]},
    {"parcel_id": "P003", "village_id": "V001", "owner_name": "Mehmet Demir",  "area_decare": 20.0, "crop_type": "nohut",   "latitude": 39.919, "longitude": 32.849, "neighbor_ids": ["P001", "P005"]},
    {"parcel_id": "P004", "village_id": "V001", "owner_name": "Ayse Celik",    "area_decare": 12.0, "crop_type": "misir",   "latitude": 39.922, "longitude": 32.852, "neighbor_ids": ["P002", "P006"]},
    {"parcel_id": "P005", "village_id": "V001", "owner_name": "Ali Sahin",     "area_decare": 18.0, "crop_type": "bugday",  "latitude": 39.918, "longitude": 32.848, "neighbor_ids": ["P003", "P007"]},
    {"parcel_id": "P006", "village_id": "V001", "owner_name": "Zeynep Arslan", "area_decare": 8.0,  "crop_type": "aycicek", "latitude": 39.923, "longitude": 32.853, "neighbor_ids": ["P004", "P008"]},
    {"parcel_id": "P007", "village_id": "V001", "owner_name": "Hasan Kurt",    "area_decare": 25.0, "crop_type": "arpa",    "latitude": 39.917, "longitude": 32.847, "neighbor_ids": ["P005", "P008"]},
    {"parcel_id": "P008", "village_id": "V001", "owner_name": "Elif Yildiz",   "area_decare": 14.0, "crop_type": "patates", "latitude": 39.924, "longitude": 32.854, "neighbor_ids": ["P006", "P007"]},
]

def get_parcel_by_id(parcel_id: str):
    for p in DEMO_PARCELS:
        if p["parcel_id"] == parcel_id:
            return p
    return None

@router.get("/parcels", tags=["Parcels"])
def get_all_parcels():
    """Köydeki tüm parselleri listeler."""
    return DEMO_PARCELS

@router.get("/parcels/{parcel_id}", tags=["Parcels"])
def get_parcel(parcel_id: str):
    """Belirli bir parselin detayını getirir."""
    parcel = get_parcel_by_id(parcel_id)
    if not parcel:
        return {"error": "Parsel bulunamadi"}

    # Komşu ürünlerini bul
    neighbor_crops = []
    for nid in parcel["neighbor_ids"]:
        neighbor = get_parcel_by_id(nid)
        if neighbor:
            neighbor_crops.append(neighbor["crop_type"])

    # Risk hesapla
    risk = calculate_risk(parcel["crop_type"], neighbor_crops)

    return {**parcel, **risk}