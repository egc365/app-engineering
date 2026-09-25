// The app adapter: `app-engineering.json` at an app's repo root tells the toolkit
// how to drive that app. The toolkit holds no app knowledge; everything app-
// specific (launch, display, ports, ready probes, test database, gate matrix,
// acceptance flows, per-tool arguments, app-implemented tools) comes from here.
//
// Placeholders in any string value:
//   {repo}          the repo root
//   {toolkit}       this toolkit's root
//   {route:a.b.c}   a value read from the app's routes file (adapter.routes), so
//                   ports, display and host are never repeated in the adapter
import fs from 'node:fs';
import path from 'node:path';

export const ADAPTER_FILE = 'app-engineering.json';
export const ADAPTER_SCHEMA = 'app-engineering.adapter/1';
const PROBE_KINDS = new Set(['cdp-target', 'cdp-eval', 'http']);

export function adapterPath(repo) {
  return path.join(path.resolve(repo), ADAPTER_FILE);
}

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

// Expands placeholders in every string of `value` (deeply). Unknown route keys
// throw: a probe aimed at an undefined port must never run.
export function expand(value, ctx) {
  if (typeof value === 'string') {
    return value.replace(/\{(repo|toolkit|route:[\w.-]+)\}/g, (_, key) => {
      if (key === 'repo') return ctx.repo;
      if (key === 'toolkit') return ctx.toolkit;
      const v = dig(ctx.routes, key.slice(6));
      if (v === undefined || v === null || typeof v === 'object') throw new Error(`adapter: routes file has no scalar at ${key.slice(6)}`);
      return String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => expand(v, ctx));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v, ctx)]));
  return value;
}

export function validateAdapter(a) {
  const problems = [];
  if (!a || typeof a !== 'object') return ['adapter is not a JSON object'];
  if (a.schema !== ADAPTER_SCHEMA) problems.push(`schema must be "${ADAPTER_SCHEMA}"`);
  if (typeof a.app !== 'string' || !a.app) problems.push('app: a name is required');
  if (a.launch) {
    if (!Array.isArray(a.launch.command) || !a.launch.command.length) problems.push('launch.command: an argv array is required');
    for (const k of ['display', 'cdpPort']) if (a.launch[k] === undefined) problems.push(`launch.${k} is required`);
    if (a.launch.display !== undefined && !/^:\d+$|\{route:/.test(String(a.launch.display))) problems.push('launch.display must be an X display like ":99"');
  }
  const ids = new Set();
  for (const [i, p] of (a.readyProbes || []).entries()) {
    const where = `readyProbes[${i}]`;
    if (!p.id) problems.push(`${where}: id is required`);
    if (ids.has(p.id)) problems.push(`${where}: duplicate id ${p.id}`);
    ids.add(p.id);
    if (!PROBE_KINDS.has(p.kind)) problems.push(`${where}: kind must be one of ${[...PROBE_KINDS].join(', ')}`);
    if (p.kind === 'cdp-target' && !p.pathSuffix && !p.urlIncludes) problems.push(`${where}: cdp-target needs pathSuffix or urlIncludes`);
    if (p.kind === 'cdp-eval' && (!p.expression || (!p.target && !p.urlIncludes))) problems.push(`${where}: cdp-eval needs expression and target (a cdp-target probe id) or urlIncludes`);
    if (p.kind === 'cdp-eval' && p.target && !ids.has(p.target)) problems.push(`${where}: target ${p.target} is not an earlier probe`);
    if (p.kind === 'http' && !p.url) problems.push(`${where}: http needs url`);
  }
  for (const [id, t] of Object.entries(a.tools || {})) {
    if (t.command !== undefined && (!Array.isArray(t.command) || !t.command.length)) problems.push(`tools.${id}.command must be an argv array`);
    if (t.args !== undefined && !Array.isArray(t.args)) problems.push(`tools.${id}.args must be an array`);
    if (t.needsApp !== undefined && typeof t.needsApp !== 'boolean') problems.push(`tools.${id}.needsApp must be true or false`);
    if (t.needsApp && !a.launch) problems.push(`tools.${id}.needsApp: the adapter has no launch`);
    if (t.timeoutS !== undefined && !(Number(t.timeoutS) > 0)) problems.push(`tools.${id}.timeoutS must be a positive number`);
  }
  // Change gates (gates/gates.mjs): path rules, the gate bindings, the
  // architecture rules, where receipts go, and the declared ports.
  for (const [i, r] of (a.changeRules || []).entries()) {
    if (!r.id || !Array.isArray(r.patterns) || !r.patterns.length || !Array.isArray(r.classes) || !r.classes.length) problems.push(`changeRules[${i}]: id, patterns and classes (non-empty arrays) are required`);
  }
  if (a.changeRules !== undefined && !Array.isArray(a.changeRules)) problems.push('changeRules must be an array');
  if (a.fallbackClasses !== undefined && !Array.isArray(a.fallbackClasses)) problems.push('fallbackClasses must be an array');
  for (const [g, ids] of Object.entries(a.gates || {})) {
    if (!Array.isArray(ids)) problems.push(`gates.${g} must be an array of tool ids`);
  }
  for (const [i, r] of (a.architectureRules || []).entries()) {
    if (!r.id || !Array.isArray(r.files) || !r.files.length || typeof r.forbid_regex !== 'string') problems.push(`architectureRules[${i}]: id, files and forbid_regex are required`);
    else { try { new RegExp(r.forbid_regex, 'm'); } catch (e) { problems.push(`architectureRules[${i}].forbid_regex: ${e.message}`); } }
  }
  if (a.evidenceDir !== undefined && (typeof a.evidenceDir !== 'string' || path.isAbsolute(a.evidenceDir) || a.evidenceDir.split(/[\\/]/).includes('..'))) problems.push('evidenceDir must be a path inside the repo');
  for (const [i, p] of (a.ports || []).entries()) {
    if (!Number.isInteger(p.port)) problems.push(`ports[${i}].port must be an integer`);
  }
  for (const [i, f] of (a.acceptanceFlows || []).entries()) {
    if (!f.id) problems.push(`acceptanceFlows[${i}]: id is required`);
    if (!f.status && !Array.isArray(f.command)) problems.push(`acceptanceFlows[${i}]: command (argv) or status is required`);
  }
  return problems;
}

// {file, adapter, routes, ctx, problems}; adapter is null when absent/unreadable.
export function loadAdapter(repo, toolkit) {
  const file = adapterPath(repo);
  let adapter = null;
  const problems = [];
  try { adapter = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    return { file, adapter: null, routes: null, ctx: null, problems: [`${file}: ${e.code === 'ENOENT' ? 'no adapter file' : e.message}`] };
  }
  problems.push(...validateAdapter(adapter));
  let routes = {};
  if (adapter.routes) {
    try { routes = JSON.parse(fs.readFileSync(path.join(path.resolve(repo), adapter.routes), 'utf8')); } catch (e) { problems.push(`routes ${adapter.routes}: ${e.message}`); }
  }
  const ctx = { repo: path.resolve(repo), toolkit, routes };
  return { file, adapter, routes, ctx, problems };
}
