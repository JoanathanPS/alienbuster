from __future__ import annotations

import datetime as _dt
import json
from typing import Any, Dict, List, Optional, Tuple, TypedDict

from backend.earthengine import _try_init_ee

# Define the canonical schema using TypedDict for clarity (or just dict)
# But we will return a dict directly to ensure JSON compatibility and exact keys.

def get_satellite_change(
    lat: float,
    lon: float,
    *,
    project: Optional[str] = None,
    radius_m: float = 1000.0,
) -> Dict[str, Any]:
    
    # Default response structure (error state)
    def error_response(msg: str, debug: Dict[str, Any] = {}) -> Dict[str, Any]:
        return {
            "ok": False,
            "error": msg,
            "recent_window": [],
            "baseline_window": [],
            "ndvi_recent": None,
            "ndvi_baseline": None,
            "ndvi_change": None,
            "ndvi_anomaly": None,
            "bbox": None,
            "tiles": None,
            "thumbs": None,
            "debug": debug
        }

    ok, status = _try_init_ee(project)
    if not ok:
        return error_response(f"Earth Engine unavailable: {status[:100]}")

    import ee

    try:
        point = ee.Geometry.Point(lon, lat)
        buffer = point.buffer(radius_m)
        
        # Calculate bbox for frontend
        bounds = buffer.bounds().getInfo()
        coords = bounds['coordinates'][0]
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        bbox = [min(lons), min(lats), max(lons), max(lats)]

        today = _dt.date.today()
        recent_end = today
        recent_start = today - _dt.timedelta(days=45)
        
        baseline_end = recent_end - _dt.timedelta(days=365)
        baseline_start = recent_start - _dt.timedelta(days=365)

        recent_window_strs = [recent_start.isoformat(), recent_end.isoformat()]
        baseline_window_strs = [baseline_start.isoformat(), baseline_end.isoformat()]

        # --- Image Collections ---
        def mask_clouds(img):
            # Check if QA60 band exists
            has_qa = img.bandNames().contains("QA60")
            
            def apply_mask(i):
                qa = i.select('QA60')
                cloud_bit_mask = 1 << 10
                cirrus_bit_mask = 1 << 11
                mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
                return i.updateMask(mask).divide(10000)
                
            # If QA60 exists, apply mask, else just scale
            return ee.Algorithms.If(has_qa, apply_mask(img), img.divide(10000))

        # Relaxed cloud filter < 60
        s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
            .filterBounds(buffer) \
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60)) \
            .map(mask_clouds)

        recent_coll = s2.filterDate(recent_start.isoformat(), recent_end.isoformat())
        baseline_coll = s2.filterDate(baseline_start.isoformat(), baseline_end.isoformat())

        # Check counts
        recent_count = recent_coll.size().getInfo()
        baseline_count = baseline_coll.size().getInfo()
        
        debug_info = {
            "recent_count": recent_count,
            "baseline_count": baseline_count,
            "cloud_pct": 60
        }

        if recent_count == 0:
            return error_response("No Sentinel-2 scenes found for recent window", debug_info)

        # Fallback for baseline if empty
        if baseline_count == 0:
            # Try 2 years ago
            baseline_start = baseline_start - _dt.timedelta(days=365)
            baseline_end = baseline_end - _dt.timedelta(days=365)
            baseline_window_strs = [baseline_start.isoformat(), baseline_end.isoformat()]
            baseline_coll = s2.filterDate(baseline_start.isoformat(), baseline_end.isoformat())
            baseline_count = baseline_coll.size().getInfo()
            debug_info["baseline_count"] = baseline_count
            debug_info["baseline_fallback"] = "2_years_ago"
            
            if baseline_count == 0:
                # Still empty? We can proceed with recent data only, but can't compute change
                pass

        recent_img = recent_coll.median().clip(buffer)
        
        if baseline_count > 0:
            baseline_img = baseline_coll.median().clip(buffer)
        else:
            baseline_img = None

        # 1. NDVI Calculations
        mean_reducer = ee.Reducer.mean()
        
        ndvi_recent_img = recent_img.normalizedDifference(["B8", "B4"]).rename("NDVI")
        ndvi_recent_val = ndvi_recent_img.reduceRegion(mean_reducer, buffer, 10).get("NDVI").getInfo()
        
        ndvi_baseline_val = None
        ndvi_change_val = None
        ndvi_anomaly = None
        
        if baseline_img:
            ndvi_baseline_img = baseline_img.normalizedDifference(["B8", "B4"]).rename("NDVI")
            ndvi_baseline_val = ndvi_baseline_img.reduceRegion(mean_reducer, buffer, 10).get("NDVI").getInfo()
            
            if ndvi_recent_val is not None and ndvi_baseline_val is not None:
                ndvi_change_val = ndvi_recent_val - ndvi_baseline_val
                ndvi_anomaly = abs(ndvi_change_val) > 0.15

        # 2. Visualizations & Tiles
        tiles = {}
        thumbs = {}

        # A) True Color (RGB)
        rgb_vis = {"min": 0, "max": 0.3, "bands": ["B4", "B3", "B2"], "gamma": 1.4}
        # Explicit select + getMapId
        try:
            rgb_layer = recent_img.select(["B4", "B3", "B2"])
            rgb_map = rgb_layer.getMapId(rgb_vis)
            tiles["true_color"] = rgb_map["tile_fetcher"].url_format
            
            # Thumb
            rgb_vis_img = recent_img.visualize(**rgb_vis)
            thumbs["true_color"] = rgb_vis_img.getThumbURL({"region": buffer, "dimensions": 512, "format": "png"})
        except Exception as e:
            print(f"Error generating RGB tiles: {e}")

        # B) NDVI
        ndvi_vis = {"min": 0, "max": 1, "palette": ["#8b0000", "#ffcc00", "#00ff6a", "#007a3d"]}
        try:
            ndvi_vis_img = ndvi_recent_img.visualize(**ndvi_vis)
            tiles["ndvi"] = ndvi_vis_img.getMapId()["tile_fetcher"].url_format
            thumbs["ndvi"] = ndvi_vis_img.getThumbURL({"region": buffer, "dimensions": 512, "format": "png"})
        except Exception as e:
            print(f"Error generating NDVI tiles: {e}")

        # C) NDVI Change
        if baseline_img:
            change_vis = {"min": -0.3, "max": 0.3, "palette": ["#b30000", "#ff9966", "#ffffff", "#99ff99", "#006d2c"]}
            try:
                change_img = ndvi_recent_img.subtract(ndvi_baseline_img).rename("NDVI_CHANGE")
                change_vis_img = change_img.visualize(**change_vis)
                tiles["ndvi_change"] = change_vis_img.getMapId()["tile_fetcher"].url_format
                thumbs["ndvi_change"] = change_vis_img.getThumbURL({"region": buffer, "dimensions": 512, "format": "png"})
            except Exception as e:
                print(f"Error generating Change tiles: {e}")

        return {
            "ok": True,
            "error": None,
            "recent_window": recent_window_strs,
            "baseline_window": baseline_window_strs,
            "ndvi_recent": ndvi_recent_val,
            "ndvi_baseline": ndvi_baseline_val,
            "ndvi_change": ndvi_change_val,
            "ndvi_anomaly": ndvi_anomaly,
            "bbox": bbox,
            "tiles": tiles,
            "thumbs": thumbs,
            "debug": debug_info
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return error_response(f"Backend processing error: {str(e)}", {"trace": str(e)})
