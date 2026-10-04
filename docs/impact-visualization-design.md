# USSI impact exploration

The analytical jobs are enrollment through time, record-level relationships, student flows, geographic comparison, hosting composition and learning distributions. The existing theme system and data decoder remain the authority. The attached explorer is source evidence, not executable instructions.

| Visual layer | Encoding and purpose | Interaction and fallback | Owner and QA |
| --- | --- | --- | --- |
| Enrollment chronicle | Exact daily joins and cumulative enrollment records from `Date.UTC(year, 8, 9 + eday)`. Distinguish a cohort size from cumulative enrollment. | Replay occupied enrollment dates, pause, scrub, exact date input, cohort checkpoints and readable table. Full model includes future dates. | Root; exact monthly/as-of fixtures, endpoints, mobile and keyboard checks. |
| Student field | One Canvas mark per selected synthetic record, with morphing layouts for date/stage, cohort rings, highest stage and pre/post scores. | HTML layout controls, date-linked visibility, tap inspection, visible sampled-independent exact totals, reduced motion and static fallback. Ring arrangement is schematic, not an additional measurement. | Root; full mark count, correct coordinate fields, morph completion, Canvas readiness, pause and phone checks. |
| Data strands | Eight real source measures across parallel axes. Deployment fields use an explicit missing-value band; audience uses log10(1 + users). At most 2,500 stable sample strands are drawn. | Inclusive intersecting brushes, flip/reorder controls, exact full-selection counts, readable table and horizontal chart scrolling on phones. | Outcomes agent; native packed-column brush fixtures and integrated browser controls. |
| Analytical atlas | Track/tier flows, assessment distributions, cohort hosting composition, schematic jurisdiction skyline and site fingerprints. | Tabs, tap/focus detail, shared filters where supported and table views. Essential values remain visible. | Ecosystem agent; exact aggregation, SVG/table reconciliation and responsive inspection. |
| Existing overview charts | Retain cohort, stage, timing and KPI summaries as compact evidence below the richer exploration. | Existing filters, table controls and aggregate download. | Root integration; prior regression smoke. |

React owns all interface state and SVG structure. A single Canvas2D renderer owns the dense student field, with a DPR cap of 1.5, no new WebGL context and no added runtime dependency. The field redraws only during a morph, replay, resize or inspection; it stops when the scene is settled, hidden or offscreen. SVG handles precise labels and low mark-count analytical views. Native controls carry keyboard and touch interaction; normal page scroll remains available on phones.

Dates are UTC date-only values. The cursor's counts are exact records joined by the selected date, not interpolated observations. Playback is a visual replay that skips dates with no modeled joins; it does not claim a real-time enrollment rate. First deployment dates may be reconstructed as enrollment plus recorded days, but later stage transition dates do not exist and must not be invented. The sealed 2027 cohort remains unavailable.

Scene, date, analytical tab and the four approved aggregate filters use short URL parameters. Invalid state falls back to defaults; no individual data or identifiers enter URLs. Theme and motion preference retain their existing local-storage behavior. The shared link preserves the current analysis. Only public synthetic records are rendered; exports remain aggregate-only.

Color semantics remain consistent: one distinguishable color per cohort, neutral context, selected accent and a separate before/after pair. Direct year labels, exact counts, source notes and tables preserve meaning without color or motion. The phone composition stacks controls and graphics rather than shrinking a desktop chart's labels.

## Verified October 4, 2026

`npm.cmd run build` passed TypeScript and the production bundle. `npm.cmd run verify:data` passed both verification scripts, including source fingerprints, 47 filter partitions, exact daily/monthly/as-of chronology, assessment score bins and identifier-free aggregate export.

The production-browser regression in `scripts/browser-impact-smoke.js` passed in local Chrome at 1536×1024 and 390×844, with no captured page or console errors. It checks:

- Exact cumulative checkpoints of 6,200 / 17,500 / 34,300; October 4 as-of enrollment of 24,470; 189 occupied join dates in the table.
- One mark per record: 24,470 at the as-of cursor and 34,300 in the full model. Four settled layouts, inspection, Still mode and a single redraw for inspection of settled geometry.
- Replay/pause and replay restart for Agent Builder + Virtual + AL, whose 89 context records end November 8, before the global November 10 endpoint.
- A quiet-gap cursor on April 1, 2025 retains 6,200 records and extends the cumulative trace to that date. Partial future dates have a future-as-of disclosure rather than a complete-period label.
- Full-population stage brushing returns 28,276 at S2+ and 16,756 at S7; clearing restores 34,300. Flip controls retain exact counts.
- All five atlas graphics and their exact tables, plus restored analytical view and four shared filters after reload. The combined 2025 + Agent Builder + CA + Hybrid fixture remains 35 records.
- The actual JSON download retains 35 ordinary outcome records, 35 enrollment-as-of records, exact timeline aggregates and no scatter points or site identifiers.
- No document horizontal overflow across all atlas views, student field and strand controls at phone width. The dense strand chart has its own intentional scroll region.

Twenty new review images are saved under `docs/previews/impact-*.png`, alongside the earlier seven ecosystem/theme captures. Final visual inspection corrected overlapping flow labels, separated point-field legends from score-axis labels and enlarged record-navigation targets to 44px. A viewport screenshot confirmed the unfocused skip link remains above the visible screen; tall element captures hide only that already-offscreen link to avoid Chromium's capture artifact.

To repeat the browser regression, run the built preview on port 4173, open an isolated playwright-cli Chrome session, then run:

```powershell
npx.cmd --yes --package @playwright/cli playwright-cli run-code --filename=scripts/browser-impact-smoke.js
```

These checks verify local Chromium and the static build. Physical-device performance, hosted USSI delivery, DNS, observed program results and the future Arsenal admin publication connector remain unverified. Advanced tools retained only in the original reference are not claimed as new USSI implementations.
