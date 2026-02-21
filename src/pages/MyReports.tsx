import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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
}

const MyReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) setReports(data);
      setLoading(false);
    };
    fetchReports();
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h2 className="mb-4 text-xl font-bold text-foreground">All Reports</h2>

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
        {reports.map((r) => (
          <div key={r.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            {r.photo_url && (
              <img src={r.photo_url} alt="Report" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {r.user_email ? r.user_email + " · " : ""}
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  r.status === "verified" && "bg-primary/15 text-primary",
                  r.status === "rejected" && "bg-destructive/15 text-destructive",
                  (!r.status || r.status === "pending") && "bg-accent/15 text-accent",
                )}>
                  {r.status || "pending"}
                </span>
              </div>
              {r.latitude && r.longitude && (
                <p className="text-xs text-muted-foreground">
                  📍 {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </p>
              )}
              {r.notes && (
                <p className="mt-1 truncate text-sm text-foreground">{r.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyReports;
