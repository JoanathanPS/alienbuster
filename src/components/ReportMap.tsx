import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";

interface ReportMapProps {
  latitude: number;
  longitude: number;
  className?: string;
}

export function ReportMap({ latitude, longitude, className }: ReportMapProps) {
  return (
    <div className={className}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full rounded-lg"
        style={{ minHeight: "200px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={[latitude, longitude]}
          radius={10}
          pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.6, weight: 2 }}
        />
      </MapContainer>
    </div>
  );
}
