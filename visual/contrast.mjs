// Moved from /apps/workspace/tools/fitness/lib/contrast.mjs (2026-09-24), with the
// stylesheet audit that was the accessibility.contrast check's pairsOf. One
// implementation; Workspace re-exports it.
// WCAG 2.x contrast ratio and a CSS pair extractor. Pure; no I/O.
// Relative luminance and the (L1 + 0.05) / (L2 + 0.05) ratio follow WCAG 2.2's
// definitions (secondary source: W3C Recommendation, "relative luminance" and
// "contrast ratio" glossary entries). Success criterion 1.4.3 asks 4.5:1 for text,
// 3:1 for large text; 1.4.11 asks 3:1 for user-interface components.
//
// Colours understood: #rgb, #rrggbb, #rrggbbaa, rgb(r, g, b), rgba(r, g, b, a),
// rgb(r g b / a), and var(--name[, fallback]) resolved from the `--name: value`
// declarations gathered across the stylesheets given. An alpha below 1 on the
// text colour is composited over the pair's background before the ratio; an alpha
// below 1 on the background is composited over `base` (the page colour).

export function parseHexColor(text) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(text).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (h.length === 8) rgb.push(parseInt(h.slice(6, 8), 16) / 255);
  return rgb;
}

// [r, g, b] or [r, g, b, a] from any supported colour text; null when unknown.
export function parseColor(text, vars = new Map()) {
  const t = String(text).trim();
  const v = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(t);
  if (v) {
    if (vars.has(v[1])) return parseColor(vars.get(v[1]), vars);
    return v[2] !== undefined ? parseColor(v[2], vars) : null;
  }
  const hex = parseHexColor(t);
  if (hex) return hex;
  const fn = /^rgba?\(\s*([^)]+)\)$/i.exec(t);
  if (fn) {
    const parts = fn[1].replace('/', ' ').split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (p) => (p.endsWith('%') ? Math.round(parseFloat(p) * 2.55) : Number(p));
    const rgb = parts.slice(0, 3).map(channel);
    if (rgb.some((c) => !Number.isFinite(c))) return null;
    if (parts[3] !== undefined) {
      const a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : Number(parts[3]);
      if (!Number.isFinite(a)) return null;
      rgb.push(Math.max(0, Math.min(1, a)));
    }
    return rgb;
  }
  return null;
}

// `--name: value` declarations from CSS text, later declarations winning.
export function cssVariables(cssText, into = new Map()) {
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /(--[\w-]+)\s*:\s*([^;}]+)/g;
  let m;
  while ((m = re.exec(stripped))) into.set(m[1], m[2].trim());
  return into;
}

// Source-over compositing of `top` (with alpha) on an opaque `under`.
export function composite(top, under) {
  const a = top.length > 3 ? top[3] : 1;
  if (a >= 1) return top.slice(0, 3);
  return [0, 1, 2].map((i) => Math.round(top[i] * a + under[i] * (1 - a)));
}

