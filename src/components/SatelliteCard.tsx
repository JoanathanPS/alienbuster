// TODO: Replace placeholder with real Google Earth Engine NDVI change detection via backend API
import { useEffect, useState } from "react";
import { Loader2, Satellite, AlertTriangle, CheckCircle } from "lucide-react";

type Result = "anomaly" | "normal" | null;

export function SatelliteCard() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setResult(Math.random() > 0.5 ? "anomaly" : "normal");
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Satellite className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Satellite Vegetation Check</span>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Analyzing land-cover changes...</span>
          </div>
        )}

        {!loading && result === "anomaly" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p className="text-sm font-medium text-accent">
                Unusual vegetation change detected at this location (NDVI drop)
              </p>
            </div>
          </div>
        )}

        {!loading && result === "normal" && (
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm font-medium text-primary">
              Normal vegetation pattern
            </p>
          </div>
        )}

        {/* NDVI gradient bar placeholder */}
        {!loading && (
          <div className="mt-3">
            <div className="h-3 w-full rounded-full" style={{
              background: "linear-gradient(to right, hsl(0 84% 60%), hsl(45 93% 47%), hsl(142 71% 45%))"
            }} />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Low NDVI</span>
              <span>High NDVI</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
