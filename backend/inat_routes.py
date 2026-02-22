from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import time
import json

from backend.inat_client import search_taxon_id, search_place_id, fetch_observations
from backend.db import insert_report, get_conn, utcnow_report_values, compute_report_density, compute_batch_density_and_risk
from backend.outbreaks import recompute_outbreaks

router = APIRouter(prefix="/inat", tags=["inaturalist"])

class IngestRequest(BaseModel):
    species_query: str
    place_query: str
    pages: int = 1
    per_page: int = 200
    research_only: bool = True
    verifiable: bool = True
    d1: Optional[str] = None
    d2: Optional[str] = None

def sse(data: dict):
    return f"data: {json.dumps(data)}\n\n"

@router.get("/ingest/stream")
def ingest_stream(
    species_query: str,
    place_query: str,
    pages: int = 5,
    per_page: int = 200,
    research_only: bool = True
):
    def gen():
        yield sse({"stage": "start", "message": "Starting ingestion..."})
        
        # 1. Resolve IDs
        yield sse({"stage": "resolving_taxon", "message": f"Searching taxon: {species_query}"})
        taxon_id = search_taxon_id(species_query)
        if not taxon_id:
            yield sse({"stage": "error", "message": f"Species '{species_query}' not found on iNaturalist"})
            return
            
        yield sse({"stage": "resolving_place", "message": f"Searching place: {place_query}"})
        place_id = search_place_id(place_query)
        if not place_id:
            yield sse({"stage": "error", "message": f"Place '{place_query}' not found on iNaturalist"})
            return

        inserted_count = 0
        skipped_count = 0
        
        # 2. Fetch Pages
        conn = get_conn()
        
        for p in range(1, pages + 1):
            yield sse({"stage": "fetching", "page": p, "message": f"Fetching page {p}/{pages}..."})
            
            obs_list = fetch_observations(
                taxon_id=taxon_id,
                place_id=place_id,
                page=p,
                per_page=per_page,
                research_only=research_only,
                verifiable=True
            )
            
            if not obs_list:
                yield sse({"stage": "fetching", "page": p, "message": "No more observations found."})
                break
                
            # 3. Process & Insert
            page_inserted = 0
            
            for obs in obs_list:
                try:
                    inat_id = obs["id"]
                    
                    # Dedupe check
                    exists = conn.execute("SELECT 1 FROM reports WHERE inat_id = ?", (inat_id,)).fetchone()
                    if exists:
                        skipped_count += 1
                        continue
                    
                    # Extract fields
                    geojson = obs.get("geojson")
                    if not geojson or "coordinates" not in geojson:
                        skipped_count += 1
                        continue
                        
                    # iNat GeoJSON is [lon, lat]
                    lon = float(geojson["coordinates"][0])
                    lat = float(geojson["coordinates"][1])
                    
                    created_at = obs.get("time_observed_at") or obs.get("observed_on") or obs.get("created_at")
                    species_name = obs.get("taxon", {}).get("name") or species_query
                    description = obs.get("description")
                    
                    photo_url = None
                    if obs.get("photos") and len(obs["photos"]) > 0:
                        raw_url = obs["photos"][0].get("url")
                        if raw_url:
                            # Prefer medium size
                            photo_url = raw_url.replace("square", "medium")
                    
                    # Prepare report data
                    is_invasive = True
                    ml_confidence = 0.95 if research_only else 0.85
                    fused_risk = 0.85
                    
                    report_data = utcnow_report_values(
                        lat=lat,
                        lon=lon,
                        status="verified" if research_only else "unverified",
                        user_id=f"inat_{obs['user']['login']}" if obs.get("user") else "inat_import",
                        reporter_nickname=obs.get("user", {}).get("login"),
                        species=species_name,
                        ml_confidence=ml_confidence,
                        is_invasive=is_invasive,
                        photo_url=photo_url,
                        description=description,
                        fused_risk=fused_risk
                    )
                    report_data["inat_id"] = inat_id
                    
                    # Insert
                    cols = sorted(report_data.keys())
                    placeholders = ",".join(["?"] * len(cols))
                    sql = f"INSERT INTO reports({','.join(cols)}) VALUES ({placeholders})"
                    conn.execute(sql, [report_data[c] for c in cols])
                    conn.commit()
                    
                    page_inserted += 1
                    inserted_count += 1
                    
                except Exception as e:
                    print(f"Error inserting observation {obs.get('id')}: {e}")
                    skipped_count += 1
            
            yield sse({
                "stage": "inserted", 
                "page": p, 
                "inserted_total": inserted_count, 
                "skipped_total": skipped_count
            })
            
            # Rate limit
            time.sleep(0.5)
            
        conn.close()

        # 3b. Batch Compute Density & Risk
        yield sse({"stage": "recompute_outbreaks", "message": "Computing density & risk..."})
        compute_batch_density_and_risk(species_query)
        
        # 4. Recompute Outbreaks
        yield sse({"stage": "recompute_outbreaks", "message": "Recomputing outbreaks..."})
        outbreak_res = recompute_outbreaks()

        # 5. Auto-Create Tasks
        from backend.tasks import auto_create_tasks_from_outbreaks
        tasks_created = auto_create_tasks_from_outbreaks()
        
        yield sse({
            "stage": "done",
            "inserted": inserted_count,
            "skipped": skipped_count,
            "outbreaks": outbreak_res["outbreaks_created"] + outbreak_res["outbreaks_updated"],
            "tasks_created": tasks_created
        })

    return StreamingResponse(gen(), media_type="text/event-stream")

