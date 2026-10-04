# USSI design lineage

USSI is a separate frontend. These assets preserve the ZEN visual vocabulary without
copying a wallet, financial fixtures, account logic, or production credentials.

## Source and provenance

The source repository is Alex's `Bluenot3/zzz-wallet`, inspected locally under
`.references/zzz-wallet`. The seven wallet directions keep their original names
and Roman numerals: Treasury I, Sovereign II, Zenith III, Vellum IV, Meridian V,
Arcology VI and Quicksilver VII. Observatory VIII and Aurora IX are new USSI
expressions. Observatory is the default.

| Local asset | Original file | Treatment |
| --- | --- | --- |
| `public/visuals/zen-mark.svg` | `brand/mark.svg` | Exact vector source. The matching mark path is also rendered inline. |
| `meridian-core.js` | `directions/V-meridian/assets/meridian-core.js` | Exact WebGL engine; mounted only for the active large hero. |
| `meridian-orbit.png` | `directions/V-meridian/assets/p-orbit.png` | Exact transparent archive poster; still mode and WebGL fallback. |
| `zenith-core.js` | `directions/III-zenith/assets/zenith-core.js` | Exact original armillary engine. |
| `zenith-orbit.png` | `directions/III-zenith/assets/pd-orbit.png` | Exact transparent archive poster. |
| `quicksilver-core.js` | `directions/VII-quicksilver/assets/quicksilver-core.js` | Exact liquid-metal raymarcher; USSI supplies decorative scene geometry and an empty wall print. |
| `quicksilver-poster.webp` | `directions/VII-quicksilver/assets/qs-poster-spec.webp` | Exact archive material specimen; displayed within a sculpture viewport. |
| `arcology-core.js` | `directions/VI-arcology/gen/engine.js` | Original pure AR geometry IIFE, exposed as `window.Arcology`. The appended financial book and DesignCanvas tween helper are excluded. |
| `arcology-study.svg` | Generated from the original AR geometry | `node public/visuals/generate-studies.cjs` reproduces this static architectural specimen. Composition values are decorative and do not represent impact metrics. |
| `sovereign-lathe.svg` | `directions/II-sovereign/gen/assets/lathe-gold.svg` | Exact engraved geometry. |
| `treasury-lathe.svg` | `directions/II-sovereign/gen/assets/lathe-steel.svg` | Exact steel engraving; new Treasury material composition around the ZEN mark. |
| `vellum-foil.png` | `directions/IV-vellum/assets/p-capbig.png` | Exact holographic ZEN cap. |
| `vellum-lens.png` | `directions/IV-vellum/assets/lens-disc.png` | Exact transparent iridescent lens. |
| `observatory.png` | New USSI Image Gen artwork | Porcelain, deep jade and architectural intelligence sculpture. Added by the main build task. |

The Aurora sculpture is new Image Gen artwork of a prismatic glass ribbon,
saved as `public/visuals/aurora.png`. The near-white Observatory palette is `#f6f7f4` / `#153d31`;
its vector fallback uses jade orbital geometry until the generated artwork loads.

The `Bluenot3/zenaiworld-lander` reference contributes the engraved / security foil
visual language and ecosystem vocabulary. Its original typography includes
Cormorant Garamond, Manrope and JetBrains Mono. Its hardcoded marketing metrics
are not copied as live USSI data. The lander's legacy Arsenal destination
`qubit.earth` is not used as USSI's canonical Arsenal link.

## Rendering and preferences

The theme atelier shows static specimens. It never starts nine concurrent WebGL
contexts. Meridian, Zenith and Quicksilver can start one genuine renderer in the
active large hero. Every renderer uses its source `onReady` and `onLost` hooks;
archive artwork stays visible until the first frame and returns if rendering is
unavailable. Renderers stop on unmount. The source engines preserve hidden-tab
handling; USSI honors reduced-motion preferences and the user's Still mode.

The theme component's shortlist is local-only, stored as `ussi:shortlist` with
guarded JSON parsing and guarded writes. Selecting a preview and keeping a world
are separate controls. The parent owns the currently selected theme and motion
preference. Shortlisting does not update an account or any external platform.

No financial amounts, fake impact values, wallet actions, auth flows, credits,
entitlements, provider secrets or integration settings are transplanted.
