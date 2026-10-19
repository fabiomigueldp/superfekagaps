# fed12cf — polish(hipotetico): articulate scavenging motion and ground effects

- Source: [`fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf`](https://github.com/fabiomigueldp/superfekagaps/commit/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf).
- First parent: `0e96e46cda30802c33af20a77c1a96f231d9fa57`.
- Author date: `2026-10-19T18:54:43-03:00` (the original Git offset is preserved).
- Patch scope: 16 paths relative to that parent.
- Original description: subject and body; retained below.

## Behavior and purpose

Align the optional forage head motion, planted stance and ground effects around one physical mouth contact.

## Implementation changes

- HypotheticalMotion.dinosaurHeadPoint() rotates the skull around native pivot (29, neck +6). DinosaurPose gains optional headPitch; zero pitch returns the original point. HypotheticalArt applies the transform to head pixels, jaw, bridle and reins; HypotheticalAftermath.jawAnchor uses the same transform for effects.

- AftermathForage exposes rootShift and adds asymmetric support/settling curves. HypotheticalAftermath moves the actor root and supplies opposite root compensation to aftermathFooting(), keeping the soles planted. Rider and tail use delayed motion samples; body() aligns the rotated mouth with the ground target.

- The first contact calls forage.contact() with the actual jaw x and records contactTick/contactX/landingTick. forageGrain() supplies the same ballistic first landing and rebound used for drawing and the grit sound timing, including staggered grain births.

- drawForageCover() fades the dense core by losing opacity, separates wisp births and retains bounded scuff marks. cancel(tick) records the cutoff: existing effects continue from their own contact clock while births after cancellation are suppressed. The cover still supplies the visibility mask.

## Code reference map

Every link targets this commit, so later refactors cannot change the cited implementation.

| File at this revision | Symbol or anchor | Responsibility |
| --- | --- | --- |
| [HypotheticalMotion.ts:65](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalMotion.ts#L65) | `export function dinosaurHeadPoint` | Shared rigid head transform. |
| [HypotheticalAftermath.ts:462](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalAftermath.ts#L462) | `get jawAnchor` | World mouth contact using the rendered transform. |
| [HypotheticalAftermathForage.ts:22](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalAftermathForage.ts#L22) | `get rootShift` | Grounded root displacement. |
| [HypotheticalAftermathForage.ts:50](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalAftermathForage.ts#L50) | `contact(tick` | Contact-owned effect and landing clock. |
| [HypotheticalAftermathForage.ts:102](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalAftermathForage.ts#L102) | `export function forageGrain` | Analytic grain landing/rebound. |
| [HypotheticalAftermathForageArt.ts:10](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalAftermathForageArt.ts#L10) | `export function drawForageCover` | Opacity mask, free particles and persistent scuffs. |

## Timing, state and scope limits

- The previous finite-resident and concealment rules remain. The patch changes motion/effect continuity rather than resident count or the condition that permits removal.

- Reduced motion retains the required low occlusion but omits decorative wisps/grains. The original author reports inspection of composed native frames, including reduced motion; this review does not repeat that visual inspection or infer a gameplay/audio test.

## Assets and authoring material

Refreshes scripts/render_hypothetical_forage.ts and adds forage-polish.mp4, forage-polish-study.json, six-pose board, contact/drift stills and poster. The new record describes 24 seconds at 60 fps across four yards.

All source artwork in these scene components is generated with the native Canvas drawing code. Documentation PNGs, videos and JSON studies are authoring outputs. Their inclusion in Git does not make them runtime sprites or a gameplay recording. The full inventory below distinguishes their roles.

## Publication and validation evidence

A retained successful publisher response identifies build `fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf-88cb51815e54` for this exact source revision. The matching request records command `node node_modules/vite/bin/vite.js build`, `tests: not-run` and `publicationMode: manual-no-tests`. Its saved build-log SHA-256 is `eab5087f5983ab023602160d09f154cde2d9edc5ab4a31d2d9c22223ce22d3fa`. This records build and activation completion; it is not evidence of correct gameplay, audio quality or passing tests.

The review used immutable Git trees, first-parent diffs, existing authoring notes and retained deployment records. No tests, typecheck, browser review or authoring renders were run during this documentation task. Claims of earlier art inspection remain attributed to the original message and committed records; they are not new observations.

## Complete patch inventory

Text deltas are Git additions/deletions, including generated JSON. A large JSON delta does not imply an equally large runtime change.

| Path at this commit | Role | Text delta |
| --- | --- | --- |
| [docs/world/hipotetico/debris-interactions-2026-10-19/README.md](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/docs/world/hipotetico/debris-interactions-2026-10-19/README.md) | Documentation / authoring output | +31 / -0 |
| [docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-board.png](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-board.png) | Documentation / authoring output | Binary |
| [docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-contact.png](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-contact.png) | Documentation / authoring output | Binary |
| [docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-drift.png](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-drift.png) | Documentation / authoring output | Binary |
| [docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-poster.png](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-poster.png) | Documentation / authoring output | Binary |
| [docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-study.json](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish-study.json) | Documentation / authoring output | +21456 / -0 |
| [docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish.mp4](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/docs/world/hipotetico/debris-interactions-2026-10-19/forage-polish.mp4) | Documentation / authoring output | Binary |
| [docs/world/hipotetico/debris-interactions-2026-10-19/index.html](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/docs/world/hipotetico/debris-interactions-2026-10-19/index.html) | Documentation / authoring output | +10 / -2 |
| [docs/world/hipotetico/mega-boss-2026-10-18/index.html](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/docs/world/hipotetico/mega-boss-2026-10-18/index.html) | Documentation / authoring output | +1 / -1 |
| [scripts/render_hypothetical_forage.ts](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/scripts/render_hypothetical_forage.ts) | Authoring tool | +14 / -8 |
| [src/adventure/hipotetico/HypotheticalAftermath.ts](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalAftermath.ts) | Runtime source | +15 / -9 |
| [src/adventure/hipotetico/HypotheticalAftermathArt.ts](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalAftermathArt.ts) | Runtime source | +1 / -1 |
| [src/adventure/hipotetico/HypotheticalAftermathForage.ts](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalAftermathForage.ts) | Runtime source | +45 / -15 |
| [src/adventure/hipotetico/HypotheticalAftermathForageArt.ts](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalAftermathForageArt.ts) | Runtime source | +52 / -32 |
| [src/adventure/hipotetico/HypotheticalArt.ts](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalArt.ts) | Runtime source | +13 / -7 |
| [src/adventure/hipotetico/HypotheticalMotion.ts](https://github.com/fabiomigueldp/superfekagaps/blob/fed12cfb7ed4f8ad0cc549f02b95c76159e3ebbf/src/adventure/hipotetico/HypotheticalMotion.ts) | Runtime source | +8 / -0 |

<details>
<summary>Original commit body (historical author record)</summary>

> Give the optional background forage gesture a rigid skull pitch shared by
> its native pixel geometry, bridle, reins and jaw effect anchor. The default
> pitch remains zero for existing poses. Transfer the torso over planted feet,
> lag the rider and tail, and use asymmetric settling and staged recovery.
> 
> Start ground effects at the mouth contact. Disperse the low opaque core by
> losing density; stagger drifting wisps and dry grains with shared analytic
> landing/rebound timing for the grit cue. Keep bounded ground scuffs and let
> already emitted particles settle after a district change, while cancelling
> future emissions. Preserve the existing finite resident eligibility and
> occluded consequence.
> 
> Update the native animation authoring script and document revision 11 with
> 24 seconds at 60 fps across four yards, a six-pose detail board, and recorded
> poses, ground anchors and contact clocks. Inspected the composed native
> frames, including reduced motion. This is art footage, not a gameplay test.
> No test suite, typecheck or browser review was run, following project policy.

</details>
