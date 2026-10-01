# Island-name boards for the six-island overview

The overview names the island underneath each board: `1 COSTA`, `2 PORTO`,
`3 FÁBRICA`, `4 SERRA`, `5 RESERVA`, `6 DOMÍNIO`. These are new rectangular,
non-directional Blender objects with short timber supports. Destination arrows
remain separate close-view art. No released sign texture is stretched or edited.

The warm wood, inset ivory paint, iron fixings, restrained brass selection mark,
daylight and front-facing camera follow `render_map_signs.py`. A muted plank and
single red support keeper mark the locked state. Lettering remains the original
dark bitmap font at integer scale 2, including accent cells.

## Runtime contract

`public/assets/world/map/island-signs.webp` is a transparent 768 × 88 physical
pixel atlas (14,464 bytes). Its version-1 companion metadata has exactly three
frames in one row:

| Kind | Physical source rectangle | CSS display size |
| --- | --- | --- |
| `island` | `(0, 0, 256, 88)` | `128 × 44` |
| `island-selected` | `(256, 0, 256, 88)` | `128 × 44` |
| `island-locked` | `(512, 0, 256, 88)` | `128 × 44` |

All frames have `dpr: 2`, `letterPixelScale: 2`, and identical CSS geometry:

- `foot: { x: 64, y: 41.018 }`
- `letterCenter: { x: 64, y: 22 }`
- `usableFace: { x: 10, y: 10, width: 108, height: 20 }`
- `decorativeTranslateY: 2.982`

Only `sourceRect` uses physical pixels. The atlas filename is in `atlas.image`;
frames are crops of that image and have no separate image URL. The native
interaction target stays 128 × 44 CSS pixels. Changing state never moves the
physical foot, text or target. If a consumer aligns the frame bottom to the
physical foot, use the measured foot/translation rather than a new fixed offset.

Draw the original font centered at `(64, 15)` with scale 2, using
`letterCenter.y - 7` as the glyph body origin. The longest names occupy 102 CSS
pixels. Accented names extend upward to y11; every original glyph cell stays
inside the authored safe face and has fully opaque board backing. `letters`
and `closedLetters` both remain `#191f35`; the selected cue is `#e9ad4c`.

Confirmed selection also uses a static original bitmap pointer above the name:
16 × 10 CSS pixels at `(56, 0)`, with a dark outline and cream/brass fill. Its
two-pixel steps remain whole pixels at half display scale. The
same painter is used for atlas and fallback boards, including locked previews.
It never overlaps accent cells or changes the foot/target. Keyboard focus keeps
its separate native white outline; it does not move the selection marker.

The marker pass passed 504 TypeScript + 3 server tests in 12.80 s, both
TypeScript projects and diff checks. Vite built in 1.25 s: 491.89 kB JS /
152.43 kB gzip. No image, CSS, hitbox, camera, route or save changed. Actual
desktop and compact preview review will compare selected Domínio with keyboard
focus on Reserva, so those two states can be judged independently.

## Attached controls in compact overview

The short 472 × 303 viewport exposed a semantic failure in the old collision
packing: 76 × 44 name targets could move beneath another island. The compact
view uses the existing narrow plank with a single island number, displayed
at its natural 28 × 29 proportions inside a 44 × 44 native target. The complete
name remains in the accessible label and the selected-island footer. Desktop
nameboards, region ownership, campaign progression and transport routes stay
unchanged.

The visible foot accounts for the half-scale authored translation and the
canvas centering within its target. A candidate must remain within 12 CSS pixels
of its own anchor, within its island's horizontal terrain bounds, near that
shoreline, inside the safe scene and separated from other complete hit targets.
Direct anchors are tried first. A deterministic placement pass is validated
against those ownership limits and cached while geometry is unchanged. There
is no free row-packing fallback: if all six cannot fit, the existing Arquipélago
chooser is announced instead. Enter/Space on the map opens that chooser.

The preview must be inspected with the actual 94-pixel footer and complete
dock/vehicle camera extents, comparing the old misleading labels with the
attached number badges before production promotion.

