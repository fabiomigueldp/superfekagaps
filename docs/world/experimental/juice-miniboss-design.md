# Turbosuco: isolated experimental juice miniboss

Status: playable experimental lab at `/juice-lab.html` through local Vite. The dedicated entry preserves the normal `index.html` app. This encounter is not part of the campaign and this work does not deploy to the Oracle-hosted game.

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
2. **Pressure fan:** body inflation and one ray per shot precede seven stage-one droplets or nine stage-two droplets. The spread is locked and each droplet lasts at most 1,700ms; leaving the arena or reaching the floor removes it earlier.
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

Each geyser has a fixed 22×64 footprint and three public states: `warning`, `active` and `recede`, with a phase timer and normalized progress. The full warning lasts 900ms and causes no damage. The active column can hurt Feka for up to 520ms. Receding fluid lasts 260ms and is harmless. When an attack finishes, any remaining active column immediately starts receding, leaving the stomp approach clear of floor jets. Fan droplets may still be airborne, so players must continue reading their trajectories.

At most two geysers and nine droplets exist at once. Hit, transformation and defeat cleanup prevent old hazards from leaking into the next encounter beat. Semantic `geyser-warning`, `geyser` and `enrage` events let presentation react without introducing a separate collision clock.

## Recorded evidence and verification

`tests/helpers/juiceLabReplay.json` is an observation-driven input recording generated with the real `WorldGame` and `Player`, using ordinary left/right/run/jump inputs. It starts from the public grounded combat handoff at x68, changes no position or health during the run, and wins in **942 frames at 60Hz with zero deaths**. Successful stomps occur at frames **143, 283, 433, 563, 789 and 941**.

The replay reproduces the same final state twice and verifies all three attack patterns, exactly one transformation and more than 15 frames of active geysers. This establishes mechanical reachability with the real movement and collision pipeline; it is not a human difficulty verdict or browser performance measurement.

The final focused command passes **89 tests**, covering combat, art, introduction, audio and lifecycle:

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

## Scope and promotion

The changes stay within the experimental lab and its introduction, art, model, adapter, documentation and tests. Campaign mechanics, campaign data, Player behavior, save schema and deployment configuration remain outside this revision.

Before promotion, review the local preview in an actual browser, play all three patterns and stage two, check keyboard/touch and narrow-screen layout, and assess human difficulty. Do not silently add the encounter to the campaign or its saved stage list. Earlier five-droplet, three-health phase-two rules and the 1,098-frame airborne-seed replay are historical versions superseded by the contract above.
