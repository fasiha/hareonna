/* Leaflet */

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "./MarkerClusterGroup";
import { useEffect, useMemo, useState } from "react";
import { StationsWithSummaryPayload, StationWithSummary } from "./interfaces";

interface MapStationsProps {
  stationsPayload: StationsWithSummaryPayload;
  camera: { center: [number, number]; pointsToFit: [number, number][] };
  setStation: (station: StationWithSummary) => void;
}
function MapStations({
  camera: { center, pointsToFit },
  stationsPayload: { stations },
  setStation,
}: MapStationsProps) {
  const [map, setMap] = useState<any>(null);
  const displayMap = useMemo(
    () => (
      <MapContainer
        ref={setMap}
        center={center}
        zoom={3}
        className="mapContainer"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup>
          {stations.map((v, i) => (
            <Marker key={i} position={[v.lat, v.lon]}>
              <Popup minWidth={100}>
                {v.name}: {v.desc} (
                {(
                  (Math.min(...v.summary.goods) / v.summary.days) *
                  100
                ).toFixed(1)}
                % available over {v.summary.days} days){" "}
                <button onClick={() => setStation(v)}>Pick</button>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    ),
    []
  );
  useEffect(() => {
    if (map) {
      if (pointsToFit.length) {
        map.fitBounds(pointsToFit, { animate: true });
      } else {
        map.setView(center, map.getZoom(), { animate: true });
      }
    }
  }, [center, pointsToFit, map]);
  return <>{displayMap}</>;
}
export default MapStations;
