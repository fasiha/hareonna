import Head from "next/head";
import {
  GetStaticProps,
  InferGetStaticPropsType,
  GetStaticPaths,
  GetServerSideProps,
} from "next";
import { Fragment, useEffect, useMemo, useState } from "react";
import { kdTree } from "kd-tree-javascript";
import { pseudoToExact, pseudoHaversine } from "../haversine";

import { readFile, readdir } from "fs/promises";
import path from "path";

/* Interfaces for the station data */
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

/* Stations to distances */
function stationToTree(stations: StationWithSummary[]) {
  return new kdTree(
    stations,
    (a, b) => pseudoHaversine([+a.lat, +a.lon], [+b.lat, +b.lon]),
    ["lat", "lon"]
  );
}

function findClosestStation(
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

/* OpenStreetMap: See https://nominatim.org/release-docs/develop/api/Output/ */
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
  selectLocation: (lat: number, lon: number, desc: string) => void;
}

function SearchOSM({ selectLocation: latLonSelector }: SearchOSMProps) {
  const [results, setResults] = useState<
    NominatimResult[] | "fetching" | "error"
  >([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const body =
    results === "fetching" ? (
      <>Fetching…</>
    ) : results === "error" ? (
      <>{error}</>
    ) : (
      <ul>
        {results.map((r, i) => (
          <li key={i}>
            <button
              onClick={() => latLonSelector(+r.lat, +r.lon, r.display_name)}
            >
              Pick
            </button>{" "}
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

/* Describe an individual station */
const pToDay = (p: number) => (p * 365.25).toFixed(1);
const pToMon = (p: number) => (p * 12).toFixed(1);

const PercentileDescriptionCache: Map<number, string> = new Map();
function percentileToDescription(p: number, tot: number): string {
  if (PercentileDescriptionCache.has(p)) {
    return PercentileDescriptionCache.get(p) || "";
  }
  let ret = "";
  if (p === 0) {
    ret = `temp. min in ${tot} days`;
  } else if (p === 1) {
    ret = `temp. max in ${tot} days`;
  } else if (p < 0.15) {
    ret = `temp ≤ this ${pToDay(p)} days/year`;
  } else if (p < 0.51) {
    ret = `temp ≤ this ${pToMon(p)} months/year`;
  } else if (1 - p < 0.15) {
    ret = `temp ≥ this ${pToDay(1 - p)} days/year`;
  } else {
    ret = `temp ≥ this ${pToMon(1 - p)} months/year`;
  }
  PercentileDescriptionCache.set(p, ret);
  return ret;
}

const circledNumbers =
  "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿";

interface DescribeStationProps {
  stations: ClosestStation[];
  ps: number[];
  deleteStation: (name: string) => void;
}
function DescribeStation({
  stations,
  ps,
  deleteStation,
}: DescribeStationProps) {
  if (stations.length === 0) {
    return <div>(Waiting for you to pick some weather stations.)</div>;
  }

  const days = stations[0].closestStation.summary.days;
  const stationDescriptions = stations.map(
    (s) =>
      `${s.closestStation.name}: ${
        s.closestStation.desc
      } (${s.pickedToStationDist.toFixed(1)} km away from ${
        s.pickedDescription
      }; ${((Math.min(...s.closestStation.summary.goods) / days) * 100).toFixed(
        1
      )}% good data over {days} days)`
  );
  return (
    <div>
      <ol>
        {stations.map((s, i) => (
          <li key={s.closestStation.name}>
            {stationDescriptions[i]}
            <button onClick={() => deleteStation(s.closestStation.name)}>
              Delete
            </button>
          </li>
        ))}
      </ol>
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>
              %<sub>ile</sub>
            </th>
            {stations.map((s, i) => (
              <th
                key={s.closestStation.name}
                colSpan={2}
                title={stationDescriptions[i]}
              >
                {circledNumbers[i]}
              </th>
            ))}
            <th rowSpan={2}>(notes)</th>
          </tr>
          <tr>
            {stations.map((s, i) => (
              <Fragment key={i}>
                <th>Low</th>
                <th>High</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {ps.map((p, i) => (
            <tr key={p}>
              <td>{(p * 100).toFixed(1)}%</td>
              {stations.map((s) => (
                <Fragment key={s.closestStation.name}>
                  <td>{s.closestStation.summary.lows[i]} °C</td>
                  <td>{s.closestStation.summary.his[i]} °C</td>
                </Fragment>
              ))}
              <td>{percentileToDescription(p, days)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Main app */
interface ClosestStation {
  pickedDescription: string;
  pickedLat: number;
  pickedLon: number;
  closestStation: StationWithSummary;
  pickedToStationDist: number;
}
export default function HomePage({
  stationsPayload,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const tree = useMemo(() => stationToTree(stationsPayload.stations), []);

  const [locations, setLocations] = useState<ClosestStation[]>([]);

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
        <SearchOSM
          selectLocation={(pickedLat, pickedLon, pickedDescription) =>
            setLocations((curr) => {
              const [closestStation, pickedToStationDist] = findClosestStation(
                pickedLat,
                pickedLon,
                tree
              );
              return curr.concat({
                pickedDescription,
                pickedLon,
                pickedLat,
                closestStation,
                pickedToStationDist,
              });
            })
          }
        />
        {locations.length ? (
          <DescribeStation
            stations={locations}
            ps={stationsPayload.percentiles}
            deleteStation={(name) =>
              setLocations((curr) =>
                curr.filter((s) => s.closestStation.name !== name)
              )
            }
          />
        ) : (
          <p>(pick a location)</p>
        )}
        <p>
          <small>
            <a href="https://github.com/fasiha/hareonna/">Source</a> on GitHub
          </small>
        </p>
      </div>
    </>
  );
}

/* Next.js infra: load raw data at compile-time and bundle it */
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
