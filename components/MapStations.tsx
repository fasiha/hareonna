/* Leaflet */

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "./MarkerClusterGroup";
import { useEffect, useMemo, useState } from "react";
import {
  PaginatedStations,
  SimilarStations,
  StationsWithSummaryPayload,
  StationWithSummary,
} from "./interfaces";
import L, { Map } from "leaflet";
import { stat2ll } from "../utils";

interface MapStationsProps {
  stationsPayload: StationsWithSummaryPayload;
  camera: { center: [number, number]; pointsToFit: [number, number][] };
  setStation: (station: StationWithSummary) => void;
  setSimilarTo: (station: StationWithSummary) => void;
  stationsInPage: PaginatedStations;
  pickedAndSimilarStations: StationWithSummary[];
  numPicked: number;
  targetStation: StationWithSummary | undefined;
}
function MapStations({
  camera: { center, pointsToFit },
  stationsPayload: { stations },
  setStation,
  setSimilarTo,
  stationsInPage,
  pickedAndSimilarStations,
  numPicked,
  targetStation,
}: MapStationsProps) {
  const [map, setMap] = useState<Map | null>(null);
  const displayMap = useMemo(
    () => (
      <MapContainer
        ref={setMap}
        center={center}
        zoom={2}
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
                <button onClick={() => setStation(v)}>Pick</button>{" "}
                <button onClick={() => setSimilarTo(v)}>Find similar</button>
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

  useEffect(() => {
    if (map) {
      const primary = pickedAndSimilarStations.slice(0, numPicked);
      let circles = primary.map((o, i) =>
        L.circleMarker(stat2ll(o), {
          color: "orange",
          weight: 3,
          opacity: 0.75,
          radius: 9,
        })
          .addTo(map)
          .bindPopup(`(${i + 1})`)
      );
      if (targetStation) {
        const shownNames = new Set(stationsInPage.map((s) => s.val.name));
        const similars = pickedAndSimilarStations.slice(numPicked);
        circles = circles.concat(
          similars.map((o, i) =>
            L.circleMarker(stat2ll(o), {
              fillColor: "orange",
              fillOpacity: shownNames.has(o.name) ? 0.5 : 0.25,
              radius: shownNames.has(o.name) ? 5 : 3,
              stroke: false,
            })
              .addTo(map)
              .bindPopup(`#${i + 1} Similar`)
          )
        );
        const lines = similars.map((o, i) =>
          L.polyline([stat2ll(targetStation), stat2ll(o)], {
            color: "orange",
            opacity: shownNames.has(o.name) ? 0.5 : 0.25,
          })
            .addTo(map)
            .bindPopup(`#${i + 1} Similar`)
        );
        const texts = similars.map((o, i) =>
          shownNames.has(o.name)
            ? L.marker(stat2ll(o), {
                icon: L.divIcon({
                  html: `#${i + 1}`,
                  className: "text-below-similar",
                }),
              }).addTo(map)
            : undefined
        );
        return () => {
          circles.forEach((x) => x.remove());
          lines.forEach((x) => x.remove());
          texts.forEach((x) => x?.remove());
        };
      }

      return () => {
        circles.forEach((x) => x.remove());
      };
    }
  }, [map, stationsInPage, pickedAndSimilarStations, numPicked, targetStation]);

  return <>{displayMap}</>;
}
export default MapStations;
