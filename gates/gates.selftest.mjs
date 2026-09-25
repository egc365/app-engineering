// Change gates through the real `ae gates` / `ae verify` on a fixture git repo
// (Sol's GateDetectorTests and his CI assertion, plus the pending and dirty
// cases): a CSS change selects correctness, e2e and visual and passes; its build
// receipt verifies; a tampered gate receipt, a dirty tree and a changed adapter
// each fail verification; a routing path (`*route*` across slashes) needs
// contracts and chaos, which are unbound, so the build is BLOCKED and red; an
// unbound command, a pending tool and a red tool each fail the build.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { selftest, TOOLKIT } from '../lib/selftest.mjs';

const AE = path.join(TOOLKIT, 'bin', 'ae');

await selftest('gates.run', (t) => {
  const repo = path.join(t.dir, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  const ae = (...a) => spawnSync(process.execPath, [AE, ...a], { encoding: 'utf8', timeout: 60000 });
  const json = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };
  const ok = [process.execPath, '-e', 'process.exit(0)'];
  const adapter = {
    schema: 'app-engineering.adapter/1', app: 'fixture',
    changeRules: [
      { id: 'styles', patterns: ['*.css'], classes: ['css-only'] },
      { id: 'routing', patterns: ['*route*'], classes: ['routing'] },
      { id: 'docs', patterns: ['*.md'], classes: ['docs-only'] },
    ],
    fallbackClasses: ['app-code'],
    gates: { correctness: ['correctness.suite'], e2e: ['e2e.suite'], visual: ['visual.theme-probe'], architecture: ['architecture.rules'] },
    architectureRules: [{ id: 'no-pool', files: ['apps/*.cjs'], forbid_regex: 'new\\s+Pool\\s*\\(', require_match: true }],
    tools: {
      'correctness.suite': { command: ok },
      'e2e.suite': { command: ok },
      'visual.theme-probe': { command: [process.execPath, '-e', 'console.log("image checked")'] },
      'architecture.rules': { args: ['--root', '{repo}', '--adapter', '{repo}/app-engineering.json'] },
    },
  };
  const writeAdapter = (a) => fs.writeFileSync(path.join(repo, 'app-engineering.json'), JSON.stringify(a, null, 2));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Tester');
  t.write('repo/.gitignore', '.ae/\n');
  t.write('repo/src/file.css', 'body { color: red; }\n');
  t.write('repo/README.md', 'fixture\n');
  t.write('repo/apps/shell/config/routes.cjs', 'module.exports = {};\n');
  writeAdapter(adapter);
  git('add', '.');
  git('commit', '-qm', 'fixture');

  const plan = json(ae('gates', '--repo', repo, '--changed', 'src/file.css', '--plan', '--json'));
  t.check('a CSS change selects css-only: correctness, e2e, visual', plan && JSON.stringify(plan.required) === '["correctness","e2e","visual"]' && plan.uncovered.length === 0, plan && plan.required.join(','));
  const css = t.exit('the CSS change passes every bound gate', ae('gates', '--repo', repo, '--changed', 'src/file.css', '--json'), 0);
  const build = json(css);
  t.check('a receipt per gate and a build receipt; the tree stays clean', build && build.outcomes.length === 3 && build.outcomes.every((o) => o.status === 'PASS' && /^\d{8}T\d{6}Z-[0-9a-f]{10}$/.test(o.run_id)) && git('status', '--porcelain') === '', build && build.receipt);
  t.exit('the build receipt verifies', ae('verify', build.receipt, '--repo', repo), 0);

  const gateFile = path.join(repo, build.outcomes[0].receipt);
  const original = fs.readFileSync(gateFile, 'utf8');
  const tampered = JSON.parse(original);
  tampered.data.tools[0].exit_code = 7;
  fs.writeFileSync(gateFile, JSON.stringify(tampered));
  const tamper = t.exit('a tampered gate receipt fails verification', ae('verify', build.receipt, '--repo', repo), 1);
  t.check('the problem is the receipt hash', /receipt hash mismatch/.test(tamper.stdout), tamper.stdout.trim().split('\n')[0]);
  fs.writeFileSync(gateFile, original);

  fs.appendFileSync(path.join(repo, 'README.md'), 'edit\n');
  t.exit('a dirty tree fails verification', ae('verify', build.receipt, '--repo', repo), 1);
  t.exit('--allow-dirty accepts it', ae('verify', build.receipt, '--repo', repo, '--allow-dirty'), 0);
  git('checkout', '--', 'README.md');

  const route = ae('gates', '--repo', repo, '--changed', 'apps/shell/config/routes.cjs', '--json');
  t.exit('a routing change is red while contracts and chaos are unbound', route, 1);
  const rb = json(route);
  const got = rb ? Object.fromEntries(rb.outcomes.map((o) => [o.gate, o.status])) : {};
  t.check('routing: architecture, correctness, e2e PASS; contracts, chaos BLOCKED (`*route*` crosses slashes)', JSON.stringify(got) === JSON.stringify({ architecture: 'PASS', chaos: 'BLOCKED', contracts: 'BLOCKED', correctness: 'PASS', e2e: 'PASS' }), JSON.stringify(got));
  t.check('docs-only needs no gate and passes', json(ae('gates', '--repo', repo, '--changed', 'README.md', '--json')).result === 'PASS');

  const unbound = structuredClone(adapter);
  delete unbound.tools['visual.theme-probe'];
  writeAdapter(unbound);
  const blocked = json(ae('gates', '--repo', repo, '--changed', 'src/file.css', '--json'));
  t.check('an app tool with no command is BLOCKED and the build fails (Sol: empty adapter is BLOCKED)', blocked && blocked.result === 'FAIL' && blocked.outcomes.find((o) => o.gate === 'visual').status === 'BLOCKED', blocked && JSON.stringify(blocked.outcomes.map((o) => o.status)));
  const pending = structuredClone(adapter);
  pending.gates.e2e = ['e2e.playwright'];
  writeAdapter(pending);
  const pend = ae('gates', '--repo', repo, '--changed', 'src/file.css', '--plan');
  t.check('a pending tool bound to a gate is BLOCKED, naming its card', /BLOCKED\s+e2e\s+e2e\.playwright BLOCKED \(e2e\.playwright is pending \(card B2-T7\)\)/.test(pend.stdout), pend.stdout.split('\n').find((l) => l.includes(' e2e ')));
  const red = structuredClone(adapter);
  red.tools['correctness.suite'].command = [process.execPath, '-e', 'process.exit(1)'];
  writeAdapter(red);
  t.exit('a red tool fails its gate and the build', ae('gates', '--repo', repo, '--changed', 'src/file.css'), 1);
  writeAdapter(adapter);

  const drift = structuredClone(adapter);
  drift.changeRules[0].classes = ['app-code'];
  writeAdapter(drift);
  git('commit', '-qam', 'rules changed');
  const moved = t.exit('after the adapter and commit change, the old receipt fails', ae('verify', build.receipt, '--repo', repo), 1);
  t.check('it names the changed configuration, commit and rules', /configuration changed/.test(moved.stdout) && /commit mismatch/.test(moved.stdout) && /differ from the current rules/.test(moved.stdout), moved.stdout.trim().split('\n').slice(0, 3).join(' | '));
});
