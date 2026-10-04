import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aggregateOutcomes, decodePackedOutcomes } from '../src/lib/outcomes.ts';
import { selectOutcomeRecords, enrollmentDate, firstDeploymentDate, exploreImpact, enrolledThrough, credentialTierFromStage, createImpactExplorationExport } from '../src/lib/impact-exploration.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'public/data');
const [metaText, gzip, sourceText] = await Promise.all([
  readFile(path.join(folder, 'outcomes.meta.json'), 'utf8'), readFile(path.join(folder, 'outcomes.pack.gz')),
  readFile(path.join(folder, 'outcomes.source.json'), 'utf8'),
]);
const dataset = decodePackedOutcomes(JSON.parse(metaText), gunzipSync(gzip), JSON.parse(sourceText));
const c = dataset.columns, sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const approximate = (actual, expected, label) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
const all = exploreImpact(dataset), summary = aggregateOutcomes(dataset);

assert.equal(all.totalSelected, 34300);
assert.equal(all.totalContext, 34300);
assert.equal(all.timeline.at(-1).cumulativeLearners, 34300, 'Enrollment events reconcile to all records');
assert.equal(all.timeline.at(-1).cumulativeDeployments, 28276, 'Derived deployment events reconcile to S2+ only');
assert.equal(sum(all.timeline, 'newLearners'), 34300);
assert.equal(sum(all.timeline, 'newDeployments'), 28276);
assert.equal(all.temporal.enrollmentStart, '2024-09-09');
assert.equal(all.temporal.enrollmentEnd, '2026-11-10');
assert.equal(all.temporal.deploymentEnd, '2026-12-02');
assert.equal(all.temporal.sourceEnd, '2026-12-02');
assert.match(all.temporal.note, /event dates are unavailable/);
assert.deepEqual(all.enrollmentMonths.map(row => [row.month, row.newLearners]), [
  ['2024-09', 2113], ['2024-10', 3067], ['2024-11', 1020],
  ['2025-09', 3853], ['2025-10', 5611], ['2025-11', 1836],
  ['2026-09', 5939], ['2026-10', 8100], ['2026-11', 2761],
], 'Calendar month counts come from exact packed day offsets');
assert.deepEqual(enrolledThrough(all, '2026-10-04'), { context: 24470, selected: 24470 });
assert.equal(all.totalContext - enrolledThrough(all, '2026-10-04').context, 9830, 'Future modeled joins stay visibly distinct');
assert.deepEqual(enrolledThrough(all, '2024-01-01'), { context: 0, selected: 0 });
assert.deepEqual(enrolledThrough(all, '2028-01-01'), { context: 34300, selected: 34300 });
assert.throws(() => enrolledThrough(all, '2026-02-30'), /valid ISO calendar day/);
assert.throws(() => enrolledThrough(all, '2026-10-04T12:00:00Z'), /valid ISO calendar day/);
assert.ok(all.timeline.every((row, i) => !i || row.date > all.timeline[i - 1].date), 'Chronological distinct event days');
assert.ok(!all.timeline.some(row => row.newLearners === 0 && row.newDeployments === 0), 'No invented date events');
assert.ok(!('newCapstones' in all.timeline[0]), 'Unknown stage/credential event dates are not fabricated');

// Independently reconstruct every dated event directly from the two temporal source fields.
const expectedEvents = new Map();
for (let i = 0; i < dataset.meta.n; i++) {
  const year = Number(dataset.meta.dict.cohort[c.cohort[i]]);
  const milliseconds = Date.UTC(year, 8, 9 + c.eday[i]);
  const joined = new Date(milliseconds).toISOString().slice(0, 10);
  assert.equal(enrollmentDate(dataset, i), joined);
  const bump = (date, field) => { const row = expectedEvents.get(date) || { newLearners: 0, newDeployments: 0 }; row[field]++; expectedEvents.set(date, row); };
  bump(joined, 'newLearners');
  if (c.stage[i] >= 2) {
    const deployed = new Date(milliseconds + c.days[i] * 86400000).toISOString().slice(0, 10);
    assert.equal(firstDeploymentDate(dataset, i), deployed); bump(deployed, 'newDeployments');
  } else assert.equal(firstDeploymentDate(dataset, i), null);
}
assert.equal(all.timeline.length, expectedEvents.size);
for (const row of all.timeline) assert.deepEqual({ newLearners: row.newLearners, newDeployments: row.newDeployments }, expectedEvents.get(row.date), `Exact event counts on ${row.date}`);

