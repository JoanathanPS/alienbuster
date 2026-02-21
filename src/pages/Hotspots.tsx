import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

interface Report {
  id: number;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  notes: string | null;
  status: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  verified: "#22c55e",
  rejected: "#ef4444",
};

const Hotspots = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([20, 0], 2);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // Try to center on user location
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 10),
      () => {} // keep default world view
    );

    const fetchAndPlot = async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch reports:", error);
        setLoading(false);
        return;
      }

      // @ts-ignore - leaflet.markercluster adds this to L
      const clusterGroup = L.markerClusterGroup();

      (data as Report[]).forEach((r) => {
        if (r.latitude == null || r.longitude == null) return;

        const color = STATUS_COLORS[r.status || "pending"] || STATUS_COLORS.pending;

        const marker = L.circleMarker([r.latitude, r.longitude], {
          radius: 10,
          fillColor: color,
          color: color,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
        });

        const photoHtml = r.photo_url
          ? `<img src="${r.photo_url}" alt="Report" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
          : "";

        const statusLabel = r.status || "pending";
        const date = r.created_at
          ? new Date(r.created_at).toLocaleDateString()
          : "Unknown";

        marker.bindPopup(`
          <div style="min-width:180px;font-family:system-ui,sans-serif;">
            ${photoHtml}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:12px;color:#888;">${date}</span>
              <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:${color}20;color:${color};">${statusLabel}</span>
            </div>
            <p style="font-size:12px;color:#888;margin:2px 0;">📍 ${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}</p>
            ${r.notes ? `<p style="font-size:13px;margin-top:4px;">${r.notes}</p>` : ""}
          </div>
        `);

        clusterGroup.addLayer(marker);
      });

      map.addLayer(clusterGroup);
      setLoading(false);
    };

    fetchAndPlot();

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pb-16">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" />
    </div>
  );
};

export default Hotspots;
