# Fluid ferry artwork and placement contract

The runtime now uses 64 genuine Blender views of the original working launch.
The hull, cabin, materials, lighting, camera transform, orthographic scale and
passenger world point are unchanged. The existing eight-view `journey-boat.webp`
is retained byte-for-byte; `journey-boat.meta.json` selects the separate
`journey-boat-64.webp`. No runtime 3D engine or rotated copy of a 2D boat is used.

## Heading density and cost

| Views | Maximum projected heading step | Image bytes | Decoded RGBA bytes |
|---|---:|---:|---:|
| 32 prototype | 20.516° | 513,102 | 19,300,352 |
| 64 selected | 10.286° | 721,512 | 38,600,704 |

The selected atlas is 2432×3968, with 128 base/foreground frames of 304×248.
Its metadata is 59,464 bytes; active image plus metadata total 780,976 bytes.
The old eight-view image remains 133,830 bytes and is not requested by the new
metadata. All frames use 48 Cycles samples. The selected 64-view atlas is encoded
from the original PNGs at WebP quality 82, reducing the quality-92 candidate by
305,122 bytes (29.7%). Alpha is byte-identical; visual comparison retained the
hull, deck and hardware at their actual map scale. The 32-view comparison above
used quality 92. Every eighth
heading retains an original docking angle. During the comparison, the 32 even
raw views were reused byte-for-byte and only the intermediate views were added.

## Physical anchors and the complete mast

The old 384×256 framing clipped the mast in heading 7. A 384×288 render adds
16 pixels above and below without changing horizontal pixel density. Across all
64 headings, the complete alpha bounds are `[44,11,340,249]`. The common crop
`[40,6,344,254]` leaves transparent padding and yields 304×248 pixels. The outer
two rows/columns of all 128 raw and packaged layers are fully transparent.

`widthInMap = (4.15 / 20.6) * 304 / 384`, with `passengerPixelScale = 3`.
Thus boat and Feka keep their original world size. The scale ratio differs
from one by less than two billionths due only to decimal metadata rounding.
The adjusted original berth anchors differ by at most 0.0003 raw pixel.

The world pivot remains `(0,0,0.03)` and the passenger foot remains
`(0.22,0,0.60)` before heading rotation. The cropped waterline anchor is invariant
at `(152,178.3718)`. The selected frame's passenger point rotates with the deck.
Use the stable waterline to position the hull, then carry Feka with that frame's
passenger offset; apply any restrained heave to both together. Anchoring the
whole hull to a fixed passenger point would reintroduce the original orbit.

Each frame exports its authored-world and projected-screen heading, normalized
and pixel anchors, and base/foreground atlas rectangles. `headingProjection`
contains the actual projected pixel vectors for world X and Y so the runtime
can invert the camera basis for a route tangent. Draw base → original Feka →
foreground; the nearer rails/cabin continue to mask the passenger correctly.

## Mid-channel retargeting

Reversing a sailing leg applies a 0.22-second brake, a 0.10-second pause and
a 0.30-second acceleration into reverse gear. The bow keeps the channel axis
instead of spinning sideways over an already reversed displacement. Repeated
selection preserves the current position and clock speed; Skip and reduced
motion still consume the route immediately. This manoeuvre is session-only
and adds a short delay to an interrupted trip, without new save fields.

The stern wake is suppressed while manoeuvring or moving astern. Ordinary
crossings keep the same sampled hull poses; the changed reversal was checked
separately against terrain, docks, buoys and the passenger/wake envelope.

## Two small decorative buoy moves

Only these two positions changed. Their sprite art, scale, the other two buoys,
all route points, terminal endpoints and island placements remain unchanged.

| Buoy | Old atlas point | Selected atlas point | Native-pixel movement |
|---|---|---|---|
| Porto coral | `(1.1726028037900418, 0.7212261318945039)` | `(1.1658319704567084, 0.7362261318945039)` | `(-13,+18)`, length 22.204 |
| Domínio sage | `(2.567669768444458, -0.8876690091459706)` | `(2.5717402070184527, -0.8839495042962289)` | `(7.815,4.463)`, length 9 |

The coral moves slightly along and outward from its existing side of the
channel. Its selected clearances are 14 native pixels from hull, 90 from the
conservative passenger envelope, 4 from wake, 177 from terrain and 197 from
docks. The sage moves directly along the outward normal, leaving 5/98/65 pixels
from hull/passenger/wake and 456/443 from terrain/docks. Both remain farther
from terrain and docks than before. A 41-pixel outward-only coral alternative
was considered and rejected in favor of the smaller selected move.

The placement search used the frozen final 64-view runtime poses in both
directions plus a mid-water reversal. It additionally interpolated between
30fps observations at no more than two native pixels, unioned both adjacent
heading silhouettes, included the full original 16×26 passenger billboard,
and reproduced the two quadratic wake strokes with an extra raster pixel.
The selected buoys keep at least four pixels from this conservative envelope.

## Verification

`journey-boat-64-validation.json` records crop, anchors, transparent edges,
payload, decoded size and hashes. `ferry-motion-clearance.json` records the
selected positions, input capture hash, asset hashes and 1,034 actual poses.
A fresh complete 64-view Blender render reproduced the validated raw source.
The final quality-82 encoding was rebuilt from those original PNGs with the
portable packager; every alpha pixel matches the quality-92 candidate. Repacking the original buoy
renders likewise reproduced both unchanged sprites and the updated metadata.

All five final cases have zero open-water terrain, dock or buoy contacts.
Minimum native-pixel clearances are 47 for Costa→Porto, 21 for Porto→Costa,
48 for Reserva→Domínio, 5 for Domínio→Reserva and 48 for the braking mid-water reversal.
Projected overlap at the authored terminal piers remains separately reported;
it is not described as collision-free travel. Final peak dock overlaps are
10,540 pixels at Costa and 870 at Reserva, close to the original 10,508/848-pixel
rendered contact. The earlier broadside pier intrusion was removed by the
runtime's bounded terminal-turn timing before this final audit.

## Rebuild without touching legacy assets

Set `RENDER_DIR` and `ASSET_DIR` to separate output directories, then run:

```sh
blender -b -t 8 -P tools/diorama/render_journey_boat.py -- --output-dir "$RENDER_DIR" --headings 64 --samples 48 --height 288
python tools/diorama/package_journey_boat.py --render-dir "$RENDER_DIR" --output-dir "$ASSET_DIR" --verify-against public/assets/world/map
```

The packager writes only the new atlas, `journey-boat.meta.json`, and a validation
report into the chosen output directory. The optional verification compares
image and metadata byte-for-byte with the accepted files. The renderer also
supports explicit partial indices, requiring matching heading count, raster
dimensions and samples before merging their measurements. PNGs and Blender
caches are intermediates and are not committed. The existing buoy packager
reads the runtime placement metadata, so a sprite rebuild preserves these
selected positions.

The retarget refinement rechecked 204 reversal poses and the complete interpolated
passenger/wake envelope. It required no further buoy movement. The four ordinary
crossings retain their previous hull positions and frames.
