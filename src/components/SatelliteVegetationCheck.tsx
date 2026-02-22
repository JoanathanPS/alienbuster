import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Satellite, RefreshCw, Info } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { apiFetchJson } from "@/lib/apiFetch";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type SatelliteResponse = {
  ok: boolean;
  error: string | null;
  recent_window: [string, string];
  baseline_window: [string, string];
  ndvi_recent: number | null;
  ndvi_baseline: number | null;
  ndvi_change: number | null;
  ndvi_anomaly: boolean | null;
  tiles?: {
    true_color?: string;
    ndvi?: string;
    ndvi_change?: string;
  };
  thumbs?: {
    true_color?: string;
    ndvi?: string;
    ndvi_change?: string;
  };
  bbox?: [number, number, number, number] | null;
  debug?: any;
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

  // New state for layers
  const [layer, setLayer] = useState<"true_color" | "ndvi" | "ndvi_change">("true_color");
  const [interactive, setInteractive] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000); // 15s timeout for EE

    try {
      const json = await apiFetchJson<SatelliteResponse>(
        `/satellite_change?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&radius_m=1000`,
        { timeoutMs: 15_000 },
      );
      setData(json);
      
      if (!json.ok) {
        // Don't throw, just set local error state if we want to show it differently, 
        // or rely on data rendering to show the error.
        // But let's show a toast if it's a hard error.
        if (json.error) console.warn("Satellite error:", json.error);
      }
      
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

  // Reset layer when data changes (Top level effect)
  useEffect(() => {
    if (data) {
      setLayer("true_color");
      setInteractive(false);
    }
  }, [data]);

  const badge = useMemo(() => {
    if (loading) return <Badge variant="outline">analyzing</Badge>;
    if (error) return <Badge variant="destructive">error</Badge>;
    if (data && !data.ok) return <Badge variant="destructive">unavailable</Badge>;

    const anomaly = data?.ndvi_anomaly;
    if (anomaly == null) return <Badge variant="outline">Unknown</Badge>;

    const high = anomaly === true && (isInvasive ?? false);
    return high ? (
      <Badge className="bg-primary text-primary-foreground">High correlation</Badge>
    ) : (
      <Badge variant="secondary">Low correlation</Badge>
    );
  }, [loading, error, data, isInvasive]);

  useEffect(() => {
    if (!mapRef.current) return;
    
    // Only init map when interactive mode is active
    if (!interactive) return;

    if (!mapInstanceRef.current) {
      const m = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
      }).setView([latitude, longitude], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(m);

      mapInstanceRef.current = m;
    }

    const map = mapInstanceRef.current;
    
    // Fit bounds if available
    if (data?.bbox) {
       // bbox: [minLon, minLat, maxLon, maxLat]
       // Leaflet: [[minLat, minLon], [maxLat, maxLon]]
       map.fitBounds([
         [data.bbox[1], data.bbox[0]], 
         [data.bbox[3], data.bbox[2]]
       ]);
    } else {
       map.setView([latitude, longitude], 13);
    }

    // Remove previous overlays
    map.eachLayer((l) => {
      // @ts-ignore
      if (l._url && l._url.includes("openstreetmap")) return; // keep base
      map.removeLayer(l);
    });

    // Add selected tile layer
    const tileUrl = data?.tiles?.[layer];
    if (tileUrl) {
      L.tileLayer(tileUrl, {
        opacity: 0.8,
        maxZoom: 20
      }).addTo(map);
    } else {
      // Fallback circle if no tiles
      const overlayColor = colorForAnomaly(data?.ndvi_anomaly ?? null);
      L.circle([latitude, longitude], {
        radius: 900,
        color: overlayColor,
        fillColor: overlayColor,
        fillOpacity: 0.28,
        weight: 2,
      }).addTo(map);
    }

    return () => {
      // keep map instance mounted; removed on unmount below
    };
  }, [latitude, longitude, data, layer, interactive]);

  useEffect(() => {
    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const toggleInteractive = () => {
    setInteractive(true);
    // Give time for div to render
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);
  };

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
        ) : !data.ok ? (
          <div className="space-y-3">
             <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex gap-2 items-start">
               <Info className="h-4 w-4 shrink-0 mt-0.5" />
               <div className="space-y-1">
                 <p className="font-medium">Analysis Unavailable</p>
                 <p>{data.error || "Unknown error occurred in Earth Engine processing."}</p>
                 {data.debug && (
                    <div className="text-xs opacity-80 mt-1 font-mono">
                      Debug: {JSON.stringify(data.debug)}
                    </div>
                 )}
               </div>
             </div>
             <Button type="button" variant="outline" size="sm" onClick={run} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            {data.ndvi_anomaly === true ? (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <div className="font-medium text-destructive">Vegetation anomaly detected</div>
                  <div className="text-muted-foreground">NDVI dropped compared to last year’s baseline window.</div>
                </div>
              </div>
            ) : data.ndvi_anomaly === false ? (
              <div className="text-sm text-muted-foreground">No major vegetation anomaly detected.</div>
            ) : (
              <div className="text-sm text-muted-foreground">Satellite anomaly status unavailable.</div>
            )}

            <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-xs">
              <div>
                <span className="block text-muted-foreground">Recent NDVI</span>
                <span className="font-medium text-lg">{data.ndvi_recent?.toFixed(2) ?? "—"}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Baseline NDVI</span>
                <span className="font-medium text-lg">{data.ndvi_baseline?.toFixed(2) ?? "—"}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Change Δ</span>
                <span className={`font-medium text-lg ${data.ndvi_anomaly ? "text-destructive" : ""}`}>
                  {typeof data.ndvi_change === "number" && data.ndvi_change > 0 ? "+" : ""}
                  {typeof data.ndvi_change === "number" ? data.ndvi_change.toFixed(2) : "—"}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Anomaly</span>
                <span className="font-medium text-lg">{data.ndvi_anomaly === true ? "Yes" : data.ndvi_anomaly === false ? "No" : "—"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Ground ↔ Satellite correlation</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {data.ndvi_anomaly === true && (isInvasive ?? false)
                  ? `High correlation: Possible ${species || "invasive"} outbreak detected`
                  : "Low correlation: No major vegetation anomaly"
                }
              </div>
              <div className="text-xs text-muted-foreground">
                Recent window: {data.recent_window[0]} → {data.recent_window[1]}
                {"\n"}
                Baseline window: {data.baseline_window[0]} → {data.baseline_window[1]}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-muted-foreground font-medium">Satellite Imagery (Sentinel-2)</div>
                <div className="flex gap-1">
                   <Button 
                     size="sm" 
                     variant={layer === "true_color" ? "secondary" : "ghost"} 
                     className="h-6 text-[10px]"
                     onClick={() => setLayer("true_color")}
                   >
                     True Color
                   </Button>
                   <Button 
                     size="sm" 
                     variant={layer === "ndvi" ? "secondary" : "ghost"} 
                     className="h-6 text-[10px]"
                     onClick={() => setLayer("ndvi")}
                   >
                     NDVI
                   </Button>
                   <Button 
                     size="sm" 
                     variant={layer === "ndvi_change" ? "secondary" : "ghost"} 
                     className="h-6 text-[10px]"
                     onClick={() => setLayer("ndvi_change")}
                   >
                     Change
                   </Button>
                </div>
              </div>

              <div className="relative h-64 w-full overflow-hidden rounded-lg border bg-muted/20 group">
                {!interactive && data.thumbs?.[layer] && (
                  <div className="absolute inset-0 z-10">
                    <img 
                      src={data.thumbs[layer]} 
                      alt="Satellite preview" 
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                       <Button variant="secondary" size="sm" onClick={toggleInteractive} className="shadow-lg">
                         Open Interactive Overlay
                       </Button>
                    </div>
                  </div>
                )}
                
                <div ref={mapRef} className={`h-full w-full ${!interactive ? "opacity-0 pointer-events-none" : "opacity-100"}`} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 text-right">
                Source: Copernicus Sentinel-2 (Harmonized) via Google Earth Engine
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
