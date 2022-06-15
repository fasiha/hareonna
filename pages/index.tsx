import { useEffect, useState } from "react";

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

function SearchOSM() {
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
            {r.display_name}: {r.lat}°, {r.lon}°
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      Search OpenStreetMap for:
      <input
        type="text"
        placeholder="city, country, neighborhood, mountain…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
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

export default function HomePage() {
  return (
    <div>
      <SearchOSM />
    </div>
  );
}
