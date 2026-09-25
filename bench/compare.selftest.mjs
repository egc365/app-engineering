// Performance gate (Sol's four BenchmarkDetectorTests, through the library and
// the CLI): identical samples are INCONCLUSIVE; a planted 80 ms slowdown FAILs
// (exit 1); a 45 ms improvement PASSes; p99 appears only at N >= 100; fewer
// than 20 samples are INCONCLUSIVE, never PASS.
import { selftest } from '../lib/selftest.mjs';
import { compare } from './compare.mjs';
import { summary } from './stats.mjs';

await selftest('bench.compare', (t) => {
  const base = Array.from({ length: 30 }, (_, i) => 90 + (i % 5));
  t.check('identical samples are INCONCLUSIVE', compare(base, base, { resamples: 400 }).result === 'INCONCLUSIVE');
  t.check('planted 80 ms slowdown FAILs', compare(base, base.map((x) => x + 80), { resamples: 400 }).result === 'FAIL');
  const fast = Array.from({ length: 30 }, (_, i) => 150 + (i % 5));
  t.check('a 45 ms improvement PASSes', compare(fast, fast.map((x) => x - 45), { resamples: 400 }).result === 'PASS');
  t.check('p99 is null below N=100 and present at 100', summary(Array(30).fill(1)).p99 === null && summary(Array(100).fill(1)).p99 === 1);
  t.check('19 samples a side are INCONCLUSIVE even with a big slowdown', compare(base.slice(0, 19), base.slice(0, 19).map((x) => x + 80)).result === 'INCONCLUSIVE');
  const samples = t.write('samples.json', JSON.stringify({ baseline_ms: base, candidate_ms: base.map((x) => x + 80) }));
  const red = t.exit('CLI: planted slowdown exits 1', t.run('bench/compare.mjs', ['--samples', samples, '--resamples', '400']), 1);
  t.check('CLI first line is exactly FAIL', red.stdout.split('\n')[0] === 'FAIL', red.stdout.split('\n')[0]);
  const same = t.exit('CLI: identical samples exit 0', t.run('bench/compare.mjs', ['--baseline', base.join(','), '--candidate', base.join(','), '--resamples', '400']), 0);
  t.check('CLI first line is exactly INCONCLUSIVE', same.stdout.split('\n')[0] === 'INCONCLUSIVE', same.stdout.split('\n')[0]);
  t.exit('CLI refuses negative samples', t.run('bench/compare.mjs', ['--baseline', '1,-2', '--candidate', '1,2']), 2);
});
