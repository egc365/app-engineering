// Moved from /apps/workspace/tools/fitness/lib/sockets.mjs (2026-09-24); this file is
// the one implementation. Workspace re-exports it.
// Listening TCP sockets of a process tree, from /proc text. Parsers are pure and
// take file text; `listeningSockets` is the thin reader over /proc.
// A socket is loopback when its bound address is 127.0.0.0/8 or ::1 (or the
// IPv4-mapped form ::ffff:127.x). A wildcard bind (0.0.0.0, ::) is not loopback.
import fs from 'node:fs';

const LISTEN = '0A';

function hexToBytes(hex) {
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

// /proc/net/tcp stores IPv4 as one little-endian 32-bit word; /proc/net/tcp6 as
// four such words. Returns a printable address.
export function decodeAddress(hex) {
  if (hex.length === 8) return hexToBytes(hex).reverse().join('.');
  if (hex.length === 32) {
    const groups = [];
    for (let w = 0; w < 4; w += 1) {
      const bytes = hexToBytes(hex.slice(w * 8, w * 8 + 8)).reverse();
      groups.push(((bytes[0] << 8) | bytes[1]).toString(16), ((bytes[2] << 8) | bytes[3]).toString(16));
    }
    return groups.join(':');
  }
  return hex;
}

export function isLoopback(address) {
  if (address.startsWith('127.')) return true;
  const zeros = address.split(':').every((g, i, all) => g === '0' || (i === all.length - 1 && g === '1'));
  if (zeros && address.endsWith(':1')) return true;
  // IPv4-mapped loopback ::ffff:7f00:1
  return /^0:0:0:0:0:ffff:7f/.test(address);
}

// Rows in LISTEN state from the text of /proc/net/tcp or tcp6:
// [{address, port, inode}].
export function parseListening(text) {
  const rows = [];
  for (const line of text.split('\n').slice(1)) {
    const f = line.trim().split(/\s+/);
    if (f.length < 10 || f[3] !== LISTEN) continue;
    const [addr, portHex] = f[1].split(':');
    rows.push({ address: decodeAddress(addr), port: parseInt(portHex, 16), inode: f[9] });
  }
  return rows;
}

// Socket inodes held by a pid, from its /proc/<pid>/fd links.
export function socketInodes(pid, procRoot = '/proc') {
  const out = new Set();
  let names = [];
  try { names = fs.readdirSync(`${procRoot}/${pid}/fd`); } catch { return out; }
  for (const name of names) {
    try {
      const m = /^socket:\[(\d+)\]$/.exec(fs.readlinkSync(`${procRoot}/${pid}/fd/${name}`));
      if (m) out.add(m[1]);
    } catch { /* fd closed meanwhile */ }
  }
  return out;
}

// Listening sockets owned by any pid in `pids`: [{pid, address, port, loopback}].
export function listeningSockets(pids, procRoot = '/proc') {
  const rows = [];
  for (const file of ['tcp', 'tcp6']) {
    let text = '';
    try { text = fs.readFileSync(`${procRoot}/net/${file}`, 'utf8'); } catch { continue; }
    rows.push(...parseListening(text));
  }
  const byInode = new Map(rows.map((r) => [r.inode, r]));
  const out = [];
  for (const pid of pids) {
    for (const inode of socketInodes(pid, procRoot)) {
      const row = byInode.get(inode);
      if (row) out.push({ pid, address: row.address, port: row.port, loopback: isLoopback(row.address) });
    }
  }
  return out;
}

// Every listening TCP socket on the machine with its owning pid and process
// name (comm, and the command line when readable): [{port, address, loopback,
// pid, process}]. pid is null when no readable /proc/<pid>/fd holds the inode.
export function allListening(procRoot = '/proc') {
  const rows = [];
  for (const file of ['tcp', 'tcp6']) {
    try { rows.push(...parseListening(fs.readFileSync(`${procRoot}/net/${file}`, 'utf8'))); } catch { /* absent */ }
  }
  const owner = new Map();
  for (const d of fs.readdirSync(procRoot)) {
    if (!/^\d+$/.test(d)) continue;
    for (const inode of socketInodes(d, procRoot)) if (!owner.has(inode)) owner.set(inode, Number(d));
  }
  const nameOf = (pid) => {
    let comm = '';
    let cmd = '';
    try { const st = fs.readFileSync(`${procRoot}/${pid}/stat`, 'utf8'); comm = st.slice(st.indexOf('(') + 1, st.lastIndexOf(')')); } catch { /* exited */ }
    try { cmd = fs.readFileSync(`${procRoot}/${pid}/cmdline`, 'utf8').split('\0').join(' ').trim(); } catch { /* unreadable */ }
    return [comm, cmd].filter(Boolean).join(' ');
  };
  return rows.map((r) => {
    const pid = owner.has(r.inode) ? owner.get(r.inode) : null;
    return { port: r.port, address: r.address, loopback: isLoopback(r.address), pid, process: pid === null ? null : nameOf(pid) };
  });
}

// A declared port registry checked against what listens (from the App Builder
// Kit, appbuild/ports.py check, Sol, 2026-09-24): a port declared twice, or a
// declared port held by a process whose name lacks `process_contains`, is a
// problem. Entries: {port, protocol: "tcp", process_contains?}.
export function checkRegistry(registry, observed) {
  const problems = [];
  const seen = new Set();
  for (const e of registry) {
    const protocol = e.protocol || 'tcp';
    const key = `${e.port}/${protocol}`;
    if (seen.has(key)) problems.push(`duplicate declared port ${key}`);
    seen.add(key);
    if (protocol !== 'tcp') { problems.push(`${key}: only tcp listeners are observed`); continue; }
    const seenOwner = new Set();
    for (const row of observed.filter((o) => o.port === e.port)) {
      if (!e.process_contains || seenOwner.has(row.pid)) continue;
      seenOwner.add(row.pid);
      // Fail closed: an owner this user cannot read cannot be shown to match.
      if (row.pid === null) problems.push(`port ${e.port}: owner unreadable (another user's process); "${e.process_contains}" cannot be verified`);
      else if (!(row.process || '').includes(e.process_contains)) problems.push(`port ${e.port} held by an unexpected process: pid ${row.pid} ${row.process}`);
    }
  }
  return problems;
}

// CLI: node ports/listening.mjs --pid <pid> [--tree] [--require-loopback] [--proc-root /proc] [--json]
//      node ports/listening.mjs (--registry <file.json> | --adapter <app-engineering.json>) [--proc-root /proc] [--json]
// --pid lists the TCP listening sockets of a pid (with --tree, of it and every
// descendant); --require-loopback is the gate: any wildcard or external bind
// exits 1, naming pid, address and port.
// --registry / --adapter (its "ports") checks the declared port registry against
// every listener on the machine; exit 1 on a problem, 3 when no port is
// declared (BLOCKED: an empty registry is unconfigured, never green).
import { isMain, parseFlags, num, usage } from '../lib/cli.mjs';
import { descendants, parentPidOf } from '../process/pss.mjs';

function treePids(root, procRoot) {
  const parentOf = new Map();
  for (const d of fs.readdirSync(procRoot)) {
    if (!/^\d+$/.test(d)) continue;
    try { parentOf.set(Number(d), parentPidOf(fs.readFileSync(`${procRoot}/${d}/stat`, 'utf8'))); } catch { /* exited */ }
  }
  return descendants(root, parentOf);
}

function registryMode(f, procRoot) {
  let registry;
  try {
    const doc = JSON.parse(fs.readFileSync(f.registry || f.adapter, 'utf8'));
    registry = f.adapter ? doc.ports || [] : Array.isArray(doc) ? doc : doc.ports || [];
  } catch (e) { usage(`listening: ${e.message}`); }
  if (!registry.length) {
    process.stdout.write(f.json ? `${JSON.stringify({ status: 'BLOCKED', declared: 0, problems: ['port registry unconfigured'] })}\n` : 'BLOCKED port registry unconfigured\n');
    process.exit(3);
  }
  const observed = allListening(procRoot);
  const problems = checkRegistry(registry, observed);
  const status = problems.length ? 'FAIL' : 'PASS';
  if (f.json) process.stdout.write(`${JSON.stringify({ status, declared: registry.length, listening: observed.length, problems })}\n`);
  else {
    for (const p of problems) process.stdout.write(`problem ${p}\n`);
    process.stdout.write(`${status} registry: ${registry.length} declared, ${observed.length} listening, ${problems.length} problems\n`);
  }
  process.exit(problems.length ? 1 : 0);
}

if (isMain(import.meta.url)) {
  const f = parseFlags(process.argv.slice(2), { flags: ['pid', 'proc-root', 'registry', 'adapter'], bools: ['tree', 'require-loopback', 'json'] });
  const procRoot = f['proc-root'] || '/proc';
  if (f.registry || f.adapter) registryMode(f, procRoot);
  const pid = num(f.pid, 'pid');
  if (!fs.existsSync(`${procRoot}/${pid}`)) usage(`no process ${pid} under ${procRoot}`);
  const pids = f.tree ? treePids(pid, procRoot) : [pid];
  const rows = listeningSockets(pids, procRoot);
  const external = rows.filter((r) => !r.loopback);
  const pass = !f['require-loopback'] || external.length === 0;
  if (f.json) process.stdout.write(JSON.stringify({ pids, sockets: rows, nonLoopback: external.length, pass }) + '\n');
  else {
    for (const r of rows) process.stdout.write(`${r.loopback ? 'loopback' : 'EXTERNAL'} pid ${r.pid} ${r.address}:${r.port}\n`);
    process.stdout.write(`${f['require-loopback'] ? (pass ? 'PASS' : 'FAIL') : 'MEASURED'} ${rows.length} listening, ${external.length} not loopback\n`);
  }
  process.exit(pass ? 0 : 1);
}
