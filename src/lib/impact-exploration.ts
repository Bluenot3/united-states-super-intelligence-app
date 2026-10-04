import { aggregateOutcomes, DEFAULT_FILTERS, STAGE_LABELS, TIER_LABELS, ASSESSMENT_CONSTRUCTS, type OutcomeFilters, type OutcomesDataset, type OutcomeSummary } from './outcomes.ts';

export interface DistributionSummary {
  count: number; mean: number | null; median: number | null; p10: number | null; p25: number | null;
  p75: number | null; p90: number | null; min: number | null; max: number | null;
}
export interface ScoreBin { from: number; to: number; upperInclusive: boolean; count: number }
export interface ImpactTimelineRow {
  date: string; year: number; newLearners: number; newDeployments: number;
  cumulativeLearners: number; cumulativeDeployments: number;
  selectedNewLearners: number; selectedNewDeployments: number;
  selectedCumulativeLearners: number; selectedCumulativeDeployments: number;
}
export interface EnrollmentMonth {
  month: string; year: number; newLearners: number; cumulativeLearners: number;
  selectedNewLearners: number; selectedCumulativeLearners: number;
}
export interface StageCohortRow {
  year: number; students: number; selected: boolean; counts: number[];
}
export interface HostingCohortRow { year: number; deployed: number; selected: boolean; counts: number[] }
export interface TrackExplorationRow {
  name: string; students: number; deployed: number; capstones: number; rate: number | null;
  tierCounts: number[]; hostingCounts: number[]; meanGain: number | null;
}
export interface SiteExplorationRow {
  siteIndex: number; code: string; state: string; network: string; year: number;
  students: number; deployed: number; launched: number; capstones: number; live90: number;
  meanGain: number | null; attendanceRate: number | null;
}
export interface ScatterPoint {
  key: string; cohort: number; stage: number; tier: number; track: string;
  attendanceSessions: number; pre: number; post: number; gain: number;
  daysToDeploy: number | null; users30d: number | null; hosting: string | null;
  uptimePercent: number | null; live90: boolean | null;
}
export interface CorrelationStatistic {
  id: 'attendanceGain' | 'prePost' | 'attendanceDeployDays'; label: string;
  xLabel: string; yLabel: string; n: number; r: number | null;
  scope: 'all-selected' | 'selected-deployers';
}
export interface ImpactExploration {
  filters: OutcomeFilters; totalSelected: number; totalContext: number;
  sourceKind: 'modeled';
  temporal: {
    resolution: 'day'; basis: 'modeled-enrollment-and-first-deploy';
    context: 'all-cohorts-under-other-filters';
    enrollmentStart: string | null; enrollmentEnd: string | null;
    deploymentStart: string | null; deploymentEnd: string | null;
    sourceStart: string | null; sourceEnd: string | null;
    note: string;
  };
  timeline: ImpactTimelineRow[]; enrollmentMonths: EnrollmentMonth[];
  cohortStages: StageCohortRow[]; cohortHosting: HostingCohortRow[];
  tiers: OutcomeSummary['tiers']; tracks: TrackExplorationRow[]; hosting: OutcomeSummary['hosting'];
  jurisdictions: OutcomeSummary['jurisdictionRows']; sites: SiteExplorationRow[];
  assessment: { pre: DistributionSummary; post: DistributionSummary; gain: DistributionSummary };
  constructs: {
    key: string; label: string; pre: DistributionSummary; post: DistributionSummary; gain: DistributionSummary;
    preBins: ScoreBin[]; postBins: ScoreBin[];
  }[];
  scatter: { points: ScatterPoint[]; totalSelected: number; sampleSize: number; scope: 'all-selected'; correlations: CorrelationStatistic[] };
}

function resolvedFilters(requested: Partial<OutcomeFilters>): OutcomeFilters {
  const filters = { ...DEFAULT_FILTERS, ...requested };
  if (!['all', '2024', '2025', '2026', '2027'].includes(filters.cohort)) throw new Error(`Unknown cohort filter: ${filters.cohort}`);
  return filters;
}
function dictionaryFilter(dataset: OutcomesDataset, key: string, value: string): number {
  if (value === 'all') return -1;
  const index = dataset.meta.dict[key].findIndex(item => String(item) === value);
  if (index < 0) throw new Error(`Unknown ${key} filter: ${value}`);
  return index;
}

