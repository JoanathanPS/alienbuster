import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { apiFetchJson } from "@/lib/apiFetch";
import { resolveReportPhotoUrl } from "@/lib/reportPhotos";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SatelliteVegetationCheck } from "@/components/SatelliteVegetationCheck";

interface Report {
  id: number;
  created_at: string;
  user_id: string;
  user_email: string | null;
  lat: number | null; // backend uses 'lat'
  lon: number | null; // backend uses 'lon'
  photo_url: string | null;
  notes: string | null;
  status: string | null;
  species?: string | null;
  confidence?: number | null;
  is_invasive?: boolean | null;
  ml_confidence?: number | null; // backend uses 'ml_confidence'
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

        // Resolve signed URLs for thumbnails (backwards compatible with public URLs)
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
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h2 className="mb-4 text-xl font-bold text-foreground">My Reports</h2>

      {loading ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <FileText className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No reports found</p>
          <p className="text-xs text-muted-foreground">Submit a report to see it here</p>
        </div>
      ) : null}

      {!loading && reports.length > 0 ? (
        <div className="space-y-3">
        {reportsWithSpecies.map((r) => {
          const isOpen = openId === r.id;
          return (
            <Collapsible key={r.id} open={isOpen} onOpenChange={(v) => setOpenId(v ? r.id : null)}>
              <div className="rounded-xl border border-border bg-card">
                <div className="flex gap-3 p-3">
                  {photoUrlById[r.id] && (
                    <img src={photoUrlById[r.id] ?? undefined} alt="Report" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            r.status === "verified" && "bg-primary/15 text-primary",
                            r.status === "rejected" && "bg-destructive/15 text-destructive",
                            (!r.status || r.status === "pending") && "bg-accent/15 text-accent"
                          )}
                        >
                          {r.status || "pending"}
                        </span>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Toggle report details">
                            <ChevronDown
                              className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                              aria-hidden="true"
                            />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    {r.species && <div className="mt-1 text-sm font-medium">{r.species}</div>}

                    {r.lat != null && r.lon != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Location: {r.lat.toFixed(4)}, {r.lon.toFixed(4)}
                      </p>
                    )}

                    {r.notes && !isOpen && <p className="mt-1 truncate text-sm text-foreground">{r.notes}</p>}
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="space-y-3 border-t border-border p-3">
                    {r.notes && <div className="whitespace-pre-wrap text-sm text-muted-foreground">{r.notes}</div>}

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
      ) : null}
    </div>
  );
};

export default MyReports;
