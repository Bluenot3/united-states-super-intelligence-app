# ZEN Pioneer outcomes integration

The canonical visual and analytical application remains in this USSI repository. The live ZEN Site embeds a static USSI release at `/pioneer-outcomes/ussi/index.html?embed=data&theme=quicksilver#impact`, inside its existing `/pioneer-outcomes` page. The original ZEN explorer remains at `/pioneer-outcomes/explorer.html`.

The embedded mode opens the data surface directly, with all timeline, cohort, terrain, atlas, filtering, theme, and export controls. It omits the USSI marketing and navigation shell. Full-screen links open the same released application and preserve the analysis state.

After committing the USSI changes, export from this checkout:

```powershell
node scripts/export-zenai.mjs 'C:\path\to\zen-checkout\public\pioneer-outcomes\ussi'
```

The script requires a clean canonical source tree, rebuilds with the nested deployment base, and writes a release manifest containing the exact USSI source commit and SHA-256 of every release file. It copies only the compiled public application; no authentication, backend, or operational authority is introduced. The ZEN Site's existing source and publishing workflow owns its release.

ZEN's Worker permits same-origin framing only for the exact USSI `index.html` and the existing original explorer. Other pages retain their existing framing restrictions. Dataset loading stays local to the released static assets. These 34,300 records remain explicitly modeled and synthetic; this integration does not establish an Arsenal admin metrics connector or observed learner activity.

Deployment status must be established through the ZEN Site's publishing result. A local build, source push, or this document alone does not establish a live connection.
