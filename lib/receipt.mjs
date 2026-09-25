// Run receipts: one JSON file per run under the app's evidence directory, bound
// to the commit, the dirty state, the machine and the adapter's sha256. Ported
// from the App Builder Kit (appbuild/core.py, Sol, 2026-09-24); same shape, so a
// receipt says what ran, where, on which commit, with which configuration.
//
// A receipt's sha256 is over its canonical JSON (keys sorted, no spaces). It
// detects an edited receipt; it is not an attestation, since anyone with write
// access can regenerate it. CI reruns the gates for an independent result.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const RECEIPT_SCHEMA = 'app-engineering.receipt/1';
const TOOLKIT_VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
export const fileSha256 = (file) => sha256(fs.readFileSync(file));

// JSON with keys sorted at every level and no whitespace.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value === undefined ? null : value);
}

function git(root, ...args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 8000 });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function gitInfo(root) {
  const status = git(root, 'status', '--porcelain=v1', '--untracked-files=all');
  return { sha: git(root, 'rev-parse', 'HEAD'), dirty: status === null ? null : status.length > 0, branch: git(root, 'branch', '--show-current'), remote: git(root, 'remote', 'get-url', 'origin') };
}

let machine = null;
function machineInfo() {
  if (machine) return machine;
  let gpu = null;
  const smi = spawnSync('nvidia-smi', ['--query-gpu=name,driver_version,memory.total', '--format=csv,noheader'], { encoding: 'utf8', timeout: 5000 });
  if (smi.status === 0) gpu = smi.stdout.trim();
  const cpus = os.cpus();
  machine = { machine: os.hostname(), os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: cpus.length ? cpus[0].model : null, logical_cpus: cpus.length, ram_bytes: os.totalmem(), gpu, node: process.version };
  return machine;
}

export function environment(root) {
  const flags = Object.fromEntries(['DISPLAY', 'WAYLAND_DISPLAY', 'CI', 'ELECTRON_RUN_AS_NODE'].filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
  return { ...machineInfo(), display_mode: process.env.DISPLAY || process.env.WAYLAND_DISPLAY ? 'desktop' : 'headless', flags, git: gitInfo(root) };
}

function runId() {
  return `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${crypto.randomBytes(5).toString('hex')}`;
}

// Writes <runsDir>/<run id>.json atomically; returns {file, receipt}.
export function newRun(root, runsDir, kind, data, configFile = null) {
  const body = { schema: RECEIPT_SCHEMA, toolkit_version: TOOLKIT_VERSION, run_id: runId(), kind, created_at: new Date().toISOString(), environment: environment(root), config_sha256: configFile ? fileSha256(configFile) : null, data };
  body.receipt_sha256 = sha256(canonical(body));
  fs.mkdirSync(runsDir, { recursive: true });
  const file = path.join(runsDir, `${body.run_id}.json`);
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2) + '\n');
  fs.renameSync(tmp, file);
  return { file, receipt: body };
}

// Problems with one receipt against the repo as it is now: [] when it holds.
export function verifyReceipt(file, root, configFile = null) {
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { receipt_sha256: claimed, ...rest } = record;
  const problems = [];
  if (claimed !== sha256(canonical(rest))) problems.push('receipt hash mismatch');
  if ((record.environment && record.environment.git && record.environment.git.sha) !== gitInfo(root).sha) problems.push('commit mismatch');
  if (configFile && record.config_sha256 !== fileSha256(configFile)) problems.push('configuration changed');
  return { problems, record };
}

// sha256 of captured output, the value a receipt stores beside the output.
export const outputSha256 = (output) => sha256(canonical(output));

// One JSON line appended to an append-only ledger (history is never rewritten).
export function appendLedger(file, row) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'a');
  try { fs.writeSync(fd, canonical(row) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
