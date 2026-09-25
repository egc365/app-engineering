// Small helpers shared by the tool CLIs. Every tool file is a library first; its
// CLI runs only when the file is the program (isMain), so an app imports the
// same functions the command runs.
//
// Exit codes, the same for every tool: 0 pass (or measured), 1 the gate or
// detector found a defect, 2 usage or could not measure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function isMain(importMetaUrl) {
  return !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(importMetaUrl);
}

// --flag value | --flag=value | --bool. Repeated flags collect into arrays when
// named in `multi`. Unknown flags are a usage error.
export function parseFlags(argv, { flags = [], bools = [], multi = [] } = {}) {
  const known = new Set([...flags, ...bools, ...multi]);
  const out = { _: [] };
  for (const m of multi) out[m] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
    if (!known.has(name)) usage(`unknown flag --${name}`);
    if (bools.includes(name)) { out[name] = true; continue; }
    const value = eq > 0 ? a.slice(eq + 1) : argv[++i];
    if (value === undefined) usage(`--${name} needs a value`);
    if (multi.includes(name)) out[name].push(value);
    else out[name] = value;
  }
  return out;
}

export function usage(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

export function num(value, name) {
  const n = Number(value);
  if (value === undefined || !Number.isFinite(n)) usage(`--${name} needs a number`);
  return n;
}

// Prints a verdict line and exits: PASS -> 0, FAIL -> 1.
export function verdict(pass, line, json) {
  if (json) process.stdout.write(JSON.stringify(json, null, 2) + '\n');
  else process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${line}\n`);
  process.exit(pass ? 0 : 1);
}

// An object read from a JSON file, optionally at a dotted key: lets an app keep
// one configuration (e.g. its fitness config) that both its checks and these
// CLIs read, instead of repeating values in the adapter.
export function configSection(file, key) {
  if (!file) return {};
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { usage(`--config ${file}: ${e.message}`); }
  const section = key ? key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), doc) : doc;
  if (!section || typeof section !== 'object') usage(`--config ${file} has no object at ${key}`);
  return section;
}
