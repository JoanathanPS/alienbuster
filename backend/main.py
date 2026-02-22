from __future__ import annotations

import io
import json
import os
import threading
from pathlib import Path
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from PIL import Image

from backend.bioclip import BioClipClassifier
from backend.satellite import get_satellite_change
from backend.exif_utils import extract_gps_from_image, fetch_species_info
from backend.db import (
    init_db, insert_report, get_report, list_nearby_reports, compute_report_density,
    list_review_queue, record_validation, update_report_status,
    utcnow_report_values, list_user_reports
)
from backend.fusion import calculate_risk
from backend.outbreaks import recompute_outbreaks, list_outbreaks
from backend.tasks import list_tasks, create_task, update_task
from backend.alerts import send_agency_alert, get_playbook
from backend.inat_routes import router as inat_router

from datetime import datetime

# Load env
_env_dir = Path(__file__).resolve().parent
load_dotenv(_env_dir / ".env")
load_dotenv(_env_dir / ".env.local")

app = FastAPI(title="AlienBuster API", version="1.0.0")

def _utcnow_iso():
    return datetime.utcnow().isoformat()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inat_router)

# --- ML Model Management ---
classifier = BioClipClassifier()
_MODEL_STATE = {"loading": False, "loaded": False, "error": None}

def _warmup_model() -> None:
    _MODEL_STATE["loading"] = True
    try:
        classifier.load()
        _MODEL_STATE["loaded"] = True
    except Exception as e:
        _MODEL_STATE["error"] = str(e)
        _MODEL_STATE["loaded"] = False
    finally:
        _MODEL_STATE["loading"] = False

@app.on_event("startup")
def _startup() -> None:
    init_db()
    threading.Thread(target=_warmup_model, daemon=True).start()

# --- Helpers ---
def check_model():
    if not _MODEL_STATE["loaded"]:
        if _MODEL_STATE["error"]:
            raise HTTPException(status_code=500, detail=f"Model error: {_MODEL_STATE['error']}")
        raise HTTPException(status_code=503, detail="Model warming up")

# --- Endpoints ---

@app.get("/health")
def health():
    return {"status": "ok", "model": _MODEL_STATE}

@app.get("/routes")
def list_routes():
    routes = []
    for route in app.routes:
        if hasattr(route, "methods"):
            routes.append({
                "path": route.path,
                "methods": list(route.methods)
            })
    return routes

@app.get("/api/health")
def api_health():
    return health()

# B) Detect
@app.post("/api/identify")
async def identify(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
):
    # If the model is still warming up, return a clear status.
    if not _MODEL_STATE["loaded"]:
        if _MODEL_STATE["error"]:
            raise HTTPException(status_code=500, detail=f"Model failed to load: {_MODEL_STATE['error']}")
        raise HTTPException(status_code=503, detail="Model warming up. Please retry in a few seconds.")

    contents = await file.read()
    
    # Try to extract GPS from EXIF if not provided
    if lat is None or lon is None:
        exif_lat, exif_lon = extract_gps_from_image(contents)
        if exif_lat is not None and exif_lon is not None:
            lat, lon = exif_lat, exif_lon
    
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    result = classifier.classify(image)

    # Fetch species information from Wikipedia
    species_info = fetch_species_info(result.species)

    ndvi = None
    if lat is not None and lon is not None:
        ee_project = os.getenv("EARTH_ENGINE_PROJECT") or "alien-buster"

        ndvi = get_satellite_change(
            lat,
            lon,
            project=ee_project,
            radius_m=1000.0,
        )

    return {
        "species": result.species,
        "confidence": result.confidence,
        "is_invasive": result.is_invasive,
        "raw_label": result.raw_label,
        "species_info": species_info,
        "location": {
            "latitude": lat,
            "longitude": lon,
            "source": "exif" if lat is not None and lon is not None else "manual",
        },
        "ndvi": None
        if ndvi is None
        else {
            "mean": ndvi.get("ndvi_recent"),
            "change": ndvi.get("ndvi_change"),
            "anomaly": ndvi.get("ndvi_anomaly"),
            "status": "ok" if ndvi.get("ok") else (ndvi.get("error") or "unavailable"),
        },
        "best": {
            "species": result.species,
            "label": result.raw_label,
            "confidence": result.confidence,
            "is_invasive": result.is_invasive,
            "status": result.status
        },
        "topk": result.topk
    }

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    # Legacy alias for frontend compatibility if needed
    return await identify(file)
@app.get("/satellite_change")
def satellite_change(lat: float, lon: float, radius_m: float = 1000.0):
    project = os.getenv("EARTH_ENGINE_PROJECT")
    res = get_satellite_change(lat, lon, project=project, radius_m=radius_m)
    return res

