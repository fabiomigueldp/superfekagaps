# Reserva Gelada integration

The fifth region now shares the fixed world geography with Costa, Porto, Fábrica
and Serra. The B2 exit at 4-5 opens a separate passenger cableway to 5-1. Its
red/cream cabins use a second independent pair state; the released maintenance
line keeps its own cars and secret gate. Returning by the physical sign arrives
at 4-5, and entering a stage still requires an explicit action after arrival.

The cold-store route has five supported landings and an open shipping-cutaway
shortcut from 5-3 to 5-5. Source scripts, audited geometry and metadata are in
`tools/diorama` and `docs/world/diorama`. Runtime assets load on demand. Region 6
retains the existing fallback. No gameplay physics, progress IDs or save fields
changed.

## Local checks, 2026-10-01

- 419 TypeScript cases: 418 passed in the aggregate run; one obsolete lazy-load
  expectation was updated to assert Reserva loads only on explicit inspection
  and exactly once, then its focused rerun passed. All 3 server tests passed
- Level, player-asset and 30-stage/260-frame world validators passed, as did both
  TypeScript projects, production build and whitespace checks
- Actual installed terrain, cabin and six terminal/gate layers pass the strict
  parser/dimension tests. Geometry audits are recorded alongside their sources
- Controller tests cover independent pairs, actual terminal destinations,
  B2-versus-secret gates, stage return, late loads, failed terrain/cabin/layers,
  reversal, skip, reload and reduced motion
- Full 4-3 → 5-5 → 4-3 routes keep Feka and the occupied carrier framed at
  320×568, 400×606, 590×378 and 740×320; visible native controls remain separated
- The aggregate test attempt took 11.88 seconds; validators, both typechecks and
  build took 11.71 seconds in parallel. Vite itself took 1.89 seconds
- Build: JS 471.77 kB (147.61 kB gzip), CSS 19.35 kB (4.70 kB gzip)
- Added assets total 446,306 bytes, including 4,387 bytes of authoring-only cabin
  metadata. New runtime fetches total 441,919 bytes. Decoded image storage is
  approximately 14.50 MB; this is a dimension estimate, not measured browser RAM

## Live preview checks

Preview `43c5d16`, bundle `index-Bcp1on_A.js`, was tested in the cloud browser at
1180×757 and 590×378 CSS pixels. The old 18-stage fixture kept Reserva blocked,
including Enter. The approved artificial 23-stage/57-seal fixture was imported
only into the established test origin; production progress was not imported.

Verified actual passenger departure, natural 5-1 arrival, explicit gameplay entry
and return to 5-1; walking to 5-3, shipping shortcut to 5-5, return to the real
4-5 terminal and immediate maintenance travel to 4-3. The complete 4-3→5-1 route
also arrived correctly. Reload during a passenger ride restored the last saved
5-1 arrival. Two rapid direction inputs and skip arrived at the selected 5-2.
The region menu retained 23/30 and 57/72, with region 6 still locked.

Visual QA identified buried foundation sockets incorrectly painted over the
island by isolated terminal exports. Both terminal overlays were re-exported
with the unchanged island geometry as depth holdouts. Runtime-style composites
verify the correction; geometry, paths, metadata, cabins and gate images are
unchanged. This export-only revision needs a final preview image check before
main promotion. No unchanged aggregate test rerun is required for those pixels.

Recent browser diagnostic entries were extension metadata errors, so this is
not an exhaustive app-console claim. Automated layout coverage does not
establish physical touch behavior, browser FPS or a browser-level reduced-motion
setting. Public deployment verification remains pending.
