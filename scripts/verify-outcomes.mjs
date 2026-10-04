import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aggregateOutcomes, createAggregateExport, decodePackedOutcomes, getFilterOptions, loadOutcomes } from '../src/lib/outcomes.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'public', 'data');
const [metaText, gzip, sourceText] = await Promise.all([
  readFile(path.join(folder, 'outcomes.meta.json'), 'utf8'),
  readFile(path.join(folder, 'outcomes.pack.gz')),
  readFile(path.join(folder, 'outcomes.source.json'), 'utf8'),
]);
const meta = JSON.parse(metaText), source = JSON.parse(sourceText), raw = gunzipSync(gzip);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(gzip), source.packedGzipSha256, 'Compressed source fingerprint');
assert.equal(hash(raw), source.unpackedSha256, 'Decoded source fingerprint');
assert.equal(source.sourceKind, 'modeled');
assert.equal(meta.layout.length, 40);
assert.equal(meta.sites.length, 163);
const dataset = decodePackedOutcomes(meta, raw, source), all = aggregateOutcomes(dataset);
const approximate = (actual, expected, message) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
const expectedTotals = { students: 34300, sites: 163, jurisdictions: 40, deployed: 28276, launched: 20079, capstones: 16756, live90: 18078, users30d: 1997650, productionDeploys: 644166, medianDaysToDeploy: 4 };
for (const [key, expected] of Object.entries(expectedTotals)) assert.equal(all[key], expected, `Exact all-cohort ${key}`);
approximate(all.meanGain, 24.196227405247953, 'Exact mean score gain');
approximate(all.meanPre, 36.6334548104952, 'Exact mean pre score');
approximate(all.meanPost, 60.8296822157436, 'Exact mean post score');
assert.equal(all.kpis.length, 8);
const kpi = id => all.kpis.find(value => value.id === id);
assert.equal(kpi('live90').denominator, 28276, '90-day survival uses deployed denominator');
assert.equal(kpi('deployment').denominator, 34300, 'Deployment uses enrolled denominator');
assert.equal(kpi('launch').numerator, 20079);
assert.equal(kpi('capstone').numerator, 16756);
approximate(kpi('deployment').value, 28276 / 34300, 'Deployment rate');
approximate(kpi('live90').value, 18078 / 28276, '90-day survival rate');

const expectedCohorts = [
  { year: 2024, students: 6200, sites: 58, jurisdictions: 16, deployed: 4601, launched: 2964, capstones: 2394, live90: 2705, users30d: 316960, productionDeploys: 97763, medianDaysToDeploy: 8, gain: 21.617483870967718 },
  { year: 2025, students: 11300, sites: 104, jurisdictions: 30, deployed: 9210, launched: 6396, capstones: 5323, live90: 5756, users30d: 636912, productionDeploys: 206738, medianDaysToDeploy: 5, gain: 23.70176991150443 },
  { year: 2026, students: 16800, sites: 163, jurisdictions: 40, deployed: 14465, launched: 10719, capstones: 9039, live90: 9617, users30d: 1043778, productionDeploys: 339665, medianDaysToDeploy: 3, gain: 25.48048809523813 },
];
for (const expected of expectedCohorts) {
  const cohort = aggregateOutcomes(dataset, { cohort: String(expected.year) });
  for (const [key, value] of Object.entries(expected)) {
    if (key === 'year' || key === 'gain') continue;
    assert.equal(cohort[key], value, `Exact ${expected.year} ${key}`);
  }
  approximate(cohort.meanGain, expected.gain, `${expected.year} mean gain`);
  assert.equal(cohort.cohorts.find(row => row.year === expected.year).selected, true);
  assert.deepEqual(cohort.cohorts.map(row => row.students), [6200, 11300, 16800], 'Cohort context ignores selected cohort');
}

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
assert.equal(sum(all.stages, 'count'), 34300, 'Stage partitions account for every learner');
assert.equal(all.stages[2].atOrAbove, 28276);
assert.equal(all.stages[5].atOrAbove, 20079);
assert.equal(all.stages[7].atOrAbove, 16756);
assert.equal(sum(all.tiers, 'count'), 34300);
assert.equal(sum(all.deployDays, 'count'), 28276, 'Deploy-time distribution excludes never-deployed records');
assert.equal(sum(all.hosting, 'count'), 28276);
assert.equal(all.assessments.length, 5);
for (const construct of all.assessments) approximate(construct.gain, construct.post - construct.pre, `${construct.key} construct difference`);

