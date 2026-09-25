// Moved from /apps/workspace/tools/fitness/lib/scan.mjs (2026-09-24): the file walk
// shared by the secret scanner and the dead-export detector. One implementation.
import fs from 'node:fs';
import path from 'node:path';

export function walk(root, { skip = new Set(), exts = null, out = [] } = {}) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (skip.has(e.name)) continue;
    const full = path.join(root, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(full, { skip, exts, out });
    else if (e.isFile() && (!exts || exts.has(path.extname(e.name)))) out.push(full);
  }
  return out;
}

// Map of relative path -> text for every matching file under `root`.
export function readTree(root, opts) {
  const map = new Map();
  for (const file of walk(root, opts)) {
    map.set(path.relative(root, file).split(path.sep).join('/'), fs.readFileSync(file, 'utf8'));
  }
  return map;
}


// Python fnmatch semantics on a repo-relative path: `*` matches any run of
// characters including `/`, `?` one character, `[...]` a class (`[!...]`
// negated). The change rules and architecture rules use it.
export function fnmatch(name, pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const j = pattern.indexOf(']', i + 2);
      if (j < 0) { re += '\\['; continue; }
      let body = pattern.slice(i + 1, j).replace(/\\/g, '\\\\');
      if (body[0] === '!') body = `^${body.slice(1)}`;
      re += `[${body}]`;
      i = j;
    } else re += c.replace(/[.+^${}()|\\/]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 's').test(name);
}
