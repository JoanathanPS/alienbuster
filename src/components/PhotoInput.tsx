import { useCallback, useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraView } from "@/components/CameraView";

type Mode = "choose" | "camera" | "preview";

type Source = "camera" | "upload";

interface PhotoInputProps {
  onPhotoReady: (dataUrl: string, blob: Blob) => void;
  onClose: () => void;
}

export function PhotoInput({ onPhotoReady, onClose }: PhotoInputProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [source, setSource] = useState<Source>("camera");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearPhoto = useCallback(() => {
    setPhotoDataUrl(null);
    setPhotoBlob(null);
  }, []);

  const handleCameraPhoto = useCallback((dataUrl: string, blob: Blob) => {
    setSource("camera");
    setPhotoDataUrl(dataUrl);
    setPhotoBlob(blob);
    setMode("preview");
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSource("upload");

    const blob = file as Blob;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoDataUrl(reader.result as string);
      setPhotoBlob(blob);
      setMode("preview");
    };
    reader.readAsDataURL(file);

    // Reset input so user can pick the same file again
    e.target.value = "";
  }, []);

  const handleContinue = useCallback(() => {
    if (photoDataUrl && photoBlob) onPhotoReady(photoDataUrl, photoBlob);
  }, [photoDataUrl, photoBlob, onPhotoReady]);

  // Camera mode
  if (mode === "camera") {
    return <CameraView onPhotoTaken={handleCameraPhoto} onClose={() => setMode("choose")} />;
  }

  // Preview mode (full-screen)
  if (mode === "preview" && photoDataUrl) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-end px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden px-4 pb-4">
          <img src={photoDataUrl} alt="Preview" className="h-full w-full rounded-xl object-contain" />
        </div>

        <div className="border-t border-border bg-card/95 p-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              className="min-h-[56px] w-full rounded-xl"
              onClick={() => {
                clearPhoto();
                if (source === "camera") setMode("camera");
                else setMode("choose");
              }}
            >
              Retake / Choose Another
            </Button>
            <Button
              className="min-h-[56px] w-full rounded-xl bg-accent text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
              onClick={handleContinue}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Choose mode (spec)
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Add a photo</h2>
          <p className="mt-1 text-sm text-muted-foreground">Take a new photo or upload from your gallery.</p>
        </div>
        <Button size="icon" variant="ghost" className="h-12 w-12" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Button
          className="min-h-[56px] w-full justify-center gap-3 rounded-xl bg-accent text-base font-semibold text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
          onClick={() => setMode("camera")}
        >
          <Camera className="h-5 w-5" aria-hidden="true" />
          Take Photo
        </Button>

        <Button
          variant="outline"
          className="min-h-[56px] w-full justify-center gap-3 rounded-xl text-base font-semibold"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-5 w-5" aria-hidden="true" />
          Upload from Gallery
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
