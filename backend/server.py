from __future__ import annotations

import io
import os
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

import numpy as np
import torch
import open_clip
from open_clip.factory import create_model_from_pretrained

from backend.alerts import RiskAlertRequest, compute_risk_score, maybe_send_risk_email
from backend.db import (
    compute_report_density,
    get_report,
    init_db,
    insert_report,
    list_nearby_reports,
    list_review_queue,
    record_validation,
    update_report_status,
    utcnow_report_values,
)
from backend.models import (
    AlertPreviewResponse,
    ReportCreateRequest,
    ReportRow,
    ReportsNearbyResponse,
    ReviewDecisionRequest,
    ReviewDecisionResponse,
    ReviewQueueResponse,
    SatelliteChangeResponse,
)
from backend.satellite import SatelliteUnavailable, get_satellite_change


_BACKEND_DIR = Path(__file__).resolve().parent
# Load backend/.env (optional) for local development
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR / ".env.local")

app = FastAPI(title="Alien Buster Local Backend", version="0.2.0")


@app.on_event("startup")
def _startup() -> None:
    # Ensure SQLite schema exists.
    init_db()

# CORS for local dev (Vite on 8080)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


INVASIVE_SPECIES: List[str] = [
    "kudzu",
    "lantana camara",
    "water hyacinth",
    "purple loosestrife",
    "japanese knotweed",
    "english ivy",
    "garlic mustard",
    "cheatgrass",
    "tamarisk",
    "common buckthorn",
    "burmese python",
    "cane toad",
    "zebra mussel",
    "emerald ash borer",
    "asian carp",
    "feral pig",
    "lionfish",
    "european starling",
    "brown tree snake",
    "nutria",
    "red imported fire ant",
    "argentine ant",
    "fallow deer",
]

NEGATIVE_LABELS: List[str] = [
    "a native plant",
    "a native animal",
    "unknown organism",
]

PROMPT_TEMPLATES: List[str] = [
    "a photo of {x}",
    "a close-up photo of {x}",
    "a field photo of {x}",
    "a photo of {x} in nature",
]


class DetectResponse(BaseModel):
    species: str
    confidence: float
    is_invasive: bool
    label: str


_MODEL: Dict[str, object] = {
    "loaded": False,
    "device": None,
    "model": None,
    "preprocess": None,
    "tokenizer": None,
    "text_features": None,
    "prompt_to_base": None,
    "base_labels": None,
    "prompts": None,
}


def _get_device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def _resolve_bioclip_weights_path() -> Path:
    bin_path = os.getenv("BIOCLIP_BIN")
    if bin_path:
        p = Path(bin_path)
        if not p.exists():
            raise RuntimeError(f"BIOCLIP_BIN points to missing file: {p}")
        return p

    local = os.getenv("BIOCLIP_LOCAL") or "backend/models/open_clip_pytorch_model.bin"
    p = Path(local)
    if not p.is_absolute():
        # resolve relative to repo root (parent of backend dir)
        repo_root = _BACKEND_DIR.parent
        p = (repo_root / p).resolve()

    if not p.exists():
        raise RuntimeError(
            "BioCLIP weights not found. Set BIOCLIP_BIN to an absolute path, or put weights at "
            f"{p} and set BIOCLIP_LOCAL accordingly."
        )

    return p


def _load_model_if_needed() -> None:
    if _MODEL.get("loaded"):
        return

    weights_path = _resolve_bioclip_weights_path()

    # Optional override for model architecture.
    # If your .bin doesn't match the default, set BIOCLIP_MODEL_NAME.
    model_name = os.getenv("BIOCLIP_MODEL_NAME") or "ViT-B-16"

    device = _get_device()

    try:
        model, preprocess = create_model_from_pretrained(
            model_name,
            pretrained=str(weights_path),
            device=device,
            precision="fp32",
            return_transform=True,
        )
    except Exception as e:
        raise RuntimeError(
            "Failed to load BioCLIP weights from local file. "
            "Double-check BIOCLIP_BIN/BIOCLIP_LOCAL and BIOCLIP_MODEL_NAME. "
            f"Details: {e}"
        )

    tokenizer = open_clip.get_tokenizer(model_name)

    base_labels = INVASIVE_SPECIES + NEGATIVE_LABELS

    prompts: List[str] = []
    prompt_to_base: List[int] = []
    for i, base in enumerate(base_labels):
        for t in PROMPT_TEMPLATES:
            prompts.append(t.format(x=base))
            prompt_to_base.append(i)

    with torch.no_grad():
        text_tokens = tokenizer(prompts).to(device)
        text_features = model.encode_text(text_tokens)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    _MODEL.update(
        {
            "loaded": True,
            "device": device,
            "model": model,
            "preprocess": preprocess,
            "tokenizer": tokenizer,
            "text_features": text_features,
            "prompt_to_base": prompt_to_base,
            "base_labels": base_labels,
            "prompts": prompts,
        }
    )


