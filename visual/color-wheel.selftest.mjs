// The colour wheel page (visual/color-wheel.html, Sol's App Builder Kit) is one
// self-contained file, so its colour math is inline. This proves that inline
// math agrees with the engines (visual/contrast.mjs, visual/harmony.mjs): the
// contrast of several pairs and the swatches of every harmony mode. A planted
// drift in the page's luminance goes red, so the page cannot quietly become a
// second, different contrast implementation.
import fs from 'node:fs';
import vm from 'node:vm';
import { selftest, TOOLKIT } from '../lib/selftest.mjs';
import { contrastRatio } from './contrast.mjs';
import { harmony, OFFSETS } from './harmony.mjs';

const NAMES = ['offsets', 'clamp', 'hsv', 'rgbHex', 'fromHex', 'luminance', 'contrast'];
const PAIRS = [['#000000', '#FFFFFF'], ['#3569A4', '#FFFFFF'], ['#767676', '#0C0C0C'], ['#E6E6E6', '#121212']];
const BASES = ['#3569A4', '#1F3A5F', '#C0392B'];

function pageMath(html) {
  const lines = html.split('\n').filter((l) => NAMES.some((n) => l.startsWith(`function ${n}(`) || l.startsWith(`const ${n}=`)));
  const sandbox = {};
  vm.runInNewContext(`${lines.join('\n')}\nthis.m={offsets,hsv,rgbHex,fromHex,contrast};`, sandbox);
  return sandbox.m;
}

// Disagreements between the page and the engines; [] when they agree.
function disagreements(html) {
  const m = pageMath(html);
  const out = [];
  for (const [a, b] of PAIRS) if (Math.abs(m.contrast(a, b) - contrastRatio(a, b)) > 1e-9) out.push(`contrast ${a} on ${b}: page ${m.contrast(a, b)} vs ${contrastRatio(a, b)}`);
  if (JSON.stringify(m.offsets) !== JSON.stringify(OFFSETS)) out.push('harmony offsets differ');
  for (const base of BASES) {
    const [hue, sat, val] = m.fromHex(base);
    for (const mode of Object.keys(OFFSETS).filter((x) => x !== 'monochromatic')) {
      const page = m.offsets[mode].map((o) => m.rgbHex(m.hsv((hue + o + 360) % 360, sat, val)));
      if (JSON.stringify(page) !== JSON.stringify(harmony(base, mode))) out.push(`${mode} of ${base}: page ${page} vs ${harmony(base, mode)}`);
    }
  }
  return out;
}

await selftest('visual.color-wheel', (t) => {
  const html = fs.readFileSync(`${TOOLKIT}/visual/color-wheel.html`, 'utf8');
  t.check('the page is one self-contained file (no external script or stylesheet)', !/<script[^>]+src=|<link[^>]+stylesheet/i.test(html));
  const clean = disagreements(html);
  t.check('page contrast and harmonies agree with the engines', clean.length === 0, clean.slice(0, 3).join(' | '));
  const drift = disagreements(html.replace('.2126*c[0]', '.2226*c[0]'));
  t.check('a planted luminance drift in the page goes red', drift.length > 0, `${drift.length} disagreements`);
  const hueDrift = disagreements(html.replace('triadic:[0,120,240]', 'triadic:[0,110,240]'));
  t.check('a planted offset drift in the page goes red', hueDrift.length > 0, `${hueDrift.length} disagreements`);
});
