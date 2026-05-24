from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from typing import Any, Literal, TypedDict

from fastapi import HTTPException

from backend.app.db.session import get_conn

VALID_LAYOUTS = {"top", "right", "bottom", "left"}
FIELD_LAYOUT_POSITION = "top"
DEFAULT_VILLAGE_ID = "v1"

LAT_SCALE = 0.00062
LNG_SCALE = 0.00078
WORLD_ANCHOR = (37.8422, 40.1178)
BLOCK_HEIGHT = 2.0
BLOCK_WIDTH = 4.0
BLOCK_A_ORIGIN = (0.0, 0.0)

CropKey = Literal["corn", "sunflower", "wheat", "barley"]


class ParcelRecord(TypedDict):
    parcel_id: str
    village_id: str
    field_block: str
    planned_crop: str
    display_name: str
    owner_user_id: str
    parent_parcel_id: str | None
    area_m2: float
    local_geometry: list[list[float]]
    is_active: int
    split_strategy: str | None
    subparcel_index: int | None


class NeighborDetail(TypedDict):
    parcel_id: str
    adjacency_type: Literal["INTRA_BLOCK", "INTER_BLOCK"]
    shared_boundary_ratio: float
    shared_boundary_m: float


ROOT_OWNERS = {
    "A": "demo",
    "B": "neighbor_farmer",
}
ROOT_FIELDS = {
    "A": "field_a_root",
    "B": "field_b_root",
}

DEFAULT_PLOTS: dict[str, CropKey] = {
    "a_p1": "corn",
    "a_p2": "sunflower",
    "a_p3": "wheat",
    "a_p4": "corn",
    "a_p5": "corn",
    "a_p6": "barley",
    "a_p7": "wheat",
    "a_p8": "corn",
    "b_p1": "sunflower",
    "b_p2": "wheat",
    "b_p3": "corn",
    "b_p4": "barley",
    "b_p5": "sunflower",
    "b_p6": "wheat",
    "b_p7": "corn",
    "b_p8": "barley",
}


def ensure_village(village_id: str) -> None:
    if village_id != DEFAULT_VILLAGE_ID:
        raise HTTPException(status_code=404, detail="Village not found")


def get_layout() -> str:
    return FIELD_LAYOUT_POSITION


def update_layout(village_id: str, position: str) -> str:
    global FIELD_LAYOUT_POSITION
    ensure_village(village_id)
    if position not in VALID_LAYOUTS:
        raise HTTPException(status_code=400, detail="Invalid field layout position")
    FIELD_LAYOUT_POSITION = position
    return FIELD_LAYOUT_POSITION


def ensure_parcel(parcel_id: str, active_only: bool = True) -> None:
    if get_parcel_record(parcel_id, active_only=active_only) is None:
        raise HTTPException(status_code=404, detail="Parcel not found")


def get_all_parcel_ids(active_only: bool = True) -> list[str]:
    rows = _fetch_parcel_rows(active_only=active_only, public_only=True)
    return [row["parcel_id"] for row in rows]


def get_crop_map(active_only: bool = True) -> dict[str, str]:
    rows = _fetch_parcel_rows(active_only=active_only, public_only=True)
    return {row["parcel_id"]: row["planned_crop"] for row in rows}


