from __future__ import annotations

import datetime as _dt
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from backend.earthengine import _try_init_ee


@dataclass(frozen=True)
class SatelliteResult:
    recent_window: List[str]
    baseline_window: List[str]
    ndvi_recent: Optional[float]
    ndvi_baseline: Optional[float]
    ndvi_change: Optional[float]
    ndvi_anomaly: Optional[bool]
    ndvi_timeseries: List[Dict[str, Any]]
    landcover_recent: Optional[Dict[str, Any]]
    landcover_baseline: Optional[Dict[str, Any]]
    landcover_shift: Optional[float]
    status: str


def get_satellite_change(
    lat: float,
    lon: float,
    *,
    project: Optional[str] = None,
    radius_m: float = 1000.0,
) -> SatelliteResult:
    ok, status = _try_init_ee(project)
    if not ok:
        return SatelliteResult(
            recent_window=[], baseline_window=[], ndvi_recent=None, ndvi_baseline=None,
            ndvi_change=None, ndvi_anomaly=None, ndvi_timeseries=[],
            landcover_recent=None, landcover_baseline=None, landcover_shift=None,
            status=f"unavailable ({status[:120]})"
        )

    import ee

    try:
        point = ee.Geometry.Point(lon, lat)
        buffer = point.buffer(radius_m)

        today = _dt.date.today()
        recent_end = today
        recent_start = today - _dt.timedelta(days=45)
        
        baseline_end = recent_end - _dt.timedelta(days=365)
        baseline_start = recent_start - _dt.timedelta(days=365)

        recent_window = [recent_start.isoformat(), recent_end.isoformat()]
        baseline_window = [baseline_start.isoformat(), baseline_end.isoformat()]

        # 1. NDVI (Sentinel-2)
        def add_ndvi(img):
            ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
            return img.addBands(ndvi).copyProperties(img, ["system:time_start"])

        def get_ndvi_mean(start, end):
            coll = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(buffer)
                .filterDate(start.isoformat(), end.isoformat())
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
                .map(add_ndvi)
            )
            val = coll.select("NDVI").mean().reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=buffer,
                scale=10,
                maxPixels=1e9
            ).get("NDVI").getInfo()
            return val

        ndvi_recent = get_ndvi_mean(recent_start, recent_end)
        ndvi_baseline = get_ndvi_mean(baseline_start, baseline_end)
        
        ndvi_change = None
        ndvi_anomaly = None
        if ndvi_recent is not None and ndvi_baseline is not None:
            ndvi_change = ndvi_recent - ndvi_baseline
            # Anomaly if change < -0.15 (loss) or > 0.15 (rapid growth)
            ndvi_anomaly = abs(ndvi_change) > 0.15

        # 2. NDVI Timeseries (Last 180 days)
        ts_start = today - _dt.timedelta(days=180)
        ts_coll = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(buffer)
            .filterDate(ts_start.isoformat(), today.isoformat())
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
            .map(add_ndvi)
            .select("NDVI")
        )
        
        # Aggregate by week to reduce points
        # For simplicity in this script, we'll just take raw points and frontend can smooth, 
        # or we return a simplified list. Let's return raw valid points.
        def get_date_val(img):
            date = img.date().format("YYYY-MM-dd")
            val = img.reduceRegion(ee.Reducer.mean(), buffer, 10).get("NDVI")
            return ee.Feature(None, {"date": date, "ndvi": val})

        ts_list = ts_coll.map(get_date_val).filter(ee.Filter.notNull(["ndvi"])).getInfo()
        ndvi_timeseries = [
            {"date": f["properties"]["date"], "ndvi": f["properties"]["ndvi"]} 
            for f in ts_list.get("features", [])
        ]
        ndvi_timeseries.sort(key=lambda x: x["date"])

        # 3. Landcover (Dynamic World)
        # Class names: 0=water, 1=trees, 2=grass, 3=flooded_vegetation, 4=crops, 
        #              5=shrub_and_scrub, 6=built, 7=bare, 8=snow_and_ice
        CLASS_NAMES = ["water", "trees", "grass", "flooded_vegetation", "crops", "shrub_and_scrub", "built", "bare", "snow_and_ice"]

        def get_landcover_stats(start, end):
            # Dynamic World V1
            coll = (
                ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                .filterBounds(buffer)
                .filterDate(start.isoformat(), end.isoformat())
            )
            # Use 'probability' bands. Compute mean probability for each class over the window.
            # Bands are the class names directly? No, usually not in V1 collection directly, wait.
            # Actually DW V1 images have bands matching class names? 
            # Let's check docs assumption. Usually 'water', 'trees', etc. or a 'probs' band.
            # Assuming 'water', 'trees', etc. exist as bands or we use 'label'.
            # Better to use the probability bands if available.
            # The collection has bands corresponding to class names in probability.
            
            # Reduce over time (mean probability)
            mean_img = coll.mean()
            
            # Reduce over region
            stats = mean_img.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=buffer,
                scale=10,
                maxPixels=1e9
            ).getInfo()
            
            if not stats:
                return None

            # Filter only valid class names found in stats
            probs = {k: v for k, v in stats.items() if k in CLASS_NAMES and v is not None}
            if not probs:
                return None
                
            # Normalize just in case
            total = sum(probs.values())
            if total > 0:
                probs = {k: v / total for k, v in probs.items()}
            
            # Top 3
            sorted_classes = sorted(probs.items(), key=lambda x: x[1], reverse=True)
            top_classes = [k for k, v in sorted_classes[:3]]
            
            return {"class_probs": probs, "top_classes": top_classes}

        landcover_recent = get_landcover_stats(recent_start, recent_end)
        landcover_baseline = get_landcover_stats(baseline_start, baseline_end)
        
        landcover_shift = 0.0
        if landcover_recent and landcover_baseline:
            # L1 distance
            r_probs = landcover_recent["class_probs"]
            b_probs = landcover_baseline["class_probs"]
            all_keys = set(r_probs.keys()) | set(b_probs.keys())
            diff = sum(abs(r_probs.get(k, 0) - b_probs.get(k, 0)) for k in all_keys)
            landcover_shift = diff / 2.0  # Normalize 0..1

        return SatelliteResult(
            recent_window=recent_window,
            baseline_window=baseline_window,
            ndvi_recent=ndvi_recent,
            ndvi_baseline=ndvi_baseline,
            ndvi_change=ndvi_change,
            ndvi_anomaly=ndvi_anomaly,
            ndvi_timeseries=ndvi_timeseries,
            landcover_recent=landcover_recent,
            landcover_baseline=landcover_baseline,
            landcover_shift=landcover_shift,
            status="ok"
        )

    except Exception as e:
        return SatelliteResult(
            recent_window=[], baseline_window=[], ndvi_recent=None, ndvi_baseline=None,
            ndvi_change=None, ndvi_anomaly=None, ndvi_timeseries=[],
            landcover_recent=None, landcover_baseline=None, landcover_shift=None,
            status=f"error: {str(e)}"
        )
