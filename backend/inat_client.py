import requests
import time
from typing import List, Dict, Any, Optional

INAT_API_BASE = "https://api.inaturalist.org/v1"

def _inat_get(endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{INAT_API_BASE}/{endpoint}"
    # Identify our app to iNaturalist (polite usage)
    headers = {
        "User-Agent": "AlienBuster/1.0 (hackathon-project; contact: your-email@example.com)"
    }
    
    # Simple retry logic
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=30)
            if r.status_code == 429:
                # Rate limited
                time.sleep(2 * (attempt + 1))
                continue
            r.raise_for_status()
            return r.json()
        except requests.exceptions.RequestException as e:
            if attempt == 2:
                print(f"[iNat Error] Failed to fetch {url}: {e}")
                return {"results": []}
            time.sleep(1)
            
    return {"results": []}

def search_taxon_id(q: str) -> Optional[int]:
    """Find best matching species ID for a query."""
    params = {
        "q": q,
        "rank": "species",
        "per_page": 5
    }
    data = _inat_get("taxa", params)
    results = data.get("results", [])
    if results:
        # Return first match
        return results[0]["id"]
    return None

def search_place_id(q: str) -> Optional[int]:
    """Find best matching place ID for a query."""
    params = {
        "q": q
    }
    data = _inat_get("places/autocomplete", params)
    results = data.get("results", [])
    if results:
        return results[0]["id"]
    return None

def fetch_observations(
    taxon_id: Optional[int],
    place_id: Optional[int],
    page: int = 1,
    per_page: int = 200,
    research_only: bool = True,
    verifiable: bool = True,
    geo: bool = True,
    d1: Optional[str] = None,
    d2: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Fetch a page of observations."""
    
    params = {
        "geo": "true" if geo else "false",
        "per_page": per_page,
        "page": page,
        "order": "desc",
        "order_by": "created_at"
    }
    
    if taxon_id:
        params["taxon_id"] = taxon_id
    if place_id:
        params["place_id"] = place_id
    
    if research_only:
        params["quality_grade"] = "research"
    
    if verifiable:
        params["verifiable"] = "true"
        
    if d1:
        params["d1"] = d1
    if d2:
        params["d2"] = d2
        
    data = _inat_get("observations", params)
    return data.get("results", [])
