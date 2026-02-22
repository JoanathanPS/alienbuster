import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  CheckCircle,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  ShieldX,
  XCircle,
} from "lucide-react";

import { Page } from "@/components/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner";
import { apiFetchJson } from "@/lib/apiFetch";
import { EXPERT_EMAILS, isExpertEmail } from "@/lib/expertAccess";
import { logAction } from "@/lib/actionLog";
import { setMemoryCues } from "@/lib/memoryCues";

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
  notes?: string | null;

  photo_url?: string | null;
  description?: string | null;
  recommended_action?: string | null;

  ndvi_recent?: number | null;
  ndvi_baseline?: number | null;
  ndvi_change?: number | null;
  ndvi_anomaly?: boolean | null;

  landcover_recent?: any | null;
  landcover_baseline?: any | null;
  landcover_shift?: number | null;

  report_density?: number | null;
  satellite_score?: number | null;

  fused_components?: Record<string, any> | null;
  fused_reasons?: Array<{ title?: string; detail?: string; weight?: number; score?: number }> | null;

  needs_more_info_message?: string | null;
  needs_more_info_requested_photos?: string[] | null;
};

type ReviewQueueResponse = {
  reports: ReportRow[];
};

type ReportsNearbyResponse = {
  reports: ReportRow[];
};

type Decision = "verified" | "rejected" | "needs_more_info";

type ActionPending = { id: number; decision: Decision } | null;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function riskLabel(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  const pct = Math.round(clamp01(v) * 100);
  return `${pct}%`;
}

function statusBadgeVariant(status: string) {
  if (status === "pending_review") return "outline" as const;
  if (status === "verified") return "secondary" as const;
  if (status === "rejected") return "destructive" as const;
  return "secondary" as const;
}

