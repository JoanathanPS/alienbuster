import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Plus, ShieldCheck, Clock, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { apiFetchJson } from "@/lib/apiFetch";
import { resolveReportPhotoUrl } from "@/lib/reportPhotos";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/Page";
import { SatelliteVegetationCheck } from "@/components/SatelliteVegetationCheck";

interface Report {
  id: number;
  created_at: string;
  user_id: string;
  user_email: string | null;
  lat: number | null;
  lon: number | null;
  photo_url: string | null;
  notes: string | null;
  status: string | null;
  species?: string | null;
  confidence?: number | null;
  is_invasive?: boolean | null;
  ml_confidence?: number | null;
}

function extractSpecies(notes: string | null): string | null {
  if (!notes) return null;
  const line = notes.split("\n").find((l) => l.toLowerCase().startsWith("bioclip:"));
  if (!line) return null;
  const m = line.match(/BioCLIP:\s*(.*?)\s*(\(|$)/i);
  return m?.[1]?.trim() || null;
}

const MyReports = () => {
  const { user, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [photoUrlById, setPhotoUrlById] = useState<Record<number, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const reportsWithSpecies = useMemo(() => {
    return reports.map((r) => ({ ...r, species: r.species || extractSpecies(r.notes) }));
  }, [reports]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setReports([]);
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
      setLoading(true);
      try {
        const json = await apiFetchJson<{ reports: Report[] }>(`/my_reports?user_id=${user.id}`);
        const data = json.reports || [];
        setReports(data);

        const entries = await Promise.all(
          data.map(async (r) => [r.id, await resolveReportPhotoUrl(r.photo_url)] as const)
        );
        setPhotoUrlById(Object.fromEntries(entries));
      } catch (e) {
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [authLoading, user]);

  return (
    <Page
      title={
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          My Field Reports
        </div>
      }
      description="Track the verification status, BioCLIP analysis, and satellite intelligence of your sightings."
      actions={
        <Button asChild size="sm" className="gap-2">
          <Link to="/submit">
            <Plus className="h-4 w-4" />
            New Sighting
          </Link>
        </Button>
      }
      className="max-w-4xl"
    >
      {loading ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-16 w-16 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No reports recorded</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            You haven’t submitted any invasive species sightings yet. Every observation helps protect biodiversity.
          </p>
          <Button asChild size="sm" className="mt-5 gap-2">
            <Link to="/submit">
              <Plus className="h-4 w-4" />
              Submit your first sighting
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reportsWithSpecies.map((r) => {
            const isOpen = openId === r.id;
            return (
              <Collapsible key={r.id} open={isOpen} onOpenChange={(v) => setOpenId(v ? r.id : null)}>
                <div className="rounded-xl border border-border bg-card/70 transition-all hover:bg-card">
                  <div className="flex items-start gap-4 p-4">
                    {photoUrlById[r.id] ? (
                      <img
                        src={photoUrlById[r.id] ?? undefined}
                        alt="Report observation"
                        className="h-16 w-16 shrink-0 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
                        <FileText className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-xs text-muted-foreground/60">• #{r.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                              r.status === "verified" && "bg-primary/15 text-primary border border-primary/20",
                              r.status === "rejected" && "bg-destructive/15 text-destructive border border-destructive/20",
                              (!r.status || r.status === "pending") && "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                            )}
                          >
                            {r.status === "verified" && <ShieldCheck className="h-3 w-3" />}
                            {r.status === "rejected" && <XCircle className="h-3 w-3" />}
                            {(!r.status || r.status === "pending") && <Clock className="h-3 w-3" />}
                            {r.status || "pending review"}
                          </span>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Toggle details">
                              <ChevronDown
                                className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")}
                                aria-hidden="true"
                              />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>

                      <div className="mt-1 flex items-baseline gap-2">
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {r.species || "Unclassified Specimen"}
                        </h4>
                        {r.ml_confidence != null && (
                          <span className="text-[11px] text-muted-foreground">
                            ({Math.round(r.ml_confidence * 100)}% match)
                          </span>
                        )}
                      </div>

                      {r.lat != null && r.lon != null && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Location: {r.lat.toFixed(4)}, {r.lon.toFixed(4)}
                        </p>
                      )}

                      {r.notes && !isOpen && <p className="mt-1 truncate text-xs text-muted-foreground">{r.notes}</p>}
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-3 border-t border-border bg-card/40 p-4">
                      {r.notes && (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground block mb-1">Field Notes:</span>
                          {r.notes}
                        </div>
                      )}

                      {r.lat != null && r.lon != null && (
                        <SatelliteVegetationCheck
                          latitude={r.lat}
                          longitude={r.lon}
                          species={r.species}
                          isInvasive={r.is_invasive ?? false}
                        />
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </Page>
  );
};

export default MyReports;
