from __future__ import annotations

import json
import math
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


_BACKEND_DIR = Path(__file__).resolve().parent
_DEFAULT_DB = (_BACKEND_DIR / "data" / "alienbuster.db").resolve()


def _db_path() -> Path:
    p = os.getenv("BACKEND_DB")
    if p:
        return Path(p).expanduser().resolve()
    return _DEFAULT_DB


def get_conn() -> sqlite3.Connection:
    db = _db_path()
    db.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {str(r[1]) for r in rows}


def _ensure_column(conn: sqlite3.Connection, table: str, col_sql: str) -> None:
    """Add a column if missing.

    col_sql example: "photo_quality REAL".
    """

    col = col_sql.split()[0]
    existing = _table_columns(conn, table)
    if col in existing:
        return

    conn.execute(f"ALTER TABLE {table} ADD COLUMN {col_sql};")


def init_db() -> None:
    conn = get_conn()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT NOT NULL,

              user_id TEXT,
              user_email TEXT,
              reporter_nickname TEXT,

              lat REAL NOT NULL,
              lon REAL NOT NULL,

              species TEXT,
              ml_confidence REAL,
              is_invasive INTEGER,

              photo_path TEXT,
              photo_url TEXT,
              notes TEXT,
              description TEXT,
              topk_json TEXT,

              status TEXT DEFAULT 'unverified',

              ndvi_recent REAL,
              ndvi_baseline REAL,
              ndvi_change REAL,
              ndvi_anomaly INTEGER,

              landcover_recent_json TEXT,
              landcover_baseline_json TEXT,
              landcover_shift REAL,

              report_density REAL,
              satellite_score REAL,
              fused_risk REAL,
              
              photo_quality REAL,
              recommended_action TEXT,
              fused_components_json TEXT,
              fused_reasons_json TEXT,
              needs_more_info_message TEXT,
              needs_more_info_requested_photos_json TEXT,
              inat_id INTEGER UNIQUE
            );
            """
        )

        # Ensure columns that might have been missing in previous versions
        _ensure_column(conn, "reports", "photo_path TEXT")
        _ensure_column(conn, "reports", "description TEXT")
        _ensure_column(conn, "reports", "topk_json TEXT")
        _ensure_column(conn, "reports", "photo_quality REAL")
        _ensure_column(conn, "reports", "recommended_action TEXT")
        _ensure_column(conn, "reports", "fused_components_json TEXT")
        _ensure_column(conn, "reports", "fused_reasons_json TEXT")
        _ensure_column(conn, "reports", "needs_more_info_message TEXT")
        _ensure_column(conn, "reports", "needs_more_info_requested_photos_json TEXT")
        _ensure_column(conn, "reports", "inat_id INTEGER")
        
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS reports_inat_id_idx ON reports(inat_id);")

        conn.execute("CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at);")
        conn.execute("CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS reports_lat_lon_idx ON reports(lat, lon);")
        conn.execute("CREATE INDEX IF NOT EXISTS reports_species_idx ON reports(species);")
        conn.execute("CREATE INDEX IF NOT EXISTS reports_is_invasive_idx ON reports(is_invasive);")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS validations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT NOT NULL,
              report_id INTEGER NOT NULL,
              reviewer TEXT,
              expert_email TEXT,
              decision TEXT NOT NULL,
              confidence REAL,
              confidence_override REAL,
              notes TEXT,
              FOREIGN KEY(report_id) REFERENCES reports(id)
            );
            """
        )
        _ensure_column(conn, "validations", "confidence REAL")
        _ensure_column(conn, "validations", "reviewer TEXT")
        _ensure_column(conn, "validations", "confidence_override REAL")
        conn.execute("CREATE INDEX IF NOT EXISTS validations_report_idx ON validations(report_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS validations_created_at_idx ON validations(created_at);")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS experts (
              email TEXT PRIMARY KEY,
              name TEXT,
              created_at TEXT NOT NULL
            );
            """
        )

        # Reporter reputation
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reporters (
              user_id TEXT PRIMARY KEY,
              reputation REAL DEFAULT 0.5
            );
            """
        )

        # Verified species DB
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS species_verifications (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              species TEXT NOT NULL,
              lat REAL NOT NULL,
              lon REAL NOT NULL,
              verified_at TEXT NOT NULL,
              verified_by TEXT NOT NULL,
              evidence_report_id INTEGER,
              confidence REAL,
              notes TEXT,
              FOREIGN KEY(evidence_report_id) REFERENCES reports(id)
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS species_verifications_species_idx ON species_verifications(species);")
        conn.execute("CREATE INDEX IF NOT EXISTS species_verifications_verified_at_idx ON species_verifications(verified_at);")

        # Learning loop: confusion cases
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS confusion_cases (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT NOT NULL,
              report_id INTEGER,
              predicted_species TEXT,
              predicted_confidence REAL,
              expert_decision TEXT,
              FOREIGN KEY(report_id) REFERENCES reports(id)
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS confusion_cases_created_at_idx ON confusion_cases(created_at);")

        # Citizen feedback (non-expert)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS feedback (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT NOT NULL,
              report_id INTEGER,
              user_id TEXT,
              species TEXT,
              was_correct INTEGER,
              notes TEXT,
              FOREIGN KEY(report_id) REFERENCES reports(id)
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback(created_at);")

        # Outbreak detection
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS outbreaks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              species TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              centroid_lat REAL NOT NULL,
              centroid_lon REAL NOT NULL,
              radius_km REAL NOT NULL,
              num_reports INTEGER NOT NULL,
              mean_risk REAL NOT NULL,
              ndvi_anomaly_rate REAL NOT NULL,
              status TEXT NOT NULL
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS outbreaks_species_idx ON outbreaks(species);")
        conn.execute("CREATE INDEX IF NOT EXISTS outbreaks_status_idx ON outbreaks(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS outbreaks_updated_at_idx ON outbreaks(updated_at);")

        # Response coordination tasks
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              outbreak_id INTEGER,
              report_id INTEGER,
              assigned_to TEXT,
              agency TEXT,
              priority TEXT NOT NULL,
              status TEXT NOT NULL,
              due_at TEXT,
              created_at TEXT NOT NULL,
              notes TEXT,
              FOREIGN KEY(outbreak_id) REFERENCES outbreaks(id),
              FOREIGN KEY(report_id) REFERENCES reports(id)
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS tasks_priority_idx ON tasks(priority);")
        conn.execute("CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks(created_at);")

        conn.commit()
    finally:
        conn.close()


def _utcnow_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _bounding_box(lat: float, lon: float, radius_km: float) -> Tuple[float, float, float, float]:
    # Approx degrees per km
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (111.0 * max(0.2, math.cos(math.radians(lat))))
    return lat - lat_delta, lat + lat_delta, lon - lon_delta, lon + lon_delta


def _row_to_report_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)

    d["is_invasive"] = bool(d.get("is_invasive")) if d.get("is_invasive") is not None else None
    d["ndvi_anomaly"] = bool(d.get("ndvi_anomaly")) if d.get("ndvi_anomaly") is not None else None

    json_cols = [
        "landcover_recent_json",
        "landcover_baseline_json",
        "fused_components_json",
        "fused_reasons_json",
        "needs_more_info_requested_photos_json",
        "topk_json"
    ]

    for k in json_cols:
        if d.get(k):
            try:
                d[k.replace("_json", "")] = json.loads(d[k])
            except Exception:
                d[k.replace("_json", "")] = None
        else:
            d[k.replace("_json", "")] = None

    for k in json_cols:
        d.pop(k, None)

    return d


@dataclass(frozen=True)
class DensityResult:
    count: int
    score: float


def compute_report_density(
    lat: float,
    lon: float,
    *,
    radius_km: float = 2.0,
    window_days: int = 14,
) -> DensityResult:
    """Count invasive reports within radius and time window; return a 0..1 density score."""

    cutoff = (datetime.utcnow() - timedelta(days=window_days)).replace(microsecond=0).isoformat() + "Z"
    min_lat, max_lat, min_lon, max_lon = _bounding_box(lat, lon, radius_km)

    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT lat, lon
            FROM reports
            WHERE created_at >= ?
              AND is_invasive = 1
              AND lat BETWEEN ? AND ?
              AND lon BETWEEN ? AND ?
            """,
            (cutoff, min_lat, max_lat, min_lon, max_lon),
        ).fetchall()
    finally:
        conn.close()

    count = 0
    for r in rows:
        try:
            if _haversine_km(lat, lon, float(r["lat"]), float(r["lon"])) <= radius_km:
                count += 1
        except Exception:
            continue

    # Saturating mapping (0->0, 1->0.28, 3->0.63, 6->0.86 ...)
    score = 1.0 - math.exp(-count / 3.0)
    score = max(0.0, min(1.0, float(score)))

    return DensityResult(count=count, score=score)

def compute_batch_density_and_risk(species: str, radius_km: float = 2.0) -> int:
    """
    For all reports of a given species, recompute density score based on neighbors
    and update fused_risk using a heuristic.
    
    Heuristic:
      fused_risk = ml_confidence * 0.55 + density_score * 0.35 + satellite_score (0.2) * 0.10
    """
    conn = get_conn()
    try:
        # Fetch all reports for this species
        rows = conn.execute("SELECT id, lat, lon, ml_confidence FROM reports WHERE species = ?", (species,)).fetchall()
        reports = [dict(r) for r in rows]
        
        updated_count = 0
        
        # Build simple index or just O(N^2) if N < 2000 is fine.
        # For 1000 reports, 1M ops is fast in python.
        
        for r in reports:
            # Count neighbors
            neighbors = 0
            lat, lon = r["lat"], r["lon"]
            
            for other in reports:
                if r["id"] == other["id"]:
                    continue
                # Haversine check
                try:
                    dist = _haversine_km(lat, lon, other["lat"], other["lon"])
                    if dist <= radius_km:
                        neighbors += 1
                except:
                    pass
            
            # Density score: 5 neighbors => ~0.8
            # score = 1.0 - math.exp(-count / 3.0)
            density_score = 1.0 - math.exp(-neighbors / 3.0)
            density_score = max(0.0, min(1.0, float(density_score)))
            
            # Compute fused risk
            ml_conf = r["ml_confidence"] or 0.85
            sat_score = 0.2 # Default conservative
            
            fused_risk = (ml_conf * 0.55) + (density_score * 0.35) + (sat_score * 0.10)
            fused_risk = max(0.0, min(1.0, fused_risk))
            
            conn.execute(
                "UPDATE reports SET report_density = ?, fused_risk = ? WHERE id = ?",
                (density_score, fused_risk, r["id"])
            )
            updated_count += 1
            
        conn.commit()
        return updated_count
    finally:
        conn.close()

def insert_report(values: Dict[str, Any]) -> Dict[str, Any]:
    init_db()

    conn = get_conn()
    try:
        cols = sorted(values.keys())
        placeholders = ",".join(["?"] * len(cols))
        sql = f"INSERT INTO reports({','.join(cols)}) VALUES ({placeholders})"
        cur = conn.execute(sql, [values[c] for c in cols])
        report_id = int(cur.lastrowid)
        conn.commit()

        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        assert row is not None
        return _row_to_report_dict(row)
    finally:
        conn.close()


def get_report(report_id: int) -> Optional[Dict[str, Any]]:
    init_db()
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (int(report_id),)).fetchone()
        return _row_to_report_dict(row) if row else None
    finally:
        conn.close()


def list_nearby_reports(
    lat: float,
    lon: float,
    *,
    radius_km: float = 5.0,
    days: int = 30,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    init_db()

    cutoff = (datetime.utcnow() - timedelta(days=days)).replace(microsecond=0).isoformat() + "Z"
    min_lat, max_lat, min_lon, max_lon = _bounding_box(lat, lon, radius_km)

    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT *
            FROM reports
            WHERE created_at >= ?
              AND lat BETWEEN ? AND ?
              AND lon BETWEEN ? AND ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (cutoff, min_lat, max_lat, min_lon, max_lon, int(limit) * 4),
        ).fetchall()
    finally:
        conn.close()

    # Exact filter + sort by distance
    out: List[Tuple[float, Dict[str, Any]]] = []
    for r in rows:
        try:
            d_km = _haversine_km(lat, lon, float(r["lat"]), float(r["lon"]))
        except Exception:
            continue
        if d_km <= radius_km:
            out.append((d_km, _row_to_report_dict(r)))

    out.sort(key=lambda x: x[0])
    return [x[1] for x in out[: int(limit)]]


def list_user_reports(user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    init_db()
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [_row_to_report_dict(r) for r in rows]
    finally:
        conn.close()

def list_review_queue(*, high_risk_threshold: float = 0.85, limit: int = 100) -> List[Dict[str, Any]]:
    init_db()

    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT *
            FROM reports
            WHERE status = 'pending_review'
               OR (status = 'unverified' AND fused_risk IS NOT NULL AND fused_risk >= ?)
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (float(high_risk_threshold), int(limit)),
        ).fetchall()

        return [_row_to_report_dict(r) for r in rows]
    finally:
        conn.close()


def record_validation(
    *,
    report_id: int,
    expert_email: str,
    decision: str,
    notes: Optional[str],
    confidence: Optional[float] = None,
) -> None:
    init_db()

    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO validations(created_at, report_id, expert_email, reviewer, decision, confidence, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (_utcnow_iso(), int(report_id), expert_email, expert_email, decision, confidence, notes),
        )
        conn.commit()
    finally:
        conn.close()


def update_report_status(report_id: int, status: str) -> Optional[Dict[str, Any]]:
    init_db()

    conn = get_conn()
    try:
        conn.execute("UPDATE reports SET status = ? WHERE id = ?", (status, int(report_id)))
        conn.commit()
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (int(report_id),)).fetchone()
        return _row_to_report_dict(row) if row else None
    finally:
        conn.close()


def utcnow_report_values(
    *,
    lat: float,
    lon: float,
    status: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    reporter_nickname: Optional[str] = None,
    species: Optional[str] = None,
    ml_confidence: Optional[float] = None,
    is_invasive: Optional[bool] = None,
    photo_path: Optional[str] = None,
    photo_url: Optional[str] = None,
    notes: Optional[str] = None,
    description: Optional[str] = None,
    photo_quality: Optional[float] = None,
    recommended_action: Optional[str] = None,
    fused_components: Optional[Dict[str, Any]] = None,
    fused_reasons: Optional[List[Dict[str, Any]]] = None,
    needs_more_info_message: Optional[str] = None,
    needs_more_info_requested_photos: Optional[List[str]] = None,
    ndvi_recent: Optional[float] = None,
    ndvi_baseline: Optional[float] = None,
    ndvi_change: Optional[float] = None,
    ndvi_anomaly: Optional[bool] = None,
    landcover_recent: Optional[Dict[str, Any]] = None,
    landcover_baseline: Optional[Dict[str, Any]] = None,
    landcover_shift: Optional[float] = None,
    report_density: Optional[float] = None,
    satellite_score: Optional[float] = None,
    fused_risk: Optional[float] = None,
    topk: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    return {
        "created_at": _utcnow_iso(),
        "user_id": user_id,
        "user_email": user_email,
        "reporter_nickname": reporter_nickname,
        "lat": float(lat),
        "lon": float(lon),
        "species": species,
        "ml_confidence": ml_confidence,
        "is_invasive": 1 if is_invasive else 0 if is_invasive is not None else None,
        "photo_path": photo_path,
        "photo_url": photo_url,
        "notes": notes,
        "description": description,
        "photo_quality": photo_quality,
        "recommended_action": recommended_action,
        "fused_components_json": json.dumps(fused_components) if fused_components is not None else None,
        "fused_reasons_json": json.dumps(fused_reasons) if fused_reasons is not None else None,
        "needs_more_info_message": needs_more_info_message,
        "needs_more_info_requested_photos_json": json.dumps(needs_more_info_requested_photos)
        if needs_more_info_requested_photos is not None
        else None,
        "status": status,
        "ndvi_recent": ndvi_recent,
        "ndvi_baseline": ndvi_baseline,
        "ndvi_change": ndvi_change,
        "ndvi_anomaly": 1 if ndvi_anomaly else 0 if ndvi_anomaly is not None else None,
        "landcover_recent_json": json.dumps(landcover_recent) if landcover_recent is not None else None,
        "landcover_baseline_json": json.dumps(landcover_baseline) if landcover_baseline is not None else None,
        "landcover_shift": landcover_shift,
        "report_density": report_density,
        "satellite_score": satellite_score,
        "fused_risk": fused_risk,
        "topk_json": json.dumps(topk) if topk is not None else None,
    }
