import exifr from "exifr";

export type ExifCoords = { lat: number; lon: number };

export async function extractLatLonFromFile(file: File): Promise<ExifCoords | null> {
  // exifr.gps returns { latitude, longitude } on success
  const gps = await exifr.gps(file).catch(() => null);
  if (gps?.latitude != null && gps?.longitude != null) {
    return { lat: gps.latitude, lon: gps.longitude };
  }
  return null;
}
