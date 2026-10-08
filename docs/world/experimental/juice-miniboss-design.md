# Turbosuco: isolated experimental juice miniboss

Status: playable at `/juice-lab.html` and through the optional Factory salon in campaign stage `3-3`. `FactorySalonSession` reuses this encounter, introduction, pixel material and fluid effects. The standalone lab remains ephemeral; the campaign host owns the return journey and optional victory record. This revision is prepared for GitHub integration and publication to the Oracle-hosted game at `https://superfekagaps.torbware.space/`.

## Calabrezzo championship introduction

The first visit stages a bodybuilding competition: walk Feka to the mark, present his thin torso, hear the judges' taunts through subtitles, and confront the emerging purple slime. The invitation is “venha fazer amor com o suco”; Feka answers that he will defend his gaps and his “shape patético”. His existing shirt returns before combat. The composition of the slime remains unexplained.

`JuiceIntroDirector` owns named beats, holds and one-shot cue events. Timed beats total 31.65 seconds, plus the player's walk and presentation holds. The scene freezes boss collision/timers, then hands control to grounded Feka at x68 with a fresh encounter. The scene can be skipped, paused, or explicitly replayed; death and retry begin combat directly. Reduced motion removes cinematic zoom and focus shifts. Audio cues use the existing effects bus and are cancelled on interruption; no external sound files or voice recordings were added.

The escort uses an authored pixel head and torso with articulated arms and legs. Walking, contact at the mark, turning and departure share the director's clock and continuous staging positions. The updated combat replay starts at the actual grounded cinematic handoff, so it also exercises the same initial position used by Skip and Retry.

## Identity and art

The reference direction is a threatening, heavy mound of purple slime: one rounded dome, sunken angular eyes, a large dark mouth with dripping liquid edges and a broad pooled base. The factory's “juice” has a deliberately unexplained composition. There is no fruit, citrus, cap, glove, bottle or ingredient label.

The runtime Canvas2D painters retain the existing 320×180 presentation:

- `JuiceMonsterPainter` draws the continuous glossy silhouette, breathing surface, gaze, anticipation, dash trails, impact splashes, exhaustion and the stage-two transformation.
- `JuiceArenaPainter` draws the containment chamber, reservoirs, connected pipework, pressure gauges and five permanent floor vents. Stage two changes the chamber's pressure and lighting.
- Outlined purple/lilac droplets and marked vent footprints separate collision hazards from decorative splashes. Pale signal colors indicate anticipation and vulnerability.
- Both warning rays and projectile launch velocities come from `fanLaunch`. Floor warnings and active columns use the same geyser positions as collision.
- Painters consume simulation time and state; rendering does not advance attacks. No external runtime image, dependency or asynchronous sprite loading is required.

## Encounter contract

- Dedicated arena and ephemeral progress: the real constructor never accesses localStorage.
- Feka retains the existing movement, variable jump, run, touch and stomp semantics.
- The boss has six health points and a 38×40 collision body. The body remains inside the horizontal arena bounds 16–304, with floor y224.
- Only recovery accepts a damaging stomp. A stomp on an otherwise active boss bounces; side contact during recovery is safe.
- At exactly two remaining health points, the fourth successful stomp clears all droplets and geysers, plays 550ms of hurt, then enters a 1,200ms `enrage` transition. The transformation has no contact damage or projectile hazards and cannot receive another hit. The next attack begins stage two.
- Attack and geyser targets lock at anticipation start. No warning homes toward subsequent player movement.
- The fixed-step model limits a delayed update to 100ms, preserving readable anticipation rather than skipping directly to an attack.
- Final defeat clears every hazard, displays the experiment outcome and cannot call campaign completion.
- Pause, mute, explicit retry, automatic death retry and page-visibility pause remain available. Pausing freezes geyser timers as well as the boss and player.
- The lab has its own pause overlay: campaign map/settings/export buttons are never installed. Retry creates a fresh stage-one encounter and removes all prior hazards.

## Attack set and timing

1. **Pressure dash:** directional chevrons and a floor line, compression, a sweep across the arena and liquid afterimages. Jump over it and punish at the far end.
2. **Pressure fan:** body inflation and one ray per shot precede seven stage-one droplets or nine stage-two droplets. The spread is locked and damage lasts at most 1,700ms. Liquid continues falling afterward until its head touches the floor or a chamber wall; a surface impact takes over its remaining mass.
3. **Elastic pounce:** crouch, mark the locked landing point, leap in an arc and splash. Leave the mark, then counterattack during the longer recovery.

