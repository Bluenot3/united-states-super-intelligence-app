# USSI — United States Super Intelligence

A public ZEN ecosystem and impact observatory, with nine selectable visual directions. This is the first USSI preview, built in a separate repository. Arsenal remains the account, execution, billing, program, and artifact authority.

## Run locally

Use Node.js 24 or later. The data verification script uses Node's native TypeScript support.

```powershell
npm.cmd install
npm.cmd run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`. Navigation uses hash routes:

- `#overview`: the public front door, modeled summary, interactive cohort chart, and ecosystem entry points.
- `#impact`: exact daily enrollment replay, cumulative growth/daily arrivals/season comparison, four morphing full-record scenes, eight-measure parallel strands with exact intersecting brushes, five analytical atlas views, existing eight KPIs and aggregate JSON export.
- `#ecosystem`: source-grounded platform/program connections and admin-preview boundaries.
- `#themes`: select a complete theme and keep multiple favorites on this device.
- `#methodology`: provenance, definitions, source limits, and the future aggregate publishing boundary.

Theme links use `?theme=observatory`, `treasury`, `sovereign`, `zenith`, `vellum`, `meridian`, `arcology`, `quicksilver`, or `aurora`, followed by a hash route. The active theme, still-mode choice, and shortlist persist locally when browser storage is available. Theme links can be copied between preview sessions.

## Visual lineage

Treasury, Sovereign, Zenith, Vellum, Meridian, Arcology, and Quicksilver retain the [ZEN wallet](https://github.com/Bluenot3/zzz-wallet) design lineage. Observatory and Aurora add new USSI material directions and generated standalone sculpture assets. Original ZEN logos, procedural artwork, and three actual WebGL engines are reused selectively. Compact specimens and reduced-motion views use static art; only an active large sculpture mounts a renderer.

See [design lineage](docs/design-lineage.md) and [ecosystem boundaries](docs/ecosystem-boundaries.md). Fonts are self-hosted. No model provider or paid rendering service is needed to run this preview.

See [visual review and verification](docs/design-review.md) and [saved preview captures](docs/previews/). The mobile theme gallery uses a readable single column; desktop uses a nine-specimen comparison grid.

## Data truth

**All 34,300 supplied learner records are synthetic/modeled. None are observed program results.** The original attachment is preserved at `/reference/outcomes-explorer.html`, including its advanced reference interactions. The new dashboard extracts its exact JSON metadata and packed record blob without executing attachment code.

The local source contains only 2024–2026 cohorts. The 2027 cohort is unavailable and stays sealed. Its source date does not automatically create new records.

```powershell
node scripts/extract-outcomes.mjs 'C:\path\to\AI Pioneer Outcomes Explorer (1).html'
npm.cmd run verify:data
npm.cmd run typecheck
npm.cmd run build
```

Data provenance includes SHA-256 fingerprints. All charts and filtered KPIs derive from the same selected records. Export contains aggregate data and source disclosure. Cohort and jurisdiction comparison charts intentionally retain context outside the selected year/jurisdiction. App audience reach sums per-app user counts; it is not a deduplicated population-wide count.

The enrollment chronicle reconstructs the attachment's exact date rule: `Date.UTC(cohortYear, 8, 9 + eday)`. Modeled joins span September 9 through November 10 of each cohort. Cumulative enrollment after each full season is 6,200 → 17,500 → 34,300; independent cohort sizes are 6,200 / 11,300 / 16,800. At October 4, 2026, cumulative modeled joins are 24,470. The complete series includes future modeled dates and is labeled accordingly.

The date cursor controls the chronicle and student universe. The strand field, analytical atlas and ledger describe eventual outcomes across the full enrollment period under the shared cohort filters; no achievement dates are invented. The student universe draws one mark for every selected record joined by the cursor. The strand visualization draws up to 2,500 deterministic sample records; its brush statistics use the complete filtered population. Canvas motion stops when settled, offscreen or hidden, and honors Still mode and reduced motion.

Analysis links preserve `date`, `scene`, `time`, `atlas`, `cohort`, `track`, `jurisdiction` and `delivery` when present. Filter values are validated against the actual source dictionaries. See [impact design and verification](docs/impact-visualization-design.md).

See [metrics contract](docs/metrics-contract.md) for exact denominator definitions and the proposed future Arsenal admin publication payload. The admin connection is not active in this preview.

## Deployment boundary

The production build writes `dist/` and runs as a static frontend. Hash routes do not require application-route rewrites. Serve the dataset and visual assets alongside the build. Dataset loading handles both raw gzip files and hosts that apply HTTP gzip decoding.

This repository does not change the live Arsenal or ZEN deployments, DNS, domain redirects, auth, credits, protected curriculum, or provider routing. Publishing USSI and changing the Ussi.app domain binding is a separate release action after theme selection and source review.
