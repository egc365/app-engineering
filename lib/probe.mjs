// Live adapter check: launch the app with the adapter's launch command and wait
// for each ready probe in order, reporting PASS/FAIL per probe with the elapsed
// milliseconds from launch. This validates the adapter (its launch command,
// display, CDP port and probe expressions are real); it is not a benchmark: one
// run, no statistics. Benchmarks are bench.* and timing.*.
//
// The launch command runs in its own process group with DISPLAY set to the
// adapter's display, so the app never reaches another display. Teardown sends
// SIGTERM to the group (the launcher is expected to quit the app cleanly), then
// SIGKILL after `killAfterMs`.
import { spawn } from 'node:child_process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets(host, port) {
  const res = await fetch(`http://${host}:${port}/json`, { signal: AbortSignal.timeout(2000) });
  return res.json();
}

// Targets that existed before the launch belong to some other app on the port;
// they never satisfy a probe (the guard for adapters with no ready line).
const stale = new Set();

function matches(t, p) {
  if (t.type !== 'page' || stale.has(t.id)) return false;
  const url = String(t.url || '');
  if (p.pathSuffix) return url.split('#', 1)[0].split('?', 1)[0].endsWith(p.pathSuffix);
  return url.includes(p.urlIncludes);
}

async function evaluate(wsUrl, expression, timeoutMs = 5000) {
  const ws = new WebSocket(wsUrl);
  try {
    await new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('cdp handshake timeout')), timeoutMs);
      ws.onopen = () => { clearTimeout(timer); res(); };
      ws.onerror = () => { clearTimeout(timer); rej(new Error('cdp websocket failed')); };
    });
    const answer = await new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('cdp evaluate timeout')), timeoutMs);
      ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id === 1) { clearTimeout(timer); res(m); } };
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    });
    return answer.result && answer.result.result ? answer.result.result.value : undefined;
  } finally {
    try { ws.close(); } catch { /* closed */ }
  }
}

async function until(fn, timeoutMs, pollMs = 50) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  for (;;) {
    try { const v = await fn(); if (v) return { ok: true }; } catch (e) { last = e.message; }
    if (Date.now() > deadline) return { ok: false, last };
    await sleep(pollMs);
  }
}

async function oneProbe(p, found, { host, cdpPort, timeoutMs }) {
  if (p.kind === 'http') return until(async () => (await fetch(p.url, { signal: AbortSignal.timeout(2000) })).ok, timeoutMs);
  if (p.kind === 'cdp-target') {
    return until(async () => {
      const t = (await targets(host, cdpPort)).find((x) => matches(x, p));
      if (t) found.set(p.id, t);
      return !!t;
    }, timeoutMs);
  }
  // cdp-eval: on a named earlier target, or the first page whose URL matches.
  if (p.before) {
    const chrome = found.get(p.beforeTarget || p.target);
    if (chrome) await evaluate(chrome.webSocketDebuggerUrl, p.before).catch(() => {});
  }
  return until(async () => {
    const t = p.target ? found.get(p.target) : (await targets(host, cdpPort)).find((x) => matches(x, p));
    if (!t) return false;
    return (await evaluate(t.webSocketDebuggerUrl, p.expression)) === true;
  }, timeoutMs);
}

// Launches the app and waits for the ready line and every ready probe, in order.
// Returns {results, ready, stop(), finish()}: while ready, the app is up and a
// tool can run against it; stop() tears the launcher's process group down;
// finish() stops and returns the verdict. adapter must already be expanded.
export async function startApp(adapter, { repo, timeoutMs = 60000, killAfterMs = 15000, log = () => {} } = {}) {
  const { launch, readyProbes = [] } = adapter;
  const host = launch.host || '127.0.0.1';
  const env = { ...process.env, DISPLAY: String(launch.display), ...(launch.env || {}) };
  stale.clear();
  try { for (const t of await targets(host, launch.cdpPort)) stale.add(t.id); } catch { /* nothing listening: the usual case */ }
  if (stale.size) log(`note: ${stale.size} DevTools targets already on port ${launch.cdpPort} before launch; they are ignored`);
  let t0 = performance.now();
  const child = spawn(launch.command[0], launch.command.slice(1), { cwd: repo, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  const exited = new Promise((r) => child.once('exit', (code, signal) => r({ code, signal })));
  const results = [];
  const found = new Map();
  const app = { results, ready: false, stop, finish };
  try {
    // A launcher that waits for a machine-wide lock prints its ready line only
    // once the app is really spawned; probing before that would read whatever
    // else holds the CDP port (another run's app). Wait for it first.
    if (launch.readyLine === 'stdout-json') {
      const lineMs = launch.readyLineMs || 1800000;
      const ok = await Promise.race([
        (async () => { const deadline = Date.now() + lineMs; while (Date.now() < deadline) { if (/^\{.*"launched":\s*true/m.test(out)) return true; await sleep(50); } return false; })(),
        exited.then(() => false),
      ]);
      const waited = Math.round(performance.now() - t0);
      if (!ok) {
        results.push({ id: 'launch', kind: 'ready-line', ok: false, ms: waited, detail: `no ready line: ${err.trim().split('\n').slice(-1)[0] || 'timed out'}` });
        log(`FAIL launcher printed no ready line after ${waited} ms`);
        return app;
      }
      log(`launcher ready line after ${waited} ms (includes any lock wait): ${out.trim().split('\n')[0]}`);
      t0 = performance.now();
    }
    for (const p of readyProbes) {
      const r = await Promise.race([
        oneProbe(p, found, { host, cdpPort: launch.cdpPort, timeoutMs: p.timeoutMs || timeoutMs }),
        exited.then((e) => ({ ok: false, last: `launcher exited (code ${e.code}, signal ${e.signal}) ${err.trim().split('\n').slice(-1)[0] || ''}` })),
      ]);
      results.push({ id: p.id, kind: p.kind, ok: r.ok, ms: Math.round(performance.now() - t0), detail: r.ok ? '' : r.last || 'timed out' });
      log(`${r.ok ? 'PASS' : 'FAIL'} probe ${p.id} (${p.kind}) at ${Math.round(performance.now() - t0)} ms${r.ok ? '' : `: ${r.last || 'timed out'}`}`);
      if (!r.ok) break;
    }
  } catch (e) {
    await stop();
    throw e;
  }
  app.ready = results.length === readyProbes.length && results.every((r) => r.ok);
  if (!app.ready) await stop();
  return app;

  async function stop() {
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
      const done = await Promise.race([exited, sleep(killAfterMs).then(() => null)]);
      if (!done) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } await exited; }
    }
  }

  async function finish() {
    await stop();
    const exit = await exited;
    const probes = results.filter((r) => r.kind !== 'ready-line');
    return { results, pass: probes.length === readyProbes.length && results.every((r) => r.ok), launcherExit: exit, launcherStdout: out.trim().split('\n').slice(0, 3) };
  }
}

// Live adapter check: launch, probe, tear down, verdict.
export async function liveCheck(adapter, opts = {}) {
  const app = await startApp(adapter, opts);
  return app.finish();
}
