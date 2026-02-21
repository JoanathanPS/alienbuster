import { AlertTriangle, CheckCircle, Loader2, Satellite, Slash } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type NdviPayload = {
  mean: number | null;
  evi: number | null;
  change: number | null;
  anomaly: boolean | null;
  satellite_score: number | null;
  status: string;
};

type SatelliteCardProps = {
  loading?: boolean;
  ndvi?: NdviPayload | null;
};

export function SatelliteCard({ loading = false, ndvi = null }: SatelliteCardProps) {
  const status = ndvi?.status || "no location";
  const isOk = !!ndvi && status.startsWith("ok");
  const score = ndvi?.satellite_score || 0;

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <Satellite className="h-4 w-4 text-primary" aria-hidden="true" />
            Satellite Analysis (Sentinel-2)
          </span>
          {ndvi?.anomaly === true ? (
            <Badge variant="destructive">Anomaly Detected</Badge>
          ) : ndvi?.anomaly === false ? (
            <Badge variant="secondary">Normal</Badge>
          ) : (
            <Badge variant="outline">{status}</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Fetching Sentinel-2 data (10m res)...
          </div>
        ) : !ndvi ? (
          <div className="text-sm text-muted-foreground">Add a location to run the satellite check.</div>
        ) : status.startsWith("unavailable") ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Slash className="mt-0.5 h-4 w-4" aria-hidden="true" />
            Satellite check unavailable (Earth Engine not authenticated).
          </div>
        ) : !isOk ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Slash className="mt-0.5 h-4 w-4" aria-hidden="true" />
            Satellite check: {ndvi.status}
          </div>
        ) : (
          <div className="space-y-3">
            {ndvi.anomaly ? (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <div className="font-medium text-destructive">Significant vegetation change</div>
                  <div className="text-muted-foreground">
                    High probability of recent disturbance or rapid growth.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <div className="font-medium text-primary">Stable vegetation</div>
                  <div className="text-muted-foreground">No significant anomalies in the last 60 days.</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-xs">
              <div>
                <span className="block text-muted-foreground">NDVI (Greenness)</span>
                <span className="font-medium text-lg">{ndvi.mean?.toFixed(2) ?? "—"}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">EVI (Canopy)</span>
                <span className="font-medium text-lg">{ndvi.evi?.toFixed(2) ?? "—"}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Change Δ</span>
                <span className={`font-medium text-lg ${ndvi.anomaly ? "text-destructive" : ""}`}>
                  {ndvi.change && ndvi.change > 0 ? "+" : ""}
                  {ndvi.change?.toFixed(2) ?? "—"}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Risk Score</span>
                <span className="font-medium text-lg">{(score * 100).toFixed(0)}/100</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
