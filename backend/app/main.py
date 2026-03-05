from copy import deepcopy
from datetime import date, datetime, timezone
import base64
import hashlib
import hmac
import json
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal
from app.decision_engine.rules_v2 import run_rules_v2
from app.models import CropCatalog, DecisionResult, Parcel, ParcelCropPlan, Village

app = FastAPI(title="AgroNovaTech-AI Backend", version="v2-demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SEASON = "2026_Spring"
VILLAGE = {
    "village_id": "v1",
    "name": "Demo Koyu",
    "center": {"lat": 39.0, "lng": 35.0},
}
CROPS = [
    {"crop_id": "c_wheat", "crop_name": "Bugday"},
    {"crop_id": "c_barley", "crop_name": "Arpa"},
    {"crop_id": "c_sunflower", "crop_name": "Aycicek"},
    {"crop_id": "c_corn", "crop_name": "Misir"},
]
CROP_NAME_MAP = {item["crop_id"]: item["crop_name"] for item in CROPS}
PARCELS = [
    {"parcel_id": "a_p1", "name": "P1", "field_block": {"field_block_id": "fb_a", "name": "Tarla Blogu A"}},
    {"parcel_id": "a_p2", "name": "P2", "field_block": {"field_block_id": "fb_a", "name": "Tarla Blogu A"}},
    {"parcel_id": "a_p3", "name": "P3", "field_block": {"field_block_id": "fb_a", "name": "Tarla Blogu A"}},
    {"parcel_id": "a_p4", "name": "P4", "field_block": {"field_block_id": "fb_a", "name": "Tarla Blogu A"}},
    {"parcel_id": "a_p5", "name": "P5", "field_block": {"field_block_id": "fb_a", "name": "Tarla Blogu A"}},
    {"parcel_id": "a_p6", "name": "P6", "field_block": {"field_block_id": "fb_a", "name": "Tarla Blogu A"}},
    {"parcel_id": "a_p7", "name": "P7", "field_block": {"field_block_id": "fb_a", "name": "Tarla Blogu A"}},
    {"parcel_id": "a_p8", "name": "P8", "field_block": {"field_block_id": "fb_a", "name": "Tarla Blogu A"}},
    {"parcel_id": "b_p1", "name": "P1", "field_block": {"field_block_id": "fb_b", "name": "Tarla Blogu B"}},
    {"parcel_id": "b_p2", "name": "P2", "field_block": {"field_block_id": "fb_b", "name": "Tarla Blogu B"}},
    {"parcel_id": "b_p3", "name": "P3", "field_block": {"field_block_id": "fb_b", "name": "Tarla Blogu B"}},
    {"parcel_id": "b_p4", "name": "P4", "field_block": {"field_block_id": "fb_b", "name": "Tarla Blogu B"}},
    {"parcel_id": "b_p5", "name": "P5", "field_block": {"field_block_id": "fb_b", "name": "Tarla Blogu B"}},
    {"parcel_id": "b_p6", "name": "P6", "field_block": {"field_block_id": "fb_b", "name": "Tarla Blogu B"}},
    {"parcel_id": "b_p7", "name": "P7", "field_block": {"field_block_id": "fb_b", "name": "Tarla Blogu B"}},
    {"parcel_id": "b_p8", "name": "P8", "field_block": {"field_block_id": "fb_b", "name": "Tarla Blogu B"}},
]
PARCEL_BLOCK_MAP = {
    parcel["parcel_id"]: parcel["field_block"]["field_block_id"]
    for parcel in PARCELS
}

# Yön bazlı INTER_BLOCK komşuluk haritası
# Tarla B'nin Tarla A'ya göre konumuna göre hangi parsel çiftleri sınır komşusu olur
INTER_BLOCK_ADJACENCY_BY_POSITION: Dict[str, List[tuple]] = {
    "right":  [("a_p4", "b_p1"), ("a_p8", "b_p5")],
    "left":   [("a_p1", "b_p4"), ("a_p5", "b_p8")],
    "top":    [("a_p1", "b_p5"), ("a_p2", "b_p6"), ("a_p3", "b_p7"), ("a_p4", "b_p8")],
    "bottom": [("a_p5", "b_p1"), ("a_p6", "b_p2"), ("a_p7", "b_p3"), ("a_p8", "b_p4")],
}

ADJACENCY_BASE: Dict[str, List[str]] = {
    "a_p1": ["a_p2", "a_p5"],
    "a_p2": ["a_p1", "a_p3", "a_p6"],
    "a_p3": ["a_p2", "a_p4", "a_p7"],
    "a_p4": ["a_p3", "a_p8"],
    "a_p5": ["a_p1", "a_p6"],
    "a_p6": ["a_p2", "a_p5", "a_p7"],
    "a_p7": ["a_p3", "a_p6", "a_p8"],
    "a_p8": ["a_p4", "a_p7"],
    "b_p1": ["b_p2", "b_p5"],
    "b_p2": ["b_p1", "b_p3", "b_p6"],
    "b_p3": ["b_p2", "b_p4", "b_p7"],
    "b_p4": ["b_p3", "b_p8"],
    "b_p5": ["b_p1", "b_p6"],
    "b_p6": ["b_p2", "b_p5", "b_p7"],
    "b_p7": ["b_p3", "b_p6", "b_p8"],
    "b_p8": ["b_p4", "b_p7"],
}

HIGH_INCOMPATIBLE = {("c_wheat", "c_sunflower"), ("c_sunflower", "c_wheat")}
MEDIUM_INCOMPATIBLE = {("c_corn", "c_sunflower"), ("c_sunflower", "c_corn")}
INTRA_HIGH_WEIGHT = 20
INTER_HIGH_WEIGHT = 25
INTRA_MEDIUM_WEIGHT = 12
INTER_MEDIUM_WEIGHT = 15

STATE: Dict[str, Any] = {
    "crop_plan": {
        "a_p1": "c_wheat",
        "a_p2": "c_sunflower",
        "a_p3": "c_wheat",
        "a_p4": "c_wheat",
        "a_p5": "c_wheat",
        "a_p6": "c_sunflower",
        "a_p7": "c_corn",
        "a_p8": "c_barley",
        "b_p1": "c_wheat",
        "b_p2": "c_barley",
        "b_p3": "c_wheat",
        "b_p4": "c_corn",
        "b_p5": "c_wheat",
        "b_p6": "c_sunflower",
        "b_p7": "c_wheat",
        "b_p8": "c_wheat",
    },
    "decisions": {},
    "last_job_id": None,
    "field_layout_position": "right",  # top | right | bottom | left
}
JWT_SECRET = "agronovatech-demo-secret"


def get_active_adjacency() -> Dict[str, List[str]]:
    """Aktif yöne göre INTER_BLOCK komşuluklarını ADJACENCY_BASE'e ekler."""
    adjacency = deepcopy(ADJACENCY_BASE)
    position = STATE.get("field_layout_position", "right")
    inter_pairs = INTER_BLOCK_ADJACENCY_BY_POSITION.get(position, [])
    for a, b in inter_pairs:
        if b not in adjacency[a]:
            adjacency[a].append(b)
        if a not in adjacency[b]:
            adjacency[b].append(a)
    return adjacency


def db_session():
    try:
        return SessionLocal()
    except Exception:
        return None


def sync_demo_state_from_db() -> None:
    db = db_session()
    if db is None:
        return
    try:
        village = db.get(Village, VILLAGE["village_id"])
        if not village:
            return
        crop_rows = db.query(CropCatalog).all()
        if crop_rows:
            global CROPS, CROP_NAME_MAP
            CROPS = [{"crop_id": row.id, "crop_name": row.crop_name} for row in crop_rows]
            CROP_NAME_MAP = {item["crop_id"]: item["crop_name"] for item in CROPS}
        plan_rows = db.query(ParcelCropPlan).filter(ParcelCropPlan.season == SEASON).all()
        if plan_rows:
            STATE["crop_plan"] = {row.parcel_id: row.crop_id for row in plan_rows}
        latest_decisions = (
            db.query(DecisionResult)
            .filter(DecisionResult.season == SEASON)
            .order_by(desc(DecisionResult.created_at))
            .all()
        )
        mapped: Dict[str, Dict[str, Any]] = {}
        for row in latest_decisions:
            if not row.parcel_id or row.parcel_id in mapped:
                continue
            mapped[row.parcel_id] = {
                "parcel_id": row.parcel_id,
                "season": row.season,
                "risk_score": row.risk_score,
                "risk_level": row.risk_level,
                "reasons": row.reasons_json,
                "recommendations": row.recommendations_json,
                "confidence": row.confidence,
                "model_version": row.model_version,
            }
        if mapped:
            STATE["decisions"] = mapped
    except SQLAlchemyError:
        pass
    finally:
        db.close()


def ensure_core_seed() -> None:
    db = db_session()
    if db is None:
        return
    try:
        if db.get(Village, VILLAGE["village_id"]) is None:
            db.add(Village(
                id=VILLAGE["village_id"],
                name=VILLAGE["name"],
                center_lat=VILLAGE["center"]["lat"],
                center_lng=VILLAGE["center"]["lng"],
            ))
        for crop in CROPS:
            if db.get(CropCatalog, crop["crop_id"]) is None:
                db.add(CropCatalog(id=crop["crop_id"], crop_name=crop["crop_name"], group_name=None, is_active=True))
        for parcel in PARCELS:
            if db.get(Parcel, parcel["parcel_id"]) is None:
                db.add(Parcel(id=parcel["parcel_id"], village_id=VILLAGE["village_id"], name=parcel["name"], status="UNKNOWN"))
        db.flush()
        for parcel_id, crop_id in STATE["crop_plan"].items():
            existing = db.query(ParcelCropPlan).filter(
                ParcelCropPlan.parcel_id == parcel_id,
                ParcelCropPlan.season == SEASON,
            ).one_or_none()
            if existing is None:
                db.add(ParcelCropPlan(
                    id=f"plan_{parcel_id}_{SEASON}",
                    parcel_id=parcel_id,
                    season=SEASON,
                    crop_id=crop_id,
                    sowing_date=None,
                    notes="auto_seed",
                ))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def persist_crop_plan(parcel_id: str, crop_id: str) -> None:
    db = db_session()
    if db is None:
        return
    try:
        ensure_core_seed()
        row = db.query(ParcelCropPlan).filter(
            ParcelCropPlan.parcel_id == parcel_id,
            ParcelCropPlan.season == SEASON,
        ).one_or_none()
        if row is None:
            row = ParcelCropPlan(
                id=f"plan_{parcel_id}_{SEASON}",
                parcel_id=parcel_id,
                season=SEASON,
                crop_id=crop_id,
                sowing_date=date(2026, 3, 10),
                notes="ui_update",
            )
            db.add(row)
        else:
            row.crop_id = crop_id
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def persist_decisions(decisions: Dict[str, Dict[str, Any]], decision_run_id: str) -> None:
    db = db_session()
    if db is None:
        return
    try:
        ensure_core_seed()
        for parcel_id, payload in decisions.items():
            parcel = db.get(Parcel, parcel_id)
            if parcel is not None:
                parcel.status = payload["risk_level"]
            db.add(DecisionResult(
                id=f"dr_{decision_run_id}_{parcel_id}",
                village_id=VILLAGE["village_id"],
                parcel_id=parcel_id,
                season=SEASON,
                risk_score=payload["risk_score"],
                risk_level=payload["risk_level"],
                reasons_json=payload["reasons"],
                recommendations_json=payload["recommendations"],
                confidence=payload["confidence"],
                model_version=payload["model_version"],
                decision_run_id=decision_run_id,
            ))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def read_latest_decision_from_db(parcel_id: str) -> Optional[Dict[str, Any]]:
    db = db_session()
    if db is None:
        return None
    try:
        row = (
            db.query(DecisionResult)
            .filter(DecisionResult.parcel_id == parcel_id, DecisionResult.season == SEASON)
            .order_by(desc(DecisionResult.created_at))
            .first()
        )
        if row is None:
            return None
        return {
            "parcel_id": row.parcel_id,
            "season": row.season,
            "risk_score": row.risk_score,
            "risk_level": row.risk_level,
            "reasons": row.reasons_json,
            "recommendations": row.recommendations_json,
            "confidence": row.confidence,
            "model_version": row.model_version,
        }
    except SQLAlchemyError:
        return None
    finally:
        db.close()


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def create_demo_jwt(email: str, role: str = "FARMER") -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": email,
        "role": role,
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    message = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), message, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url(signature)}"


