# Turbosuco: isolated experimental juice miniboss

Status: experimental playable lab, not in the campaign. Open `/juice-lab.html` through Vite or a reviewed deployment. The dedicated multi-page entry preserves the normal `index.html` app. Do not deploy this work to the Oracle-hosted game.

## Identity and art

A heaving, irregular mound of mysterious purple industrial slime with expressive eyes. The factory’s “juice” has a deliberately unexplained composition. There is no fruit, citrus, cap, glove, bottle or ingredient label. The runtime Canvas2D painter draws a continuous viscous silhouette in the existing 320×180 presentation.

- Asymmetric liquid lobes, embedded bubbles, lilac gloss and a heavy puddled base
- Shared-clock squash, surface ripples, anticipation, stretch, attack trails, splash arcs and vulnerable-surface sparks
- Animated factory reservoirs, glass reflections, industrial floor and restrained warm lights
- Decorative liquid is non-colliding; the five fan projectiles are visibly outlined
- No external runtime image, dependency or asynchronous sprite loading was added

## Encounter contract

- Dedicated arena and ephemeral progress: the real constructor never accesses localStorage
- Feka retains the existing movement, jump, run, touch and stomp semantics
- Six hits; faster second phase at three health or less, with a full 500 ms warning retained
- Deterministic, varied sequence; the target is locked at anticipation start with no late homing
- Warning, active motion, settling and recovery use the same model clock as collision
- Body stays within the 16–304 arena bounds; finite projectile lifetime and at most five droplets
- Recovery is the only damaging stomp window; side contact in recovery is safe
- Final defeat clears danger, displays the experiment outcome and cannot call campaign completion
- Pause, mute, explicit retry, automatic death retry and page-visibility pause remain available
- The lab has its own pause overlay: campaign map/settings/export buttons are never installed

## Attack set

1. **Pressure dash:** directional chevrons and a floor line, compression, rapid sweep, liquid afterimage. Jump over it and punish at the far end
2. **Pressure fan:** swell the liquid body, telegraph spread, emit five non-homing droplets. Read their trajectories and reach the recovery
3. **Elastic pounce:** crouch, mark the locked landing point, leap in an arc and splash. Leave the mark, then counterattack

Phase one uses dash → fan → pounce. Phase two uses dash → pounce → fan → dash, shorter rest and shorter recovery on dash/fan. Pounce retains its longer punish opportunity.

## Recorded evidence and verification

The separately retained motion sheet and 20-second animation recording use the real constructor, WorldGame, Player, Renderer and input recording, with a native Canvas2D substitute for browser output. These are **offline runtime render/simulation**, not browser captures or human gameplay evidence.

The observation-driven input recording wins in **1,098 frames at 60 Hz, zero deaths**, using only ordinary movement/jump inputs. Six successful stomps occur at frames 149, 459, 596, 716, 870 and 1,097. Every attack type occurs. The committed run-length encoded fixture in `tests/helpers/juiceLabReplay.json` reproduces the same result twice with exact state equality. This establishes mechanical reachability, not a final human difficulty verdict.

Earlier verification on the initial experiment branch:

- 26 focused tests pass: model rules, real-constructor lifecycle and recorded-input replay
- Full suite: 557 TypeScript tests and 3 Node server tests pass
- Level, player asset and world validation pass; both TypeScript configurations pass
- Vite production build passes and emits both `index.html` and `juice-lab.html`
- `npm run check` itself is blocked by this environment's tsx CLI IPC restriction; its same test, validation, typecheck and build steps passed using `node --import tsx`
- Cloud-browser navigation to local Vite returned `ERR_BLOCKED_BY_CLIENT`; **deployed-browser checks remain pending**

Before promotion: review the approved preview in an actual browser, play all three patterns and the second phase, check touch/keyboard and narrow-screen layout, and assess human difficulty. Do not silently add the encounter to campaign or its saved stage list.

## Pre-preview corner and warning correction

Fan aim now locks the actual center of the player, including at either wall. Only fan skips the landing clamp; dash and pounce retain their existing bounds and all velocities, damage, lifetimes, recovery and warning durations are unchanged. The five visible anticipation rays and the projectiles share a single launch description, including the upward velocity bias.

Regression coverage checks both stationary corners in both phases using the real WorldGame/Player, target lock throughout the full 650/500 ms warning, all five renderer vectors and the unchanged dash/pounce landing clamps. The original passive left-corner/pounce-punish exploit now dies to the first fan before dealing damage. The normal-input victory fixture remains byte-for-byte unchanged and still wins in 1,098 frames with zero deaths.

Updated offline visual proof is retained separately from the publication patch. No concept, PNG or MP4 is required or imported by the runtime build.

## Scope

Only `BossEncounter.name` / `hint` gain explicit `string` return types so the lab adapter can override their labels. Campaign mechanics and Player are unchanged. Vite gains the isolated HTML input; no main-app link, campaign data, save schema, deployment hook or Oracle change is introduced.

## Purple-slime identity correction

The painter and this art description were corrected after the factory identity was clarified. All collision, fan vectors, warning timing, attacks and replay inputs are unchanged. Signal green remains reserved for attack anticipation and vulnerability; the body, bubbles, decorative splashes and projectiles are purple/lilac with white glints. Before/after state sheets are offline Canvas2D render evidence, not browser captures or human playtesting.

Three nearby geyser comments now describe purple fluid, keeping future art guidance consistent with the unexplained composition. Their actual pixels are unchanged. Existing “verde-limão” text names the instrument/signal color, not an ingredient. No campaign lore or other factory artwork was changed.

Identity correction verification: 34 focused tests, 610 TypeScript tests and 3 Node server tests pass. Level/player/world validation, both TypeScript configurations and the two-entry production build pass. The identical recorded inputs still win in 1,098 frames; all five before/after state samples retain identical model bounds. Eight new art tests cover deterministic, finite, balanced, non-mutating paint commands and the absence of green fruit colors in the resting body/projectiles. Browser/human difficulty review remains pending.
