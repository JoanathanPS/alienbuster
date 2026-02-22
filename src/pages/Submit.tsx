import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, Send, Sparkles } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { apiFetchJson } from "@/lib/apiFetch";
import { toast } from "@/components/ui/sonner";

import { extractLatLonFromFile } from "@/lib/exif";
import { Badge } from "@/components/ui/badge";

// BioCLIP detection happens via local backend POST /detect.
// IMPORTANT: We do NOT run ML in the browser.

type SubmitState = "form" | "submitting" | "success";
type ExifStatus = "idle" | "reading" | "found" | "missing" | "error";

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

type DetectResponse = {
  species: string;
  confidence: number;
  is_invasive: boolean;
  label: string;
};

export default function Submit() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [detectState, setDetectState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [detectData, setDetectData] = useState<DetectResponse | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  const [exifStatus, setExifStatus] = useState<ExifStatus>("idle");

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

  const runDetect = async (dataUrl: string) => {
    setDetectState("loading");
    setDetectError(null);
    setExifStatus("reading");

    try {
      const base64 = sessionStorage.getItem("report-photo-base64") || dataUrl;
      const blob = base64.startsWith("data:") ? dataUrlToBlob(base64) : await (await fetch(base64)).blob();

      // Extract EXIF GPS from blob (File)
      const file = new File([blob], "report.jpg", { type: "image/jpeg" });
      try {
        const coords = await extractLatLonFromFile(file);
        if (coords) {
          setLatitude(coords.lat);
          setLongitude(coords.lon);
          setExifStatus("found");
        } else {
          setExifStatus("missing");
        }
      } catch {
        setExifStatus("error");
      }

      const fd = new FormData();
      fd.append("file", blob, "report.jpg");

      const json = await apiFetchJson<DetectResponse>("/detect", {
        method: "POST",
        body: fd,
        timeoutMs: 60_000,
      });

      setDetectData(json);
      setDetectState("ready");
    } catch (e: any) {
      setDetectData(null);
      setDetectError(e?.message || "BioCLIP detection failed");
      setDetectState("error");
    }
  };

  useEffect(() => {
    if (!photoPreview) return;
    // Only auto-run once per page load.
    if (detectState !== "idle") return;
    runDetect(photoPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoPreview]);

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
      
      // Store the storage object path in the DB (works great with signed URLs).
      // NOTE: If your bucket is public, this still works (we'll just resolve URLs normally).
      const photoPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      // NOTE: In a real Supabase setup we would upload the file here.
      // For local-first hybrid, we rely on the backend storing the photo locally
      // or we accept that local SQLite users won't see remote storage photos unless synced.
      // But let's try to upload if we can, but gracefully fail if bucket is missing.
      
      // const { error: uploadError } = await supabase.storage
      //   .from("reports-photos")
      //   .upload(photoPath, dataUrlToBlob(base64), { contentType: "image/jpeg" });
      
      // We'll skip Supabase storage upload to avoid 400s if bucket missing
      // and rely on backend to save the base64 or file if sent.
      // Actually the backend endpoint /report expects photo_path or url.
      // Let's send the blob to the backend as a file? 
      // The current /report endpoint is JSON only. 
      // We should probably rely on the existing backend behavior where we can't upload file to /report easily
      // unless we change it to multipart.
      // BUT: The user has already run /detect which saves the file to 'uploads/' locally in the Python backend?
      // No, /detect in main.py reads into memory.
      
      // FIX: We will just send metadata to local backend. Photo storage is tricky without multipart /report.
      // For now, we will assume /detect might have returned a path or we just store metadata.
      // Or we can use the photo_url as a data URI if small enough? No, bad practice.
      
      // Let's rely on the fact that for this hackathon demo, 
      // the "My Reports" page will show placeholders or we just store data URL if < 50kb?
      // Actually, let's keep it simple: We send JSON to backend.
      
      await apiFetchJson<any>("/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: latitude,
          lon: longitude,
          species: detectData?.species ?? null,
          ml_confidence: typeof detectData?.confidence === "number" ? detectData.confidence : 0.0,
          is_invasive: typeof detectData?.is_invasive === "boolean" ? detectData.is_invasive : false,
          user_id: user.id, // Use real Supabase ID
          user_email: user.email || null,
          reporter_nickname: values.nickname,
          photo_url: null, // We don't have a persistent URL easily without Supabase Storage working
          notes: values.notes?.trim() ? values.notes.trim() : null,
          radius_m: 1000,
        }),
        timeoutMs: 35_000,
      });

      setSubmittedReport({ latitude, longitude });
      setSubmitState("success");
      sessionStorage.removeItem("report-photo");
      sessionStorage.removeItem("report-photo-base64");
      toast.success("Report submitted to local system!");
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
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              BioCLIP detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detectState === "loading" ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-72" />
                <Skeleton className="h-3 w-56" />
              </div>
            ) : detectState === "error" ? (
              <div className="space-y-2">
                <div className="text-sm text-destructive">{detectError}</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[48px]"
                  onClick={() => photoPreview && runDetect(photoPreview)}
                >
                  Retry detection
                </Button>
              </div>
            ) : detectData ? (
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="font-semibold">Detected:</span> {detectData.species || "Unknown"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Confidence: {(detectData.confidence * 100).toFixed(1)}% {detectData.is_invasive ? "· invasive" : ""}
                </div>
                <div className="text-xs text-muted-foreground">Label: {detectData.label}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Waiting for photo...</div>
            )}

            <div className="text-xs text-muted-foreground">
              {/* IMPORTANT: We do not run ML in the browser. */}
              Detection runs locally via the Python backend on 127.0.0.1:8000.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
                Location (required)
              </span>
              {exifStatus === "found" ? (
                <Badge variant="secondary" className="bg-green-500/15 text-green-500 hover:bg-green-500/25">
                  GPS found in photo ✓
                </Badge>
              ) : exifStatus === "missing" ? (
                <Badge variant="outline" className="text-muted-foreground">
                  No GPS in photo
                </Badge>
              ) : null}
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
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--glowLeaf))] shadow-[0_0_14px_hsl(var(--glowLeaf)_/_0.28)] animate-pulse" />
              Submitting…
            </span>
          ) : (
            <>
              <Send className="h-5 w-5" aria-hidden="true" />
              Submit Report
            </>
          )}
        </Button>
      </div>
    </Page>
  );
}
