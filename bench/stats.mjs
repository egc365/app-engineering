// Moved from /apps/workspace/tools/fitness/lib/stats.mjs (2026-09-24); this file is
// the one implementation. Workspace re-exports it.
// Spread-aware statistics for repeated measurements. Pure; no I/O.
// A threshold over N runs is the baseline median plus a margin. The margin is the
// larger of k times the median absolute deviation (MAD) and a floor, because a
// baseline whose runs agree to the megabyte (MAD 0) would otherwise flag noise.

export function median(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Median absolute deviation around the median (unscaled).
export function mad(values) {
  const med = median(values);
  if (med === null) return null;
  return median(values.map((x) => Math.abs(x - med)));
}

// Upper bound a new median must stay under. `k` scales the MAD; `floorAbs` and
// `floorPct` (fraction of the median) give the margin when the spread degenerates.
export function upperBound(values, { k = 3, floorAbs = 0, floorPct = 0 } = {}) {
  const med = median(values);
  if (med === null) return null;
  const spread = mad(values) || 0;
  const margin = Math.max(k * spread, floorAbs, floorPct * Math.abs(med));
  return med + margin;
}

export function lowerBound(values, opts) {
  const med = median(values);
  if (med === null) return null;
  return 2 * med - upperBound(values, opts);
}

// Linear-interpolated quantile (the same rule as Python statistics'
// "inclusive" method and numpy's default): position (n - 1) * q.
// From the App Builder Kit (appbuild/bench.py quantile, Sol, 2026-09-24).
export function quantile(values, q) {
  const v = [...values].sort((a, b) => a - b);
  const i = (v.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? v[lo] : v[lo] * (hi - i) + v[hi] * (i - lo);
}

// N, min, max, mean, p50, p90 (N >= 10), p95 (N >= 20), p99 (N >= 100),
// sample standard deviation and coefficient of variation. A tail percentile is
// null when N is too small to estimate it (TOOLCHAIN item 1, "when N allows").
export function summary(values) {
  if (!values.length || values.some((x) => typeof x !== 'number' || !Number.isFinite(x) || x < 0)) throw new Error('summary: finite non-negative samples required');
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  return {
    n, min: Math.min(...values), max: Math.max(...values), mean,
    p50: quantile(values, 0.5), p90: n >= 10 ? quantile(values, 0.9) : null,
    p95: n >= 20 ? quantile(values, 0.95) : null, p99: n >= 100 ? quantile(values, 0.99) : null,
    stdev: sd, cv: sd !== null && mean ? sd / mean : null,
  };
}

// Seeded PRNG (mulberry32) so a bootstrap is reproducible run to run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 95% percentile-bootstrap interval of quantile_q(candidate) - quantile_q(baseline),
// resampling each group independently (unpaired).
export function deltaCI(baseline, candidate, { q = 0.5, resamples = 4000, seed = 1147 } = {}) {
  const rand = mulberry32(seed);
  const pick = (xs) => xs.map(() => xs[Math.floor(rand() * xs.length)]);
  const deltas = [];
  for (let i = 0; i < resamples; i += 1) deltas.push(quantile(pick(candidate), q) - quantile(pick(baseline), q));
  return [quantile(deltas, 0.025), quantile(deltas, 0.975)];
}

// CLI: node bench/stats.mjs --values 1,2,3 [--k 3] [--floor-abs 0] [--floor-pct 0]
// (or the numbers on stdin, whitespace or comma separated). Prints JSON.
import fs from 'node:fs';
import { isMain, parseFlags, num, usage } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['values', 'k', 'floor-abs', 'floor-pct'] });
  const text = f.values !== undefined ? f.values : fs.readFileSync(0, 'utf8');
  const values = text.split(/[\s,]+/).filter(Boolean).map(Number);
  if (!values.length || values.some((v) => !Number.isFinite(v))) usage('stats: give finite numbers');
  const opts = { k: f.k !== undefined ? num(f.k, 'k') : 3, floorAbs: f['floor-abs'] !== undefined ? num(f['floor-abs'], 'floor-abs') : 0, floorPct: f['floor-pct'] !== undefined ? num(f['floor-pct'], 'floor-pct') : 0 };
  process.stdout.write(JSON.stringify({ n: values.length, median: median(values), mad: mad(values), upperBound: upperBound(values, opts), lowerBound: lowerBound(values, opts), opts }) + '\n');
}
