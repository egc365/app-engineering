// Loopback-only gate over a fixture /proc: a tree listening on 127.0.0.1 and ::1
// passes; a planted 0.0.0.0 listener in a child process goes red. Registry
// mode (Sol's test_port_collision_detector): a declared port held by its owner
// passes; a duplicate declaration and a wrong owner go red; no ports is BLOCKED.
import path from 'node:path';
import { selftest } from '../lib/selftest.mjs';
import { makeProc, LOOPBACK_V4, WILDCARD_V4 } from '../lib/fakeproc.mjs';

const V6_LOOPBACK = '00000000000000000000000001000000';

await selftest('ports.listening', (t) => {
  const procs = [
    { pid: 200, ppid: 1, sockets: [7001] },
    { pid: 201, ppid: 200, sockets: [7002] },
  ];
  const listen = [
    { hex: LOOPBACK_V4, port: 8793, inode: 7001 },
    { hex: V6_LOOPBACK, port: 9333, inode: 7002, v6: true },
  ];
  const clean = makeProc(path.join(t.dir, 'clean'), { procs, listen });
  const r = t.exit('loopback-only tree passes', t.run('ports/listening.mjs', ['--pid', '200', '--tree', '--proc-root', clean, '--require-loopback', '--json']), 0);
  let j = null;
  try { j = JSON.parse(r.stdout); } catch { /* checked below */ }
  t.check('both sockets found, both loopback', j && j.sockets.length === 2 && j.nonLoopback === 0, r.stdout.trim());
  const planted = makeProc(path.join(t.dir, 'planted'), {
    procs: [...procs, { pid: 202, ppid: 201, sockets: [7003] }],
    listen: [...listen, { hex: WILDCARD_V4, port: 5555, inode: 7003 }],
  });
  const red = t.exit('planted 0.0.0.0 listener in a grandchild goes red', t.run('ports/listening.mjs', ['--pid', '200', '--tree', '--proc-root', planted, '--require-loopback']), 1);
  t.check('the finding names the pid and address', /EXTERNAL pid 202 0\.0\.0\.0:5555/.test(red.stdout), (red.stdout.match(/^EXTERNAL.*$/m) || ['none'])[0]);
  t.exit('without --tree the child is not scanned', t.run('ports/listening.mjs', ['--pid', '200', '--proc-root', planted, '--require-loopback']), 0);
  const reg = makeProc(path.join(t.dir, 'registry'), {
    procs: [{ pid: 300, ppid: 1, comm: 'ro-server', sockets: [8001] }, { pid: 301, ppid: 1, comm: 'other', sockets: [8002] }],
    listen: [{ hex: LOOPBACK_V4, port: 8790, inode: 8001 }, { hex: LOOPBACK_V4, port: 8791, inode: 8002 }],
  });
  const good = t.write('good.json', JSON.stringify([{ port: 8790, protocol: 'tcp', process_contains: 'ro-server' }]));
  t.exit('registry: declared port held by its owner passes', t.run('ports/listening.mjs', ['--registry', good, '--proc-root', reg]), 0);
  const bad = t.write('bad.json', JSON.stringify([{ port: 8791, protocol: 'tcp', process_contains: 'ro-server' }, { port: 8791, protocol: 'tcp' }]));
  const redReg = t.exit('registry: planted wrong owner and duplicate declaration go red', t.run('ports/listening.mjs', ['--registry', bad, '--proc-root', reg, '--json']), 1);
  let jr = null;
  try { jr = JSON.parse(redReg.stdout); } catch { /* checked below */ }
  t.check('registry: both problems are named', jr && jr.problems.length === 2 && jr.problems.some((p) => /duplicate declared port 8791\/tcp/.test(p)) && jr.problems.some((p) => /pid 301 other/.test(p)), redReg.stdout.trim());
  const unread = makeProc(path.join(t.dir, 'unreadable'), { procs: [{ pid: 400, ppid: 1, comm: 'x', sockets: [] }], listen: [{ hex: LOOPBACK_V4, port: 22, inode: 9001 }, { hex: V6_LOOPBACK, port: 22, inode: 9002, v6: true }] });
  const ur = t.exit('registry: an owner this user cannot read is not passed as matching', t.run('ports/listening.mjs', ['--registry', t.write('ssh.json', JSON.stringify([{ port: 22, process_contains: 'sshd' }])), '--proc-root', unread]), 1);
  t.check('registry: it says unreadable, once for both address families', (ur.stdout.match(/owner unreadable/g) || []).length === 1, ur.stdout.trim().split('\n')[0]);
  t.exit('registry: an empty registry is BLOCKED (3)', t.run('ports/listening.mjs', ['--registry', t.write('empty.json', '[]'), '--proc-root', reg]), 3);
});
