import { DEFAULT_FILTERS, type OutcomeFilters, type OutcomesDataset } from './outcomes';

/** Keep analysis links small and validate all values against the actual public source. */
export function readAnalysisFilters(dataset: OutcomesDataset, search = location.search): OutcomeFilters {
  const params = new URLSearchParams(search);
  const filters: OutcomeFilters = { ...DEFAULT_FILTERS };
  const cohort = params.get('cohort');
  if (cohort && dataset.source.cohorts.map(String).includes(cohort)) filters.cohort = cohort as OutcomeFilters['cohort'];
  for (const [key, dictionary] of [['track', 'track'], ['jurisdiction', 'state'], ['delivery', 'delivery']] as const) {
    const value = params.get(key);
    if (value && dataset.meta.dict[dictionary].map(String).includes(value)) filters[key] = value;
  }
  return filters;
}

export function writeAnalysisFilters(filters: OutcomeFilters): void {
  const url = new URL(location.href);
  Object.entries(filters).forEach(([key, value]) => { if (value === 'all') url.searchParams.delete(key); else url.searchParams.set(key, value); });
  history.replaceState(null, '', url);
}
