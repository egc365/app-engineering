import { readFileSync, writeFileSync } from 'node:fs';

// Reads esbuild's JSON metafile, never scrapes the human formatted analyzer output.
if (process.argv.length < 4) {
  console.error('Usage: node bundle-report.mjs meta.json report.json');
  process.exit(2);
}
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (!input.inputs || !input.outputs) throw new Error('Expected an esbuild metafile');
const outputs = Object.entries(input.outputs).map(([path, info]) => ({
  path, bytes: info.bytes, entryPoint: info.entryPoint || null,
  inputCount: Object.keys(info.inputs || {}).length,
  imports: (info.imports || []).map(x => x.path),
}));
const report = { inputModules: Object.keys(input.inputs).length,
  outputFiles: outputs.length, totalBytes: outputs.reduce((sum, item) => sum + item.bytes, 0),
  initialEntryBytes: outputs.filter(x => x.entryPoint).reduce((sum, item) => sum + item.bytes, 0),
  outputs: outputs.sort((a, b) => b.bytes - a.bytes) };
writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: process.argv[3], ...report }));
