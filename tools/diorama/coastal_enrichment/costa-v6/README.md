# Costa v6: portable Python source renderer

This is the source-only reproduction of the frozen Costa v6 art. It does not need any input `.blend` file or downloadable asset. The frozen PNG is not altered by these scripts unless you explicitly point the output at its directory.

## Copy into the repository

Keep `render_costa_v6.py`, `compare_scene_signatures.py`, and the `costa_source/` directory together, for example under `tools/diorama/coastal_enrichment/costa-v6/`. There are no hard-coded workspace paths in the Python sources.

The only repository inputs are:

- `public/assets/world/map/costa-diorama.meta.json`
- `public/assets/world/map/coast-port-journey.meta.json`

The first supplies the route/node/camera contract and is checked against the frozen authored geometry. The second supplies dock-access routes for validation. If these contracts change, update/review the renderer deliberately; do not suppress the assertions.

## Commands

Build, validate and render the 1920 × 1200 RGBA art:

    blender --factory-startup -b -t 10 -P tools/diorama/coastal_enrichment/costa-v6/render_costa_v6.py -- --repo-root /absolute/repo --output-dir /tmp/costa-v6-render

Build and validate without running Cycles, optionally retaining the generated scene for inspection:

    blender --factory-startup -b -t 10 -P tools/diorama/coastal_enrichment/costa-v6/render_costa_v6.py -- --repo-root /absolute/repo --output-dir /tmp/costa-v6-check --no-render --save-scene

Optional verification against a local frozen reference, without rendering:

    blender --factory-startup -b -P tools/diorama/coastal_enrichment/costa-v6/compare_scene_signatures.py -- --reference /local/reference.blend --rebuilt /tmp/costa-v6-check/costa-v6.blend --report /tmp/costa-v6-check/scene-comparison.json

Use `--preview` for a 960 × 600 render. Use `--shadow` only if the optional contact-shadow fallback is wanted; the current atlas integration does not need that layer. `--keep-intermediates` retains procedural checkpoints for debugging. `--save-scene` retains the final generated scene; omit it for ordinary asset builds.

## How the dependency is removed

The driver runs the captured original geometry source, the first enrichment, the stronger v3 enrichment (including its shoreline refinement), naturalization v4, shape refinement v5, and finally the frozen v6 script. All stages are plain Python.

Historical v4 restores material assignments from the v1 scene. To preserve this behavior exactly, the driver generates temporary v1/v3/v4/v5 `.blend` checkpoints inside a unique staging directory under `--output-dir`. It reloads those checkpoints between stages, matching Blender's original orphan-data reset behavior. These are generated intermediates, not source dependencies, and are removed by default after validation. No large scene needs to be committed.

Intermediate renders are disabled. A normal run renders only the final v6 image; `--no-render` invokes no Cycles render at all. The final v6 geometry, palette, shoreline, camera and static-art scope are unchanged.

## Outputs

- `costa-v6-final.png` (or `costa-v6-preview.png`)
- `costa-v6-audit.json`
- `independent-validation.json`
- Copied route contracts for traceability
- `source-rebuild-receipt.json`, including source-only status and output hashes
- Optional `costa-v6.blend` and `costa-v6-shadow.png`

Use the image as the existing atlas-art replacement; do not add a new runtime layer just because the optional shadow renderer is available. The asset is static and adds no animation.

## Verification

Tested with Blender 4.3.2. Full art uses 64 Cycles samples with denoising disabled, since this build has no OpenImageDenoise support. Geometry/material/camera comparison can verify scene reconstruction without rerendering the frozen image; this does not claim byte-identical stochastic raster output on other Blender versions or hardware.

The scene-equivalence record is in `docs/world/diorama/costa-source-equivalence.json`. No repository files, deployments, or Oracle services were changed to produce this package.
