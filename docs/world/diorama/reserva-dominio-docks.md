# Reserva → Domínio docks

The additive connection opens after `5-5` C2 and joins `6-1 Jardins Pizzarino`.
It reuses a second instance of the published eight-heading journey boat. The
Reserva and Domínio base images, the boat atlas and all older transports are
preserved. The fixed island placements remain Reserva `(2.7, -1.8)` and Domínio
`(1.5, -1.8)`, at scale 1 with the shared 20.6 / 1920×1200 camera.

## Authored geometry

- Reserva keeps its complete original heated-dock prefix. A 1.05-wide copper
  trimmed descent reaches dock `(-8.25, -2.5, .65)` and passenger
  `(-9.4, -2.5, .60)`
- Domínio keeps the base entry from `(5.3, -2.4, 1.35)` to
  `(6.35, -2.4, 1.35)`. The small cream landing reaches dock
  `(8.1, -2.4, .65)` and passenger `(9.2, -2.4, .60)`
- Both boats dock at heading 6. Fixed gangways narrow to .44 to fit the actual
  .50-wide hull gates. A 6mm boarding lip spans the inset-deck gap without
  intersecting the hull. The real boat deck supports the last boarding steps
- The route moves 2.70 world units away from each gangway before the sea leg.
  Forward headings are `[6, 6, 6]`; reverse headings in reverse traversal order
  are `[6, 2, 6]`. This keeps reverse departure at heading 6 until it clears the
  fixed bridge, then leaves room for the final .65-second return docking turn
- Sailing duration is 5.412277 seconds, derived from 3D path length / 3.2;
  walking durations use 3D length / 1.73. Camera framing and movement support
  have separate bounds and polygons
- Actual hull-door thresholds measured in the runtime 8:5 route metric are
  `aboardProgress=.473188688` at Reserva and `.450464950` at Domínio

## Layers and depth

`reserva-dominio-journey.meta.json` contains the connection, island docks,
framing, support polygons, berth anchors, authored headings and timing.
Four compact WebPs contain the two static docks and the two closed barriers.
Static geometry remains visible; each barrier is omitted when open, leaving
its hinge outside the supported walking lane.

Every dock crop uses the frozen islands as Cycles alpha holdouts. A separate
waterline holdout at Z=.03 removes submerged piles and masonry shoes without
painting a water rectangle into the image. Piles continue into their submerged
foundations. No new island, vessel atlas, `.blend` or proof image is shipped.

Crops preserve native pixel scale for either image orientation: Blender's
orthographic size is the larger of the crop's horizontal and vertical world
extents. This avoids silently enlarging and clipping tall dock crops.

## Rebuild and focused checks

Use an external scratch directory for all working files:

```sh
blender -b -t 6 -P tools/diorama/render_reserva_dominio_docks.py -- \
  --output-dir /tmp/reserva-dominio-docks --proof --render-overlays --samples 32
blender -b /tmp/reserva-dominio-docks/reserva-dominio-docks.blend \
  --python-exit-code 1 -P tools/diorama/check_reserva_dominio_docks.py
python tools/diorama/check_reserva_dominio_raster.py --source /tmp/reserva-dominio-docks
python tools/diorama/package_reserva_dominio_docks.py --source /tmp/reserva-dominio-docks
```

The targeted audit checks full walking footprints, body clearance, evaluated
hulls through all eight detached turning silhouettes, the discrete runtime
heading sequence, original Feka head/body pixels and new obstructions of old
Reserva routes. The raster audit separately sweeps the unchanged shipped boat
alpha against both frozen island images at native scale. Packaging requires
both audits to pass and every recorded builder hash to match.
