# Juice cannon polish: isolated review

## Delivery scope

- `WorldCannonArt.ts`: native 48×40 raster layers; stationary iron chassis; brass collars and recessed gunmetal chamber; pressure accumulator retains purple juice in both factory and cold skins
- Existing 650 ms warning drives a continuous gauge, liquid level and three pressure lights. Fixed `!` supplements color; animation never replaces the warning duration
- Tube kick starts at the physical muzzle, peaks at 5 pixels after 85 ms and returns under damping. The chassis and gauge remain fixed. A new keg feeds after the shot; purple discharge, drops and a residual lip drip replace the bright generic flash
- `WorldCannonEffects.ts`: launcher-only 240 ms liquid wake and 260 ms landing accents. Landing particles use a copied world contact, not a moving keg position
- Damage, 14×16 projectile collision, speed, first/repeat shot timing, target rules and campaign layout remain unchanged. Draw functions never advance the simulation clock

## Integration

1. New art module and four presentation tests; replace only `drawCannon` implementation with its compatible re-export in `WorldMachineArt`
2. Optional launcher effects module and three tests; add optional `Barrel.launchedAt` / `landingPoint`; set these only for launcher kegs. Add one draw hook and bypass the legacy moving dust / blinking pressure sparkle only for marked kegs
3. Preserve jet/burner dispatch changes when applying shared-file hunks. No `WorldMachineState` or `WorldMachineAssets` changes

## Verification

541 tests passed (538 TypeScript + 3 server), all three validators passed, typecheck passed, production Vite build passed. `npm run check` itself was blocked at the `tsx` IPC pipe by this executor's socket policy; equivalent underlying commands were executed with `node --import tsx`. Build emits its existing >500 kB chunk warning.

Visual proof uses the actual production Canvas painters and `WorldObjects` physics on `@napi-rs/canvas`. It is not a browser screenshot. Local Chromium and Vite preview were attempted and blocked by this executor's socket/network-interface syscalls. Native 320×180 stage crops and a 64-frame before/after cycle were produced. Tests cover pressure progression, return damping, mirrored tube movement, pause determinism, integral pixel geometry, unmoving splash origin, camera exit/reentry and restart clearing.

## Mechanical finding, not changed here

There are nine authored launchers in six stages: 3-1, 3-2 (two), 3-4 (two), 5-2, 5-3 (two), 5-4. All have a 3200 ms cadence and the same 1200 ms first delay. At a fixed 60 Hz their effective sampled first shot is approximately 1217 ms and the following shot is approximately 4433 ms. Nearby warnings last 650 ms.

In 3-2, target `t1` at tile x23 is left of `launch39`. In 5-3, `t1` at x22 is left of `launch42`; secret target `st` at x111 is left of `launch132`. Every corresponding conveyor initially moves left, so unreturned barrels destroy these targets without a button press. A direct physics simulation reproduces 3-2/t1 breaking at about 2.9 s, 5-3/t1 at about 3.42 s, and 5-3/st at about 3.55 s after independently starting its encounter.

3-2/t1 is a solid breakable obstacle, but no exit requires it; it is not a completion prerequisite. 5-3/t1 also has no exit requirement. 5-3/st explicitly gates the optional secret exit (at tile x133), so its automatic break bypasses the implied conveyor puzzle. The 3-2 authoring comment/tutorial says to observe a stationary ledge and reverse the line first; 5-3 is named by its pressure/reserve theme but does not explicitly state that reversal must be required. Treat this as a verified mechanical outcome and a likely intent gap, not a proven spec violation.

A layout-only study moved each launcher two tiles earlier and each target to three tiles right of the new launcher. These three target positions survived 10 seconds with no input and broke about 1.33 seconds after reversing the belt. This study is separate, not applied, and needs human playthrough/reachability and composition review before integration. No speed/damage increase is proposed.
