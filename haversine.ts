const {PI, sin, cos} = Math;
const radperdeg = PI / 180;
export function pseudoHaversine(p1: [number, number], p2: [number, number]): number {
  // We need to do it this way because kd-tree-javascript will pass in _objects_ like
  // p1 = {'0': _, '1': __}`.
  const rlat1 = p1[0] * radperdeg;
  const rlon1 = p1[1] * radperdeg;
  const rlat2 = p2[0] * radperdeg;
  const rlon2 = p2[1] * radperdeg;

  const dLat = rlat2 - rlat1;
  const dLon = rlon2 - rlon1;
  return sin(dLat * .5) ** 2 + sin(dLon * .5) ** 2 * cos(rlat1) * cos(rlat2);
};

export function haversine(p1: [number, number], p2: [number, number], radiusKm = 6371): number {
  return radiusKm * 2 * Math.asin(Math.sqrt(pseudoHaversine(p1, p2)));
}

export function pseudoToExact(pseudo: number, radiusKm = 6371): number {
  return radiusKm * 2 * Math.asin(Math.sqrt(pseudo));
}