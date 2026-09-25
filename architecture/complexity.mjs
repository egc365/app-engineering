// Moved from /apps/workspace/tools/fitness/lib/complexity.mjs (2026-09-24), with the
// directory scan that was the maintainability.complexity check's overCeiling. One
// implementation; Workspace re-exports it.
// Cyclomatic complexity per function from an ESTree AST (acorn). McCabe's
// measure (IEEE Trans. Software Eng. SE-2(4), 1976; secondary source): one plus
// the number of decision points. Counted here: if, for, for-in, for-of, while,
// do-while, each `case`, catch, conditional `?:`, and each `&&`, `||`, `??`.
// Nested functions are counted apart: the counter resets at every function
// boundary and the inner function's decisions belong to it, not its parent.
import * as acorn from 'acorn';

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const DECISION_TYPES = new Set(['IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement', 'CatchClause', 'ConditionalExpression']);
const LOGICAL = new Set(['&&', '||', '??']);

function parseSource(source, { module = true } = {}) {
  const opts = { ecmaVersion: 'latest', locations: true, allowHashBang: true, allowReturnOutsideFunction: true };
  try {
    return acorn.parse(source, { ...opts, sourceType: module ? 'module' : 'script' });
  } catch (e) {
    return acorn.parse(source, { ...opts, sourceType: module ? 'script' : 'module' });
  }
}

function nameOf(node, parent) {
  if (node.id && node.id.name) return node.id.name;
  if (parent) {
    if (parent.type === 'VariableDeclarator' && parent.id && parent.id.name) return parent.id.name;
    if ((parent.type === 'Property' || parent.type === 'MethodDefinition') && parent.key) return parent.key.name || String(parent.key.value);
    if (parent.type === 'AssignmentExpression' && parent.left) return sourceName(parent.left);
  }
  return '(anonymous)';
}

function sourceName(node) {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') return `${sourceName(node.object)}.${node.property.name || '?'}`;
  return '(expression)';
}

function children(node) {
  const out = [];
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'type' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') out.push(c); }
    else if (v && typeof v.type === 'string') out.push(v);
  }
  return out;
}

// [{name, line, complexity}] for every function in the source, in source order.
export function complexityOf(source, opts) {
  const ast = parseSource(source, opts);
  const out = [];
  function walk(node, parent, counter) {
    if (FUNCTION_TYPES.has(node.type)) {
      const own = { name: nameOf(node, parent), line: node.loc.start.line, complexity: 1 };
      out.push(own);
      for (const c of children(node)) walk(c, node, own);
      return;
    }
    if (counter) {
      if (DECISION_TYPES.has(node.type)) counter.complexity += 1;
      else if (node.type === 'SwitchCase' && node.test) counter.complexity += 1;
      else if (node.type === 'LogicalExpression' && LOGICAL.has(node.operator)) counter.complexity += 1;
    }
    for (const c of children(node)) walk(c, node, counter);
  }
  walk(ast, null, null);
  return out;
}

// Functions over `ceiling` across `dirs` under `root`: {over, functions}, worst
// first. An unparsable file is a finding with complexity Infinity.
import fs from 'node:fs';
import path from 'node:path';
import { walk } from '../lib/files.mjs';

const EXTS = new Set(['.js', '.mjs', '.cjs']);

export function scanComplexity({ root, dirs, skip = [], ceiling }) {
  const over = [];
  let functions = 0;
  for (const dir of dirs) {
    for (const file of walk(path.join(root, dir), { skip: new Set(skip), exts: EXTS })) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      let items;
      try { items = complexityOf(fs.readFileSync(file, 'utf8'), { module: !file.endsWith('.cjs') }); } catch (e) { over.push({ file: rel, name: `(unparsable: ${e.message})`, line: 0, complexity: Infinity }); continue; }
      functions += items.length;
      for (const f of items) if (f.complexity > ceiling) over.push({ file: rel, ...f });
    }
  }
  over.sort((a, b) => b.complexity - a.complexity || a.file.localeCompare(b.file));
  return { over, functions };
}

// CLI: node architecture/complexity.mjs --root <repo> (--dir <rel> ... | --config <json> --key <k>)
//        [--skip <name> ...] [--max 15] [--allowed N] [--json]
// Counts functions whose cyclomatic complexity exceeds --max. --allowed is the
// ratchet (default 0): more such functions than that exits 1. --config reads
// {roots, skip, ceiling} from a JSON file (at --key); flags override it.
import { isMain, parseFlags, num, usage, configSection } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['root', 'max', 'allowed', 'config', 'key'], multi: ['dir', 'skip'], bools: ['json'] });
  const cfg = configSection(f.config, f.key);
  const dirs = f.dir.length ? f.dir : cfg.roots || [];
  if (!f.root || !dirs.length) usage('complexity: give --root and at least one --dir (or --config with roots)');
  const ceiling = f.max !== undefined ? num(f.max, 'max') : cfg.ceiling !== undefined ? cfg.ceiling : 15;
  const allowed = f.allowed !== undefined ? num(f.allowed, 'allowed') : 0;
  const skip = f.skip.length ? f.skip : cfg.skip || ['node_modules', '.git', '.scratch'];
  const { over, functions } = scanComplexity({ root: f.root, dirs, skip, ceiling });
  const pass = over.length <= allowed;
  if (f.json) process.stdout.write(JSON.stringify({ functions, ceiling, allowed, over, pass }) + '\n');
  else {
    for (const o of over.slice(0, 20)) process.stdout.write(`over ${o.file}:${o.line} ${o.name}=${o.complexity}\n`);
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${over.length} of ${functions} functions over ${ceiling} (allowed ${allowed})\n`);
  }
  process.exit(pass ? 0 : 1);
}
