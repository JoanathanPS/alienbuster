import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Loader2, CheckCircle, ArrowLeft, AlertTriangle, Bug } from "lucide-react";
import { SatelliteCard } from "@/components/SatelliteCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationInput } from "@/components/LocationInput";
import { ReportMap } from "@/components/ReportMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type SubmitState = "form" | "submitting" | "success";

interface SubmittedReport {
  latitude: number;
  longitude: number;
}

const FAKE_SPECIES = ["Kudzu Vine", "Burmese Python", "Lionfish", "Asian Carp", "Unknown"];

const Submit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("form");
  const [submittedReport, setSubmittedReport] = useState<SubmittedReport | null>(null);

  // TODO: Replace fake detection with real call to /api/identify (Python BioCLIP backend) after photo upload
  const [detectionLoading, setDetectionLoading] = useState(true);
  const [detectedSpecies, setDetectedSpecies] = useState<string | null>(null);
  const [detectedConfidence, setDetectedConfidence] = useState<number | null>(null);

  useEffect(() => {
    const photo = sessionStorage.getItem("report-photo");
    if (!photo) {
      navigate("/");
      return;
    }
    setPhotoPreview(photo);

    // Simulate BioCLIP analysis with 2-3s delay
    setDetectionLoading(true);
    const delay = 2000 + Math.random() * 1000;
    const timer = setTimeout(() => {
      const species = FAKE_SPECIES[Math.floor(Math.random() * FAKE_SPECIES.length)];
      const confidence = Math.floor(70 + Math.random() * 26);
      setDetectedSpecies(species);
      setDetectedConfidence(confidence);
      setDetectionLoading(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [navigate]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be signed in to submit a report");
      return;
    }
    if (!photoPreview) {
      toast.error("No photo found. Please go back and take a photo.");
      return;
    }

    setSubmitState("submitting");

    try {
      const base64 = sessionStorage.getItem("report-photo-base64") || photoPreview;
      const res = await fetch(base64);
      const blob = await res.blob();

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("reports-photos")
        .upload(fileName, blob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("reports-photos")
        .getPublicUrl(fileName);

      // TODO: After photo upload, call backend API /api/identify (Python BioCLIP) for species detection

      const { error: insertError } = await supabase.from("reports").insert({
        user_id: user.id,
        latitude,
        longitude,
        photo_url: urlData.publicUrl,
        notes: notes.trim() || null,
        status: "pending",
        user_email: user.email || null,
      } as any);

      if (insertError) throw insertError;

      setSubmittedReport({ latitude: latitude || 0, longitude: longitude || 0 });
      setSubmitState("success");
      sessionStorage.removeItem("report-photo");
      sessionStorage.removeItem("report-photo-base64");
      toast.success("Report submitted successfully!");
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error(err.message || "Failed to submit report");
      setSubmitState("form");
    }
  };

  if (submitState === "success" && submittedReport) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 pb-24">
        <CheckCircle className="mb-4 h-16 w-16 text-primary" />
        <h2 className="mb-2 text-2xl font-bold text-foreground">Thank You!</h2>
        <p className="mb-6 text-center text-muted-foreground">
          Your report has been submitted to help protect nature.
        </p>
        {submittedReport.latitude !== 0 && (
          <ReportMap
            latitude={submittedReport.latitude}
            longitude={submittedReport.longitude}
            className="mb-6 h-48 w-full max-w-sm overflow-hidden rounded-xl"
          />
        )}
        <SatelliteCard />
        <div className="mt-6 flex w-full max-w-sm gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>
            Submit another
          </Button>
          <Button className="flex-1 bg-primary" onClick={() => navigate("/my-reports")}>
            View my reports
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <button onClick={() => navigate("/")} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h2 className="mb-6 text-xl font-bold text-foreground">Complete Your Report</h2>

      {photoPreview && (
        <div className="mb-4 overflow-hidden rounded-xl border border-border">
          <img src={photoPreview} alt="Captured species" className="h-48 w-full object-cover" />
        </div>
      )}

      {detectionLoading && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card p-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Analyzing with BioCLIP...</span>
        </div>
      )}
      {!detectionLoading && detectedSpecies && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Bug className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Detected: {detectedSpecies}</p>
              <p className="text-xs text-muted-foreground">Confidence: {detectedConfidence}%</p>
            </div>
          </div>
          {detectedSpecies !== "Unknown" && (
            <div className="flex items-center gap-2 rounded-xl border border-accent bg-accent/10 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-accent" />
              <p className="text-xs font-medium text-accent">Potential invasive species — report submitted for review</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-5">
        <LocationInput
          latitude={latitude}
          longitude={longitude}
          onLocationChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
        />

        <div className="space-y-2">
          <Label htmlFor="notes">Notes / Description (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Describe what you saw, habitat details, behavior..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <p className="text-right text-xs text-muted-foreground">{notes.length}/500</p>
        </div>

        <Button
          className="h-14 w-full gap-2 rounded-xl bg-accent text-lg font-semibold text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
          onClick={handleSubmit}
          disabled={submitState === "submitting"}
        >
          {submitState === "submitting" ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</>
          ) : (
            <><Send className="h-5 w-5" /> Submit Report</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Submit;