| Timing | Stage one | Stage two |
| --- | --- | --- |
| Rest between patterns | 340ms | 260ms |
| Attack warning | 680ms | 900ms, shared with floor warnings |
| Dash movement | 460ms | 400ms |
| Fan attack | 600ms | 600ms |
| Pounce movement | 700ms | 700ms |
| Dash/fan recovery | 900ms | 800ms |
| Pounce recovery | 1,100ms | 1,100ms |
| Fan droplet count | 7 | 9 |
| Fan launch speed | 0.145px/ms | 0.16px/ms |

Stage one repeats dash → fan → pounce. Stage two restarts its sequence at fan → pounce → fan → dash. The extra fan after landing maintains pressure against stationary corner camping. Only fan aims at the player's actual center at either wall; dash and pounce retain bounded landing targets.

### Stage-two floor geysers

Every stage-two attack warning activates up to two of the permanent vents at x48, 104, 160, 216 and 272. Selection favors a vent near the player's locked position and another at least 96 pixels away, while keeping every selected vent at least 48 pixels from the boss's future landing/recovery center.

Each geyser retains a nominal 22×64 vent region and three public states: `warning`, `active` and `recede`, with a phase timer and normalized progress. The full warning lasts 900ms and causes no damage. Pressure raises the fluid front over 160ms; its opaque, tapered scanlines drive collision, so there is no invisible full-height rectangle ahead of the liquid. Moving packets swell and narrow inside the marked floor region. The active jet can hurt Feka for up to 520ms. On shutoff, its remaining mass falls under gravity and the detached spray finishes landing during a harmless 460ms tail. When an attack finishes, any remaining active jet immediately starts receding, leaving the stomp approach clear. `releaseTime` preserves the actual shutoff time when an attack ends early. Fan droplets may still be airborne, so players must continue reading their trajectories.

At most two geysers and nine droplets exist at once. Hit, transformation and defeat cleanup prevent old hazards from leaking into the next encounter beat. Semantic `geyser-warning`, `geyser` and `enrage` events let presentation react without introducing a separate collision clock.

## Recorded evidence and verification

`tests/helpers/juiceLabReplay.json` is an observation-driven input recording generated with the real `WorldGame` and `Player`, using ordinary left/right/run/jump inputs. It starts from the public grounded combat handoff at x68, changes no position or health during the run, and wins in **942 frames at 60Hz with zero deaths**. Successful stomps occur at frames **143, 283, 433, 563, 789 and 941**.

The replay reproduces the same final state twice and verifies all three attack patterns, exactly one transformation and more than 15 frames of active geysers. This establishes mechanical reachability with the real movement and collision pipeline; it is not a human difficulty verdict or browser performance measurement.

The latest focused command passes **95 tests**, covering combat, art, introduction, audio, liquid motion and lifecycle:

```sh
node --import tsx --test tests/juice-miniboss*.test.ts tests/juice-intro*.test.ts tests/juiceIntroAudio.test.ts
```

Coverage includes:

- The two-health threshold, full invulnerable transformation, bounded hazards and valid recovery for every attack.
- Locked targets, full warning duration and visual fan rays matching every projectile's launch direction.
- Actual Lab collision behavior: warning and receding geysers are harmless; active columns damage Feka.
- Stationary left/right corner pressure in both stages using real Player movement.
- Pause/resume during stage-two floor warnings, fresh retry, defeat cleanup, input reset and campaign/storage isolation.
- The complete deterministic no-death victory described above.

The integration pass completed `npm run check`: 1,057 TypeScript tests and three server tests passed, followed by level/player/world validation, both TypeScript configurations and the production build. After the visual review and final accessibility/lifecycle fixes, all 89 focused tests and `npm run build` passed again.

The local Chromium browser also replayed all 942 ordinary-input frames through the real mounted game, reproduced every expected hit, observed 62 frames of active geysers, reached victory without a death and left localStorage unchanged. The settled victory had no residual camera shake. Actual browser captures in `output/turbosuco/` cover the escort, containment chamber, transformation, vent warnings, live jets and victory. A 390×844 viewport keeps the 320×180 canvas below the toolbar without horizontal overflow. These checks do not replace physical-device touch testing, an auditory review or human difficulty assessment.

