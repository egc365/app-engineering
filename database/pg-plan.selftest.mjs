// PostgreSQL plan summary: the known answers B2-T6 measured on Workspace's test
// database (inclusive root buffers, scan-node rows, loops), and the gates: an
// index scan passes --require-index; a planted sequential scan goes red, and so
// does a plan over --max-rows-scanned.
import { selftest } from '../lib/selftest.mjs';
import { summarizePlan } from './pg-plan.mjs';

await selftest('database.pg-plan', (t) => {
  const limitSort = { Plan: { 'Node Type': 'Limit', 'Actual Rows': 1, 'Actual Loops': 1, 'Shared Hit Blocks': 3, 'Shared Read Blocks': 1, Plans: [
    { 'Node Type': 'Sort', 'Actual Rows': 1, 'Actual Loops': 1, 'Shared Hit Blocks': 3, 'Shared Read Blocks': 1, Plans: [
      { 'Node Type': 'Seq Scan', 'Actual Rows': 23, 'Actual Loops': 1, 'Shared Hit Blocks': 0, 'Shared Read Blocks': 1 }] }] },
  Planning: { 'Shared Hit Blocks': 82, 'Shared Read Blocks': 1 } };
  t.check('Limit > Sort > Seq Scan: 1 returned, 23 scanned, root buffers', JSON.stringify(summarizePlan(limitSort)) === JSON.stringify({ rowsReturned: 1, rowsScanned: 23, indexUse: false, bufferHits: 3, bufferReads: 1, planningBufferHits: 82, planningBufferReads: 1 }), JSON.stringify(summarizePlan(limitSort)));
  const loops = { Plan: { 'Node Type': 'Nested Loop', 'Actual Rows': 4, 'Actual Loops': 1, Plans: [{ 'Node Type': 'Index Scan', 'Actual Rows': 2, 'Actual Loops': 2, 'Rows Removed by Filter': 1 }] } };
  t.check('per-loop rows times loops; index scan seen', summarizePlan(loops).rowsScanned === 6 && summarizePlan(loops).indexUse === true);
  const indexed = t.write('indexed.json', JSON.stringify([loops]));
  t.exit('an index scan passes --require-index', t.run('database/pg-plan.mjs', ['--plan', indexed, '--require-index']), 0);
  const seq = t.write('seq.json', JSON.stringify([limitSort]));
  const red = t.exit('planted sequential scan goes red under --require-index', t.run('database/pg-plan.mjs', ['--plan', seq, '--require-index']), 1);
  t.check('the verdict says no scan uses an index', /no scan uses an index/.test(red.stdout), red.stdout.trim());
  t.exit('23 rows scanned is red under --max-rows-scanned 10', t.run('database/pg-plan.mjs', ['--plan', seq, '--max-rows-scanned', '10']), 1);
  t.exit('a file that is not a plan exits 2', t.run('database/pg-plan.mjs', ['--plan', t.write('x.json', '{"a":1}')]), 2);
});
