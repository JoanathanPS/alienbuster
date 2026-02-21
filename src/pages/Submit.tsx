import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bug, CheckCircle, Loader2, Send, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";

import { Page } from "@/components/Page";
import { LocationInput } from "@/components/LocationInput";
import { ReportMap } from "@/components/ReportMap";
import { SatelliteCard, type NdviPayload } from "@/components/SatelliteCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl } from "@/lib/api";
import { toast } from "sonner";

type SubmitState = "form" | "submitting" | "success";

type OrganismType = "unknown" | "plant" | "animal" | "insect" | "aquatic";

type ReportDetailsForm = {
  organismType: OrganismType;
  notes: string;
};

type SpeciesInfo = {
  description: string | null;
  image_url: string | null;
  url: string | null;
};

type LocationData = {
  latitude: number | null;
  longitude: number | null;
  source: "exif" | "manual";
};

type IdentifyResponse = {
  species: string;
  confidence: number;
  is_invasive: boolean;
  raw_label: string;
  species_info?: SpeciesInfo;
  location?: LocationData;
};

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  if (parts.length < 2) {
    throw new Error("Invalid image data");
  }

  const meta = parts[0];
  const b64 = parts.slice(1).join(",");
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || "image/jpeg";

  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

interface SubmittedReport {
  latitude: number;
  longitude: number;
}

