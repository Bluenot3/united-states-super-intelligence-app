export type CohortFilter = 'all' | '2024' | '2025' | '2026' | '2027';
export interface OutcomeFilters {
  cohort: CohortFilter;
  track: string;
  jurisdiction: string;
  delivery: string;
}

export const DEFAULT_FILTERS: Readonly<OutcomeFilters> = Object.freeze({ cohort: 'all', track: 'all', jurisdiction: 'all', delivery: 'all' });
export const SEALED_UNTIL = '2027-03-30T04:00:00.000Z';
export const STAGE_LABELS = [
  'Enrolled, no environment',
  'Cloud environment provisioned',
  'First live deploy',
  'AI in production',
  'Persistent data + auth',
  'Public launch + custom domain',
  'Iterated on user telemetry',
  'Capstone + credential',
] as const;
export const TIER_LABELS = ['No credential', 'Deployer', 'Builder', 'Operator', 'AI Pioneer'] as const;
const TIER_OF = [0, 0, 1, 1, 2, 2, 3, 4] as const;
export const ASSESSMENT_CONSTRUCTS = [
  { key: 'Found', label: 'AI Foundations' },
  { key: 'Prompt', label: 'Prompt & Context Engineering' },
  { key: 'DeployOps', label: 'Build & Deploy Operations' },
  { key: 'DataPriv', label: 'Data & Privacy' },
  { key: 'Ethics', label: 'AI Ethics & Governance' },
] as const;

export interface OutcomeMeta {
  n: number;
  layout: [string, 'u8' | 'u16', number][];
  dict: Record<string, (string | number)[]>;
  sites: [string, string, string, number][];
}
export interface OutcomeSource {
  schemaVersion: number;
  version: string;
  sourceKind: 'modeled';
  title: string;
  sourceDocument: string;
  sourceUrl: string;
  sourceDocumentSha256: string;
  packedGzipSha256: string;
  unpackedSha256: string;
  rows: number;
  cohorts: number[];
  cohortCounts: Record<string, number>;
  generator: string;
  seed: number;
  releasedAt: string | null;
  sealedCohort: number;
  sealedUntil: string;
  disclosure: string;
  limitations: string[];
}
export interface OutcomesDataset {
  meta: OutcomeMeta;
  columns: Record<string, Uint8Array | Uint16Array>;
  source: OutcomeSource;
}
export interface FilterOption { value: string; label: string; disabled?: boolean }
export interface OutcomeKpi {
  id: 'students' | 'deployment' | 'launch' | 'capstone' | 'deployDays' | 'audience' | 'live90' | 'assessment';
  label: string;
  value: number | null;
  formatted: string;
  unit: 'students' | 'percent' | 'days' | 'users' | 'points';
  detail: string;
  definition: string;
  numerator?: number;
  denominator?: number;
}
export interface CohortRow {
  year: number;
  selected: boolean;
  students: number;
  sites: number;
  jurisdictions: number;
  deployed: number;
  deploymentRate: number | null;
  launched: number;
  launchRate: number | null;
  capstones: number;
  capstoneRate: number | null;
  live90: number;
  live90Rate: number | null;
  users30d: number;
  productionDeploys: number;
  medianDaysToDeploy: number | null;
  meanDaysToDeploy: number | null;
  meanGain: number | null;
  meanPre: number | null;
  meanPost: number | null;
  attendanceRate: number | null;
  meanUptime: number | null;
  arsenalHostingRate: number | null;
}
export interface OutcomeSummary {
  source: OutcomeSource;
  filters: OutcomeFilters;
  students: number;
  sites: number;
  jurisdictions: number;
  deployed: number;
  launched: number;
  capstones: number;
  users30d: number;
  live90: number;
  productionDeploys: number;
  medianDaysToDeploy: number | null;
  meanDaysToDeploy: number | null;
  meanGain: number | null;
  meanPre: number | null;
  meanPost: number | null;
  standardizedGain: number | null;
  kpis: OutcomeKpi[];
  cohorts: CohortRow[];
  stages: { stage: number; label: string; count: number; atOrAbove: number; rate: number | null; tier: number }[];
  tiers: { tier: number; label: string; count: number; rate: number | null }[];
  assessments: { key: string; label: string; pre: number | null; post: number | null; gain: number | null }[];
  deployDays: { days: number; count: number }[];
  hosting: { name: string; count: number; rate: number | null; live90: number; meanUptime: number | null }[];
  tracks: { name: string; students: number; deployed: number; capstones: number; rate: number | null }[];
  jurisdictionRows: { code: string; students: number; deployed: number; capstones: number; users30d: number; deploymentRate: number | null; capstoneRate: number | null; meanGain: number | null; selected: boolean }[];
}

