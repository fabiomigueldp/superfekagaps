# Flight floodplain: grounded shoreline composition

The intervening floodplain banks used a flat fill and an equally bright outline around every edge. In motion, this read as floating cutouts next to the authored terminal dioramas.

The same seven footprints now receive low earthen front faces, quiet submerged-water contact, a sun-facing turf lip, and a shallow top-light gradient. Sparse inward erosion cuts break the ruler-straight shore without expanding any bank. All details are finite, computed from atlas coordinates, and retain the same light on outbound and return flights. Shore width scales with the camera, including the static reduced-motion view.

No terminal artwork, plane size, route, camera, travel clock, save behavior, or shared map renderer changed. No new runtime assets or dependencies.

## Raster evidence

[Four-direction before/after comparison](diorama/flight-shore-comparison.jpg)

The proof samples the actual `runGuairaFlight` controller using the shipped image assets and a native Canvas rasterizer at a deterministic 10 ms clock. Each of the four directions was captured at 0.05, 1.80, 3.40, 4.80, and 6.70 seconds. The comparison selects the same airborne frames before and after. This is actual runtime Canvas output, not a hand-drawn approximation; DOM/CSS and browser input are outside this harness.

To reproduce with the optional QA dependency `@napi-rs/canvas` installed:

```sh
node --import tsx tools/diorama/capture_flight_scenery.ts output/flight-composition/current
```

If the dependency is installed elsewhere, set `FEKA_CANVAS_MODULE` to its local package path. It is not part of the shipped game or package manifest.

## Focused verification

- 22 focused tests pass across scenery, aircraft camera, authored terminal routes, flight lifecycle, and live reduced-motion behavior.
- New contracts cover atlas-anchored lighting, proportional shoreline width, deterministic/bounded rendering, and water contact beneath terrain.
- `npm run typecheck` and `npx vite build` pass.
- Replaying the raster harness produced 20/20 byte-identical PNG frames.
- Full campaign suite and browser interaction checks were not run for this isolated rendering change.
