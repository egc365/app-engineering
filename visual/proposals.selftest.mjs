// Design proposals: a generator that renders two real images passes; a planted
// empty file renamed .png, or a 32 px thumbnail, does not count and the run goes
// red; no generator configured is BLOCKED (3). Images are rendered by ffmpeg.
import { selftest } from '../lib/selftest.mjs';

const render = (name, size) => `require('node:child_process').execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=teal:s=${size}','-frames:v','1',require('node:path').join(process.argv[1],'${name}')])`;

await selftest('visual.proposals', (t) => {
  const repo = t.dir;
  const gen = (body) => JSON.stringify([process.execPath, '-e', body, '{outdir}', '{brief}']);
  const two = gen(`${render('a.png', '160x120')};${render('b.png', '160x120')}`);
  const ok = t.exit('two real proposals pass', t.run('visual/proposals.mjs', ['--repo', repo, '--brief', 'dark settings page', '--generator', two, '--json']), 0);
  let j = null;
  try { j = JSON.parse(ok.stdout); } catch { /* checked below */ }
  t.check('each proposal carries size and sha256', j && j.images.length === 2 && j.images.every((i) => i.width === 160 && /^[0-9a-f]{64}$/.test(i.sha256)), ok.stdout.slice(0, 200));
  const empty = gen(`${render('a.png', '160x120')};require('node:fs').writeFileSync(require('node:path').join(process.argv[1],'b.png'),'')`);
  t.exit('planted empty file renamed .png goes red', t.run('visual/proposals.mjs', ['--repo', repo, '--brief', 'x', '--generator', empty]), 1);
  const tiny = gen(`${render('a.png', '160x120')};${render('b.png', '32x32')}`);
  t.exit('planted 32 px thumbnail goes red', t.run('visual/proposals.mjs', ['--repo', repo, '--brief', 'x', '--generator', tiny]), 1);
  t.exit('a failing generator goes red', t.run('visual/proposals.mjs', ['--repo', repo, '--brief', 'x', '--generator', gen('process.exit(5)')]), 1);
  t.exit('no generator configured is BLOCKED (3)', t.run('visual/proposals.mjs', ['--repo', repo, '--brief', 'x']), 3);
});
