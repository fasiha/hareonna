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
    (a, b) => pseudoHaversine([a.lat, a.lon], [b.lat, b.lon]),
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
  selectLocation: (lat: number, lon: number) => void;
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
            <button onClick={() => latLonSelector(+r.lat, +r.lon)}>Zoom</button>{" "}
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

function circleNumber(n: number): string {
  const circledNumbers =
    "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿";
  return circledNumbers[n] || "" + n;
}

function paginateWithFirst<T>(
  all: T[],
  nPerPage: number,
  firstRest: number
): { val: T; valIdx: number }[] {
  if (all.length === 0) {
    return [];
  }
  const first = all[0];
  firstRest = Math.max(firstRest, 1);
  const rest = all.slice(firstRest, firstRest + nPerPage - 1);
  const show = [first].concat(rest);
  const showIdxs = [0].concat(rest.map((_, i) => i + firstRest));
  return show.map((val, i) => ({ val, valIdx: showIdxs[i] }));
}

type PaginatedStations = ReturnType<
  typeof paginateWithFirst<StationWithSummary>
>;
interface DescribeStationProps {
  showStations: PaginatedStations;
  allStations: StationWithSummary[];
  ps: number[];
  deleteStation: (name: string) => void;
  setSimilarTo: (station: StationWithSummary) => void;
}
function DescribeStations({
  showStations,
  allStations,
  ps,
  deleteStation,
  setSimilarTo,
}: DescribeStationProps) {
  if (showStations.length === 0) {
    return <p>(Waiting for you to pick some weather stations.)</p>;
  }

  const days = showStations[0].val.summary.days;
  const stationDescriptions = new Map(
    allStations.map((s) => [
      s.name,
      `${s.name}: ${s.desc} (${(
        (Math.min(...s.summary.goods) / days) *
        100
      ).toFixed(1)}% good data over ${days} days)`,
    ])
  );
  const showStationNames = new Set(showStations.map((s) => s.val.name));

  const [width, setWidth] = useState(640);
  const plotRef = useRef(null);
  useEffect(() => {
    const data = showStations.flatMap(({ val: s, valIdx: sidx }, i) =>
      s.summary.his.map((hi, pi) => ({
        hi,
        lo: s.summary.lows[pi],
        p: ps[pi] * 100,
        station: `${circleNumber(sidx)} ${s.desc.replaceAll(/\s+/g, " ")}`,
      }))
    );
    const chart = Plot.plot({
      width: width,
      height: "300",
      y: {
        grid: true,
        label: "↑ °C",
      },
      x: { label: "percentile →" },
      facet: { data, x: "station" },
      marks: [
        Plot.ruleY([10, 20, 30]),
        Plot.areaY(
          data.filter((s) => s.station === data[0].station),
          {
            x: "p",
            y: "lo",
            y2: "hi",
            fillOpacity: 0.25,
            fill: "station",
            facet: false,
          }
        ),
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
  }, [showStations, width]);

  return (
    <div>
      <ol>
        {allStations.map((s) => (
          <li
            key={s.name}
            className={
              showStationNames.has(s.name)
                ? "shown-station"
                : "not-shown-station"
            }
          >
            {stationDescriptions.get(s.name)}{" "}
            <button onClick={() => deleteStation(s.name)}>Delete</button>{" "}
            <button onClick={() => setSimilarTo(s)}>Find similar</button>
          </li>
        ))}
      </ol>
      <div style={{ width: "100%" }} ref={plotRef} />
      <p>
        (Tweak width: <button onClick={() => setWidth(width + 100)}>+</button>{" "}
        <button onClick={() => setWidth(width - 100)}>-</button>)
      </p>
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>
              %<sub>ile</sub>
            </th>
            {showStations.map(({ val: s, valIdx: sidx }) => (
              <th
                key={s.name}
                colSpan={2}
                title={stationDescriptions.get(s.name)}
              >
                {circleNumber(sidx)}{" "}
                <button onClick={() => deleteStation(s.name)}>x</button>
              </th>
            ))}
            <th rowSpan={2}>(notes)</th>
          </tr>
          <tr>
            {showStations.map((_, i) => (
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
              {showStations.map(({ val: s }) => (
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

/* Final trick: similar to this station */
interface SimilarToProps {
  targetStation: StationWithSummary;
  stations: StationWithSummary[];
  ps: number[];
  indexes?: { low: boolean; idx: number }[];
}
function SimilarTo({
  targetStation,
  stations,
  ps,
  indexes = [],
}: SimilarToProps) {
  if (indexes.length === 0) {
    indexes = [];
    for (const [pidx, p] of ps.entries()) {
      if (p === 0.1 || p === 0.9) {
        indexes.push({ low: true, idx: pidx });
        indexes.push({ low: false, idx: pidx });
      }
    }
  }

  function distv(
    a: StationWithSummary,
    b: StationWithSummary,
    v: typeof indexes
  ) {
    let ret = 0;
    for (const { low, idx: i } of v) {
      if (low) {
        ret += (a.summary.lows[i] - b.summary.lows[i]) ** 2;
      } else {
        ret += (a.summary.his[i] - b.summary.his[i]) ** 2;
      }
    }
    return ret;
  }

  const sorted = stations
    .slice()
    .sort(
      (a, b) =>
        distv(a, targetStation, indexes) - distv(b, targetStation, indexes)
    )
    .slice(1);
  return sorted;
}

/* Main app */
export default function App({
  stationsPayload,
}: {
  stationsPayload: StationsWithSummaryPayload;
}) {
  const tree = useMemo(() => stationToTree(stationsPayload.stations), []);

  const [stationsOfInterest, setStationsOfInterest] = useState<
    StationWithSummary[]
  >([]);
  const [camera, setCamera] = useState({
    center: [0, 0] as [number, number],
    pointsToFit: [] as [number, number][],
  });
  const [similarTo, setSimilarTo] = useState<undefined | StationWithSummary>(
    undefined
  );
  const similarStations = useMemo(
    () =>
      similarTo
        ? SimilarTo({
            targetStation: similarTo,
            stations: stationsPayload.stations,
            ps: stationsPayload.percentiles,
          })
        : [],
    [similarTo, stationsPayload]
  );
  const [nPerPage, setNPerPage] = useState(5);
  const [firstRestIdx, setFirstRestIdx] = useState(1);
  const show = paginateWithFirst(stationsOfInterest, nPerPage, firstRestIdx);
  function flipPage(n: number) {
    const ret = firstRestIdx + n;
    if (ret <= 1) {
      setFirstRestIdx(1);
    } else if (ret >= stationsOfInterest.length - 1) {
      setFirstRestIdx(stationsOfInterest.length - 1);
    } else {
      setFirstRestIdx(ret);
    }
  }

  return (
    <>
      <h1>Hareonna</h1>
      <h2>(Optional: Search for a place)</h2>
      <SearchOSM
        selectLocation={(lat, lon) => {
          const hits = tree.nearest({ lat, lon } as StationWithSummary, 5);
          setCamera({
            center: [lat, lon],
            pointsToFit: hits.map(([{ lat, lon }]) => [lat, lon]),
          });
        }}
      />
      <h2>Or: Click on a weather station and pick it</h2>
      <MapStationsDynamic
        setSimilarTo={(s) => setSimilarTo(s)}
        setStation={(newStation: StationWithSummary) => {
          setStationsOfInterest((curr) => {
            if (curr.find((s) => s.name === newStation.name)) {
              // Don't add duplicates
              return curr;
            }
            return curr.concat(newStation);
          });
        }}
        camera={camera}
        stationsPayload={stationsPayload}
        similarStationsObj={{ similarStations, targetStation: similarTo }}
      />
      <h2>Visualization of high/low temperature percentiles</h2>
      <p>
        <button onClick={() => flipPage(-nPerPage)}>⇇</button>{" "}
        <button onClick={() => flipPage(-1)}>←</button> |{" "}
        <button onClick={() => flipPage(1)}>→</button>{" "}
        <button onClick={() => flipPage(nPerPage)}>⇉</button>
      </p>
      <DescribeStations
        showStations={show}
        allStations={stationsOfInterest}
        ps={stationsPayload.percentiles}
        deleteStation={(name) =>
          setStationsOfInterest((curr) => curr.filter((s) => s.name !== name))
        }
        setSimilarTo={(s) => setSimilarTo(s)}
      />
      <p>
        <small>
          <a href="https://github.com/fasiha/hareonna/">Source</a> on GitHub
        </small>
      </p>
    </>
  );
}