function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg, bg, { vars, base = [0, 0, 0] } = {}) {
  let a = Array.isArray(fg) ? fg : parseColor(fg, vars);
  let b = Array.isArray(bg) ? bg : parseColor(bg, vars);
  if (!a || !b) return null;
  b = composite(b, Array.isArray(base) ? base : (parseColor(base, vars) || [0, 0, 0]));
  a = composite(a, b);
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const COLOR_VALUE = '(#[0-9a-f]{3,8}\\b|rgba?\\([^)]*\\)|var\\([^)]*\\))';

// Every CSS rule that declares both `color` and `background`/`background-color`
// as [{selector, fg, bg, ratio}]; ratio is null when a colour is not understood
// (a var() with no definition, a named colour), and the caller counts that.
// Rules that set only one of the two inherit the other and are not judged here;
// a pairs list in the project config covers those.
export function cssColorPairs(cssText, { vars = new Map(), base } = {}) {
  const out = [];
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  const fgRe = new RegExp(`(?:^|;)\\s*color\\s*:\\s*${COLOR_VALUE}`, 'i');
  const bgRe = new RegExp(`(?:^|;)\\s*background(?:-color)?\\s*:\\s*${COLOR_VALUE}`, 'i');
  let m;
  while ((m = rule.exec(stripped))) {
    const selector = m[1].trim();
    const body = m[2];
    const fg = fgRe.exec(body);
    const bg = bgRe.exec(body);
    if (fg && bg) out.push({ selector, fg: fg[1], bg: bg[1], ratio: contrastRatio(fg[1], bg[1], { vars, base }) });
  }
  return out;
}

// Pairs whose ratio is under `minimum`, plus pairs whose colours could not be read.
export function failingPairs(pairs, minimum) {
  return pairs.filter((p) => p.ratio === null || p.ratio < minimum);
}

// The audit over a set of stylesheets: every rule pair plus the configured
// inherited `pairs` ({name, fg, bg}), with variables resolved across all sheets.
// Stylesheets a listed one @imports are followed. A listed stylesheet that is
// absent is reported in `missing`: coverage never shrinks silently.
// Returns {pairs, missing, under, worst, findings}; findings = missing + under.
import fs from 'node:fs';
import path from 'node:path';

export function auditStylesheets({ root, css, pairs: configured = [], base, minimum = 4.5 }) {
  const missing = [];
  const texts = [];
  const seen = new Set();
  const add = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) { missing.push(rel); return; }
    const text = fs.readFileSync(file, 'utf8');
    texts.push([rel, text]);
    for (const m of text.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?/g)) {
      add(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    }
  };
  for (const rel of css) add(rel);
  const vars = new Map();
  for (const [, text] of texts) cssVariables(text, vars);
  const pairs = [];
  for (const [rel, text] of texts) {
    for (const p of cssColorPairs(text, { vars, base })) pairs.push({ ...p, where: `${rel} ${p.selector}` });
  }
  for (const p of configured) pairs.push({ ...p, ratio: contrastRatio(p.fg, p.bg, { vars, base }), where: p.name });
  const under = failingPairs(pairs, minimum);
  const worst = pairs.reduce((m, p) => (p.ratio !== null && (m === null || p.ratio < m.ratio) ? p : m), null);
  return { pairs, missing, under, worst, findings: missing.length + under.length };
}

// CLI: node visual/contrast.mjs --root <dir> (--css <rel> ... | --config <json> --key <k>)
//        [--min 4.5] [--base <colour>] [--pairs <json file of [{name, fg, bg}]>] [--json]
// Exit 1 when any pair is under the minimum, any colour is unreadable, or a
// listed stylesheet is missing. --config reads {css, pairs, base, minimumText};
// flags override it.
import { isMain, parseFlags, num, usage, configSection } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['root', 'min', 'base', 'pairs', 'config', 'key'], multi: ['css'], bools: ['json'] });
  const cfg = configSection(f.config, f.key);
  const css = f.css.length ? f.css : cfg.css || [];
  if (!f.root || !css.length) usage('contrast: give --root and at least one --css (or --config with css)');
  let configured = cfg.pairs || [];
  if (f.pairs) { try { configured = JSON.parse(fs.readFileSync(f.pairs, 'utf8')); } catch (e) { usage(`contrast: --pairs unreadable: ${e.message}`); } }
  const minimum = f.min !== undefined ? num(f.min, 'min') : cfg.minimumText !== undefined ? cfg.minimumText : 4.5;
  const a = auditStylesheets({ root: f.root, css, pairs: configured, base: f.base || cfg.base, minimum });
  if (f.json) process.stdout.write(JSON.stringify({ minimum, ...a }) + '\n');
  else {
    for (const m of a.missing) process.stdout.write(`missing stylesheet ${m}\n`);
    for (const p of a.under) process.stdout.write(p.ratio === null ? `unreadable ${p.where} ${p.fg}/${p.bg}\n` : `under ${p.where} ${p.fg}/${p.bg} = ${p.ratio.toFixed(2)}:1\n`);
    process.stdout.write(`${a.findings ? 'FAIL' : 'PASS'} ${a.findings} findings over ${a.pairs.length} pairs (minimum ${minimum}:1${a.worst ? `, worst ${a.worst.ratio.toFixed(2)}:1` : ''})\n`);
  }
  process.exit(a.findings ? 1 : 0);
}
