// A fixture /proc tree for self-tests: pid dirs with stat, status, smaps_rollup
// and fd links, plus net/tcp and net/tcp6. Fd entries are dangling symlinks whose
// target text is "socket:[<inode>]", which is what readlink returns under /proc.
import fs from 'node:fs';
import path from 'node:path';

const TCP_HEADER = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n';

// procs: [{pid, ppid, comm, pssKb, rssKb, sockets: [inode]}]
// listen: [{hex, port, inode, v6}] where hex is /proc's address encoding.
export function makeProc(root, { procs = [], listen = [] } = {}) {
  fs.mkdirSync(path.join(root, 'net'), { recursive: true });
  for (const p of procs) {
    const d = path.join(root, String(p.pid));
    fs.mkdirSync(path.join(d, 'fd'), { recursive: true });
    fs.writeFileSync(path.join(d, 'stat'), `${p.pid} (${p.comm || 'app'}) S ${p.ppid} ${p.pid} ${p.pid} 0 -1 4194560 0 0 0 0\n`);
    fs.writeFileSync(path.join(d, 'status'), `Name:\t${p.comm || 'app'}\nVmRSS:\t ${p.rssKb || 0} kB\n`);
    fs.writeFileSync(path.join(d, 'smaps_rollup'), `00400000-7fff00000000 ---p 00000000 00:00 0 [rollup]\nRss:  ${p.rssKb || 0} kB\nPss:  ${p.pssKb || 0} kB\n`);
    (p.sockets || []).forEach((inode, i) => fs.symlinkSync(`socket:[${inode}]`, path.join(d, 'fd', String(10 + i))));
  }
  const rows = (v6) => listen.filter((l) => !!l.v6 === v6).map((l, i) =>
    `   ${i}: ${l.hex}:${l.port.toString(16).toUpperCase().padStart(4, '0')} ${v6 ? '0'.repeat(32) : '00000000'}:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 ${l.inode} 1 0000000000000000 100 0 0 10 0\n`).join('');
  fs.writeFileSync(path.join(root, 'net', 'tcp'), TCP_HEADER + rows(false));
  fs.writeFileSync(path.join(root, 'net', 'tcp6'), TCP_HEADER + rows(true));
  return root;
}

export const LOOPBACK_V4 = '0100007F';
export const WILDCARD_V4 = '00000000';
