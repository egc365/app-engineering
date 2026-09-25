// Change gates: which gates a set of changed files requires, the tools the app
// binds to each gate, a receipt per gate and per build, and verification of a
// build receipt. Ported from the App Builder Kit (appbuild/gates.py, Sol,
// 2026-09-24) onto this toolkit's manifest and adapter.
//
//   changed paths --adapter changeRules--> change classes
//                 --manifest change_classes--> required gates
//                 --adapter gates--> tool ids --> run each tool
//
// A gate with no tool bound, a bound tool that is pending, or an app tool with
// no command is BLOCKED, never green: a build passes only when every required
// gate ran and passed. Patterns match like Python's fnmatch: `*` crosses `/`.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { expand } from '../lib/adapter.mjs';
import { fnmatch } from '../lib/files.mjs';
import { newRun, verifyReceipt, outputSha256, gitInfo } from '../lib/receipt.mjs';

const OUTPUT_TAIL = 100000;
const TIMEOUT_S = { seconds: 300, minutes: 1800, long: 3600 };

// {classes, gates, matched: [{rule, files}], uncovered}
export function classify(paths, { rules, fallbackClasses, changeClasses }) {
  const classes = new Set();
  const matched = [];
  for (const rule of rules) {
    const files = paths.filter((p) => rule.patterns.some((pat) => fnmatch(p, pat)));
    if (!files.length) continue;
    rule.classes.forEach((c) => classes.add(c));
    matched.push({ rule: rule.id, files });
  }
  const covered = new Set(matched.flatMap((m) => m.files));
  const uncovered = [...new Set(paths)].filter((p) => !covered.has(p)).sort();
  if (uncovered.length) fallbackClasses.forEach((c) => classes.add(c));
  const gates = new Set();
  for (const c of classes) {
    if (!changeClasses[c]) throw new Error(`change rule names unknown class ${c}`);
    changeClasses[c].gates.forEach((g) => gates.add(g));
  }
  return { classes: [...classes].sort(), gates: [...gates].sort(), matched, uncovered };
}

export function changedPaths(repo, base) {
  const r = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMRD', base, 'HEAD'], { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`invalid base reference ${base}: ${r.stderr.trim()}`);
  return r.stdout.split('\n').filter(Boolean);
}

// The rules, fallback and classes in force for an app: its adapter's, else the
// manifest's defaults.
export function ruleSet(manifest, adapter) {
  return {
    rules: adapter.changeRules || manifest.default_change_rules,
    fallbackClasses: adapter.fallbackClasses || manifest.default_fallback_classes,
    changeClasses: manifest.change_classes,
  };
}

// How one tool runs against one app: {argv, cwd, timeoutMs, needsApp} or
// {blocked: reason}.
export function resolveTool(tool, a, toolkit, extra = []) {
  if (tool.cli) return { blocked: `${tool.id} is not bindable: it runs as \`${tool.cli}\`` };
  const cfg = (a.adapter.tools || {})[tool.id] || {};
  const timeoutMs = 1000 * (cfg.timeoutS || TIMEOUT_S[tool.runtime] || 300);
  const base = { cwd: a.ctx.repo, timeoutMs, needsApp: !!cfg.needsApp };
  if (tool.status === 'available') return { ...base, argv: [process.execPath, path.join(toolkit, tool.path), ...expand(cfg.args || [], a.ctx), ...extra] };
  if (tool.status === 'adapter') {
    if (!Array.isArray(cfg.command) || !cfg.command.length) return { blocked: `the app binds no command to ${tool.id}` };
    return { ...base, argv: [...expand(cfg.command, a.ctx), ...extra] };
  }
  return { blocked: `${tool.id} is ${tool.status}${tool.card ? ` (card ${tool.card})` : ''}` };
}

