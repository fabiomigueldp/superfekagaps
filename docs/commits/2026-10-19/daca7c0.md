# daca7c0 — Add continuous varied background performances and camera-aware choreography

- Commit: [`daca7c01acc550beeb12ce7b92ebad39116a31dd`](https://github.com/fabiomigueldp/superfekagaps/commit/daca7c01acc550beeb12ce7b92ebad39116a31dd).
- Parent: `31b17efefae40718b481cf6d1c7258ed4335796f`.
- Scope: 40 changed paths, compared with the first parent.
- Original message: subject only; this record supplies the missing technical description.

## Behavior

Extend finite aftermath activity with repeatable performances selected within the visible yard.

## Implementation

Adds HypotheticalAftermathScore.ts with AFTERMATH_ACTIONS, AFTERMATH_SCORES, AFTERMATH_PROPS, aftermathActionTiming() and aftermathReach(). Initial recurring actions are ram, stomp, rake, tail, fire and bellow. HypotheticalAftermath adds planning, movement/orientation, performance and recovery states; scene and audio integration forwards the new actions through existing rendering and effects routes.

## Scope and limitations

Adds continuous-background-2026-10-19 pose sheets, video and state records, and updates the aftermath authoring renderer. Recurring actions operate on surviving wreckage rather than recreating destroyed buildings or escaped actors. Later commits replace the initial fixed action ordering.

## Recorded publication and validation

No successful per-commit publisher receipt was found in the retained local deployment logs during this review. This does not establish whether the commit was published elsewhere or as part of a later descendant. No per-commit test pass is inferred.

This retrospective used Git objects, committed source, existing documentation and local publisher receipts. No tests, typecheck, browser review or authoring renders were run. Existing test files and generated media are inventoried; their presence alone is not execution evidence.

## Complete file inventory

Paths link to this commit's immutable tree, not the current working copy. PNG/MP4/JSON files under docs are authoring outputs; public assets are separately identified. Line counts describe the patch and are not a measure of feature size.

| Status | Path at this commit | Role | Text delta |
| --- | --- | --- | --- |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/README.md](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/README.md) | Documentation / authoring output | +47 / -0 |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/activity-board.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/activity-board.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/arsenal-ariete.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/arsenal-ariete.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/arsenal-caudada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/arsenal-caudada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/arsenal-pisada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/arsenal-pisada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/arsenal-rajada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/arsenal-rajada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/arsenal-remexer.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/arsenal-remexer.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/arsenal-rugido.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/arsenal-rugido.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/art-study.json](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/art-study.json) | Documentation / authoring output | +3771 / -0 |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/bastiao-ariete.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/bastiao-ariete.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/bastiao-caudada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/bastiao-caudada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/bastiao-pisada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/bastiao-pisada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/bastiao-rajada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/bastiao-rajada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/bastiao-remexer.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/bastiao-remexer.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/bastiao-rugido.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/bastiao-rugido.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/cais-ariete.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/cais-ariete.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/cais-caudada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/cais-caudada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/cais-pisada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/cais-pisada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/cais-rajada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/cais-rajada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/cais-remexer.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/cais-remexer.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/cais-rugido.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/cais-rugido.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/continuous-background.mp4](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/continuous-background.mp4) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/index.html](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/index.html) | Documentation / authoring output | +26 / -0 |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/portaria-ariete.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/portaria-ariete.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/portaria-caudada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/portaria-caudada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/portaria-pisada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/portaria-pisada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/portaria-rajada.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/portaria-rajada.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/portaria-remexer.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/portaria-remexer.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/portaria-rugido.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/portaria-rugido.png) | Documentation / authoring output | binary |
| A | [docs/world/hipotetico/continuous-background-2026-10-19/poster.png](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/continuous-background-2026-10-19/poster.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/living-background-2026-10-19/index.html](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/living-background-2026-10-19/index.html) | Documentation / authoring output | +1 / -0 |
| M | [docs/world/hipotetico/mega-boss-2026-10-18/index.html](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/docs/world/hipotetico/mega-boss-2026-10-18/index.html) | Documentation / authoring output | +1 / -0 |
| M | [scripts/render_hypothetical_aftermath.ts](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/scripts/render_hypothetical_aftermath.ts) | Authoring tool | +27 / -12 |
| M | [src/adventure/hipotetico/HypotheticalAftermath.ts](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/src/adventure/hipotetico/HypotheticalAftermath.ts) | Runtime source | +196 / -24 |
| M | [src/adventure/hipotetico/HypotheticalAftermathArt.ts](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/src/adventure/hipotetico/HypotheticalAftermathArt.ts) | Runtime source | +56 / -3 |
| A | [src/adventure/hipotetico/HypotheticalAftermathScore.ts](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/src/adventure/hipotetico/HypotheticalAftermathScore.ts) | Runtime source | +25 / -0 |
| M | [src/adventure/hipotetico/HypotheticalArt.ts](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/src/adventure/hipotetico/HypotheticalArt.ts) | Runtime source | +9 / -3 |
| M | [src/adventure/hipotetico/HypotheticalAudio.ts](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/src/adventure/hipotetico/HypotheticalAudio.ts) | Runtime source | +2 / -1 |
| M | [src/adventure/hipotetico/HypotheticalGame.ts](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/src/adventure/hipotetico/HypotheticalGame.ts) | Runtime source | +1 / -1 |
| M | [src/adventure/hipotetico/HypotheticalModel.ts](https://github.com/fabiomigueldp/superfekagaps/blob/daca7c01acc550beeb12ce7b92ebad39116a31dd/src/adventure/hipotetico/HypotheticalModel.ts) | Runtime source | +1 / -1 |
