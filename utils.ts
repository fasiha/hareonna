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