def risk_level_from_score(score: int) -> str:
    if score >= 70:
        return "CRITICAL"
    if score >= 40:
        return "RISKY"
    return "OK"


def adjacency_type_for(parcel_id: str, neighbor_id: str) -> str:
    if PARCEL_BLOCK_MAP.get(parcel_id) == PARCEL_BLOCK_MAP.get(neighbor_id):
        return "INTRA_BLOCK"
    return "INTER_BLOCK"


def build_reasons(reason_codes: List[str], parcel_id: str) -> List[Dict[str, str]]:
    texts = {
        "NEIGHBOR_INCOMPATIBLE": "Komsu parsellerde uyumsuz urun kombinasyonu tespit edildi.",
        "INTRA_BLOCK_CONFLICT": "Ayni tarla blogu icinde uyumsuz komsu urun tespit edildi.",
        "INTER_BLOCK_BORDER_CONFLICT": "Komsu tarla sinirinda uyumsuz urun etkisi tespit edildi.",
        "HIGH_DIVERSITY_PRESSURE": "Koyde urun dagilimi dengesiz.",
        "SAME_CROP_CLUSTERING": "Ayni urun yogunlugu yuksek.",
        "UNKNOWN_DATA": "Karar icin bazi veriler eksik veya tanimsiz.",
    }
    result: List[Dict[str, str]] = []
    for code in reason_codes:
        text = texts.get(code, texts["UNKNOWN_DATA"])
        if code in {"NEIGHBOR_INCOMPATIBLE", "INTRA_BLOCK_CONFLICT"} and parcel_id == "a_p1":
            text = "Komsu parselde aycicek tespit edildi."
        result.append({"code": code, "text": text})
    return result


