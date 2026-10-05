# Guaíra full-scene redesign export

The chapter and atlas use the same authored geometry with distinct cameras.
Export both. The historical Bairro/terrace bounded-patch packagers are not used
for a whole-scene redesign or camera reframe.

## Contracts

- Keep chapter image 1920 × 1200, orthographic scale 20.6 and camera orientation.
  A camera translation is supported when every projected artifact is regenerated.
- Preserve the five `guaira-*` node identities, four route edges and chapter scene
  IDs. Existing navigation, save receipts and legacy Serra access stay independent
  of art and decorative mask IDs.
- Regenerate chapter metadata (node/route projections, `artBounds`) with full art.
- Regenerate visible-water emission mask from the final scene, including every
  new bank, rice plant and building occluder. `package_water.py` measures disjoint
  source crops and packs four reusable atlas regions; atlas decode plus scratch
  must remain below 1 MiB. Channel ribbons remain four ordered vertices and use
  `Clean turquoise water`; flowing names and paddy names drive decorative motion.
- Regenerate the tiny Bairro water vectors even if only the chapter camera moved.
  The public receiver's hidden source meshes must remain in the saved scene.
- Regenerate atlas metadata and full art with its own camera and boarding anchors.
- Regenerate the earned-water holdout from the final atlas scene. Its glints derive
  from actual channel quads, including lower bridge water. Then regenerate motion
  crops from the resulting alpha; they are not screen-coordinate constants.
- There is no runtime scenery depth texture. The map draws Feka above the base,
  so evaluated-mesh body/head clearance and actual terrain backing are required.

## Commands after final chapter/campaign builds

Run from the repository. Replace INPUT paths with the coordinator's render dirs.
Keep Blender, full PNGs and intermediate source JSON outside `public/`.

```sh
CHAPTER=/tmp/guaira-redesign-proof/after/chapter
CAMPAIGN=/tmp/guaira-redesign-proof/after/campaign
WATER=/tmp/guaira-redesign-proof/after/water
BLENDER=blender
$BLENDER -b "$CHAPTER/guaira-diorama.blend" --python-exit-code 1 -t 4 -P tools/diorama/guaira/export_water_mask.py -- --output-dir "$WATER"
python tools/diorama/guaira/package_guaira.py --input "$CHAPTER" --output public/assets/world/experimental/guaira
python tools/diorama/guaira/package_water.py --input "$WATER" --asset-output public/assets/world/experimental/guaira --data-output src/adventure/experimental/guaira/GuairaWaterData.json --source-commit "$(git rev-parse HEAD)"
mv public/assets/world/experimental/guaira/guaira-water-cost.json "$WATER/guaira-water-cost.json"
$BLENDER -b "$CHAPTER/guaira-diorama.blend" --python-exit-code 1 -t 4 -P tools/diorama/guaira/export_bairro_water.py -- --output-dir "$WATER/bairro"
cp "$WATER/bairro/GuairaBairroWaterData.json" src/adventure/experimental/guaira/chapter/GuairaBairroWaterData.json
python tools/diorama/guaira_campaign/package.py --region guaira --input-dir "$CAMPAIGN" --output-dir public/assets/world/map/guaira-campaign
$BLENDER -b "$CAMPAIGN/guaira-campaign.blend" --python-exit-code 1 -t 4 -P tools/diorama/guaira_campaign/build_restored_water.py -- --output-dir "$CAMPAIGN"
python tools/diorama/guaira_campaign/package_restored_water.py --input "$CAMPAIGN/guaira-water-restored.png" --source "$CAMPAIGN/restored-water-source.json"
```

## Focused proof

```sh
python tools/diorama/guaira/test_water_regions.py
node --import tsx tools/diorama/guaira/export_guaira_actor.mjs /tmp/guaira-redesign-proof
blender -b --python-exit-code 1 -t 4 --python-exit-code 1 -P tools/diorama/guaira/audit_redesign_routes.py -- --baseline /tmp/guaira-redesign-proof/before/chapter.blend --candidate "$CHAPTER/guaira-diorama.blend" --metadata "$CHAPTER/guaira-diorama.meta.json" --actor /tmp/guaira-redesign-proof/feka-actor-source.json --output /tmp/guaira-redesign-proof/route-audit.json
WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/render_redesign_routes.mts /tmp/guaira-redesign-proof/native
WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/render_campaign_water_motion.mts /tmp/guaira-redesign-proof/native-campaign
node --import tsx --test tests/guaira-water.test.ts tests/guaira-campaign-water-motion.test.ts tests/guaira-map.test.ts tests/guaira-campaign-progression.test.ts tests/guaira-campaign-art.test.ts tests/guaira-chapter-water.test.ts
```

Native Canvas proof verifies actual painters, camera, actor frames, masking and
partial redraw. It is not browser, DOM, GPU performance or physical-device QA.
The final combined scene must also pass representative foundation-contact checks;
route-only support is not a substitute for building footings.
