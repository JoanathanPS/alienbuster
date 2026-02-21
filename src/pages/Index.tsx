import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Bug, Shield, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoInput } from "@/components/PhotoInput";

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
    <div className="flex min-h-screen flex-col items-center px-4 pb-24 pt-12">
      {/* Hero */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Bug className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
          Alien Buster
        </h1>
        <p className="max-w-sm text-muted-foreground">
          Help protect our ecosystems. Report invasive species sightings in your area.
        </p>
      </div>

      {/* Main CTA */}
      <Button
        size="lg"
        className="mb-10 h-16 w-full max-w-sm gap-3 rounded-xl bg-accent text-lg font-semibold text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
        onClick={() => setShowPhotoInput(true)}
      >
        <Camera className="h-6 w-6" />
        Report Suspicious Species
      </Button>

      {/* Info cards */}
      <div className="grid w-full max-w-sm gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Early Warning System</p>
            <p className="text-xs text-muted-foreground">Your reports help scientists track and respond to invasive species before they spread.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
          <Leaf className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Protect Native Wildlife</p>
            <p className="text-xs text-muted-foreground">Invasive species cause billions in damage yearly. Every report counts toward conservation.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
