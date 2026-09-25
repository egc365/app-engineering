// Moved from /apps/workspace/tools/measure/pg-profile.mjs (card B2-T6, 2026-09-24):
// the summary of one PostgreSQL EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) plan. One
// implementation; Workspace's profiler imports it.
//
// Buffer counts come from the root: PostgreSQL reports a node's buffers
// including its children's. Rows scanned are the scan nodes' rows (returned
// plus removed by filter, per loop, times loops); the root's rows are returned.
function nodes(plan) {
  return [plan, ...(plan.Plans || []).flatMap(nodes)];
}

export function summarizePlan({ Plan: root, Planning: planning = {} }) {
  const scans = nodes(root).filter((n) => / Scan$/.test(n['Node Type']));
  const perLoop = (n) => (n['Actual Rows'] || 0) + (n['Rows Removed by Filter'] || 0);
  return {
    rowsReturned: root['Actual Rows'],
    rowsScanned: scans.reduce((sum, n) => sum + perLoop(n) * (n['Actual Loops'] || 1), 0),
    indexUse: scans.some((n) => /Index/.test(n['Node Type'])),
    bufferHits: root['Shared Hit Blocks'] || 0,
    bufferReads: root['Shared Read Blocks'] || 0,
    planningBufferHits: planning['Shared Hit Blocks'] || 0,
    planningBufferReads: planning['Shared Read Blocks'] || 0,
  };
}

// CLI: node database/pg-plan.mjs --plan <explain.json> [--require-index] [--max-rows-scanned N] [--json]
// The file holds the EXPLAIN (FORMAT JSON) output: the array PostgreSQL returns
// or its first element. The gates: --require-index (some scan uses an index)
// and --max-rows-scanned; either red exits 1.
import fs from 'node:fs';
import { isMain, parseFlags, num, usage } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['plan', 'max-rows-scanned'], bools: ['require-index', 'json'] });
  if (!f.plan) usage('pg-plan: give --plan <explain.json>');
  let plan;
  try { const doc = JSON.parse(fs.readFileSync(f.plan, 'utf8')); plan = Array.isArray(doc) ? doc[0] : doc; } catch (e) { usage(`--plan ${f.plan}: ${e.message}`); }
  if (!plan || !plan.Plan) usage('pg-plan: not an EXPLAIN (FORMAT JSON) plan');
  const s = summarizePlan(plan);
  const problems = [];
  if (f['require-index'] && !s.indexUse) problems.push('no scan uses an index');
  if (f['max-rows-scanned'] !== undefined && s.rowsScanned > num(f['max-rows-scanned'], 'max-rows-scanned')) problems.push(`${s.rowsScanned} rows scanned, over ${f['max-rows-scanned']}`);
  const gated = f['require-index'] || f['max-rows-scanned'] !== undefined;
  if (f.json) process.stdout.write(JSON.stringify({ ...s, problems }) + '\n');
  else process.stdout.write(`${gated ? (problems.length ? 'FAIL' : 'PASS') : 'MEASURED'} ${s.rowsReturned} rows returned, ${s.rowsScanned} scanned, index ${s.indexUse ? 'used' : 'not used'}, buffers ${s.bufferHits} hit / ${s.bufferReads} read${problems.length ? `; ${problems.join('; ')}` : ''}\n`);
  process.exit(problems.length ? 1 : 0);
}
