from __future__ import annotations

import math
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple


_BACKEND_DIR = Path(__file__).resolve().parent
_DEFAULT_DB = (_BACKEND_DIR / "local_reports.sqlite").resolve()


def _db_path() -> Path:
    p = os.getenv("LOCAL_REPORTS_DB")
    if p:
        return Path(p).expanduser().resolve()
    return _DEFAULT_DB


def _init_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_at TEXT NOT NULL,
          lat REAL NOT NULL,
          lon REAL NOT NULL
        );
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at);")


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def record_report(lat: float, lon: float, created_at: Optional[datetime] = None) -> None:
    ts = (created_at or datetime.utcnow()).isoformat()

    db = _db_path()
    db.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db))
    try:
        _init_db(conn)
        conn.execute("INSERT INTO reports(created_at, lat, lon) VALUES (?, ?, ?)", (ts, float(lat), float(lon)))
        conn.commit()
    finally:
        conn.close()


def compute_report_density(
    lat: float,
    lon: float,
    *,
    radius_km: float = 2.0,
    window_days: int = 14,
) -> Tuple[int, float]:
    """Return (count, density_score in 0..1).

    We count reports in last N days and within radius, then map count -> 0..1.
    """

    db = _db_path()
    if not db.exists():
        return 0, 0.0

    cutoff = (datetime.utcnow() - timedelta(days=window_days)).isoformat()

    conn = sqlite3.connect(str(db))
    try:
        _init_db(conn)
        rows = conn.execute(
            "SELECT lat, lon FROM reports WHERE created_at >= ?",
            (cutoff,),
        ).fetchall()
    finally:
        conn.close()

    count = 0
    for rlat, rlon in rows:
        try:
            if _haversine_km(float(lat), float(lon), float(rlat), float(rlon)) <= radius_km:
                count += 1
        except Exception:
            continue

    # Saturating mapping: 0 -> 0.0, 1 -> 0.2, 3 -> 0.5, 6+ -> ~1.0
    density_score = 1.0 - math.exp(-count / 3.0)
    density_score = max(0.0, min(1.0, density_score))

    return count, float(density_score)
