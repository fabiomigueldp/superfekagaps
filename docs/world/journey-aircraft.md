# Guaíra STOL courier

An original dry-runway, high-wing utility plane shared by both directions. Warm linen, coral tips, river-teal stripe, glazed cabin, sprung wheeled gear, wing struts, tailwheel and gold spinner. No seaplane floats or water effects: Guaíra, Fábrica and Serra use supported dry terminals.

## Integration

- `WorldAircraftModel.ts`: `createAircraftRoute(from?, to?)`, `sampleAircraftTravel(route, elapsedSeconds, reducedMotion?)`, `validAircraftRoute`, duration constants and types.
- `WorldAircraftArt.ts`: `loadAircraftAssets(signal?)`, `paintAircraftTravel(ctx, camera, pose, assets, elapsedSeconds)` and `parseAircraftMetadata`.
- Load failure returns `null`, including bad metadata, wrong image dimensions, abort or a 12-second timeout. Keep the origin selected and show retry/cancel; never commit a failed flight.
- Sampling is pure and seekable. The host owns requestAnimationFrame, skip, cancel, visibility interruption and persistence. Persist the destination only once successful completion is accepted. A canceled/reloaded flight retains its origin.
- `AIRCRAFT_TRAVEL_DURATION = 7.4`: .55 s engine settle, 1.55 s accelerating ground roll, 4 s airborne, 1.3 s damped touchdown and deceleration. Airborne labels separate climb/cruise/approach.
- `AIRCRAFT_REDUCED_DURATION = 1.15`: calm ground-level interpolation, with zero bank, pitch, suspension, dust, air wisps and prop spin. Prefer a fixed camera or destination dissolve for this option.
- The cabin is enclosed. Hide the separate standing Feka during flight; a small green passenger cap is embedded behind both side windows. `passengerAnchor` remains available for effects or attachment alignment, not roof placement.

## Route and camera contract

Coordinates are the same normalized 8:5 map space as `MapCamera`. A route requires `departureStart`, `departureLift`, `arrivalTouchdown`, `arrivalStop`. Each runway must be finite and nonzero. Optional two `cruiseControls` are ground-path Bezier handles; altitude is independently lifted above that path. Without overrides, the model derives controls that maintain ground velocity continuity at liftoff and touchdown. Authored controls may change that continuity and should align with the runway vectors.

Optional `altitude` defaults to .20 and `scale` to 1. The default generator uses a slightly smaller .82 scale and a route that fits a fixed normalized camera. Don't move/zoom the camera in reduced-motion mode. All completed samples return the exact arrival anchor and zero speed/suspension/lift.

Artwork uses a true Blender camera at `(11, -20, 17.5)`, orthographic scale 6 for the craft, measured relative to the map's 20.6-unit frame. Full-width Guaíra artwork at ortho 27 should use scale `20.6 / 27`. Model footprint is 3.95 length × 4.86 wingspan × 1.81 high; terminal clearance 5.2 wide × 7.6 long. The anchor is the ground center, z=0. Wheel bottoms meet that plane.

## Rendering

32 genuine projected headings, never a mirrored image. One WebP atlas, approximately 249 KB, alpha-safe common crop. The renderer adds a ground shadow whose separation/fade expresses lift, projected two-blade propeller with a steady translucent disk at speed, hinged trailing wing flaps, damped landing compression, at most twelve dry-dust motes and two very faint turning air wisps. There is no long high-altitude jet contrail. The prop's plane and flap hinges are projected from the actual 3D model for each heading.

The asset has no runtime library dependency. Model source and packager are `tools/diorama/render_journey_aircraft.py` and `package_journey_aircraft.py`. Blender output (`.blend`, PNG headings and contact sheet) stays under ignored/local build output rather than the shipped runtime; the source regenerates it completely. Example:

```sh
blender -b -t 6 -P tools/diorama/render_journey_aircraft.py -- --output-dir output/aircraft
python tools/diorama/package_journey_aircraft.py --render-dir output/aircraft
node --import tsx --test tests/world-aircraft-travel.test.ts
```

Focused checks cover deterministic replay, finite motion through all stages, exact endpoints, acceleration/braking, boundary continuity, reverse headings, reduced motion, corrupt route/metadata rejection, atlas budget, and balanced/bounded canvas rendering. This focused check is not a substitute for the final integrated flight UI review.