// Runs argv, streaming its output to `echo` (a writable or null), keeping the
// tail. Resolves {exitCode, signal, stdout, stderr, timedOut, ms}.
export function execTool(argv, { cwd, env, timeoutMs, echo = null }) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    } catch (e) {
      resolve({ exitCode: null, signal: null, stdout: '', stderr: e.message, timedOut: false, ms: 0, spawnError: e.message });
      return;
    }
    const keep = (s, d) => (s + d).slice(-OUTPUT_TAIL);
    child.stdout.on('data', (d) => { stdout = keep(stdout, d); if (echo) echo.write(d); });
    child.stderr.on('data', (d) => { stderr = keep(stderr, d); if (echo) echo.write(d); });
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, timeoutMs);
    child.once('error', (e) => { clearTimeout(timer); resolve({ exitCode: null, signal: null, stdout, stderr: `${stderr}${e.message}`, timedOut, ms: Date.now() - t0, spawnError: e.message }); });
    child.once('close', (code, signal) => { clearTimeout(timer); resolve({ exitCode: code, signal, stdout, stderr, timedOut, ms: Date.now() - t0 }); });
  });
}

// PASS 0, FAIL 1 (and 2: could not measure), BLOCKED 3 (pending or not provided).
export const statusOfExit = (code) => (code === 0 ? 'PASS' : code === 3 ? 'BLOCKED' : 'FAIL');

// One tool, one run: resolves, launches the app first when the binding says it
// needs it, runs, and returns the outcome record a receipt holds.
export async function runTool(tool, a, { toolkit, env, extra = [], echo = null, startApp = null, log = () => {} }) {
  const how = resolveTool(tool, a, toolkit, extra);
  if (how.blocked) return { tool: tool.id, status: 'BLOCKED', reason: how.blocked, argv: null };
  let app = null;
  if (how.needsApp) {
    if (!startApp) return { tool: tool.id, status: 'BLOCKED', reason: 'needs the running app and no launcher was given', argv: how.argv };
    app = await startApp();
    if (!app.ready) {
      const v = await app.finish();
      return { tool: tool.id, status: 'FAIL', reason: `the app did not become ready: ${JSON.stringify(v.results.filter((r) => !r.ok))}`, argv: how.argv };
    }
    log(`app ready for ${tool.id}`);
  }
  let r;
  try {
    r = await execTool(how.argv, { cwd: how.cwd, env, timeoutMs: how.timeoutMs, echo });
  } finally {
    if (app) await app.finish();
  }
  const output = { stdout: r.stdout, stderr: r.stderr };
  const status = r.spawnError ? 'BLOCKED' : r.timedOut ? 'FAIL' : statusOfExit(r.exitCode);
  const reason = r.spawnError ? `could not start: ${r.spawnError}` : r.timedOut ? `timed out after ${how.timeoutMs} ms` : undefined;
  return { tool: tool.id, status, exit_code: r.exitCode, signal: r.signal, argv: how.argv, duration_s: Math.round(r.ms) / 1000, output, output_sha256: outputSha256(output), ...(reason ? { reason } : {}) };
}

function gateStatus(outcomes) {
  if (!outcomes.length) return 'BLOCKED';
  if (outcomes.some((o) => o.status === 'FAIL')) return 'FAIL';
  if (outcomes.some((o) => o.status === 'BLOCKED')) return 'BLOCKED';
  return 'PASS';
}

