// Architecture rules (Sol's test_planted_forbidden_pool_detected, and more): a
// clean tree passes; a planted `new Pool(` goes red naming file and line; a rule
// whose patterns match nothing goes red; no rules is BLOCKED (3), not green.
import { selftest } from '../lib/selftest.mjs';

await selftest('architecture.rules', (t) => {
  const rules = [{ id: 'no-ad-hoc-pool', files: ['apps/shell/main/*.js', 'apps/shell/config/*.cjs'], forbid_regex: 'new\\s+Pool\\s*\\(', require_match: true }];
  t.write('rules.json', JSON.stringify(rules));
  t.write('repo/apps/shell/main/boot.js', 'const routes = require("../config/routes.cjs");\n');
  t.write('repo/apps/shell/config/routes.cjs', 'module.exports = {};\n');
  t.write('repo/core/pool.mjs', 'export const pool = new Pool({});\n');
  const args = ['--root', `${t.dir}/repo`, '--rules', `${t.dir}/rules.json`];
  t.exit('clean shell tree passes (the one pool owner is outside the rule)', t.run('architecture/rules.mjs', args), 0);
  t.write('repo/apps/shell/main/boot.js', 'const a = 1;\nconst pool = new  Pool ({});\n');
  const red = t.exit('planted new Pool( in shell main goes red', t.run('architecture/rules.mjs', args), 1);
  t.check('the violation names file and line', /no-ad-hoc-pool: apps\/shell\/main\/boot\.js:2/.test(red.stdout), red.stdout.trim());
  t.write('repo/apps/shell/lib/deep/x.js', 'new Pool()\n');
  t.write('rules.json', JSON.stringify([{ id: 'slashes', files: ['apps/*.js'], forbid_regex: 'new Pool', require_match: true }]));
  t.exit('`*` crosses `/` like fnmatch (apps/*.js reaches apps/shell/lib/deep/x.js)', t.run('architecture/rules.mjs', args), 1);
  t.write('rules.json', JSON.stringify([{ id: 'moved', files: ['apps/gone/*.js'], forbid_regex: 'x', require_match: true }]));
  t.exit('a rule that matches no file goes red', t.run('architecture/rules.mjs', args), 1);
  t.write('rules.json', '[]');
  t.exit('no rules configured is BLOCKED (3)', t.run('architecture/rules.mjs', args), 3);
});