def _classify_image(image: Image.Image) -> Tuple[str, float, str]:
    """Returns (base_label, confidence, top_prompt)."""

    _load_model_if_needed()

    model = _MODEL["model"]
    preprocess = _MODEL["preprocess"]
    device = _MODEL["device"]
    text_features = _MODEL["text_features"]
    prompt_to_base = _MODEL["prompt_to_base"]
    base_labels = _MODEL["base_labels"]
    prompts = _MODEL["prompts"]

    assert model is not None
    assert preprocess is not None
    assert device is not None
    assert text_features is not None
    assert prompt_to_base is not None
    assert base_labels is not None
    assert prompts is not None

    image_input = preprocess(image).unsqueeze(0).to(device)

    with torch.no_grad():
        image_features = model.encode_image(image_input)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        # Similarity -> softmax probabilities over prompts
        logits = (100.0 * image_features @ text_features.T)[0]
        probs = logits.softmax(dim=-1)  # already 0..1

    probs_np = probs.detach().cpu().numpy().astype(np.float64)

    # Aggregate prompt probabilities back to base label
    base_scores = np.zeros((len(base_labels),), dtype=np.float64)
    for p_idx, base_idx in enumerate(prompt_to_base):
        base_scores[int(base_idx)] += probs_np[p_idx]

    best_base_idx = int(base_scores.argmax())
    best_base = str(base_labels[best_base_idx])
    confidence = float(base_scores[best_base_idx])

    # Also track the best individual prompt for debugging
    best_prompt_idx = int(probs_np.argmax())
    best_prompt = str(prompts[best_prompt_idx])

    return best_base, confidence, best_prompt




@app.get("/health")
def health():
    return {"ok": True, "device": _get_device(), "db": "sqlite", "version": app.version}


@app.post("/detect", response_model=DetectResponse)
async def detect(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="Missing file")

    try:
        raw = await file.read()
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image")

    try:
        base_label, confidence, top_prompt = _classify_image(img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    base_norm = base_label.strip().lower()
    is_invasive = base_norm in {s.lower() for s in INVASIVE_SPECIES}

    # Friendly species string
    species = base_label.title() if is_invasive else "Unknown"

    # Optional: compute density-based risk and maybe send email
    # Only if lat/lon exist in query (not required by the spec).
    # Keeping this lightweight and safe by default.

    return DetectResponse(
        species=species,
        confidence=float(confidence),
        is_invasive=bool(is_invasive),
        label=str(top_prompt),
    )


@app.get("/satellite")
def satellite(lat: float = Query(...), lon: float = Query(...)):
    """Backwards compatible endpoint used by existing UI cards."""

    try:
        resp = get_satellite_change(float(lat), float(lon), radius_m=1000)
    except SatelliteUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {
        "recent_ndvi": resp.get("recent_ndvi"),
        "baseline_ndvi": resp.get("baseline_ndvi"),
        "change": resp.get("change"),
        "anomaly": resp.get("anomaly"),
        "recent_window": resp.get("recent_window"),
        "baseline_window": resp.get("baseline_window"),
    }


@app.post("/risk_alert")
def risk_alert(payload: RiskAlertRequest):
    risk_score = compute_risk_score(payload)
    sent, reason, recipients = maybe_send_risk_email(payload, risk_score)

    threshold = float(os.getenv("ALERT_RISK_THRESHOLD") or 0.75)

    return {
        "risk_score": round(float(risk_score), 4),
        "threshold": threshold,
        "sent": bool(sent),
        "reason": reason,
        "recipients": recipients,
    }


@app.get("/satellite_change", response_model=SatelliteChangeResponse)
def satellite_change(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_m: int = Query(1000, ge=100, le=10_000),
):
    try:
        return get_satellite_change(float(lat), float(lon), radius_m=int(radius_m))
    except SatelliteUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))


def _satellite_score(*, anomaly: Optional[bool], landcover_shift: Optional[float]) -> float:
    base = 0.8 if anomaly is True else 0.2
    shift_component = 0.6 * float(landcover_shift or 0.0)
    return float(max(0.0, min(1.0, base + shift_component)))


