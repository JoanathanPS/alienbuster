import { useState, useRef, useCallback } from "react";
import { Camera, Upload, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraView } from "@/components/CameraView";

type Mode = "choose" | "camera" | "preview";

interface PhotoInputProps {
  onPhotoReady: (dataUrl: string, blob: Blob) => void;
  onClose: () => void;
}

export function PhotoInput({ onPhotoReady, onClose }: PhotoInputProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetPhoto = useCallback(() => {
    setPhotoDataUrl(null);
    setPhotoBlob(null);
    setMode("choose");
  }, []);

  const handleCameraPhoto = useCallback((dataUrl: string, blob: Blob) => {
    setPhotoDataUrl(dataUrl);
    setPhotoBlob(blob);
    setMode("preview");
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    if (photoDataUrl && photoBlob) {
      onPhotoReady(photoDataUrl, photoBlob);
    }
  }, [photoDataUrl, photoBlob, onPhotoReady]);

  // Camera mode — delegate to existing CameraView
  if (mode === "camera") {
    return (
      <CameraView
        onPhotoTaken={handleCameraPhoto}
        onClose={() => setMode("choose")}
      />
    );
  }

  // Preview mode
  if (mode === "preview" && photoDataUrl) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <img
          src={photoDataUrl}
          alt="Preview"
          className="max-h-full max-w-full object-contain rounded-xl"
        />
      </div>
      <div className="flex gap-3 p-4 pb-6">
          <Button variant="secondary" className="min-h-[48px] flex-1" onClick={resetPhoto}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Choose Another
          </Button>
          <Button
            className="min-h-[48px] flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={handleContinue}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Choose mode (default)
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6">
      {/* Close button */}
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-4 top-4"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>

      <h2 className="mb-2 text-xl font-bold text-foreground">Add a Photo</h2>
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Take a new photo or upload one from your gallery.
      </p>

      <div className="grid w-full max-w-sm grid-cols-1 gap-4 sm:grid-cols-2">
        <Button
          className="h-28 flex-col gap-2 rounded-xl bg-accent text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
          onClick={() => setMode("camera")}
        >
          <Camera className="h-8 w-8" />
          <span className="text-sm font-semibold">Take Photo</span>
        </Button>

        <Button
          variant="secondary"
          className="h-28 flex-col gap-2 rounded-xl"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8" />
          <span className="text-sm font-semibold">Upload from Gallery</span>
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
