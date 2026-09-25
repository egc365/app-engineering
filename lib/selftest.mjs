// Self-test harness. A detector's self-test runs the tool's real command on a
// clean fixture (must pass, exit 0) and on the same fixture with a planted defect
// (must go red, exit 1): a detector that cannot go red measures nothing. A
// library's self-test checks known answers. Fixtures live in
// <toolkit>/.scratch/selftest-<id>-<pid> and are removed afterwards.
// Output: one line per step, then exactly "PASS <id>" or "FAIL <id>"; exit 0/1.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOOLKIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tail(r) {
  return `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-2).join(' | ');
}

export async function selftest(id, body) {
  const dir = path.join(TOOLKIT, '.scratch', `selftest-${id}-${process.pid}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const steps = [];
  const t = {
    dir,
    // Write a fixture file (parents created); returns its absolute path.
    write(rel, text) {
      const file = path.join(dir, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
      return file;
    },
    // Run a toolkit file as the manifest's command does.
    run(rel, args = [], { env = {}, input, timeout = 60000, cwd } = {}) {
      return spawnSync(process.execPath, [path.join(TOOLKIT, rel), ...args], { encoding: 'utf8', env: { ...process.env, ...env }, input, timeout, cwd });
    },
    exit(label, r, want) {
      const ok = r.status === want;
      steps.push({ label, ok, detail: `exit ${r.status}, want ${want}${ok ? '' : `: ${tail(r)}`}` });
      return r;
    },
    check(label, ok, detail = '') {
      steps.push({ label, ok: !!ok, detail });
    },
  };
  try {
    await body(t);
  } catch (e) {
    steps.push({ label: 'self-test threw', ok: false, detail: e && e.message ? e.message : String(e) });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  for (const s of steps) process.stdout.write(`  ${s.ok ? 'ok ' : 'BAD'} ${s.label}${s.detail ? `: ${s.detail}` : ''}\n`);
  const pass = steps.length > 0 && steps.every((s) => s.ok);
  process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${id}\n`);
  process.exit(pass ? 0 : 1);
}
