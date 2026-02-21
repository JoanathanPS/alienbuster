import { useState, useRef, useCallback } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const startCamera = useCallback(async (mode?: "user" | "environment") => {
    try {
      setError(null);
      const facing = mode || facingMode;
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      setIsActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err: any) {
      setError(err.message || "Camera access denied");
      setIsActive(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setIsActive(false);
  }, [stream]);

  const toggleFacing = useCallback(async () => {
    stopCamera();
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  }, [facingMode, stopCamera, startCamera]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhoto(dataUrl);
    canvas.toBlob((blob) => {
      if (blob) setPhotoBlob(blob);
    }, "image/jpeg", 0.85);
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setPhoto(null);
    setPhotoBlob(null);
    startCamera();
  }, [startCamera]);

  return {
    videoRef, stream, photo, photoBlob, facingMode, error, isActive,
    startCamera, stopCamera, toggleFacing, takePhoto, retakePhoto, setPhoto, setPhotoBlob,
  };
}