The prototype passed 172 focused checks, both TypeScript projects and the final
508 TypeScript + 3 server tests in 14.54 s. Vite built in 1.23 s: 494.27 kB JS /
153.09 kB gzip. Existing textures are reused with no additional image payload.

## Overview framing at the first arrival

Public smoke at 1-1 exposed excessive overview padding: the camera reserved the
close-view 44 CSS pixels around Feka even though his overview sprite is small.
The panorama now fits the actual 16 × 26 sprite and optional shadow in world
units, using the same scale basis as the painter and the bounds fitter's visual
padding. Occupied boat/cabin scale is included. Close and travel views retain
their existing 44-pixel focus clearance.

At the real 472 × 303 geometry, the larger overview makes a valid six-badge
layout possible at 1-1. If direct and normal placement miss it, at most six
deterministic retries move one desired anchor two pixels downward. Acceptance
still uses the original anchors, owner bounds, 12-pixel limits, 44-pixel targets
and 8-pixel gaps. The explicit chooser remains when no accepted layout fits.
Regression checks cover 1-1, 3-3 and 6-1 without player/save-specific rules.

The final framing tree passed 162 focused checks, both TypeScript projects and
513 TypeScript + 3 server tests in 12.29 s. Vite built in 1.14 s: 494.70 kB JS /
153.25 kB gzip. CSS and image payload are unchanged in this follow-up.

Normal-motion preview also exposed the old 20/44-pixel actor box inside camera
interpolation safety. Overview now shares its real actor bounds between the
target fit, zoom guard and translation clamp, together with the tracked vehicle.
The normal-motion regression follows 1-1 → 3-3 → 6-1, including an occupied
ferry and settled overview frames. Close/channel safety retains its old margins.

The smoothing follow-up passed 152 focused checks, both TypeScript projects and
514 TypeScript + 3 server tests in 13.29 s. Vite built in 1.19 s: 494.87 kB JS /
153.31 kB gzip. No CSS or image changes accompany this correction.

## Reproduce and check

Requirements: Blender 4.3.2, Python, Pillow and NumPy. Use an output directory
outside the repository for PNGs, `.blend` sources, proofs and validation.

```sh
blender -b -t 8 -P tools/diorama/render_map_island_signs.py -- \
  --repo-root . --output-dir /tmp/feka-island-signs/proof --samples 8
python tools/diorama/package_map_island_signs.py --repo-root . \
  --render-dir /tmp/feka-island-signs/proof \
  --output-dir /tmp/feka-island-signs/proof/assets \
  --proof-dir /tmp/feka-island-signs/proof

blender -b -t 8 -P tools/diorama/render_map_island_signs.py -- \
  --repo-root . --output-dir /tmp/feka-island-signs/final --samples 64 --save-blend
python tools/diorama/package_map_island_signs.py --repo-root . \
  --render-dir /tmp/feka-island-signs/final \
  --output-dir /tmp/feka-island-signs/final/assets \
  --proof-dir /tmp/feka-island-signs/final
```

The renderer produces DPR4 PNGs; the packager reduces them once to DPR2 and
writes only `island-signs.webp` and `island-signs.meta.json` into `--output-dir`.
It reads the actual game glyph definitions and checks all six labels in all
three states, including acute accents, opaque backing, stable geometry and two
fully transparent physical pixels around every frame. Both files reproduce
byte-for-byte when repackaging the accepted PNGs; use a separate output folder
with `--verify-against public/assets/world/map` to check this.

`--proof-dir` receives labelled native-size and 3× contact sheets plus
`island-signs-validation.json`. The contact sheet's third column also simulates
the current native button focus outline from `map.css`; real DOM focus and
interaction behavior remain part of runtime QA. The approved proof and final
export were both inspected at 1×. All three final opaque silhouettes occupy
physical bounds `(8, 8)` to `(248, 82)`, leaving room for the complete posts.

Only the two scripts, this document and the two runtime files belong in Git.