const REQUIRED_COLUMNS = ['cohort', 'track', 'state', 'delivery', 'site', 'stage', 'days', 'users', 'deploys', 'live90', 'host', 'uptime', 'att', 'pre_total', 'post_total', ...ASSESSMENT_CONSTRUCTS.flatMap(item => [`pre_${item.key}`, `post_${item.key}`])];

/** Decode the original column layout without evaluating or copying reference HTML code. */
export function decodePackedOutcomes(meta: OutcomeMeta, bytes: Uint8Array, source: OutcomeSource): OutcomesDataset {
  if (!Number.isSafeInteger(meta.n) || meta.n < 0 || source.sourceKind !== 'modeled' || source.rows !== meta.n) throw new Error('Invalid modeled outcomes metadata.');
  const raw = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const columns: OutcomesDataset['columns'] = {};
  for (const [name, type, offset] of meta.layout) {
    const width = type === 'u8' ? 1 : type === 'u16' ? 2 : 0;
    if (!width || !Number.isSafeInteger(offset) || offset < 0 || offset % width || offset + meta.n * width > raw.byteLength || columns[name]) throw new Error(`Invalid modeled outcomes column: ${name}`);
    columns[name] = type === 'u8' ? new Uint8Array(raw, offset, meta.n) : new Uint16Array(raw, offset, meta.n);
  }
  for (const name of REQUIRED_COLUMNS) if (!columns[name]) throw new Error(`Missing modeled outcomes column: ${name}`);
  return { meta, columns, source };
}

