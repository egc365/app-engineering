// Moved from /apps/workspace/tools/fitness/lib/scan.mjs (2026-09-24). Secret leak
// detector: counts occurrences of secret values in a tree without ever printing
// them. One implementation; Workspace re-exports it.
import fs from 'node:fs';
import path from 'node:path';
import { readTree } from '../lib/files.mjs';

// Occurrences of any of `needles` in a Map of path -> text. Returns
// [{file, count}] without the matching text, so a secret never leaves here.
export function findNeedles(tree, needles) {
  const hits = [];
  const wanted = needles.filter((n) => typeof n === 'string' && n.length > 0);
  for (const [file, text] of tree) {
    let count = 0;
    for (const n of wanted) count += text.split(n).length - 1;
    if (count) hits.push({ file, count });
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file));
}


// The forms a secret takes on disk: raw and URL-encoded (a connection string).
export function secretForms(secret) {
  if (typeof secret !== 'string' || !secret) return [];
  const enc = encodeURIComponent(secret);
  return enc === secret ? [secret] : [secret, enc];
}

// CLI: node logs/secret-scan.mjs --root <dir> [--root <dir> ...]
//        (--needle-env <VAR> | --needle-file <file>) [--skip <name> ...] [--exclude-basename <name> ...] [--json]
// The secret is read from an environment variable or the first line of a file,
// never from argv (argv is visible in /proc). Output names files and counts only.
// Exit 0 clean, 1 a secret was found, 2 usage.
import { isMain, parseFlags, usage } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['needle-env', 'needle-file'], multi: ['root', 'skip', 'exclude-basename'], bools: ['json'] });
  if (!f.root.length) usage('secret-scan: give --root');
  let secret = null;
  if (f['needle-env']) secret = process.env[f['needle-env']] || null;
  else if (f['needle-file']) { try { secret = fs.readFileSync(f['needle-file'], 'utf8').split('\n')[0].trim(); } catch { secret = null; } }
  else usage('secret-scan: give --needle-env or --needle-file');
  if (!secret) usage('secret-scan: the secret is empty or unreadable; refusing to report clean');
  const needles = secretForms(secret);
  const skip = new Set(['node_modules', '.git', ...f.skip]);
  const excluded = new Set(f['exclude-basename']);
  const hits = [];
  for (const root of f.root) {
    const tree = readTree(root, { skip });
    for (const name of [...tree.keys()]) if (excluded.has(path.basename(name))) tree.delete(name);
    for (const h of findNeedles(tree, needles)) hits.push({ root, ...h });
  }
  if (f.json) process.stdout.write(JSON.stringify({ roots: f.root, files: hits.length, hits }) + '\n');
  else {
    for (const h of hits) process.stdout.write(`LEAK ${path.join(h.root, h.file)} (${h.count})\n`);
    process.stdout.write(`${hits.length ? 'FAIL' : 'PASS'} ${hits.length} files carry the secret across ${f.root.length} roots\n`);
  }
  process.exit(hits.length ? 1 : 0);
}