/** Internal packed-row indices, using the same four-filter intersection as aggregateOutcomes. */
export function selectOutcomeRecords(dataset: OutcomesDataset, requested: Partial<OutcomeFilters> = {}): Uint32Array {
  const filters = resolvedFilters(requested);
  const track = dictionaryFilter(dataset, 'track', filters.track);
  const state = dictionaryFilter(dataset, 'state', filters.jurisdiction);
  const delivery = dictionaryFilter(dataset, 'delivery', filters.delivery);
  const year = filters.cohort === 'all' ? null : Number(filters.cohort);
  const published = new Set(dataset.source.cohorts);
  const selected: number[] = [], c = dataset.columns;
  for (let i = 0; i < dataset.meta.n; i++) {
    const cohort = Number(dataset.meta.dict.cohort[c.cohort[i]]);
    if (!published.has(cohort) || (year !== null && cohort !== year)) continue;
    if ((track >= 0 && c.track[i] !== track) || (state >= 0 && c.state[i] !== state) || (delivery >= 0 && c.delivery[i] !== delivery)) continue;
    selected.push(i);
  }
  return Uint32Array.from(selected);
}

/** The attached source's exact modeled date formula, not a guessed calendar distribution. */
export function enrollmentTimestamp(dataset: OutcomesDataset, index: number): number {
  if (!Number.isSafeInteger(index) || index < 0 || index >= dataset.meta.n) throw new RangeError('Invalid modeled record index.');
  if (!dataset.columns.eday) throw new Error('Enrollment day offsets are absent from the modeled source.');
  const year = Number(dataset.meta.dict.cohort[dataset.columns.cohort[index]]);
  return Date.UTC(year, 8, 9 + dataset.columns.eday[index]);
}
export function enrollmentDate(dataset: OutcomesDataset, index: number): string {
  return new Date(enrollmentTimestamp(dataset, index)).toISOString().slice(0, 10);
}
export function firstDeploymentDate(dataset: OutcomesDataset, index: number): string | null {
  const joined = enrollmentTimestamp(dataset, index);
  if (dataset.columns.stage[index] < 2) return null;
  return new Date(joined + dataset.columns.days[index] * 86_400_000).toISOString().slice(0, 10);
}
export function credentialTierFromStage(stage: number): number {
  if (!Number.isInteger(stage) || stage < 0 || stage >= STAGE_LABELS.length) throw new RangeError('Unknown modeled stage.');
  return stage < 2 ? 0 : stage < 4 ? 1 : stage < 6 ? 2 : stage === 6 ? 3 : 4;
}

const divide = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
const earlierDate = (current: string | null, next: string): string => current === null || next < current ? next : current;
const laterDate = (current: string | null, next: string): string => current === null || next > current ? next : current;
function describe(values: number[]): DistributionSummary {
  if (!values.length) return { count: 0, mean: null, median: null, p10: null, p25: null, p75: null, p90: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (fraction: number) => { const position = (sorted.length - 1) * fraction, low = Math.floor(position), high = Math.ceil(position); return sorted[low] + (sorted[high] - sorted[low]) * (position - low); };
  return { count: sorted.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length, median: quantile(.5), p10: quantile(.1), p25: quantile(.25), p75: quantile(.75), p90: quantile(.9), min: sorted[0], max: sorted.at(-1)! };
}
function scoreBins(values: number[]): ScoreBin[] {
  const bins = Array.from({ length: 50 }, (_, i) => ({ from: i * 2, to: (i + 1) * 2, upperInclusive: i === 49, count: 0 }));
  for (const value of values) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError('Modeled assessment is outside the 0–100 score range.');
    bins[Math.min(49, Math.floor(value / 2))].count++;
  }
  return bins;
}

// This reversible 32-bit mix gives stable distinct opaque display keys for source rows.
function rowHash(index: number): number {
  let value = (index + 1) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}
