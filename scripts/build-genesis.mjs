// Builds the self-contained USSI Genesis observatory: one HTML file with the exact packed dataset inlined.
// Usage: node scripts/build-genesis.mjs
// Writes public/genesis/index.html (full document for static hosting) and genesis/dist/ussi-genesis.html (body-only page for artifact hosts).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'genesis', 'src');
const app = readdirSync(srcDir).filter(f => f.endsWith('.js')).sort().map(f => `// ---- ${f} ----\n${readFileSync(join(srcDir, f), 'utf8')}`).join('\n');
const meta = readFileSync(join(root, 'public/data/outcomes.meta.json'), 'utf8').trim();
const source = JSON.parse(readFileSync(join(root, 'public/data/outcomes.source.json'), 'utf8'));
const pack = readFileSync(join(root, 'public/data/outcomes.pack.gz'));
const sha = createHash('sha256').update(pack).digest('hex');
if (sha !== source.packedGzipSha256) throw new Error(`Packed dataset hash mismatch: ${sha}`);
const b64 = pack.toString('base64').replace(/.{1,120}/g, m => m + '\n');
const html = readFileSync(join(root, 'genesis', 'template.html'), 'utf8')
  .replace('__META__', () => meta.replace(/</g, '\\u003c'))
  .replace('__SOURCE__', () => JSON.stringify(source).replace(/</g, '\\u003c'))
  .replace('__PACK__', () => b64)
  .replace('__APP__', () => app);
const full = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
for (const [file, body] of [['public/genesis/index.html', full], ['genesis/dist/ussi-genesis.html', html]]) {
  const out = join(root, file); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, body);
  console.log(`USSI Genesis → ${file} (${(body.length / 1048576).toFixed(2)} MB, dataset ${sha.slice(0, 12)}… verified)`);
}