# D) Fusion & Reporting
class FuseRequest(BaseModel):
    ml_confidence: float
    is_invasive: bool
    species: str
    lat: float
    lon: float
    reputation: Optional[float] = 0.5
    photo_quality: Optional[float] = 0.5

@app.post("/fuse")
def fuse(req: FuseRequest):
    # Calculate density
    density = compute_report_density(req.lat, req.lon)
    
    # Check satellite (simplified sync call, normally async or cached)
    # For preview, we might skip full EE if it's slow, but let's try
    project = os.getenv("EARTH_ENGINE_PROJECT")
    sat = get_satellite_change(req.lat, req.lon, project=project)
    
    sat_score = 0.2
    if sat.get("ok"):
        # Anomaly => 0.8 base, + shift
        base = 0.8 if sat.get("ndvi_anomaly") else 0.2
        # shift = sat.landcover_shift or 0.0  # Removed from backend
        sat_score = min(1.0, base)
    
    res = calculate_risk(
        ml_confidence=req.ml_confidence,
        is_invasive=req.is_invasive,
        species=req.species,
        report_density=density.score,
        satellite_score=sat_score,
        reputation=req.reputation or 0.5,
        photo_quality=req.photo_quality or 0.5
    )
    
    return res

class CreateReportRequest(BaseModel):
    user_id: str
    lat: float
    lon: float
    species: str
    ml_confidence: float
    is_invasive: bool
    description: Optional[str] = None
    topk: Optional[List[Dict[str, Any]]] = None
    photo_path: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None

@app.post("/report")
def create_report(req: CreateReportRequest, background_tasks: BackgroundTasks):
    # 1. Satellite
    project = os.getenv("EARTH_ENGINE_PROJECT")
    sat = get_satellite_change(req.lat, req.lon, project=project)
    
    sat_score = 0.2
    if sat.get("ok"):
        base = 0.8 if sat.get("ndvi_anomaly") else 0.2
        sat_score = min(1.0, base)
        
    # 2. Density
    density = compute_report_density(req.lat, req.lon)
    
    # 3. Fusion
    risk_res = calculate_risk(
        ml_confidence=req.ml_confidence,
        is_invasive=req.is_invasive,
        species=req.species,
        report_density=density.score,
        satellite_score=sat_score,
        reputation=0.5, # Default
        photo_quality=0.8 if (req.photo_path or req.photo_url) else 0.5
    )
    
    # 4. Status
    status = "unverified"
    if 0.4 < req.ml_confidence < 0.7:
        status = "pending_review"
    if risk_res.risk_score > 0.7:
        status = "pending_review"

    # 5. Insert
    report_data = utcnow_report_values(
        lat=req.lat,
        lon=req.lon,
        status=status,
        user_id=req.user_id,
        species=req.species,
        ml_confidence=req.ml_confidence,
        is_invasive=req.is_invasive,
        photo_path=req.photo_path,
        photo_url=req.photo_url,
        notes=req.notes,
        description=req.description,
        topk=req.topk,
        
        # Satellite
        ndvi_recent=sat.get("ndvi_recent"),
        ndvi_baseline=sat.get("ndvi_baseline"),
        ndvi_change=sat.get("ndvi_change"),
        ndvi_anomaly=sat.get("ndvi_anomaly"),
        landcover_recent=None,
        landcover_baseline=None,
        landcover_shift=None,
        
        # Fusion
        report_density=density.score,
        satellite_score=sat_score,
        fused_risk=risk_res.risk_score,
        fused_components=risk_res.components,
        fused_reasons=risk_res.reasons,
        recommended_action=risk_res.recommended_action
    )
    
    created = insert_report(report_data)
    
    # Trigger outbreak recompute if high risk
    if risk_res.risk_score > 0.75:
        background_tasks.add_task(recompute_outbreaks)

    return created

@app.get("/reports/nearby")
def get_nearby_reports(
    lat: float,
    lon: float,
    radius_km: float = 5.0,
    days: int = 30,
    limit: int = 50
):
    reports = list_nearby_reports(lat, lon, radius_km=radius_km, days=days, limit=limit)
    return {"reports": reports}

@app.get("/my_reports")
def get_my_reports(user_id: str, limit: int = 100):
    return {"reports": list_user_reports(user_id, limit)}

# E) Verification
@app.get("/review_queue")
def get_review_queue(limit: int = 50):
    return list_review_queue(limit=limit)

class ReviewRequest(BaseModel):
    reviewer: str
    decision: str  # verified|rejected|needs_more_info
    notes: Optional[str] = None
    confidence_override: Optional[float] = None

