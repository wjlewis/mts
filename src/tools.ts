export function zip<T, U>(xs: T[], ys: U[]): Array<[T, U]> {
  const out = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    out[i] = [xs[i], ys[i]];
  }
  return out as Array<[T, U]>;
}

export function groupBy<T, K extends keyof T>(
  xs: T[],
  key: K
): T[K] extends string | symbol | number ? { [k in T[K]]: T[] } : never {
  const out: any = {};

  for (const x of xs) {
    const k = x[key];
    out[k] = [...(out[k] ?? []), x];
  }

  return out;
}

export function mapValues<T, U>(
  o: { [k: string]: T },
  fn: (x: T, key: string) => U
): { [key: string]: U } {
  const out: any = {};

  for (const k of Object.keys(o)) {
    out[k] = fn(o[k], k);
  }

  return out;
}
