// Acceptance evidence on a fixture repo: all 36 steps evidenced with a 16 s
// recording on HEAD passes; a planted missing step, a 1 s recording, a wrong
// commit and evidence outside the repo each go red.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { selftest } from '../lib/selftest.mjs';

await selftest('acceptance.evidence', (t) => {
  const repo = `${t.dir}/repo`;
  fs.mkdirSync(repo, { recursive: true });
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Tester');
  t.write('repo/README.md', 'fixture\n');
  git('add', '.');
  git('commit', '-qm', 'fixture');
  const head = git('rev-parse', 'HEAD');
  const movie = (name, seconds) => execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=64x64:r=1`, '-t', String(seconds), '-pix_fmt', 'yuv420p', `${repo}/${name}`]);
  movie('walk.mp4', 16);
  movie('short.mp4', 1);
  t.write('repo/evidence/shot.png', 'png');
  const steps = JSON.parse(fs.readFileSync(new URL('./acceptance.json', import.meta.url), 'utf8')).steps.map((s) => ({ id: s.id, result: 'PASS', evidence: ['evidence/shot.png'] }));
  const run = (label, log, want) => t.exit(label, t.run('acceptance/checklist.mjs', ['--repo', repo, '--log', t.write(`${label.length}.json`, JSON.stringify(log))]), want);
  run('all 36 steps evidenced with a 16 s recording on HEAD passes', { commit: head, movie: 'walk.mp4', steps }, 0);
  run('planted missing step goes red', { commit: head, movie: 'walk.mp4', steps: steps.filter((s) => s.id !== 'exit_cleanup') }, 1);
  run('planted 1 s recording goes red', { commit: head, movie: 'short.mp4', steps }, 1);
  run('planted wrong commit goes red', { commit: '0'.repeat(40), movie: 'walk.mp4', steps }, 1);
  run('planted evidence outside the repo goes red', { commit: head, movie: 'walk.mp4', steps: steps.map((s, i) => (i ? s : { ...s, evidence: ['../outside.png'] })) }, 1);
});
