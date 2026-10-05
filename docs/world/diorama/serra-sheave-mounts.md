# Serra maintenance sheave mounts

The four gold maintenance sheaves were visibly disconnected from the blue
cantilevers. The released geometry had 0.0205–0.0456 world-unit surface gaps,
and the cables entered the wheel hubs rather than meeting their lower rims.
A focused sweep that keeps the wheels in scope also found contacts between the
two lower wheels and the moving cabin roof/canopy stays.

This correction keeps the existing gold disks, steel palette, upright poles,
foundations and cable curves. Each disk now sits normal to its lane, offset
0.20 units from the actual terminal cable tangent. A short transverse blue
axle joins its hub to the rear cantilever. The 0.18-radius rim sits within the
existing 0.026 cable radius. The mount remains behind/above the moving clamp.

Exactly four sheaves and four cantilevers change; four axles are added.
Full scene signatures verify that all other geometry and transforms are exact,
including the boardwalks, buildings, cliffs, aircraft clearing and cabin source.
Complete Serra metadata is unchanged. The campaign export keeps the same
1920 × 1200 frame, crop, bounds, camera and airport anchors. Only the image byte
count and truthful authored-object count change in its export receipt.

## Focused verification

`serra-sheave-validation.json` records before/after geometry and source hashes.
The check rebuilds evaluated meshes from a freshly authored scene, tests every
upright–cantilever–axle–wheel contact, and sweeps all 13 convex carrier components
through all 24 intervals of both lanes (624 swept hulls). The final mount has
zero non-running-interface contacts. Its 12 remaining contacts are only the
intended cable clamp/hanger against a gold running sheave; roof/canopy contacts
are failures, not blanket sheave exclusions.

The same check traces the original head/face sprite CSS pixels against only the
changed hardware in desktop, portrait and landscape profiles. Each covers
5,474 walking/boarding/riding poses, with zero head/face-obstructed poses. This
is a focused hardware proof, not a fresh all-scenery or browser audit.

```sh
blender -b -t 4 -P tools/diorama/guaira_campaign/build.py -- \
  --region serra --build-only --output-dir /tmp/serra-sheaves
blender -b -t 3 /tmp/serra-sheaves/serra-campaign.blend \
  -P tools/diorama/check_serra_sheave_mounts.py -- \
  --output /tmp/serra-sheaves/mounts.json
```

The canonical and retained enriched-source Serra builders contain the same fix.
Both the campaign replacement and fallback base are regenerated; no carrier
atlas, transport function, route ID, timing, gameplay, save or shared helper
changes are part of this patch. Raw Blender/PNG comparison products stay outside
Git. No deployment or Oracle action was performed.
