// Known answers for the spread statistics, through the library and the CLI.
import { selftest } from '../lib/selftest.mjs';
import { median, mad, upperBound, lowerBound, quantile, summary, deltaCI } from './stats.mjs';

await selftest('bench.stats', (t) => {
  t.check('median of an even count', median([4, 1, 3, 2]) === 2.5, `got ${median([4, 1, 3, 2])}`);
  t.check('median skips non-numbers', median([1, NaN, 3, 'x', 2]) === 2);
  t.check('MAD is robust to one outlier', mad([1, 2, 3, 4, 100]) === 1, `got ${mad([1, 2, 3, 4, 100])}`);
  t.check('upper bound = median + k*MAD', upperBound([1, 2, 3, 4, 100], { k: 3 }) === 6);
  t.check('floor applies when runs agree (MAD 0)', upperBound([500, 500, 500], { floorPct: 0.05 }) === 525);
  t.check('lower bound mirrors the upper', lowerBound([1, 2, 3, 4, 100], { k: 3 }) === 0);
  t.check('quantile interpolates linearly', quantile([10, 20], 0.25) === 12.5 && quantile([4, 1, 3, 2], 0.5) === 2.5);
  const s = summary([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  t.check('summary: p90 at N=10, p95 null below N=20', s.p90 === 9.1 && s.p95 === null && s.mean === 5.5, JSON.stringify(s));
  const ci = deltaCI([1, 2, 3], [1, 2, 3], { resamples: 200 });
  t.check('bootstrap is seeded (same interval twice)', JSON.stringify(ci) === JSON.stringify(deltaCI([1, 2, 3], [1, 2, 3], { resamples: 200 })), JSON.stringify(ci));
  const r = t.exit('CLI answers', t.run('bench/stats.mjs', ['--values', '527,530,519,600']), 0);
  let j = null;
  try { j = JSON.parse(r.stdout); } catch { /* checked below */ }
  t.check('CLI median and MAD', j && j.median === 528.5 && j.mad === 5.5, r.stdout.trim());
  t.exit('CLI refuses non-numbers', t.run('bench/stats.mjs', ['--values', '1,x']), 2);
});
