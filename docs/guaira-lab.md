# Guaíra / Ossabravo experimental lab

Open `/guaira-lab.html` directly. Ossabravo is a provisional name. This is an isolated playable prototype, with no campaign or menu link and no introductory cutscene. It uses the existing `WorldGame`, `Player`, `Input`, `Renderer`, bitmap controls, Feka sprites, helmet, death animation and automatic retry. The ephemeral store never reads or writes campaign storage.

The dry red arena has a continuous horizontal floor at world y224, shown at screen y160 by the fixed x0/y64 camera. Cactus, distant irrigated rice and a closed irrigation gate are background scenery. Mysterious purple slime animates the skeletal bull; the prototype defines no ingredients or origin story.

## Controls

- Left/right or A/D: move
- Space, Z, up or W: jump with the normal hold/release behavior
- Down/S while airborne: sentada (normal ground-pound)
- Shift or X: run, as in the existing engine
- Escape or the native Pause/Continue control: pause/resume
- M: toggle sound
- Tentar: start a fresh fight with a helmet
- Mapa: return to the isolated Guaíra map at the corral; its Sair link returns to the existing game home

Touch-capable Pointer Events devices use the local five-button DOM bar, with44CSSpx targets independent of canvas scale; older devices retain the ordinary engine touch zones. Both use the real Input action path. Page controls use native buttons/links, accessible names and44px-high bitmap faces; native Enter/Space activation remains owned by those controls. Blur/hidden-tab pause requires explicit resume. Reduced-motion preference disables camera shake, decorative bull bob/stride and warning flashing; direction cues and combat timing remain visible.

## Encounter contract

The bull locks direction at the start of a 42-tick charge warning or 48-tick low-bone warning. Each fixed tick is 1/60 second; catch-up is capped at 100ms. Six falling top hits defeat it. Brake/recovery opens the ribs for an ordinary jump or sentada; side contact never damages the boss. The charge's final swept collision is resolved with top contact, so a valid first-braking-frame stomp wins over the residual sweep. A descending player on the trailing swept edge safely bounces but cannot deal damage without touching the present body.

At the start of a charge warning, an aimed route shorter than one bull width (48px) selects the inward direction instead. The complete warning and its painted arrows already show that locked route; it cannot turn after the warning starts. Charge speed, hitboxes and the full 20-tick brake plus 52-tick recovery remain unchanged. This removes zero-distance, one-tick wall charges that previously offered a full opening.

Low bones retain their own player-facing direction, 48-tick warning, 3px/tick speed and two-projectile limit. Their flight duration is locked from the trailing projectile's distance to the announced arena edge, including its width. In the current arena, full-width flights take 100 ticks to the left or 96 to the right; outward corner flights take 16–20 ticks. After the last projectile exits, hazards are cleared and the full 52-tick safe recovery begins. The warning's full-floor range therefore matches the reachable danger. Neither aim nor duration tracks Feka after the warning begins.

Charge stops leave narrow corner room, but low bones reach both edges. Stationary corner camping loses the helmet and then kills Feka. No custom player HP or melee attack exists. On defeat the lab intercepts campaign completion and remains available for pause, retry or exit.

When a leading bone leaves the arena, its last endpoint remains visible for the same update as its damaging sweep. These render-only poses accumulate across fixed catch-up steps and use the existing bone painter. The next update clears them with the old sweeps; entering safe recovery, a successful boss hit or a new attempt also clears them. The final trailing bone leaves no harmless image in recovery. Pause preserves the current visible pose, and reduced motion retains these required danger cues. Collision, speed, flight duration, damage and contact priority are unchanged.

## Verification

`node --import tsx --test tests/guaira-*.test.ts` runs the lab constructor/lifecycle tests and frozen real-input replay. The replay fixture uses ordinary keyboard events through actual Input, Player and WorldGame. With the geometric bone flight it wins in 1,065 frames (about 17.75 seconds), compared with the earlier 1,019-frame route. All six hits preserve the helmet, exercise charges and bones, repeat deterministically, and change no campaign completion. The same updated route wins through native touch with and without reduced motion. Separate tests cover both corners, the first braking frame, both trailing sweep directions, eight normal jump/sentada recovery cases, pause/blur/visibility, native page activation, touch cancellation, helmet/death/retry, reduced motion and victory isolation.

