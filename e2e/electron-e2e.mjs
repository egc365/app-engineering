import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

// Run inside the target app's own node_modules, with Playwright installed and Electron available.
// Example: node /wiki/tools/app-engineering/integrations/electron-e2e.mjs ./e2e-actions.json ./artifacts
const [, , configPath, outDir] = process.argv;
if (!configPath || !outDir) throw new Error('Usage: node electron-e2e.mjs config.json outdir');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
// Resolve Playwright from the target project's config, not from this portable kit.
const electron = createRequire(resolve(configPath))('playwright')._electron;
if (!config.executablePath || !Array.isArray(config.steps) || !config.steps.length) {
  throw new Error('Executable and nonempty, app-specific steps required');
}
mkdirSync(outDir, { recursive: true });
let app;
const errors = [];
const observations = [];
try {
  app = await electron.launch({ executablePath: config.executablePath,
    args: config.args || [], env: { ...process.env, ...(config.env || {}) } });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push({ type: 'pageerror', text: String(error) }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', text: message.text() }); });
  page.on('requestfailed', request => errors.push({ type: 'requestfailed', url: request.url(), reason: request.failure() }));
  for (let index = 0; index < config.steps.length; index++) {
    const step = config.steps[index];
    const started = performance.now();
    if (!step.selector || !['click', 'fill', 'visible', 'text'].includes(step.action)) {
      throw new Error(`Unsupported/incomplete step ${index}`);
    }
    const element = page.locator(step.selector);
    if (step.action === 'click') await element.click();
    if (step.action === 'fill') await element.fill(step.value);
    if (step.action === 'visible') await element.waitFor({ state: 'visible' });
    if (step.action === 'text') {
      const actual = await element.textContent();
      if (!actual?.includes(step.value)) throw new Error(`Text mismatch in ${step.selector}: ${actual}`);
    }
    const screenshot = join(outDir, `${String(index + 1).padStart(2, '0')}-${step.action}.png`);
    await page.screenshot({ path: screenshot });
    observations.push({ step, screenshot, duration_ms: performance.now() - started });
  }
  if (errors.length) throw new Error(`${errors.length} browser errors`);
  writeFileSync(join(outDir, 'result.json'), JSON.stringify({ result: 'PASS', observations, errors }, null, 2));
  console.log('PASS');
} catch (error) {
  writeFileSync(join(outDir, 'result.json'), JSON.stringify({ result: 'FAIL', observations, errors, error: String(error) }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  if (app) await app.close();
}