@router.get("/taxa")
def get_taxa(q: str):
    """Proxy for iNat taxa search."""
    from backend.inat_client import _inat_get
    return _inat_get("taxa", {"q": q, "rank": "species", "per_page": 5})

@router.get("/places")
def get_places(q: str):
    """Proxy for iNat places search."""
    from backend.inat_client import _inat_get
    return _inat_get("places/autocomplete", {"q": q})

@router.post("/ingest")
def ingest_dataset(req: IngestRequest):
    # 1. Resolve IDs
    taxon_id = search_taxon_id(req.species_query)
    if not taxon_id:
        raise HTTPException(status_code=404, detail=f"Species '{req.species_query}' not found on iNaturalist")
        
    place_id = search_place_id(req.place_query)
    if not place_id:
        raise HTTPException(status_code=404, detail=f"Place '{req.place_query}' not found on iNaturalist")
        
    inserted_count = 0
    skipped_count = 0
    
    # 2. Fetch Pages
    for page in range(1, req.pages + 1):
        obs_list = fetch_observations(
            taxon_id=taxon_id,
            place_id=place_id,
            page=page,
            per_page=req.per_page,
            research_only=req.research_only,
            verifiable=req.verifiable,
            d1=req.d1,
            d2=req.d2
        )
        
        if not obs_list:
            break
            
        # 3. Process & Insert
        conn = get_conn() # Check for existence efficiently
        
        for obs in obs_list:
            try:
                inat_id = obs["id"]
                
                # Dedupe check
                exists = conn.execute("SELECT 1 FROM reports WHERE inat_id = ?", (inat_id,)).fetchone()
                if exists:
                    skipped_count += 1
                    continue
                
                # Extract fields
                geojson = obs.get("geojson")
                if not geojson or "coordinates" not in geojson:
                    skipped_count += 1
                    continue
                    
                # iNat GeoJSON is [lon, lat]
                lon = float(geojson["coordinates"][0])
                lat = float(geojson["coordinates"][1])
                
                created_at = obs.get("time_observed_at") or obs.get("observed_on") or obs.get("created_at")
                
                species_name = obs.get("taxon", {}).get("name") or req.species_query
                description = obs.get("description")
                
                photo_url = None
                if obs.get("photos") and len(obs["photos"]) > 0:
                    photo_url = obs["photos"][0].get("url")
                    if photo_url:
                        photo_url = photo_url.replace("square", "medium") # Better quality
                
                # Seed Data for Fusion
                # We assume these are verified/high quality if "research grade"
                is_invasive = True # Context of this app: we are searching invasive species
                ml_confidence = 0.95 if req.research_only else 0.85
                
                # Calculate initial risk (can be refined by fusion endpoint later)
                # For bulk ingest, we do a lightweight risk calc
                fused_risk = 0.85 # High risk seed
                
                report_data = utcnow_report_values(
                    lat=lat,
                    lon=lon,
                    status="verified" if req.research_only else "unverified",
                    user_id=f"inat_{obs['user']['login']}" if obs.get("user") else "inat_import",
                    reporter_nickname=obs.get("user", {}).get("login"),
                    species=species_name,
                    ml_confidence=ml_confidence,
                    is_invasive=is_invasive,
                    photo_url=photo_url,
                    description=description,
                    fused_risk=fused_risk,
                    # We skip satellite for bulk ingest to avoid API quota limits
                    # User can click "Analyze" on individual reports later
                )
                
                # Add inat_id manually since it's not in standard report dict
                report_data["inat_id"] = inat_id
                
                # We use the raw insert to include inat_id
                # Or we can update insert_report to handle extra keys?
                # Let's modify insert_report usage or do raw insert.
                # db.py insert_report takes a dict and constructs SQL.
                # So if we add inat_id to report_data, it should work IF we ensured the column exists.
                # We did that in step A.
                
                insert_report(report_data)
                inserted_count += 1
                
            except Exception as e:
                print(f"Error inserting observation {obs.get('id')}: {e}")
                skipped_count += 1
        
        conn.close()
        
        # Polite delay
        time.sleep(0.5)
        
    # 4. Recompute Outbreaks
    outbreak_res = recompute_outbreaks()
    
    return {
        "taxon_id": taxon_id,
        "place_id": place_id,
        "inserted": inserted_count,
        "skipped": skipped_count,
        "outbreaks_created": outbreak_res["outbreaks_created"],
        "outbreaks_updated": outbreak_res["outbreaks_updated"]
    }
