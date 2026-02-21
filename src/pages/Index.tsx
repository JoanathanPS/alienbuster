import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bug, Camera, Radar, Satellite, ShieldCheck } from "lucide-react";

import { PhotoInput } from "@/components/PhotoInput";
import { Page } from "@/components/Page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();
  const [showPhotoInput, setShowPhotoInput] = useState(false);

  const handlePhotoReady = (dataUrl: string, blob: Blob) => {
    setShowPhotoInput(false);
    sessionStorage.setItem("report-photo", dataUrl);
    const reader = new FileReader();
    reader.onloadend = () => {
      sessionStorage.setItem("report-photo-base64", reader.result as string);
      navigate("/submit");
    };
    reader.readAsDataURL(blob);
  };

  if (showPhotoInput) {
    return <PhotoInput onPhotoReady={handlePhotoReady} onClose={() => setShowPhotoInput(false)} />;
  }

  return (
    <Page
      title={
        <div className="flex items-center gap-2">
          <span>Alien Buster</span>
          <Badge variant="secondary">Hackathon build</Badge>
        </div>
      }
      description={
        <span>
          An early warning system that fuses citizen geo-tagged photos with satellite change detection to spot invasive outbreaks
          before they spread.
        </span>
      }
    >
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radar className="h-4 w-4" aria-hidden="true" />
            Detect 6–12 months earlier than traditional surveys
          </div>
          <CardTitle className="text-2xl md:text-3xl">
            Spot it. Snap it. Pin it. <span className="text-primary">Stop the spread.</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Button
              size="lg"
              className="h-14 gap-3 rounded-xl bg-accent text-base font-semibold text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
              onClick={() => setShowPhotoInput(true)}
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              Report a sighting
            </Button>
            <Button size="lg" variant="secondary" className="h-14 rounded-xl" onClick={() => navigate("/how-it-works")}>
              See how it works
            </Button>
          </div>

          <Alert className="border-primary/30 bg-primary/5">
            <Bug className="h-4 w-4" />
            <AlertTitle>Why this matters</AlertTitle>
            <AlertDescription>
              Invasive species move fast. Crowdsourced ground truth + remote sensing helps agencies verify signals, reduce false
              positives, and coordinate response.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bug className="h-4 w-4 text-primary" aria-hidden="true" /> Citizen reports
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Submit a geo-tagged photo + notes in seconds. Your report becomes real-time ground truth.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Satellite className="h-4 w-4 text-primary" aria-hidden="true" /> Satellite correlation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Detect land-cover / vegetation anomalies and cross-check them against clustered field reports.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" /> Expert verification
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Admin review turns sightings into a verified species database and triggers rapid response alerts.
          </CardContent>
        </Card>
      </div>
    </Page>
  );
};

export default Index;