def build_recommendations(parcel_id: str, reason_codes: List[str]) -> List[Dict[str, str]]:
    recs: List[Dict[str, str]] = []
    if "INTER_BLOCK_BORDER_CONFLICT" in reason_codes:
        recs.append({"type": "CROP_SUGGESTION", "text": "Sinir komsulugu icin arpa veya misir onerilir."})
    elif "INTRA_BLOCK_CONFLICT" in reason_codes or "NEIGHBOR_INCOMPATIBLE" in reason_codes:
        recs.append({"type": "CROP_SUGGESTION", "text": "Arpa veya misir onerilir."})
    elif "SAME_CROP_CLUSTERING" in reason_codes:
        recs.append({"type": "CROP_SUGGESTION", "text": "Munavebe icin farkli urun planlayin."})
    else:
        recs.append({"type": "ACTION", "text": "Mevcut plan uygun gorunuyor, sezon takibi yapin."})
    if parcel_id == "a_p1":
        recs.append({"type": "ACTION", "text": "Ekim tarihini 7-10 gun kaydirmak risk azaltabilir."})
    return recs


def compute_all_decisions() -> Dict[str, Dict[str, Any]]:
    active_parcel_ids = {parcel["parcel_id"] for parcel in PARCELS}
    crop_plan = {pid: cid for pid, cid in STATE["crop_plan"].items() if pid in active_parcel_ids}
    crop_counts: Dict[str, int] = {}
    for crop_id in crop_plan.values():
        crop_counts[crop_id] = crop_counts.get(crop_id, 0) + 1
    unique_crops = len(set(crop_plan.values()))
    adjacency = get_active_adjacency()  # Aktif yöne göre komşuluk
    decisions: Dict[str, Dict[str, Any]] = {}
    for parcel in PARCELS:
        parcel_id = parcel["parcel_id"]
        crop_id = crop_plan.get(parcel_id)
        intra_neighbor_crops: List[str] = []
        inter_neighbor_crops: List[str] = []
        for neighbor_id in adjacency.get(parcel_id, []):
            neighbor_crop = crop_plan.get(neighbor_id)
            if not neighbor_crop:
                continue
            if adjacency_type_for(parcel_id, neighbor_id) == "INTER_BLOCK":
                inter_neighbor_crops.append(neighbor_crop)
            else:
                intra_neighbor_crops.append(neighbor_crop)

        engine_output = run_rules_v2(
            parcel_crop_id=crop_id or "",
            intra_block_neighbor_crop_ids=intra_neighbor_crops,
            inter_block_neighbor_crop_ids=inter_neighbor_crops,
            village_unique_crops_count=unique_crops,
            total_parcel_count=len(PARCELS),
            same_crop_total_count=crop_counts.get(crop_id, 0) if crop_id else 0,
        )
        decisions[parcel_id] = {
            "parcel_id": parcel_id,
            "season": SEASON,
            "risk_score": engine_output.risk_score,
            "risk_level": engine_output.risk_level,
            "reasons": build_reasons(engine_output.reason_codes, parcel_id),
            "recommendations": engine_output.recommendations,
            "confidence": engine_output.confidence,
            "model_version": engine_output.model_version,
        }
    return decisions


