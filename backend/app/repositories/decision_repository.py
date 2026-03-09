from __future__ import annotations

import json
from typing import Any, Optional

from backend.app.db.session import get_conn
from backend.app.models.decision_result import DecisionResult


def upsert_decision(result: DecisionResult) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO decision_results (
                parcel_id, season, risk_score, risk_level, reason_codes,
                confidence, model_version, decision_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(parcel_id, season)
            DO UPDATE SET
                risk_score=excluded.risk_score,
                risk_level=excluded.risk_level,
                reason_codes=excluded.reason_codes,
                confidence=excluded.confidence,
                model_version=excluded.model_version,
                decision_source=excluded.decision_source,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                result.parcel_id,
                result.season,
                result.risk_score,
                result.risk_level,
                json.dumps(result.reason_codes),
                result.confidence,
                result.model_version,
                result.decision_source,
            ),
        )
        conn.commit()


def get_decision(parcel_id: str, season: str) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT parcel_id, season, risk_score, risk_level, reason_codes, confidence, model_version, decision_source FROM decision_results WHERE parcel_id=? AND season=?",
            (parcel_id, season),
        ).fetchone()

    if row is None:
        return None

    return {
        "parcel_id": row["parcel_id"],
        "season": row["season"],
        "risk_score": row["risk_score"],
        "risk_level": row["risk_level"],
        "reason_codes": json.loads(row["reason_codes"]),
        "confidence": row["confidence"],
        "model_version": row["model_version"],
        "decision_source": row["decision_source"],
    }
