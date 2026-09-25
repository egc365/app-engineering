// Design proposals before a design question: run the app's image generator
// (LiveShot or another renderer) on a brief and require at least two real,
// decodable images before the owner is asked to choose. Ported from the App
// Builder Kit (appbuild/__main__.py cmd_design and inspect_image, Sol,
// 2026-09-24). A renamed empty file or a thumbnail under 64 px does not count.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// {width, height} for a decodable image at least 64 px on its short side, else null.
export function inspectImage(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', file], { encoding: 'utf8', timeout: 15000 });
  if (probe.error) throw new Error(`ffprobe unavailable: ${probe.error.message}`);
  if (probe.status !== 0) return null;
  let streams = [];
  try { streams = JSON.parse(probe.stdout).streams || []; } catch { return null; }
  const video = streams.find((s) => s.codec_type === 'video');
  if (!video || Math.min(Number(video.width) || 0, Number(video.height) || 0) < 64) return null;
  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-f', 'null', '-'], { encoding: 'utf8', timeout: 30000 });
  if (decoded.status !== 0) return null;
  return { width: Number(video.width), height: Number(video.height) };
}

export function validImages(dir, root) {
  const files = fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, String(f))).filter((f) => fs.statSync(f).isFile() && IMAGE.has(path.extname(f).toLowerCase())).sort();
  const images = [];
  const rejected = [];
  for (const f of files) {
    const d = inspectImage(f);
    if (d) images.push({ path: path.relative(root, f), sha256: crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'), ...d });
    else rejected.push(path.relative(root, f));
  }
  return { images, rejected };
}

// CLI: node visual/proposals.mjs --repo <repo> --brief <text> --generator '<json argv>'
//      [--out <dir>] [--min 2] [--timeout-s 180] [--json]
// The generator argv may use {brief} and {outdir}. Exit 0 when it succeeded and
// left at least --min decodable images, 1 otherwise, 3 when no generator is
// configured (BLOCKED), 2 on bad input or missing ffprobe/ffmpeg.
import { isMain, parseFlags, num, usage } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['repo', 'brief', 'generator', 'out', 'min', 'timeout-s'], bools: ['json'] });
  if (!f.repo || !f.brief) usage('proposals: give --repo and --brief');
  if (!f.generator) {
    process.stdout.write('BLOCKED no image generator configured (the adapter binds none); no design question goes to the owner without two real proposals\n');
    process.exit(3);
  }
  let gen;
  try { gen = JSON.parse(f.generator); } catch { usage('--generator must be a JSON argv array'); }
  if (!Array.isArray(gen) || !gen.length || gen.some((x) => typeof x !== 'string')) usage('--generator must be a non-empty JSON array of strings');
  const repo = path.resolve(f.repo);
  const out = path.resolve(f.out || path.join(repo, '.ae', 'artifacts', `design-${crypto.randomBytes(5).toString('hex')}`));
  fs.mkdirSync(out, { recursive: true });
  const argv = gen.map((p) => p.replaceAll('{brief}', f.brief).replaceAll('{outdir}', out));
  const r = spawnSync(argv[0], argv.slice(1), { cwd: repo, encoding: 'utf8', timeout: 1000 * (f['timeout-s'] ? num(f['timeout-s'], 'timeout-s') : 180) });
  let found;
  try { found = validImages(out, repo); } catch (e) { usage(`proposals: ${e.message}`); }
  const min = f.min !== undefined ? num(f.min, 'min') : 2;
  const pass = r.status === 0 && found.images.length >= min;
  const result = { status: pass ? 'PASS' : 'FAIL', brief: f.brief, argv, exit_code: r.status, out: path.relative(repo, out), images: found.images, rejected: found.rejected, stderr: String(r.stderr || '').slice(-2000) };
  if (f.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else {
    for (const i of found.images) process.stdout.write(`image ${i.path} ${i.width}x${i.height} ${i.sha256.slice(0, 12)}\n`);
    for (const x of found.rejected) process.stdout.write(`rejected ${x} (not a decodable image of at least 64 px)\n`);
    process.stdout.write(`${result.status} ${found.images.length} proposal images (need ${min}); generator exit ${r.status}\n`);
  }
  process.exit(pass ? 0 : 1);
}
