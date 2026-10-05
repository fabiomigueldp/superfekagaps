# Guaíra: grounded village and working rice landscape

This pass rebuilds the inhabited ground, rather than disguising unsupported
objects with trim. The same source scene produces the chapter and campaign
atlas. Main at `5c3e6d624270b17e3b41e765fc1eea8239736804` is the comparison baseline.

## Authored scope

- A continuous clay island extends beneath the rear village, agricultural
  shoulder, reservoir and entry clearing. The civic shelf supports the complete
  hall and tank. The ascent has a filled earthen underbody.
- Building repairs ground foundations, thresholds, porch parts, windpump and
  pipe supports, close roof gables and seat construction details. The reservoir
  maintenance deck gains a usable position and access.
- Rice beds have sediment floors, sloping compacted berms and actual inlet
  openings. Irrigation channels connect the basins and pass below the dry
  crossing. The keeper's work area stands on a dry bank.
- Chapter camera and target move down together by 0.65 world units to give the
  wider shore breathing room. Orthographic scale and view direction remain
  unchanged; projected data is rebuilt from the final camera.

The terrain, buildings and rice passes live in separate `redesign_*.py` modules
and run after the historical craft passes. Each uses independent mesh helpers,
so later namespaces cannot silently change object naming or construction.
Campaign boarding-shelter grounding runs only for Guaíra.

## Reproduction

Blender 4.3.2, Cycles CPU, AgX Medium High Contrast. Chapter uses 48 samples and
campaign 32. PNGs, Blender scenes and emission masks are intermediate files;
only packaged runtime assets and selected review images belong in the release.

```sh
PROOF=/tmp/guaira-redesign-rebuild
mkdir -p "$PROOF/chapter" "$PROOF/campaign"
blender -b --python-exit-code 1 -t 4 -P tools/diorama/guaira/build_guaira.py -- --output-dir "$PROOF/chapter"
blender -b --python-exit-code 1 -t 4 -P tools/diorama/guaira_campaign/build.py -- --region guaira --output-dir "$PROOF/campaign"
python tools/diorama/guaira/package_guaira.py --input "$PROOF/chapter" --output public/assets/world/experimental/guaira
blender -b "$PROOF/chapter/guaira-diorama.blend" --python-exit-code 1 -t 4 -P tools/diorama/guaira/render_support_views.py -- "$PROOF/support"
```

See [the complete export guide](../../../../tools/diorama/guaira/REDESIGN_EXPORT.md)
for camera-derived water masks, restoration crops, and focused audit commands.

The builders accept `--samples N` and `--build-only` for focused geometry review.
A draft image must never be packaged as the 1920 × 1200 runtime image. Whole
scene exports are required; the former bounded terrace/Bairro image patchers
are not valid for this redesign.

## Evidence and limits

The before/after full scenes and close details use the exact shipped baseline
and final packaged assets. Matched front/right and rear/left Blender views expose
support and roof geometry concealed by the gameplay angle. Native Canvas
compositions exercise production painters and actual assets; they are not
browser screenshots or device/FPS verification.

Validation covers ground contact, route support/headroom, irrigation continuity,
projected asset contracts, water-mask coverage and focused Guaíra tests. Campaign
world IDs, experience IDs, save schema and existing progress remain unchanged.
No Oracle server access or Vercel deployment is part of this change.

### Final checks

- 121 focused TypeScript tests across 13 files, three crop-packing unit tests,
  both TypeScript projects, world validation and the production build pass.
- Native composition covers 36 route views, eight locked/restored public-water
  views and 400 consecutive partial-redraw comparisons. Thirty of the 44 views
  are bit-identical; the remaining differences are at most two shadow-boundary
  pixels and two RGB levels. Alpha, all other pixels and water containment are
  exact. Repeated sequences never grow beyond one fixed shadow-edge pixel.
- The wider chapter and atlas are full scene exports with fresh water masks,
  source projections, restoration crops and measured art bounds. Campaign nodes,
  terminal anchors, camera and saved experience identities remain exact.
- Production output is 43,565,358 bytes, below the 45 MB repository budget.

[Validation and asset hashes](validation.json) records measured contact, route,
water and rendering results. [Rear-building comparison](rear-buildings-before-after.jpg)
shows the structural support/roof corrections; it is a focused building proof.
The final combined chapter and atlas images are the packaged runtime assets.

The map-controller fixture previously hardcoded the old water-atlas dimensions;
it now reads the actual contract. Two older arrival tests also expected a white
sprite in reduced-motion mode, although the already-published renderer preserves
the sprite palette and uses stationary protection brackets. Only those stale
expectations changed; ordinary-motion tint and frozen-state checks remain exact.