Reduced motion disables camera shake, ambient motion, trails and decorative splashes while preserving attack positions and warning progress. The result loop ages the final particles and camera effect; disposal removes lab listeners and cancels the intro's audio nodes.

### Motion and effects review

`JuiceAnimation` samples authored warning, release, recoil, landing, exhaustion and collapse poses from the same model clock. Warning-to-attack and attack-to-recovery transforms join continuously for all three patterns in both stages. Fan inflation holds through the existing 80ms release delay, then recoils with the actual spit. A semantic `spit` event synchronizes that release with its sound; completing a fan no longer produces an unrelated floor-impact sound or camera shake. Collision, speeds and the recorded victory timings are unchanged.

`JuiceCombatEffects` owns a bounded pool of 24 short-lived cosmetic bursts for floor droplets, landing ripples, stomp accents and defeat. Rendering never advances that pool; pause freezes it, retry replaces it and the victory loop expires it. Reduced motion omits those particles. Projectile trails follow flight direction, the reactor and vent indicators react to charge, and low-contrast floor reflections ground the liquid in the scene. The transformation banner leaves the monster visible; the victory panel waits for the collapse, and the depleted health segment briefly drains after each hit.

The updated browser recording is `output/turbosuco/revisao-visual.mp4`, with the initial idle capture removed in `output/turbosuco/revisao-final.mp4`. The same 942-frame normal-input replay still wins without a death after these presentation changes. During this local Chromium capture, simulation plus drawing averaged 1.58ms per sampled frame (p95 2.5ms, maximum 13.7ms); this measures local CPU work, not physical-device or GPU presentation performance. The cosmetic pool was empty after the result settled, and the browser reported no console errors.

### Pixel material and liquid revision

`JuicePixelSurface` renders the animated body into a small reusable world-resolution surface, then resolves its coverage and colors into opaque pixel clusters with a fixed material palette. Nearest-neighbor enlargement preserves those clusters in the introduction as well as combat. The body has delayed cheek/skirt deformation, mouth strands that stretch and pinch, and droplets that settle at the feet. Browser rendering uses OffscreenCanvas; environments without it retain the direct Canvas painter.

`JuiceFluid` supplies integer scanline drawing, the shared geyser collision profile and analytic ballistic flights. Pressure packets travel from each nozzle upward, briefly connected necks separate at the crown, falling globs accelerate and turn into flattened deposits with small secondary splashes. Impacts start with a spreading sheet and finish as lobed puddles rather than expanding rings. The introduction, transformation, landing, projectiles and defeat share this material. Projectiles now impact when their bottom touches the floor, instead of disappearing after sinking below it.

The liquid renderer samples bounded emissions from the simulation clock; pause freezes the full effect. When a stomp clears combat hazards, the effect pool retains the geysers' existing falling age so the harmless residue finishes naturally. Reduced motion omits detached spray and idle dripping while keeping the functional rising front and danger boundary visible. The effect pool remains capped at 24 bursts. Tests cover rising-front collision, harmless shutoff, ballistic landing, integer pixel spans, palette cutouts, non-mutating drawing, residue expiry and the full ordinary-input victory. All 95 focused tests and the production build passed in that revision. The replay still wins at frames 143, 283, 433, 563, 789 and 941, with no deaths.

### Complete projectile paths and viscous landings (2026-10-07)

Fan droplets retain their existing launch vectors, gravity and 1,700ms damage window. Expired drops stay visible as darker, harmless liquid until contact. Swept floor/wall contacts emit one `drop-impact` with the exact contact position, simulation time and incoming velocity, including every contact inside a single delayed update. The chamber walls sit 16 pixels outside the arena's movement bounds, preserving the player's corner space.

A successful stomp clears collision immediately and hands airborne drops to `JuiceCombatEffects`. Their copied positions and velocities continue under the same gravity, with no timed fade in flight. Floor hits spread into lobed deposits and secondary droplets; wall hits cling, stretch into downward strands and drain to the floor. Only deposited material fades. Reduced motion retains these necessary falling paths with simplified heads and deposits while suppressing decorative spray. Pause freezes the shared clock and retry creates a fresh pool.

