import { useEffect, useState, useRef } from "react";
import { GeoMap } from "@/components/GeoMap";
import { Page } from "@/components/Page";
import { useGeolocation } from "@/hooks/useGeolocation";
import { MapPin } from "lucide-react";

const Hotspots = () => {
  const geo = useGeolocation();
  const [center, setCenter] = useState<[number, number] | undefined>(undefined);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!requestedRef.current) {
      requestedRef.current = true;
      geo.requestLocation();
    }
  }, [geo]);

  useEffect(() => {
    if (geo.latitude && geo.longitude) {
      setCenter([geo.latitude, geo.longitude]);
    }
  }, [geo.latitude, geo.longitude]);

  return (
    <Page
      title={
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
          Hotspots & Clusters
        </div>
      }
      description="Interactive geospatial mapping of crowdsourced reports, active outbreaks, and regional bio-threat anomalies."
    >
      <div className="relative h-[calc(100vh-210px)] min-h-[450px] w-full rounded-2xl overflow-hidden border border-border bg-card/60 shadow-sm">
         <GeoMap 
            center={center} 
            zoom={center ? 11 : 5} 
            height="100%" 
            showReports={true}
            showOutbreaks={true}
         />
      </div>
    </Page>
  );
};

export default Hotspots;