@app.post("/review/{report_id}")
def review_report(report_id: int, req: ReviewRequest):
    record_validation(
        report_id=report_id,
        expert_email=req.reviewer,
        decision=req.decision,
        notes=req.notes,
        confidence_override=req.confidence_override
    )
    
    new_status = "unverified"
    if req.decision == "verified":
        new_status = "verified"
        # TODO: Update reporter reputation +0.05
    elif req.decision == "rejected":
        new_status = "rejected"
        # TODO: Update reporter reputation -0.05
    elif req.decision == "needs_more_info":
        new_status = "needs_more_info"
        
    updated = update_report_status(report_id, new_status)
    return updated

class MoreInfoRequest(BaseModel):
    message: str
    requested_photos: List[str] = []

@app.post("/report/{id}/request_more_info")
def request_more_info(id: int, req: MoreInfoRequest):
    # This would ideally update a specific JSON field. 
    # For now, append to notes or we need to add columns.
    # We added needs_more_info columns in init_db.
    conn = init_db() # Ensure tables
    # Actually we need a specific update function for this.
    # I'll just use raw SQL here for speed or add helper.
    # I added columns `needs_more_info_message` etc in step A.
    # I'll implement a quick update.
    from backend.db import get_conn
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE reports SET status='needs_more_info', needs_more_info_message=?, needs_more_info_requested_photos_json=? WHERE id=?",
            (req.message, json.dumps(req.requested_photos), id)
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "updated"}

# GeoJSON Exports
@app.get("/exports/verified_species.geojson")
def export_geojson():
    # Fetch all verified reports
    from backend.db import get_conn
    conn = get_conn()
    rows = conn.execute("SELECT * FROM reports WHERE status='verified'").fetchall()
    conn.close()
    
    features = []
    for r in rows:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [r["lon"], r["lat"]]
            },
            "properties": {
                "id": r["id"],
                "species": r["species"],
                "risk": r["fused_risk"],
                "date": r["created_at"]
            }
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }

# New GeoJSON Endpoints
@app.get("/geo/reports")
def geo_reports(bbox: Optional[str] = None, limit: int = 2000):
    from backend.db import get_conn
    conn = get_conn()
    try:
        sql = "SELECT id, lat, lon, species, fused_risk, ml_confidence, status, created_at, is_invasive FROM reports"
        params = []
        
        if bbox:
            try:
                min_lon, min_lat, max_lon, max_lat = map(float, bbox.split(","))
                sql += " WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?"
                params.extend([min_lat, max_lat, min_lon, max_lon])
            except ValueError:
                pass # Ignore invalid bbox
        
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        rows = conn.execute(sql, params).fetchall()
        
        features = []
        for r in rows:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [r["lon"], r["lat"]]
                },
                "properties": {
                    "id": r["id"],
                    "species": r["species"],
                    "fused_risk": r["fused_risk"],
                    "ml_confidence": r["ml_confidence"],
                    "status": r["status"],
                    "created_at": r["created_at"],
                    "is_invasive": r["is_invasive"]
                }
            })
            
        return {
            "type": "FeatureCollection",
            "features": features
        }
    finally:
        conn.close()

@app.get("/geo/outbreaks")
def geo_outbreaks(status: Optional[str] = None):
    from backend.db import get_conn
    conn = get_conn()
    try:
        sql = "SELECT id, centroid_lat, centroid_lon, species, radius_km, num_reports, mean_risk, status, updated_at FROM outbreaks"
        params = []
        
        if status:
            statuses = status.split("|")
            placeholders = ",".join(["?"] * len(statuses))
            sql += f" WHERE status IN ({placeholders})"
            params.extend(statuses)
            
        rows = conn.execute(sql, params).fetchall()
        
        features = []
        for r in rows:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [r["centroid_lon"], r["centroid_lat"]]
                },
                "properties": {
                    "id": r["id"],
                    "species": r["species"],
                    "radius_km": r["radius_km"],
                    "num_reports": r["num_reports"],
                    "mean_risk": r["mean_risk"],
                    "status": r["status"],
                    "updated_at": r["updated_at"]
                }
            })
            
        return {
            "type": "FeatureCollection",
            "features": features
        }
    finally:
        conn.close()

