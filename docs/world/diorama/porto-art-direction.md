# Porto do Bielzão: map-diorama candidate

Original procedural Blender artwork for the actual world-2 campaign, in the same sRGB material pipeline, elevated orthographic camera family and warm crafted style as Costa. This layer is independent of the finished Costa art and the existing distant Porto miniature.

## Sources and campaign hierarchy

- `src/adventure/campaign.ts`, world 2 and its B1 encounter
- `docs/world/campanha.md`, stages 2-1 through 2-5
- Actual pixels of `docs/world/conceitos/imagens/02-porto-do-bielzao.png`

The five fixed landings are:

1. **2-1 Carga Chegando:** arrival pier, tug and broad supported loading ramp
2. **2-2 Peso e Contrapeso:** counterweight berth and control pedestal
3. **2-3 Entre os Contêineres:** open courtyard between cargo stacks
4. **2-4 Expediente Pesado:** waiting/loading apron before the upper dock
5. **2-5 Mestre das Cargas:** raised operations platform and cabin under the main gantry

The physical secret connection branches from 2-3 through a narrow supported maintenance catwalk and joins 2-5 without going through 2-4. Buildings, containers, crane legs and railings are kept outside authored walking corridors. The rising catwalk reaches its full height before its turning landing begins. Flush timber plates bridge the fascia/ramp transitions.

## Craft pass

Warm plank faces and fascia, fixings, steel container corners/door bars, cabin framing, fenders and mooring rope, a gunwale/window/fender treatment for the tug, connected hook/bridle/slings, and low coastal rock/scrub behind the quay. The five circles used in the composition prototype were replaced by subtle painted loading-corner marks. No stage numerals, labels, characters or UI are baked into the render.

The suspended load was moved into the outer-right lifting bay after a diagnostic revealed that its initial projection crossed the secret route. Its beam, hoist, cable, hook and load connections moved together. Camera, anchors and route coordinates remain identical to the approved prototype. There are no Boolean operations.

## Files and rendering

- Canonical model: `tools/diorama/render_porto_map.py`
- Read-only checks: `tools/diorama/check_porto_clearance.py`
- Cached final render: `tools/diorama/render_porto_cached.py`
- Packaging: `tools/diorama/package_porto_map.py`
- Runtime: `public/assets/world/map/porto-diorama.webp` and `porto-diorama.meta.json`
- Local originals/review: `porto-diorama.png`, `.lossless.webp` and `porto-diorama-preview.png`

Blender 4.3.2, Cycles CPU, transparent film, AgX Medium High Contrast. The prototype uses 32 samples at 960×600; the main render uses 192 samples at 1920×1200. Denoising is disabled because the installed build does not provide OpenImageDenoise.

From repository root:

```sh
blender -b -t 12 --python-exit-code 1 -P tools/diorama/render_porto_map.py
blender -b -t 12 --python-exit-code 1 -P tools/diorama/render_porto_map.py -- --final
python tools/diorama/package_porto_map.py
```

For an existing temporary scene, the final can be reproduced without constructing geometry again:

```sh
blender -b /tmp/porto-map-prototype.blend -t 12 --python-exit-code 1 -P tools/diorama/render_porto_cached.py
python tools/diorama/package_porto_map.py
```

The temporary Blender file is not committed or required for full reproduction.

The canonical build passes its freshly generated route/camera metadata directly to the checker; it does not require or read a previous metadata export. To rebuild and audit the source without rendering, replacing the temporary scene, or changing production metadata:

```sh
blender -b -t 12 --python-exit-code 1 -P tools/diorama/render_porto_map.py -- --final --audit-only
```

Audit-only writes fresh metadata and reports to a new scratch directory printed in `PORTO_AUDIT_ONLY_COMPLETE`; it does not claim newly rendered alpha bounds. The checker rejects zero samples, obstructions, unsupported paths or projected conflicts before saving accepted metadata or rendering. Packaging checks these gates and the frozen coordinates before replacing any output, then derives exact bounds from the approved 1920×1200 PNG. `--python-exit-code 1` makes Blender script failures visible to shell callers. The cached-scene helper intentionally audits its accompanying on-disk metadata; a fresh source build does not have that dependency.

## Coordinate and payload contract

Full 8:5 framing, top-left normalized image coordinates, world Z up. Metadata identifies `world: 2`, nodes `2-1` to `2-5`, local main-route keys `0:1` to `3:4`, and `secretRoute` from `2-3` to `2-5`. Endpoint values exactly equal their corresponding node coordinates. `artBounds` comes from the actual PNG alpha silhouette, excluding any shadow.

Final alpha bounds: pixels `[277,153,1622,1077]`, normalized top `0.1275`, bottom `0.8975`. The accepted footprint remains approximately x `.144–.845`. Runtime payload: **187,342 bytes** (WebP quality 91: 181,346; metadata: 5,996). No optional distant layer or factory layer is added. Loading remains the runtime owner's per-world/lazy responsibility.

## Verification and limits

- `porto-prototype-clearance.json`: 666 center/edge headroom checks and 666 walkable-support checks; zero obstructions or unsupported samples
- `porto-projected-clearance.json`: 273 projected route/actor-envelope samples against the suspended-load assembly; zero overlaps
- Maximum rise between route samples: 0.0643 world units; the routes use continuous ramps rather than oversized stair risers
- `porto-art-manifest.json`: byte counts, full-resolution alpha bounds and SHA-256 hashes
- Frozen nodes, route polylines, world coordinates and camera are asserted against `porto-prototype-approved.meta.json` during packaging
- Decoded lossless WebP matches every RGBA byte of the PNG
- Source files parse successfully; finished Costa sources, assets and audits were not modified
- Fresh-source audit succeeds without prior metadata and with deliberately invalid stale metadata; audit-only leaves production artifacts untouched
- Packaging rejects changed frozen routes, failed support checks and zero projected samples before replacing any artifact

The projected envelope is conservative but finite (half-width `.035`, height `.105` of the 8:5 image). This is model/art evidence, not proof of every responsive HUD state or browser performance. The parent integration task owns actual browser/phone layout, movement, loading and gameplay validation. No commit or publication is performed by the art pipeline.
