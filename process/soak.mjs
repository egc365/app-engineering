// Soak runner: repeat one app operation N times, sample after each cycle, and
// judge growth after the warm-up cycles. Moved from
// /apps/workspace/tools/fitness/lib/soak-run.mjs (2026-09-24): the least-squares
// slope and the cycle loop live here; the app supplies `cycle` (the operation,
// e.g. open and close one tab) and `sample` (what to read, e.g. tree PSS and live
// handle counts). One implementation; Workspace's soak-run.mjs calls it.
//
// A leak shows as a positive slope of a sampled figure over judged cycles, or as
// growth (last minus first judged sample) of a count that should return to its
// starting value.

// Least-squares slope of y over x = 0..n-1.
export function slope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  return den ? num / den : 0;
}

const round3 = (x) => Math.round(x * 1000) / 1000;

// Per numeric key of the judged samples: slope (rounded to 0.001) and growth.
export function summarizeSoak(samples, warmupCycles = 0) {
  const after = samples.slice(warmupCycles);
  if (!after.length) throw new Error(`soak: ${samples.length} samples, ${warmupCycles} warm-up: nothing to judge`);
  const first = after[0];
  const last = after[after.length - 1];
  const keys = Object.keys(first).filter((k) => k !== 'cycle' && typeof first[k] === 'number');
  const slopes = {};
  const growth = {};
  for (const k of keys) {
    slopes[k] = round3(slope(after.map((s) => s[k])));
    growth[k] = last[k] - first[k];
  }
  return { samples, cycles: after.length, slope: slopes, growth };
}

// Runs `cycles` iterations: await cycle(i), wait settleMs, then sample(i) (an
// object of numbers). Returns summarizeSoak over the samples.
export async function runSoak({ cycles, warmupCycles = 0, cycle, sample, settleMs = 0, log = () => {} }) {
  if (!(cycles > warmupCycles)) throw new Error(`soak: cycles (${cycles}) must exceed warm-up (${warmupCycles})`);
  const samples = [];
  log(`soak: ${cycles} cycles (${warmupCycles} warm-up)`);
  for (let i = 0; i < cycles; i += 1) {
    await cycle(i);
    if (settleMs) await new Promise((r) => setTimeout(r, settleMs));
    samples.push({ cycle: i + 1, ...(await sample(i)) });
  }
  return summarizeSoak(samples, warmupCycles);
}

// Verdict over a summary: every `maxSlope` / `maxGrowth` bound, per key.
export function judgeSoak(summary, { maxSlope = {}, maxGrowth = {} } = {}) {
  const findings = [];
  for (const [k, bound] of Object.entries(maxSlope)) {
    const v = summary.slope[k];
    if (typeof v !== 'number') findings.push(`${k}: not sampled`);
    else if (v > bound) findings.push(`${k} slope ${v}/cycle > ${bound}`);
  }
  for (const [k, bound] of Object.entries(maxGrowth)) {
    const v = summary.growth[k];
    if (typeof v !== 'number') findings.push(`${k}: not sampled`);
    else if (v > bound) findings.push(`${k} grew ${v} > ${bound}`);
  }
  return { pass: findings.length === 0, findings };
}

// CLI, judging a recorded series (the samples array of a soak, as JSON):
//   node process/soak.mjs --samples <file.json> [--warmup N]
//        [--max-slope key=bound ...] [--max-growth key=bound ...] [--json]
// Exit 0 within bounds, 1 a bound exceeded (a leak), 2 usage.
import fs from 'node:fs';
import { isMain, parseFlags, usage } from '../lib/cli.mjs';

function bounds(list, flag) {
  const out = {};
  for (const item of list) {
    const m = /^([\w.-]+)=(-?[\d.]+)$/.exec(item);
    if (!m) usage(`--${flag} takes key=number, got ${JSON.stringify(item)}`);
    out[m[1]] = Number(m[2]);
  }
  return out;
}

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['samples', 'warmup'], multi: ['max-slope', 'max-growth'], bools: ['json'] });
  if (!f.samples) usage('soak: give --samples <file.json>');
  let samples;
  try { samples = JSON.parse(fs.readFileSync(f.samples, 'utf8')); } catch (e) { usage(`soak: ${e.message}`); }
  if (samples && Array.isArray(samples.samples)) samples = samples.samples;
  if (!Array.isArray(samples) || !samples.length) usage('soak: the file holds no samples array');
  const summary = summarizeSoak(samples, f.warmup !== undefined ? Number(f.warmup) : 0);
  const v = judgeSoak(summary, { maxSlope: bounds(f['max-slope'], 'max-slope'), maxGrowth: bounds(f['max-growth'], 'max-growth') });
  if (f.json) process.stdout.write(JSON.stringify({ ...summary, samples: undefined, ...v }) + '\n');
  else {
    for (const x of v.findings) process.stdout.write(`leak ${x}\n`);
    process.stdout.write(`${v.pass ? 'PASS' : 'FAIL'} ${summary.cycles} judged cycles; slope ${JSON.stringify(summary.slope)}; growth ${JSON.stringify(summary.growth)}\n`);
  }
  process.exit(v.pass ? 0 : 1);
}
