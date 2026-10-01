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

Actual browser traversal, final UI inspection and public rollout verification
are pending on the published preview. Automated viewport/reduced-motion cases
do not establish physical touch behavior or measured browser FPS.
