/* Leaflet */

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "./MarkerClusterGroup";
import { useMemo } from "react";
import { StationsWithSummaryPayload } from "./interfaces";

interface MapStationsProps {
  stationsPayload: StationsWithSummaryPayload;
}
function MapStations({ stationsPayload: { stations } }: MapStationsProps) {
  const position = [0, 0] as [number, number];
  const cluster = useMemo(
    () => (
      <MarkerClusterGroup>
        {stations.map((v, i) => (
          <Marker key={i} position={[+v.lat, +v.lon]} />
        ))}
      </MarkerClusterGroup>
    ),
    [stations]
  );
  return (
    <MapContainer center={position} zoom={3} className="mapContainer">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {cluster}
    </MapContainer>
  );
}
export default MapStations;
