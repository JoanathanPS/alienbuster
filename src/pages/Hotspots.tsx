import { useEffect, useState } from "react";
import { GeoMap } from "@/components/GeoMap";
import { Page } from "@/components/Page";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Skeleton } from "@/components/ui/skeleton";

const Hotspots = () => {
  const geo = useGeolocation();
  const [center, setCenter] = useState<[number, number] | undefined>(undefined);

  useEffect(() => {
    geo.requestLocation();
  }, []);

  useEffect(() => {
    if (geo.latitude && geo.longitude) {
      setCenter([geo.latitude, geo.longitude]);
    }
  }, [geo.latitude, geo.longitude]);

  return (
    <Page title="Hotspots" description="Interactive map of all invasive species reports and outbreaks.">
      <div className="relative h-[calc(100vh-200px)] w-full rounded-xl overflow-hidden border border-white/10">
         {/* We pass center if we have it, else GeoMap defaults to India */}
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
