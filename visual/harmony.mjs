// Colour harmonies on the HSV wheel, each swatch with its WCAG contrast against
// the real background. Ported from the App Builder Kit (appbuild/color.py, Sol,
// 2026-09-24); the contrast is visual/contrast.mjs (one contrast implementation).
// A harmony is hue geometry: it says nothing about legibility or balance, so
// every swatch carries its ratio and the AA verdicts (4.5:1 normal text, 3:1
// large text, WCAG 2.2 SC 1.4.3).
import { contrastRatio, parseHexColor } from './contrast.mjs';

export const OFFSETS = {
  complementary: [0, 180], analogous: [-30, 0, 30], triadic: [0, 120, 240],
  'split-complementary': [0, 150, 210], tetradic: [0, 60, 180, 240], monochromatic: [0],
};

// Python colorsys.rgb_to_hsv / hsv_to_rgb, channels 0..1.
export function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return [0, 0, max];
  const d = max - min;
  const s = d / max;
  const rc = (max - r) / d;
  const gc = (max - g) / d;
  const bc = (max - b) / d;
  let h;
  if (r === max) h = bc - gc;
  else if (g === max) h = 2 + rc - bc;
  else h = 4 + gc - rc;
  return [(((h / 6) % 1) + 1) % 1, s, max];
}

export function hsvToRgb(h, s, v) {
  if (s === 0) return [v, v, v];
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
}

const toHex = (rgb) => `#${rgb.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

function channels(code) {
  if (!/^#[0-9a-f]{6}$/i.test(code)) throw new Error(`expected #RRGGBB, got ${code}`);
  return parseHexColor(code).map((c) => c / 255);
}

export function harmony(code, mode) {
  if (!OFFSETS[mode]) throw new Error(`mode must be one of ${Object.keys(OFFSETS).join(', ')}`);
  const [h, s, v] = rgbToHsv(...channels(code));
  if (mode === 'monochromatic') return [[0.65, 0.65], [1, 1], [0.85, 1.2]].map(([fs, fv]) => toHex(hsvToRgb(h, s * fs, Math.max(0.1, Math.min(1, v * fv)))));
  return OFFSETS[mode].map((o) => toHex(hsvToRgb((((h * 360 + o) % 360) + 360) % 360 / 360, s, v)));
}

export function palette(code, mode, background = '#FFFFFF') {
  channels(background);
  return {
    base: code.toUpperCase(), mode, background: background.toUpperCase(),
    swatches: harmony(code, mode).map((hex) => {
      const ratio = contrastRatio(hex, background);
      return { hex, contrast: Math.round(ratio * 1000) / 1000, normal_text_AA: ratio >= 4.5, large_text_AA: ratio >= 3 };
    }),
  };
}

// CLI: node visual/harmony.mjs --base '#RRGGBB' [--mode triadic] [--background '#FFFFFF'] [--require-aa]
// Prints the palette JSON. --require-aa is the gate: a swatch under 4.5:1 on the
// background exits 1. A malformed colour or mode exits 2.
import { isMain, parseFlags, usage } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['base', 'mode', 'background'], bools: ['require-aa'] });
  if (!f.base) usage('harmony: give --base #RRGGBB');
  let p;
  try { p = palette(f.base, f.mode || 'complementary', f.background || '#FFFFFF'); } catch (e) { usage(`harmony: ${e.message}`); }
  process.stdout.write(JSON.stringify(p, null, 2) + '\n');
  const low = p.swatches.filter((s) => !s.normal_text_AA);
  if (f['require-aa']) process.stdout.write(`${low.length ? 'FAIL' : 'PASS'} ${p.swatches.length - low.length} of ${p.swatches.length} swatches reach 4.5:1 on ${p.background}${low.length ? `; below: ${low.map((s) => `${s.hex} ${s.contrast}:1`).join(', ')}` : ''}\n`);
  process.exit(f['require-aa'] && low.length ? 1 : 0);
}
