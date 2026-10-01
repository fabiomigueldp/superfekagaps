# Serra Suspensa: authored diorama and paired maintenance lift

World4 uses the established1920×1200 orthographic family at scale20.6. The camera direction matches the Factory; its target and position are raised1.35 units to frame the mountain. The accepted atlas placement is origin(2.78,-.65),scale1; worlds1–3 keep their existing placements. The entry4-1 remains(-5.75,-3.60,1.65),including the independent Factory link's approach from(-5.75,-4.85,1.65).

The campaign references are `docs/world/campanha.md:162–208`, `docs/world/conceitos/imagens/04-serra-suspensa.png` and `13-arquipelago.png`. The scene uses pale layered cliffs, angular summits, notched pines, warm mountain stations and distinct overhead cables. No wind physics or new level mechanics are introduced. The passenger-line station toward Reserva remains reserved; inactive decorative spans and a scenic cabin are omitted from the active maintenance corridor. This slice does not model or connect world5.

All five phase IDs remain unchanged. Four continuous supported paths join4-1 through4-5. The final station has a rectangular forecourt so its edge does not occupy the maintenance cabin's arrival corridor. The4-3→4-5 secret is an explicit two-lane counterbalanced lift, not a walk path in midair. `secretTransport` is `maintenance-cable`; `secretRoute` is empty. Each terminal has a common platform, two supported walking approaches, two side door thresholds and two distinct passenger-foot anchors. The cabins exchange ends and keep their heading; the occupancy phase chooses the waiting lane. Physical travel paths are separate from the overhead cable curves. The two lanes are3.4 world units apart; only rear laneA moved during clearance work, and foreground laneB preserved its original feet. The central decorative shelter/low needle were removed from the rear corridor.

The maintenance cabin has a real open floor, low front panel, rear posts and canopy braces above Feka's hair. Both side doorways remain open. The runtime draws the rear layer, original Feka pixels, then the foreground panel/canopy. The shared frame keeps the released atlas pixel ratio `(4.15/20.6)*3/384`; no larger substitute character is baked into the art. `aboardProgress` is measured at the actual side door using the runtime's normalized x×1.6 distance metric, not a fixed percentage of the entire approach.

Walk durations use the calibrated physical pace1.73 Blender units/s, consistent with the released cargo bridge. Cabin travel uses2.10 units/s. Both lane alternatives remain naturally quicker than the main4-3→4-4→4-5 walk, without artificial route weights. The packager asserts this comparison and exact endpoint continuity.

## Rebuild without cached scenes

```sh
blender -b -t 10 -P tools/diorama/render_serra_map.py -- --output-dir /tmp/serra-build --final --static --export-cabin-layers
python tools/diorama/package_serra_map.py --input-dir /tmp/serra-build --output-dir /tmp/serra-runtime
node tools/diorama/export_serra_sprite.mjs > /tmp/serra-build/serra-audit-sprite-source.json
blender -b /tmp/serra-build/serra-prototype.blend -P tools/diorama/check_serra_clearance.py -- --phase 0 --raster --label phase0
blender -b /tmp/serra-build/serra-prototype.blend -P tools/diorama/check_serra_clearance.py -- --phase 1 --raster --label phase1
blender -b /tmp/serra-build/serra-prototype.blend -P tools/diorama/check_serra_cabins.py -- --continuous --label cabins
blender -b /tmp/serra-build/serra-prototype.blend -P tools/diorama/check_serra_rider_raster.py -- --step .0005 --scenery --label rider
```

For another authoring script, `runpy.run_path` accepts `FEKA_SERRA_OUT` and `FEKA_SERRA_BUILD_ONLY=True`; it returns `scene`, `cam`, `meta` and the authored geometry without exporting/rendering. The builder clears the active scene. The output directory and transient.blend/PNG files are authoring products, never required inputs or files to commit. Final packaging emits four small runtime assets: diorama WebP/metadata and paired cabin atlas/metadata.

## Verification scope

The clearance checker uses the evaluated meshes, real idle/six walk sprite grids in both facings, and rounded raster coverage in three viewport profiles. It distinguishes supported walking approaches from the final occupied-cabin boarding segment and checks both occupancy phases. The transport checker verifies both authored lanes against terrain, station roofs, piers, decks and non-transport scenery using sampled poses and continuous convex-part sweeps. It checks the simultaneous countercar crossing separately. The moving-rider checker traces every opaque head/face source pixel against the other carrier, its own cabin and the complete static scene throughout both lanes/directions, including rounded-raster coverage. A physical vehicle separation pass alone is not a visibility pass. Intentional own transport cables/sheaves are explicitly identified; reports never collapse boarding panel/boot contacts into an unconditional zero-contact claim.

These Blender and offline image proofs establish authored geometry and projection. Browser/controller behavior is a separate integration gate. No Oracle deployment is involved.

The final source snapshot passes both occupied phases and the complete moving-rider checks: no head/hair/face obstruction in the three raster profiles; no physical transport contacts in106 poses or624 continuous swept hulls. Lower-body and peripheral contacts with cabin panels and one foreground support remain quantified in `serra-validation.json`; full-body visibility is not claimed. The final rear-lane trip is6.598429s and foreground-lane trip4.170429s, versus6.641684s for the supported main route.
