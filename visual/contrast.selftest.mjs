// WCAG contrast gate: legible pairs pass; a planted 2.5:1 pair, a dim var() token,
// an unreadable colour and a missing stylesheet each go red.
import { selftest } from '../lib/selftest.mjs';
import { contrastRatio } from './contrast.mjs';

await selftest('visual.contrast', (t) => {
  const bw = contrastRatio('#ffffff', '#000000');
  t.check('white on black is 21:1', Math.abs(bw - 21) < 1e-9, String(bw));
  t.write('css/tokens.css', ':root { --text: #e6e6e6; --dim: rgb(90, 90, 90); }\n');
  t.write('css/app.css', '@import "tokens.css";\n.title { color: var(--text); background: #0c0c0c; }\n.chip { color: rgba(255,255,255,0.9); background: #121212; }\n');
  const args = ['--root', t.dir, '--css', 'css/app.css', '--min', '4.5', '--base', '#0c0c0c'];
  t.exit('legible pairs pass (tokens via @import)', t.run('visual/contrast.mjs', args), 0);
  t.write('css/app.css', '@import "tokens.css";\n.title { color: var(--text); background: #0c0c0c; }\n#seeded-rgb { background: rgb(12, 12, 12); color: rgba(85, 85, 85, 1); }\n');
  t.exit('planted 2.5:1 rgb pair goes red', t.run('visual/contrast.mjs', args), 1);
  t.write('css/app.css', '@import "tokens.css";\n#seeded-var { background: #0c0c0c; color: var(--dim); }\n');
  t.exit('planted dim var() token goes red', t.run('visual/contrast.mjs', args), 1);
  t.write('css/app.css', '#seeded-unknown { background: #0c0c0c; color: var(--undefined-token); }\n');
  t.exit('planted unreadable colour goes red', t.run('visual/contrast.mjs', args), 1);
  t.write('css/app.css', '.title { color: #e6e6e6; background: #0c0c0c; }\n');
  t.exit('planted missing stylesheet goes red', t.run('visual/contrast.mjs', [...args, '--css', 'css/gone.css']), 1);
});
