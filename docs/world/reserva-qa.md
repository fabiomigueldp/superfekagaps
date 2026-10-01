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
- Added assets total 448,192 bytes, including 4,387 bytes of authoring-only cabin
  metadata. New runtime fetches total 443,805 bytes. Decoded image storage is
  approximately 14.50 MB; this is a dimension estimate, not measured browser RAM

Actual browser traversal and public deployment verification are pending on the
published preview. Automated layout coverage does not establish physical touch
behavior, browser FPS or a browser-level reduced-motion setting.
