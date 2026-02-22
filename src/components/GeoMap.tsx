import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, LayersControl, useMap, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiFetchJson } from "@/lib/apiFetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Loader2 } from "lucide-react";

// Fix Leaflet default icon issue
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

type GeoMapProps = {
  center?: [number, number];
  zoom?: number;
  height?: string;
  showReports?: boolean;
  showOutbreaks?: boolean;
  compact?: boolean;
};

type ReportFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: number;
    species: string;
    fused_risk: number;
    ml_confidence: number;
    status: string;
    created_at: string;
  };
};

type OutbreakFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: number;
    species: string;
    radius_km: number;
    num_reports: number;
    mean_risk: number;
    status: string;
  };
};

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export function GeoMap({ 
  center = [20.5937, 78.9629], // India center
  zoom = 5, 
  height = "500px",
  showReports = true,
  showOutbreaks = true,
  compact = false
}: GeoMapProps) {
  const [reports, setReports] = useState<ReportFeature[]>([]);
  const [outbreaks, setOutbreaks] = useState<OutbreakFeature[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    if (showReports) {
      // Limit to 200 for performance
      apiFetchJson<{ features: ReportFeature[] }>("/geo/reports?limit=200")
        .then(res => setReports(res.features))
        .catch(console.error);
    }
    if (showOutbreaks) {
      apiFetchJson<{ features: OutbreakFeature[] }>("/geo/outbreaks")
        .then(res => setOutbreaks(res.features))
        .catch(console.error);
    }
  }, [showReports, showOutbreaks]);

  const handleMarkerClick = async (type: "report" | "outbreak", id: number) => {
    setSelectedItem({ type, id });
    setDrawerOpen(true);
    setLoadingDetails(true);
    try {
      if (type === "report") {
        const data = await apiFetchJson(`/reports/${id}`);
        setDetails(data);
      } else {
        const data = await apiFetchJson(`/outbreaks/${id}/reports`); // Just fetch related reports for now
        // We already have outbreak props, but could fetch more. 
        // For now let's use the properties we have + related reports
        const outbreak = outbreaks.find(o => o.properties.id === id);
        setDetails({ ...outbreak?.properties, related_reports: data.reports });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk > 0.7) return "#ef4444"; // red
    if (risk > 0.4) return "#f59e0b"; // amber
    return "#10b981"; // green
  };

  // Memoize layers to prevent re-rendering freezing the map
  const outbreakLayers = useMemo(() => (
    outbreaks.map((ob) => (
      <Circle
        key={`ob-${ob.properties.id}`}
        center={[ob.geometry.coordinates[1], ob.geometry.coordinates[0]]}
        pathOptions={{ 
          color: getRiskColor(ob.properties.mean_risk),
          fillColor: getRiskColor(ob.properties.mean_risk),
          fillOpacity: 0.2
        }}
        radius={ob.properties.radius_km * 1000}
        eventHandlers={{
          click: () => handleMarkerClick("outbreak", ob.properties.id)
        }}
      >
        {!compact && (
          <Popup>
            <div className="text-sm">
              <strong>{ob.properties.species} Cluster</strong><br/>
              Risk: {(ob.properties.mean_risk * 100).toFixed(0)}%<br/>
              Reports: {ob.properties.num_reports}
            </div>
          </Popup>
        )}
      </Circle>
    ))
  ), [outbreaks, compact]);

  const reportLayers = useMemo(() => (
    reports.map((r) => (
      <CircleMarker
        key={`rep-${r.properties.id}`}
        center={[r.geometry.coordinates[1], r.geometry.coordinates[0]]}
        pathOptions={{ 
          color: getRiskColor(r.properties.fused_risk),
          fillColor: getRiskColor(r.properties.fused_risk),
          fillOpacity: 0.8,
          weight: 1
        }}
        radius={6} // Fixed pixel radius for performance and visibility
        eventHandlers={{
          click: () => handleMarkerClick("report", r.properties.id)
        }}
      >
       {!compact && (
          <Popup>
            <div className="text-sm">
              <strong>{r.properties.species}</strong><br/>
              Risk: {(r.properties.fused_risk * 100).toFixed(0)}%<br/>
              {new Date(r.properties.created_at).toLocaleDateString()}
            </div>
          </Popup>
       )}
      </CircleMarker>
    ))
  ), [reports, compact]);

  return (
    <>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height, width: "100%", borderRadius: "0.5rem", zIndex: 1 }}
        scrollWheelZoom={!compact}
      >
        <MapController center={center} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles" 
        />

        <LayersControl position="topright">
          {showOutbreaks && (
            <LayersControl.Overlay checked name="Outbreaks">
              <div style={{ display: 'none' }}>
                {outbreakLayers}
              </div>
            </LayersControl.Overlay>
          )}

          {showReports && (
            <LayersControl.Overlay checked name="Individual Reports">
               <div style={{ display: 'none' }}>
                {reportLayers}
              </div>
            </LayersControl.Overlay>
          )}
        </LayersControl>
      </MapContainer>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {selectedItem?.type === "outbreak" ? "Outbreak Details" : "Report Details"}
            </DrawerTitle>
            <DrawerDescription>
              {loadingDetails ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : details ? (
                <div className="space-y-4 mt-4 text-left">
                  {selectedItem?.type === "outbreak" ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">{details.species} Cluster</span>
                        <Badge variant={details.mean_risk > 0.7 ? "destructive" : "default"}>
                          Risk: {(details.mean_risk * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Reports:</span> {details.num_reports}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Radius:</span> {details.radius_km.toFixed(1)} km
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span> {details.status}
                        </div>
                      </div>
                      
                      {details.related_reports && (
                         <div className="mt-4">
                           <h4 className="font-medium mb-2">Recent Reports in Cluster</h4>
                           <div className="max-h-40 overflow-y-auto space-y-2">
                             {details.related_reports.map((r: any) => (
                               <div key={r.id} className="text-xs p-2 border rounded bg-secondary/50 flex justify-between">
                                 <span>{new Date(r.created_at).toLocaleDateString()}</span>
                                 <span>Risk: {r.fused_risk.toFixed(2)}</span>
                               </div>
                             ))}
                           </div>
                         </div>
                      )}

                      <DrawerFooter className="px-0">
                         <Button>Create Response Task</Button>
                         <Button variant="outline">Send Alert</Button>
                      </DrawerFooter>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">{details.species}</span>
                        <Badge variant={details.fused_risk > 0.7 ? "destructive" : "default"}>
                          Risk: {(details.fused_risk * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      
                      {details.photo_url && (
                        <img src={details.photo_url} alt="Report" className="h-40 w-full object-cover rounded-md" />
                      )}

                      <div className="text-sm space-y-1">
                        <div><span className="text-muted-foreground">Confidence:</span> {details.ml_confidence?.toFixed(2)}</div>
                        <div><span className="text-muted-foreground">Density Score:</span> {details.report_density?.toFixed(2)}</div>
                        <div><span className="text-muted-foreground">Location:</span> {details.lat.toFixed(4)}, {details.lon.toFixed(4)}</div>
                      </div>

                      <DrawerFooter className="px-0">
                         <Button>Verify Report</Button>
                         <Button variant="outline">Flag as False Positive</Button>
                      </DrawerFooter>
                    </>
                  )}
                </div>
              ) : "No details found."}
            </DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    </>
  );
}