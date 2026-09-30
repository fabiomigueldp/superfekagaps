# Costa ↔ Porto: connected dock and ferry artwork

The original Costa and Porto island assets, five stage anchors, main and secret
route arrays, and camera exports are unchanged. The journey adds two small
transparent dock overlays and one original working launch atlas. There is no
runtime 3D dependency and no shipped render cache or new PNG.

## Assets and coordinates

- `coast-port-journey.meta.json` is the dock/connector contract
- `journey-boat.meta.json` describes the shared `journey-boat.webp` atlas
- `costa-journey-dock.webp` and `porto-journey-dock.webp` are alpha-cropped additions

Island positions, junctions, path points, and overlay bounds use the accepted
1920×1200 image's normalized top-left coordinates. Apply the island's atlas
placement once. Overlay `left`, `top`, `widthInMap`, and `heightInMap` describe the
cropped image in that same coordinate frame. They are not screen pixels.

Costa joins the real east stone stair halfway through main edge `2:3`, segment
3 (`t = 0.5`, world `[3.4,-3.045,1.6]`). Split the graph edge there and use
`junctionToDock`, then `boardingRoute`; do not send Feka down to stage 1-3 just
to retrace the same stair. The supported timber spur reaches the southern open
end of the original dock. It avoids the northern barrels, cliff-side shore
approach, and both side ropes. A slightly raised west crossing keeps the old
front pile clear of Feka's projected upper body. The final short ramp is shared
by the dock approach and boarding path.

Porto attaches directly to stage 2-1. Its short connector uses the arrival
deck's open west edge. The transfer boat remains west of the original scenic
tug, which is unchanged.

The boat atlas has eight 384×256 headings, each with a complete base and a
foreground layer. `sourceRects` are atlas pixels; `passengerFootPixels` and
`waterlineAnchorPixels` are relative to the selected frame. A full frame spans
`4.15 / 20.6 = 0.201456311` island widths. The real 16×26 helmet-free Feka was
reviewed at `passengerPixelScale = 3`, or 48×78 frame pixels. Keep character
scale linked to boat scale. Draw base → passenger → foreground while aboard.
This preserves correct feet/rail/cabin occlusion in reverse headings.

The launch has an open foredeck, low stern cabin, a shaped bow/transom hull,
working timber deck, tire fenders, lifering, brass cleats and real side boarding
gates. Its passenger foot is at local world `[0.22,0,0.60]` before heading
rotation; the boat is not baked with a duplicate character.

`sailRoute.points` is the authored nine-point atlas-space sea arc. The contract
also records the approved placements (Costa origin 0,0; Porto origin 1.1,-0.12;
both scale 1), a 6-second traversal duration and forward/reverse heading
indices per segment. The runtime should reject divergent placements rather
than silently reusing a route in a different layout. The boat metadata's
`screenHeadingRadians` uses actual pixel direction; for atlas tangents use
`atan2(deltaY * 1200, deltaX * 1920)`.

## Verification

Canonical source is built up to its publication boundary without overwriting
existing assets, metadata, or source caches. The five frozen fields are compared
directly with their accepted metadata. New support/headroom checks sample the
walking center and both lateral offsets at intervals no larger than 0.07 world
units. An independent orthographic camera-ray audit samples the real Feka
billboard's lower body, upper body and head at intervals no larger than 0.08.

- Costa: 435 support rays + 435 headroom rays; 657 projected actor rays; zero
  new support, headroom, lower-body or upper-body conflicts
- Porto: 108 support rays + 108 headroom rays; 279 projected actor rays; zero
  support, headroom or projected actor conflicts
- Every accepted main/secret route is checked with additions present and
  absent; both islands have zero newly introduced contacts
- The sailing sweep checks 522 positions in both directions using the actual
  packaged boat alpha silhouette, including cabin, mast, rails and fenders
- Open water has zero silhouette intersections, with 42 native pixels of
  minimum clearance for the sailing headings and 12 pixels even when testing
  all eight headings at every open-water sample

The first two and last two short sea segments are terminal manoeuvres. Their
minimum visual clearance is explicitly zero: they meet the gangways, and the
Costa cabin/mast project in front of the beach behind the offshore hull. These
terminal projection contacts are recorded, not described as collision-free
pixels. The complete boat beam remains physically south of the original Costa
dock by at least 0.37 world units and west of Porto's arrival deck by at least
0.22; the new gangways intentionally bridge those gaps. Original dock pixels
are classified with a separate Blender holdout render. See
`coast-port-sail-audit.json` for the sweep and per-sample contacts.

The stricter before/after diagnostic records 38 pre-existing Costa edge,
bridge-seam and foliage contacts on the accepted source. This change neither
claims to resolve those nor changes those original routes. Detailed ray
reports are in the adjacent `*-journey-dock-audit.json` files.

Overlay renders use the old scene as a camera holdout, so original stone and
piles correctly mask additions behind them. Visual review used the exact
original island image plus alpha-cropped packaged WebP overlay, not only an
all-in-one Blender render. A coplanar platform shading artifact was corrected
with an 0.008-unit surface separation; the stone-to-wood join has a continuous
visible floor. Every final boat heading was reviewed with the original Feka
sprite composited between its two packaged atlas layers.

## Rebuild

```sh
blender -b -t 8 -P tools/diorama/render_journey_boat.py
blender -b -t 8 -P tools/diorama/render_journey_docks.py -- costa --render
blender -b -t 8 -P tools/diorama/render_journey_docks.py -- porto --render
python tools/diorama/package_journey_assets.py
blender -b /tmp/feka-journey/costa/journey-dock.blend -t 8 -P tools/diorama/render_journey_dock_masks.py -- costa
blender -b /tmp/feka-journey/porto/journey-dock.blend -t 8 -P tools/diorama/render_journey_dock_masks.py -- porto
python tools/diorama/author_journey_sail.py
```

The three shipped WebPs total 151,634 bytes. Intermediate PNGs and `.blend`
caches stay in `/tmp/feka-journey`. The package step refuses failing connector
audits. Existing island/camera exports and Oracle deployment are not touched.
