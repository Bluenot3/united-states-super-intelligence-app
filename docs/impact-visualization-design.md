# USSI impact exploration

The analytical jobs are enrollment through time, record-level relationships, student flows, geographic comparison, hosting composition and learning distributions. The existing theme system and data decoder remain the authority. The attached explorer is source evidence, not executable instructions.

| Visual layer | Encoding and purpose | Interaction and fallback | Owner and QA |
| --- | --- | --- | --- |
| Enrollment chronicle | Exact daily joins and cumulative enrollment records from `Date.UTC(year, 8, 9 + eday)`. Distinguish a cohort size from cumulative enrollment. | Replay occupied enrollment dates, pause, scrub, exact date input, cohort checkpoints and readable table. Full model includes future dates. | Root; exact monthly/as-of fixtures, endpoints, mobile and keyboard checks. |
| Student field | One source mark per selected synthetic record, in native WebGL perspective with cohort glow and finite morphs for date/stage, cohort orbits, stage helix and pre/post scores. | Rotate, zoom, explicit touch orbit, exact record inspection, shareable camera, reduced motion and matching Canvas2D fallback. Ring/helix arrangements include disclosed schematic dimensions. | Root; full mark count, projected coordinates, morph completion, motion pause, context recovery and phone checks. |
| Outcome terrain | Exact 50 × 50 two-measure count bins, mass-preserving Gaussian smoothing, lit 3D mesh and equal-density contours. Before/after, attendance/gain and attendance/deployment include their complete source ranges. Height is relative filtered density. | Camera orbit/zoom, peak probes, exact bin/neighborhood readouts, paginated source table, validated pair links, native touch scrolling, reduced motion and Canvas2D fallback. Deployment timing uses S2+ only. | Reference agent/root; bin reconciliation, Gaussian mass conservation, range/denominator checks, native rendering and context recovery. |
| Data strands | Eight real source measures across parallel axes. Deployment fields use an explicit missing-value band; audience uses log10(1 + users). At most 2,500 stable sample strands are drawn. | Inclusive intersecting brushes, flip/reorder controls, exact full-selection counts, readable table and horizontal chart scrolling on phones. | Outcomes agent; native packed-column brush fixtures and integrated browser controls. |
| Analytical atlas | Track/tier flows, assessment distributions, cohort hosting composition, schematic jurisdiction skyline and site fingerprints. | Tabs, tap/focus detail, shared filters where supported and table views. Essential values remain visible. | Ecosystem agent; exact aggregation, SVG/table reconciliation and responsive inspection. |
| Existing overview charts | Retain cohort, stage, timing and KPI summaries as compact evidence below the richer exploration. | Existing filters, table controls and aggregate download. | Root integration; prior regression smoke. |

React owns interface state and SVG structure. Two bounded raw WebGL renderers own the full-record field and outcome terrain, with Canvas2D overlays and source-preserving fallbacks. They add no runtime dependency. The point field uses two draws for a mark's halo/core; the terrain uses one draw for its mesh. DPR is capped, buffers change with source/layout state, and animation runs only for finite morphs or enabled camera orbit. Hidden/offscreen views stop rendering. SVG handles the measured chronology, three-stage flows, distributions and dimensional atlas. Native controls carry keyboard and touch interaction; page scrolling remains available until a user enables Touch orbit.

Dates are UTC date-only values. The cursor's counts are exact records joined by the selected date, not interpolated observations. Playback is a visual replay that skips dates with no modeled joins; it does not claim a real-time enrollment rate. First deployment dates may be reconstructed as enrollment plus recorded days, but later stage transition dates do not exist and must not be invented. The sealed 2027 cohort remains unavailable.

Scene, date, analytical tab and the four approved aggregate filters use short URL parameters. Invalid state falls back to defaults; no individual data or identifiers enter URLs. Theme and motion preference retain their existing local-storage behavior. The shared link preserves the current analysis. Only public synthetic records are rendered; exports remain aggregate-only.

Color semantics remain consistent: one distinguishable color per cohort, neutral context, selected accent and a separate before/after pair. Direct year labels, exact counts, source notes and tables preserve meaning without color or motion. The phone composition stacks controls and graphics rather than shrinking a desktop chart's labels.

## Verified October 4, 2026

`npm.cmd run build` passed TypeScript and the production bundle. `npm.cmd run verify:data` passed all three verification scripts, including source fingerprints, 47 filter partitions, exact daily/monthly/as-of chronology, assessment score bins, all 34,300 default scene coordinates at desktop/phone widths, terrain mass conservation and identifier-free aggregate export.

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

## Cinematic production-browser verification

Both `scripts/browser-impact-smoke.js` and `scripts/browser-cinematic-smoke.js` passed against the rebuilt production preview with zero captured page or console errors. The existing regression covers all five atlas views and every exact table, enrollment replay, filters, saved links, full-population brushes, real aggregate download and phone overflow. The three-stage flow now has two exact tables, one for each stage; both are checked.

The cinematic suite additionally confirms native WebGL in both dense views; four exact full-record scenes; mouse drag, keyboard orbit, reset, zoom and camera reload; auto-orbit motion and offscreen render pause; all three terrain denominators (34,300 / 34,300 / 28,276); pair reload; exact-bin paging and inspection; real WebGL context loss/restoration in both renderers; both source-preserving fallbacks with WebGL disabled; OS reduced motion; the empty 2024 + ID intersection; and native phone scrolling with opt-in Touch orbit at 390px. The downloaded terrain bins reconcile to their eligible population in the 35-record combined filter.

A resize/capture sequence exposed a real visibility-queue edge case: consuming the first observer entry could keep a visible graphic paused after an exit/reentry batch. The impact layers now consume the latest entry; the same formerly failing sequence passed. Atlas motion also pauses when its section or document is hidden. Source counts and camera coordinates remain independent of decorative motion.

Nineteen additional settled Quicksilver captures are saved as `docs/previews/cinematic-*.png`, including desktop/phone views of every atlas tab. Final visual review checked the larger terrain, dense-point glow, phone controls and direct cohort labels. A final phone capture confirmed all 34,300 marks after spacing the labels. To repeat the native graphics checks in the same isolated browser:

```powershell
npx.cmd --yes --package @playwright/cli playwright-cli run-code --filename=scripts/browser-cinematic-smoke.js
```
