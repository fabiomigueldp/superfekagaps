# World checkpoint and finish flags

## Reference and change

The reference is the real Remastered implementation in `src/engine/Renderer.ts`,
`flagAt`: four 180 ms cloth frames, an outlined mast and planted foot, red inactive
checkpoints, teal reached checkpoints, and distinct goal marks. Its gameplay
state transition in `src/game/Game.ts` is 450 ms. World previously used static
rectangles in `WorldCheckpointArt.ts` and `WorldGame.renderLevel`.

World now shares the same pixel cadence with cloth-bound marks, a rope and
outlined mast/base. An inactive coral flag carries `!`, reached green carries a
check, the normal goal has a gold star, secret exits have a purple question mark,
and unavailable exits have a gray lock. The checkpoint hoists for 450 ms after
its existing activation event. A small glint ends after 650 ms. A completed goal
has a permanent check on its mast.

The immediate completion panel covers the world goal. A matching flag now appears
inside the panel's unused lower-right corner, so its hoist and earned check stay
visible without waiting to grant progress, rewards, or the Continue button.

Reduced motion has flat, stationary cloth, an immediately raised earned flag and
no glints. Check marks remain readable without color or audio. Pause uses the
existing frozen scene clock. Loading an earned checkpoint starts with the settled
flag and never replays its celebration.

Only one transient checkpoint timestamp is added. No save schema, triggers,
spawn coordinates, route, coin positions, audio events, reward or completion
logic changed. Offscreen flags are culled. Painting uses fewer than 150 bounded
integer rectangles per flag; no particles, canvas allocations or randomness.

## Evidence

- [Actual Remastered reference](capturas/flags-20261007/actual-remastered-reference-native.png), drawn by its production `Renderer.flagAt`
- [Normal-motion before/after scenes](capturas/flags-20261007/normal-scene-comparison.png)
- [Reduced-motion before/after scenes](capturas/flags-20261007/reduced-scene-comparison.png)
- [Pixel state atlas](capturas/flags-20261007/flag-state-atlas.png)

The atlas's first row per cell shows the old reached World flag, new inactive
checkpoint, new reached checkpoint, and normal goal. Its second row shows secret,
locked, completed goal, and checkpoint activation. The five cells cover the four
cloth frames and static reduced motion.

These are offline native Canvas rasters, not browser, device, audio, FPS, or full
route acceptance. Scene fixtures explicitly position Feka at authored flags and
then execute the real `update()` trigger. Sixteen before/after scene pairs retain
identical player, camera, progress, coins, elapsed time and completion state. The
proof verifies Player, WorldPhysics, progress and campaign sources are unchanged.
The 1-1 goal-ready frame also exposes an existing overlapping coin `1-1:c43`; coin
placement is outside this donor and was reported to the placement owner.

Reproduce with an available native Canvas module and a clean base checkout:

```sh
node --import tsx scripts/prove_world_flags.ts /tmp/flag-proof /path/to/@napi-rs/canvas/index.js /path/to/base-32a14d6
node --import tsx --test tests/world-checkpoint-art.test.ts tests/world-checkpoint-feedback.test.ts tests/world-checkpoint-storage.test.ts tests/world-run-accounting.test.ts
npm run typecheck
```

Focused validation: 24 tests passed, including native activation/pause/resume,
muted/reduced motion, bounded result-panel paint, immediate one-time completion,
storage failures, and run accounting. TypeScript passed. Full publication gate,
production browser acceptance, push and deployment belong to integration and were
not performed for this donor.
