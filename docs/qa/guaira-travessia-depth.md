# Travessia: sluice, rice banks and combined crossing

## Authored route

The first sluice remains the existing learn-by-doing plate and rising deck. The former flat run after its checkpoint now becomes three rice-bank landings. A lower service channel is a safe optional coin route, with a clear jump back to the shared bank. The final canal asks the player to repeat the plate action, cross the second deck and jump to the raised corral bank. No enemy spam or additional combat rule was added.

- Stage remains `guaira-travessia`; 96 × 18 tiles, finish at x1472.
- Native `switch`/gated `lift` pairs; no new engine mechanism, save schema or campaign receipt.
- 17 coins, all optional. Deterministic upper route collects 13, maintenance route 14. These routes do not claim a 17/17 sweep.
- Checkpoints: index 0 at (656,224), index 1 at (1024,224), index 2 at (1408,192). Native checkpoint coordinates are tile-based in stage data.
- Checkpoints 0 and 1 reconstruct the first solved sluice. Checkpoint 2 reconstructs both. The second plate stays unsolved when returning to checkpoint 1. Explicit retry clears both sluices and attempt coins; native death retains collected coin IDs/count.

## Evidence and limits

Automated real Input → Player → WorldObjects keyboard replays complete both routes with no death and an intact helmet. All three checkpoints are observed. Tests also run the native death/rebuild pipeline from the two new checkpoints and sweep running-jump attempts at the closed final canal. These are automated gameplay checks, not a manual playtest. Existing touch cancellation/jump/sentada tests still run; a full touch-only completion is not claimed.

- `tests/helpers/guairaTraversalReplay.json`: upper bank route.
- `tests/helpers/guairaTraversalMaintenanceReplay.json`: lower maintenance route.
- `tests/guaira-traversal-depth.test.ts`: route, reward, recovery and bypass assertions.
- `tools/guaira/render_traversal_depth.mts`: same native replay, production renderer and real Canvas pixels. Captures assert render does not mutate simulation. Pass an output directory and optional `maintenance`; set `TRAVERSAL_CANVAS_MODULE` to an installed `@napi-rs/canvas` if needed.

Example: `TRAVERSAL_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/render_traversal_depth.mts /tmp/traversal-proof maintenance`.

Rendered frames were inspected for upper-bank caps, the lower passage, the final plate, moving deck, raised landing and completion. The foreground irrigation channel was split so it cannot paint over the new walkable bank edges; the rice worker stands above the new bank. Proof captures are generated outside public assets.
