# Coastal diorama enrichment

Costa and Porto now use richer static Blender art in the same 1920 × 1200 transparent frame. Existing nodes, paths, secret routes, docks, camera and island placement remain unchanged. Art bounds follow the new alpha silhouettes, so the directed close camera includes the wider fishing shelter and rear harbor shore.

Costa gains continuous sandstone strata, a deeper arch, pointed leaf clusters, a supported fishing shelter, a beached dinghy and irregular shallows. Porto gains a gabled office, covered work area, corrugated cargo trim, nets and a small planted shore. The moving ferry uses the already released 64-view atlas. These landscape details are static; no foliage or shoreline animation is claimed.

## Runtime cost

The two replacement images add 143,572 bytes over the previous images. Costa is 306,508 bytes; Porto is 218,184 bytes. Both remain 1920 × 1200, so their combined theoretical decoded RGBA allocation stays 18,432,000 bytes. No additional full-size layer is requested. The legacy distant-Porto image remains available but is not loaded by WorldMapView; the per-island 350 KB test now counts the files actually requested for each base island.

`coastal-enrichment-manifest.json` records exact image hashes and bounds. `coastal-ferry-clearance.json` summarizes 1,034 actual motion poses against the new silhouettes: no open-water island, dock or buoy contacts. Projected terminal contacts remain recorded separately; this alpha check is not a full 3D physics claim. Costa and Porto route support/clearance audits are stored alongside it.

## Reproduction and review

Procedural sources live in `tools/diorama/coastal_enrichment/`. Generated .blend, PNG, comparison images and videos stay outside the runtime tree. Reconstruct to an explicit output directory, inspect the rendered PNG and audit results, then package the approved image. Do not crop or move the camera to make a route fit.

The integrated comparison uses the actual Canvas map painter with a fixed equal camera, before/after island layers, existing ferry/docks and Feka. It is an offline visual check without the browser HUD. Final browser validation must cover the physical signs, close/panorama selection and the Costa–Porto approach with these replacement layers.
