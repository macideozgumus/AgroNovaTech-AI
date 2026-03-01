import os
import sys
from pathlib import Path

from sqlalchemy import text


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal  # noqa: E402
from app.models import FieldBlock, Parcel  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        db.execute(text("DELETE FROM parcel_adjacency"))
        db.execute(text("DELETE FROM decision_result"))
        db.execute(text("DELETE FROM parcel_crop_plan"))
        db.execute(text("DELETE FROM parcel"))
        db.execute(text("DELETE FROM field_block"))

        db.add_all(
            [
                FieldBlock(id="fb_a", village_id="v1", name="Tarla Blogu A", display_order=1),
                FieldBlock(id="fb_b", village_id="v1", name="Tarla Blogu B", display_order=2),
            ]
        )

        db.add_all(
            [
                Parcel(id="a_p1", village_id="v1", field_block_id="fb_a", name="A-P1", status="UNKNOWN"),
                Parcel(id="a_p2", village_id="v1", field_block_id="fb_a", name="A-P2", status="UNKNOWN"),
                Parcel(id="a_p3", village_id="v1", field_block_id="fb_a", name="A-P3", status="UNKNOWN"),
                Parcel(id="a_p4", village_id="v1", field_block_id="fb_a", name="A-P4", status="UNKNOWN"),
                Parcel(id="b_p1", village_id="v1", field_block_id="fb_b", name="B-P1", status="UNKNOWN"),
                Parcel(id="b_p2", village_id="v1", field_block_id="fb_b", name="B-P2", status="UNKNOWN"),
                Parcel(id="b_p3", village_id="v1", field_block_id="fb_b", name="B-P3", status="UNKNOWN"),
                Parcel(id="b_p4", village_id="v1", field_block_id="fb_b", name="B-P4", status="UNKNOWN"),
            ]
        )

        db.commit()
        print("Demo seed v2 basildi: 2 field block, 8 parcel")
    finally:
        db.close()


if __name__ == "__main__":
    main()
