# Exterior-route geometry review

## Approved stable geometry

The path-collision repair uses explicit external stairs and intact closed terrain meshes. There are no Boolean operations in the final generation pipeline. The west, lower-east and lighthouse terrace footprints were shaped to keep the ascent corridors outside their rock faces. The original five clearing anchors and render camera are unchanged.

Changes from the first image:

- West arrival: the palm moved away from the ascent; the stair has continuous stone support
- Bridge to arch: the long descent runs clearly to the left of the arch, with a supported landing at the bridge end
- East ascent: the full exterior stair is visible, with an open level arrival onto the grass and two shore steps at the dock
- Lighthouse approach: continuous shared-edge winder treads replace oversized corner slabs; the bridge deck is above the meadow
- Secret route: a narrow supported ledge climbs beside the east arch pier and joins the open lighthouse approach
- Stage-5 clearing: the tight curved path ribbon is stopped at the clearing edge, eliminating dark overlapping triangles

Historical before/after and rejected experiment images remain only in the local authoring workspace. Generated review renders are excluded from Git and deployments.

## Checks

`check_clearance.py` performs read-only vertical ray tests against the actual rendered scene. The current geometry is checked at 322 route-center samples and 644 lateral-edge samples, for 966 rays total. Main paths use ±0.23-world-unit lateral offsets; the narrow secret path uses ±0.12. The audit flags non-walkable geometry more than 0.18 units above the intended footline inside 0.85 units of headroom. It records handrail contacts rather than silently excluding them.

The latest exact counts and findings are in `art-route-clearance.json`. The approved exterior geometry has zero center and edge flags. Separate geometric tread counts and maximum adjacent rises are recorded in `art-stair-metrics.json`.

The full-resolution model was also inspected at all junctions, including the arch, bridge ends, secret ledge, highpoint, shore stairs and dock. Local close-up review sheets and stage-5 comparison crops record the inspection.

These are model-art checks, not a substitute for the game's interaction, responsive layout or movement tests. The 2D runtime routes use the same camera and authored waypoints as the artwork.

## Reproduction and file checks

`render_costa.py` is the canonical model source. It exports the current geometry, routes, camera projection and clearance report, then renders RGBA PNGs. `-- --preview --qa` writes a full-resolution low-sample inspection image. `-- --staged` emits a quick half-resolution image before the full render.

`render_cached.py -- --art-only` may re-render an unchanged temporary scene without repeating its contact-shadow render. The cache is disposable and is not committed.

`package_assets.py` produces runtime WebPs, lossless reference WebPs and the low-frequency 640×400 shadow. The lossless variants are checked against the PNG pixels. `art-manifest.json` records canvas sizes, alpha bounds and exact byte counts.
