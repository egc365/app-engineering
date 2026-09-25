// Dead-export detector: exports used elsewhere pass; a planted orphan goes red.
import { selftest } from '../lib/selftest.mjs';
import { exportedNames } from './dead-exports.mjs';

await selftest('architecture.dead-exports', (t) => {
  t.write('src/a.mjs', 'export function used() {}\nexport const alsoUsed = 1;\n');
  t.write('src/b.mjs', 'import { used, alsoUsed } from "./a.mjs";\nused(alsoUsed);\n');
  t.write('src/c.cjs', 'function cjsName() {}\nmodule.exports = { cjsName };\n');
  t.write('src/d.mjs', 'require("./c.cjs").cjsName();\n');
  const names = [...exportedNames('export { a, b as c }\nexport async function d() {}\nmodule.exports = { e, f: 1 };')].sort().join(',');
  t.check('export forms recognised', names === 'a,c,d,e,f', names);
  t.exit('every export used: passes', t.run('architecture/dead-exports.mjs', ['--root', t.dir, '--dir', 'src']), 0);
  t.write('src/orphan.mjs', 'export function nobodyCallsMe() {}\n');
  const red = t.exit('planted orphan export goes red', t.run('architecture/dead-exports.mjs', ['--root', t.dir, '--dir', 'src']), 1);
  t.check('the finding names it', /dead src\/orphan\.mjs:nobodyCallsMe/.test(red.stdout), (red.stdout.match(/^dead .*$/m) || ['none'])[0]);
  t.exit('ceiling 1 accepts the one', t.run('architecture/dead-exports.mjs', ['--root', t.dir, '--dir', 'src', '--ceiling', '1']), 0);
});
