from __future__ import annotations

from fastapi import HTTPException

VALID_LAYOUTS = {"top", "right", "bottom", "left"}
FIELD_LAYOUT_POSITION = "top"
DEFAULT_VILLAGE_ID = "v1"

PARCELS = [
    "a_p1", "a_p2", "a_p3", "a_p4", "a_p5", "a_p6", "a_p7", "a_p8",
    "b_p1", "b_p2", "b_p3", "b_p4", "b_p5", "b_p6", "b_p7", "b_p8",
]

PLOTS = {
    "a_p1": "corn", "a_p2": "sunflower", "a_p3": "wheat", "a_p4": "corn",
    "a_p5": "corn", "a_p6": "barley", "a_p7": "wheat", "a_p8": "corn",
    "b_p1": "sunflower", "b_p2": "wheat", "b_p3": "corn", "b_p4": "barley",
    "b_p5": "sunflower", "b_p6": "wheat", "b_p7": "corn", "b_p8": "barley",
}

PARCEL_META = {
    p: {
        "parcel_id": p,
        "field_block": "A" if p.startswith("a_") else "B",
        "planned_crop": PLOTS[p],
    }
    for p in PARCELS
}

INTRA_NEIGHBORS = {
    "a_p1": ["a_p2", "a_p5"], "a_p2": ["a_p1", "a_p3", "a_p6"], "a_p3": ["a_p2", "a_p4", "a_p7"], "a_p4": ["a_p3", "a_p8"],
    "a_p5": ["a_p1", "a_p6"], "a_p6": ["a_p2", "a_p5", "a_p7"], "a_p7": ["a_p3", "a_p6", "a_p8"], "a_p8": ["a_p4", "a_p7"],
    "b_p1": ["b_p2", "b_p5"], "b_p2": ["b_p1", "b_p3", "b_p6"], "b_p3": ["b_p2", "b_p4", "b_p7"], "b_p4": ["b_p3", "b_p8"],
    "b_p5": ["b_p1", "b_p6"], "b_p6": ["b_p2", "b_p5", "b_p7"], "b_p7": ["b_p3", "b_p6", "b_p8"], "b_p8": ["b_p4", "b_p7"],
}

INTER_BY_LAYOUT = {
    "top": {"a_p1": ["b_p5"], "a_p2": ["b_p6"], "a_p3": ["b_p7"], "a_p4": ["b_p8"]},
    "right": {"a_p2": ["b_p1"], "a_p4": ["b_p3"], "a_p6": ["b_p5"], "a_p8": ["b_p7"]},
    "bottom": {"a_p5": ["b_p1"], "a_p6": ["b_p2"], "a_p7": ["b_p3"], "a_p8": ["b_p4"]},
    "left": {"a_p1": ["b_p2"], "a_p3": ["b_p4"], "a_p5": ["b_p6"], "a_p7": ["b_p8"]},
}


def ensure_village(village_id: str) -> None:
    if village_id != DEFAULT_VILLAGE_ID:
        raise HTTPException(status_code=404, detail="Village not found")


def list_parcels(village_id: str) -> list[dict[str, str]]:
    ensure_village(village_id)
    return [PARCEL_META[p] for p in PARCELS]


def get_layout() -> str:
    return FIELD_LAYOUT_POSITION


def update_layout(village_id: str, position: str) -> str:
    global FIELD_LAYOUT_POSITION
    ensure_village(village_id)
    if position not in VALID_LAYOUTS:
        raise HTTPException(status_code=400, detail="Invalid field layout position")
    FIELD_LAYOUT_POSITION = position
    return FIELD_LAYOUT_POSITION


def ensure_parcel(parcel_id: str) -> None:
    if parcel_id not in PARCELS:
        raise HTTPException(status_code=404, detail="Parcel not found")


def get_neighbor_ids(parcel_id: str) -> tuple[list[str], list[str]]:
    ensure_parcel(parcel_id)
    intra = INTRA_NEIGHBORS.get(parcel_id, [])
    inter = INTER_BY_LAYOUT[FIELD_LAYOUT_POSITION].get(parcel_id, [])
    return intra, inter


def get_parcel_crop(parcel_id: str) -> str:
    ensure_parcel(parcel_id)
    return PLOTS[parcel_id]
