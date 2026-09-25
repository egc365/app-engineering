// Paired command benchmark: a baseline and a candidate command, each run as a
// fresh process, warmups first, then N measured trials in alternating order (to
// spread gradual drift across both), raw samples kept in trial order, judged by
// bench.compare. Ported from the App Builder Kit (appbuild/bench.py bench_pair,
// Sol, 2026-09-24). This is the generic engine; an app's own workloads (launch,
// Board ready, station switch) are commands it hands to --baseline/--candidate.
import { spawnSync } from 'node:child_process';
import { compare, MIN_SAMPLES } from './compare.mjs';

export function measure(argv, { cwd, timeoutMs }) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'ignore', 'pipe'] });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (r.error || r.status !== 0) throw new Error(`benchmark command failed (${r.error ? r.error.message : `exit ${r.status}`}): ${argv.join(' ')} ${String(r.stderr || '').slice(-2000)}`);
  return Math.round(ms * 1e5) / 1e5;
}

export function benchPair(baseArgv, candArgv, { cwd = process.cwd(), warmups = 4, runs = 25, timeoutMs = 30000, thresholdMs = 5 } = {}) {
  if (runs < MIN_SAMPLES) throw new Error(`at least ${MIN_SAMPLES} measured runs are required for a decision`);
  if (warmups < 1) throw new Error('at least one warmup is required');
  const o = { cwd, timeoutMs };
  for (let i = 0; i < warmups; i += 1) { measure(baseArgv, o); measure(candArgv, o); }
  const a = [];
  const b = [];
  for (let i = 0; i < runs; i += 1) {
    if (i % 2) { b.push(measure(candArgv, o)); a.push(measure(baseArgv, o)); }
    else { a.push(measure(baseArgv, o)); b.push(measure(candArgv, o)); }
  }
  return { baseline_argv: baseArgv, candidate_argv: candArgv, warmups, runs, workload: 'new process per trial; alternating order; unpaired bootstrap', raw_baseline_ms: a, raw_candidate_ms: b, comparison: compare(a, b, { thresholdMs }) };
}

// CLI: node bench/pair.mjs --baseline '<json argv>' --candidate '<json argv>'
//      [--runs 25] [--warmups 4] [--timeout-s 30] [--threshold-ms 5] [--cwd <dir>]
//      [--ledger <file.jsonl>] [--json]
// First line PASS, FAIL or INCONCLUSIVE; exit 1 on FAIL, 2 when a command fails.
// --ledger appends one row (commit, environment, verdict) to an append-only
// regression ledger (TOOLCHAIN item 24).
import path from 'node:path';
import { isMain, parseFlags, num, usage } from '../lib/cli.mjs';
import { appendLedger, environment } from '../lib/receipt.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['baseline', 'candidate', 'runs', 'warmups', 'timeout-s', 'threshold-ms', 'cwd', 'ledger'], bools: ['json'] });
  const argvOf = (text, name) => {
    let v;
    try { v = JSON.parse(text); } catch { usage(`--${name} must be a JSON argv array`); }
    if (!Array.isArray(v) || !v.length || v.some((x) => typeof x !== 'string')) usage(`--${name} must be a non-empty JSON array of strings`);
    return v;
  };
  if (!f.baseline || !f.candidate) usage('pair: give --baseline and --candidate as JSON argv arrays');
  const cwd = path.resolve(f.cwd || '.');
  let r;
  try {
    r = benchPair(argvOf(f.baseline, 'baseline'), argvOf(f.candidate, 'candidate'), {
      cwd, runs: f.runs !== undefined ? num(f.runs, 'runs') : 25, warmups: f.warmups !== undefined ? num(f.warmups, 'warmups') : 4,
      timeoutMs: 1000 * (f['timeout-s'] !== undefined ? num(f['timeout-s'], 'timeout-s') : 30), thresholdMs: f['threshold-ms'] !== undefined ? num(f['threshold-ms'], 'threshold-ms') : 5,
    });
  } catch (e) { usage(`pair: ${e.message}`); }
  if (f.ledger) appendLedger(path.resolve(f.ledger), { created_at: new Date().toISOString(), kind: 'bench.pair', environment: environment(cwd), baseline_argv: r.baseline_argv, candidate_argv: r.candidate_argv, runs: r.runs, warmups: r.warmups, result: r.comparison.result, delta_p50_ms: r.comparison.delta_p50_ms ?? null, ci95_delta_p50_ms: r.comparison.ci95_delta_p50_ms ?? null });
  process.stdout.write(`${r.comparison.result}\n`);
  if (f.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else process.stdout.write(`${r.comparison.reason}; action ${r.comparison.action}; p50 ${r.comparison.baseline.p50.toFixed(2)} -> ${r.comparison.candidate.p50.toFixed(2)} ms over ${r.runs} trials each\n`);
  process.exit(r.comparison.result === 'FAIL' ? 1 : 0);
}
