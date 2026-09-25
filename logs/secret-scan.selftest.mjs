// Secret-leak detector: a clean tree passes; a planted raw or URL-encoded secret in
// a log goes red; the secret never appears in the output; an empty secret is a
// refusal, never a clean report. The secret here is a fixture value, not a real one.
import crypto from 'node:crypto';
import { selftest } from '../lib/selftest.mjs';

await selftest('logs.secret-scan', (t) => {
  const secret = `ae-fixture/${crypto.randomBytes(6).toString('hex')}@x`;
  const env = { AE_SELFTEST_SECRET: secret };
  t.write('repo/src/app.mjs', 'console.log("connecting");\n');
  t.write('repo/node_modules/dep/leak.txt', secret);
  const args = ['--root', `${t.dir}/repo`, '--needle-env', 'AE_SELFTEST_SECRET'];
  t.exit('clean tree passes (node_modules skipped)', t.run('logs/secret-scan.mjs', args, { env }), 0);
  t.write('repo/records/debug.log', `connecting with password=${secret}\n`);
  const red = t.exit('planted raw secret in a log goes red', t.run('logs/secret-scan.mjs', args, { env }), 1);
  t.check('output names the file, never the value', /records\/debug\.log/.test(red.stdout) && !red.stdout.includes(secret) && !red.stderr.includes(secret));
  t.write('repo/records/debug.log', `postgres://app:${encodeURIComponent(secret)}@127.0.0.1/db\n`);
  t.exit('planted URL-encoded secret goes red', t.run('logs/secret-scan.mjs', args, { env }), 1);
  t.exit('--exclude-basename drops the named file', t.run('logs/secret-scan.mjs', [...args, '--exclude-basename', 'debug.log'], { env }), 0);
  t.exit('empty secret is refused (exit 2), not reported clean', t.run('logs/secret-scan.mjs', args, { env: { AE_SELFTEST_SECRET: '' } }), 2);
});
