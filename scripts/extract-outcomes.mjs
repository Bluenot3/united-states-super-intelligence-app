import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = process.argv[2] ?? 'C:/Users/AlexT/Downloads/AI Pioneer Outcomes Explorer (1).html';
const sourceBytes = await readFile(sourcePath);
const html = sourceBytes.toString('utf8');
// Parse reference data only. Never evaluate the reference document's JavaScript.
const metaMatch = html.match(/window\.AIP_META\s*=\s*(\{[^\r\n]+\});/);
const blobMatch = html.match(/window\.AIP_BLOB\s*=\s*"([A-Za-z0-9+/=]+)";/);
if (!metaMatch || !blobMatch) throw new Error('The reference does not contain the expected embedded modeled dataset.');
const meta = JSON.parse(metaMatch[1]);
const gzip = Buffer.from(blobMatch[1], 'base64');
const raw = gunzipSync(gzip);
if (meta.n !== 34300 || !Array.isArray(meta.layout) || meta.layout.length !== 40) {
  throw new Error('Unexpected reference dataset shape; review the new source before replacing the published preview.');
}
for (const [name, type, offset] of meta.layout) {
  const width = type === 'u8' ? 1 : type === 'u16' ? 2 : 0;
  if (!width || !Number.isInteger(offset) || offset < 0 || offset + meta.n * width > raw.byteLength) {
    throw new Error(`Invalid packed column: ${name}`);
  }
}
const hash = value => createHash('sha256').update(value).digest('hex');
const provenance = {
  schemaVersion: 1,
  version: 'aip-modeled-2024-2026-v1',
  sourceKind: 'modeled',
  title: 'AI Pioneer Program — modeled outcomes',
  sourceDocument: path.basename(sourcePath),
  sourceUrl: 'https://huggingface.co/datasets/ZENLLC/ai-pioneer-program-modeled-outcomes',
  sourceDocumentSha256: hash(sourceBytes),
  packedGzipSha256: hash(gzip),
  unpackedSha256: hash(raw),
  rows: meta.n,
  cohorts: [2024, 2025, 2026],
  cohortCounts: { 2024: 6200, 2025: 11300, 2026: 16800 },
  generator: 'NumPy PCG64',
  seed: 20270101,
  releasedAt: null,
  sealedCohort: 2027,
  sealedUntil: '2027-03-30T04:00:00.000Z',
  disclosure: 'Every record is synthetic. No figure is an observed program result. No record describes a real child, site, facilitator or app.',
  limitations: [
    'Cohort improvement is a model assumption, not an observed finding.',
    'Pre/post assessment gains are descriptive and have no comparison group.',
    'App audience reach sums per-app users and is not deduplicated across apps.',
    'Synthetic site codes must not be mapped to real clubs or addresses.',
    'The 2027 cohort and 2026 retention into 2027 are unavailable in this embedded source.',
  ],
};
const destination = path.join(root, 'public', 'data');
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, 'outcomes.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
await writeFile(path.join(destination, 'outcomes.pack.gz'), gzip);
await writeFile(path.join(destination, 'outcomes.source.json'), `${JSON.stringify(provenance, null, 2)}\n`);
console.log(JSON.stringify({ rows: meta.n, columns: meta.layout.length, compressedBytes: gzip.length, rawBytes: raw.length, sourceKind: provenance.sourceKind, destination }, null, 2));
