// Moved from /apps/workspace/tools/fitness/lib/pss.mjs (2026-09-24); this file is
// the one implementation. Workspace re-exports it.
// Process-tree memory from /proc text. The parsers are pure and take file text,
// so they are tested on fixtures; `treeMemory` is the thin reader over /proc.
// PSS (proportional set size) divides a page shared by several processes among
// them, so summing PSS over a tree gives what the tree really holds. RSS counts a
// shared page once per process and overstates a Chromium tree by about 3x.
import fs from 'node:fs';

// The parent pid from /proc/<pid>/stat. The comm field may hold spaces and
// parentheses, so the split starts after the last ")".
export function parentPidOf(statText) {
  const after = statText.slice(statText.lastIndexOf(')') + 2).split(' ');
  return Number(after[1]);
}

// kB from a "Pss:" line of /proc/<pid>/smaps_rollup.
export function pssKbOf(smapsRollupText) {
  const m = /^Pss:\s+(\d+)/m.exec(smapsRollupText);
  return m ? Number(m[1]) : 0;
}

// kB from a "VmRSS:" line of /proc/<pid>/status.
export function rssKbOf(statusText) {
  const m = /VmRSS:\s+(\d+)/.exec(statusText);
  return m ? Number(m[1]) : 0;
}

// Pids of `root` and every descendant, given a Map pid -> ppid.
export function descendants(root, parentOf) {
  const children = new Map();
  for (const [pid, ppid] of parentOf) {
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  const out = [];
  const stack = [root];
  while (stack.length) {
    const pid = stack.pop();
    out.push(pid);
    for (const c of children.get(pid) || []) stack.push(c);
  }
  return out;
}

// Sum of per-pid figures over a tree: {pssKb, rssKb, processes}.
export function sumTree(pids, figures) {
  let pssKb = 0;
  let rssKb = 0;
  let processes = 0;
  for (const pid of pids) {
    const f = figures.get(pid);
    if (!f) continue;
    pssKb += f.pssKb || 0;
    rssKb += f.rssKb || 0;
    processes += 1;
  }
  return { pssKb, rssKb, processes };
}

function readOr(file, fallback) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return fallback; }
}

// Live reader: PSS, RSS (MB) and process count of `rootPid` and its descendants.
export function treeMemory(rootPid, procRoot = '/proc') {
  const parentOf = new Map();
  const figures = new Map();
  for (const d of fs.readdirSync(procRoot)) {
    if (!/^\d+$/.test(d)) continue;
    const pid = Number(d);
    const stat = readOr(`${procRoot}/${d}/stat`, null);
    if (stat === null) continue;
    parentOf.set(pid, parentPidOf(stat));
    figures.set(pid, {
      pssKb: pssKbOf(readOr(`${procRoot}/${d}/smaps_rollup`, '')),
      rssKb: rssKbOf(readOr(`${procRoot}/${d}/status`, '')),
    });
  }
  const tree = descendants(rootPid, parentOf);
  const sum = sumTree(tree, figures);
  return { pids: tree, pssKb: sum.pssKb, pssMb: Math.round(sum.pssKb / 1024), rssMb: Math.round(sum.rssKb / 1024), processes: sum.processes };
}

// CLI: node process/pss.mjs --pid <root pid> [--proc-root /proc] [--max-mb N] [--json]
// Prints PSS and RSS (MB) and the process count of the tree. With --max-mb the
// tree's PSS is a gate: over the bound exits 1.
import { isMain, parseFlags, num, usage } from '../lib/cli.mjs';

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['pid', 'proc-root', 'max-mb'], bools: ['json'] });
  const pid = num(f.pid, 'pid');
  const procRoot = f['proc-root'] || '/proc';
  if (!fs.existsSync(`${procRoot}/${pid}`)) usage(`no process ${pid} under ${procRoot}`);
  const m = treeMemory(pid, procRoot);
  const max = f['max-mb'] !== undefined ? num(f['max-mb'], 'max-mb') : null;
  const pass = max === null || m.pssMb <= max;
  const out = { pid, pssMb: m.pssMb, rssMb: m.rssMb, processes: m.processes, pids: m.pids, maxMb: max, pass };
  if (f.json) process.stdout.write(JSON.stringify(out) + '\n');
  else process.stdout.write(`${max === null ? 'MEASURED' : pass ? 'PASS' : 'FAIL'} pid ${pid}: PSS ${m.pssMb} MB, RSS ${m.rssMb} MB, ${m.processes} processes${max === null ? '' : ` (bound ${max} MB)`}\n`);
  process.exit(pass ? 0 : 1);
}
