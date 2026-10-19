# Bastion coordination and Vanguard feedback

## Source history

- `e33b61b434fc1e10ec5fb7c7df89027f89e78150` — Polish siege destruction timing and environmental reactions.
- `516c4ceeb7ee901aaf771314fe81b8b50296ad52` — Refine vanguard tactics, animations and bastion combat.
- `423597225ae8b43a4606db8d587964aa0f47ec5c` — Coordinate bastion defenders and refine vanguard combat feedback.

The details below describe `4235972`. The earlier commits provide context; their
changes are not attributed to this commit. This documentation adds no gameplay changes.

## Coordinated defenders

`src/adventure/hipotetico/HypotheticalGuards.ts` introduces `GuardCoverSignal`
and tracks `coveringElite` and `lastCoverSerial`. The fourth-post loader can
support one primary Vanguard preparation after resupply: a rush requests a high
barrel arc, and a vault requests a low arc. The loader limits active barrels in
the post to two before preparing another throw and avoids starting ordinary
throws while its captain is stunned. Existing committed throws retain native physics.

`HypotheticalVanguard.ts` exposes `coverSignal` during the first warning of eligible
moves. `HypotheticalGame.ts` updates `encounterHint` to describe the combined attack
and barrel arc, including a warning when the exposed Vanguard has covering fire.

## Animation and contact feedback

`HypotheticalVanguardMotion.ts` defines `VanguardPose`, `vanguardTargetPose` and
`blendVanguardPose`. The Vanguard retains its previous pose and blends transitions
over six simulation frames. Rendering follows attack preparation, release, flight
and landing without delaying attack or damage windows.

`HypotheticalVanguard.ts` records `swungAt`, `swingKind`, `parryAt` and `parryPoint`.
Blocked stomps record a local contact point with a 120 ms minimum interval.
`HypotheticalVanguardArt.ts` consumes the motion and contact state; guard art also
adds a visual insignia for the bastion loader in `HypotheticalGuardArt.ts`.

`HypotheticalAudio.ts` adds four synthesized cues: `guard-swipe`, `guard-sweep`,
`guard-parry` and `guard-stomp`. `HypotheticalGame.ts` triggers them from simulation
timestamps near the player, using the existing effects route and preferences.

`HypotheticalGuardCues.ts` adds `drawBastionEdgeCue`: an indicator at the lower
screen edge when an awake Vanguard preparing or executing an attack is below
the camera. It shows horizontal position, move shape and preparation progress.

## Authoring material

The same source commit updates this directory's README, presentation, capture
metadata, replay input, silent gameplay video and pose images. It adds
`scripts/render_hypothetical_bastion_detail.ts`, updates
`scripts/render_hypothetical_vanguard_play.ts`, and refreshes
`tests/helpers/hypotheticalReplay.json`.

See [README.md](README.md) for capture provenance, simulation limits and the
distinction between rendered pose sheets and recorded gameplay. Those artifacts
are existing authoring evidence; they were not regenerated during deployment.

## Publication record

- Published source: `423597225ae8b43a4606db8d587964aa0f47ec5c`.
- Build: `423597225ae8b43a4606db8d587964aa0f47ec5c-5649986bc7a4`.
- Target: Oracle, through the repository's `npm run deploy` command.
- Recorded repeat deployment: 7.76 seconds; 0 of 217 payload files uploaded
  because their content was already cached on Oracle.
- Production Vite build completed. Tests, typecheck and browser review were not run,
  as requested by the user. Build success does not establish gameplay correctness.
- Local deployment receipt: ignored `.tmp/deploy/last.json`; each run replaces
  this receipt. Per-run logs remain under `.tmp/deploy/`.

Player: <https://torbware.space/jogar/super-feka-gaps/world/>.

This record identifies the gameplay release above. A subsequent documentation-only
commit has its own source/build identity when published, even if its game payload
is unchanged. Published commit messages are preserved; this note supplements them
without rewriting remote history.
