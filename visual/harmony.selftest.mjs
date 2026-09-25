// Harmony known answers (Sol's test_wcag_known_pair: 21:1, triadic = 3
// swatches) plus hue geometry, and the AA gate: a dark palette on a light
// background passes; a planted pale base goes red.
import { selftest } from '../lib/selftest.mjs';
import { harmony, palette, rgbToHsv, hsvToRgb } from './harmony.mjs';
import { contrastRatio } from './contrast.mjs';

await selftest('visual.harmony', (t) => {
  t.check('black on white is 21:1 (the one contrast implementation)', Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 1e-9);
  t.check('triadic gives 3 swatches', harmony('#3569A4', 'triadic').length === 3);
  t.check('complementary of red is cyan', JSON.stringify(harmony('#FF0000', 'complementary')) === '["#FF0000","#00FFFF"]', JSON.stringify(harmony('#FF0000', 'complementary')));
  t.check('triadic of red is red, green, blue', JSON.stringify(harmony('#FF0000', 'triadic')) === '["#FF0000","#00FF00","#0000FF"]', JSON.stringify(harmony('#FF0000', 'triadic')));
  const [h, s, v] = rgbToHsv(0.2, 0.4, 0.6);
  const back = hsvToRgb(h, s, v);
  t.check('HSV round-trips', back.every((x, i) => Math.abs(x - [0.2, 0.4, 0.6][i]) < 1e-12), JSON.stringify(back));
  t.check('each swatch carries its ratio and AA verdicts', palette('#3569A4', 'analogous').swatches.every((w) => typeof w.contrast === 'number' && typeof w.normal_text_AA === 'boolean'));
  t.exit('dark monochromatic palette on white passes --require-aa', t.run('visual/harmony.mjs', ['--base', '#1F3A5F', '--mode', 'monochromatic', '--background', '#FFFFFF', '--require-aa']), 0);
  const red = t.exit('planted pale base goes red under --require-aa', t.run('visual/harmony.mjs', ['--base', '#C8D8F0', '--mode', 'triadic', '--background', '#FFFFFF', '--require-aa']), 1);
  t.check('the verdict names the swatches below 4.5:1', /^FAIL 0 of 3/m.test(red.stdout), (red.stdout.match(/^(PASS|FAIL).*$/m) || ['none'])[0]);
  t.exit('a malformed colour exits 2', t.run('visual/harmony.mjs', ['--base', 'blue']), 2);
});
