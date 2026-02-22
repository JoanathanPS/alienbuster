from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import List, Dict, Any

import numpy as np
from sklearn.cluster import DBSCAN

from backend.db import get_conn, _utcnow_iso, _haversine_km

def recompute_outbreaks() -> Dict[str, int]:
    """
    Clustering high-risk reports to find outbreaks.
    """
    # 1. Fetch high risk reports in last 60 days
    cutoff = (datetime.utcnow() - timedelta(days=60)).isoformat()
    
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT id, lat, lon, species, fused_risk, ndvi_anomaly
            FROM reports
            WHERE created_at >= ?
              AND is_invasive = 1
              AND fused_risk >= 0.70
            """,
            (cutoff,)
        ).fetchall()
        
        if not rows:
            return {"outbreaks_created": 0, "outbreaks_updated": 0}

        reports = [dict(r) for r in rows]
        coords = np.array([[r["lat"], r["lon"]] for r in reports])
        
        # 2. DBSCAN
        # eps is in radians. 2km radius approx.
        kms_per_radian = 6371.0088
        epsilon = 2.0 / kms_per_radian
        
        # metric='haversine' expects radians
        coords_rad = np.radians(coords)
        
        db = DBSCAN(eps=epsilon, min_samples=3, metric='haversine', algorithm='ball_tree')
        db.fit(coords_rad)
        
        labels = db.labels_
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        
        created = 0
        updated = 0
        
        # 3. Process clusters
        unique_labels = set(labels)
        for label in unique_labels:
            if label == -1:
                continue # Noise
            
            cluster_indices = [i for i, l in enumerate(labels) if l == label]
            cluster_reports = [reports[i] for i in cluster_indices]
            
            # Centroid
            lats = [r["lat"] for r in cluster_reports]
            lons = [r["lon"] for r in cluster_reports]
            centroid_lat = float(np.mean(lats))
            centroid_lon = float(np.mean(lons))
            
            # Radius (max distance from centroid)
            radius_km = 0.0
            for r in cluster_reports:
                d = _haversine_km(centroid_lat, centroid_lon, r["lat"], r["lon"])
                if d > radius_km:
                    radius_km = d
            
            # Aggregate stats
            species_list = [r["species"] for r in cluster_reports]
            # Most common species
            main_species = max(set(species_list), key=species_list.count)
            
            mean_risk = float(np.mean([r["fused_risk"] for r in cluster_reports]))
            anomaly_rate = float(np.mean([1 if r["ndvi_anomaly"] else 0 for r in cluster_reports]))
            num_reports = len(cluster_reports)
            
            # Check if existing outbreak near centroid (simple merge logic)
            existing = conn.execute(
                """
                SELECT id FROM outbreaks
                WHERE species = ?
                  AND status IN ('watch', 'investigating', 'confirmed')
                """,
                (main_species,)
            ).fetchall()
            
            outbreak_id = None
            for ex in existing:
                # Check distance
                ex_row = conn.execute("SELECT centroid_lat, centroid_lon FROM outbreaks WHERE id = ?", (ex["id"],)).fetchone()
                dist = _haversine_km(centroid_lat, centroid_lon, ex_row["centroid_lat"], ex_row["centroid_lon"])
                if dist < 5.0: # If overlap/close, merge
                    outbreak_id = ex["id"]
                    break
            
            now = _utcnow_iso()
            if outbreak_id:
                # Update
                conn.execute(
                    """
                    UPDATE outbreaks
                    SET updated_at = ?, centroid_lat = ?, centroid_lon = ?, radius_km = ?,
                        num_reports = ?, mean_risk = ?, ndvi_anomaly_rate = ?
                    WHERE id = ?
                    """,
                    (now, centroid_lat, centroid_lon, radius_km, num_reports, mean_risk, anomaly_rate, outbreak_id)
                )
                updated += 1
            else:
                # Create
                conn.execute(
                    """
                    INSERT INTO outbreaks (species, created_at, updated_at, centroid_lat, centroid_lon, radius_km, num_reports, mean_risk, ndvi_anomaly_rate, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (main_species, now, now, centroid_lat, centroid_lon, radius_km, num_reports, mean_risk, anomaly_rate, 'investigating')
                )
                created += 1
        
        conn.commit()
        return {"outbreaks_created": created, "outbreaks_updated": updated}
        
    finally:
        conn.close()

def list_outbreaks(status: str = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    try:
        sql = "SELECT * FROM outbreaks"
        params = []
        if status:
            sql += " WHERE status = ?"
            params.append(status)
        sql += " ORDER BY mean_risk DESC"
        
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