def ensure_decisions() -> None:
    if not STATE["decisions"]:
        STATE["decisions"] = compute_all_decisions()


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "AgroNovaTech-AI backend is running", "version": "v2-demo"}


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "service": "backend", "version": "v2"}


@app.post("/api/v1/auth/login")
def login(payload: Dict[str, Any]):
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password are required")
    return {
        "ok": True,
        "access_token": create_demo_jwt(str(email)),
        "token_type": "bearer",
        "role": "FARMER",
    }


@app.get("/api/v1/villages")
def villages():
    ensure_core_seed()
    sync_demo_state_from_db()
    return {"villages": [VILLAGE]}


@app.get("/api/v1/crops")
def crops():
    ensure_core_seed()
    sync_demo_state_from_db()
    return {"crops": CROPS}


@app.get("/api/v1/villages/{village_id}/parcels")
def village_parcels(village_id: str, season: str = Query(...)):
    if village_id != VILLAGE["village_id"]:
        raise HTTPException(status_code=404, detail="Village not found")
    if season != SEASON:
        raise HTTPException(status_code=400, detail="Unsupported season")
    sync_demo_state_from_db()
    ensure_decisions()
    items = []
    for parcel in PARCELS:
        pid = parcel["parcel_id"]
        crop_id = STATE["crop_plan"].get(pid)
        decision = STATE["decisions"].get(pid)
        items.append({
            "parcel_id": pid,
            "name": parcel["name"],
            "status": decision["risk_level"] if decision else "UNKNOWN",
            "crop": {"crop_id": crop_id, "crop_name": CROP_NAME_MAP.get(crop_id, "")} if crop_id else None,
            "risk_score": decision["risk_score"] if decision else None,
            "risk_level": decision["risk_level"] if decision else None,
            "field_block": parcel.get("field_block"),
        })
    return {"village_id": village_id, "season": season, "parcels": items}


