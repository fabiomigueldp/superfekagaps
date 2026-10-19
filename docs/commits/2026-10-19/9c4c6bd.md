# 9c4c6bd — Enhance tower rubble petista capture with multi-piece dismemberment and gore physics

- Commit: [`9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1`](https://github.com/fabiomigueldp/superfekagaps/commit/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1).
- Parent: `7807bcbeb06a9593345193ad5e7a327d0ce44b9d`.
- Scope: 58 changed paths, compared with the first parent.
- Original message: subject only; this record supplies the missing technical description.

## Behavior

Update tower-search stain rendering and authoring evidence, add helicopter simulation and arrival timing hooks, and include the first 22 retrospective commit records and deployment message support.

## Implementation

HypotheticalTowerSearchArt adjusts stain dimensions and limits short drips to large elevated stains. The tower README and art-study.json now describe the staged fragment sequence, with updated PNGs. New HypotheticalHelicopter.ts defines aircraft bodies, swept hull contact, flight, rocket, breakup and ground-contact state. HypotheticalHelicopterTiming.ts inserts a 372-frame interval at story frame 304 through arrivalBeat()/arrivalStoryTime(); arrival, devastation, crowd and scenery clocks use the mapping. HypotheticalBackdrop owns and updates the helicopter, and HypotheticalModel forwards its events. HypotheticalTowerEffects exports drawScenicRocket() for reuse. scripts/deploy.mjs adds --message-file and commit -F, plus explicit --no-commit --allow-dirty publication of committed HEAD.

## Scope and limitations

The subject does not cover the complete patch: this commit also includes docs/commits/2026-10-19/ and docs/deploy.md from the concurrent documentation work. Core multi-piece tower-search simulation already exists in 7807bcb; this revision refines its art and records. Helicopter rendering and dedicated rotor/engine audio are not connected here: the patch adds simulation/timing hooks but no helicopter art module or corresponding Game/Audio routing. Do not describe it as a complete visible helicopter encounter.

## Recorded publication and validation

A successful local publisher receipt identifies build `9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1-f5b9bbf9253b` for this exact source commit. The report records `node node_modules/vite/bin/vite.js build`, `tests: not-run` and `publicationMode: manual-no-tests`. Its build-log SHA-256 is `b400477b8db5c720fef3153160f7c4854fe93f4111e5fe08270a7a3f0238e350`. This establishes recorded build/publication completion, not gameplay correctness.

This retrospective used Git objects, committed source, existing documentation and local publisher receipts. No tests, typecheck, browser review or authoring renders were run. Existing test files and generated media are inventoried; their presence alone is not execution evidence.

## Complete file inventory

Paths link to this commit's immutable tree, not the current working copy. PNG/MP4/JSON files under docs are authoring outputs; public assets are separately identified. Line counts describe the patch and are not a measure of feature size.

| Status | Path at this commit | Role | Text delta |
| --- | --- | --- | --- |
| A | [docs/commits/2026-10-19/0352fae.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/0352fae.md) | Documentation / authoring output | +41 / -0 |
| A | [docs/commits/2026-10-19/0ece972.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/0ece972.md) | Documentation / authoring output | +53 / -0 |
| A | [docs/commits/2026-10-19/1571adc.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/1571adc.md) | Documentation / authoring output | +65 / -0 |
| A | [docs/commits/2026-10-19/23cfee3.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/23cfee3.md) | Documentation / authoring output | +39 / -0 |
| A | [docs/commits/2026-10-19/2590a86.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/2590a86.md) | Documentation / authoring output | +73 / -0 |
| A | [docs/commits/2026-10-19/31b17ef.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/31b17ef.md) | Documentation / authoring output | +70 / -0 |
| A | [docs/commits/2026-10-19/61b6bcf.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/61b6bcf.md) | Documentation / authoring output | +37 / -0 |
| A | [docs/commits/2026-10-19/63f7e11.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/63f7e11.md) | Documentation / authoring output | +40 / -0 |
| A | [docs/commits/2026-10-19/675e808.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/675e808.md) | Documentation / authoring output | +60 / -0 |
| A | [docs/commits/2026-10-19/7807bcb.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/7807bcb.md) | Documentation / authoring output | +34 / -0 |
| A | [docs/commits/2026-10-19/791cc3a.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/791cc3a.md) | Documentation / authoring output | +55 / -0 |
| A | [docs/commits/2026-10-19/893228c.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/893228c.md) | Documentation / authoring output | +36 / -0 |
| A | [docs/commits/2026-10-19/9703bb9.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/9703bb9.md) | Documentation / authoring output | +74 / -0 |
| A | [docs/commits/2026-10-19/README.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/README.md) | Documentation / authoring output | +51 / -0 |
| A | [docs/commits/2026-10-19/bac366d.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/bac366d.md) | Documentation / authoring output | +41 / -0 |
| A | [docs/commits/2026-10-19/c559543.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/c559543.md) | Documentation / authoring output | +42 / -0 |
| A | [docs/commits/2026-10-19/c667ac3.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/c667ac3.md) | Documentation / authoring output | +49 / -0 |
| A | [docs/commits/2026-10-19/c90a690.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/c90a690.md) | Documentation / authoring output | +34 / -0 |
| A | [docs/commits/2026-10-19/cc28f3d.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/cc28f3d.md) | Documentation / authoring output | +39 / -0 |
| A | [docs/commits/2026-10-19/daca7c0.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/daca7c0.md) | Documentation / authoring output | +71 / -0 |
| A | [docs/commits/2026-10-19/e818e24.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/e818e24.md) | Documentation / authoring output | +50 / -0 |
| A | [docs/commits/2026-10-19/e82c90f.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/e82c90f.md) | Documentation / authoring output | +63 / -0 |
| A | [docs/commits/2026-10-19/f3488a2.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/commits/2026-10-19/f3488a2.md) | Documentation / authoring output | +41 / -0 |
| M | [docs/deploy.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/deploy.md) | Documentation / authoring output | +14 / -0 |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/README.md](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/README.md) | Documentation / authoring output | +15 / -5 |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/art-study.json](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/art-study.json) | Documentation / authoring output | +63 / -13 |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/assentamento.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/assentamento.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/captura.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/captura.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/descoberta.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/descoberta.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/desfecho.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/desfecho.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/disparo.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/disparo.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/explosao.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/explosao.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/farejar.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/farejar.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/ignicao.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/ignicao.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/investida.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/investida.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/mirar.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/mirar.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/mordida.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/mordida.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/quebra.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/quebra.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/queda.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/queda.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/retomada.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/retomada.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/revirar.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/revirar.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/ruinas.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/ruinas.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/ruptura.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/ruptura.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/sacar.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/sacar.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/storyboard.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/storyboard.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/torre.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/torre.png) | Documentation / authoring output | binary |
| M | [docs/world/hipotetico/tower-cinematic-2026-10-19/voo.png](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/docs/world/hipotetico/tower-cinematic-2026-10-19/voo.png) | Documentation / authoring output | binary |
| M | [scripts/deploy.mjs](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/scripts/deploy.mjs) | Authoring tool | +18 / -4 |
| M | [src/adventure/hipotetico/HypotheticalAftermath.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalAftermath.ts) | Runtime source | +2 / -1 |
| M | [src/adventure/hipotetico/HypotheticalArrival.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalArrival.ts) | Runtime source | +2 / -1 |
| M | [src/adventure/hipotetico/HypotheticalBackdrop.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalBackdrop.ts) | Runtime source | +5 / -1 |
| M | [src/adventure/hipotetico/HypotheticalDevastation.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalDevastation.ts) | Runtime source | +4 / -3 |
| A | [src/adventure/hipotetico/HypotheticalHelicopter.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalHelicopter.ts) | Runtime source | +181 / -0 |
| A | [src/adventure/hipotetico/HypotheticalHelicopterTiming.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalHelicopterTiming.ts) | Runtime source | +5 / -0 |
| M | [src/adventure/hipotetico/HypotheticalModel.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalModel.ts) | Runtime source | +4 / -2 |
| M | [src/adventure/hipotetico/HypotheticalScenery.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalScenery.ts) | Runtime source | +2 / -1 |
| M | [src/adventure/hipotetico/HypotheticalTowerEffects.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalTowerEffects.ts) | Runtime source | +2 / -2 |
| M | [src/adventure/hipotetico/HypotheticalTowerSearchArt.ts](https://github.com/fabiomigueldp/superfekagaps/blob/9c4c6bd4886779c4b6626e9849f3f979cd5c9ff1/src/adventure/hipotetico/HypotheticalTowerSearchArt.ts) | Runtime source | +8 / -8 |
