// Automated performance gate (TOOLCHAIN item 25): baseline vs candidate
// samples -> exactly PASS, FAIL or INCONCLUSIVE. Ported from the App Builder Kit
// (appbuild/bench.py compare, Sol, 2026-09-24).
//
// Rule (a default policy, not proof of cause): at least 20 samples per side,
// else INCONCLUSIVE. With 95% percentile-bootstrap intervals of the p50 and p95
// deltas (candidate - baseline, ms): FAIL when either interval lies wholly above
// +threshold (a material regression); PASS when the p50 interval lies wholly
// below -threshold and the p95 interval does not exceed +threshold (a material
// improvement without a tail regression); otherwise INCONCLUSIVE, which keeps
// the baseline. Action: PASS adopt after correctness, FAIL revert, INCONCLUSIVE
// keep the baseline.
import { summary, deltaCI } from './stats.mjs';

export const MIN_SAMPLES = 20;
const ACTION = { PASS: 'ADOPT_CANDIDATE_AFTER_CORRECTNESS', FAIL: 'REVERT_CANDIDATE', INCONCLUSIVE: 'KEEP_BASELINE' };

export function compare(baseline, candidate, { thresholdMs = 5, resamples = 4000 } = {}) {
  const a = summary(baseline);
  const b = summary(candidate);
  if (baseline.length < MIN_SAMPLES || candidate.length < MIN_SAMPLES) {
    return { result: 'INCONCLUSIVE', reason: `at least ${MIN_SAMPLES} measured trials per side required`, action: ACTION.INCONCLUSIVE, baseline: a, candidate: b };
  }
  const ci50 = deltaCI(baseline, candidate, { q: 0.5, resamples, seed: 1147 });
  const ci95 = deltaCI(baseline, candidate, { q: 0.95, resamples, seed: 1148 });
  let result;
  let reason;
  if (ci50[0] > thresholdMs || ci95[0] > thresholdMs) { result = 'FAIL'; reason = 'regression exceeds the material threshold with a 95% bootstrap interval'; }
  else if (ci50[1] < -thresholdMs && ci95[1] <= thresholdMs) { result = 'PASS'; reason = 'median improves materially; p95 does not regress materially'; }
  else { result = 'INCONCLUSIVE'; reason = 'the evidence does not distinguish a material improvement or regression'; }
  return {
    result, reason, action: ACTION[result], baseline: a, candidate: b,
    delta_p50_ms: b.p50 - a.p50, delta_p95_ms: b.p95 - a.p95,
    ci95_delta_p50_ms: ci50, ci95_delta_p95_ms: ci95, threshold_ms: thresholdMs,
    bootstrap_method: `independent percentile bootstrap, ${resamples} resamples, mulberry32 seeds 1147/1148`,
  };
}

// CLI: node bench/compare.mjs (--samples <file.json> | --baseline <n,n,...> --candidate <n,n,...>)
//      [--threshold-ms 5] [--resamples 4000] [--json]
// samples file: {"baseline_ms": [...], "candidate_ms": [...]}. The first line is
// exactly PASS, FAIL or INCONCLUSIVE. Exit 1 on FAIL, 0 on PASS or
// INCONCLUSIVE, 2 on bad input.
import fs from 'node:fs';
import { isMain, parseFlags, num, usage } from '../lib/cli.mjs';

const numbers = (text, name) => {
  const v = String(text).split(/[\s,]+/).filter(Boolean).map(Number);
  if (!v.length || v.some((x) => !Number.isFinite(x) || x < 0)) usage(`--${name}: finite non-negative numbers required`);
  return v;
};

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['samples', 'baseline', 'candidate', 'threshold-ms', 'resamples'], bools: ['json'] });
  let base;
  let cand;
  if (f.samples) {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(f.samples, 'utf8')); } catch (e) { usage(`--samples ${f.samples}: ${e.message}`); }
    base = numbers((doc.baseline_ms || []).join(','), 'samples baseline_ms');
    cand = numbers((doc.candidate_ms || []).join(','), 'samples candidate_ms');
  } else if (f.baseline && f.candidate) {
    base = numbers(f.baseline, 'baseline');
    cand = numbers(f.candidate, 'candidate');
  } else usage('compare: give --samples or --baseline and --candidate');
  const r = compare(base, cand, { thresholdMs: f['threshold-ms'] !== undefined ? num(f['threshold-ms'], 'threshold-ms') : 5, resamples: f.resamples !== undefined ? num(f.resamples, 'resamples') : 4000 });
  process.stdout.write(`${r.result}\n`);
  if (f.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else process.stdout.write(`${r.reason}; action ${r.action}; p50 ${r.baseline.p50} -> ${r.candidate.p50} ms${r.ci95_delta_p50_ms ? `, delta CI [${r.ci95_delta_p50_ms.map((x) => x.toFixed(2)).join(', ')}]` : ''}\n`);
  process.exit(r.result === 'FAIL' ? 1 : 0);
}