@app.put("/api/v1/parcels/{parcel_id}/crop-plan")
def update_crop(parcel_id: str, payload: Dict[str, Any]):
    adjacency = get_active_adjacency()
    if parcel_id not in adjacency:
        raise HTTPException(status_code=404, detail="Parcel not found")
    if payload.get("season") != SEASON:
        raise HTTPException(status_code=400, detail="Unsupported season")
    crop_id = payload.get("crop_id")
    if crop_id not in CROP_NAME_MAP:
        raise HTTPException(status_code=400, detail="Invalid crop_id")
    STATE["crop_plan"][parcel_id] = crop_id
    STATE["decisions"] = {}
    persist_crop_plan(parcel_id, crop_id)
    return {"ok": True, "parcel_id": parcel_id, "season": SEASON}


@app.post("/api/v1/decision/score")
def score(payload: Dict[str, Any]):
    if payload.get("village_id") != VILLAGE["village_id"]:
        raise HTTPException(status_code=404, detail="Village not found")
    if payload.get("season") != SEASON:
        raise HTTPException(status_code=400, detail="Unsupported season")
    sync_demo_state_from_db()
    STATE["decisions"] = compute_all_decisions()
    STATE["last_job_id"] = datetime.now(timezone.utc).strftime("djob_%Y%m%d%H%M%S%f")
    persist_decisions(STATE["decisions"], STATE["last_job_id"])
    return {
        "ok": True,
        "job_id": STATE["last_job_id"],
        "status": "COMPLETED",
        "computed_at": now_iso(),
    }


