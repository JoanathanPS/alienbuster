import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveReportPhotoUrl } from "@/lib/reportPhotos";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { SatelliteVegetationCheck } from "@/components/SatelliteVegetationCheck";

interface Report {
  id: number;
  created_at: string;
  user_id: string;
  user_email: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  notes: string | null;
  status: string | null;
  species?: string | null;
  confidence?: number | null;
  is_invasive?: boolean | null;
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
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setReports(data);

        // Resolve signed URLs for thumbnails (backwards compatible with public URLs)
        const entries = await Promise.all(
          (data as Report[]).map(async (r) => [r.id, await resolveReportPhotoUrl(r.photo_url)] as const)
        );
        setPhotoUrlById(Object.fromEntries(entries));
      } else {
        setReports([]);
      }

      setLoading(false);
    };

    fetchReports();
  }, [authLoading, user]);

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h2 className="mb-4 text-xl font-bold text-foreground">My Reports</h2>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <FileText className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No reports found</p>
          <p className="text-xs text-muted-foreground">Submit a report to see it here</p>
        </div>
      )}

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
                      <p className="text-xs text-muted-foreground">
                        {r.user_email ? r.user_email + " · " : ""}
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
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

                    {r.latitude != null && r.longitude != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Location: {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                      </p>
                    )}

                    {r.notes && !isOpen && <p className="mt-1 truncate text-sm text-foreground">{r.notes}</p>}
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="space-y-3 border-t border-border p-3">
                    {r.notes && <div className="whitespace-pre-wrap text-sm text-muted-foreground">{r.notes}</div>}

                    {r.latitude != null && r.longitude != null && (
                      <SatelliteVegetationCheck
                        latitude={r.latitude}
                        longitude={r.longitude}
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
    </div>
  );
};

export default MyReports;
