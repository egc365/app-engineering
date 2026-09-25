// The complexity gate: a tree of simple functions passes; a planted function with
// twenty branches goes red; an unparsable file goes red; nested functions count apart.
import { selftest } from '../lib/selftest.mjs';
import { complexityOf } from './complexity.mjs';

await selftest('architecture.complexity', (t) => {
  t.write('src/ok.mjs', 'export function add(a, b) { return a && b ? a + b : 0; }\n');
  t.write('src/lib.cjs', 'module.exports = function f(x) { if (x) return 1; return 2; };\n');
  t.exit('simple tree passes at --max 15 --allowed 0', t.run('architecture/complexity.mjs', ['--root', t.dir, '--dir', 'src', '--max', '15']), 0);
  const inner = complexityOf('function outer(a) { if (a) {} const g = () => { if (a) {} if (a) {} }; }');
  t.check('nested function counted apart (outer 2, inner 3)', inner[0].complexity === 2 && inner[1].complexity === 3, JSON.stringify(inner));
  const branches = Array.from({ length: 20 }, (_, i) => `  if (x === ${i}) return ${i};`).join('\n');
  t.write('src/seeded.mjs', `export function twentyBranches(x) {\n${branches}\n  return -1;\n}\n`);
  const red = t.exit('planted 20-branch function goes red', t.run('architecture/complexity.mjs', ['--root', t.dir, '--dir', 'src', '--max', '15']), 1);
  t.check('the finding names it', /twentyBranches=21/.test(red.stdout), (red.stdout.match(/^over .*$/m) || ['none'])[0]);
  t.exit('ratchet --allowed 1 accepts exactly one', t.run('architecture/complexity.mjs', ['--root', t.dir, '--dir', 'src', '--max', '15', '--allowed', '1']), 0);
  t.write('src/broken.mjs', 'export function ( {\n');
  t.exit('unparsable file goes red', t.run('architecture/complexity.mjs', ['--root', t.dir, '--dir', 'src', '--max', '15', '--allowed', '1']), 1);
});
