# Factory ramp guardrail contacts

The approved Factory camera exposed detached lower ends on the guardrail uprights beside both ramps. Their nominal centerline sits 0.08 units beyond the lane edge; the evaluated upright-vertex-to-slab gaps range from 0.052 to 0.119 units because the ramp edges are mitered and beveled.

The bounded correction adds twelve blue-enamel socket shoes and twelve short transverse mounting ties. Each tie's inner endpoint is seated 0.045 units below a downward ray hit on the actual ramp slab. This matters: simply subtracting a fixed height from the route center does not account for the mitered edges. The existing posts, rails, slab tops, stringers, landings, terrain, tank, camera and lights are unchanged. No platform or Factory–Serra bridge is added.

## Verification

- `check_factory_guardrail_mounts.py` verifies each original post → socket → tie → actual slab chain with world-space BVH intersections of evaluated mesh triangles. It does not approve contacts from overlapping bounding boxes alone. The original scene is a negative control: zero of twelve connected chains; the candidate has twelve of twelve.
- Fresh baseline/candidate scene comparison preserves all 1,031 original objects, including geometry, transforms and material slots. Polygon storage order is canonicalized while preserving vertex winding. Only the 24 small mounting parts are new.
- The existing Factory support/headroom, actor projection and billboard checks remain required. Exact results, alpha checks and payload hashes are recorded in `factory-guardrail-validation.json`.
- Factory's campaign airport is a separate overlay with `replacesBase=false`. Both the atlas and flight scene retain the same `fabrica-diorama.webp` base beneath it. The overlay and all metadata remain byte-identical; no campaign generator change is needed.

Reproduce the scene with the existing canonical Factory renderer, then audit its disposable Blender scene:

```sh
blender -b -t 8 --python-exit-code 1 -P tools/diorama/render_fabrica_map.py -- --scene-only --output-dir .cache/diorama/fabrica
blender -b .cache/diorama/fabrica/fabrica-map-prototype.blend -t 4 --python-exit-code 1 \
  -P tools/diorama/check_factory_guardrail_mounts.py -- --output-dir .cache/diorama/fabrica/audit
```

The canonical renderer stages its scene, PNG and audit metadata under the chosen output directory. See fabrica.md for the current cache provenance, render, packaging and review commands. Only the reviewed quality-91/method-6 WebP belongs in a runtime replacement; packaging preserves published camera, nodes, routes and metadata after verifying alpha bounds. PNGs, Blender files and side-by-side review media remain outside Git. Native renders and compositing are visual proof; no browser verification is claimed.