async function checkedFetch(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load the local modeled outcomes dataset (${response.status}).`);
  return response;
}

/** Load local public assets. No provider API, browser key or external runtime is required. */
export async function loadOutcomes(baseUrl = '/data'): Promise<OutcomesDataset> {
  const [metaResponse, packedResponse, sourceResponse] = await Promise.all([
    checkedFetch(`${baseUrl}/outcomes.meta.json`), checkedFetch(`${baseUrl}/outcomes.pack.gz`), checkedFetch(`${baseUrl}/outcomes.source.json`),
  ]);
  const [meta, source, packed] = await Promise.all([metaResponse.json() as Promise<OutcomeMeta>, sourceResponse.json() as Promise<OutcomeSource>, packedResponse.arrayBuffer()]);
  const bytes = new Uint8Array(packed);
  // Static hosts may apply HTTP gzip decoding. Decompress only when the file still has gzip magic bytes.
  let decoded: Uint8Array;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decode the modeled dataset. Use a current browser.');
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
    decoded = new Uint8Array(await new Response(stream).arrayBuffer());
  } else decoded = bytes;
  return decodePackedOutcomes(meta, decoded, source);
}

export function getFilterOptions(dataset: OutcomesDataset) {
  const options = (key: string): FilterOption[] => [{ value: 'all', label: `All ${key === 'state' ? 'jurisdictions' : key === 'delivery' ? 'delivery modes' : 'tracks'}` }, ...dataset.meta.dict[key].map(value => ({ value: String(value), label: String(value) }))];
  return {
    cohort: [{ value: 'all', label: 'All cohorts' }, ...dataset.source.cohorts.map(year => ({ value: String(year), label: String(year) })), { value: '2027', label: '2027 · sealed', disabled: true }] as FilterOption[],
    track: options('track'),
    jurisdiction: options('state'),
    delivery: options('delivery'),
  };
}

const divide = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
const countFormat = new Intl.NumberFormat('en-US');
const countText = (value: number) => countFormat.format(value);
const percentText = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const medianDays = (histogram: number[], total: number): number | null => {
  if (!total) return null;
  const first = Math.floor((total - 1) / 2), second = Math.floor(total / 2);
  let seen = 0, left = 0;
  for (let days = 0; days < histogram.length; days++) {
    seen += histogram[days];
    if (seen > first && seen - histogram[days] <= first) left = days;
    if (seen > second) return (left + days) / 2;
  }
  return null;
};

interface Accumulator {
  n: number; dep: number; launch: number; cap: number; live90: number; users: number; deploys: number;
  pre: number; post: number; preSq: number; postSq: number; gain: number; attendance: number; uptime: number; arsenal: number;
  sites: Set<number>; jurisdictions: Set<number>; days: number[]; stages: number[]; preConstruct: number[]; postConstruct: number[];
}
function newAccumulator(): Accumulator {
  return { n: 0, dep: 0, launch: 0, cap: 0, live90: 0, users: 0, deploys: 0, pre: 0, post: 0, preSq: 0, postSq: 0, gain: 0, attendance: 0, uptime: 0, arsenal: 0, sites: new Set(), jurisdictions: new Set(), days: Array<number>(256).fill(0), stages: Array<number>(8).fill(0), preConstruct: Array<number>(5).fill(0), postConstruct: Array<number>(5).fill(0) };
}
function addRecord(a: Accumulator, columns: OutcomesDataset['columns'], i: number) {
  const stage = columns.stage[i], pre = columns.pre_total[i] / 10, post = columns.post_total[i] / 10;
  a.n++; a.stages[stage]++; a.pre += pre; a.post += post; a.preSq += pre * pre; a.postSq += post * post; a.gain += post - pre; a.attendance += columns.att[i];
  a.sites.add(columns.site[i]); a.jurisdictions.add(columns.state[i]);
  for (let j = 0; j < ASSESSMENT_CONSTRUCTS.length; j++) {
    const key = ASSESSMENT_CONSTRUCTS[j].key;
    a.preConstruct[j] += columns[`pre_${key}`][i] / 10; a.postConstruct[j] += columns[`post_${key}`][i] / 10;
  }
  if (stage >= 2) {
    a.dep++; a.days[columns.days[i]]++; a.users += columns.users[i]; a.deploys += columns.deploys[i]; a.uptime += columns.uptime[i] / 100;
    if (columns.live90[i] === 1) a.live90++;
    if (columns.host[i] === 0) a.arsenal++;
  }
  if (stage >= 5) a.launch++;
  if (stage === 7) a.cap++;
}
function rowFromAccumulator(a: Accumulator, year: number, selected: boolean): CohortRow {
  const totalDays = a.days.reduce((sum, n, day) => sum + n * day, 0);
  return { year, selected, students: a.n, sites: a.sites.size, jurisdictions: a.jurisdictions.size, deployed: a.dep, deploymentRate: divide(a.dep, a.n), launched: a.launch, launchRate: divide(a.launch, a.n), capstones: a.cap, capstoneRate: divide(a.cap, a.n), live90: a.live90, live90Rate: divide(a.live90, a.dep), users30d: a.users, productionDeploys: a.deploys, medianDaysToDeploy: medianDays(a.days, a.dep), meanDaysToDeploy: divide(totalDays, a.dep), meanGain: divide(a.gain, a.n), meanPre: divide(a.pre, a.n), meanPost: divide(a.post, a.n), attendanceRate: divide(a.attendance, a.n * 24), meanUptime: divide(a.uptime, a.dep), arsenalHostingRate: divide(a.arsenal, a.dep) };
}
function filterIndex(dataset: OutcomesDataset, key: string, selected: string) {
  if (selected === 'all') return -1;
  const index = dataset.meta.dict[key].findIndex(value => String(value) === selected);
  if (index < 0) throw new Error(`Unknown ${key} filter: ${selected}`);
  return index;
}

/** Every aggregate derives from the same filtered packed records; no illustrative metric constants. */
export function aggregateOutcomes(dataset: OutcomesDataset, requestedFilters: Partial<OutcomeFilters> = {}): OutcomeSummary {
  const filters: OutcomeFilters = { ...DEFAULT_FILTERS, ...requestedFilters };
  if (!['all', '2024', '2025', '2026', '2027'].includes(filters.cohort)) throw new Error(`Unknown cohort filter: ${filters.cohort}`);
  const track = filterIndex(dataset, 'track', filters.track), jurisdiction = filterIndex(dataset, 'state', filters.jurisdiction), delivery = filterIndex(dataset, 'delivery', filters.delivery);
  const selectedYear = filters.cohort === 'all' ? -1 : Number(filters.cohort);
  const c = dataset.columns, main = newAccumulator();
  const cohortAccumulators = new Map(dataset.source.cohorts.map(year => [year, newAccumulator()]));
  const jurisdictionAccumulators = dataset.meta.dict.state.map(() => newAccumulator());
  const hostAccumulators = dataset.meta.dict.hosting.map(() => ({ count: 0, live90: 0, uptime: 0 }));
  const trackAccumulators = dataset.meta.dict.track.map(() => ({ students: 0, deployed: 0, capstones: 0 }));
  for (let i = 0; i < dataset.meta.n; i++) {
    const year = Number(dataset.meta.dict.cohort[c.cohort[i]]);
    // The local preview source does not publish 2027. A future source needs an explicit reviewed release.
    if (!cohortAccumulators.has(year)) continue;
    if ((track >= 0 && c.track[i] !== track) || (delivery >= 0 && c.delivery[i] !== delivery)) continue;
    const cohortMatches = selectedYear < 0 || year === selectedYear;
    const jurisdictionMatches = jurisdiction < 0 || c.state[i] === jurisdiction;
    if (jurisdictionMatches) addRecord(cohortAccumulators.get(year)!, c, i);
    if (cohortMatches) addRecord(jurisdictionAccumulators[c.state[i]], c, i);
    if (!cohortMatches || !jurisdictionMatches) continue;
    addRecord(main, c, i);
    const t = trackAccumulators[c.track[i]]; t.students++; if (c.stage[i] >= 2) t.deployed++; if (c.stage[i] === 7) t.capstones++;
    if (c.stage[i] >= 2) { const h = hostAccumulators[c.host[i]]; h.count++; h.uptime += c.uptime[i] / 100; if (c.live90[i] === 1) h.live90++; }
  }
  const result = rowFromAccumulator(main, selectedYear, true);
  let standardizedGain: number | null = null;
  if (main.n > 1) {
    const preMean = main.pre / main.n, postMean = main.post / main.n;
    const preVariance = Math.max(0, (main.preSq - main.n * preMean * preMean) / (main.n - 1));
    const postVariance = Math.max(0, (main.postSq - main.n * postMean * postMean) / (main.n - 1));
    const pooledSd = Math.sqrt((preVariance + postVariance) / 2);
    if (pooledSd) standardizedGain = (postMean - preMean) / pooledSd;
  }
  const kpis: OutcomeKpi[] = [
    { id: 'students', label: 'Students in view', value: main.n, formatted: countText(main.n), unit: 'students', detail: `${main.sites.size} sites · ${main.jurisdictions.size} jurisdictions`, definition: 'All modeled student records matching the selected filters.' },
    { id: 'deployment', label: 'Shipped a live URL', value: result.deploymentRate, formatted: percentText(result.deploymentRate), unit: 'percent', detail: `${countText(main.dep)} modeled deployments`, definition: 'Students reaching stage S2 or higher divided by all students in view.', numerator: main.dep, denominator: main.n },
    { id: 'launch', label: 'Public launch + custom domain', value: result.launchRate, formatted: percentText(result.launchRate), unit: 'percent', detail: `${countText(main.launch)} modeled launches`, definition: 'Students reaching stage S5 or higher divided by all students in view.', numerator: main.launch, denominator: main.n },
    { id: 'capstone', label: 'Capstone · Tier 4 AI Pioneer', value: result.capstoneRate, formatted: percentText(result.capstoneRate), unit: 'percent', detail: `${countText(main.cap)} modeled capstones`, definition: 'Students reaching stage S7 divided by all students in view.', numerator: main.cap, denominator: main.n },
    { id: 'deployDays', label: 'Median days to first deploy', value: result.medianDaysToDeploy, formatted: result.medianDaysToDeploy === null ? '—' : String(result.medianDaysToDeploy), unit: 'days', detail: result.meanDaysToDeploy === null ? 'No deployed apps in view' : `Mean ${result.meanDaysToDeploy.toFixed(1)} days`, definition: 'Median enrollment-to-first-live-URL days among S2+ students only.', denominator: main.dep },
    { id: 'audience', label: 'App audience reach, 30-day', value: main.users, formatted: countText(main.users), unit: 'users', detail: `Summed across ${countText(main.dep)} modeled apps`, definition: 'Sum of each deployed app’s 30-day users. People are not deduplicated across apps.' },
    { id: 'live90', label: 'Apps still live at 90 days', value: result.live90Rate, formatted: percentText(result.live90Rate), unit: 'percent', detail: `${countText(main.live90)} of ${countText(main.dep)} shipped apps`, definition: 'S2+ apps modeled live at 90 days divided by S2+ apps only.', numerator: main.live90, denominator: main.dep },
    { id: 'assessment', label: 'Mean assessment gain', value: result.meanGain, formatted: result.meanGain === null ? '—' : `${result.meanGain >= 0 ? '+' : ''}${result.meanGain.toFixed(1)}`, unit: 'points', detail: standardizedGain === null ? 'No comparison group' : `Standardized ${standardizedGain.toFixed(2)} · no comparison group`, definition: 'Mean student post-total minus pre-total, in 0–100 score points. Descriptive, not causal.', denominator: main.n },
  ];
  return {
    source: dataset.source, filters, students: main.n, sites: main.sites.size, jurisdictions: main.jurisdictions.size, deployed: main.dep, launched: main.launch, capstones: main.cap, users30d: main.users, live90: main.live90, productionDeploys: main.deploys, medianDaysToDeploy: result.medianDaysToDeploy, meanDaysToDeploy: result.meanDaysToDeploy, meanGain: result.meanGain, meanPre: result.meanPre, meanPost: result.meanPost, standardizedGain, kpis,
    cohorts: [...cohortAccumulators].map(([year, a]) => rowFromAccumulator(a, year, selectedYear === year)),
    stages: main.stages.map((count, stage) => { const atOrAbove = main.stages.slice(stage).reduce((sum, value) => sum + value, 0); return { stage, label: STAGE_LABELS[stage], count, atOrAbove, rate: divide(atOrAbove, main.n), tier: TIER_OF[stage] }; }),
    tiers: TIER_LABELS.map((label, tier) => { const count = main.stages.reduce((sum, value, stage) => sum + (TIER_OF[stage] === tier ? value : 0), 0); return { tier, label, count, rate: divide(count, main.n) }; }),
    assessments: ASSESSMENT_CONSTRUCTS.map(({ key, label }, j) => ({ key, label, pre: divide(main.preConstruct[j], main.n), post: divide(main.postConstruct[j], main.n), gain: divide(main.postConstruct[j] - main.preConstruct[j], main.n) })),
    deployDays: main.days.map((count, days) => ({ days, count })).filter(row => row.count > 0),
    hosting: hostAccumulators.map((h, i) => ({ name: String(dataset.meta.dict.hosting[i]), count: h.count, rate: divide(h.count, main.dep), live90: h.live90, meanUptime: divide(h.uptime, h.count) })),
    tracks: trackAccumulators.map((t, i) => ({ name: String(dataset.meta.dict.track[i]), ...t, rate: divide(t.students, main.n) })),
    jurisdictionRows: jurisdictionAccumulators.map((a, i) => ({ code: String(dataset.meta.dict.state[i]), students: a.n, deployed: a.dep, capstones: a.cap, users30d: a.users, deploymentRate: divide(a.dep, a.n), capstoneRate: divide(a.cap, a.n), meanGain: divide(a.gain, a.n), selected: i === jurisdiction })).filter(row => row.students > 0).sort((a, b) => b.students - a.students),
  };
}

/** Aggregate-only export. No record IDs, protected learner data or raw packed columns. */
export function createAggregateExport(summary: OutcomeSummary) {
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), source: summary.source, filters: summary.filters, totals: { students: summary.students, sites: summary.sites, jurisdictions: summary.jurisdictions, deployed: summary.deployed, launched: summary.launched, capstones: summary.capstones, live90: summary.live90, users30d: summary.users30d, productionDeploys: summary.productionDeploys, medianDaysToDeploy: summary.medianDaysToDeploy, meanGain: summary.meanGain }, kpis: summary.kpis, cohorts: summary.cohorts, stages: summary.stages, tiers: summary.tiers, assessments: summary.assessments, deployDays: summary.deployDays, hosting: summary.hosting, tracks: summary.tracks, jurisdictions: summary.jurisdictionRows };
}
export function downloadAggregateJson(summary: OutcomeSummary): void {
  const blob = new Blob([`${JSON.stringify(createAggregateExport(summary), null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `ussi-modeled-impact-${summary.filters.cohort}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
