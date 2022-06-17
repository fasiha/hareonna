import Head from "next/head";
import {
  GetStaticProps,
  InferGetStaticPropsType,
  GetStaticPaths,
  GetServerSideProps,
} from "next";
import { useEffect, useMemo, useState } from "react";
import { kdTree } from "kd-tree-javascript";
import { pseudoToExact, pseudoHaversine } from "../haversine";

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

function stationToTree(stations: StationWithSummary[]) {
  return new kdTree(
    stations,
    (a, b) => pseudoHaversine([+a.lat, +a.lon], [+b.lat, +b.lon]),
    ["lat", "lon"]
  );
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
            <button onClick={() => latLonSelector(+r.lat, +r.lon)}>Pick</button>{" "}
            {r.display_name}: {r.lat}°, {r.lon}°{" "}
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();

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
        <label>Search OpenStreetMap for: </label>
        <input
          type="text"
          size={35}
          placeholder="city, country, neighborhood, mountain…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />{" "}
        <button type="submit">Search</button>
      </form>
      <div>{body}</div>
    </div>
  );
}

function closestStation(
  lat: number,
  lon: number,
  tree: kdTree<StationWithSummary>
): [StationWithSummary, number] {
  const [[station, pseudoDistance]] = tree.nearest(
    { lat, lon } as StationWithSummary,
    1
  );
  return [station, pseudoToExact(pseudoDistance)];
}

function percentileToDescription(p: number): string {
  const q = 1 - p;
  const pToDay = (p: number) => (p * 365.25).toFixed(1);
  const pToMon = (p: number) => (p * 12).toFixed(1);
  return `${p * 100}%ile temperature: ≤ this ${pToDay(p)} days a year (${pToMon(
    p
  )} months a year); OR ≥ this ${pToDay(q)} days (${pToMon(q)} mos.)`;
}

interface DescribeStationProps {
  station: StationWithSummary;
  ps: number[];
  distance: number;
}
function DescribeStation({ station, ps, distance }: DescribeStationProps) {
  return (
    <div>
      <h2>
        {station.name}: {station.desc}
      </h2>
      <p>
        ({distance.toFixed(1)} km away;{" "}
        {(
          (Math.min(...station.summary.goods) / station.summary.days) *
          100
        ).toFixed(1)}
        %+ good data over {station.summary.days} days)
      </p>

      <table>
        <thead>
          <tr>
            <th>p</th>
            <th>low</th>
            <th>high</th>
          </tr>
        </thead>
        <tbody>
          {ps.map((p, i) => (
            <tr>
              <td>{p * 100}%</td>
              <td>{station.summary.lows[i]}</td>
              <td>{station.summary.his[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HomePage({
  stationsPayload,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const tree = useMemo(() => stationToTree(stationsPayload.stations), []);

  const [latLon, setLatLon] = useState<undefined | [number, number]>(undefined);
  const closest = latLon
    ? closestStation(latLon[0], latLon[1], tree)
    : undefined;
  const describeClosest = closest ? (
    <DescribeStation
      station={closest[0]}
      distance={closest[1]}
      ps={stationsPayload.percentiles}
    />
  ) : (
    <p>(pick a location)</p>
  );
  return (
    <>
      <Head>
        <title>Hareonna</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <meta
          property="og:title"
          content="Hareonna—look at the percentiles of thousands of weather stations’ lows and highs"
          key="title"
        />
      </Head>
      <h1>Hareonna</h1>
      <div>
        <SearchOSM latLonSelector={(lat, lon) => setLatLon([lat, lon])} />
        {describeClosest}
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
  const stationsPayload: StationsWithSummaryPayload = JSON.parse(
    await readFile(
      path.join(process.cwd(), "good-stations-summary.json"),
      "utf8"
    )
  );
  return { props: { stationsPayload } };
};
