from __future__ import annotations

from dataclasses import dataclass
import datetime as _dt
from typing import Optional, Tuple


@dataclass(frozen=True)
class NdviResult:
    mean_ndvi: Optional[float]
    mean_evi: Optional[float]
    change_from_baseline: Optional[float]
    anomaly: Optional[bool]
    satellite_score: float  # 0.0 to 1.0 risk score
    status: str


_EE_INIT: Tuple[bool, str] | None = None


def _try_init_ee(project: Optional[str]) -> Tuple[bool, str]:
    global _EE_INIT
    if _EE_INIT is not None:
        return _EE_INIT

    try:
        import ee  # type: ignore

        # If the user already authenticated (ee.Authenticate), this should work.
        if project:
            ee.Initialize(project=project)
        else:
            ee.Initialize()

        _EE_INIT = (True, "ok")
        return _EE_INIT
    except Exception as e:
        # Common failures:
        # - "no project found" (needs ee.Initialize(project=...))
        # - auth errors (needs ee.Authenticate())
        _EE_INIT = (False, str(e))
        return _EE_INIT


def get_ndvi_change(
    lat: float,
    lon: float,
    *,
    project: Optional[str] = None,
    start_date: str = "2024-01-01",
    end_date: Optional[str] = None,
    radius_km: float = 1.0,
    baseline: float = 0.55,
    window_days: int = 60,  # Shorter window for Sentinel-2
    baseline_years: int = 1,
) -> NdviResult:
    """Best-effort NDVI/EVI mean + anomaly calculation using Sentinel-2 (10m resolution).

    Returns status='unavailable' if Earth Engine isn't configured.
    """

    ok, status = _try_init_ee(project)
    if not ok:
        return NdviResult(
            mean_ndvi=None,
            mean_evi=None,
            change_from_baseline=None,
            anomaly=None,
            satellite_score=0.0,
            status=f"unavailable ({status[:120]})",
        )

    import ee  # type: ignore

    try:
        point = ee.Geometry.Point(lon, lat)
        buffer = point.buffer(radius_km * 1000)

        # Earth Engine filterDate expects an end date; default to today.
        end_date_resolved = end_date or _dt.date.today().isoformat()
        end_dt = _dt.date.fromisoformat(end_date_resolved)

        current_start_dt = end_dt - _dt.timedelta(days=window_days)
        current_start = current_start_dt.isoformat()

        baseline_start_dt = current_start_dt - _dt.timedelta(days=365 * baseline_years)
        baseline_end_dt = end_dt - _dt.timedelta(days=365 * baseline_years)
        baseline_start = baseline_start_dt.isoformat()
        baseline_end = baseline_end_dt.isoformat()

        def add_indices(img):
            # Sentinel-2: B8=NIR, B4=Red, B2=Blue
            ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
            evi = img.expression(
                "2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))",
                {
                    "NIR": img.select("B8"),
                    "RED": img.select("B4"),
                    "BLUE": img.select("B2"),
                },
            ).rename("EVI")
            return img.addBands([ndvi, evi])

        def get_stats_for_range(date_start: str, date_end: str) -> dict:
            # Use Sentinel-2 Harmonized (Level-2A)
            coll = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(buffer)
                .filterDate(date_start, date_end)
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            )
            processed = coll.map(add_indices)
            
            # Reduce region to get mean NDVI and EVI
            stats = processed.mean().reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=buffer,
                scale=10,  # 10m resolution for Sentinel-2
                maxPixels=1e9
            ).getInfo() or {}
            
            return {
                "NDVI": float(stats.get("NDVI")) if stats.get("NDVI") is not None else None,
                "EVI": float(stats.get("EVI")) if stats.get("EVI") is not None else None
            }

        current_stats = get_stats_for_range(current_start, end_date_resolved)
        current_ndvi = current_stats["NDVI"]
        current_evi = current_stats["EVI"]

        if current_ndvi is None:
            return NdviResult(None, None, None, None, 0.0, "no recent data (clouds or coverage)")

        baseline_stats = get_stats_for_range(baseline_start, baseline_end)
        baseline_ndvi = baseline_stats["NDVI"]

        # If no baseline history, assume standard baseline
        if baseline_ndvi is None:
            change = current_ndvi - baseline
            status_msg = "ok (no baseline window; used constant baseline)"
        else:
            change = current_ndvi - baseline_ndvi
            status_msg = "ok"

        # Anomaly detection logic
        # Negative change means vegetation loss (potential outbreak die-off or clearing)
        # Positive change might mean rapid growth (invasive spread like Kudzu)
        # We flag SIGNIFICANT changes.
        
        is_anomaly = abs(change) > 0.15
        
        # Risk score calculation (0.0 - 1.0)
        # 0.5 is neutral. > 0.5 is growth/spread risk. < 0.5 is loss risk.
        # We normalize 'change' to a 0-1 score where 1.0 is severe change.
        risk_magnitude = min(abs(change) * 3.0, 1.0)  # scale factor
        
        return NdviResult(
            mean_ndvi=current_ndvi,
            mean_evi=current_evi,
            change_from_baseline=change,
            anomaly=is_anomaly,
            satellite_score=risk_magnitude,
            status=status_msg
        )
    except Exception as e:
        return NdviResult(None, None, None, None, 0.0, f"error: {str(e)[:80]}")

