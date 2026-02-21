import { useEffect, useRef } from "react";
import { Camera, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/useCamera";

interface CameraViewProps {
  onPhotoTaken: (dataUrl: string, blob: Blob) => void;
  onClose: () => void;
}

export function CameraView({ onPhotoTaken, onClose }: CameraViewProps) {
  const { videoRef, photo, photoBlob, error, startCamera, toggleFacing, takePhoto } = useCamera();
  const sentRef = useRef(false);

  useEffect(() => {
    startCamera();
    return () => {
      // cleanup handled by hook
    };
  }, [startCamera]);

  // When a photo is captured, immediately send it back to PhotoInput.
  // PhotoInput renders the required full-screen preview UI.
  useEffect(() => {
    if (!photo || !photoBlob) return;
    if (sentRef.current) return;
    sentRef.current = true;
    onPhotoTaken(photo, photoBlob);
  }, [photo, photoBlob, onPhotoTaken]);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-6">
        <Camera className="h-16 w-16 text-muted-foreground" />
        <p className="text-center text-lg font-medium text-foreground">Camera access denied</p>
        <p className="text-center text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" className="min-h-[48px]" onClick={onClose}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70"
          onClick={toggleFacing}
          aria-label="Switch camera"
        >
          <SwitchCamera className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70"
          onClick={onClose}
          aria-label="Close camera"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <button
          onClick={takePhoto}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-90"
          aria-label="Take photo"
        >
          <div className="h-16 w-16 rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}
