// Physical acceptance evidence: a walkthrough log of the real desktop app is
// checked against the acceptance checklist (acceptance/acceptance.json, 36
// steps). Ported from the App Builder Kit (appbuild/__main__.py cmd_acceptance,
// Sol, 2026-09-24).
//
// Every checklist step must be PASS with at least one evidence file inside the
// repo; the log's commit must be HEAD; the recording must exist, hold a video
// stream and last at least 15 seconds. File and metadata checks do not prove a
// recording is authentic: a reviewer watches it.
//
// Log: {"commit": "<sha>", "movie": "<repo-relative path>",
//       "steps": [{"id": "launch", "result": "PASS", "evidence": ["<path>", ...]}, ...]}
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitInfo } from '../lib/receipt.mjs';

export const CHECKLIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'acceptance.json');
export const MIN_MOVIE_S = 15;

export function checkLog(repo, log, checklist) {
  const errors = [];
  const required = checklist.steps.map((s) => s.id);
  const steps = Array.isArray(log.steps) ? log.steps : [];
  const accepted = new Set(steps.filter((s) => s.result === 'PASS' && Array.isArray(s.evidence) && s.evidence.length).map((s) => s.id));
  for (const s of steps) {
    for (const rel of s.evidence || []) {
      const p = path.resolve(repo, rel);
      if (!p.startsWith(repo + path.sep) || !fs.existsSync(p) || !fs.statSync(p).isFile()) errors.push(`missing evidence: ${rel}`);
    }
  }
  const missing = required.filter((id) => !accepted.has(id));
  if (missing.length) errors.push(`missing accepted steps: ${missing.join(', ')}`);
  if (log.commit !== gitInfo(repo).sha) errors.push('acceptance commit is not HEAD');
  let movie = null;
  const moviePath = log.movie ? path.resolve(repo, log.movie) : null;
  if (!moviePath || !moviePath.startsWith(repo + path.sep) || !fs.existsSync(moviePath)) errors.push('movie file missing');
  else {
    const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', moviePath], { encoding: 'utf8', timeout: 30000 });
    if (r.error) errors.push('ffprobe unavailable; the movie cannot be verified');
    else if (r.status !== 0) errors.push('ffprobe could not read the movie');
    else {
      const d = JSON.parse(r.stdout);
      const duration = Number((d.format || {}).duration || 0);
      const video = (d.streams || []).find((s) => s.codec_type === 'video');
      if (duration < MIN_MOVIE_S) errors.push(`movie shorter than ${MIN_MOVIE_S} seconds (${duration} s)`);
      if (!video) errors.push('movie has no video stream');
      movie = { path: log.movie, duration_s: duration, width: video ? video.width : null, height: video ? video.height : null, sha256: crypto.createHash('sha256').update(fs.readFileSync(moviePath)).digest('hex') };
    }
  }
  return { status: errors.length ? 'FAIL' : 'PASS', errors, required: required.length, accepted: required.filter((id) => accepted.has(id)).length, movie, notice: 'File and metadata checks do not prove the recording is authentic; a reviewer watches it.' };
}

// CLI: node acceptance/checklist.mjs --repo <repo> --log <log.json> [--checklist <file.json>] [--json]
// Exit 0 when every step is evidenced and the movie holds, 1 otherwise, 2 on bad input.
import { isMain, parseFlags, usage } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['repo', 'log', 'checklist'], bools: ['json'] });
  if (!f.repo || !f.log) usage('checklist: give --repo and --log');
  let log;
  let checklist;
  try { log = JSON.parse(fs.readFileSync(f.log, 'utf8')); } catch (e) { usage(`--log ${f.log}: ${e.message}`); }
  try { checklist = JSON.parse(fs.readFileSync(f.checklist || CHECKLIST, 'utf8')); } catch (e) { usage(`checklist: ${e.message}`); }
  const r = checkLog(path.resolve(f.repo), log, checklist);
  if (f.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else {
    for (const e of r.errors) process.stdout.write(`error ${e}\n`);
    process.stdout.write(`${r.status} acceptance: ${r.accepted} of ${r.required} steps evidenced; movie ${r.movie ? `${r.movie.duration_s} s` : 'none'}. ${r.notice}\n`);
  }
  process.exit(r.status === 'PASS' ? 0 : 1);
}