def get_parcel_crop(parcel_id: str) -> str:
    record = get_parcel_record(parcel_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return record["planned_crop"]


def list_parcels(village_id: str) -> list[dict[str, Any]]:
    ensure_village(village_id)
    return [_serialize_record(row) for row in _fetch_parcel_rows(active_only=True, public_only=True)]


def get_parcel_record(parcel_id: str, active_only: bool = True) -> ParcelRecord | None:
    rows = _fetch_parcel_rows(parcel_id=parcel_id, active_only=active_only)
    return rows[0] if rows else None


def list_subparcels(parcel_id: str) -> list[dict[str, Any]]:
    ensure_parcel(parcel_id, active_only=False)
    active_descendants = _get_active_descendants(parcel_id)
    return [_serialize_record(row) for row in active_descendants]


def update_parcel_crop(parcel_id: str, crop: CropKey) -> dict[str, Any]:
    ensure_parcel(parcel_id)
    with get_conn() as conn:
        conn.execute(
            "UPDATE parcel_records SET planned_crop=? WHERE parcel_id=?",
            (crop, parcel_id),
        )
        conn.commit()
    updated = get_parcel_record(parcel_id)
    assert updated is not None
    return _serialize_record(updated)


def update_parcel_name(parcel_id: str, display_name: str) -> dict[str, Any]:
    ensure_parcel(parcel_id)
    clean_name = display_name.strip()
    if len(clean_name) < 2:
        raise HTTPException(status_code=400, detail="display_name must be at least 2 characters")
    with get_conn() as conn:
        conn.execute(
            "UPDATE parcel_records SET display_name=? WHERE parcel_id=?",
            (clean_name, parcel_id),
        )
        conn.commit()
    updated = get_parcel_record(parcel_id)
    assert updated is not None
    return _serialize_record(updated)


def subdivide_parcel(parcel_id: str, requested_count: int, strategy: str = "equal_grid") -> list[dict[str, Any]]:
    if requested_count < 2:
        raise HTTPException(status_code=400, detail="requested_count must be at least 2")

    parent = get_parcel_record(parcel_id, active_only=False)
    if parent is None:
        raise HTTPException(status_code=404, detail="Parcel not found")

    active_descendants = _get_active_descendants(parcel_id)
    to_disable = [row["parcel_id"] for row in active_descendants] if active_descendants else [parcel_id]
    parent_geometry = parent["local_geometry"]
    parent_area = float(parent["area_m2"])
    child_geometries = _split_polygon(parent_geometry, requested_count)
    child_area = round(parent_area / requested_count, 2)
    child_crop = parent["planned_crop"]
    if child_crop == "mixed" and active_descendants:
        child_crop = max(
            Counter(row["planned_crop"] for row in active_descendants).items(),
            key=lambda item: item[1],
        )[0]

    with get_conn() as conn:
        for target_id in to_disable:
            conn.execute("UPDATE parcel_records SET is_active=0 WHERE parcel_id=?", (target_id,))
        conn.execute(
            "UPDATE parcel_records SET is_active=0, split_strategy=? WHERE parcel_id=?",
            (strategy, parent["parcel_id"]),
        )
        for index, geometry in enumerate(child_geometries, start=1):
            child_id = f"{parent['parcel_id']}_s{index}"
            conn.execute(
                """
                INSERT OR REPLACE INTO parcel_records (
                    parcel_id, village_id, field_block, planned_crop, display_name, owner_user_id,
                    parent_parcel_id, area_m2, local_geometry, is_active, split_strategy, subparcel_index
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    child_id,
                    parent["village_id"],
                    parent["field_block"],
                    child_crop,
                    _make_child_display_name(parent["field_block"], index),
                    parent["owner_user_id"],
                    parent["parcel_id"],
                    child_area,
                    json.dumps(geometry),
                    strategy,
                    index,
                ),
            )
        conn.commit()

    return list_subparcels(parent["parcel_id"])


def subdivide_field(field_block: str, requested_count: int, strategy: str = "equal_grid") -> list[dict[str, Any]]:
    root_id = ROOT_FIELDS.get(field_block.upper())
    if root_id is None:
        raise HTTPException(status_code=404, detail="Field block not found")
    return subdivide_parcel(root_id, requested_count, strategy)


def undo_last_split(parcel_id: str) -> list[dict[str, Any]]:
    record = get_parcel_record(parcel_id, active_only=False)
    if record is None:
        raise HTTPException(status_code=404, detail="Parcel not found")

    target_id = record["parent_parcel_id"] or parcel_id
    target = get_parcel_record(target_id, active_only=False)
    if target is None:
        raise HTTPException(status_code=404, detail="Parent parcel not found")

    active_descendants = _get_active_descendants(target_id)
    if not active_descendants:
        raise HTTPException(status_code=400, detail="Undo target has no active descendants")

    with get_conn() as conn:
        for child in active_descendants:
            conn.execute("UPDATE parcel_records SET is_active=0 WHERE parcel_id=?", (child["parcel_id"],))
        if _is_root_id(target_id):
            for child in _get_default_root_children(target["field_block"]):
                conn.execute("UPDATE parcel_records SET is_active=1 WHERE parcel_id=?", (child["parcel_id"],))
        else:
            conn.execute("UPDATE parcel_records SET is_active=1 WHERE parcel_id=?", (target_id,))
        conn.commit()

    if _is_root_id(target_id):
        return list_field_parcels(target["field_block"])
    return list_subparcels(target_id)


def delete_parcel(parcel_id: str) -> list[dict[str, Any]]:
    record = get_parcel_record(parcel_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Parcel not found")
    if record["parent_parcel_id"] is None:
        raise HTTPException(status_code=400, detail="Top-level parcel cannot be deleted directly")

    with get_conn() as conn:
        conn.execute("UPDATE parcel_records SET is_active=0 WHERE parcel_id=?", (parcel_id,))
        conn.commit()

    siblings = [child for child in _get_direct_children(record["parent_parcel_id"]) if child["is_active"] == 1]
    if not siblings:
        return undo_last_split(record["parent_parcel_id"])
    if _is_root_id(record["parent_parcel_id"]):
        return list_field_parcels(record["field_block"])
    return list_subparcels(record["parent_parcel_id"])


def list_field_parcels(field_block: str) -> list[dict[str, Any]]:
    rows = _fetch_parcel_rows(active_only=True, public_only=True)
    return [_serialize_record(row) for row in rows if row["field_block"] == field_block.upper()]


def get_neighbor_ids(parcel_id: str) -> tuple[list[str], list[str]]:
    ensure_parcel(parcel_id)
    details = get_neighbor_details(parcel_id)
    intra = [item["parcel_id"] for item in details if item["adjacency_type"] == "INTRA_BLOCK"]
    inter = [item["parcel_id"] for item in details if item["adjacency_type"] == "INTER_BLOCK"]
    return intra, inter


def get_neighbor_details(parcel_id: str) -> list[NeighborDetail]:
    ensure_parcel(parcel_id)
    adjacency = _build_adjacency_map()
    return adjacency.get(parcel_id, [])


def get_parent_parcel_id(parcel_id: str) -> str | None:
    record = get_parcel_record(parcel_id, active_only=False)
    return record["parent_parcel_id"] if record else None


def get_descendant_ids(parcel_id: str) -> list[str]:
    return [row["parcel_id"] for row in _get_active_descendants(parcel_id)]


def init_village_data() -> None:
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) AS count FROM parcel_records").fetchone()
        if row["count"] > 0:
            return

        for field_block, root_id in ROOT_FIELDS.items():
            conn.execute(
                """
                INSERT INTO parcel_records (
                    parcel_id, village_id, field_block, planned_crop, display_name, owner_user_id,
                    parent_parcel_id, area_m2, local_geometry, is_active, split_strategy, subparcel_index
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, 'field_root', NULL)
                """,
                (
                    root_id,
                    DEFAULT_VILLAGE_ID,
                    field_block,
                    "mixed",
                    f"{field_block} Tarlasi",
                    ROOT_OWNERS[field_block],
                    10000.0,
                    json.dumps(_root_local_geometry(field_block)),
                ),
            )

        for parcel_id, crop in DEFAULT_PLOTS.items():
            field_block = "A" if parcel_id.startswith("a_") else "B"
            geometry = _default_local_geometry(parcel_id)
            conn.execute(
                """
                INSERT INTO parcel_records (
                    parcel_id, village_id, field_block, planned_crop, display_name, owner_user_id,
                    parent_parcel_id, area_m2, local_geometry, is_active, split_strategy, subparcel_index
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL)
                """,
                (
                    parcel_id,
                    DEFAULT_VILLAGE_ID,
                    field_block,
                    crop,
                    f"Parsel {int(parcel_id.split('p')[1])}",
                    ROOT_OWNERS[field_block],
                    ROOT_FIELDS[field_block],
                    1250.0,
                    json.dumps(geometry),
                ),
            )
        conn.commit()


def reset_village_data() -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM parcel_records")
        conn.commit()
    init_village_data()


def _fetch_parcel_rows(parcel_id: str | None = None, active_only: bool = True, public_only: bool = False) -> list[ParcelRecord]:
    query = """
        SELECT parcel_id, village_id, field_block, planned_crop, owner_user_id,
               display_name, parent_parcel_id, area_m2, local_geometry, is_active, split_strategy, subparcel_index
        FROM parcel_records
    """
    clauses: list[str] = []
    params: list[Any] = []
    if parcel_id is not None:
        clauses.append("parcel_id = ?")
        params.append(parcel_id)
    if active_only:
        clauses.append("is_active = 1")
    if public_only:
        clauses.append("parcel_id NOT IN (?, ?)")
        params.extend(ROOT_FIELDS.values())
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY field_block, parcel_id"

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_row_to_record(row) for row in rows]


def _row_to_record(row: Any) -> ParcelRecord:
    return {
        "parcel_id": row["parcel_id"],
        "village_id": row["village_id"],
        "field_block": row["field_block"],
        "planned_crop": row["planned_crop"],
        "display_name": row["display_name"],
        "owner_user_id": row["owner_user_id"],
        "parent_parcel_id": row["parent_parcel_id"],
        "area_m2": float(row["area_m2"]),
        "local_geometry": json.loads(row["local_geometry"]),
        "is_active": int(row["is_active"]),
        "split_strategy": row["split_strategy"],
        "subparcel_index": row["subparcel_index"],
    }


def _serialize_record(record: ParcelRecord) -> dict[str, Any]:
    global_polygon = _global_geometry(record)
    world_polygon = [_to_world(point) for point in global_polygon]
    centroid = _polygon_centroid(global_polygon)
    world_centroid = _to_world(centroid)
    return {
        "parcel_id": record["parcel_id"],
        "field_block": record["field_block"],
        "planned_crop": record["planned_crop"],
        "display_name": record["display_name"],
        "owner_user_id": record["owner_user_id"],
        "parent_parcel_id": record["parent_parcel_id"],
        "area_m2": round(record["area_m2"], 2),
        "geometry": world_polygon,
        "centroid": {"lat": world_centroid[0], "lng": world_centroid[1]},
        "split_strategy": record["split_strategy"],
        "subparcel_index": record["subparcel_index"],
        "is_subparcel": record["parent_parcel_id"] is not None and not _is_root_id(record["parent_parcel_id"]),
    }


def _default_local_geometry(parcel_id: str) -> list[list[float]]:
    number = int(parcel_id.split("p")[1]) - 1
    row = number // 4
    col = number % 4
    x0 = float(row)
    y0 = float(col)
    x1 = x0 + 1.0
    y1 = y0 + 1.0
    return [[x0, y0], [x0, y1], [x1, y1], [x1, y0]]


def _root_local_geometry(field_block: str) -> list[list[float]]:
    if field_block == "A":
        return [[0.0, 0.0], [0.0, 4.0], [2.0, 4.0], [2.0, 0.0]]
    return [[0.0, 0.0], [0.0, 4.0], [2.0, 4.0], [2.0, 0.0]]


def _block_origin(field_block: str) -> tuple[float, float]:
    if field_block == "A":
        return BLOCK_A_ORIGIN
    if FIELD_LAYOUT_POSITION == "top":
        return (-BLOCK_HEIGHT, 0.0)
    if FIELD_LAYOUT_POSITION == "right":
        return (0.0, BLOCK_WIDTH)
    if FIELD_LAYOUT_POSITION == "bottom":
        return (BLOCK_HEIGHT, 0.0)
    return (0.0, -BLOCK_WIDTH)


def _global_geometry(record: ParcelRecord) -> list[list[float]]:
    dx, dy = _block_origin(record["field_block"])
    return [[point[0] + dx, point[1] + dy] for point in record["local_geometry"]]


def _to_world(point: list[float] | tuple[float, float]) -> list[float]:
    lat = WORLD_ANCHOR[0] - (point[0] * LAT_SCALE)
    lng = WORLD_ANCHOR[1] + (point[1] * LNG_SCALE)
    return [round(lat, 7), round(lng, 7)]


def _polygon_centroid(polygon: list[list[float]]) -> list[float]:
    xs = [point[0] for point in polygon]
    ys = [point[1] for point in polygon]
    return [sum(xs) / len(xs), sum(ys) / len(ys)]


def _get_active_descendants(parcel_id: str) -> list[ParcelRecord]:
    rows = _fetch_parcel_rows(active_only=False)
    children_by_parent: dict[str, list[ParcelRecord]] = defaultdict(list)
    active_by_id = {row["parcel_id"]: row for row in rows if row["is_active"] == 1}
    for row in rows:
        if row["parent_parcel_id"]:
            children_by_parent[row["parent_parcel_id"]].append(row)

    stack = [parcel_id]
    descendants: list[ParcelRecord] = []
    seen: set[str] = set()
    while stack:
        current = stack.pop()
        for child in children_by_parent.get(current, []):
            if child["parcel_id"] in seen:
                continue
            seen.add(child["parcel_id"])
            if child["is_active"] == 1:
                descendants.append(child)
            stack.append(child["parcel_id"])

    if descendants:
        descendants.sort(key=lambda item: item["parcel_id"])
        return descendants

    active = active_by_id.get(parcel_id)
    return [active] if active is not None else []


def _get_direct_children(parcel_id: str) -> list[ParcelRecord]:
    rows = _fetch_parcel_rows(active_only=False)
    children = [row for row in rows if row["parent_parcel_id"] == parcel_id]
    children.sort(key=lambda item: item["parcel_id"])
    return children


def _get_default_root_children(field_block: str) -> list[ParcelRecord]:
    children = _get_direct_children(ROOT_FIELDS[field_block])
    return [child for child in children if child["split_strategy"] is None]


def _make_child_display_name(field_block: str, index: int) -> str:
    return f"Parsel {index}"


def _is_root_id(parcel_id: str | None) -> bool:
    return parcel_id in ROOT_FIELDS.values()


def _split_polygon(local_geometry: list[list[float]], requested_count: int) -> list[list[list[float]]]:
    min_x = min(point[0] for point in local_geometry)
    max_x = max(point[0] for point in local_geometry)
    min_y = min(point[1] for point in local_geometry)
    max_y = max(point[1] for point in local_geometry)

    width = max_y - min_y
    height = max_x - min_x
    row_count = max(1, int(math.floor(math.sqrt(requested_count))))
    while row_count > 1 and requested_count % row_count not in {0, 1}:
        row_count -= 1

    counts_per_row = [requested_count // row_count] * row_count
    for index in range(requested_count % row_count):
        counts_per_row[index] += 1

    rows: list[list[list[float]]] = []
    cursor_x = min_x
    total_area = width * height
    cell_area = total_area / requested_count
    for count in counts_per_row:
        row_height = (cell_area * count) / width
        cursor_y = min_y
        cell_width = width / count
        for _ in range(count):
            rows.append(
                [
                    [round(cursor_x, 6), round(cursor_y, 6)],
                    [round(cursor_x, 6), round(cursor_y + cell_width, 6)],
                    [round(cursor_x + row_height, 6), round(cursor_y + cell_width, 6)],
                    [round(cursor_x + row_height, 6), round(cursor_y, 6)],
                ]
            )
            cursor_y += cell_width
        cursor_x += row_height
    return rows


def _build_adjacency_map() -> dict[str, list[NeighborDetail]]:
    rows = _fetch_parcel_rows(active_only=True, public_only=True)
    adjacency: dict[str, list[NeighborDetail]] = defaultdict(list)
    for index, source in enumerate(rows):
        for target in rows[index + 1 :]:
            shared_length = _shared_boundary_length(_global_geometry(source), _global_geometry(target))
            if shared_length <= 0:
                continue
            perimeter_source = _perimeter(source["local_geometry"])
            perimeter_target = _perimeter(target["local_geometry"])
            adjacency_type: Literal["INTRA_BLOCK", "INTER_BLOCK"] = (
                "INTRA_BLOCK" if source["owner_user_id"] == target["owner_user_id"] else "INTER_BLOCK"
            )
            adjacency[source["parcel_id"]].append(
                {
                    "parcel_id": target["parcel_id"],
                    "adjacency_type": adjacency_type,
                    "shared_boundary_ratio": round(shared_length / max(perimeter_source, 1.0), 4),
                    "shared_boundary_m": round(shared_length * 100.0, 2),
                }
            )
            adjacency[target["parcel_id"]].append(
                {
                    "parcel_id": source["parcel_id"],
                    "adjacency_type": adjacency_type,
                    "shared_boundary_ratio": round(shared_length / max(perimeter_target, 1.0), 4),
                    "shared_boundary_m": round(shared_length * 100.0, 2),
                }
            )

    for parcel_id in list(adjacency.keys()):
        adjacency[parcel_id] = sorted(adjacency[parcel_id], key=lambda item: (item["adjacency_type"], item["parcel_id"]))
    return adjacency


def _shared_boundary_length(a: list[list[float]], b: list[list[float]]) -> float:
    a_min_x = min(point[0] for point in a)
    a_max_x = max(point[0] for point in a)
    a_min_y = min(point[1] for point in a)
    a_max_y = max(point[1] for point in a)
    b_min_x = min(point[0] for point in b)
    b_max_x = max(point[0] for point in b)
    b_min_y = min(point[1] for point in b)
    b_max_y = max(point[1] for point in b)
    epsilon = 1e-6

    if abs(a_max_x - b_min_x) < epsilon or abs(b_max_x - a_min_x) < epsilon:
        overlap = min(a_max_y, b_max_y) - max(a_min_y, b_min_y)
        return round(max(0.0, overlap), 6)
    if abs(a_max_y - b_min_y) < epsilon or abs(b_max_y - a_min_y) < epsilon:
        overlap = min(a_max_x, b_max_x) - max(a_min_x, b_min_x)
        return round(max(0.0, overlap), 6)
    return 0.0


def _perimeter(polygon: list[list[float]]) -> float:
    total = 0.0
    for index, point in enumerate(polygon):
        next_point = polygon[(index + 1) % len(polygon)]
        total += math.dist(point, next_point)
    return total


PARCELS = tuple(DEFAULT_PLOTS.keys())
PLOTS = dict(DEFAULT_PLOTS)
