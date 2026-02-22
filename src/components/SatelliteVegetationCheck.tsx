import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Satellite, RefreshCw } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { apiFetchJson } from "@/lib/apiFetch";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type SatelliteResponse = {
  recent_ndvi: number | null;
  baseline_ndvi: number | null;
  change: number | null;
  anomaly: boolean | null;
  recent_window: { start: string; end: string };
  baseline_window: { start: string; end: string };
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
  const [data, setData] = useState<SatelliteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const json = await apiFetchJson<SatelliteResponse>(
        `/satellite?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
        { timeoutMs: 12_000 },
      );
      setData(json);
    } catch (e: any) {
      const msg = e?.message || "Satellite analysis failed";
      setError(msg);
      toast.error(msg);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    run();
  }, [run]);

  const badge = useMemo(() => {
    if (loading) return <Badge variant="outline">analyzing</Badge>;
    if (error) return <Badge variant="destructive">error</Badge>;

    const anomaly = data?.anomaly;
    if (anomaly == null) return <Badge variant="outline">Unknown</Badge>;

    const high = anomaly === true && (isInvasive ?? false);
    return high ? (
      <Badge className="bg-primary text-primary-foreground">High correlation</Badge>
    ) : (
      <Badge variant="secondary">Low correlation</Badge>
    );
  }, [loading, error, data, isInvasive]);

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
          <div className="space-y-3">
            <Skeleton className="h-4 w-56" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <div className="space-y-2">
            <div className="text-sm text-destructive">{error}</div>
            <Button type="button" variant="outline" size="sm" onClick={run} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry satellite check
            </Button>
            <div className="text-xs text-muted-foreground">
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
                  <div className="text-muted-foreground">NDVI dropped compared to last year’s baseline window.</div>
                </div>
              </div>
            ) : data.anomaly === false ? (
              <div className="text-sm text-muted-foreground">No major vegetation anomaly detected.</div>
            ) : (
              <div className="text-sm text-muted-foreground">Satellite anomaly status unavailable.</div>
            )}

            <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-xs">
              <div>
                <span className="block text-muted-foreground">Recent NDVI</span>
                <span className="font-medium text-lg">{data.recent_ndvi?.toFixed(2) ?? "—"}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Baseline NDVI</span>
                <span className="font-medium text-lg">{data.baseline_ndvi?.toFixed(2) ?? "—"}</span>
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
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Ground ↔ Satellite correlation</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {data.anomaly === true && (isInvasive ?? false)
                  ? `High correlation: Possible ${species || "invasive"} outbreak detected`
                  : "Low correlation: No major vegetation anomaly"
                }
              </div>
              <div className="text-xs text-muted-foreground">
                Recent window: {data.recent_window.start} → {data.recent_window.end}
                {"\n"}
                Baseline window: {data.baseline_window.start} → {data.baseline_window.end}
              </div>
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
