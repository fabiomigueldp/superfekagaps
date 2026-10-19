# 23cfee3 — feat(hipotetico): plant dinosaur feet and propagate yard vibrations

- Commit: [`23cfee361474c3fa9fee89eecf1ed8b8377154ea`](https://github.com/fabiomigueldp/superfekagaps/commit/23cfee361474c3fa9fee89eecf1ed8b8377154ea).
- Parent: `e82c90f93badda7f53240b5497b3c8dbf2e95a47`.
- Scope: 8 changed paths, compared with the first parent.
- Original message: subject only; this record supplies the missing technical description.

## Behavior

Plant the dinosaur feet during background effort and propagate local impact vibration to nearby fittings.

## Implementation

HypotheticalAftermathFooting.ts adds PlantedFeet and aftermathFooting(). It repositions feet before effort, compensates root movement during the pull and releases the stance afterward. dinosaurLeg() accepts an explicit plantedFoot, consumed by HypotheticalArt. AftermathEnvironment adds YardImpulse, yardImpulseAge(), yardVibration() and disturb(), with travel delay, distance decay and bounded impulse storage.

## Scope and limitations

Updates material-response authoring and tower integration. Nearby impacts are coalesced rather than restarting the vibration for every fragment. This is a pose/environment change, not a change to player collision.

## Recorded publication and validation

A successful local publisher receipt identifies build `23cfee361474c3fa9fee89eecf1ed8b8377154ea-0b464d4f7290` for this exact source commit. The report records `node node_modules/vite/bin/vite.js build`, `tests: not-run` and `publicationMode: manual-no-tests`. Its build-log SHA-256 is `4ed0e379c18254ef3951ef50fa4075a9cb186c40c8a348adaae75263ed96d252`. This establishes recorded build/publication completion, not gameplay correctness.

This retrospective used Git objects, committed source, existing documentation and local publisher receipts. No tests, typecheck, browser review or authoring renders were run. Existing test files and generated media are inventoried; their presence alone is not execution evidence.

## Complete file inventory

Paths link to this commit's immutable tree, not the current working copy. PNG/MP4/JSON files under docs are authoring outputs; public assets are separately identified. Line counts describe the patch and are not a measure of feature size.

| Status | Path at this commit | Role | Text delta |
| --- | --- | --- | --- |
| M | [scripts/render_hypothetical_material_responses.ts](https://github.com/fabiomigueldp/superfekagaps/blob/23cfee361474c3fa9fee89eecf1ed8b8377154ea/scripts/render_hypothetical_material_responses.ts) | Authoring tool | +23 / -12 |
| M | [src/adventure/hipotetico/HypotheticalAftermath.ts](https://github.com/fabiomigueldp/superfekagaps/blob/23cfee361474c3fa9fee89eecf1ed8b8377154ea/src/adventure/hipotetico/HypotheticalAftermath.ts) | Runtime source | +31 / -7 |
| M | [src/adventure/hipotetico/HypotheticalAftermathEnvironment.ts](https://github.com/fabiomigueldp/superfekagaps/blob/23cfee361474c3fa9fee89eecf1ed8b8377154ea/src/adventure/hipotetico/HypotheticalAftermathEnvironment.ts) | Runtime source | +24 / -0 |
| M | [src/adventure/hipotetico/HypotheticalAftermathEnvironmentArt.ts](https://github.com/fabiomigueldp/superfekagaps/blob/23cfee361474c3fa9fee89eecf1ed8b8377154ea/src/adventure/hipotetico/HypotheticalAftermathEnvironmentArt.ts) | Runtime source | +15 / -3 |
| A | [src/adventure/hipotetico/HypotheticalAftermathFooting.ts](https://github.com/fabiomigueldp/superfekagaps/blob/23cfee361474c3fa9fee89eecf1ed8b8377154ea/src/adventure/hipotetico/HypotheticalAftermathFooting.ts) | Runtime source | +21 / -0 |
| M | [src/adventure/hipotetico/HypotheticalArt.ts](https://github.com/fabiomigueldp/superfekagaps/blob/23cfee361474c3fa9fee89eecf1ed8b8377154ea/src/adventure/hipotetico/HypotheticalArt.ts) | Runtime source | +3 / -2 |
| M | [src/adventure/hipotetico/HypotheticalMotion.ts](https://github.com/fabiomigueldp/superfekagaps/blob/23cfee361474c3fa9fee89eecf1ed8b8377154ea/src/adventure/hipotetico/HypotheticalMotion.ts) | Runtime source | +2 / -2 |
| M | [src/adventure/hipotetico/HypotheticalTowerPhysics.ts](https://github.com/fabiomigueldp/superfekagaps/blob/23cfee361474c3fa9fee89eecf1ed8b8377154ea/src/adventure/hipotetico/HypotheticalTowerPhysics.ts) | Runtime source | +1 / -1 |
