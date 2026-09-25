// Soak judge: a flat series passes; a planted 1.5 MB/cycle growth and a planted
// handle leak go red. The driver (runSoak) is run in-process on a cycle that
// retains what it allocates (a real leak) and on one that releases it.
import { selftest } from '../lib/selftest.mjs';
import { runSoak, judgeSoak, slope } from './soak.mjs';

await selftest('process.soak', async (t) => {
  t.check('slope of 0,1,2,3 is 1', slope([0, 1, 2, 3]) === 1);
  const flat = Array.from({ length: 24 }, (_, i) => ({ cycle: i + 1, pssMb: 350 + (i % 3) * 0.1, webContents: 5 }));
  const flatFile = t.write('flat.json', JSON.stringify(flat));
  const bounds = ['--warmup', '4', '--max-slope', 'pssMb=0.75', '--max-growth', 'webContents=0'];
  t.exit('flat series passes', t.run('process/soak.mjs', ['--samples', flatFile, ...bounds]), 0);
  const leaking = flat.map((s, i) => ({ ...s, pssMb: 350 + 1.5 * i }));
  t.exit('planted 1.5 MB/cycle goes red', t.run('process/soak.mjs', ['--samples', t.write('leak.json', JSON.stringify(leaking)), ...bounds]), 1);
  const handles = flat.map((s, i) => ({ ...s, webContents: i > 10 ? 6 : 5 }));
  t.exit('planted handle leak (+1 webContents) goes red', t.run('process/soak.mjs', ['--samples', t.write('handles.json', JSON.stringify(handles)), ...bounds]), 1);

  const kept = [];
  const leaky = await runSoak({ cycles: 12, warmupCycles: 2, cycle: () => { kept.push(new Array(1000).fill(0)); }, sample: () => ({ retained: kept.length }) });
  t.check('driver: a cycle that retains its allocation is judged a leak', !judgeSoak(leaky, { maxGrowth: { retained: 0 } }).pass, JSON.stringify(leaky.growth));
  let live = 0;
  const clean = await runSoak({ cycles: 12, warmupCycles: 2, cycle: () => { live += 1; live -= 1; }, sample: () => ({ retained: live }) });
  t.check('driver: a cycle that releases passes', judgeSoak(clean, { maxGrowth: { retained: 0 }, maxSlope: { retained: 0 } }).pass, JSON.stringify(clean.slope));
});