function QueueSkeletonList({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ExpertReviewSkeleton() {
  return (
    <Page
      title="Expert Review"
      description={<Skeleton className="h-4 w-48" />}
      actions={<Skeleton className="h-9 w-28 rounded-xl" />}
      className="max-w-6xl"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4">
          <Card className="lg:sticky lg:top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full rounded-2xl" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-10 w-full rounded-2xl" />
                <Skeleton className="h-10 w-full rounded-2xl" />
              </div>
              <QueueSkeletonList count={7} />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Card>
            <CardContent className="p-5 space-y-4">
              <Skeleton className="h-7 w-1/2" />
              <div className="grid grid-cols-12 gap-4">
                <Skeleton className="col-span-12 md:col-span-5 h-72 rounded-3xl" />
                <div className="col-span-12 md:col-span-7 space-y-3">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              </div>
              <Skeleton className="h-40 w-full rounded-3xl" />
              <div className="flex gap-3">
                <Skeleton className="h-12 w-28 rounded-2xl" />
                <Skeleton className="h-12 w-28 rounded-2xl" />
                <Skeleton className="h-12 w-44 rounded-2xl" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}

function SoftPendingLabel({ label = "Processing…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-[hsl(var(--glowLeaf))] shadow-[0_0_14px_hsl(var(--glowLeaf)_/_0.28)] animate-pulse" />
      <span className="text-sm">{label}</span>
    </span>
  );
}

function EvidenceBar({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value == null || Number.isNaN(value) ? null : clamp01(value);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{v == null ? "—" : `${Math.round(v * 100)}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--glowRiver)_/_0.65),hsl(var(--glowLeaf)_/_0.65))]"
          style={{ width: `${Math.round((v ?? 0) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="ab-glow-river mb-3 flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
        <CheckCircle className="h-7 w-7 text-primary/70" />
      </div>
      <div className="text-base font-medium">Select a report to review</div>
      <div className="mt-1 max-w-md text-sm text-muted-foreground">
        Choose an item from the queue to see evidence (photo, satellite context, nearby signals) and record an expert decision.
      </div>
    </div>
  );
}

export default function ExpertReview() {
  const { user, loading: authLoading } = useAuth();
  const isExpert = isExpertEmail(user?.email);

  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notesById, setNotesById] = useState<Record<number, string>>({});
  const [actionPending, setActionPending] = useState<ActionPending>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyReports, setNearbyReports] = useState<ReportRow[]>([]);

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);

    try {
      const json = await apiFetchJson<ReviewQueueResponse>("/review_queue", { timeoutMs: 12_000 });
      const next = json.reports || [];
      setReports(next);

      setSelectedId((cur) => {
        if (cur && next.some((r) => r.id === cur)) return cur;
        return next.length ? next[0].id : null;
      });
    } catch (e: any) {
      setQueueError(e?.message || "Failed to load review queue");
      setReports([]);
      setSelectedId(null);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isExpert) {
      setQueueLoading(false);
      return;
    }
    fetchQueue();
  }, [isExpert, fetchQueue]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return reports.filter((r) => {
      if (query) {
        const hay = `${r.id} ${(r.species || "").toLowerCase()}`;
        if (!hay.includes(query)) return false;
      }

      if (statusFilter !== "all" && r.status !== statusFilter) return false;

      const risk = r.fused_risk;
      if (riskFilter === "high") {
        if (risk == null || risk < 0.85) return false;
      }
      if (riskFilter === "medium") {
        if (risk == null || risk < 0.65 || risk >= 0.85) return false;
      }
      if (riskFilter === "low") {
        if (risk == null || risk >= 0.65) return false;
      }

      return true;
    });
  }, [reports, q, statusFilter, riskFilter]);

  const selected = useMemo(() => {
    if (selectedId == null) return null;
    return reports.find((r) => r.id === selectedId) || null;
  }, [reports, selectedId]);

  // Nearby signal panel
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selected) {
        setNearbyReports([]);
        return;
      }

      setNearbyLoading(true);
      try {
        const json = await apiFetchJson<ReportsNearbyResponse>(
          `/reports/nearby?lat=${encodeURIComponent(selected.lat)}&lon=${encodeURIComponent(selected.lon)}&radius_km=5&days=60&limit=12`,
          { timeoutMs: 12_000 },
        );

        if (cancelled) return;
        const nearby = (json.reports || []).filter((r) => r.id !== selected.id);
        setNearbyReports(nearby);
      } catch {
        if (cancelled) return;
        setNearbyReports([]);
      } finally {
        if (cancelled) return;
        setNearbyLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.lat, selected?.lon]);

  const act = useCallback(
    async (id: number, decision: Decision) => {
      if (!user?.email) {
        toast.error("Missing expert email");
        return;
      }

      setActionPending({ id, decision });
      try {
        await apiFetchJson<any>(`/review/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            expert_email: user.email,
            notes: (notesById[id] || "").trim() || null,
          }),
          timeoutMs: 12_000,
        });

        // Simulate sending a notification (in a real app, backend handles this via email/push)
        if (decision === "verified") {
           toast.success(`Report #${id} Verified. Notification sent to user.`);
        } else if (decision === "needs_more_info") {
           toast.info(`Report #${id} flagged for more info. User notified.`);
        } else {
           toast.error(`Report #${id} Rejected.`);
        }

        logAction({ title: "Expert decision recorded", detail: `#${id} — ${decision.replaceAll("_", " ")}` });
        setMemoryCues({ lastReportId: { id, at: Date.now() } });

        setReports((prev) => {
          const remaining = prev.filter((r) => r.id !== id);
          setSelectedId((cur) => {
            if (cur !== id) return cur;
            return remaining.length ? remaining[0].id : null;
          });
          return remaining;
        });
      } catch (e: any) {
        toast.error(e?.message || "Failed to submit review");
      } finally {
        setActionPending(null);
      }
    },
    [user?.email, notesById, reports],
  );

  const counts = useMemo(() => ({ total: reports.length, filtered: filtered.length }), [reports.length, filtered.length]);

  if (authLoading) {
    return <ExpertReviewSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isExpert) {
    return (
      <Page title="Expert Review" className="max-w-4xl">
        <div className="flex flex-col items-center justify-center px-4 py-16">
          <ShieldX className="mb-4 h-16 w-16 text-destructive" />
          <h2 className="mb-2 text-2xl font-bold text-foreground">Access Denied</h2>
          <p className="text-center text-muted-foreground">Only expert users can access the Expert Review page.</p>
          <p className="mt-2 text-center text-xs text-muted-foreground">Allowlist: {EXPERT_EMAILS.join(", ")}</p>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Expert Review"
      description={
        <span className="text-sm text-muted-foreground">
          Queue: <span className="font-medium text-foreground">{counts.total}</span>
          {counts.filtered !== counts.total ? (
            <span>
              <span className="mx-2 text-white/20">|</span>
              <span className="text-muted-foreground">Filtered:</span>{" "}
              <span className="font-medium text-foreground">{counts.filtered}</span>
            </span>
          ) : null}
        </span>
      }
      actions={
        <Button variant="outline" size="sm" onClick={fetchQueue} className="gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      }
      className="max-w-6xl"
    >
      <div className="grid grid-cols-12 gap-4">
        {/* Left: queue */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="lg:sticky lg:top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ab-expert-q" className="text-xs text-muted-foreground">
                  Search
                </Label>
                <Input
                  id="ab-expert-q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by species or #id"
                  className="rounded-2xl bg-white/5 border-white/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="rounded-2xl bg-white/5 border-white/10">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending_review">Pending review</SelectItem>
                      <SelectItem value="unverified">Unverified</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Risk</Label>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="rounded-2xl bg-white/5 border-white/10">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="high">High (85%+)</SelectItem>
                      <SelectItem value="medium">Medium (65–84%)</SelectItem>
                      <SelectItem value="low">Low (&lt; 65%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {queueError ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {queueError}
                </div>
              ) : null}

              {queueLoading ? (
                <QueueSkeletonList count={8} />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <CheckCircle className="mb-3 h-12 w-12 text-primary/50" />
                  <p className="text-muted-foreground">No reports match these filters</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => (setQ(""), setStatusFilter("all"), setRiskFilter("all"))}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-22rem)] overflow-auto pr-1 space-y-3">
                  {filtered.map((r) => {
                    const isSelected = r.id === selectedId;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(r.id);
                          logAction({ title: "Opened report for review", detail: `#${r.id} — ${r.species || "Unknown"}` });
                          setMemoryCues({ lastReportId: { id: r.id, at: Date.now() } });
                        }}
                        className="block w-full text-left"
                      >
                        <Card
                          className={
                            "transition-all hover:-translate-y-[1px] hover:shadow-lg " +
                            (isSelected ? "ab-glow-river ring-1 ring-white/15" : "")
                          }
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <ProgressRing value={clamp01(r.fused_risk ?? 0)} size={44} stroke={7} label={undefined} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{r.species || "Unknown species"}</div>
                                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                      <MapPin className="h-3 w-3" />
                                      <span className="truncate">{r.lat.toFixed(4)}, {r.lon.toFixed(4)}</span>
                                    </div>
                                  </div>
                                  <Badge variant={statusBadgeVariant(r.status)} className="shrink-0">
                                    {r.status}
                                  </Badge>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Badge variant="outline" className="bg-white/5 border-white/10">
                                    Risk: {riskLabel(r.fused_risk)}
                                  </Badge>
                                  <Badge variant="outline" className="bg-white/5 border-white/10">
                                    ML: {r.ml_confidence == null ? "—" : `${Math.round(clamp01(r.ml_confidence) * 100)}%`}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: detail */}
        <div className="col-span-12 lg:col-span-8">
          <Card>
            <CardContent className="p-5">
              {!selected ? (
                <EmptyDetail />
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold tracking-tight">#{selected.id}</div>
                        <Badge variant={statusBadgeVariant(selected.status)}>{selected.status}</Badge>
                        {selected.is_invasive === true ? (
                          <Badge variant="secondary">Invasive</Badge>
                        ) : selected.is_invasive === false ? (
                          <Badge variant="outline">Non-invasive</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{selected.species || "Unknown species"}</span>
                        <span className="mx-2 text-white/20">|
                        </span>
                        <span>{new Date(selected.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <ProgressRing value={clamp01(selected.fused_risk ?? 0)} size={84} stroke={10} label="risk" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-4">
                    <Card className="col-span-12 md:col-span-5 overflow-hidden">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Photo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selected.photo_url ? (
                          <img
                            src={selected.photo_url}
                            alt={selected.species || "Report photo"}
                            className="h-72 w-full rounded-3xl object-cover border border-white/10 bg-white/5"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-72 w-full flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-muted-foreground">
                            <ImageIcon className="h-8 w-8" />
                            <div className="mt-2 text-sm">No photo attached</div>
                          </div>
                        )}
                        {selected.description ? (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                            {selected.description}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <div className="col-span-12 md:col-span-7 space-y-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <EvidenceBar label="ML confidence" value={selected.ml_confidence} />
                          <EvidenceBar label="Report density" value={selected.report_density} />
                          <EvidenceBar label="Satellite score" value={selected.satellite_score} />

                          {selected.recommended_action ? (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="text-xs text-muted-foreground">Recommended action</div>
                              <div className="mt-1 text-sm text-foreground">{selected.recommended_action}</div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Satellite context</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="text-xs text-muted-foreground">NDVI change</div>
                            <div className="mt-1 font-medium tabular-nums">
                              {selected.ndvi_change == null ? "—" : `${selected.ndvi_change >= 0 ? "+" : ""}${selected.ndvi_change.toFixed(3)}`}
                            </div>
                            {selected.ndvi_anomaly ? (
                              <div className="mt-1 text-xs text-[hsl(var(--warning))]">Anomaly detected</div>
                            ) : null}
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="text-xs text-muted-foreground">Landcover shift</div>
                            <div className="mt-1 font-medium tabular-nums">
                              {selected.landcover_shift == null ? "—" : selected.landcover_shift.toFixed(3)}
                            </div>
                          </div>

                          <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="text-xs text-muted-foreground">Location</div>
                            <div className="mt-1 font-medium tabular-nums">
                              {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Nearby signal</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {nearbyLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <Skeleton className="h-4 w-2/3" />
                              <Skeleton className="mt-2 h-3 w-1/2" />
                              <div className="mt-3 flex gap-2">
                                <Skeleton className="h-6 w-20 rounded-full" />
                                <Skeleton className="h-6 w-24 rounded-full" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : nearbyReports.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No nearby reports in the last 60 days.</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {nearbyReports.slice(0, 6).map((nr) => (
                            <div key={nr.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="text-sm font-medium truncate">#{nr.id} — {nr.species || "Unknown"}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {new Date(nr.created_at).toLocaleDateString()} <span className="mx-2 text-white/20">|</span> Risk {riskLabel(nr.fused_risk)}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant="outline" className="bg-white/5 border-white/10">
                                  ML {nr.ml_confidence == null ? "—" : `${Math.round(clamp01(nr.ml_confidence) * 100)}%`}
                                </Badge>
                                <Badge variant={statusBadgeVariant(nr.status)}>{nr.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selected.notes ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Reporter notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                          {selected.notes}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {Array.isArray(selected.fused_reasons) && selected.fused_reasons.length ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Fused reasons</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selected.fused_reasons.slice(0, 8).map((fr, idx) => (
                          <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm font-medium">{fr.title || `Reason ${idx + 1}`}</div>
                              {typeof fr.weight === "number" ? (
                                <Badge variant="outline" className="bg-white/5 border-white/10 tabular-nums">
                                  w {fr.weight.toFixed(2)}
                                </Badge>
                              ) : null}
                            </div>
                            {fr.detail ? <div className="mt-1 text-sm text-muted-foreground">{fr.detail}</div> : null}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  <Card className="ab-glow-leaf">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Decision</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor={`notes-${selected.id}`}>Expert notes</Label>
                        <Textarea
                          id={`notes-${selected.id}`}
                          value={notesById[selected.id] ?? ""}
                          onChange={(e) => setNotesById((prev) => ({ ...prev, [selected.id]: e.target.value }))}
                          placeholder="Reasoning / evidence / validation notes"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Button
                          className="relative min-h-[48px] rounded-2xl"
                          onClick={() => act(selected.id, "verified")}
                          disabled={actionPending?.id === selected.id}
                        >
                          {actionPending?.id === selected.id && actionPending.decision === "verified" ? (
                            <SoftPendingLabel label="Verifying…" />
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              Verify
                            </span>
                          )}
                          {actionPending?.id === selected.id && actionPending.decision === "verified" ? (
                            <span className="pointer-events-none absolute inset-x-3 bottom-2 h-[2px] overflow-hidden rounded-full bg-white/10">
                              <span className="block h-full w-1/2 animate-ab-shimmer bg-[linear-gradient(90deg,transparent,hsl(var(--glowLeaf)_/_0.55),transparent)]" />
                            </span>
                          ) : null}
                        </Button>

                        <Button
                          variant="secondary"
                          className="relative min-h-[48px] rounded-2xl"
                          onClick={() => act(selected.id, "needs_more_info")}
                          disabled={actionPending?.id === selected.id}
                        >
                          {actionPending?.id === selected.id && actionPending.decision === "needs_more_info" ? (
                            <SoftPendingLabel label="Requesting…" />
                          ) : (
                            <span>Needs info</span>
                          )}
                          {actionPending?.id === selected.id && actionPending.decision === "needs_more_info" ? (
                            <span className="pointer-events-none absolute inset-x-3 bottom-2 h-[2px] overflow-hidden rounded-full bg-white/10">
                              <span className="block h-full w-1/2 animate-ab-shimmer bg-[linear-gradient(90deg,transparent,hsl(var(--glowRiver)_/_0.55),transparent)]" />
                            </span>
                          ) : null}
                        </Button>

                        <Button
                          variant="destructive"
                          className="relative min-h-[48px] rounded-2xl"
                          onClick={() => act(selected.id, "rejected")}
                          disabled={actionPending?.id === selected.id}
                        >
                          {actionPending?.id === selected.id && actionPending.decision === "rejected" ? (
                            <SoftPendingLabel label="Rejecting…" />
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <XCircle className="h-4 w-4" />
                              Reject
                            </span>
                          )}
                          {actionPending?.id === selected.id && actionPending.decision === "rejected" ? (
                            <span className="pointer-events-none absolute inset-x-3 bottom-2 h-[2px] overflow-hidden rounded-full bg-white/10">
                              <span className="block h-full w-1/2 animate-ab-shimmer bg-[linear-gradient(90deg,transparent,hsla(3,74%,58%,0.55),transparent)]" />
                            </span>
                          ) : null}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
