// Moved from /apps/workspace/tools/fitness/lib/compare.mjs (2026-09-24); this file is
// the one implementation. Workspace re-exports it as tools/fitness/lib/compare.mjs.
// Threshold kinds and the verdict for one check. Pure; no I/O.
//
// A check declares `threshold: {kind, ...}`; `evaluate` turns a measured value
// and the recorded baseline entry into {pass, bound, reason}. Kinds:
//   max        value <= threshold.value
//   min        value >= threshold.value
//   zero       value === 0
//   ratchet    value <= baseline.value (and <= threshold.value when given); no
//              baseline: value <= threshold.value, or pass when none is given
//   ratchetMin value >= baseline.value - threshold.tolerance (default 0);
//              no baseline: value >= threshold.value when given
//   spread     value <= upperBound(baseline.runs, {k, floorAbs, floorPct})
//              (see stats.mjs)
// A kind that needs a baseline (ratchet without a fixed value, ratchetMin, spread)
// fails when the baseline has no entry for the check, unless `recording` is set:
// the run then passes with reason "recording" and --record writes the entry.
// A value that is not a finite number never passes.
import { upperBound } from './stats.mjs';

const KINDS = new Set(['max', 'min', 'zero', 'ratchet', 'ratchetMin', 'spread']);

export function validThreshold(threshold) {
  return !!threshold && typeof threshold === 'object' && KINDS.has(threshold.kind);
}

function noBaseline(recording) {
  return recording ? verdict(true, null, 'recording') : verdict(false, null, 'no baseline for this check: run --record');
}

const KIND = {
  max: (t, value) => verdict(value <= t.value, t.value, `<= ${t.value}`),
  min: (t, value) => verdict(value >= t.value, t.value, `>= ${t.value}`),
  zero: (t, value) => verdict(value === 0, 0, '== 0'),
  ratchet(t, value, base, recording) {
    const bounds = [];
    if (base && typeof base.value === 'number') bounds.push(base.value);
    if (typeof t.value === 'number') bounds.push(t.value);
    if (!bounds.length) return noBaseline(recording);
    const bound = Math.min(...bounds);
    return verdict(value <= bound, bound, `<= ${bound} (ratchet)`);
  },
  ratchetMin(t, value, base, recording) {
    const tol = typeof t.tolerance === 'number' ? t.tolerance : 0;
    if (base && typeof base.value === 'number') {
      const bound = base.value - tol;
      return verdict(value >= bound, bound, `>= ${round(bound)} (baseline ${base.value} - ${tol})`);
    }
    if (typeof t.value === 'number') return verdict(value >= t.value, t.value, `>= ${t.value}`);
    return noBaseline(recording);
  },
  spread(t, value, base, recording) {
    const runs = base && Array.isArray(base.runs) ? base.runs : null;
    if (!runs || !runs.length) return noBaseline(recording);
    const bound = upperBound(runs, { k: t.k, floorAbs: t.floorAbs, floorPct: t.floorPct });
    return verdict(value <= bound, bound, `<= ${round(bound)} (median ${round(medianOf(runs))} + spread margin)`);
  },
};

export function evaluate(threshold, value, baseline, { recording = false } = {}) {
  if (!validThreshold(threshold)) return { pass: false, bound: null, reason: 'unknown threshold kind' };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { pass: false, bound: null, reason: 'value is not a number' };
  const base = baseline && typeof baseline === 'object' ? baseline : null;
  return KIND[threshold.kind](threshold, value, base, recording);
}

function medianOf(runs) {
  const v = [...runs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function round(x) {
  return typeof x === 'number' ? Math.round(x * 1000) / 1000 : x;
}

function verdict(pass, bound, reason) {
  return { pass, bound, reason };
}

// True when a ratchet's value sits below its baseline: the bar can come down.
export function canTighten(threshold, value, baseline) {
  if (!baseline || typeof baseline.value !== 'number' || typeof value !== 'number') return false;
  if (threshold.kind === 'ratchet') return value < baseline.value;
  if (threshold.kind === 'ratchetMin') return value > baseline.value;
  return false;
}

// The baseline entry to record for a check after a run. Spread thresholds keep
// the runs; the others keep the value.
export function baselineEntry(threshold, result) {
  const entry = { value: result.value };
  if (threshold.kind === 'spread' && Array.isArray(result.runs)) entry.runs = result.runs;
  return entry;
}

// CLI, a fail-closed threshold gate:
//   node bench/threshold.mjs --threshold '{"kind":"spread","k":3,"floorPct":0.05}'
//        --value 530 [--baseline <file.json> [--key <id>]] [--recording] [--json]
// The baseline file is a JSON object; with --key it is read at that key (the
// fitness ledger shape {checks: {<id>: {value, runs}}} is read at checks.<id>).
// A kind that needs a baseline fails when there is none. Exit 0 PASS, 1 FAIL, 2 usage.
import fs from 'node:fs';
import { isMain, parseFlags, num, usage } from '../lib/cli.mjs';

function readBaselineEntry(file, key) {
  if (!file) return null;
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  if (!key) return doc;
  if (doc && doc.checks && doc.checks[key]) return doc.checks[key];
  return doc ? doc[key] || null : null;
}

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['threshold', 'value', 'baseline', 'key'], bools: ['recording', 'json'] });
  let threshold;
  try { threshold = JSON.parse(f.threshold || ''); } catch { usage('--threshold takes a JSON object with a kind'); }
  if (!validThreshold(threshold)) usage(`unknown threshold kind; kinds: ${[...KINDS].join(', ')}`);
  const value = num(f.value, 'value');
  const base = readBaselineEntry(f.baseline, f.key);
  const v = evaluate(threshold, value, base, { recording: !!f.recording });
  if (f.json) process.stdout.write(JSON.stringify({ value, ...v }) + '\n');
  else process.stdout.write(`${v.pass ? 'PASS' : 'FAIL'} value ${value} ${v.reason}\n`);
  process.exit(v.pass ? 0 : 1);
}