// These partition tests cover meaningful shared-filter behavior against the exact source.
for (const [filter, dictionary] of [['track', 'track'], ['delivery', 'delivery'], ['jurisdiction', 'state']]) {
  const rows = meta.dict[dictionary].map(value => aggregateOutcomes(dataset, { [filter]: value }));
  for (const metric of ['students', 'deployed', 'launched', 'capstones', 'live90', 'users30d', 'productionDeploys']) {
    assert.equal(sum(rows, metric), all[metric], `${filter} partitions preserve ${metric}`);
  }
}
const c = dataset.columns;
const trackIndex = meta.dict.track.indexOf('Agent Builder'), deliveryIndex = meta.dict.delivery.indexOf('Hybrid'), stateIndex = meta.dict.state.indexOf('CA');
let intersection = 0;
for (let i = 0; i < meta.n; i++) if (c.cohort[i] === 1 && c.track[i] === trackIndex && c.delivery[i] === deliveryIndex && c.state[i] === stateIndex) intersection++;
const combined = aggregateOutcomes(dataset, { cohort: '2025', track: 'Agent Builder', delivery: 'Hybrid', jurisdiction: 'CA' });
assert.equal(combined.students, intersection, 'Combined filters intersect rather than overwrite each other');
assert.ok(combined.students > 0 && combined.students < 11300);
assert.equal(sum(combined.stages, 'count'), combined.students);
assert.equal(sum(combined.deployDays, 'count'), combined.deployed);
assert.ok(combined.cohorts.every(row => row.students <= all.cohorts.find(other => row.year === other.year).students));
assert.equal(combined.jurisdictionRows.find(row => row.code === 'CA').students, combined.students);
assert.ok(sum(combined.jurisdictionRows, 'students') > combined.students, 'Jurisdiction ranking keeps context outside the selected jurisdiction');

const unavailable = aggregateOutcomes(dataset, { cohort: '2027' });
assert.equal(unavailable.students, 0, 'Unavailable 2027 records never appear');
for (const id of ['deployment', 'launch', 'capstone', 'deployDays', 'live90', 'assessment']) assert.equal(unavailable.kpis.find(value => value.id === id).value, null, `No-data ${id} is null`);
assert.ok(getFilterOptions(dataset).cohort.find(row => row.value === '2027').disabled);
assert.throws(() => aggregateOutcomes(dataset, { track: 'Invented track' }), /Unknown track filter/);
assert.throws(() => decodePackedOutcomes({ ...meta, layout: [['cohort', 'u16', 1]] }, raw, source), /Invalid modeled outcomes column/);
assert.throws(() => decodePackedOutcomes(meta, raw.subarray(0, 100), source), /Invalid modeled outcomes column/);
const exported = createAggregateExport(combined);
assert.equal(exported.source.sourceKind, 'modeled');
assert.equal(exported.totals.students, combined.students);
assert.equal(exported.kpis.find(value => value.id === 'live90').denominator, combined.deployed);
assert.ok(!('columns' in exported) && !('records' in exported), 'Aggregate export excludes row-level data');

// Exercise the actual fetch/decompression loader with both static-host response shapes.
// These are test-only responses backed by the same real local source assets.
const originalFetch = globalThis.fetch;
try {
  for (const alreadyDecoded of [false, true]) {
    globalThis.fetch = async url => {
      const filename = String(url).split('/').at(-1);
      const body = filename === 'outcomes.meta.json' ? metaText : filename === 'outcomes.source.json' ? sourceText : filename === 'outcomes.pack.gz' ? (alreadyDecoded ? raw : gzip) : null;
      return body === null ? new Response('Missing', { status: 404 }) : new Response(body);
    };
    const loaded = await loadOutcomes('/data');
    assert.equal(aggregateOutcomes(loaded).deployed, 28276, `Fetch loader preserves exact source with ${alreadyDecoded ? 'HTTP-decoded' : 'gzip'} response`);
  }
  globalThis.fetch = async () => new Response('Missing', { status: 404 });
  await assert.rejects(() => loadOutcomes('/missing'), /local modeled outcomes dataset \(404\)/, 'Fetch errors remain visible');
} finally {
  globalThis.fetch = originalFetch;
}
console.log(`Verified exact modeled totals, 3 cohorts, ${meta.dict.track.length + meta.dict.delivery.length + meta.dict.state.length} filter partitions, a ${intersection}-record combined filter, denominator semantics, empty/sealed results, source fingerprints, aggregate-only export and both gzip/static-host loader paths.`);
