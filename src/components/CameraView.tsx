import { useEffect } from "react";
import { Camera, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/useCamera";

interface CameraViewProps {
  onPhotoTaken: (dataUrl: string, blob: Blob) => void;
  onClose: () => void;
}

export function CameraView({ onPhotoTaken, onClose }: CameraViewProps) {
  const { videoRef, photo, photoBlob, error, isActive, startCamera, toggleFacing, takePhoto, retakePhoto } = useCamera();

  useEffect(() => {
    startCamera();
    return () => {
      // cleanup handled by hook
    };
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-6">
        <Camera className="h-16 w-16 text-muted-foreground" />
        <p className="text-center text-lg font-medium text-foreground">Camera access denied</p>
        <p className="text-center text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={onClose}>Go Back</Button>
      </div>
    );
  }

  if (photo && photoBlob) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <img src={photo} alt="Captured" className="flex-1 object-contain" />
        <div className="flex gap-3 p-4">
          <Button variant="secondary" className="flex-1" onClick={retakePhoto}>Retake</Button>
          <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onPhotoTaken(photo, photoBlob)}>
            Use this photo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <Button size="icon" variant="secondary" className="rounded-full bg-black/50 text-white hover:bg-black/70" onClick={toggleFacing}>
          <SwitchCamera className="h-5 w-5" />
        </Button>
        <Button size="icon" variant="secondary" className="rounded-full bg-black/50 text-white hover:bg-black/70" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <button
          onClick={takePhoto}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-90"
        >
          <div className="h-16 w-16 rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}
