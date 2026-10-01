# Domínio Pizzarino integration

The final region completes the fixed six-island geography. A second ferry links
the heated Reserva dock at 5-5 to the gardens at 6-1 after C2. It shares the
existing boat atlas while keeping independent mooring and heading state. The
return sign targets the actual 5-5 terminal. No campaign IDs, save fields or
gameplay physics change.

The inhabited coastal garden uses cream/blue masonry, warm ovens, terracotta
roofs, an open stone bridge and a supported service shortcut from 6-3 to 6-5.
The island and additive docks are reproducible from `tools/diorama`; authoring
contracts and exact audit limits are in `docs/world/diorama`.

## Final local checks, 2026-10-01

- 456 TypeScript tests and 3 server tests passed in the final aggregate run
- Level, player-art and 30-stage/260-frame validators, both TypeScript projects,
  production build and whitespace checks passed
- Full six-region routes keep the passenger and occupied hull/cabin in frame at
  320×568, 590×378 and 740×320. When all full-size signs cannot fit the panorama,
  it retains the selected island's stages and departures; the region drawer
  continues to expose all six destinations
- Independent ferry tests cover normal travel, both directions, rapid reversal,
  skip/reduced motion, reload, restored arrivals and actual doorway thresholds
- A failed Costa dock leaves the shared hull available to the heated ferry.
  Missing new terrain/layers preserve the older ferry and both cable systems.
  Late geometry waits for a safe arrival; stale/mismatched metadata is rejected
- Sailing endpoints are canonicalized to exact berth coordinates after strict
  tolerance validation, preventing rounding from adding tiny extra segments and
  shifting the authored heading indices
- Final checks took 13.38 seconds for tests and 9.27 seconds for validators,
  typechecks and build in parallel. Vite itself took 1.21 seconds
- Build: JS 483.74 kB (150.26 kB gzip), CSS 19.35 kB (4.70 kB gzip)
- Seven additional region/connection files total 252,406 bytes. The old boat
  atlas is reused. Decoded image storage is approximately 10.56 MB, estimated
  from dimensions rather than measured browser/GPU memory

The island passes physical, original-sprite and raster visibility gates. The
dock audit covers 1,785 supports, 1,024 hull poses, 992 raster silhouettes and
328 time-sampled return-turn poses. Crops retain real island and water depth as
alpha holdouts, avoiding exposed buried supports and floating underwater feet.
Runtime-style compositions were inspected using the exported WebPs.

## Live preview checks

Preview `b140119`, bundle `index-C-B5MPgZ.js`, was tested in the cloud browser at
1180×757 and 590×378 CSS pixels. The old 23-stage fixture kept Domínio and Enter
blocked until C2. The approved artificial 28-stage/69-seal fixture was imported
only into the established QA origin.

Verified natural Reserva→6-1 travel with the original Feka aboard, blocked early
Enter, explicit 6-1 gameplay entry and return to its arrival. Walked the gardens,
6-3→6-4 stone bridge, 6-4→6-5 ascent and 6-5→6-3 service shortcut. The narrow
reverse ferry journey naturally returned to the actual 5-5 terminal. One
10-second locator wait expired during walking; the next DOM/image observation
showed correct arrival, without repeating the action.

At 472×303 (250% browser zoom), the old short-layout media query excluded widths
below 520px. Its two-row header and expanded footer left too little map space,
making the panorama almost disappear. The compact footer/header now apply at
all short widths, retaining the region heading for assistive technology when
the narrowest header cannot fit it. The complete six-region route and control
layout passed all four profiles, including 472×303, in 5 focused test cases;
the production rebuild passed. The unchanged aggregate suite was not repeated.
New build: `index-wWZIwsQO.js`, CSS `index-XHS49ZnI.css` (19.51 kB / 4.71 kB gzip).

Final browser confirmation of this layout correction and public rollout remain
pending. Automated viewport/reduced-motion cases do not establish physical
touch behavior or measured browser FPS.
