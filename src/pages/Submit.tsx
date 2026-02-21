import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, Loader2, Send } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Page } from "@/components/Page";
import { LocationInput } from "@/components/LocationInput";
import { ReportMap } from "@/components/ReportMap";
import { SatelliteVegetationCheck } from "@/components/SatelliteVegetationCheck";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// TODO: After photo selection, call backend /api/identify (Python BioCLIP) for species detection,
// then save species/confidence to DB.

type SubmitState = "form" | "submitting" | "success";

const formSchema = z.object({
  nickname: z.string().min(2, "Enter a nickname or ID"),
  notes: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  if (parts.length < 2) throw new Error("Invalid image data");

  const meta = parts[0];
  const b64 = parts.slice(1).join(",");
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || "image/jpeg";

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

type SubmittedReport = {
  latitude: number;
  longitude: number;
};

export default function Submit() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("form");
  const [submittedReport, setSubmittedReport] = useState<SubmittedReport | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { nickname: "", notes: "" },
  });

  const notesValue = form.watch("notes") || "";

  useEffect(() => {
    const photo = sessionStorage.getItem("report-photo");
    if (!photo) {
      navigate("/");
      return;
    }
    setPhotoPreview(photo);
  }, [navigate]);

  const canSubmit = useMemo(() => {
    return submitState !== "submitting";
  }, [submitState]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be signed in to submit a report");
      return;
    }

    if (!photoPreview) {
      toast.error("No photo found. Please go back and take a photo.");
      return;
    }

    if (latitude == null || longitude == null) {
      toast.error("Location is required. Please allow GPS or enter latitude/longitude.");
      return;
    }

    const ok = await form.trigger();
    if (!ok) return;

    const values = form.getValues();

    setSubmitState("submitting");

    try {
      const base64 = sessionStorage.getItem("report-photo-base64") || photoPreview;
      const blob = base64.startsWith("data:") ? dataUrlToBlob(base64) : await (await fetch(base64)).blob();

      // Store the storage object path in the DB (works great with signed URLs).
      // NOTE: If your bucket is public, this still works (we'll just resolve URLs normally).
      const photoPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("reports-photos")
        .upload(photoPath, blob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const baseNotes = [
        `Reporter: ${values.nickname}`,
        values.notes?.trim() ? values.notes.trim() : null,
      ]
        .filter(Boolean)
        .join("\n");

      const baseInsert: any = {
        user_id: user.id,
        latitude,
        longitude,
        // photo_url stores a storage path (or http URL for legacy rows)
        photo_url: photoPath,
        notes: baseNotes || null,
        status: "pending",
        user_email: user.email || null,
      };

      // Optional columns if you've migrated them
      const insertWithExtras: any = {
        ...baseInsert,
        reporter_nickname: values.nickname,
        species: null,
        confidence: null,
        is_invasive: null,
      };

      let insertError = (await supabase.from("reports").insert(insertWithExtras as any)).error;

      // Backwards compatible fallbacks if columns don't exist yet.
      if (insertError && /column .* (reporter_nickname|species|confidence|is_invasive)/i.test(insertError.message || "")) {
        insertError = (await supabase.from("reports").insert(baseInsert as any)).error;
      }

      if (insertError) throw insertError;

      setSubmittedReport({ latitude, longitude });
      setSubmitState("success");
      sessionStorage.removeItem("report-photo");
      sessionStorage.removeItem("report-photo-base64");
      toast.success("Thank you! Report submitted.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to submit report");
      setSubmitState("form");
    }
  };

  if (submitState === "success" && submittedReport) {
    return (
      <Page title="Thank you! Report submitted." description="Experts will verify your sighting soon.">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4">
            <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
            <div className="text-sm text-muted-foreground">Status: <span className="text-foreground font-medium">pending</span></div>
          </div>

          <ReportMap
            latitude={submittedReport.latitude}
            longitude={submittedReport.longitude}
            className="h-56 w-full overflow-hidden rounded-xl"
          />

          <SatelliteVegetationCheck
            latitude={submittedReport.latitude}
            longitude={submittedReport.longitude}
            species={null}
            isInvasive={false}
          />

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="min-h-[48px] flex-1"
              onClick={() => {
                navigate("/");
              }}
            >
              Submit another
            </Button>
            <Button
              className="min-h-[48px] flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => navigate("/my-reports")}
            >
              View my reports
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Complete report"
      description="Add your location and a short description so experts can verify faster."
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back
        </Button>
      }
    >
      <div className="space-y-5">
        {photoPreview && (
          <Card className="overflow-hidden">
            <img src={photoPreview} alt="Captured species" className="h-56 w-full object-cover" />
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
              Location (required)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LocationInput
              latitude={latitude}
              longitude={longitude}
              onLocationChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reporter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="nickname">Your nickname or ID</Label>
            <Input id="nickname" placeholder="e.g. Joanathan" {...form.register("nickname")} />
            {form.formState.errors.nickname?.message && (
              <div className="text-xs text-destructive">{form.formState.errors.nickname.message}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              placeholder="Describe what you saw, habitat details, behavior..."
              rows={4}
              maxLength={1000}
              {...form.register("notes")}
            />
            <div className="text-right text-xs text-muted-foreground">{notesValue.length}/1000</div>
          </CardContent>
        </Card>

        <Button
          type="button"
          className="h-12 w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitState === "submitting" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" aria-hidden="true" />
              Submit report
            </>
          )}
        </Button>
      </div>
    </Page>
  );
}
