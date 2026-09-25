// SQLite plan gate on a fixture database: a lookup served by an index passes
// --require-index; with the index planted away the plan is a full scan and goes
// red; a write statement is refused (2) and the database is opened read-only.
import { DatabaseSync } from 'node:sqlite';
import { selftest } from '../lib/selftest.mjs';

await selftest('database.sqlite-explain', (t) => {
  const file = `${t.dir}/app.db`;
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE docs (id INTEGER PRIMARY KEY, path TEXT, body TEXT); CREATE INDEX docs_path ON docs(path);');
  const ins = db.prepare('INSERT INTO docs (path, body) VALUES (?, ?)');
  db.exec('BEGIN');
  for (let i = 0; i < 500; i += 1) ins.run(`p/${i}`, 'x');
  db.exec('COMMIT');
  db.close();
  const q = "SELECT id FROM docs WHERE path = 'p/42'";
  const ok = t.exit('indexed lookup passes --require-index', t.run('database/sqlite-explain.mjs', ['--db', file, '--query', q, '--require-index', '--json']), 0);
  let j = null;
  try { j = JSON.parse(ok.stdout); } catch { /* checked below */ }
  t.check('plan names the index and one row comes back', j && j.rows === 1 && j.plan.some((d) => /USING (COVERING )?INDEX docs_path/.test(d)), j ? j.plan.join(' | ') : ok.stdout);
  const w = new DatabaseSync(file);
  w.exec('DROP INDEX docs_path');
  w.close();
  const red = t.exit('planted missing index: full scan goes red', t.run('database/sqlite-explain.mjs', ['--db', file, '--query', q, '--require-index']), 1);
  t.check('the verdict counts the full scan', /1 full table scans/.test(red.stdout), red.stdout.trim().split('\n').pop());
  t.exit('a write statement is refused', t.run('database/sqlite-explain.mjs', ['--db', file, '--query', 'DELETE FROM docs']), 2);
  t.exit('a second statement after the SELECT is refused', t.run('database/sqlite-explain.mjs', ['--db', file, '--query', 'SELECT 1; DELETE FROM docs']), 2);
  const after = new DatabaseSync(file, { readOnly: true });
  t.check('the database still has its 500 rows', after.prepare('SELECT count(*) AS n FROM docs').get().n === 500);
  after.close();
});
