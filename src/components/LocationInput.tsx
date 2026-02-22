import { useEffect, useRef } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "@/components/ui/sonner";

interface LocationInputProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number | null, lng: number | null) => void;
}

export function LocationInput({ latitude, longitude, onLocationChange }: LocationInputProps) {
  const geo = useGeolocation();
  const toastShown = useRef(false);

  useEffect(() => {
    geo.requestLocation();
  }, []);

  useEffect(() => {
    if (geo.latitude !== null && geo.longitude !== null) {
      onLocationChange(geo.latitude, geo.longitude);
      if (!toastShown.current) {
        toastShown.current = true;
        toast.success("Location acquired!");
      }
    }
  }, [geo.latitude, geo.longitude]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Location</Label>
        {geo.loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {geo.error && (
        <p className="text-xs text-muted-foreground">
          {geo.permissionDenied ? "Location permission denied. Enter manually:" : geo.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="lat" className="text-xs text-muted-foreground">Latitude</Label>
          <Input
            id="lat"
            type="number"
            step="any"
            placeholder="e.g. 37.7749"
            value={latitude ?? ""}
            onChange={(e) => onLocationChange(e.target.value ? parseFloat(e.target.value) : null, longitude)}
          />
        </div>
        <div>
          <Label htmlFor="lng" className="text-xs text-muted-foreground">Longitude</Label>
          <Input
            id="lng"
            type="number"
            step="any"
            placeholder="e.g. -122.4194"
            value={longitude ?? ""}
            onChange={(e) => onLocationChange(latitude, e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
      </div>

      {(geo.permissionDenied || geo.error) && (
        <Button variant="outline" size="sm" className="min-h-[48px]" onClick={geo.requestLocation}>
          <MapPin className="mr-1 h-3 w-3" /> Retry GPS
        </Button>
      )}
    </div>
  );
}