function correlation(dataset: OutcomesDataset, indices: Uint32Array, id: CorrelationStatistic['id']): CorrelationStatistic {
  const c = dataset.columns;
  let n = 0, meanX = 0, meanY = 0, xVariance = 0, yVariance = 0, covariance = 0;
  for (const i of indices) {
    if (id === 'attendanceDeployDays' && c.stage[i] < 2) continue;
    const x = id === 'prePost' ? c.pre_total[i] / 10 : c.att[i];
    const y = id === 'prePost' ? c.post_total[i] / 10 : id === 'attendanceGain' ? (c.post_total[i] - c.pre_total[i]) / 10 : c.days[i];
    n++;
    const dx = x - meanX, dy = y - meanY;
    meanX += dx / n; meanY += dy / n;
    xVariance += dx * (x - meanX); yVariance += dy * (y - meanY); covariance += dx * (y - meanY);
  }
  const r = n > 1 && xVariance > 0 && yVariance > 0 ? Math.max(-1, Math.min(1, covariance / Math.sqrt(xVariance * yVariance))) : null;
  return {
    id, label: id === 'prePost' ? 'Pre / post assessment' : id === 'attendanceGain' ? 'Attendance / assessment gain' : 'Attendance / first-deploy days',
    xLabel: id === 'prePost' ? 'Pre score · 0–100' : 'Sessions attended · 0–24',
    yLabel: id === 'prePost' ? 'Post score · 0–100' : id === 'attendanceGain' ? 'Score gain · points' : 'Days to first deploy',
    n, r, scope: id === 'attendanceDeployDays' ? 'selected-deployers' : 'all-selected',
  };
}