// Runs every required gate; one receipt per gate and one build receipt.
// plan: resolve bindings and write nothing, run nothing.
export async function runGates(paths, { manifest, a, toolkit, env, echo = null, startApp = null, plan = false, log = () => {} }) {
  if (!paths.length) throw new Error('no changed files: give --changed or --base');
  const set = ruleSet(manifest, a.adapter);
  const c = classify(paths, set);
  const bindings = a.adapter.gates || {};
  const runsDir = path.join(a.ctx.repo, a.adapter.evidenceDir || '.ae', 'runs');
  const byId = new Map(manifest.tools.map((t) => [t.id, t]));
  const cache = new Map();
  const outcomes = [];
  for (const gate of c.gates) {
    const ids = bindings[gate] || [];
    const tools = [];
    for (const id of ids) {
      const tool = byId.get(id);
      if (!tool) { tools.push({ tool: id, status: 'BLOCKED', reason: 'not a manifest tool' }); continue; }
      if (plan) { const how = resolveTool(tool, a, toolkit); tools.push(how.blocked ? { tool: id, status: 'BLOCKED', reason: how.blocked } : { tool: id, status: 'WOULD RUN', argv: how.argv, needsApp: how.needsApp }); continue; }
      if (!cache.has(id)) { log(`gate ${gate}: running ${id}`); cache.set(id, await runTool(tool, a, { toolkit, env, echo, startApp, log })); }
      tools.push(cache.get(id));
    }
    const suggest = (manifest.gates[gate] || {}).tools || [];
    const status = plan ? (ids.length && tools.every((t) => t.status === 'WOULD RUN') ? 'WOULD RUN' : 'BLOCKED') : gateStatus(tools);
    const data = { gate, status, tools, ...(ids.length ? {} : { reason: `the app binds no tool to gate ${gate} (manifest suggests ${suggest.join(', ') || 'none'})` }) };
    if (plan) { outcomes.push(data); continue; }
    const { file, receipt } = newRun(a.ctx.repo, runsDir, 'gate', data, a.file);
    outcomes.push({ gate, status, run_id: receipt.run_id, receipt: path.relative(a.ctx.repo, file) });
    log(`gate ${gate}: ${status} (${receipt.run_id})`);
  }
  const result = outcomes.every((o) => o.status === 'PASS') ? 'PASS' : plan ? 'PLAN' : 'FAIL';
  const data = { changed: paths, matched: c.matched, uncovered: c.uncovered, classes: c.classes, required: c.gates, outcomes, result };
  if (plan) return { receipt: null, data };
  const { file, receipt } = newRun(a.ctx.repo, runsDir, 'build', data, a.file);
  return { receipt: file, run_id: receipt.run_id, data };
}

// Problems with a build receipt against the repo, adapter and rules as they are
// now: [] means it holds.
export function verifyBuild(file, { manifest, a, allowDirty = false }) {
  const repo = a.ctx.repo;
  const { problems, record } = verifyReceipt(file, repo, a.file);
  if (record.kind !== 'build') problems.push('not a build receipt');
  if (!allowDirty) {
    if (record.environment && record.environment.git && record.environment.git.dirty !== false) problems.push('the build ran on a dirty tree');
    if (gitInfo(repo).dirty !== false) problems.push('the repository is dirty now');
  }
  const d = record.data || {};
  const expected = classify(d.changed || [], ruleSet(manifest, a.adapter)).gates;
  const required = [...(d.required || [])].sort();
  if (JSON.stringify(required) !== JSON.stringify(expected)) problems.push(`required gates ${required.join(',')} differ from the current rules (${expected.join(',')})`);
  const found = new Set();
  for (const o of d.outcomes || []) {
    const ref = path.join(repo, o.receipt || '');
    if (!o.receipt || !fs.existsSync(ref)) { problems.push(`${o.gate}: missing receipt ${o.receipt}`); continue; }
    const g = verifyReceipt(ref, repo, a.file);
    problems.push(...g.problems.map((p) => `${o.gate}: ${p}`));
    const gd = g.record.data || {};
    if (g.record.run_id !== o.run_id || gd.gate !== o.gate) problems.push(`${o.gate}: receipt identity mismatch`);
    if (gd.status !== 'PASS') problems.push(`${o.gate}: gate did not pass (${gd.status})`);
    for (const t of gd.tools || []) {
      if (t.output && outputSha256(t.output) !== t.output_sha256) problems.push(`${o.gate}: ${t.tool}: captured output hash mismatch`);
    }
    found.add(o.gate);
  }
  const missing = required.filter((g) => !found.has(g));
  if (missing.length) problems.push(`missing required gates: ${missing.join(', ')}`);
  if (d.result !== 'PASS') problems.push(`build result was ${d.result}`);
  return problems;
}
