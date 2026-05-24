from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DB_PATH = Path(__file__).resolve().parents[1] / "agronova.db"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS decision_results (
                parcel_id TEXT NOT NULL,
                season TEXT NOT NULL,
                risk_score INTEGER NOT NULL,
                risk_level TEXT NOT NULL,
                reason_codes TEXT NOT NULL,
                confidence REAL,
                model_version TEXT NOT NULL,
                decision_source TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (parcel_id, season)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS parcel_records (
                parcel_id TEXT PRIMARY KEY,
                village_id TEXT NOT NULL,
                field_block TEXT NOT NULL,
                planned_crop TEXT NOT NULL,
                display_name TEXT NOT NULL DEFAULT '',
                owner_user_id TEXT NOT NULL,
                parent_parcel_id TEXT,
                area_m2 REAL NOT NULL,
                local_geometry TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                split_strategy TEXT,
                subparcel_index INTEGER
            )
            """
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(parcel_records)").fetchall()}
        if "display_name" not in columns:
            conn.execute("ALTER TABLE parcel_records ADD COLUMN display_name TEXT NOT NULL DEFAULT ''")
        conn.commit()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.row_factory = sqlite3.Row
        yield conn
    finally:
        conn.close()
