import os
import sys
import uuid

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.db.session import SessionLocal
from app.models import CropCatalog, Parcel, ParcelAdjacency, ParcelCropPlan, Village


SEASON = "2026_Spring"
VILLAGE_ID = "v1"

PARS = [
    ("p1", "P1"),
    ("p2", "P2"),
    ("p3", "P3"),
    ("p4", "P4"),
    ("p5", "P5"),
    ("p6", "P6"),
    ("p7", "P7"),
    ("p8", "P8"),
]

ADJ = [
    ("p1", "p2"), ("p1", "p4"),
    ("p2", "p1"), ("p2", "p3"), ("p2", "p5"),
    ("p3", "p2"), ("p3", "p6"),
    ("p4", "p1"), ("p4", "p5"), ("p4", "p7"),
    ("p5", "p2"), ("p5", "p4"), ("p5", "p6"), ("p5", "p8"),
    ("p6", "p3"), ("p6", "p5"),
    ("p7", "p4"), ("p7", "p8"),
    ("p8", "p5"), ("p8", "p7"),
]

CROPS = [
    ("c_wheat", "Bugday"),
    ("c_barley", "Arpa"),
    ("c_sunflower", "Aycicek"),
    ("c_corn", "Misir"),
]

CROP_PLAN = [
    ("p1", "c_wheat"),
    ("p2", "c_sunflower"),
    ("p3", "c_wheat"),
    ("p4", "c_wheat"),
    ("p5", "c_sunflower"),
    ("p6", "c_corn"),
    ("p7", "c_barley"),
    ("p8", "c_wheat"),
]


def _uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def main() -> None:
    db = SessionLocal()
    try:
        # Idempotent-ish cleanup for demo IDs
        db.execute(text("DELETE FROM decision_result WHERE village_id = :v"), {"v": VILLAGE_ID})
        db.execute(
            text(
                "DELETE FROM parcel_crop_plan WHERE parcel_id IN "
                "(SELECT id FROM parcel WHERE village_id = :v)"
            ),
            {"v": VILLAGE_ID},
        )
        db.execute(text("DELETE FROM parcel_adjacency WHERE village_id = :v"), {"v": VILLAGE_ID})
        db.execute(text("DELETE FROM parcel WHERE village_id = :v"), {"v": VILLAGE_ID})
        db.execute(text("DELETE FROM village WHERE id = :v"), {"v": VILLAGE_ID})
        db.commit()

        village = Village(id=VILLAGE_ID, name="Demo Koyu", center_lat=39.0, center_lng=35.0)
        db.add(village)

        for crop_id, crop_name in CROPS:
            if db.get(CropCatalog, crop_id) is None:
                db.add(CropCatalog(id=crop_id, crop_name=crop_name, group_name=None, is_active=True))

        for parcel_id, name in PARS:
            db.add(Parcel(id=parcel_id, village_id=VILLAGE_ID, name=name, status="UNKNOWN"))

        for p_id, n_id in ADJ:
            db.add(
                ParcelAdjacency(
                    id=_uid("adj"),
                    village_id=VILLAGE_ID,
                    parcel_id=p_id,
                    neighbor_parcel_id=n_id,
                    weight=None,
                )
            )

        for parcel_id, crop_id in CROP_PLAN:
            db.add(
                ParcelCropPlan(
                    id=_uid("plan"),
                    parcel_id=parcel_id,
                    season=SEASON,
                    crop_id=crop_id,
                    sowing_date=None,
                    notes="demo_v1_seed",
                )
            )

        db.commit()
        print("Demo seed v1 basildi: village=v1, parcels=8")
    finally:
        db.close()


if __name__ == "__main__":
    main()