@app.get("/api/v1/parcels/{parcel_id}/decision")
def parcel_decision(parcel_id: str, season: str = Query(...)):
    adjacency = get_active_adjacency()
    if parcel_id not in adjacency:
        raise HTTPException(status_code=404, detail="Parcel not found")
    if season != SEASON:
        raise HTTPException(status_code=400, detail="Unsupported season")
    STATE["decisions"] = compute_all_decisions()
    if parcel_id not in STATE["decisions"]:
        raise HTTPException(status_code=404, detail="Decision not found")
    return deepcopy(STATE["decisions"][parcel_id])


@app.get("/api/v1/villages/{village_id}/decision-summary")
def village_summary(village_id: str, season: str = Query(...)):
    sync_demo_state_from_db()
    if village_id != VILLAGE["village_id"]:
        raise HTTPException(status_code=404, detail="Village not found")
    if season != SEASON:
        raise HTTPException(status_code=400, detail="Unsupported season")
    ensure_decisions()
    dist = {"OK": 0, "RISKY": 0, "CRITICAL": 0, "UNKNOWN": 0}
    for item in STATE["decisions"].values():
        dist[item["risk_level"]] = dist.get(item["risk_level"], 0) + 1
    return {
        "village_id": village_id,
        "season": season,
        "risk_distribution": dist,
        "shared_recommendations": [
            {"type": "VILLAGE_PLAN", "text": "Aycicek ve bugday komsulugunu azaltarak koy geneli risk dusurulebilir."}
        ],
        "model_version": "rules_v2",
    }


# ─── SPRINT-2: Field Layout Endpoint ──────────────────────────────────────────

@app.get("/api/v2/villages/{village_id}/field-layout")
def get_field_layout(village_id: str):
    """Tarla B'nin aktif yönünü döner."""
    if village_id != VILLAGE["village_id"]:
        raise HTTPException(status_code=404, detail="Village not found")
    return {
        "village_id": village_id,
        "field_layout_position": STATE["field_layout_position"],
        "valid_positions": ["top", "right", "bottom", "left"],
    }


@app.put("/api/v2/villages/{village_id}/field-layout")
def update_field_layout(village_id: str, payload: Dict[str, Any]):
    """Tarla B'nin yönünü günceller ve komşuluğu yeniden hesaplar."""
    if village_id != VILLAGE["village_id"]:
        raise HTTPException(status_code=404, detail="Village not found")
    position = payload.get("field_layout_position")
    if position not in ["top", "right", "bottom", "left"]:
        raise HTTPException(status_code=400, detail="Gecersiz pozisyon. top | right | bottom | left olmali.")
    STATE["field_layout_position"] = position
    STATE["decisions"] = {}  # Yön değişince kararları sıfırla
    return {
        "ok": True,
        "village_id": village_id,
        "field_layout_position": position,
        "message": f"Tarla B yonu '{position}' olarak guncellendi. Komşuluk yeniden hesaplandı.",
    }
@app.get("/api/v2/parcels/{parcel_id}/neighbors")
def parcel_neighbors_v2(parcel_id: str, season: str = Query(...)):
    """Secili parselin aktif yerlesime gore intra/inter blok komsularini dondurur."""
    adjacency = get_active_adjacency()
    if parcel_id not in adjacency:
        raise HTTPException(status_code=404, detail="Parcel not found")
    if season != SEASON:
        raise HTTPException(status_code=400, detail="Unsupported season")

    intra: List[Dict[str, str]] = []
    inter: List[Dict[str, str]] = []

    for neighbor_id in adjacency.get(parcel_id, []):
        adj_type = adjacency_type_for(parcel_id, neighbor_id)
        item = {"parcel_id": neighbor_id, "adjacency_type": adj_type}
        if adj_type == "INTRA_BLOCK":
            intra.append(item)
        else:
            inter.append(item)

    return {
        "parcel_id": parcel_id,
        "season": season,
        "layout_position": STATE["field_layout_position"],
        "neighbors": {
            "intra_block": intra,
            "inter_block": inter,
        },
    }
