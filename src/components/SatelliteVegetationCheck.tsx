import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Satellite, RefreshCw } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { apiUrl } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SatelliteAnalyzeResponse = {
  ndvi_mean: number | null;
  change: number | null;
  anomaly: boolean | null;
  status: string;
  correlation: "high" | "low" | "unknown";
  message: string;
};

type Props = {
  latitude: number;
  longitude: number;
  species?: string | null;
  isInvasive?: boolean;
};

function colorForAnomaly(anomaly: boolean | null) {
  if (anomaly === true) return "#ef4444"; // red
  if (anomaly === false) return "#22c55e"; // green
  return "#f59e0b"; // orange / unknown
}

export function SatelliteVegetationCheck({ latitude, longitude, species, isInvasive }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SatelliteAnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch(apiUrl("/api/satellite-analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: latitude,
          lon: longitude,
          species: species || undefined,
          is_invasive: isInvasive ?? undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Satellite analyze failed (${res.status})`);
      }

      const json = (await res.json()) as SatelliteAnalyzeResponse;
      setData(json);
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Satellite analysis timed out" : e?.message || "Satellite analysis failed";
      setError(msg);
      toast.error(msg);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, [latitude, longitude, species, isInvasive]);

  useEffect(() => {
    run();
  }, [run]);

  const badge = useMemo(() => {
    if (loading) return <Badge variant="outline">analyzing</Badge>;
    if (error) return <Badge variant="destructive">error</Badge>;

    if (data?.correlation === "high") return <Badge className="bg-primary text-primary-foreground">High correlation</Badge>;
    if (data?.correlation === "low") return <Badge variant="secondary">Low correlation</Badge>;
    return <Badge variant="outline">Unknown</Badge>;
  }, [loading, error, data]);

  // Mini preview map (base map + colored overlay)
  useEffect(() => {
    if (!mapRef.current) return;

    const overlayColor = colorForAnomaly(data?.anomaly ?? null);

    if (!mapInstanceRef.current) {
      const m = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false,
      }).setView([latitude, longitude], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(m);

      mapInstanceRef.current = m;
    }

    const map = mapInstanceRef.current;
    map.setView([latitude, longitude], 12, { animate: false });

    // Remove previous overlays
    map.eachLayer((layer) => {
      // Keep the tile layer
      // @ts-ignore
      if (layer && layer._url) return;
      map.removeLayer(layer);
    });

    // Overlay (simple colored circle as placeholder for NDVI raster)
    L.circle([latitude, longitude], {
      radius: 900,
      color: overlayColor,
      fillColor: overlayColor,
      fillOpacity: 0.28,
      weight: 2,
    }).addTo(map);

    return () => {
      // keep map instance mounted; removed on unmount below
    };
  }, [latitude, longitude, data?.anomaly]);

  useEffect(() => {
    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Satellite className="h-4 w-4 text-primary" aria-hidden="true" />
            Satellite Vegetation Check
          </span>
          {badge}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Analyzing land-cover changes...
          </div>
        ) : error ? (
          <div className="space-y-2">
            <div className="text-sm text-destructive">{error}</div>
            <Button type="button" variant="outline" size="sm" onClick={run} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry satellite check
            </Button>
            <div className="text-xs text-muted-foreground">
              {/* TODO: Integrate real Google Earth Engine NDVI via backend /api/satellite-analyze */}
              If Earth Engine isn’t authenticated, this check can show as unavailable.
            </div>
          </div>
        ) : !data ? (
          <div className="text-sm text-muted-foreground">No satellite data.</div>
        ) : (
          <>
            {data.anomaly === true ? (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <div className="font-medium text-destructive">Vegetation anomaly detected</div>
                  <div className="text-muted-foreground">This can indicate disturbance or rapid growth.</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No major vegetation anomaly detected.</div>
            )}

            <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-xs">
              <div>
                <span className="block text-muted-foreground">NDVI Mean</span>
                <span className="font-medium text-lg">{data.ndvi_mean?.toFixed(2) ?? "—"}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Change Δ</span>
                <span className={`font-medium text-lg ${data.anomaly ? "text-destructive" : ""}`}>
                  {typeof data.change === "number" && data.change > 0 ? "+" : ""}
                  {typeof data.change === "number" ? data.change.toFixed(2) : "—"}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Anomaly</span>
                <span className="font-medium text-lg">{data.anomaly === true ? "Yes" : data.anomaly === false ? "No" : "—"}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Engine status</span>
                <span className="font-medium">{data.status}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Ground ↔ Satellite correlation</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{data.message}</div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-2">NDVI preview (placeholder overlay)</div>
              <div ref={mapRef} className="h-40 w-full overflow-hidden rounded-lg border" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