Curved ligaments briefly connect new projectiles to the mouth. Landing sheets and delayed spray originate along the monster's skirt, stretch, pinch apart and follow independent ballistic paths. The pounce descends in a stretched pose, compresses after contact, then rebounds and settles through a damped oscillation. Its attack/recovery poses still join continuously; the visible splash follows the same landing event used by sound and camera feedback.

Validation: 176 focused juice/introduction/epilogue/salon tests passed, including 14 new regressions for full fan paths, upward aim, both corners, expiry without extra damage, precise contact events, stomp handoff, reduced motion and elastic settling. The mounted browser replay completed all 942 frames with zero deaths and the same six hit frames, unchanged localStorage and no browser warnings/errors. The observed cosmetic pool peaked at 12 of its 24 slots. Local simulation plus drawing measured a 1.4ms median and 3ms p95 in the initial visual pass; this is a CPU observation rather than a device frame-rate benchmark.

The local animated review and replay capture harness are in `output/turbosuco-fluid/review.html`, served by Vite. Those generated review files are ignored by Git and excluded from the production assets.

`output/turbosuco/gosma-pixel.mp4` is a 17.2-second preview exported from the real browser renderer at 30 frames per second, using the ordinary-input replay. Browser checks also cover the enlarged introduction, phase two, reduced-motion rendering and a 390×844 viewport without horizontal overflow. Rendering preserved the model state and the browser reported no console errors.

## Scope and promotion

The refinements stay within the shared encounter, introduction, art, model, adapter, documentation and tests. Merging the current main preserves its Factory salon integration, audio handoffs, epilogue, Player behavior and save schema.

Publication uses the user's explicit request to merge and deploy to Oracle. Verify both the standalone lab and the existing campaign salon, including returning to the suspended campaign. Earlier five-droplet, three-health phase-two rules and the 1,098-frame airborne-seed replay are historical versions superseded by the contract above.

## Stage-two warning-volume review (2026-10-02)

Reviewed on `f410694`, preserving the authored combat and animation from `435d8e4`.
The three attacks already ask for different responses: jump the dash, leave the
locked pounce landing, and read the aimed fan. Stage two adds vent placement and
an extra fan between movement attacks. Its 900ms warning and safe floor during
recovery provide distinct anticipation, pressure and counterattack beats. This
code/replay review does not establish human difficulty or justify new patterns.

The concrete readability gap was vertical: the vent warning marked the floor,
but activation immediately made the entire 22×64 column dangerous. It did not
show the clearance a jumping player would need. The warning now projects that
exact future volume from its first frame, with a faint gold interior, broken
sides and a height marker. The floor countdown remains the activation cue;
solid purple still means a live jet. Reduced motion retains both the volume
and the countdown. No attack selection, target, damage, timing, movement,
introduction, audio or shared renderer code changed.

Validation for this revision:

- Baseline: 91 focused tests passed. Six new geometry regressions fail before
  the change; all 98 focused tests pass afterward. They compare the visible
  volume with subsequent live collision for fan, pounce and dash, through the
  full warning, including camera offsets and reduced motion.
- `npm run check`: 1,246 TypeScript tests and three server tests passed, followed
  by level/player/world validation, both TypeScript checks and production build.
- Chromium replay: the same 942 ordinary-input frames win with zero deaths,
  unchanged hit frames (143, 283, 433, 563, 789, 941), one transformation, 62
  active-geyser frames and unchanged localStorage. No browser errors were logged.
- Before/after visual inspection used the same replay frame 717. The warning
  also renders at 390×844 with reduced motion, a 320×180 game canvas below the
  toolbar and no horizontal overflow.
- Build: 40,572,532 → 40,572,801 bytes (+269 bytes), within the 45,000,000-byte
  budget. No new assets or dependencies.

Browser replay drives the existing InputState through the mounted game; it is
not a physical keyboard/touch test, a human playtest, an auditory review or a
frame-rate benchmark. No deployment or campaign promotion was performed.

The delivery branch was subsequently reconciled with main `bc431d5` (Bairro
post-victory water). That commit has no file overlap with this change. On the
reconciled base, `npm run check` passed 1,253 TypeScript tests, three server
tests, validation, type checks and build; output is 40,575,243 bytes. The mounted
Chromium replay was repeated with the same victory, hit frames, 62 active-jet
frames, unchanged storage and no browser errors. The original authoring commit
and the incoming main commit remain in history; integration should use the
three-file Turbosuco delta against `bc431d5`.
