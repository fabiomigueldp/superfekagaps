# Casa da Vazão retaining-face refinement

The civic terrace had a broad smooth clay face beneath its masonry building.
Thirty fitted sandstone blocks now explain the raised civic platform, using the
same quiet stone family as the reservoir and village footings. They follow the
existing nine-sided terrace profile, rather than replacing its shape or growing
the island. The sloping road stays open. No landmark, road, terminal or flight
scenery was added or moved.

## Exact scope

- `tools/diorama/guaira/terrace_guaira.py` is the authored geometry/material pass.
  Its hook in `build_guaira.py` also makes the shared campaign builder reproduce it.
- Only the two existing chapter/atlas Guaíra WebPs change visually. Their canonical
  1920 × 1200 frames, alpha/silhouette and original crop bounds remain exact.
- Existing object geometry, materials, walk meshes, water surfaces, cameras and
  lights are preserved. This includes the Bairro stone receiver and its separate
  water restoration assets; no water mask or runtime vector changes.
- The runtime metadata update records image byte size and object count only.
  Every node, route, world route, terminal anchor, camera and placement is retained.
- The bounded packager changes source RGB only at the visible retaining face and
  its small contact-shadow neighborhood. The remainder of each already-authored
  image is copied from the reviewed baseline, so earlier local patches survive.
  WebP's lossy RGB re-encoding can introduce small differences beyond that area;
  the report measures them separately. Alpha remains bit-exact after encoding.

The paired JPGs are native raster compositions of the actual runtime WebPs on a
solid background. They are not browser screenshots or evidence of device/FPS QA.

## Reproduction

Use the original baseline commit
`c1bd522463b23998e68272542f13558dbf63edc6`, never the previous output of this pass.
The packager rejects other baseline hashes, including its own output, to prevent
cumulative recompression. PIL and NumPy are packaging dependencies; neither ships.
Blender 4.3.2 / Cycles CPU uses 48 samples for chapter, 32 for campaign.

```sh
mkdir -p /tmp/guaira-terrace-rebuild/chapter
BASE=c1bd522463b23998e68272542f13558dbf63edc6
PROOF=/tmp/guaira-terrace-rebuild
git show "$BASE:public/assets/world/experimental/guaira/guaira-diorama.webp" > "$PROOF/chapter-before.webp"
git show "$BASE:public/assets/world/map/guaira-campaign/guaira.webp" > "$PROOF/atlas-before.webp"
blender -b -t 4 -P tools/diorama/guaira/build_guaira.py -- --output-dir "$PROOF/chapter"
blender -b -t 4 -P tools/diorama/guaira_campaign/build.py -- --region guaira
blender -b "$PROOF/chapter/guaira-diorama.blend" -t 4 -P tools/diorama/guaira/export_terrace_mask.py -- "$PROOF/chapter-mask.png"
blender -b /tmp/feka-guaira-campaign.blend -t 4 -P tools/diorama/guaira/export_terrace_mask.py -- "$PROOF/atlas-mask.png"
python tools/diorama/guaira/package_terrace_guaira.py --baseline "$PROOF/chapter-before.webp" --render "$PROOF/chapter/guaira-diorama.png" --mask "$PROOF/chapter-mask.png" --quality 92 --output "$PROOF/chapter.webp" --master "$PROOF/chapter-master.png" --report "$PROOF/chapter-package.json"
python tools/diorama/guaira/package_terrace_guaira.py --baseline "$PROOF/atlas-before.webp" --render public/assets/world/map/guaira-campaign/guaira.png --mask "$PROOF/atlas-mask.png" --quality 91 --output "$PROOF/atlas.webp" --master "$PROOF/atlas-master.png" --report "$PROOF/atlas-package.json"
```

The existing campaign builder writes a raw metadata export without packaged image
fields. Preserve the reviewed metadata and update only its measured image bytes
and scene object count after packaging. Do not publish raw PNGs, `.blend` caches,
emission masks or the unbounded full-frame color rerenders.

## Validation

`validation.json` records original/current asset hashes and sizes, alpha checks,
source-patch bounds, codec drift, unmodified metadata/water contracts, and geometry
results. The existing native Feka differential audit checks all seven sprite
frames in both directions, with five subpixel probes per opaque pixel along 203
route samples: 643,510 rays and 609 floor probes. Existing bottom-sprite/floor
contacts and two bridge-gap lateral floor probes are reported as inherited, not
presented as zero. The new facing adds no contacts, unsupported probes or headroom
obstructions. All 2,456 original objects and 55 used materials remain unchanged.

Focused tests:

```sh
node --import tsx --test tests/guaira-campaign-art.test.ts tests/guaira-campaign-consequences.test.ts tests/guaira-map.test.ts tests/guaira-bairro-navigation.test.ts
python -m py_compile tools/diorama/guaira/terrace_guaira.py tools/diorama/guaira/export_terrace_mask.py tools/diorama/guaira/package_terrace_guaira.py
```

No full suite, browser/device run, deployment or Oracle access is claimed by this
art-only change. Full integration validation remains a separate release step.