`guaira-bull-runway.test.ts` verifies both runway boundaries, the entire locked warning and painted charge envelope, edge-reaching bone flights, and safe native jumps at both corners. A reproducible blind policy (walk right for 100 frames, then jump 24 frames on/24 off without horizontal movement) previously won at frame 1123, receiving three zero-distance charges. The same policy now dies at frame 1397 with one boss health remaining. That measures this specific policy, not every possible stationary strategy. A separate native keyboard/touch route follows the new inward tell and lands a safe recovery hit, including pause/resume during the warning. The existing passive-corner death tests remain unchanged.

`guaira-bull-projectile-visibility.test.ts` reproduces the native one-frame jumps that lose the helmet at left frame 140 and right frame 137, when only the departed leading bone's sweep overlaps Feka. It checks the production painter, multiple fixed steps and departed poses, pause/reduced motion, no-step updates, hit cancellation and retry. Offline native Canvas comparisons restore 108 opaque boss-layer pixels at each missing endpoint; the final composite changes only within that bone's 12×9px outline. Adjacent frames and the trailing recovery frames (left 148, right 144) remain pixel-identical. All per-frame gameplay snapshots match the baseline across both corner runs and the full 1,065-frame victory, with and without reduced motion; only the new render-only pose buffer is omitted from this comparison.

Both experimental labs reuse the base pause/resume transition so buffered hit-stop actions cannot leak across toolbar pause. The Turbosuco intro retains presentation cancellation and audio-pause behavior.

The production build retains `main` and `juiceLab` inputs and adds `guairaLab`. Its dedicated JavaScript is 13.09 kB raw / 5.46 kB gzip, plus the shared 1.43 kB / 0.69 kB bitmap toolbar and 2.67 kB / 1.28 kB HTML. The existing WorldGame bundle remains shared; campaign HTML does not preload the Guaíra entry. These are build sizes, not an FPS claim.

Offline proof images/video are kept outside the repository and explicitly labeled as actual-engine offline rendering, not browser screenshots. No prototype screenshot, custom-player entry, GIF or diorama proof is shipped under `public`.

## Articulated skeleton and directional warning

The bull now lowers its skull for a charge, raises its jaw for low bones, uses
six authored gallop poses with articulated knees/hooves, braces when braking and
opens its ribs around the purple core during recovery. These poses read the
existing simulation state and fixed-step clock; no attack timing, body shape,
contact priority or Player behavior changed. Reduced motion holds one pose within
each phase, and pause holds the current frame.

Charge chevrons point in the locked direction. Their floor band covers the union
of the complete current body and its travel to the existing stopping position;
tests compare it to every actual body and swept hazard along both directions.
The bone attack keeps a distinct low-bone mark across the arena. The existing
top-contact cue remains over the vulnerable ribs.

The earlier art-only before/after replay rendered its 1,019 frames with an identical
simulation digest, all six hits and the helmet intact. Its corner and recovery tests
were unchanged. That comparison movie is offline Canvas output, not browser
footage or a claim of human difficulty calibration.

## Explicit continuation

After the real final hit, the toolbar offers **SUBIR / TENTAR / MAPA**. SUBIR is a native link to `./guaira-subida.html`; victory itself never navigates. This replaces the PAUSA slot rather than adding a fourth visible control. Escape and the canvas pause target still work; while paused, CONTINUAR returns in that slot and SUBIR is hidden. Focus moves to the replacement control if the previously focused slot disappears. Retry clears the result, and click-time state validation rejects an obsolete continuation after pause or retry.

The next step is to inspect the water diversion at Casa da Vazão. The ascent remains freely accessible from the experimental map; this link creates no unlock, shared attempt, campaign registration or saved completion. Tests exercise the final native falling hit and toolbar states; compact compositions use the real renderer and equivalent toolbar drawing, distinct from browser captures.

The map return stays `./guaira.html?at=corral` before defeat. Only the real defeated state adds `&visit=bull-clear`; it survives pause and reports only this encounter’s result. Retry synchronously restores the neutral corral URL before the next frame and invalidates SUBIR. The link also reads the live result at activation. The toolbar regression uses the full 1,065-frame native-input victory recording, checks both return states, pause and same-turn retry, and verifies zero storage access. No saved result or unlock is created.
