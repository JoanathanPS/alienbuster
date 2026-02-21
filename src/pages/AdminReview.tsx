// TODO: Later add real auth so only experts can access review page
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error && data) setReports(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, []);

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
            {r.photo_url && (
              <img src={r.photo_url} alt="Report" className="h-40 w-full object-cover" />
            )}
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  by {r.user_id}
                </span>
              </div>
              {r.latitude != null && r.longitude != null && (
                <p className="text-xs text-muted-foreground">
                  📍 {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </p>
              )}
              {r.notes && (
                <p className="mt-2 text-sm text-foreground">{r.notes}</p>
              )}
              <div className="mt-4 flex gap-3">
                <Button
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
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
                  className="flex-1"
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
