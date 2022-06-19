import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { kdTree } from "kd-tree-javascript";
import * as Plot from "@observablehq/plot";
import { pseudoToExact, pseudoHaversine } from "../haversine";

import { MapStationsDynamic } from "../components/MapStationsDynamic";
import {
  StationWithSummary,
  StationsWithSummaryPayload,
  NominatimResult,
} from "./interfaces";

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

/* OpenStreetMap lookup */
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
const pToDay = (p: number) => Math.round(p * 365.25);
const pToMon = (p: number) => Math.round(p * 12);

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
  stations: StationWithSummary[];
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

  const days = stations[0].summary.days;
  const stationDescriptions = stations.map(
    (s) =>
      `${s.name}: ${s.desc} (${(
        (Math.min(...s.summary.goods) / days) *
        100
      ).toFixed(1)}% good data over ${days} days)`
  );

  const [width, setWidth] = useState(640);
  const plotRef = useRef(null);
  useEffect(() => {
    const data = stations.flatMap((s, sidx) =>
      s.summary.his.map((hi, i) => ({
        hi,
        lo: s.summary.lows[i],
        p: ps[i] * 100,
        station: `${circledNumbers[sidx] || sidx} ${s.desc.replaceAll(
          /\s+/g,
          " "
        )}`,
      }))
    );
    const chart = Plot.plot({
      width: width,
      y: {
        grid: true,
        label: "↑ °C",
      },
      x: { label: "percentile →" },
      facet: { data, x: "station" },
      marks: [
        Plot.ruleY([10, 20, 30]),
        Plot.areaY(data, {
          x: "p",
          y: "lo",
          y2: "hi",
          fillOpacity: 0.5,
          fill: "station",
        }),
        Plot.lineY(data, {
          x: "p",
          y: "lo",
          marker: "circle",
          stroke: "station",
          strokeWidth: 1,
        }),
        Plot.lineY(data, {
          x: "p",
          y: "hi",
          marker: "circle",
          stroke: "station",
          strokeWidth: 1,
        }),
      ],
    });
    (plotRef.current as any).append(chart);

    return () => {
      chart.remove();
    };
  }, [stations, width]);

  return (
    <div>
      <div style={{ width: "100%" }} ref={plotRef} />
      <p>
        (Tweak width: <button onClick={() => setWidth(width + 100)}>+</button>{" "}
        <button onClick={() => setWidth(width - 100)}>-</button>)
      </p>
      <ol>
        {stations.map((s, i) => (
          <li key={s.name}>
            {stationDescriptions[i]}{" "}
            <button onClick={() => deleteStation(s.name)}>Delete</button>
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
              <th key={s.name} colSpan={2} title={stationDescriptions[i]}>
                {circledNumbers[i] || i}{" "}
                <button onClick={() => deleteStation(s.name)}>x</button>
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
                <Fragment key={s.name}>
                  <td>{s.summary.lows[i]} °C</td>
                  <td>{s.summary.his[i]} °C</td>
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
export default function App({
  stationsPayload,
}: {
  stationsPayload: StationsWithSummaryPayload;
}) {
  const tree = useMemo(() => stationToTree(stationsPayload.stations), []);

  const [stations, setStations] = useState<StationWithSummary[]>([]);

  return (
    <>
      <h1>Hareonna</h1>
      <div>
        <SearchOSM
          selectLocation={(pickedLat, pickedLon, pickedDescription) =>
            setStations((curr) => {
              const [closestStation, pickedToStationDist] = findClosestStation(
                pickedLat,
                pickedLon,
                tree
              );
              if (curr.find((s) => s.name === closestStation.name)) {
                // Don't add duplicates
                return curr;
              }
              return curr.concat(closestStation);
            })
          }
        />
        <MapStationsDynamic stationsPayload={stationsPayload} />
        <DescribeStation
          stations={stations}
          ps={stationsPayload.percentiles}
          deleteStation={(name) =>
            setStations((curr) => curr.filter((s) => s.name !== name))
          }
        />
        <p>
          <small>
            <a href="https://github.com/fasiha/hareonna/">Source</a> on GitHub
          </small>
        </p>
      </div>
    </>
  );
}
