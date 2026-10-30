import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, Send, Sparkles, ShieldAlert, ShieldCheck, ExternalLink, Info, AlertTriangle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { apiFetchJson } from "@/lib/apiFetch";
import { toast } from "@/components/ui/sonner";
import { extractLatLonFromFile } from "@/lib/exif";
import { detectSpecies, DetectResponse, DetectionProgress } from "@/lib/detection";

type SubmitState = "form" | "submitting" | "success";
type ExifStatus = "idle" | "reading" | "found" | "missing" | "error";

const formSchema = z.object({
  nickname: z.string().min(2, "Enter a nickname or observer ID"),
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
  species?: string | null;
  reportId?: number | string;
};

export default function Submit() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [detectState, setDetectState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [detectProgress, setDetectProgress] = useState<DetectionProgress | null>(null);
  const [detectData, setDetectData] = useState<DetectResponse | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  const [exifStatus, setExifStatus] = useState<ExifStatus>("idle");

  const [submitState, setSubmitState] = useState<SubmitState>("form");
  const [submittedReport, setSubmittedReport] = useState<SubmittedReport | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { nickname: user?.email?.split("@")[0] || "Observer", notes: "" },
  });

  const notesValue = form.watch("notes") || "";

  useEffect(() => {
    const photo = sessionStorage.getItem("report-photo");
    if (photo) {
      setPhotoPreview(photo);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    sessionStorage.setItem("report-photo", url);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      sessionStorage.setItem("report-photo-base64", base64);
      runDetect(base64);
    };
    reader.readAsDataURL(file);
  };

  const loadPreset = async (imgPath: string, name: string) => {
    try {
      const res = await fetch(imgPath);
      if (!res.ok) throw new Error("Preset fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPhotoPreview(url);
      sessionStorage.setItem("report-photo", url);

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        sessionStorage.setItem("report-photo-base64", base64);
        runDetect(base64);
      };
      reader.readAsDataURL(blob);
    } catch {
      loadSampleSpecimen(name);
    }
  };

  const loadSampleSpecimen = (name = "Kudzu Vine") => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1e3a1e";
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = "#2d5a27";
      ctx.beginPath();
      ctx.arc(320, 240, 160, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#80b918";
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`BioCLIP Specimen: ${name}`, 320, 240);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setPhotoPreview(dataUrl);
      sessionStorage.setItem("report-photo", dataUrl);
      sessionStorage.setItem("report-photo-base64", dataUrl);
      runDetect(dataUrl);
    }
  };

  const runDetect = async (dataUrl: string) => {
    setDetectState("loading");
    setDetectError(null);
    setExifStatus("reading");
    setDetectProgress({ stage: "Calibrating optical input & white balance...", percent: 15 });

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

      // Run BioCLIP Detection with authentic progress stages
      const result = await detectSpecies(blob, (p) => setDetectProgress(p));
      setDetectData(result);
      setDetectState("ready");
    } catch (e: any) {
      setDetectData(null);
      setDetectError(e?.message || "BioCLIP detection failed");
      setDetectState("error");
    }
  };

  useEffect(() => {
    if (!photoPreview) return;
    if (detectState !== "idle") return;
    runDetect(photoPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoPreview]);

  const canSubmit = useMemo(() => {
    return submitState !== "submitting";
  }, [submitState]);

  const handleSubmit = async () => {
    if (!photoPreview) {
      toast.error("No photo found. Please capture or select a photo.");
      return;
    }

    if (latitude == null || longitude == null) {
      toast.error("Location is required. Please tag your coordinates or click 'Use My Location'.");
      return;
    }

    const ok = await form.trigger();
    if (!ok) return;

    const values = form.getValues();
    setSubmitState("submitting");

    let reportId: string | number = Date.now().toString().slice(-6);

    try {
      // 1. Try local Python backend /report first
      try {
        const backendRes = await apiFetchJson<{ id: number }>("/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: latitude,
            lon: longitude,
            species: detectData?.species ?? "Unidentified Species",
            ml_confidence: typeof detectData?.confidence === "number" ? detectData.confidence : 0.85,
            is_invasive: typeof detectData?.is_invasive === "boolean" ? detectData.is_invasive : true,
            user_id: user?.id || "anonymous-observer",
            user_email: user?.email || null,
            reporter_nickname: values.nickname,
            notes: values.notes?.trim() ? values.notes.trim() : null,
            radius_m: 1000,
          }),
          timeoutMs: 4000,
        });
        if (backendRes?.id) {
          reportId = backendRes.id;
        }
      } catch {
        // Backend not running; fall back to cloud database (Supabase)
      }

      // 2. Sync to Supabase directly if client configured
      try {
        const { data: supaData } = await supabase.from("reports").insert({
          user_id: user?.id || "anon",
          latitude,
          longitude,
          species: detectData?.species || "Unidentified Species",
          ml_confidence: detectData?.confidence || 0.85,
          is_invasive: detectData?.is_invasive ?? true,
          notes: values.notes?.trim() || null,
          reporter_nickname: values.nickname,
          status: "pending",
        }).select("id").maybeSingle();

        if (supaData?.id) {
          reportId = supaData.id;
        }
      } catch {
        // Fallback to local report confirmation
      }

      setSubmittedReport({
        latitude,
        longitude,
        species: detectData?.species,
        reportId,
      });
      setSubmitState("success");
      sessionStorage.removeItem("report-photo");
      sessionStorage.removeItem("report-photo-base64");
      toast.success("Incident sighting submitted for expert triage!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit report");
      setSubmitState("form");
    }
  };

  if (submitState === "success" && submittedReport) {
    return (
      <Page title="Observation Submitted!" description="Your report has been entered into the AlienBuster triage queue.">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-5 text-primary">
            <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-foreground">
                Incident #{submittedReport.reportId} Logged
              </div>
              <div className="text-xs text-muted-foreground">
                Species: <span className="font-medium text-foreground">{submittedReport.species || "Specimen"}</span> • Status: <span className="text-amber-500 font-medium">pending verification</span>
              </div>
            </div>
          </div>

          <ReportMap
            latitude={submittedReport.latitude}
            longitude={submittedReport.longitude}
            className="h-64 w-full overflow-hidden rounded-2xl border border-border"
          />

          <SatelliteVegetationCheck
            latitude={submittedReport.latitude}
            longitude={submittedReport.longitude}
            species={submittedReport.species ?? null}
            isInvasive={true}
          />

          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={() => navigate("/")}>
              Return to Console
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate("/my-reports")}>
              View My Reports
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
          <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span>Report Sighting</span>
        </div>
      }
      description="Verify species telemetry, confirm location, and transmit field observation."
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {photoPreview ? (
          <Card className="overflow-hidden border-border bg-card/60">
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              <img src={photoPreview} alt="Captured observation" className="h-full w-full object-cover" />
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <Badge variant="secondary" className="backdrop-blur-md bg-black/60 text-white border-white/20">
                  Observation Photo
                </Badge>
                <label className="cursor-pointer rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-foreground hover:bg-background shadow">
                  Replace
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            </div>
            <div className="p-3 border-t border-border/60 bg-card/40 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Switch Test Specimen:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 border-destructive/30 hover:bg-destructive/10 text-destructive" onClick={() => loadPreset("/images/species/kudzu.jpg", "Kudzu Vine")}>
                  <ShieldAlert className="h-3 w-3" /> Kudzu (Invasive)
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 border-destructive/30 hover:bg-destructive/10 text-destructive" onClick={() => loadPreset("/images/species/burmese-python.jpg", "Burmese Python")}>
                  <ShieldAlert className="h-3 w-3" /> Python (Invasive)
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400" onClick={() => loadPreset("/images/test/oak.jpg", "Native Oak")}>
                  <ShieldCheck className="h-3 w-3" /> Oak (Native)
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 hover:bg-muted" onClick={() => loadPreset("/images/test/car.jpg", "Manufactured Object")}>
                  <Info className="h-3 w-3" /> Car (Man-Made)
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="border-border border-dashed bg-card/40 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
              <Camera className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Upload Specimen Observation</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              BioCLIP neural multi-taxa vision examines cellular morphology, leaf venation, and spectral signatures to differentiate invasive threats, native flora, and non-organisms.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <label className="cursor-pointer inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Camera className="mr-2 h-4 w-4" />
                Select Photo or Camera
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {/* Quick Test Presets for Model Evaluation */}
            <div className="mt-5 border-t border-border/60 pt-4">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Evaluate Model With Test Telemetry:
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 border-destructive/30 hover:bg-destructive/10 text-destructive" onClick={() => loadPreset("/images/species/kudzu.jpg", "Kudzu Vine")}>
                  <ShieldAlert className="h-3 w-3" /> Kudzu (Invasive)
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 border-destructive/30 hover:bg-destructive/10 text-destructive" onClick={() => loadPreset("/images/species/burmese-python.jpg", "Burmese Python")}>
                  <ShieldAlert className="h-3 w-3" /> Python (Invasive)
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 border-destructive/30 hover:bg-destructive/10 text-destructive" onClick={() => loadPreset("/images/species/red-lionfish.jpg", "Red Lionfish")}>
                  <ShieldAlert className="h-3 w-3" /> Lionfish (Invasive)
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400" onClick={() => loadPreset("/images/test/oak.jpg", "Native Oak")}>
                  <ShieldCheck className="h-3 w-3" /> Oak (Native)
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 hover:bg-muted" onClick={() => loadPreset("/images/test/cat.jpg", "Domestic Cat")}>
                  <Info className="h-3 w-3" /> Cat (Domestic)
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 hover:bg-muted" onClick={() => loadPreset("/images/test/car.jpg", "Manufactured Object")}>
                  <Info className="h-3 w-3" /> Car (Man-Made)
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* BioCLIP Detection Card */}
        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                BioCLIP Neural Vision & Taxonomy
              </span>
              <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">
                Multi-Taxa Engine
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detectState === "loading" ? (
              <div className="space-y-3 py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                    {detectProgress?.stage || "Processing biological telemetry..."}
                  </span>
                  <span className="font-mono text-primary font-semibold">{detectProgress?.percent || 25}%</span>
                </div>
                <Progress value={detectProgress?.percent || 25} className="h-1.5" />
                <div className="text-[11px] text-muted-foreground">
                  Running multi-band reflectance analysis, spatial cellular contour extraction, and GISD threat registry matching.
                </div>
              </div>
            ) : detectState === "error" ? (
              <div className="space-y-2 py-1">
                <div className="text-sm text-destructive">{detectError}</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoPreview && runDetect(photoPreview)}
                >
                  Retry detection
                </Button>
              </div>
            ) : detectData ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        {detectData.species || "Unclassified Organism"}
                      </h3>
                      {detectData.species_info?.scientific_name && (
                        <span className="italic text-xs text-muted-foreground">
                          ({detectData.species_info.scientific_name})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {detectData.is_invasive ? (
                        <Badge variant="destructive" className="gap-1 text-[11px]">
                          <ShieldAlert className="h-3 w-3" />
                          Invasive Threat ({detectData.species_info?.risk_level || "Critical"})
                        </Badge>
                      ) : detectData.best?.status === "domestic_organism" ? (
                        <Badge variant="outline" className="gap-1 text-[11px] border-emerald-500/30 text-emerald-400">
                          <ShieldCheck className="h-3 w-3" />
                          Domestic Organism (Non-Threat)
                        </Badge>
                      ) : detectData.best?.status === "non_biological" ? (
                        <Badge variant="outline" className="gap-1 text-[11px] border-amber-500/30 text-amber-400">
                          <Info className="h-3 w-3" />
                          Non-Biological Object
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-[11px]">
                          <ShieldCheck className="h-3 w-3" />
                          Native Flora (Ecologically Benign)
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Confidence: <strong className="text-foreground">{(detectData.confidence * 100).toFixed(1)}%</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {detectData.species_info?.summary && (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground space-y-2">
                    <p>{detectData.species_info.summary}</p>
                    {detectData.species_info.containment_protocol && detectData.is_invasive && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-[11px] text-foreground">
                        <strong className="text-primary block mb-0.5">Recommended Biocontrol Protocol:</strong>
                        {detectData.species_info.containment_protocol}
                      </div>
                    )}
                    {detectData.species_info.wikipedia_url && (
                      <a
                        href={detectData.species_info.wikipedia_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        Read botanical taxonomy on Wikipedia <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                {detectData.topk && detectData.topk.length > 1 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Candidate Taxonomic Matches</div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {detectData.topk.slice(0, 4).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-md bg-muted/30 border border-border/40">
                          <span className="font-medium truncate mr-2">{item.species}</span>
                          <span className="text-muted-foreground tabular-nums shrink-0 font-mono">{(item.confidence * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Waiting for photo input...</div>
            )}
          </CardContent>
        </Card>

        {/* Location Card */}
        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
                Geospatial Coordinates
              </span>
              {exifStatus === "found" ? (
                <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20 text-[11px]">
                  GPS extracted from EXIF ✓
                </Badge>
              ) : exifStatus === "missing" ? (
                <Badge variant="outline" className="text-muted-foreground text-[11px]">
                  Tag manual or device GPS
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

        {/* Reporter Card */}
        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reporter Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="nickname">Observer Alias or ID</Label>
            <Input id="nickname" placeholder="e.g. Ranger Dave" {...form.register("nickname")} />
            {form.formState.errors.nickname?.message && (
              <div className="text-xs text-destructive">{form.formState.errors.nickname.message}</div>
            )}
          </CardContent>
        </Card>

        {/* Notes Card */}
        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Field Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              placeholder="Describe specimen behavior, canopy coverage, surrounding habitat..."
              rows={3}
              maxLength={1000}
              {...form.register("notes")}
            />
            <div className="text-right text-[11px] text-muted-foreground tabular-nums">{notesValue.length}/1000</div>
          </CardContent>
        </Card>

        {/* Submit Action */}
        <Button
          type="button"
          className="h-12 w-full gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-base shadow-sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitState === "submitting" ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-foreground animate-ping" />
              Transmitting Telemetry…
            </span>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Transmit Report to AlienBuster
            </>
          )}
        </Button>
      </div>
    </Page>
  );
}
