from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

def _dms_to_deg(dms):
    deg = dms[0]
    minutes = dms[1]
    seconds = dms[2]
    return deg + minutes/60 + seconds/3600

def extract_gps_from_image(image_bytes: bytes):
    try:
        # Open image from bytes
        import io
        pil_img = Image.open(io.BytesIO(image_bytes))
        
        exif = pil_img.getexif()
        if not exif:
            return None, None

        gps_info = None
        for tag_id, value in exif.items():
            if TAGS.get(tag_id) == "GPSInfo":
                gps_info = value
                break
        if not gps_info:
            return None, None

        gps = {GPSTAGS.get(k, k): v for k, v in gps_info.items()}

        if "GPSLatitude" not in gps or "GPSLongitude" not in gps:
            return None, None

        lat = _dms_to_deg(gps["GPSLatitude"])
        lon = _dms_to_deg(gps["GPSLongitude"])

        if gps.get("GPSLatitudeRef") == "S":
            lat *= -1
        if gps.get("GPSLongitudeRef") == "W":
            lon *= -1

        return lat, lon
    except Exception:
        return None, None

def fetch_species_info(species_name: str):
    # Mock implementation or integration with Wikipedia API if needed later
    return {
        "description": f"Information about {species_name} is being retrieved.",
        "wiki_url": f"https://en.wikipedia.org/wiki/{species_name.replace(' ', '_')}"
    }
