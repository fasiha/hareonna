import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { kdTree } from "kd-tree-javascript";
import * as Plot from "@observablehq/plot";
import { pseudoToExact, pseudoHaversine } from "../haversine";

import { MapStationsDynamic } from "../components/MapStationsDynamic";
import {
  StationWithSummary,
  StationsWithSummaryPayload,
  NominatimResult,
  SimilarStations,
  PaginatedStations,
} from "./interfaces";
import Intro from "./Intro";
import { unique } from "../utils";

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
    ret = `temp. ≤ this ${pToDay(p)} days/year`;
  } else if (p < 0.51) {
    ret = `temp. ≤ this ${pToMon(p)} months/year`;
  } else if (1 - p < 0.15) {
    ret = `temp. ≥ this ${pToDay(1 - p)} days/year`;
  } else {
    ret = `temp. ≥ this ${pToMon(1 - p)} months/year`;
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

interface DescribeStationProps {
  stationsInPage: PaginatedStations;
  pickedAndSimilarStations: StationWithSummary[];
  numPicked: number;
  ps: number[];
  deleteStation: (name: string) => void;
  setSimilarTo: (station: StationWithSummary) => void;
  selectLocation: (lat: number, lon: number) => void;
}
function DescribeStations({
  stationsInPage,
  pickedAndSimilarStations,
  numPicked,
  ps,
  deleteStation,
  setSimilarTo,
  selectLocation,
}: DescribeStationProps) {
  const days = stationsInPage[0]?.val.summary.days || -1;
  const stationDescriptions = new Map(
    pickedAndSimilarStations.map((s) => [
      s.name,
      `${s.name}: ${s.desc} (${(
        (Math.min(...s.summary.goods) / days) *
        100
      ).toFixed(1)}% good data over ${days} days)`,
    ])
  );
  const showStationNames = new Set(stationsInPage.map((s) => s.val.name));

  const [width, setWidth] = useState(640);
  const plotRef = useRef(null);
  useEffect(() => {
    if (stationsInPage.length === 0) {
      return;
    }
    const data = stationsInPage.flatMap(({ val: s, valIdx: sidx }, i) =>
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
  }, [stationsInPage, width]);
  if (stationsInPage.length === 0) {
    return <p>(Waiting for you to pick some weather stations.)</p>;
  }

  return (
    <div>
      <div style={{ width: "100%" }} ref={plotRef} />
      <p>
        (Tweak width: <button onClick={() => setWidth(width + 100)}>+</button>{" "}
        <button onClick={() => setWidth(width - 100)}>-</button>)
      </p>
      <ol>
        {pickedAndSimilarStations.map((s, i) => (
          <li
            key={s.name + (i < numPicked)}
            className={
              (showStationNames.has(s.name)
                ? "shown-station"
                : "not-shown-station") +
              (i === numPicked ? " first-similar-to" : "")
            }
          >
            {i >= numPicked && `#${i - numPicked + 1} Similar: `}
            {stationDescriptions.get(s.name)}{" "}
            {i < numPicked && (
              <>
                <button onClick={() => deleteStation(s.name)}>Delete</button>{" "}
              </>
            )}
            <button onClick={() => setSimilarTo(s)}>Find similar</button>{" "}
            <button onClick={() => selectLocation(s.lat, s.lon)}>Zoom</button>
          </li>
        ))}
      </ol>
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>
              %<sub>ile</sub>
            </th>
            {stationsInPage.map(({ val: s, valIdx: sidx }) => (
              <th
                key={s.name + (sidx < numPicked)}
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
            {stationsInPage.map((_, i) => (
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
              {stationsInPage.map(({ val: s, valIdx }) => (
                <Fragment key={s.name + (valIdx < numPicked)}>
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
interface SortBySimilarityArgs {
  targetStation: StationWithSummary;
  stations: StationWithSummary[];
  ps: number[];
  indexes?: { low: boolean; idx: number }[];
}
function sortBySimilarity({
  targetStation,
  stations,
  ps,
  indexes = [],
}: SortBySimilarityArgs) {
  if (indexes.length === 0) {
    indexes = [];
    for (const [pidx, p] of ps.entries()) {
      if (p === 0.1 || p === 0.9) {
        indexes.push({ low: true, idx: pidx });
        indexes.push({ low: false, idx: pidx });
      }
    }
  }

  // Least-squares
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
const SIMILAR_TO_SHOW = 20;
const defaultSimilarTo = {
  numToShow: 0,
  targetStation: undefined,
  similarStations: [],
};
export default function App({
  stationsPayload,
}: {
  stationsPayload: StationsWithSummaryPayload;
}) {
  const tree = useMemo(() => stationToTree(stationsPayload.stations), []);

  const [pickedStations, setPickedStations] = useState<StationWithSummary[]>(
    []
  );
  const [camera, setCamera] = useState({
    center: [0, 0] as [number, number],
    pointsToFit: [] as [number, number][],
  });
  const [similarTo, setSimilarTo] = useState<SimilarStations>(defaultSimilarTo);
  const [nPerPage, setNPerPage] = useState(5);
  const [firstRestIdx, setFirstRestIdx] = useState(1);

  // these have to memoized because we send these to be mapped.
  // TODO: shift the entire pagination to the two components so this is less confusing.
  const pickedAndSimilarStations = useMemo(
    () =>
      pickedStations.concat(
        similarTo.similarStations.slice(0, similarTo.numToShow)
      ),
    [pickedStations, similarTo]
  );
  const show = useMemo(
    () => paginateWithFirst(pickedAndSimilarStations, nPerPage, firstRestIdx),
    [nPerPage, firstRestIdx, pickedAndSimilarStations]
  );

  function flipPage(n: number) {
    const ret = firstRestIdx + n;
    if (ret <= 1) {
      setFirstRestIdx(1);
    } else if (ret >= pickedAndSimilarStations.length - 1) {
      setFirstRestIdx(pickedAndSimilarStations.length - 1);
    } else {
      setFirstRestIdx(ret);
    }
  }

  const processSimilar = useCallback(
    (targetStation: StationWithSummary) => {
      const similarStations = sortBySimilarity({
        targetStation,
        stations: stationsPayload.stations,
        ps: stationsPayload.percentiles,
      });
      setSimilarTo((curr) => ({
        numToShow:
          (curr.targetStation?.name === targetStation.name
            ? curr.numToShow
            : 0) + SIMILAR_TO_SHOW,
        targetStation,
        similarStations,
      }));
      setPickedStations((curr) => {
        if (curr.find((s) => s.name === targetStation.name)) {
          return curr;
        }
        return curr.concat(targetStation);
      });
    },
    [setSimilarTo, setPickedStations]
  );

  useEffect(() => {
    const wanted = loadUrl();
    if (wanted.length) {
      const wantedToIdx = new Map(wanted.map((s, i) => [s, i]));
      const found: StationWithSummary[] = [];
      for (const s of stationsPayload.stations) {
        const hit = wantedToIdx.get(s.name);
        if (hit !== undefined) {
          found[hit] = s;
        }
      }
      setPickedStations(found.filter((s) => !!s));
    }
  }, []);
  useEffect(() => {
    saveUrl(pickedStations);
  }, [pickedStations]);

  return (
    <>
      <h1>Hareonna</h1>
      <Intro />
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
        setSimilarTo={(s) => processSimilar(s)}
        setStation={(newStation: StationWithSummary) => {
          setPickedStations((curr) => {
            if (curr.find((s) => s.name === newStation.name)) {
              // Don't add duplicates
              return curr;
            }
            return curr.concat(newStation);
          });
        }}
        camera={camera}
        stationsPayload={stationsPayload}
        stationsInPage={show}
        pickedAndSimilarStations={pickedAndSimilarStations}
        numPicked={pickedStations.length}
        targetStation={similarTo.targetStation}
      />
      <h2>Visualization of high/low temperature percentiles</h2>
      <p>
        <button
          disabled={firstRestIdx <= 1}
          onClick={() => flipPage(-(nPerPage - 1))}
          title="Jump back"
        >
          ⇇
        </button>{" "}
        <button
          disabled={firstRestIdx <= 1}
          onClick={() => flipPage(-1)}
          title="Step back one"
        >
          ←
        </button>{" "}
        |{" "}
        <button
          disabled={firstRestIdx >= pickedAndSimilarStations.length - 1}
          onClick={() => flipPage(1)}
          title="Step ahead one"
        >
          →
        </button>{" "}
        <button
          disabled={firstRestIdx >= pickedAndSimilarStations.length - 1}
          onClick={() => flipPage(nPerPage - 1)}
          title="Jump ahead"
        >
          ⇉
        </button>{" "}
        <label htmlFor="nPerPage">Stations to show at once? </label>
        <input
          id="nPerPage"
          type={"number"}
          min={2}
          value={nPerPage}
          onChange={(e) => setNPerPage(Math.max(2, +e.target.value))}
        />{" "}
        <button
          disabled={pickedStations.length === 0}
          onClick={() => {
            setPickedStations([]);
            setSimilarTo(defaultSimilarTo);
          }}
        >
          Delete all!
        </button>{" "}
        <button
          disabled={!similarTo.targetStation}
          onClick={() => setSimilarTo(defaultSimilarTo)}
        >
          Clear similar
        </button>
      </p>
      <DescribeStations
        stationsInPage={show}
        pickedAndSimilarStations={pickedAndSimilarStations}
        numPicked={pickedStations.length}
        ps={stationsPayload.percentiles}
        deleteStation={(name) =>
          setPickedStations((curr) => curr.filter((s) => s.name !== name))
        }
        setSimilarTo={(s) => processSimilar(s)}
        selectLocation={(lat, lon) => {
          const hits = tree.nearest({ lat, lon } as StationWithSummary, 3);
          setCamera({
            center: [lat, lon],
            pointsToFit: hits.map(([{ lat, lon }]) => [lat, lon]),
          });
        }}
      />
      <p>
        <small>
          <a href="https://github.com/fasiha/hareonna/">Source</a> on GitHub
        </small>
      </p>
    </>
  );
}

/* helpers */
function loadUrl(): string[] {
  return window.location.hash
    .replace(/^#*/, "")
    .split(",")
    .filter((s) => s.startsWith("s:"))
    .map((s) => s.slice(2));
}

function saveUrl(stationsOfInterest: StationWithSummary[]) {
  if (stationsOfInterest.length) {
    // if we reset it to "#", the browser might jump to top of page :-/
    window.location.hash = stationsOfInterest
      .map((s) => "s:" + s.name)
      .join(",");
  }
}
