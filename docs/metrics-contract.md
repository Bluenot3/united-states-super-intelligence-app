# USSI impact data and the future Arsenal connector

The current USSI explorer reads a local, exact copy of the synthetic AI Pioneer Outcomes Explorer dataset. It has no connection to Arsenal's admin dashboard. The displayed preview is **modeled**, and each exported payload retains that provenance. The data describes no real learner, site, facilitator or app.

## Current reference pipeline

`node scripts/extract-outcomes.mjs` parses `window.AIP_META` and the base64 gzip blob from Alex's reference HTML with JSON parsing and Node builtins. It never evaluates reference JavaScript. A source path can be passed as the first argument. The generated files are `public/data/outcomes.meta.json`, `outcomes.pack.gz`, and `outcomes.source.json`.

`loadOutcomes()` fetches those same-origin files, decodes gzip through the browser's `DecompressionStream`, and constructs the original packed typed columns. `aggregateOutcomes(dataset, filters)` computes all displayed metrics from the selected records. Use `getFilterOptions(dataset)` for dictionary-backed controls. Rates are fractions between 0 and 1; missing denominators return `null`, never fabricated zero-percent success. `downloadAggregateJson(summary)` exports aggregates and definitions only.

Filters are `{ cohort: 'all' | '2024' | '2025' | '2026' | '2027', track: 'all' | dictionaryLabel, jurisdiction: 'all' | jurisdictionCode, delivery: 'all' | dictionaryLabel }`. Cohort trends keep all cohorts under the other filters and highlight the selected year. Jurisdiction rankings keep all jurisdictions under the other filters and highlight the selected jurisdiction. All other metrics use every selected filter.

The immutable preview version is `aip-modeled-2024-2026-v1`. The provenance records SHA-256 hashes of the original HTML, compressed pack and decoded pack. All 34,300 rows are generated; no metric is an observed program result. The 2027 cohort is absent from the embedded pack. Its reference release date is March 30, 2027 at 12:00 AM Eastern. A countdown does not publish unavailable rows: a future release must be explicitly reviewed and supplied.

## Enrollment chronology

The packed `eday` field is an enrollment-day offset. The attachment reconstructs each UTC date as `Date.UTC(cohortYear, 8, 9 + eday)`. Each complete modeled season runs September 9–November 10. The chronicle uses these exact daily events, including dates after the current date in the full 2026 model. Calendar date selection, replay and cumulative curves count only records joined by the selected date.

Independent cohort enrollment is 6,200 / 11,300 / 16,800. Across-cohort cumulative enrollment reaches 6,200 / 17,500 / 34,300 after each full season. Through October 4, 2026, the exact modeled total is 24,470, with 9,830 modeled future joins remaining. These totals count enrollment records; there is no stable identity for deduplicating unique people across cohorts.

Only first deployment can also be assigned a derived event date: enrollment plus recorded `days`, for S2+ records. Highest stage, capstone, assessments, credentials and 90-day survival are final snapshots without achievement timestamps. Those views describe eventual modeled outcomes and must not imply the achievements had occurred by the enrollment cursor date.

The expanded aggregate download preserves the chosen date and scene, exact enrollment as-of totals, full daily/monthly chronology and filtered analytical aggregates. It excludes source row indices, scatter records and synthetic site identifiers. Its ordinary outcome totals retain the full selected-cohort scope, explicitly distinguished from enrollment as-of scope.

The cinematic download also preserves the validated terrain pair and paused camera/orbit state. `topography` contains exact unsmoothed count bins, selected/eligible/excluded totals, source axis domains, grid size, Gaussian method and σ, relative-density height scope and full-population correlation. Terrain uses the four-filter selection across the complete enrollment period. Before/after and attendance/gain count all selected records; attendance/deployment counts S2+ records only. Negative gains and long deployment outliers stay inside the published axis domains. Smoothed heights are density estimates normalized to the filtered peak and are never exported as achieved outcomes.

## Outcome definitions

| Metric | Definition and denominator |
| --- | --- |
| Students in view | All selected modeled records |
| Shipped a live URL | Highest stage ≥S2 / selected students |
| Public launch + custom domain | Highest stage ≥S5 / selected students |
| Capstone, Tier 4 AI Pioneer | Highest stage S7 / selected students |
| Median days to first deploy | Median days among deployed S2+ records |
| App audience reach, 30-day | Sum of per-app users, without cross-app person deduplication |
| Apps still live at 90 days | Live-90-day apps / deployed S2+ apps |
| Mean assessment gain | Mean per-record post-total minus pre-total, on a 0–100 scale |

Assessment constructs are Foundations, Prompt & Context Engineering, Build & Deploy Operations, Data & Privacy, and Ethics & Governance. Packed score values and mentor hours use tenths; uptime uses hundredths. The modeled improvements across years are assumptions. Within-student pre/post changes with no comparison group are descriptive and cannot support causal claims.

## Proposed aggregate publication boundary — not implemented

Arsenal remains the authority for owner/admin recognition, learner progress, credentials, entitlements and data governance. A future connector should create a server-authenticated, reviewed aggregate publication from the existing admin system. USSI should read a public aggregate endpoint or versioned object; it should receive no provider keys, service role keys, individual student records, emails, names, ages tied to identifiers, or protected course material. Updating a local preview is not equivalent to publishing observed results.

Each future payload should include:

```json
{
  "schemaVersion": 1,
  "publicationId": "DEMO_PUBLICATION_ID",
  "version": "DEMO_VERSION",
  "sourceKind": "observed",
  "status": "published",
  "program": "ai_pioneer",
  "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "asOf": "ISO_8601_TIMESTAMP",
  "publishedAt": "ISO_8601_TIMESTAMP",
  "provenance": {
    "system": "Arsenal",
    "methodVersion": "DEMO_METHOD_VERSION",
    "evidenceUrls": [],
    "limitations": [],
    "reviewedBy": "DEMO_OWNER_REFERENCE"
  },
  "definitions": {
    "deployment": { "threshold": "S2+", "denominator": "enrolled", "unit": "fraction" },
    "audience": { "windowDays": 30, "deduplicatedAcrossApps": false, "unit": "appUsers" }
  },
  "suppression": { "minimumCellSize": 30, "suppressedCells": [] },
  "totals": {},
  "cohorts": [],
  "jurisdictions": [],
  "assessments": []
}
```

This is a contract example, not a functioning API. The `DEMO_` values deliberately stand apart from real credentials or records.

For observed data, all eligible aggregates need documented inclusion criteria, denominators, observation windows and evidence. Unknown or incomplete metrics should be `null` with an explanation. Enforce minimum cell sizes before publication, including filtered combinations, so users cannot recover small groups by subtraction. The UI should distinguish observed, modeled and forecast series explicitly, never blend them in a total, and retain older published versions for reproducibility.

Previewing and publishing are separate server actions. Publication needs existing Arsenal owner/admin checks, audit logging, review, schema validation and a revocable publication ID. Fetch errors or stale data must remain visible; do not quietly substitute the synthetic pack into an observed-results view. Public read access must not confer write or admin access. The frontend must never infer admin privileges from a visible button or localStorage.

## Verification

Run `node scripts/verify-outcomes.mjs` after extracting the data. It verifies hashes, exact source totals, cohort metrics, shared-filter behavior, zero-denominator handling, packed layout failures, unavailable 2027 rows, and aggregate export provenance. Browser loading and deployment behavior still require route smoke checks in the consuming app.