const Submit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("form");
  const [submittedReport, setSubmittedReport] = useState<SubmittedReport | null>(null);
  
  // Track which photo we've already identified to prevent re-running on every location change
  const identifiedPhotoRef = useRef<string | null>(null);

  const form = useForm<ReportDetailsForm>({
    defaultValues: {
      organismType: "unknown",
      notes: "",
    },
  });

  const notesValue = form.watch("notes");

  const [identifyLoading, setIdentifyLoading] = useState(true);
  const [identify, setIdentify] = useState<IdentifyResponse | null>(null);
  const [identifyError, setIdentifyError] = useState<string | null>(null);

  const [mlStatus, setMlStatus] = useState<"unknown" | "online" | "warming" | "offline" | "error">("unknown");

  const [ndviLoading, setNdviLoading] = useState(false);
  const [ndvi, setNdvi] = useState<NdviPayload | null>(null);

  const runIdentify = useCallback(async () => {
    if (!photoPreview) return;

    setIdentifyLoading(true);
    setIdentifyError(null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);

    try {
      const base64 = sessionStorage.getItem("report-photo-base64") || photoPreview;
      const blob = base64.startsWith("data:") ? dataUrlToBlob(base64) : await (await fetch(base64)).blob();

      const formData = new FormData();
      formData.append("file", blob, "report.jpg");
      // Don't send lat/lon initially - let backend extract from EXIF

      const r = await fetch(apiUrl("/api/identify"), {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (r.status === 503) {
        setMlStatus("warming");
      }

      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `Identify failed: ${r.status}`);
      }

      const data = (await r.json()) as IdentifyResponse;
      setIdentify(data);
      setMlStatus("online");
      
      // Auto-populate location from EXIF if available
      if (data.location?.latitude && data.location?.longitude) {
        setLatitude(data.location.latitude);
        setLongitude(data.location.longitude);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setIdentifyError("Model request timed out. Make sure the ML server is running: npm run ml:start");
      } else {
        setIdentifyError(e?.message || "Failed to run BioCLIP");
      }
      setMlStatus("offline");
    } finally {
      window.clearTimeout(timeout);
      setIdentifyLoading(false);
    }
  }, [photoPreview]);

  useEffect(() => {
    const photo = sessionStorage.getItem("report-photo");
    if (!photo) {
      navigate("/");
      return;
    }

    setPhotoPreview(photo);
  }, [navigate]);

  useEffect(() => {
    if (!photoPreview) return;
    
    // Only run identify once per unique photo
    if (identifiedPhotoRef.current === photoPreview) return;
    identifiedPhotoRef.current = photoPreview;

    // Ping backend health first so we can show a clear status.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);

    fetch(apiUrl("/api/health"), { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        const model = data?.model;
        if (model?.loaded) setMlStatus("online");
        else if (model?.loading) setMlStatus("warming");
        else setMlStatus("unknown");
      })
      .catch(() => setMlStatus("offline"))
      .finally(() => window.clearTimeout(timeout));

    runIdentify();

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [photoPreview, runIdentify]);

  // When we have a location, run the satellite NDVI check.
  useEffect(() => {
    if (latitude == null || longitude == null) {
      setNdvi(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setNdviLoading(true);
      try {
        const formData = new FormData();
        formData.append("lat", String(latitude));
        formData.append("lon", String(longitude));

        const r = await fetch(apiUrl("/api/ndvi"), {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(text || `NDVI failed: ${r.status}`);
        }

        const data = (await r.json()) as NdviPayload;
        setNdvi(data);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setNdvi({ mean: null, change: null, anomaly: null, status: e?.message || "error" });
        }
      } finally {
        setNdviLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [latitude, longitude]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be signed in to submit a report");
      return;
    }
    if (!photoPreview) {
      toast.error("No photo found. Please go back and take a photo.");
      return;
    }

    const values = form.getValues();
    const notes = values.notes?.trim() || "";

    const fullNotes = [
      values.organismType !== "unknown" ? `Type: ${values.organismType}` : null,
      identify ? `BioCLIP: ${identify.species} (${Math.round(identify.confidence * 100)}%)` : null,
      identify && identify.is_invasive ? "Status: Potentially Invasive" : null,
      ndvi?.status === "ok" && ndvi.mean != null
        ? `NDVI mean: ${ndvi.mean.toFixed(3)} (Δ ${ndvi.change?.toFixed(3) ?? "—"})`
        : null,
      notes || null,
    ]
      .filter(Boolean)
      .join("\n");

    setSubmitState("submitting");

    try {
      const base64 = sessionStorage.getItem("report-photo-base64") || photoPreview;
      const blob = base64.startsWith("data:") ? dataUrlToBlob(base64) : await (await fetch(base64)).blob();

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("reports-photos")
        .upload(fileName, blob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("reports-photos")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("reports").insert({
        user_id: user.id,
        latitude,
        longitude,
        photo_url: urlData.publicUrl,
        notes: fullNotes || null,
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

  const confidencePct = useMemo(() => {
    if (!identify) return null;
    return Math.round(identify.confidence * 100);
  }, [identify]);

  const invasiveLabel = useMemo(() => {
    if (!identify) return null;
    return identify.is_invasive ? "Potential invasive" : "Likely native / unknown";
  }, [identify]);

  const submitDisabled = submitState === "submitting";

  if (submitState === "success" && submittedReport) {
    return (
      <Page title="Report submitted" description="Thanks — this helps us detect outbreaks earlier." >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
          <CheckCircle className="h-16 w-16 text-primary" />

          {identify && (
            <Card className="w-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-primary" aria-hidden="true" />
                    BioCLIP result
                  </span>
                  <Badge variant={identify.is_invasive ? "destructive" : "secondary"}>{invasiveLabel}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Detected: <span className="font-medium text-foreground">{identify.species}</span> · Confidence: {confidencePct}%
              </CardContent>
            </Card>
          )}

          {submittedReport.latitude !== 0 && (
            <ReportMap
              latitude={submittedReport.latitude}
              longitude={submittedReport.longitude}
              className="h-56 w-full overflow-hidden rounded-xl"
            />
          )}

          <SatelliteCard loading={ndviLoading} ndvi={ndvi} />

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>
              Submit another
            </Button>
            <Button className="flex-1" onClick={() => navigate("/my-reports")}>
              View my reports
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={
        <div className="flex items-center gap-2">
          Complete report
          <Badge variant="outline">citizen + satellite</Badge>
        </div>
      }
      description="Add details for verification and faster response."
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
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-primary" aria-hidden="true" />
                BioCLIP detection
              </span>
              {identify ? (
                <Badge variant={identify.is_invasive ? "destructive" : "secondary"}>{invasiveLabel}</Badge>
              ) : mlStatus === "warming" ? (
                <Badge variant="outline">warming up</Badge>
              ) : mlStatus === "offline" ? (
                <Badge variant="destructive">offline</Badge>
              ) : (
                <Badge variant="outline">pending</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {identifyLoading ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {mlStatus === "offline"
                    ? "ML server offline"
                    : mlStatus === "warming"
                      ? "Warming up model..."
                      : "Running model..."}
                </div>
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : identifyError ? (
              <div className="space-y-2">
                <div className="text-sm text-destructive">{identifyError}</div>
                <Button type="button" variant="outline" size="sm" onClick={runIdentify}>
                  Retry detection
                </Button>
              </div>
            ) : identify ? (
              <div className="text-sm text-muted-foreground space-y-3">
                <div>
                  <div className="font-medium text-foreground text-lg">{identify.species}</div>
                  <div className="text-xs mt-1">Confidence: {confidencePct}%</div>
                </div>
                {identify.is_invasive && (
                  <div className="mt-2 text-destructive font-medium text-sm flex items-center gap-1">
                    ⚠️ Potential Invasive Species
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No detection result.</div>
            )}
          </CardContent>
        </Card>

        {identify?.species_info && (identify.species_info.description || identify.species_info.image_url) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Species Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {identify.species_info.image_url && (
                <img 
                  src={identify.species_info.image_url} 
                  alt={identify.species} 
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              {identify.species_info.description && (
                <div className="text-sm text-muted-foreground">
                  {identify.species_info.description}
                </div>
              )}
              {identify.species_info.url && (
                <a 
                  href={identify.species_info.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-primary hover:underline"
                >
                  Learn more on Wikipedia →
                </a>
              )}
            </CardContent>
          </Card>
        )}

        <SatelliteCard loading={ndviLoading} ndvi={ndvi} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Location</CardTitle>
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
            <CardTitle className="text-base">Report details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <FormField
                  control={form.control}
                  name="organismType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What did you see?</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unknown">Not sure</SelectItem>
                          <SelectItem value="plant">Plant</SelectItem>
                          <SelectItem value="animal">Animal</SelectItem>
                          <SelectItem value="insect">Insect</SelectItem>
                          <SelectItem value="aquatic">Aquatic</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Helps triage the report and route to the right experts.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what you saw, habitat details, behavior..."
                          maxLength={500}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <div className="text-right text-xs text-muted-foreground">{notesValue.length}/500</div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  className="h-12 w-full gap-2 rounded-xl"
                  onClick={handleSubmit}
                  disabled={submitDisabled}
                >
                  {submitDisabled ? (
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
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
};

export default Submit;
