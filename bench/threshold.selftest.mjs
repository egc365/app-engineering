// The threshold gate passes a value inside its bound and goes red on a planted
// regression, and it is fail-closed: a kind that needs a baseline fails without one.
import { selftest } from '../lib/selftest.mjs';

await selftest('bench.threshold', (t) => {
  const ledger = t.write('baseline.json', JSON.stringify({ checks: { 'perf.ro-ready': { value: 527, runs: [527, 530, 519] }, 'dead': { value: 6 } } }));
  const spread = JSON.stringify({ kind: 'spread', k: 3, floorPct: 0.05 });
  t.exit('spread: real value passes', t.run('bench/threshold.mjs', ['--threshold', spread, '--value', '531', '--baseline', ledger, '--key', 'perf.ro-ready']), 0);
  t.exit('spread: planted regression (2016 ms) goes red', t.run('bench/threshold.mjs', ['--threshold', spread, '--value', '2016', '--baseline', ledger, '--key', 'perf.ro-ready']), 1);
  t.exit('spread: no baseline is red (fail-closed)', t.run('bench/threshold.mjs', ['--threshold', spread, '--value', '1', '--baseline', ledger, '--key', 'missing']), 1);
  t.exit('spread: unreadable baseline file is red', t.run('bench/threshold.mjs', ['--threshold', spread, '--value', '1', '--baseline', `${t.dir}/absent.json`, '--key', 'perf.ro-ready']), 1);
  const ratchet = JSON.stringify({ kind: 'ratchet' });
  t.exit('ratchet: at baseline passes', t.run('bench/threshold.mjs', ['--threshold', ratchet, '--value', '6', '--baseline', ledger, '--key', 'dead']), 0);
  t.exit('ratchet: planted increase goes red', t.run('bench/threshold.mjs', ['--threshold', ratchet, '--value', '7', '--baseline', ledger, '--key', 'dead']), 1);
  t.exit('zero: one finding goes red', t.run('bench/threshold.mjs', ['--threshold', '{"kind":"zero"}', '--value', '1']), 1);
  t.exit('not-a-number value is a usage error', t.run('bench/threshold.mjs', ['--threshold', '{"kind":"zero"}', '--value', 'abc']), 2);
  t.exit('unknown kind is a usage error', t.run('bench/threshold.mjs', ['--threshold', '{"kind":"vibes"}', '--value', '1']), 2);
});
