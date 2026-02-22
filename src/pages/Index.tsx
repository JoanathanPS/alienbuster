import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bug, Camera, Radar, Satellite, ShieldCheck, Siren } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { PhotoInput } from "@/components/PhotoInput";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { logAction } from "@/lib/actionLog";
import { GeoMap } from "@/components/GeoMap";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showPhotoInput, setShowPhotoInput] = useState(false);

  const [reportsToday, setReportsToday] = useState<number | null>(null);
  const [pendingReviews, setPendingReviews] = useState<number | null>(null);

  const [mapLayer, setMapLayer] = useState<"reports" | "outbreaks" | "anomalies">("reports");

  const handlePhotoReady = (dataUrl: string, blob: Blob) => {
    setShowPhotoInput(false);
    sessionStorage.setItem("report-photo", dataUrl);
    const reader = new FileReader();
    reader.onloadend = () => {
      sessionStorage.setItem("report-photo-base64", reader.result as string);
      logAction({ title: "Photo captured", detail: "Proceeding to submit" });
      navigate("/submit");
    };
    reader.readAsDataURL(blob);
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const [todayRes, pendingRes] = await Promise.all([
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .gte("created_at", start.toISOString()),
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      setReportsToday(todayRes.count ?? 0);
      setPendingReviews(pendingRes.count ?? 0);
    };

    load();
  }, [user]);

  const heroSubtitle = useMemo(() => {
    return "Crowdsourced ground truth + remote sensing → decision-ready incidents.";
  }, []);

  if (showPhotoInput) {
    return <PhotoInput onPhotoReady={handlePhotoReady} onClose={() => setShowPhotoInput(false)} />;
  }

  return (
    <Page
      title={
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">AlienBuster</div>
          <div className="text-3xl font-semibold tracking-tight md:text-4xl">Early Warning System</div>
        </div>
      }
      description={heroSubtitle}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            logAction({ title: "Open Intel", detail: "Satellite & correlation" });
            navigate("/satellite");
          }}
        >
          <Radar className="mr-2 h-4 w-4" />
          Intel
        </Button>
      }
      className="max-w-[1280px]"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        
        {/* Top Hero Section */}
        <div className="col-span-12 lg:col-span-8 flex flex-col h-full">
          <Card className="h-full overflow-hidden border-white/10 bg-card/35 p-6 md:p-8 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Radar className="h-4 w-4 text-primary" />
              <span>Detect 6–12 months earlier than traditional surveys</span>
            </div>
            
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl leading-tight mb-4">
              Calm signals. <br />
              <span className="text-primary">Fast response.</span>
            </h2>
            
            <p className="max-w-xl text-base text-muted-foreground mb-8 leading-relaxed">
              A nature-forward operations console for invasive species: fuse BioCLIP predictions, 
              satellite change, and clustered field reports into explainable risk.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="h-12 px-6 bg-accent text-accent-foreground hover:bg-accent/90 text-base"
                onClick={() => {
                  logAction({ title: "Start new report" });
                  setShowPhotoInput(true);
                }}
              >
                <Camera className="mr-2 h-5 w-5" /> Report a suspicious species
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base"
                onClick={() => navigate("/how-it-works")}
              >
                Learn the workflow
              </Button>
            </div>
          </Card>
        </div>

        {/* Top Stats Section */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 h-full">
          <div className="grid grid-cols-2 gap-4 flex-1">
            <StatTile
              label="Reports today"
              value={reportsToday == null ? "—" : String(reportsToday)}
              sub={user ? "Supabase" : "Sign in"}
              accent="river"
              className="h-full"
            />
            <StatTile
              label="Pending review"
              value={pendingReviews == null ? "—" : String(pendingReviews)}
              sub={user ? "Queue" : "Sign in"}
              accent="leaf"
              className="h-full"
            />
          </div>
          <div className="flex-1">
             <StatTile label="Active outbreaks" value="—" sub="Local clustering" accent="leaf" className="h-full" />
          </div>
          <div className="flex-1">
             <StatTile label="Alerts sent" value="—" sub="SMTP (optional)" accent="sun" className="h-full" />
          </div>
        </div>

        {/* Map Canvas Section */}
        <div className="col-span-12 mt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="text-lg font-medium">Map canvas</div>
            <SegmentedControl
              value={mapLayer}
              onChange={(val) => setMapLayer(val as any)}
              segments={[
                { id: "reports", label: "Reports" },
                { id: "outbreaks", label: "Outbreaks" },
                { id: "anomalies", label: "Anomalies" },
              ]}
            />
          </div>
          
          <Card className="border-white/10 bg-card/25 overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/5">
              <CardTitle className="flex items-center justify-between text-base font-medium">
                <span className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-primary" /> 
                  Live preview
                </span>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate("/hotspots")}>
                  Open full map
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[400px]">
              <div className="h-full w-full">
                <GeoMap 
                   height="100%" 
                   showReports={mapLayer === "reports"} 
                   showOutbreaks={mapLayer === "outbreaks"}
                   compact={true}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="col-span-12 md:col-span-6 flex flex-col h-full">
          <Card className="h-full flex flex-col border-white/10 bg-card/25">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" /> Review queue
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col text-sm text-muted-foreground">
              <p className="mb-6 leading-relaxed">
                Expert validation turns crowdsourced signals into a verified database for agency action.
                Review pending submissions to train the model.
              </p>
              <Button variant="outline" className="mt-auto w-full" onClick={() => navigate("/expert")}>
                Open Expert Review
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-6 flex flex-col h-full">
          <Card className="h-full flex flex-col border-white/10 bg-card/25">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Siren className="h-4 w-4 text-primary" /> Recent alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col text-sm text-muted-foreground">
              <p className="mb-6 leading-relaxed">
                Rapid-response alert history. View agency templates, sent timestamps, and 
                recipient engagement stats for high-priority outbreaks.
              </p>
              <Button variant="outline" className="mt-auto w-full" onClick={() => navigate("/response")}>
                View Alert History
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </Page>
  );
};

export default Index;
