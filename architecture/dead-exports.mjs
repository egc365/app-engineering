// Moved from /apps/workspace/tools/fitness/lib/scan.mjs (2026-09-24). Dead-export
// detector over file text. One implementation; Workspace re-exports it.
import path from 'node:path';
import { readTree } from '../lib/files.mjs';

// Exported names per file: ESM `export function|const|let|class|async function X`,
// `export { a, b as c }`, and CommonJS `module.exports = { a, b }`. Default exports
// are not names and are skipped.
export function exportedNames(text) {
  const names = new Set();
  let m;
  const decl = /^\s*export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  while ((m = decl.exec(text))) names.add(m[1]);
  const list = /^\s*export\s*\{([^}]*)\}/gm;
  while ((m = list.exec(text))) {
    for (const part of m[1].split(',')) {
      const as = part.trim().split(/\s+as\s+/);
      const name = (as[1] || as[0]).trim();
      if (name && name !== 'default') names.add(name);
    }
  }
  const cjs = /module\.exports\s*=\s*\{([^}]*)\}/g;
  while ((m = cjs.exec(text))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s*:\s*/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

// Exports of files under `sourcePrefixes` that no other file in `tree` mentions
// by name (as a word). A crude but stable measure: re-exports, dynamic property
// access and names used only in strings count as used, so the figure is a floor.
// Returns [{file, name}] sorted.
export function deadExports(tree, { sourcePrefixes = [''], ignoreNames = new Set() } = {}) {
  const dead = [];
  for (const [file, text] of tree) {
    if (!sourcePrefixes.some((p) => file.startsWith(p))) continue;
    for (const name of exportedNames(text)) {
      if (ignoreNames.has(name)) continue;
      const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`);
      let used = false;
      for (const [other, otherText] of tree) {
        if (other === file) continue;
        if (re.test(otherText)) { used = true; break; }
      }
      if (!used) dead.push({ file, name });
    }
  }
  return dead.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
}

// Map "<dir>/<rel>" -> text of every JS source under each of `dirs` below `root`.
const EXTS = new Set(['.js', '.mjs', '.cjs']);
export function sourceTree({ root, dirs, skip = ['node_modules', '.git'] }) {
  const tree = new Map();
  for (const dir of dirs) {
    for (const [rel, text] of readTree(path.join(root, dir), { skip: new Set(skip), exts: EXTS })) tree.set(`${dir}/${rel}`, text);
  }
  return tree;
}

// CLI: node architecture/dead-exports.mjs --root <repo> (--dir <rel> ... | --config <json> --key <k>)
//        [--source-prefix <rel/> ...] [--ignore <name> ...] [--skip <name> ...] [--ceiling N] [--json]
// Counts exported names no other file mentions. The ceiling is a ratchet
// (default 0): more dead exports than the ceiling exits 1. --config reads
// {roots, skip, sourcePrefixes, ignoreNames}; flags override it.
import { isMain, parseFlags, num, usage, configSection } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['root', 'ceiling', 'config', 'key'], multi: ['dir', 'source-prefix', 'ignore', 'skip'], bools: ['json'] });
  const cfg = configSection(f.config, f.key);
  const dirs = f.dir.length ? f.dir : cfg.roots || [];
  if (!f.root || !dirs.length) usage('dead-exports: give --root and at least one --dir (or --config with roots)');
  const tree = sourceTree({ root: f.root, dirs, skip: f.skip.length ? f.skip : cfg.skip || undefined });
  const prefixes = f['source-prefix'].length ? f['source-prefix'] : cfg.sourcePrefixes || [''];
  const ignore = new Set(f.ignore.length ? f.ignore : cfg.ignoreNames || []);
  const dead = deadExports(tree, { sourcePrefixes: prefixes, ignoreNames: ignore });
  const ceiling = f.ceiling !== undefined ? num(f.ceiling, 'ceiling') : 0;
  const pass = dead.length <= ceiling;
  if (f.json) process.stdout.write(JSON.stringify({ files: tree.size, dead, ceiling, pass }) + '\n');
  else {
    for (const x of dead) process.stdout.write(`dead ${x.file}:${x.name}\n`);
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${dead.length} dead exports over ${tree.size} files (ceiling ${ceiling})\n`);
  }
  process.exit(pass ? 0 : 1);
}