for (const row of all.cohortStages) {
  const cohort = aggregateOutcomes(dataset, { cohort: String(row.year) });
  assert.equal(row.students, cohort.students);
  assert.deepEqual(row.counts, cohort.stages.map(stage => stage.count), `Highest-stage partition for ${row.year}`);
  assert.equal(row.counts.reduce((total, count) => total + count, 0), row.students);
}
assert.equal(sum(all.cohortHosting, 'deployed'), summary.deployed);
assert.deepEqual(all.hosting, summary.hosting);
assert.deepEqual(all.tiers, summary.tiers);
for (let i = 0; i < all.hosting.length; i++) assert.equal(all.cohortHosting.reduce((total, row) => total + row.counts[i], 0), all.hosting[i].count);
for (const track of all.tracks) {
  const grouped = aggregateOutcomes(dataset, { track: track.name });
  assert.equal(track.students, grouped.students); assert.equal(track.deployed, grouped.deployed); assert.equal(track.capstones, grouped.capstones);
  assert.deepEqual(track.tierCounts, grouped.tiers.map(tier => tier.count));
  assert.deepEqual(track.hostingCounts, grouped.hosting.map(host => host.count));
  approximate(track.meanGain, grouped.meanGain, `${track.name} score scale`);
}
for (const key of ['students', 'deployed', 'launched', 'capstones', 'live90']) assert.equal(sum(all.sites, key), summary[key], `Sites reconcile ${key}`);
assert.equal(all.sites.length, 163);
assert.equal(all.assessment.pre.count, 34300);
approximate(all.assessment.pre.mean, summary.meanPre, 'Pre scores divide packed values by 10');
approximate(all.assessment.post.mean, summary.meanPost, 'Post scores divide packed values by 10');
approximate(all.assessment.gain.mean, summary.meanGain, 'Gain stays in score points');
for (const construct of all.constructs) {
  assert.equal(construct.preBins.length, 50); assert.equal(construct.postBins.length, 50);
  assert.equal(sum(construct.preBins, 'count'), 34300); assert.equal(sum(construct.postBins, 'count'), 34300);
  assert.ok(construct.preBins.every((bin, i) => bin.from === i * 2 && bin.to === (i + 1) * 2 && bin.upperInclusive === (i === 49)), 'Exact two-point bins');
  const canonical = summary.assessments.find(item => item.key === construct.key);
  approximate(construct.pre.mean, canonical.pre, `${construct.key} pre mean`);
  approximate(construct.post.mean, canonical.post, `${construct.key} post mean`);
}

const filters = { cohort: '2025', track: 'Agent Builder', jurisdiction: 'CA', delivery: 'Hybrid' };
const combined = exploreImpact(dataset, filters, { sampleSize: 53 }), combinedSummary = aggregateOutcomes(dataset, filters);
const selected = selectOutcomeRecords(dataset, filters), expectedSelected = [];
const ti = dataset.meta.dict.track.indexOf(filters.track), si = dataset.meta.dict.state.indexOf(filters.jurisdiction), di = dataset.meta.dict.delivery.indexOf(filters.delivery);
for (let i = 0; i < dataset.meta.n; i++) if (dataset.meta.dict.cohort[c.cohort[i]] === 2025 && c.track[i] === ti && c.state[i] === si && c.delivery[i] === di) expectedSelected.push(i);
assert.deepEqual(Array.from(selected), expectedSelected, 'All four filters form one shared intersection');
assert.equal(combined.totalSelected, combinedSummary.students);
assert.equal(combined.totalContext, selectOutcomeRecords(dataset, { ...filters, cohort: 'all' }).length, 'Date/cohort context ignores only the cohort highlight');
assert.equal(combined.timeline.at(-1).selectedCumulativeLearners, combinedSummary.students);
assert.equal(combined.timeline.at(-1).selectedCumulativeDeployments, combinedSummary.deployed);
assert.deepEqual(combined.jurisdictions, combinedSummary.jurisdictionRows);
assert.ok(combined.sites.every(site => site.state === 'CA'), 'Site glyphs respect the jurisdiction filter');
assert.equal(sum(combined.sites, 'students'), combined.totalSelected);
assert.equal(combined.scatter.sampleSize, Math.min(53, combined.totalSelected));

assert.equal(all.scatter.points.length, 1600);
assert.equal(new Set(all.scatter.points.map(point => point.key)).size, 1600, 'Distinct deterministic point keys');
assert.deepEqual(exploreImpact(dataset).scatter.points, all.scatter.points, 'Same source/filter creates identical dense sample');
assert.equal(exploreImpact(dataset, {}, { sampleSize: 9000 }).scatter.points.length, 1600, 'Scatter is bounded without altering exact aggregates');
assert.equal(exploreImpact(dataset, {}, { sampleSize: 0 }).scatter.points.length, 0);
assert.throws(() => exploreImpact(dataset, {}, { sampleSize: NaN }), /finite and nonnegative/);
assert.ok(all.scatter.points.every(point => point.pre >= 0 && point.pre <= 100 && point.post >= 0 && point.post <= 100 && point.attendanceSessions <= 24));
assert.ok(all.scatter.points.filter(point => point.stage < 2).every(point => point.daysToDeploy === null && point.hosting === null && point.users30d === null && point.uptimePercent === null));
assert.ok(all.scatter.points.filter(point => point.stage >= 2).every(point => point.daysToDeploy >= 0 && point.uptimePercent <= 100));

