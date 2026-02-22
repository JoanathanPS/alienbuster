from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class Window(BaseModel):
    start: str
    end: str


class NdviTimeseriesPoint(BaseModel):
    date: str
    ndvi: Optional[float] = None


class LandcoverClass(BaseModel):
    name: str
    probability: float = Field(ge=0.0, le=1.0)


class LandcoverSummary(BaseModel):
    top_classes: List[LandcoverClass]
    probs: Dict[str, float]


class SatelliteChangeResponse(BaseModel):
    radius_m: int
    recent_window: Window
    baseline_window: Window

    recent_ndvi: Optional[float] = None
    baseline_ndvi: Optional[float] = None
    change: Optional[float] = None
    anomaly: Optional[bool] = None

    ndvi_timeseries: List[NdviTimeseriesPoint]

    landcover_recent: Optional[LandcoverSummary] = None
    landcover_baseline: Optional[LandcoverSummary] = None
    landcover_shift: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class ReportCreateRequest(BaseModel):
    lat: float
    lon: float

    species: Optional[str] = None
    ml_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    is_invasive: bool = False

    # Metadata (optional)
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    reporter_nickname: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None

    # Analysis controls
    radius_m: int = Field(default=1000, ge=100, le=10_000)


ReportStatus = Literal["unverified", "pending_review", "verified", "rejected"]


class ReportRow(BaseModel):
    id: int
    created_at: str

    user_id: Optional[str] = None
    user_email: Optional[str] = None
    reporter_nickname: Optional[str] = None

    lat: float
    lon: float

    species: Optional[str] = None
    ml_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    is_invasive: Optional[bool] = None

    photo_url: Optional[str] = None
    notes: Optional[str] = None

    status: ReportStatus

    ndvi_recent: Optional[float] = None
    ndvi_baseline: Optional[float] = None
    ndvi_change: Optional[float] = None
    ndvi_anomaly: Optional[bool] = None

    landcover_recent: Optional[Dict[str, Any]] = None
    landcover_baseline: Optional[Dict[str, Any]] = None
    landcover_shift: Optional[float] = None

    report_density: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    satellite_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    fused_risk: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class ReportsNearbyResponse(BaseModel):
    reports: List[ReportRow]


class ReviewQueueResponse(BaseModel):
    reports: List[ReportRow]


ReviewDecision = Literal["verified", "rejected", "needs_more_info"]


class ReviewDecisionRequest(BaseModel):
    decision: ReviewDecision
    expert_email: str
    notes: Optional[str] = None


class ReviewDecisionResponse(BaseModel):
    ok: bool
    report: ReportRow


class AlertPreviewResponse(BaseModel):
    report_id: int
    subject: str
    body: str
    recipients: List[str]
    threshold: float


class ApiError(BaseModel):
    detail: str
