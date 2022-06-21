import {StationWithSummary} from "./components/interfaces";

export function unique<T, U>(v: T[], key: (x: T) => U): T[] {
  const ys: Set<U> = new Set([]);
  const ret: T[] = [];
  for (const x of v) {
    const y = key(x);
    if (!ys.has(y)) {
      ys.add(y);
      ret.push(x);
    }
  }
  return ret;
}
export const stat2ll = (s: StationWithSummary) => [s.lat, s.lon] as [number, number];
