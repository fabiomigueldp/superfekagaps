# Oven burner: native-pixel visual review

## Scope and contract

`WorldBurnerArt.ts` exports `drawBurner(ctx, body, atlas, cameraX, cameraY, time, world)` with the same signature as `drawJet`. It consumes `jetCycle` unchanged. Its only shared-file hook is an early `world === 6` dispatch in `WorldMachineArt`. The integrator can combine it with the geyser dispatch as:

- World 6 → `drawBurner`
- All other worlds → `drawGeyser`

No changes to physics, damage, campaign, sound, time offsets, `WorldMachineState`, or `WorldMachineAssets`. The independent cannon delivery remains unchanged. A future manual-rearming fix based on `jetOpenedAt` is compatible because this painter consumes the shared `jetCycle` result, never reconstructing its phases.

## Visual changes

- A cast-iron and terracotta plenum, recessed firebox ports, separate feet, brass gas feed and ceramic-lined mouth replace the generic juice nozzle
- A tiny contained pilot is safe. The existing 800 ms warning progressively heats three firebox ports and shows a dark-backed `!`; warning readability does not depend on color, sound or rapid blinking
- The dangerous rising/flowing/falling column now has a continuous warm envelope. All dangerous pixels stay visible, including both upper corners. Internal tongues, a winding hot core, small edge licks and detached embers move on the simulation clock
- After danger ends, the column disappears immediately. Only low, disconnected ash/embers and cooling metal remain
- The ceramic foreground lip sits below the dangerous rectangle, so it cannot cover a damaging pixel
- Texture movement is object-relative, so moving or re-entering the camera cannot change the animation phase

## Verified issue and quantitative proof

The original three-triangle flame does not fill the rectangular hazard used by `WorldGame`. In the production-painter raster at full flow (2100 ms), only 426 of its 572 dangerous pixels were visible (74.48%). The new painter covers all 572. Samples at 1850, 1920, 2400 and 2470 ms likewise improved from approximately 74–75% to 100%. The 1810 ms, 4-pixel emergence is fully covered in both versions.

The coverage fixture counts nontransparent pixels from the actual Canvas renderer. Unit tests are stricter: each dangerous pixel must receive a flame color over the complete active cycle at 11 ms intervals, across widths 4, 12.8, 13 and 24. Harmless decorative embers can exist outside the rectangle; they never enlarge it.

## Verification and limits

- 539 tests passed: 536 TypeScript and 3 server tests
- Five new burner tests cover full danger coverage; timing and immediate cooldown; non-color warning; deterministic pause/camera reentry and no mutation; phase offsets and custom periods
- All three validators, TypeScript checks and production Vite build passed
- The executor blocks the `tsx` CLI IPC socket, so the equivalent underlying commands ran through `node --import tsx`. No test logic or production dependencies were changed
- 84-frame, 4.2 s before/after animation, phase sheet, exact-hitbox overlay and 320×180 production stage renders were generated using the actual Canvas painters and state on `@napi-rs/canvas`. These are offline runtime renders, not browser screenshots. The executor's socket restrictions prevented Chromium/Vite browser verification
- Production build retains the existing >500 kB chunk warning

## Campaign and separate challenge notes

Four burners exist: 6-2/j1 at tile x28 (phase 0), 6-2/j2 at x48 (phase 1700), 6-2/j3 at x91 (phase 2100), and 6-4/j1 at x104 (phase 0). None is present in 6-5. They use the existing 4200 ms cycle: 800 ms warning, 120 ms rise, 410 ms sustained flow, 170 ms fall and 350 ms cooling. Each dangerous envelope is at most 44 pixels high.

The first/third 6-2 burners and 6-4 burner combine with left-moving conveyors. This visual pass does not change that authored challenge. Further design work should evaluate the stationary approach/waiting positions and retained escape room on those belts before changing cadence or adding patterns. A distinct ignition/combustion sound could improve identity, but needs a separate event-routing change because burner and liquid currently share the `jet` event. No speed or damage increase is proposed.
