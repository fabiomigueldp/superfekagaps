# Block impact response

A collision still removes a breakable tile and awards its existing reward on the same simulation tick. The response is presentation only:

- An intact brick recoils up to 3 native pixels, returns with a single 1-pixel settling beat, and finishes in 180 ms. The collider never moves.
- A broken brick immediately becomes four cached masonry fragments. Opposing horizontal impulses, gravity, stepped pixel rotation and a final 130 ms fade give the pieces weight. All expire by 520 ms. A downward pound drives the lower pieces downward from contact.
- Reduced motion keeps bricks still and shows only a fading 120 ms local cue: stationary mortar grains for a held brick, stationary separated pieces for a fracture. No extra camera shake, flashes or hit-stop were added.
- There are at most 24 live responses. Updates compact the existing list in place, idle levels allocate nothing for the effect, and fragment sprites are cached. Offscreen bounds include the complete downward debris envelope.
- Effects use the simulation clock, stop during pause, resume after death hit-stop alongside the existing particles, and clear on retry/load/disposal. They do not enter saves or progression. Classic retry retains its original modified terrain.

The classic generic block-particle paths were replaced, preventing duplicate fracture bursts. Independent landing, ground-pound dust and enemy effects remain unchanged. World and classic share the same fracture renderer. Helmet eligibility and rewards are unchanged.

## Focused verification

- 57 tests passed with `node --import tsx --test tests/block-impact-feedback.test.ts tests/world-render-tiles.test.ts tests/gameplay.test.ts tests/combat-ground-pound-transition.test.ts`.
- Source and tooling/test TypeScript checks passed.
- The focused suite covers held-vs-broken blocks, real classic head collisions, helmet gating, single rewards, no duplicate generic particles, negative/nonzero level origins, real World keyboard collision, pound direction and support timing, gravity/rotation/fade, pause, reset/restart/load/disposal, death lifetime, reduced motion, bounded storage, offscreen rendering and a downward fragment entering from above the viewport.

## Native render evidence

Run `tools/qa/render_block_impacts.mts BASELINE_ROOT OUTPUT` through `node --import tsx`. Set `BLOCK_CANVAS_MODULE` to an installed `@napi-rs/canvas` if it is not locally resolvable. Generated files stay outside public/build assets.

The before/after run used baseline d50b511, a declared isolated block fixture, real World Input/Player/collision and the production Canvas painters. It produced 48 native images / 24 paired samples, including intact/broken and reduced-motion cases. Player positions, removal timing and coins match between both versions. The fixture releases jump at its first actual ceiling contact, isolating the cosmetic change from the independently corrected held-jump ceiling behavior.

This is offline native-render evidence, not a browser screenshot, real-device playtest, hardware-performance benchmark, or final combined jump/placement verification. No full aggregate gate, push or deployment was performed for this isolated change.
