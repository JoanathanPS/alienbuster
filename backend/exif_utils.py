"""Extract EXIF geolocation and fetch species information."""

from __future__ import annotations

from typing import Optional, Tuple
import io

try:
    import piexif
except ImportError:
    piexif = None

import requests


def extract_gps_from_image(image_data: bytes) -> Tuple[Optional[float], Optional[float]]:
    """
    Extract GPS coordinates from image EXIF data.
    
    Args:
        image_data: Raw image bytes
        
    Returns:
        Tuple of (latitude, longitude) or (None, None) if not found
    """
    if piexif is None:
        return None, None
    
    try:
        exif_dict = piexif.load(io.BytesIO(image_data))
        
        if "GPS" not in exif_dict:
            return None, None
        
        gps_ifd = exif_dict["GPS"]
        
        # Extract latitude
        lat_data = gps_ifd.get(piexif.GPSIFD.GPSLatitude)
        lat_ref = gps_ifd.get(piexif.GPSIFD.GPSLatitudeRef)
        
        # Extract longitude
        lon_data = gps_ifd.get(piexif.GPSIFD.GPSLongitude)
        lon_ref = gps_ifd.get(piexif.GPSIFD.GPSLongitudeRef)
        
        if not (lat_data and lon_data and lat_ref and lon_ref):
            return None, None
        
        # Convert to decimal degrees
        def convert_to_degrees(value: tuple) -> float:
            """Convert GPS tuple to decimal degrees."""
            d = float(value[0][0]) / float(value[0][1])
            m = float(value[1][0]) / float(value[1][1])
            s = float(value[2][0]) / float(value[2][1])
            return d + (m / 60.0) + (s / 3600.0)
        
        latitude = convert_to_degrees(lat_data)
        longitude = convert_to_degrees(lon_data)
        
        # Apply reference direction
        if lat_ref[0] == ord('S'):
            latitude = -latitude
        if lon_ref[0] == ord('W'):
            longitude = -longitude
        
        return latitude, longitude
    except Exception:
        return None, None


def fetch_species_info(species_name: str) -> dict:
    """
    Fetch species information from Wikipedia.
    
    Args:
        species_name: Common or scientific name of species
        
    Returns:
        Dict with 'description', 'image_url', 'url' keys (or empty values if not found)
    """
    result = {
        "description": None,
        "image_url": None,
        "url": None,
    }
    
    try:
        # Search Wikipedia API
        search_response = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "format": "json",
                "srsearch": species_name,
                "srprop": "snippet",
                "srlimit": 1,
            },
            timeout=5,
        )
        search_response.raise_for_status()
        search_data = search_response.json()
        
        if not search_data.get("query", {}).get("search"):
            return result
        
        page_title = search_data["query"]["search"][0]["title"]
        
        # Get page content and images
        content_response = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "titles": page_title,
                "prop": "extracts|pageimages|info",
                "explaintext": True,
                "exintro": True,
                "piprop": "original",
                "format": "json",
                "inprop": "url",
            },
            timeout=5,
        )
        content_response.raise_for_status()
        content_data = content_response.json()
        
        pages = content_data.get("query", {}).get("pages", {})
        if not pages:
            return result
        
        page = list(pages.values())[0]
        
        # Extract description (first 300 chars)
        extract = page.get("extract", "")
        if extract:
            result["description"] = extract[:300] + "..." if len(extract) > 300 else extract
        
        # Extract image URL
        if "original" in page:
            result["image_url"] = page["original"]["source"]
        
        # Extract Wikipedia URL
        if "canonicalurl" in page:
            result["url"] = page["canonicalurl"]
        
    except Exception:
        pass
    
    return result
