# Serra → Reserva passenger cableway

The passenger line unlocked by **4-5 / B2** connects the existing Serra stage to
Reserva **5-1**. Both islands retain their authored stages and routes. The new
connection occupies the east side, outside the released maintenance system.

## Frozen geometry

- Atlas placements: Serra `(2.78, -0.65)`, Reserva `(2.70, -1.80)`, both scale 1
- Both cameras use orthographic scale 20.6 and the same viewing direction; the
  complete Reserva-to-Serra transform is solved from those camera projections
- Inner berth feet: Serra `(7.7, 3.3, 5.45)`, Reserva `(7.9, 0.05, 1.35)`
- Outer lane: positive perpendicular offset `(3.678728, 2.591709, 0)`, length 4.5
- Both passenger paths contain 49 knots, authored Serra → Reserva, with 0.16 sag
- The fixed-axis passenger cabin boards through `+X` in Serra and `-X` in Reserva
- Exact doorway threshold is 0.81 from the foot; staging is 1.20 away, broad
  walking centers 1.65 away, and supported door lips are 0.84 wide
- Lane order is `b, a`, from back to front. The original Feka pixel ratio is
  inherited from the passenger atlas, with no map-specific actor scaling

The Serra extension is a continuous deep steel truss socketed into the existing
limestone. Reserva uses a shorter frame rooted in its cold-store foundation.
Diagonal outriggers support the cable pylons. No added foot blocks hang below
the islands. Square end aprons support the complete actor footprint and gates
without moving the logical boarding turns.

The four doorway barriers retract below the deck while open and rise across
their lips while closed. Only raised closed barriers have compact overlays;
open mechanisms are hidden inside the shared terminal decks. The two long cables are authored atlas polylines,
with the exact projected offset to the cabin grip `(0, 0.13, 2.60)`; there is no
large transparent bitmap spanning the gap between islands.

Terminal exports retain the fixed island/structure geometry as Cycles alpha
holdouts. Buried foundation sockets and cliff anchors therefore stay behind
the ice/rock when the runtime paints each overlay over the island bitmap.
Moving carriers, actors, cables and retracted gates are not baked as occluders.

## Rebuild and check

Requires Blender 4.x, Node, Python and Pillow. The passenger cabin's approved
atlas metadata must already exist; pass its location explicitly if needed.

```sh
blender -b -t 8 -P tools/diorama/render_serra_reserva_link.py -- \
  --output-dir /tmp/feka-serra-reserva --final --render-overlays
blender -b /tmp/feka-serra-reserva/serra-reserva-link.blend -t 8 \
  -P tools/diorama/check_serra_reserva_link.py
python tools/diorama/package_serra_reserva_link.py --source /tmp/feka-serra-reserva
```

The source builder rebuilds both islands directly from repository scripts.
Scratch `.blend` files and actor/corridor proofs are never packaged. Packaging
requires a passing targeted combined audit and matching source hashes.

## Verification scope

The frozen package passes 576 passenger poses, 114 maintenance-preservation
poses, 1,182 grounded foot probes, 716 new-route actor poses and 348 old-route
actor poses. There are zero mesh collisions, support failures, head/body
occlusions or independent-phase maintenance/passenger frame overlaps. The six
WebP overlays total 150,352 bytes.

A focused occlusion correction after preview `43c5d16` removed 12,005 opaque
buried pixels from the Serra terminal and 11,222 from the Reserva terminal,
without adding opaque pixels outside the old silhouettes. Both native image
sizes and the runtime metadata remain unchanged. Before/after scene-geometry
hashes and an exact comparison of the geometry-bearing builder source confirm
that this correction changes export visibility only. The approved manifest
retains the original geometry-audit source snapshot and the new export record.
Compositions made from the actual base WebP, overlay rectangles, closed gates,
wire paths and cabin layers verified the corrected layering at both joins.
All 13 passenger contract/integration asset tests pass after the correction.

The checked-in combined checker covers the actual passenger mesh on both ride
curves, grounded center/foot-width samples of each approach and boarding route,
and original-Feka head/body visibility through the new terminals and rides.
Existing Serra maintenance carriers and walking routes are checked against the
added geometry. Conservative independent-phase frame bounds also test the new
and maintenance carriers for projected overlap. Released Serra files, nodes and
object transforms are checked for preservation.

The grounded tolerance includes the existing 0.018–0.019 landing-cap height above
authored path centerlines. Own cable/grip and terminal sheave interfaces are
explicit exclusions from cabin collision checks. The evaluated static geometry,
full source hashes, route/support coordinates and audit results are recorded in
`serra-reserva-link-approved.meta.json`.

Reserva's base five-stage paths and shipping shortcut are audited separately by
its own authoring/checking tools. The combined checker does not rerun every
unchanged old-island audit. Runtime metadata parsing and browser journey tests
remain required integration checks.
