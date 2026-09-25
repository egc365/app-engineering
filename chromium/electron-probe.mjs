import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Call after app.whenReady(). Trace only a bounded diagnostic run. */
export async function startElectronProbe({ app, contentTracing, window, outDir, intervalMs = 1000 }) {
  mkdirSync(outDir, { recursive: true });
  const events = join(outDir, 'electron.jsonl');
  const emit = (kind, fields = {}) => appendFileSync(events, JSON.stringify({
    ts: new Date().toISOString(), kind, ...fields,
  }) + '\n');
  const wc = window.webContents;
  wc.on('render-process-gone', (_, details) => emit('renderer_crash', details));
  wc.on('did-fail-load', (_, code, description, url) => emit('navigation_failure', { code, description, url }));
  wc.on('dom-ready', () => emit('dom_ready'));
  wc.on('did-finish-load', () => emit('navigation_finish'));
  let debuggerAttached = false;
  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
      debuggerAttached = true;
      await wc.debugger.sendCommand('Performance.enable');
    } else emit('cdp_unavailable', { reason: 'debugger already attached' });
  } catch (error) { emit('cdp_unavailable', { reason: String(error) }); }
  let tracing = false;
  try {
    await contentTracing.startRecording({ included_categories: ['devtools.timeline', 'blink', 'v8', 'loading'] });
    tracing = true;
  } catch (error) { emit('trace_unavailable', { reason: String(error) }); }
  const timer = setInterval(async () => {
    try {
      emit('process_metrics', { metrics: app.getAppMetrics() });
      if (debuggerAttached && !wc.isDestroyed()) {
        emit('renderer_metrics', { metrics: await wc.debugger.sendCommand('Performance.getMetrics') });
      }
    } catch (error) { emit('sample_error', { reason: String(error) }); }
  }, intervalMs);
  timer.unref();
  return {
    async stop() {
      clearInterval(timer);
      if (debuggerAttached && !wc.isDestroyed()) {
        try { wc.debugger.detach(); } catch (error) { emit('detach_error', { reason: String(error) }); }
      }
      let tracePath = null;
      if (tracing) {
        try { tracePath = await contentTracing.stopRecording(join(outDir, 'chromium-trace.json')); }
        catch (error) { emit('trace_stop_error', { reason: String(error) }); }
      }
      emit('probe_complete', { tracePath, electron: process.versions.electron,
        chromium: process.versions.chrome, node: process.versions.node });
      return { tracePath, events };
    },
  };
}
