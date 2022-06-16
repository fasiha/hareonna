import {
  GetStaticProps,
  InferGetStaticPropsType,
  GetStaticPaths,
  GetServerSideProps,
} from "next";
import { useEffect, useState } from "react";
import { readFile, readdir } from "fs/promises";
import path from "path";

interface GhcndStation {
  name: string;
  lat: number;
  lon: number;
  elev: number;
  desc: string;
}
interface StationSummary {
  lows: number[];
  his: number[];
  goods: [number, number];
  days: number;
}
interface StationWithSummary extends GhcndStation {
  summary: StationSummary;
}
interface StationsWithSummaryPayload {
  percentiles: number[];
  stations: StationWithSummary[];
}

/**
 * See https://nominatim.org/release-docs/develop/api/Output/
 */
interface NominatimResult {
  place_id: number;
  license: string;
  osm_type: "node" | "way" | "relation" | undefined;
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

interface SearchOSMProps {
  latLonSelector: (lat: number, lon: number) => void;
}

function SearchOSM({ latLonSelector }: SearchOSMProps) {
  const [results, setResults] = useState<
    NominatimResult[] | "fetching" | "error"
  >([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("results", results);
  }, [results]);

  const body =
    results === "fetching" ? (
      <>Fetching…</>
    ) : results === "error" ? (
      <>{error}</>
    ) : (
      <ul>
        {results.map((r, i) => (
          <li key={i}>
            {r.display_name}: {r.lat}°, {r.lon}°{" "}
            <button onClick={() => latLonSelector(+r.lat, +r.lon)}>Pick</button>
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      Search OpenStreetMap for:{" "}
      <input
        type="text"
        placeholder="city, country, neighborhood, mountain…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />{" "}
      <button
        onClick={async () => {
          setResults("fetching");
          const f = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${search}&format=jsonv2`
          );
          if (f.ok) {
            const res: NominatimResult[] = await f.json();
            setResults(res);
          } else {
            setError(`Error encountered 😱: ${f.status} ${f.statusText}`);
            setResults("error");
          }
        }}
      >
        Search
      </button>
      <div>{body}</div>
    </div>
  );
}

function closestStation(
  lat0: number,
  lon0: number,
  stations: StationWithSummary[]
): StationWithSummary | undefined {
  let bestDist = Infinity;
  let best: undefined | StationWithSummary = undefined;
  for (const s of stations) {
    const currDist = (lat0 - s.lat) ** 2 + (lon0 - s.lon) ** 2;
    if (currDist < bestDist) {
      bestDist = currDist;
      best = s;
    }
  }
  return best;
}

function percentileToDescription(p: number): string {
  const q = 1 - p;
  const pToDay = (p: number) => (p * 365.25).toFixed(1);
  const pToMon = (p: number) => (p * 12).toFixed(1);
  return `${p * 100}%ile temperature: ≤ this ${pToDay(p)} days a year (${pToMon(
    p
  )} months a year); OR ≥ this ${pToDay(q)} days (${pToMon(q)} mos.)`;
}

export default function HomePage({
  stationSummaries: stationsPayload,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const [latLon, setLatLon] = useState<undefined | [number, number]>(undefined);
  const closest = latLon
    ? closestStation(latLon[0], latLon[1], stationsPayload.stations)
    : undefined;
  const describeClosest = closest
    ? `${closest.name}: ${closest.desc}`
    : "(pick a location)";
  return (
    <>
      <h1>Hareonna</h1>
      <div>
        <SearchOSM latLonSelector={(lat, lon) => setLatLon([lat, lon])} />
        <p>{describeClosest}</p>
        <ul>
          {stationsPayload.percentiles.map((p) => (
            <li key={p}>{percentileToDescription(p)}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

export const getStaticProps = async () => {
  {
    // might only print if you restart next dev server
    const postsDirectory = path.join(process.cwd());
    const filenames = await readdir(postsDirectory);
    console.log("ls", filenames);
  }
  const stationSummaries: StationsWithSummaryPayload = JSON.parse(
    await readFile(
      path.join(process.cwd(), "good-stations-summary.json"),
      "utf8"
    )
  );
  return { props: { stationSummaries } };
};
