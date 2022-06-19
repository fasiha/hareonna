/* Interfaces for the station data */
export interface GhcndStation {
  name: string;
  lat: number;
  lon: number;
  elev: number;
  desc: string;
}
export interface StationSummary {
  lows: number[];
  his: number[];
  goods: [number, number];
  days: number;
}
export interface StationWithSummary extends GhcndStation {
  summary: StationSummary;
}
export interface StationsWithSummaryPayload {
  percentiles: number[];
  stations: StationWithSummary[];
}

/* OpenStreetMap: See https://nominatim.org/release-docs/develop/api/Output/ */
export interface NominatimResult {
  place_id: number;
  license: string;
  osm_type: "node"|"way"|"relation"|undefined;
  osm_id: number;
  boundingbox: [string, string, string, string]; // min latitude, max latitude, min longitude, max longitude
  lat: string;
  lon: string;
  display_name: string;
  place_rank: number;
  category: string;
  type: string;
  importance: number;
  icon: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
}

/* Coordination data */
export interface ClosestStation {
  pickedDescription: string;
  pickedLat: number;
  pickedLon: number;
  closestStation: StationWithSummary;
  pickedToStationDist: number;
}
