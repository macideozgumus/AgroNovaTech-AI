from fastapi import APIRouter

router = APIRouter()

DEMO_PARCELS = [
    {
        "parcel_id": "P001",
        "village_name": "Bilincli Ciftci Koyu",
        "owner_name": "Ahmet Yilmaz",
        "area_decare": 15.0,
        "crop_type": "bugday",
        "latitude": 39.92,
        "longitude": 32.85,
        "neighbor_ids": ["P002", "P003"]
    },
    {
        "parcel_id": "P002",
        "village_name": "Bilincli Ciftci Koyu",
        "owner_name": "Fatma Kaya",
        "area_decare": 10.0,
        "crop_type": "arpa",
        "latitude": 39.921,
        "longitude": 32.851,
        "neighbor_ids": ["P001"]
    },
    {
        "parcel_id": "P003",
        "village_name": "Bilincli Ciftci Koyu",
        "owner_name": "Mehmet Demir",
        "area_decare": 20.0,
        "crop_type": "nohut",
        "latitude": 39.919,
        "longitude": 32.849,
        "neighbor_ids": ["P001"]
    }
]

@router.get("/parcels", tags=["Parcels"])
def get_all_parcels():
    return DEMO_PARCELS

@router.get("/parcels/{parcel_id}", tags=["Parcels"])
def get_parcel(parcel_id: str):
    for p in DEMO_PARCELS:
        if p["parcel_id"] == parcel_id:
            return p
    return {"error": "Tarla bulunamadi"}