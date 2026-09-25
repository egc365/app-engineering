// Tree PSS over a fixture /proc: the sum is exact, an unrelated process is not
// counted, and a planted 200 MB child pushes the tree over its bound (red).
import path from 'node:path';
import { selftest } from '../lib/selftest.mjs';
import { makeProc } from '../lib/fakeproc.mjs';

await selftest('process.pss', (t) => {
  const base = [
    { pid: 100, ppid: 1, comm: 'app main', pssKb: 102400, rssKb: 204800 },
    { pid: 101, ppid: 100, comm: 'renderer', pssKb: 51200, rssKb: 153600 },
    { pid: 900, ppid: 1, comm: 'unrelated', pssKb: 999999, rssKb: 999999 },
  ];
  const clean = makeProc(path.join(t.dir, 'clean'), { procs: base });
  const r = t.exit('clean tree within 300 MB', t.run('process/pss.mjs', ['--pid', '100', '--proc-root', clean, '--max-mb', '300', '--json']), 0);
  let j = null;
  try { j = JSON.parse(r.stdout); } catch { /* checked below */ }
  t.check('PSS 150 MB, RSS 350 MB, 2 processes (unrelated pid excluded)', j && j.pssMb === 150 && j.rssMb === 350 && j.processes === 2, r.stdout.trim());
  const planted = makeProc(path.join(t.dir, 'planted'), { procs: [...base, { pid: 102, ppid: 101, comm: 'leaky helper', pssKb: 204800, rssKb: 204800 }] });
  t.exit('planted 200 MB grandchild goes red', t.run('process/pss.mjs', ['--pid', '100', '--proc-root', planted, '--max-mb', '300']), 1);
  t.exit('missing pid is a usage error', t.run('process/pss.mjs', ['--pid', '4242', '--proc-root', clean]), 2);
});