/** All distributions and correlations are exact; only scatter rendering is sampled. */
export function exploreImpact(dataset: OutcomesDataset, requested: Partial<OutcomeFilters> = {}, options: { sampleSize?: number } = {}): ImpactExploration {
  const filters = resolvedFilters(requested), summary = aggregateOutcomes(dataset, filters);
  const selected = selectOutcomeRecords(dataset, filters);
  const context = filters.cohort === 'all' ? selected : selectOutcomeRecords(dataset, { ...filters, cohort: 'all' });
  const c = dataset.columns, dictionary = dataset.meta.dict;
  const cohortStages = dataset.source.cohorts.map(year => ({ year, students: 0, selected: filters.cohort === 'all' || Number(filters.cohort) === year, counts: Array<number>(8).fill(0) }));
  const cohortHosting = dataset.source.cohorts.map(year => ({ year, deployed: 0, selected: filters.cohort === 'all' || Number(filters.cohort) === year, counts: Array<number>(dictionary.hosting.length).fill(0) }));
  const tracks = dictionary.track.map(name => ({ name: String(name), students: 0, deployed: 0, capstones: 0, rate: null as number | null, tierCounts: Array<number>(TIER_LABELS.length).fill(0), hostingCounts: Array<number>(dictionary.hosting.length).fill(0), meanGain: null as number | null, gainSum: 0 }));
  const sites = new Map<number, SiteExplorationRow & { gainSum: number; attendanceSum: number }>();
  const scoreArrays = { pre: [] as number[], post: [] as number[], gain: [] as number[] };
  const constructArrays = ASSESSMENT_CONSTRUCTS.map(construct => ({ ...construct, pre: [] as number[], post: [] as number[], gain: [] as number[] }));
  const events = new Map<string, { newLearners: number; newDeployments: number; selectedNewLearners: number; selectedNewDeployments: number }>();
  const selectedSet = new Set(selected);
  let enrollmentStart: string | null = null, enrollmentEnd: string | null = null, deploymentStart: string | null = null, deploymentEnd: string | null = null;
  const eventAt = (date: string) => {
    let event = events.get(date);
    if (!event) { event = { newLearners: 0, newDeployments: 0, selectedNewLearners: 0, selectedNewDeployments: 0 }; events.set(date, event); }
    return event;
  };
  for (const i of context) {
    const year = Number(dictionary.cohort[c.cohort[i]]), stage = c.stage[i];
    const cohort = cohortStages.find(row => row.year === year)!;
    cohort.students++; cohort.counts[stage]++;
    const joined = enrollmentDate(dataset, i), chosen = selectedSet.has(i), joinedEvent = eventAt(joined);
    joinedEvent.newLearners++; if (chosen) joinedEvent.selectedNewLearners++;
    enrollmentStart = earlierDate(enrollmentStart, joined);
    enrollmentEnd = laterDate(enrollmentEnd, joined);
    const deployed = firstDeploymentDate(dataset, i);
    if (deployed !== null) {
      const cohortHost = cohortHosting.find(row => row.year === year)!;
      cohortHost.deployed++; cohortHost.counts[c.host[i]]++;
      const deployedEvent = eventAt(deployed); deployedEvent.newDeployments++; if (chosen) deployedEvent.selectedNewDeployments++;
      deploymentStart = earlierDate(deploymentStart, deployed);
      deploymentEnd = laterDate(deploymentEnd, deployed);
    }
  }
  for (const i of selected) {
    const pre = c.pre_total[i] / 10, post = c.post_total[i] / 10, gain = (c.post_total[i] - c.pre_total[i]) / 10, stage = c.stage[i];
    scoreArrays.pre.push(pre); scoreArrays.post.push(post); scoreArrays.gain.push(gain);
    for (const item of constructArrays) {
      const before = c[`pre_${item.key}`][i] / 10, after = c[`post_${item.key}`][i] / 10;
      item.pre.push(before); item.post.push(after); item.gain.push((c[`post_${item.key}`][i] - c[`pre_${item.key}`][i]) / 10);
    }
    const track = tracks[c.track[i]];
    track.students++; track.tierCounts[credentialTierFromStage(stage)]++; track.gainSum += gain;
    if (stage >= 2) { track.deployed++; track.hostingCounts[c.host[i]]++; }
    if (stage === 7) track.capstones++;
    const siteIndex = c.site[i];
    let site = sites.get(siteIndex);
    if (!site) {
      const sourceSite = dataset.meta.sites[siteIndex];
      site = { siteIndex, code: sourceSite[0], state: sourceSite[1], network: sourceSite[2], year: sourceSite[3], students: 0, deployed: 0, launched: 0, capstones: 0, live90: 0, meanGain: null, attendanceRate: null, gainSum: 0, attendanceSum: 0 };
      sites.set(siteIndex, site);
    }
    site.students++; site.gainSum += gain; site.attendanceSum += c.att[i];
    if (stage >= 2) { site.deployed++; if (c.live90[i] === 1) site.live90++; }
    if (stage >= 5) site.launched++;
    if (stage === 7) site.capstones++;
  }
  let cumulativeLearners = 0, cumulativeDeployments = 0, selectedCumulativeLearners = 0, selectedCumulativeDeployments = 0;
  const timeline: ImpactTimelineRow[] = [...events].sort(([a], [b]) => a.localeCompare(b)).map(([date, event]) => {
    cumulativeLearners += event.newLearners; cumulativeDeployments += event.newDeployments;
    selectedCumulativeLearners += event.selectedNewLearners; selectedCumulativeDeployments += event.selectedNewDeployments;
    return { date, year: Number(date.slice(0, 4)), ...event, cumulativeLearners, cumulativeDeployments, selectedCumulativeLearners, selectedCumulativeDeployments };
  });
  const months = new Map<string, EnrollmentMonth>();
  for (const row of timeline) {
    if (!row.newLearners) continue;
    const month = row.date.slice(0, 7), previous = months.get(month);
    if (previous) { previous.newLearners += row.newLearners; previous.selectedNewLearners += row.selectedNewLearners; previous.cumulativeLearners = row.cumulativeLearners; previous.selectedCumulativeLearners = row.selectedCumulativeLearners; }
    else months.set(month, { month, year: row.year, newLearners: row.newLearners, cumulativeLearners: row.cumulativeLearners, selectedNewLearners: row.selectedNewLearners, selectedCumulativeLearners: row.selectedCumulativeLearners });
  }
  const requestedSample = options.sampleSize ?? 1600;
  if (!Number.isFinite(requestedSample) || requestedSample < 0) throw new RangeError('Scatter sample size must be finite and nonnegative.');
  const sampleSize = Math.min(selected.length, 1600, Math.floor(requestedSample));
  const sampled = Array.from(selected).map(index => ({ index, hash: rowHash(index) })).sort((a, b) => a.hash - b.hash).slice(0, sampleSize);
  const points: ScatterPoint[] = sampled.map(({ index: i, hash }) => {
    const deployed = c.stage[i] >= 2;
    return { key: `modeled-${hash.toString(16).padStart(8, '0')}`, cohort: Number(dictionary.cohort[c.cohort[i]]), stage: c.stage[i], tier: credentialTierFromStage(c.stage[i]), track: String(dictionary.track[c.track[i]]), attendanceSessions: c.att[i], pre: c.pre_total[i] / 10, post: c.post_total[i] / 10, gain: (c.post_total[i] - c.pre_total[i]) / 10, daysToDeploy: deployed ? c.days[i] : null, users30d: deployed ? c.users[i] : null, hosting: deployed ? String(dictionary.hosting[c.host[i]]) : null, uptimePercent: deployed ? c.uptime[i] / 100 : null, live90: deployed ? c.live90[i] === 1 : null };
  });
  return {
    filters, totalSelected: selected.length, totalContext: context.length, sourceKind: 'modeled',
    temporal: { resolution: 'day', basis: 'modeled-enrollment-and-first-deploy', context: 'all-cohorts-under-other-filters', enrollmentStart, enrollmentEnd, deploymentStart, deploymentEnd, sourceStart: timeline[0]?.date ?? null, sourceEnd: timeline.at(-1)?.date ?? null, note: 'Dates are modeled: September 9 of the cohort year + the packed enrollment-day offset. First deployment adds the packed days-to-deploy for S2+ only. Highest stages, credentials and 90-day survival are cohort outcome snapshots; their event dates are unavailable. A date cursor must not imply those later outcomes had already occurred.' },
    timeline, enrollmentMonths: [...months.values()], cohortStages, cohortHosting, tiers: summary.tiers,
    tracks: tracks.map(({ gainSum, ...track }) => ({ ...track, rate: divide(track.students, selected.length), meanGain: divide(gainSum, track.students) })),
    hosting: summary.hosting, jurisdictions: summary.jurisdictionRows,
    sites: [...sites.values()].map(({ gainSum, attendanceSum, ...site }) => ({ ...site, meanGain: divide(gainSum, site.students), attendanceRate: divide(attendanceSum, site.students * 24) })).sort((a, b) => b.students - a.students || a.siteIndex - b.siteIndex),
    assessment: { pre: describe(scoreArrays.pre), post: describe(scoreArrays.post), gain: describe(scoreArrays.gain) },
    constructs: constructArrays.map(item => ({ key: item.key, label: item.label, pre: describe(item.pre), post: describe(item.post), gain: describe(item.gain), preBins: scoreBins(item.pre), postBins: scoreBins(item.post) })),
    scatter: { points, totalSelected: selected.length, sampleSize, scope: 'all-selected', correlations: (['attendanceGain', 'prePost', 'attendanceDeployDays'] as const).map(id => correlation(dataset, selected, id)) },
  };
}

/** Enrollment counts through an exact ISO day; these never masquerade as mature outcomes. */
export function enrolledThrough(exploration: ImpactExploration, through: string): { context: number; selected: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through) || !Number.isFinite(Date.parse(`${through}T00:00:00Z`)) || new Date(`${through}T00:00:00Z`).toISOString().slice(0, 10) !== through) throw new RangeError('Expected a valid ISO calendar day.');
  let context = 0, selected = 0;
  for (const row of exploration.timeline) { if (row.date > through) break; context = row.cumulativeLearners; selected = row.selectedCumulativeLearners; }
  return { context, selected };
}

/** Download-safe aggregate view. Packed indices, sample points and site identifiers are omitted. */
export function createImpactExplorationExport(exploration: ImpactExploration) {
  const { scatter, sites, ...aggregates } = exploration;
  return { schemaVersion: 1, ...aggregates, sitesInView: sites.length, scatter: { sampleSize: scatter.sampleSize, totalSelected: scatter.totalSelected, scope: scatter.scope, correlations: scatter.correlations } };
}
