// Paired benchmark on real processes: the same command both sides is not a
// regression (exit 0); a planted 80 ms sleep in the candidate FAILs (exit 1)
// and the ledger gains one row; a failing command is exit 2, never a verdict.
import fs from 'node:fs';
import { selftest } from '../lib/selftest.mjs';

await selftest('bench.pair', (t) => {
  const node = process.execPath;
  const quick = JSON.stringify([node, '-e', '']);
  const slow = JSON.stringify([node, '-e', 'setTimeout(() => {}, 80)']);
  const ledger = `${t.dir}/ledger.jsonl`;
  const common = ['--runs', '20', '--warmups', '1', '--ledger', ledger];
  const same = t.exit('same command both sides is not a regression', t.run('bench/pair.mjs', ['--baseline', quick, '--candidate', quick, ...common], { timeout: 120000 }), 0);
  t.check('same command: first line is not FAIL', ['PASS', 'INCONCLUSIVE'].includes(same.stdout.split('\n')[0]), same.stdout.split('\n')[0]);
  const red = t.exit('planted 80 ms sleep in the candidate goes red', t.run('bench/pair.mjs', ['--baseline', quick, '--candidate', slow, ...common], { timeout: 120000 }), 1);
  t.check('planted sleep: first line is FAIL', red.stdout.split('\n')[0] === 'FAIL', red.stdout.split('\n')[0]);
  const rows = fs.readFileSync(ledger, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  t.check('ledger is append-only: two rows, the second FAIL', rows.length === 2 && rows[1].result === 'FAIL' && rows[0].environment.node === process.version, `${rows.length} rows`);
  t.exit('a failing command is exit 2, not a verdict', t.run('bench/pair.mjs', ['--baseline', quick, '--candidate', JSON.stringify([node, '-e', 'process.exit(4)']), '--runs', '20', '--warmups', '1']), 2);
  t.exit('fewer than 20 runs is refused', t.run('bench/pair.mjs', ['--baseline', quick, '--candidate', quick, '--runs', '5']), 2);
});
