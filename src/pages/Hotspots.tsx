import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveReportPhotoUrl } from "@/lib/reportPhotos";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { MapContainer, TileLayer, useMap } from "react-leaflet";

interface Report {
  id: number;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  notes: string | null;
  status: string | null;
  species?: string | null;
  is_invasive?: boolean | null;
}

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b", // orange
  verified: "#22c55e", // green
  rejected: "#6b7280", // gray (not shown as "hotspot")
};

function extractSpecies(notes: string | null): string | null {
  if (!notes) return null;
  // Notes are often multi-line like:
  // "Type: plant\nBioCLIP: Kudzu (95%)\nNDVI mean: ..."
  const line = notes.split("\n").find((l) => l.toLowerCase().startsWith("bioclip:"));
  if (!line) return null;
  const m = line.match(/BioCLIP:\s*(.*?)\s*(\(|$)/i);
  return m?.[1]?.trim() || null;
}

function HotspotClusters({ reports }: { reports: Array<Report & { resolvedPhotoUrl?: string | null }> }) {
  const map = useMap();

  useEffect(() => {
    // @ts-ignore - leaflet.markercluster adds this to L
    const clusterGroup: L.MarkerClusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
    });

    const bounds: L.LatLngBoundsExpression[] = [];

    for (const r of reports) {
      if (r.latitude == null || r.longitude == null) continue;

      const statusLabel = r.status || "pending";
      const color = STATUS_COLORS[statusLabel] || STATUS_COLORS.pending;
      const speciesName = r.species || extractSpecies(r.notes);
      const species = speciesName ? `Species: ${speciesName}` : "Species: (pending ML)";

      const marker = L.circleMarker([r.latitude, r.longitude], {
        radius: statusLabel === "verified" ? 10 : 9,
        fillColor: color,
        color,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.75,
      });

      const photoHtml = r.resolvedPhotoUrl
        ? `<img src="${r.resolvedPhotoUrl}" alt="Report" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
        : "";

      const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : "Unknown";

      marker.bindPopup(`
        <div style="min-width:200px;font-family:system-ui,sans-serif;">
          ${photoHtml}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:12px;color:#888;">${date}</span>
            <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:${color}20;color:${color};">${statusLabel}</span>
          </div>
          <div style="font-size:13px;font-weight:600;margin:6px 0 2px 0;">${species}</div>
          <p style="font-size:12px;color:#888;margin:2px 0;">Location: ${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}</p>
          ${r.notes ? `<p style="font-size:13px;margin-top:6px;white-space:pre-wrap;">${r.notes}</p>` : ""}
        </div>
      `);

      bounds.push([r.latitude, r.longitude] as any);
      clusterGroup.addLayer(marker);
    }

    map.addLayer(clusterGroup);

    // Fit bounds for good initial view
    if (bounds.length > 1) {
      map.fitBounds(bounds as any, { padding: [24, 24] });
    }

    return () => {
      try {
        clusterGroup.clearLayers();
      } catch {
        // ignore
      }
      map.removeLayer(clusterGroup);
    };
  }, [map, reports]);

  return null;
}

const Hotspots = () => {
  const geo = useGeolocation();

  const [loading, setLoading] = useState(true);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [reports, setReports] = useState<Array<Report & { resolvedPhotoUrl?: string | null }>>([]);

  useEffect(() => {
    geo.requestLocation();
  }, []);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);

      // Prefer selecting ML columns if present. If the DB isn't migrated yet, fallback.
      let query = supabase
        .from("reports")
        .select("id, created_at, latitude, longitude, photo_url, notes, status, species, is_invasive")
        .order("created_at", { ascending: false });

      let data: any = null;
      let error: any = null;

      {
        const res = await query;
        data = res.data;
        error = res.error;
      }

      if (error && /column .* (species|is_invasive)/i.test(error.message || "")) {
        const res2 = await supabase
          .from("reports")
          .select("id, created_at, latitude, longitude, photo_url, notes, status")
          .order("created_at", { ascending: false });
        data = res2.data;
        error = res2.error;
      }

      if (error) {
        console.error("Failed to fetch reports:", error);
        toast.error("Failed to load hotspots");
        setReportCount(0);
        setReports([]);
        setLoading(false);
        return;
      }

      const baseReports = (data as Report[]) || [];
      setReportCount(baseReports.length);

      if (baseReports.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Resolve photo URLs (signed URLs for private buckets; keeps working for public URLs too)
      const resolved = await Promise.all(
        baseReports.map(async (r) => ({ ...r, resolvedPhotoUrl: await resolveReportPhotoUrl(r.photo_url) }))
      );

      setReports(resolved);
      setLoading(false);
    };

    fetchReports();
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (geo.latitude != null && geo.longitude != null) return [geo.latitude, geo.longitude];
    return DEFAULT_CENTER;
  }, [geo.latitude, geo.longitude]);

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && reportCount === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-6 text-center">
          <div className="max-w-xs">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <div className="text-base font-semibold">No hotspots yet</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Once citizens submit reports, they’ll appear here as clustered markers.
            </div>
          </div>
        </div>
      )}

      <MapContainer center={center} zoom={11} className="absolute inset-0">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {reports.length > 0 && <HotspotClusters reports={reports} />}
      </MapContainer>
    </div>
  );
};

export default Hotspots;
