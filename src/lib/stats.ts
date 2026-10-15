export interface Statistics {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stddev: number | null;
}
/** Welford population variance; sort a copy for median, never the source sequence. */
export function statistics(values: readonly (number | null)[]): Statistics {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!valid.length)
    return { count: 0, mean: null, median: null, min: null, max: null, stddev: null };
  let n = 0,
    mean = 0,
    m2 = 0,
    min = Infinity,
    max = -Infinity;
  for (const x of valid) {
    n++;
    const delta = x - mean;
    mean += delta / n;
    m2 += delta * (x - mean);
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  const sorted = [...valid].sort((a, b) => a - b),
    mid = Math.floor(n / 2);
  return {
    count: n,
    mean,
    median: n % 2 ? sorted[mid] : sorted[mid - 1] / 2 + sorted[mid] / 2,
    min,
    max,
    stddev: Math.sqrt(Math.max(0, m2 / n)),
  };
}