@app.get("/reports/{id}")
def get_report_detail(id: int):
    from backend.db import get_report
    report = get_report(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@app.get("/outbreaks/{id}/reports")
def get_outbreak_reports(id: int):
    from backend.db import get_conn, _haversine_km
    conn = get_conn()
    try:
        # Get outbreak details first
        outbreak = conn.execute("SELECT * FROM outbreaks WHERE id = ?", (id,)).fetchone()
        if not outbreak:
            raise HTTPException(status_code=404, detail="Outbreak not found")
            
        # Get reports within radius (approximate first, then exact)
        # We can reuse logic similar to recompute, or just fetch nearby of that species
        # Simplified: fetch recent reports of that species near centroid
        
        # Note: In real app, we might link reports to outbreak_id in a join table.
        # Here we do geospatial query.
        
        lat, lon, radius = outbreak["centroid_lat"], outbreak["centroid_lon"], outbreak["radius_km"]
        # Expand radius slightly for context
        search_radius = max(radius, 5.0) 
        
        rows = conn.execute(
            """
            SELECT id, lat, lon, species, created_at, fused_risk, photo_url 
            FROM reports 
            WHERE species = ? 
            ORDER BY created_at DESC 
            LIMIT 100
            """, 
            (outbreak["species"],)
        ).fetchall()
        
        related = []
        for r in rows:
            dist = _haversine_km(lat, lon, r["lat"], r["lon"])
            if dist <= search_radius:
                related.append(dict(r))
                
        return {"reports": related}
    finally:
        conn.close()

# F) Outbreaks
@app.get("/outbreaks")
def get_outbreaks():
    return list_outbreaks()

@app.post("/outbreaks/recompute")
def trigger_recompute():
    return recompute_outbreaks()

# G) Tasks & Alerts
@app.get("/tasks")
def get_tasks(status: Optional[str] = None, assigned_to: Optional[str] = None):
    return list_tasks(status, assigned_to)

class CreateTaskRequest(BaseModel):
    outbreak_id: Optional[int] = None
    report_id: Optional[int] = None
    assigned_to: str
    agency: str
    priority: str
    notes: Optional[str] = None
    due_at: Optional[str] = None

@app.post("/tasks")
def create_new_task(req: CreateTaskRequest):
    return create_task(
        req.outbreak_id, req.report_id, req.assigned_to, req.agency, req.priority, req.notes, req.due_at
    )

class UpdateTaskRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

@app.post("/tasks/{id}/update")
def update_existing_task(id: int, req: UpdateTaskRequest):
    return update_task(id, req.status, req.notes)

class AgencyAlertRequest(BaseModel):
    to_emails: List[str]
    subject: str
    message_override: Optional[str] = None
    outbreak_id: Optional[int] = None
    report_id: Optional[int] = None
    species_type: str = "plant"

@app.post("/alerts/agency")
def send_alert_endpoint(req: AgencyAlertRequest):
    body = req.message_override or ""
    if not body:
        playbook = get_playbook(req.species_type)
        body = f"Agency Alert.\n\nPlaybook:\n{playbook}"
        
    success = send_agency_alert(req.to_emails, req.subject, body)
    return {"success": success}

@app.get("/alerts/preview")
def preview_alert(species_type: str = "plant"):
    return {"subject": "[ALIENBUSTER ALERT] Outbreak Detected", "body": get_playbook(species_type)}

# H) Aggregated Stats
@app.get("/stats/overview")
def stats_overview():
    from backend.db import get_conn
    conn = get_conn()
    try:
        reports_total = conn.execute("SELECT COUNT(*) FROM reports").fetchone()[0]
        
        today = _utcnow_iso()[:10]
        reports_today = conn.execute("SELECT COUNT(*) FROM reports WHERE created_at LIKE ?", (f"{today}%",)).fetchone()[0]
        
        outbreaks_active = conn.execute("SELECT COUNT(*) FROM outbreaks WHERE status IN ('investigating', 'confirmed')").fetchone()[0]
        high_risk = conn.execute("SELECT COUNT(*) FROM outbreaks WHERE mean_risk >= 0.8").fetchone()[0]
        
        tasks_open = conn.execute("SELECT COUNT(*) FROM tasks WHERE status='open'").fetchone()[0]
        tasks_progress = conn.execute("SELECT COUNT(*) FROM tasks WHERE status='in_progress'").fetchone()[0]
        tasks_resolved = conn.execute("SELECT COUNT(*) FROM tasks WHERE status='resolved'").fetchone()[0]
        
        return {
            "reports_total": reports_total,
            "reports_today": reports_today,
            "outbreaks_active": outbreaks_active,
            "high_risk_outbreaks": high_risk,
            "tasks_open": tasks_open,
            "tasks_in_progress": tasks_progress,
            "tasks_resolved": tasks_resolved,
            "alerts_sent": 12 # Placeholder or add tracking table
        }
    finally:
        conn.close()

@app.get("/stats/top_species")
def stats_top_species(limit: int = 8):
    from backend.db import get_conn
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT species, COUNT(*) as count, AVG(fused_risk) as mean_risk
            FROM reports
            WHERE is_invasive = 1
            GROUP BY species
            ORDER BY count DESC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

@app.get("/stats/task_status_distribution")
def stats_task_dist():
    from backend.db import get_conn
    conn = get_conn()
    try:
        rows = conn.execute("SELECT status, COUNT(*) as count FROM tasks GROUP BY status").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

@app.post("/tasks/auto_from_outbreaks")
def trigger_auto_tasks():
    from backend.tasks import auto_create_tasks_from_outbreaks
    count = auto_create_tasks_from_outbreaks()
    return {"created": count}

