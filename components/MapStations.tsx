/* Leaflet */

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "./MarkerClusterGroup";

interface MapStationsProps {
  latlons: [number, number][];
}
function MapStations({ latlons }: MapStationsProps) {
  const position = [0, 0] as [number, number];
  return (
    <MapContainer
      center={position}
      zoom={3}
      style={{ width: "100%", height: "600px", color: "black" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup>
        {latlons.map((v, i) => (
          <Marker key={i} position={v} />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
export default MapStations;
