// Architecture rules: a forbidden pattern in a set of files, e.g. "no new Pool(
// outside the one pool owner". Ported from the App Builder Kit
// (appbuild/gates.py architecture(), Sol, 2026-09-24). A regex over source is
// one piece of evidence, not proof that one authority exists; module-graph rules
// are architecture.dependency-rules.
//
// Rule: {id, files: [fnmatch patterns on repo-relative paths], forbid_regex,
// require_match}. require_match: a rule whose patterns match no file is red,
// so a moved directory cannot silently disarm it.
import fs from 'node:fs';
import path from 'node:path';
import { walk, fnmatch } from '../lib/files.mjs';

const SKIP = new Set(['.git', 'node_modules', '.scratch', '.ae', '.appbuild']);

export function checkRules(root, rules, { skip = SKIP } = {}) {
  const files = walk(root, { skip }).map((f) => path.relative(root, f).split(path.sep).join('/'));
  const problems = [];
  for (const rule of rules) {
    const matched = files.filter((rel) => rule.files.some((g) => fnmatch(rel, g)));
    if (rule.require_match && !matched.length) problems.push(`${rule.id}: no matching files`);
    const re = new RegExp(rule.forbid_regex, 'gm');
    for (const rel of matched) {
      let text;
      try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
      for (const m of text.matchAll(re)) problems.push(`${rule.id}: ${rel}:${text.slice(0, m.index).split('\n').length}`);
    }
  }
  return problems;
}

// CLI: node architecture/rules.mjs --root <repo> (--adapter <app-engineering.json> | --rules <file.json>) [--json]
// Exit 0 no violation, 1 a violation or a rule matching nothing, 3 no rules
// configured (BLOCKED, never green).
import { isMain, parseFlags, usage } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['root', 'adapter', 'rules'], bools: ['json'] });
  if (!f.root || (!f.adapter && !f.rules)) usage('rules: give --root and --adapter or --rules');
  let rules;
  try {
    const doc = JSON.parse(fs.readFileSync(f.adapter || f.rules, 'utf8'));
    rules = f.adapter ? doc.architectureRules || [] : Array.isArray(doc) ? doc : doc.rules || [];
  } catch (e) { usage(`rules: ${e.message}`); }
  if (!rules.length) {
    process.stdout.write(f.json ? `${JSON.stringify({ status: 'BLOCKED', rules: 0, problems: ['architecture rules unconfigured'] })}\n` : 'BLOCKED architecture rules unconfigured\n');
    process.exit(3);
  }
  const problems = checkRules(path.resolve(f.root), rules);
  const status = problems.length ? 'FAIL' : 'PASS';
  if (f.json) process.stdout.write(`${JSON.stringify({ status, rules: rules.length, problems })}\n`);
  else {
    for (const p of problems) process.stdout.write(`violation ${p}\n`);
    process.stdout.write(`${status} ${rules.length} architecture rules, ${problems.length} violations\n`);
  }
  process.exit(problems.length ? 1 : 0);
}
