# Prefeito: pressure order and seam cue

The painters consume the model's readonly `counterpressure` (`phase`, frozen `rect`, phase-local `progress`, `ticksRemaining`). They do not create or advance a clock. The existing `drawGuairaMayorStampTarget` hook handles either the original floor attack or the later recovery seam, so no additional Lab render hook is required.

- Warning: amber outline and upward chevrons, with a one-pixel dark inner edge for contrast against warm stone. A four-slot bronze gauge fills with model progress. All warning paint stays inside the future 32×20 danger.
- Active: cyan water fills every pixel of that same rectangle from the first active tick through the last. Highlight motion and the draining base stripe follow phase-local progress. Reduced motion retains the complete danger shape and functional countdown.
- Order: the forward hand lifts the stamp, extends it toward the seam, then presses it down for discharge. These are authored arm/face/stamp poses. The upper-back pixels at the actual hit opening are identical to the exposed recovery pose.
- Crossing: both the register and lift forward arrows become amber hourglasses while the pulse exists; the forward arrows return as soon as it clears. Bronze outlets sit flush with the real platform top.
- No counterpressure leaves the original first-seal recovery and floor warning behavior intact. No sprite sheets or runtime raster assets were added.

## Focused verification

`node --import tsx --test tests/guaira-mayor-pressure-art.test.ts tests/guaira-mayor-cues.test.ts`

Six checks cover the existing floor countdown/native hydraulic cues and the new warning bounds/gauge, all 640 first/last active pixels at two camera offsets in both motion modes, stable paused poses, preserved exposed back, and both wait inlays clearing to forward arrows. The two painters plus the focused test were also checked with strict TypeScript. The integrator owns the final aggregate checks.

## Offline visual proof

`tools/guaira/render_mayor_counterpressure.mts RUNTIME OUT BASELINE_ART` renders actual production Canvas painters through the native Lab harness. Set `MAYOR_CANVAS_MODULE` only if the already-installed `@napi-rs/canvas` is outside Node's normal resolution path. `RUNTIME` must contain the counterpressure model, adapter, and cautious native replay; `BASELINE_ART` contains historical copies of both painters.

The before/after sheet compares the prior painter against the final painter using exactly the same live native model and player state. It captures warning ticks60/30/1, first/last danger, cleared seam, top-hit approach, legacy touch overlay composition, and reduced motion. It includes the real header, hint and Feka. The legacy-touch row is a composition check using the same keyboard replay, not a claim that this script exercises touch input. Browser boundaries alone are stubbed; these are offline renders, not browser screenshots.

The captured real cautious replay reaches all three seals with the helmet. Rendering is asserted not to change the Player, model, time or save, and the harness asserts no localStorage access. The sequence covers frames480–652 (173 frames at60Hz); encode the generated PNGs at60fps for simulation-speed playback. The real warning starts502, active spans562–585 and clears586. A separate native frame532 pair records the final one-pixel contrast correction without changing the state or bounds.
