// SQLite plan and timing for one SELECT (TOOLCHAIN item 11), on a read-only
// connection: the planner's EXPLAIN QUERY PLAN rows, the row count, the
// duration and the database size. Ported from the App Builder Kit
// (integrations/sqlite-explain.py, Sol, 2026-09-24) onto node:sqlite.
// Only for apps that still use SQLite (Workspace is PostgreSQL only, D78).
// --require-index is the gate: a plan step that scans a whole table goes red.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function explain(file, query) {
  if (!/^\s*SELECT\s/i.test(query) || query.trim().replace(/;$/, '').includes(';')) throw new Error('only a single SELECT query is accepted');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    db.exec('PRAGMA query_only = 1');
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all().map((r) => r.detail);
    const t0 = process.hrtime.bigint();
    const rows = db.prepare(query).all().length;
    const durationMs = Number(process.hrtime.bigint() - t0) / 1e6;
    return { query, plan, rows, duration_ms: durationMs, database_bytes: fs.statSync(file).size, full_scans: plan.filter((d) => /^SCAN \S+$/.test(d.trim())) };
  } finally {
    db.close();
  }
}

// CLI: node database/sqlite-explain.mjs --db <file> --query 'SELECT ...' [--require-index] [--json]
import { isMain, parseFlags, usage } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['db', 'query'], bools: ['require-index', 'json'] });
  if (!f.db || !f.query) usage('sqlite-explain: give --db and --query');
  if (!fs.existsSync(f.db)) usage(`no database ${f.db}`);
  let r;
  try { r = explain(f.db, f.query); } catch (e) { usage(`sqlite-explain: ${e.message}`); }
  const pass = !f['require-index'] || r.full_scans.length === 0;
  if (f.json) process.stdout.write(JSON.stringify({ ...r, pass }, null, 2) + '\n');
  else {
    for (const d of r.plan) process.stdout.write(`plan ${d}\n`);
    process.stdout.write(`${f['require-index'] ? (pass ? 'PASS' : 'FAIL') : 'MEASURED'} ${r.rows} rows in ${r.duration_ms.toFixed(3)} ms; ${r.full_scans.length} full table scans\n`);
  }
  process.exit(pass ? 0 : 1);
}
