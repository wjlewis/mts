export function zip<T, U>(xs: T[], ys: U[]): Array<[T, U]> {
  const out = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    out[i] = [xs[i], ys[i]];
  }
  return out as Array<[T, U]>;
}
