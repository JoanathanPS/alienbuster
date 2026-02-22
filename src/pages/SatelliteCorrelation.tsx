import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  MapPin,
  Radar,
  RefreshCw,
  Satellite,
  Send,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Page } from "@/components/Page";
import { ReportMap } from "@/components/ReportMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { apiFetchJson } from "@/lib/apiFetch";
import { toast } from "@/components/ui/sonner";
import { logAction } from "@/lib/actionLog";
import { setMemoryCues } from "@/lib/memoryCues";

type SatelliteChangeResponse = {
  radius_m: number;
  recent_window: { start: string; end: string };
  baseline_window: { start: string; end: string };

  recent_ndvi: number | null;
  baseline_ndvi: number | null;
  change: number | null;
  anomaly: boolean | null;

  ndvi_timeseries: Array<{ date: string; ndvi: number | null }>;

  landcover_recent: null | {
    top_classes: Array<{ name: string; probability: number }>;
    probs: Record<string, number>;
  };
  landcover_baseline: null | {
    top_classes: Array<{ name: string; probability: number }>;
    probs: Record<string, number>;
  };
  landcover_shift: number | null;
};

type ReportRow = {
  id: number;
  created_at: string;
  lat: number;
  lon: number;
  species: string | null;
  ml_confidence: number | null;
  is_invasive: boolean | null;
  status: string;
  fused_risk: number | null;
};

