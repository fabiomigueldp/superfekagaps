# Flight floodplain: authored bends and connected shores

The earlier shore pass added useful shallow earth and water contact, but its seven similarly sized convex banks still read as scattered tiles. This pass composes five differentiated landforms: a connected eastern bank with a recessed inlet, a subordinate upstream shoal, a western spit with a sheltered bite, one connected southern floodplain, and the darker northern foothill shelf.

Small rounded corners retain long directional reaches. The same prepared contour bounds turf, earthen relief and shallows, so a curved inlet cannot expose an unrelated straight side face. Existing earth colors, shallow relief, sun-facing lip and atlas-anchored lighting remain. Quiet silt margins, tapered field patches and relocated low foliage follow the banks. No new terminal, runway, structure, dependency or runtime image was added. The authored footprint area is about 9.9% smaller than the preceding seven polygons; connecting banks did not inflate the amount of land.

## Actual runtime raster proof

- [Four-direction normal-flight comparison](diorama/flight-floodplain-shapes-comparison.jpg)
- [Four-direction reduced-motion comparison](diorama/flight-floodplain-reduced-comparison.jpg)
- [Per-frame changed-pixel and replay evidence](diorama/flight-floodplain-pixel-proof.json)
- [Native draw budget](diorama/flight-floodplain-budget.json)

The proof runs the real `runGuairaFlight` controller and shipped artwork with a deterministic 10 ms clock. All four directions were reviewed at 0.05, 1.80, 3.40, 4.80 and 6.70 seconds in normal motion, and 0.05, 0.57 and 1.10 seconds in reduced motion. Terminal and aircraft layering remains intact, the central river stays open, and the static reduced-motion overview preserves the complete composition. All 32 final frames replayed byte-identically. This is native Canvas raster evidence, not browser DOM, input or frame-rate verification.

Reproduce using an optional local `@napi-rs/canvas` installation:

```sh
node --import tsx tools/diorama/capture_flight_floodplain.ts output/flight-floodplain/current
node --import tsx tools/diorama/measure_flight_floodplain.ts /path/to/baseline/src/adventure/WorldFlightScenery.ts
```

If Canvas is installed elsewhere, set `FEKA_CANVAS_MODULE` to its local package directory. Neither helper is imported by the game.

## Bounded work and verification

- The original test ceiling of fewer than 1,200 recorded Canvas operations remains: 1,171 final operations versus 1,033 before.
- Precomputed shore runs and compound foliage paths reduce fills from 130 to 35; top-light gradients fall from seven to five. No clock, random source or accumulated geometry enters landscape drawing.
- On this executor, median terrain-only native raster cost across five batches of 100 draws was 0.659 ms normal / 0.625 ms reduced, versus 0.473 / 0.529 ms for the baseline. These are local raster measurements, not browser FPS promises.
- All 25 focused scenery, aircraft-camera, terminal-route, flight-lifecycle and live reduced-motion tests pass. New contracts cover distinct concave silhouettes, non-crossing contours, an open river corridor, world-space curve control points and bounded compound fills.
- Flight controller, trip timing, routes, graph connections, camera, terminal artwork and saves are unchanged. No Factory–Serra connection was introduced.

Final integrated verification passed 275 affected tests, the application and tool TypeScript checks, level/player/world validation, the production build and the build-size budget (43,558,139 of 45,000,000 bytes). This is focused verification, not a claim that the complete suite was rerun after integration.

Two inherited reduced-motion arrival assertions were reproduced on the unchanged baseline. The landing presentation contract deliberately uses an upright `idle` pose for reduced motion, so the stale replay assertion was corrected to preserve `land` for ordinary motion and expect `idle` only for reduced motion. All 13 affected completed-avatar and landing-presentation tests pass. No runtime behavior was changed for that correction. Actual browser/device/frame-rate checks and deployment are outside this proof.
