# Checkpoint retry audit — 7 October 2026

Baseline: `32a14d672ef38f59125dc6dfb66a215e96e3cdd4`.

## Result

No checkpoint placement or retry-logic defect was established in the main World campaign. This change adds regression coverage only. It does not change terrain, checkpoint order/IDs, saves, progression, enemy tuning, or runtime behavior.

- All **56 checkpoints** were activated by a short native walking approach, followed by the real `Player.die` → death-animation → `WorldGame.restart` → `load` pipeline.
- All 56 spawn with a clear body and stable support. Two consecutive retries at every checkpoint retain a **two-second playable reaction window**, after the separate reveal finishes, with authored enemies and hazards active.
- The reveal does not advance mechanisms or spend the 1.5-second protection timer before controls return.
- Checkpoint index and helmet survive both native retry and serialized-save reload. The six boss retries do not replay an already dismissed introduction.
- All **50 course checkpoints** have an engine-backed geometry path from the initial spawn and onward to the normal exit after reset. This graph check models carrier endpoint/riding edges; it is not a full live-hazard campaign playthrough.
- Existing run-accounting regressions additionally verify that retries do not farm an already collected coin, seals remain permanent, equipment is available again, and segment resumes cannot overwrite full-stage records.

## Investigated pressure: 3-4 checkpoint 2

A ten-second idle sweep found one course checkpoint with damage pressure: in **Pressão Máxima (3-4), checkpoint index 1 at tile (133, 14)**, the pressure cannon at tile 158 sends a barrel to the idle player approximately **4.95 seconds after respawn**, including the reveal. The other 49 course checkpoints survived the whole ten-second idle sample.

This is not a forced retry loop. The new native witness:

1. Activates that checkpoint and completes the real death/restart flow.
2. Waits 91 playable frames, letting all protection expire.
3. Walks to tile 141; jumps to 147 on the raised factory floor.
4. Walks to 151; jumps over the next barrel to 160.
5. Uses the authored platform at 167, then lands at 174 and reaches the normal exit.

The witness retains actual cannon timing and terrain throughout. It uses no helmet, health/damage override, teleport after checkpoint activation, mechanism toggle, or progression shortcut. An initial script that waited longer and walked into the approaching barrel failed; the successful route demonstrates ordinary visible challenge rather than indefinite checkpoint immunity. No production adjustment was justified.

## Supplemental Delícia sampling

A simulation-only sample of all **38 Delícia checkpoints**, including optional shrines, found stable support and no automatic gap return during ten seconds idle. Three had enemy contact after more than 2.38 seconds: Delícia 2 checkpoint 1, Delícia 9 checkpoint 3, and Santuário das Raízes checkpoint 3. These are exposure observations, not diagnosed defects. This supplemental sample did not exercise the app's full death/retry UI pipeline or prove every resumed route.

## Reproduce the main-campaign regression

`node --import tsx --test tests/world-checkpoint-retry.test.ts tests/world-checkpoint-storage.test.ts tests/world-checkpoint-feedback.test.ts tests/world-run-accounting.test.ts`

Result: **19/19 passing**. Tools/tests TypeScript check also passed with `tsc -p tsconfig.tools.json --noEmit`.

The detailed idle sampler is `tools/qa/audit_checkpoint_retry.mts`; run it with `node --import tsx tools/qa/audit_checkpoint_retry.mts` to emit JSON for all 56 checkpoints.

No full aggregate gate, browser/rendered QA, push, integration, or deployment was performed for this isolated audit.