// Correlation uses the entire filtered selection, not the bounded visual sample.
for (const statistic of combined.scatter.correlations) {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const i of expectedSelected) {
    if (statistic.id === 'attendanceDeployDays' && c.stage[i] < 2) continue;
    const x = statistic.id === 'prePost' ? c.pre_total[i] / 10 : c.att[i];
    const y = statistic.id === 'prePost' ? c.post_total[i] / 10 : statistic.id === 'attendanceGain' ? (c.post_total[i] - c.pre_total[i]) / 10 : c.days[i];
    n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  assert.equal(statistic.n, n);
  const denominator = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (n > 1 && denominator > 0) approximate(statistic.r, (n * sxy - sx * sy) / denominator, `${statistic.id} exact selected correlation`);
  else assert.equal(statistic.r, null);
}

// A deliberately small source fixture exercises thresholds and boundary scores,
// rather than merely comparing the helper against another implementation.
const fixtureColumns = Object.fromEntries(Object.entries(c).map(([key, values]) => [key, values.slice(0, 8)]));
fixtureColumns.cohort.fill(0); fixtureColumns.eday.set([0, 1, 2, 3, 4, 5, 6, 7]); fixtureColumns.stage.set([0, 1, 2, 3, 4, 5, 6, 7]);
fixtureColumns.days.set([255, 255, 0, 1, 2, 3, 4, 5]); fixtureColumns.host.set([255, 255, 0, 1, 2, 3, 4, 0]);
fixtureColumns.track.set([0, 0, 1, 1, 2, 2, 3, 3]); fixtureColumns.site.fill(0); fixtureColumns.att.set([0, 24, 12, 18, 8, 16, 20, 24]);
fixtureColumns.pre_total.set([0, 10, 20, 200, 500, 980, 990, 1000]); fixtureColumns.post_total.set([0, 20, 40, 400, 700, 1000, 1000, 1000]);
for (const key of ['Found', 'Prompt', 'DeployOps', 'DataPriv', 'Ethics']) {
  fixtureColumns[`pre_${key}`].set([0, 0, 20, 20, 980, 980, 1000, 1000]); fixtureColumns[`post_${key}`].set([0, 20, 20, 40, 980, 1000, 1000, 1000]);
}
const fixture = { ...dataset, meta: { ...dataset.meta, n: 8 }, source: { ...dataset.source, rows: 8, cohorts: [2024] }, columns: fixtureColumns };
const small = exploreImpact(fixture);
assert.deepEqual(small.cohortStages[0].counts, [1, 1, 1, 1, 1, 1, 1, 1]);
assert.deepEqual(small.tiers.map(tier => tier.count), [2, 2, 2, 1, 1]);
assert.equal(small.timeline.at(-1).cumulativeDeployments, 6, 'Only stages S2+ get deployment events');
assert.equal(small.temporal.deploymentEnd, '2024-09-21', 'Never-deployed day sentinel does not generate a future event');
assert.equal(small.assessment.pre.median, 35); assert.equal(small.assessment.post.median, 55); assert.equal(small.assessment.gain.median, 1.5);
assert.equal(small.constructs[0].preBins[0].count, 2); assert.equal(small.constructs[0].preBins[1].count, 2); assert.equal(small.constructs[0].preBins[49].count, 4, '98 and 100 both belong in final [98,100] bin');
approximate(small.sites[0].attendanceRate, 122 / (8 * 24), 'Attendance glyph normalized by 24 sessions');
assert.deepEqual(small.hosting.map(host => host.count), [2, 1, 1, 1, 1]);
assert.equal(credentialTierFromStage(7), 4); assert.throws(() => credentialTierFromStage(8), /Unknown modeled stage/);
assert.throws(() => enrollmentDate(dataset, -1), /Invalid modeled record index/);

const unavailable = exploreImpact(dataset, { cohort: '2027' });
assert.equal(unavailable.totalSelected, 0); assert.equal(unavailable.totalContext, 34300);
assert.equal(unavailable.timeline.at(-1).selectedCumulativeLearners, 0);
assert.equal(unavailable.assessment.pre.mean, null); assert.equal(unavailable.scatter.points.length, 0);
assert.ok(unavailable.scatter.correlations.every(row => row.n === 0 && row.r === null));
assert.throws(() => selectOutcomeRecords(dataset, { track: 'Invented track' }), /Unknown track filter/);
assert.throws(() => selectOutcomeRecords(dataset, { cohort: '2030' }), /Unknown cohort filter/);
const safeExport = createImpactExplorationExport(combined), encoded = JSON.stringify(safeExport);
assert.ok(!('sites' in safeExport) && !('points' in safeExport.scatter), 'Download remains aggregate-only');
assert.ok(!encoded.includes('siteIndex') && !encoded.includes('sourceIndex') && !encoded.includes('columns'), 'No packed-row identifiers in export');
for (const site of combined.sites) assert.ok(!encoded.includes(site.code), 'Synthetic site source codes are excluded from download');
assert.equal(safeExport.scatter.totalSelected, combined.totalSelected);
console.log('Verified exact daily/monthly modeled chronology, as-of joins, shared four-filter selection, highest-stage/tier/track/hosting/site partitions, score scales and boundary bins, full-selection correlations, stable bounded scatter, sealed-cohort behavior and identifier-free aggregate export.');
