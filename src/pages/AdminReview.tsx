import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { resolveReportPhotoUrl } from "@/lib/reportPhotos";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Report {
  id: number;
  created_at: string;
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  notes: string | null;
  status: string | null;
}

const AdminReview = () => {
  const { user, loading: authLoading } = useAuth();

  // IMPORTANT: Hard gate expert access to the allowlisted email only.
  const isExpert = user?.email === "expert@example.com";

  const [reports, setReports] = useState<Report[]>([]);
  const [photoUrlById, setPhotoUrlById] = useState<Record<number, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReports(data);
      const entries = await Promise.all(
        (data as Report[]).map(async (r) => [r.id, await resolveReportPhotoUrl(r.photo_url)] as const)
      );
      setPhotoUrlById(Object.fromEntries(entries));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isExpert) fetchPending();
    else setLoading(false);
  }, [isExpert]);

  const updateStatus = async (id: number, status: "verified" | "rejected") => {
    setUpdating(id);
    const { error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Report ${status}`);
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
    setUpdating(null);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isExpert) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <ShieldX className="mb-4 h-16 w-16 text-destructive" />
        <h2 className="mb-2 text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-center text-muted-foreground">
          Only expert users can access the Expert Review page.
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {/* TODO: Use Supabase auth roles for real expert access */}
          Temporary hack: allowlist expert@example.com.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h2 className="mb-1 text-xl font-bold text-foreground">Expert Review</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Review and verify pending reports
      </p>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <CheckCircle className="mb-3 h-12 w-12 text-primary/50" />
          <p className="text-muted-foreground">No pending reports</p>
        </div>
      )}

      <div className="space-y-4">
        {reports.map((r) => (
          <div key={r.id} className="overflow-hidden rounded-xl border border-border bg-card">
            {photoUrlById[r.id] && (
              <img src={photoUrlById[r.id] ?? undefined} alt="Report" className="h-40 w-full object-cover" />
            )}
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  by {r.user_id.slice(0, 8)}…
                </span>
              </div>
              {r.latitude != null && r.longitude != null && (
                <p className="text-xs text-muted-foreground">
                  Location: {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </p>
              )}
              {r.notes && (
                <p className="mt-2 text-sm text-foreground">{r.notes}</p>
              )}
              <div className="mt-4 flex gap-3">
                <Button
                  className="min-h-[48px] flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => updateStatus(r.id, "verified")}
                  disabled={updating === r.id}
                >
                  {updating === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><CheckCircle className="mr-2 h-4 w-4" /> Verify</>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  className="min-h-[48px] flex-1"
                  onClick={() => updateStatus(r.id, "rejected")}
                  disabled={updating === r.id}
                >
                  {updating === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><XCircle className="mr-2 h-4 w-4" /> Reject</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminReview;