@app.post("/report", response_model=ReportRow)
def create_report(payload: ReportCreateRequest):
    # Satellite
    try:
        sat = get_satellite_change(payload.lat, payload.lon, radius_m=int(payload.radius_m))
    except SatelliteUnavailable:
        # Still create the report; satellite fields remain null.
        sat = {
            "recent_ndvi": None,
            "baseline_ndvi": None,
            "change": None,
            "anomaly": None,
            "landcover_recent": None,
            "landcover_baseline": None,
            "landcover_shift": None,
        }

    # Ground clustering density (invasive-only)
    density = compute_report_density(payload.lat, payload.lon, radius_km=2.0, window_days=14)

    satellite_score = _satellite_score(anomaly=sat.get("anomaly"), landcover_shift=sat.get("landcover_shift"))

    fused_risk = (
        float(payload.ml_confidence) * 0.4
        + float(density.score) * 0.3
        + float(satellite_score) * 0.3
    )
    fused_risk = float(max(0.0, min(1.0, fused_risk)))

    # Status logic
    status: str
    if 0.4 < float(payload.ml_confidence) < 0.7:
        status = "pending_review"
    else:
        status = "unverified"

    values = utcnow_report_values(
        lat=payload.lat,
        lon=payload.lon,
        status=status,
        user_id=payload.user_id,
        user_email=payload.user_email,
        reporter_nickname=payload.reporter_nickname,
        species=payload.species,
        ml_confidence=float(payload.ml_confidence),
        is_invasive=bool(payload.is_invasive),
        photo_url=payload.photo_url,
        notes=payload.notes,
        ndvi_recent=sat.get("recent_ndvi"),
        ndvi_baseline=sat.get("baseline_ndvi"),
        ndvi_change=sat.get("change"),
        ndvi_anomaly=sat.get("anomaly"),
        landcover_recent=sat.get("landcover_recent"),
        landcover_baseline=sat.get("landcover_baseline"),
        landcover_shift=sat.get("landcover_shift"),
        report_density=float(density.score),
        satellite_score=float(satellite_score),
        fused_risk=float(fused_risk),
    )

    # Remove None values so sqlite uses NULL cleanly
    values = {k: v for k, v in values.items() if v is not None}

    created = insert_report(values)
    return created


@app.get("/reports/nearby", response_model=ReportsNearbyResponse)
def reports_nearby(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(5.0, ge=0.1, le=50.0),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
):
    reports = list_nearby_reports(float(lat), float(lon), radius_km=float(radius_km), days=int(days), limit=int(limit))
    return {"reports": reports}


@app.get("/review_queue", response_model=ReviewQueueResponse)
def review_queue(limit: int = Query(100, ge=1, le=500)):
    return {"reports": list_review_queue(limit=int(limit))}


@app.post("/review/{report_id}", response_model=ReviewDecisionResponse)
def review(report_id: int, payload: ReviewDecisionRequest):
    # Update report status
    if payload.decision == "verified":
        new_status = "verified"
    elif payload.decision == "rejected":
        new_status = "rejected"
    else:
        new_status = "pending_review"

    updated = update_report_status(int(report_id), new_status)
    if not updated:
        raise HTTPException(status_code=404, detail="Report not found")

    record_validation(
        report_id=int(report_id),
        expert_email=payload.expert_email,
        decision=payload.decision,
        notes=payload.notes,
    )

    return {"ok": True, "report": updated}


@app.get("/alerts/preview", response_model=AlertPreviewResponse)
def alerts_preview(report_id: int = Query(...)):
    report = get_report(int(report_id))
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    threshold = float(os.getenv("ALERT_RISK_THRESHOLD") or 0.75)
    recipients = [x.strip() for x in (os.getenv("ALERT_RECIPIENTS") or "").split(",") if x.strip()]

    species = report.get("species") or "Unknown species"
    risk = report.get("fused_risk")
    risk_str = f"{float(risk):.2f}" if isinstance(risk, (int, float)) else "—"

    subject = f"Alien Buster Alert: {species} (risk {risk_str})"

    body_lines = [
        f"Report ID: {report.get('id')}",
        f"Created: {report.get('created_at')}",
        f"Status: {report.get('status')}",
        "",
        f"Species: {species}",
        f"Location: ({report.get('lat')}, {report.get('lon')})",
        "",
        f"Fused risk: {risk_str} (threshold {threshold:.2f})",
        f"ML confidence: {float(report.get('ml_confidence') or 0.0):.2f}",
        f"Report density: {float(report.get('report_density') or 0.0):.2f}",
        f"Satellite score: {float(report.get('satellite_score') or 0.0):.2f}",
    ]

    if report.get("ndvi_change") is not None:
        body_lines += ["", f"NDVI change (recent - baseline): {float(report.get('ndvi_change')):+.3f}"]

    if report.get("landcover_shift") is not None:
        body_lines += [f"Landcover shift: {float(report.get('landcover_shift')):.3f}"]

    notes = (report.get("notes") or "").strip()
    if notes:
        body_lines += ["", "Notes:", notes]

    return {
        "report_id": int(report_id),
        "subject": subject,
        "body": "\n".join(body_lines),
        "recipients": recipients,
        "threshold": threshold,
    }