type NearbyResponse = {
  reports: ReportRow[];
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function densityScoreFromCount(count: number) {
  // Match backend mapping: 1-exp(-count/3)
  return clamp01(1 - Math.exp(-count / 3));
}

function satelliteScore(anomaly: boolean | null, landcoverShift: number | null) {
  const base = anomaly === true ? 0.8 : 0.2;
  const shift = 0.6 * (landcoverShift ?? 0);
  return clamp01(base + shift);
}

import { PlusCircle } from "lucide-react";
import { Link } from "react-router-dom";

// ... existing imports

export default function SatelliteCorrelation() {
  // ... existing state

  return (
    <Page
      title={
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" aria-hidden="true" />
          Satellite & Correlation
        </div>
      }
      description="Analyze vegetation + land-cover change and correlate with nearby reports."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/dataset">
              <PlusCircle className="mr-2 h-4 w-4" />
              Ingest Dataset
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={run} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Analyze
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" aria-hidden="true" /> Location
              </span>
              {correlationBadge}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lon">Longitude</Label>
                <Input id="lon" value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="radius">Radius (m)</Label>
                <Input id="radius" value={radiusM} onChange={(e) => setRadiusM(e.target.value)} inputMode="numeric" />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="secondary" className="w-full" onClick={useMyLocation}>
                  Use my location
                </Button>
              </div>
            </div>

            {Number.isFinite(latNum) && Number.isFinite(lonNum) ? (
              <ReportMap latitude={latNum} longitude={lonNum} className="h-56 w-full overflow-hidden rounded-xl" />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Satellite className="h-4 w-4 text-primary" aria-hidden="true" /> Satellite change
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {satLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-56 w-full" />
              </div>
            ) : satError ? (
              <div className="space-y-2">
                <div className="text-sm text-destructive">{satError}</div>
                <div className="text-xs text-muted-foreground">
                  If Earth Engine isn’t authenticated, run <code>earthengine authenticate</code>.
                </div>
              </div>
            ) : !satData ? (
              <div className="text-sm text-muted-foreground">Run analysis to load satellite data.</div>
            ) : (
              <>
                {satData.anomaly === true ? (
                  <div className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                    <div>
                      <div className="font-medium text-destructive">Vegetation anomaly detected</div>
                      <div className="text-muted-foreground">NDVI dropped compared to last year’s baseline window.</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No major NDVI anomaly detected.</div>
                )}

                <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-xs">
                  <div>
                    <span className="block text-muted-foreground">Recent NDVI</span>
                    <span className="font-medium text-lg">{satData.recent_ndvi?.toFixed(2) ?? "—"}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground">Baseline NDVI</span>
                    <span className="font-medium text-lg">{satData.baseline_ndvi?.toFixed(2) ?? "—"}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground">Change Δ</span>
                    <span className={`font-medium text-lg ${satData.anomaly ? "text-destructive" : ""}`}>
                      {typeof satData.change === "number" && satData.change > 0 ? "+" : ""}
                      {typeof satData.change === "number" ? satData.change.toFixed(2) : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground">Landcover shift</span>
                    <span className="font-medium text-lg">{satData.landcover_shift?.toFixed(2) ?? "—"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">NDVI timeseries (last ~90 days)</div>
                  <div className="h-56 w-full rounded-lg border p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="ndvi" stroke="#22c55e" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Recent window: {satData.recent_window.start} → {satData.recent_window.end}
                    {"\n"}
                    Baseline window: {satData.baseline_window.start} → {satData.baseline_window.end}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Dynamic World (baseline)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {satData.landcover_baseline?.top_classes?.length ? (
                        <ul className="space-y-1 text-sm">
                          {satData.landcover_baseline.top_classes.map((c) => (
                            <li key={c.name} className="flex items-center justify-between">
                              <span>{c.name}</span>
                              <span className="text-muted-foreground">{Math.round(c.probability * 100)}%</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-muted-foreground">No landcover data.</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Dynamic World (recent)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {satData.landcover_recent?.top_classes?.length ? (
                        <ul className="space-y-1 text-sm">
                          {satData.landcover_recent.top_classes.map((c) => (
                            <li key={c.name} className="flex items-center justify-between">
                              <span>{c.name}</span>
                              <span className="text-muted-foreground">{Math.round(c.probability * 100)}%</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-muted-foreground">No landcover data.</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="h-4 w-4 text-primary" aria-hidden="true" /> Correlation & risk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="species">Species (hypothesis)</Label>
                <Input id="species" value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="Kudzu" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invasive">Invasive?</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={isInvasive ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setIsInvasive(true)}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={!isInvasive ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setIsInvasive(false)}
                  >
                    No
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">ML confidence</span>
                <span className="text-muted-foreground">{Math.round(mlConfidence * 100)}%</span>
              </div>
              <Slider
                value={[mlConfidence]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => setMlConfidence(v[0] ?? 0)}
              />
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-card/20 p-4 md:grid-cols-[140px_1fr]">
              <div className="flex items-center justify-center">
                <ProgressRing value={fusedRisk} label="Fused risk" pulse={fusedRisk >= 0.85} />
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Density</div>
                    <div className="mt-1 font-semibold">{nearbyDensity.score.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Satellite</div>
                    <div className="mt-1 font-semibold">{satScore.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">ML</div>
                    <div className="mt-1 font-semibold">{mlConfidence.toFixed(2)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Breakdown</div>
                  <div className="space-y-2">
                    {[
                      { k: "ML confidence", v: mlConfidence, tint: "bg-primary/25" },
                      { k: `Local density (${nearbyDensity.count})`, v: nearbyDensity.score, tint: "bg-primary/20" },
                      { k: "Satellite change", v: satScore, tint: "bg-primary/15" },
                    ].map((row) => (
                      <div key={row.k} className="flex items-center gap-3">
                        <div className="w-36 text-[11px] text-muted-foreground truncate">{row.k}</div>
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full border border-white/10 bg-card/20">
                          <div className={`absolute inset-y-0 left-0 ${row.tint}`} style={{ width: `${Math.round(row.v * 100)}%` }} />
                        </div>
                        <div className="w-10 text-right text-[11px] text-muted-foreground tabular-nums">
                          {Math.round(row.v * 100)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any context for reviewers / agencies" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="min-h-[48px] flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={createReport}
                disabled={creatingReport}
              >
                <Send className="mr-2 h-4 w-4" />
                {creatingReport ? "Creating…" : "Create report (local DB)"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-[48px] flex-1"
                onClick={generateAlert}
              >
                <Satellite className="mr-2 h-4 w-4" /> Generate alert
              </Button>
            </div>

            {createdReportId != null ? (
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">Created report: #{createdReportId}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  This report will appear in the Expert Review queue if it’s pending review or high-risk.
                </div>
              </div>
            ) : null}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Nearby reports (within 5km, last 30d)</CardTitle>
              </CardHeader>
              <CardContent>
                {nearbyLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : nearbyError ? (
                  <div className="text-sm text-destructive">{nearbyError}</div>
                ) : nearby?.reports?.length ? (
                  <div className="space-y-2">
                    {nearby.reports.slice(0, 10).map((r) => (
                      <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            #{r.id} {r.species || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString()} • {r.status}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          risk {r.fused_risk?.toFixed(2) ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No nearby reports yet.</div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 text-xs text-muted-foreground">
            Tip: if satellite data is unavailable, you can still create reports and run the expert validation flow locally.
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
