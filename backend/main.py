from __future__ import annotations

import io
import os
import threading
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from backend.bioclip import BioClipClassifier
from backend.earthengine import get_ndvi_change
from backend.exif_utils import extract_gps_from_image, fetch_species_info

# Load backend/.env (optional)
_env_dir = Path(__file__).resolve().parent
load_dotenv(_env_dir / ".env")
load_dotenv(_env_dir / ".env.local")

app = FastAPI(title="Alien Buster ML API", version="0.1.0")

# For local dev you can run the Vite app on a different origin.
# If you use the Vite dev proxy (/api -> :8000), CORS won't matter.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

classifier = BioClipClassifier()

_MODEL_STATE = {
    "loading": False,
    "loaded": False,
    "error": None,
}


def _warmup_model() -> None:
    _MODEL_STATE["loading"] = True
    _MODEL_STATE["error"] = None
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
    # Warm up in background so the server starts immediately.
    threading.Thread(target=_warmup_model, daemon=True).start()


@app.get("/health")
def health():
    return {"ok": True, "model": _MODEL_STATE}


@app.get("/api/health")
def api_health():
    return health()


@app.post("/api/ndvi")
async def ndvi(
    lat: float = Form(...),
    lon: float = Form(...),
):
    ee_project = os.getenv("EARTH_ENGINE_PROJECT") or "alien-buster"

    result = get_ndvi_change(
        lat,
        lon,
        project=ee_project,
        end_date=os.getenv("EARTH_ENGINE_END_DATE"),
    )

    return {
        "mean": result.mean_ndvi,
        "evi": result.mean_evi,
        "change": result.change_from_baseline,
        "anomaly": result.anomaly,
        "satellite_score": result.satellite_score,
        "status": result.status,
    }


class SatelliteAnalyzeRequest(BaseModel):
    lat: float
    lon: float
    species: Optional[str] = None
    is_invasive: Optional[bool] = None  # optional hint from frontend


@app.post("/api/satellite-analyze")
async def satellite_analyze(payload: SatelliteAnalyzeRequest):
    """Wrapper around NDVI that also returns simple correlation messaging."""

    # TODO: Integrate richer Google Earth Engine layers and return a real NDVI overlay tile URL.

    ee_project = os.getenv("EARTH_ENGINE_PROJECT") or "alien-buster"
    result = get_ndvi_change(
        payload.lat,
        payload.lon,
        project=ee_project,
        end_date=os.getenv("EARTH_ENGINE_END_DATE"),
    )

    # Correlation logic
    if result.anomaly is None:
        correlation = "unknown"
    else:
        # Only call "high" correlation if we have BOTH an anomaly AND the report is invasive.
        correlation = "high" if (result.anomaly and payload.is_invasive) else "low"

    mean = result.mean_ndvi
    change = result.change_from_baseline
    anomaly = result.anomaly

    message_lines = []
    if isinstance(mean, (int, float)) and isinstance(change, (int, float)):
        message_lines.append(f"NDVI Mean: {mean:.2f} (Change: {change:+.2f})")
    else:
        message_lines.append("NDVI Mean: —")

    if anomaly is True:
        message_lines.append("Anomaly: Yes")
    elif anomaly is False:
        message_lines.append("Anomaly: No")
    else:
        message_lines.append("Anomaly: Unknown")

    if payload.species and correlation == "high":
        message_lines.append(f"High correlation: Possible {payload.species} outbreak detected")

    return {
        "ndvi_mean": result.mean_ndvi,
        "change": result.change_from_baseline,
        "anomaly": result.anomaly,
        "status": result.status,
        "correlation": correlation,
        "message": "\n".join(message_lines),
    }


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

        ndvi = get_ndvi_change(
            lat,
            lon,
            project=ee_project,
            end_date=os.getenv("EARTH_ENGINE_END_DATE"),
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
            "mean": ndvi.mean_ndvi,
            "change": ndvi.change_from_baseline,
            "anomaly": ndvi.anomaly,
            "status": ndvi.status,
        },
    }
