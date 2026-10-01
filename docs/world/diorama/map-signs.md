# Reproduce the frozen map-sign atlas

Requirements: Blender 4.3.2, Python with Pillow and NumPy. The renderer checks
the repository palette; the packager checks the original bitmap-font fit.
Neither script edits the repository. Supply explicit paths; no workspace or
user-directory paths are embedded in either source.

From the repository root:

```sh
blender -b -t 8 -P tools/diorama/render_map_signs.py -- --repo-root . --output-dir /tmp/feka-map-sign-renders
python tools/diorama/package_map_signs.py --repo-root . --render-dir /tmp/feka-map-sign-renders --output-dir /tmp/feka-map-sign-assets
```

To compare with the accepted game assets, add
`--verify-against public/assets/world/map` to the packaging command. This
requires a separate output directory and compares the final atlas and its
manifest byte-for-byte. `signs-validation.json` records hashes, frame count,
alpha-edge checks, measured feet and bitmap lettering fit.

Only signs-atlas.webp, signs-atlas.meta.json, the two Python sources, and useful
validation/documentation need versioning. PNG renders remain intermediates.
The scripts create no JPEG preview, node subprocess, or .blend cache. Seven
individual DPR2 WebPs are also emitted as optional alternatives; the shared
atlas is the normal runtime deliverable.

The accepted atlas is 560 × 232 pixels and 29,396 bytes. Its seven frames
preserve full-contrast original bitmap IDs and combine selection/completion
without hiding either state. The native phase and dock targets remain
56 × 58 and 104 × 56 CSS pixels. Only decoration moves to align the measured
feet; rounding that translation leaves less than half a CSS pixel of error.

Repacking the original PNGs reproduced the atlas and manifest byte-for-byte.
A fresh Blender render through the portable source also reproduced the stage
pixels and measured metadata. Alpha checks cover the outer two pixels of every
packed frame, including the completion pennant and contact shadow.

Dock boards have one pier-side support and a short timber cantilever bracket.
The COSTA board retains its right post; PORTO retains its left post. This keeps
the support on the landing when a narrow layout shifts the label toward free
water. The closed-dock marker follows that remaining post. Frame dimensions,
reference points, faces and the five phase-state sources remain unchanged.

## Factory cargo-bridge supplement

The walking Porto↔Fábrica bridge adds two distinct actions to the ferry pair.
All four have stable IDs and authored arrow direction in `WorldMapHud.ts`:
`ferry-costa-porto`, `ferry-porto-costa`, `bridge-porto-factory`, and
`bridge-factory-porto`. The two PORTO boards have separate departure anchors,
callbacks and semantics: right for the Costa ferry, left for the Factory bridge.
The bridge return reuses the released left-arrow blank and right-side support.
All five Factory phase boards use the existing phase-state art.

FÁBRICA needs 82 CSS pixels at the game's original 2-pixel bitmap scale, plus
18 vertical pixels for the acute accent. Its new Blender-authored blank has a
90.844 × 19.361 CSS-pixel safe face and a 128 × 56 CSS-pixel target. It preserves
the original camera's pixels-per-world-unit scale, vertical foot and lighting,
with a wider, slightly taller solid plank, a left departure-side post and the
same cantilever bracket. No old frame, glyph, atlas pixel or target was changed.

Render and package the optional Factory atlas separately:

```sh
blender -b -t 8 -P tools/diorama/render_map_signs.py -- --repo-root . --output-dir /tmp/feka-factory-sign-renders --only factory-right
python tools/diorama/package_map_signs.py --repo-root . --render-dir /tmp/feka-factory-sign-renders --output-dir /tmp/feka-factory-sign-assets --factory-only
```

The production additions are `signs-factory.webp` (256 × 112 pixels, 7,798 bytes)
and `signs-factory.meta.json`. They load once, only when Factory is inspected or
its bridge sign is shown. Missing or invalid supplemental art leaves the full
bitmap fallback available without affecting the released atlas. Both requests
share the HUD's disposal signal. No additional animation loop or click listener
is created during updates.

`factory-sign-validation.json` records the supplemental hashes and transparent
edges. Focused tests check the accented glyph cells against the measured safe
face, independent bridge availability, both PORTO arrows, stable callbacks,
lazy loading, hidden actions and procedural fallbacks. Repacking the original
seven cached Blender renders with the extended packager still reproduces the
released atlas and manifest byte-for-byte.

## Factory–Serra walking signs

Two further stable actions extend the existing four: `walk-factory-serra`
(SERRA right, 104 × 56 CSS pixels) and `walk-serra-factory` (FÁBRICA left,
128 × 56 CSS pixels). Both have `mode: 'walk'`, use Caminho/Passagem wording,
and preserve the destination-world callback fallback. Their departure positions
remain authored by the map owner; absent anchors leave both buttons hidden.
Every Serra stage uses the existing physical phase-state family. Regions five
and six keep the procedural fallback. An explicit cable ride can report
`motionState: 'riding'`, which reads “Na cabine” and keeps the existing skip and
arrival-gated entry controls.

The new Factory-left blank is a separate Blender render of the same solid plank,
camera, lighting and materials. Its arrow points left and its single support and
cantilever bracket sit on the right. The face keeps 90.844 × 19.361 CSS pixels
of measured lettering space; the 82-pixel FÁBRICA name and 18-pixel accented
height fit at the original bitmap scale. Its horizontal letter center is 66.819
CSS pixels. The foot remains `(64, 45.678)` with a rounded 10-pixel decoration
translation, leaving a 0.322-pixel vertical error while the native target stays
fixed. The closed-route marker follows the right post at x104.

```sh
blender -b -t 8 -P tools/diorama/render_map_signs.py -- --repo-root . --output-dir /tmp/feka-factory-left-sign-renders --only factory-left
python tools/diorama/package_map_signs.py --repo-root . --render-dir /tmp/feka-factory-left-sign-renders --output-dir /tmp/feka-factory-left-sign-assets --factory-left-only
```

Only `signs-factory-left.webp` (256 × 112 pixels; 7,936 bytes) and
`signs-factory-left.meta.json` (1,138 bytes) are added to the runtime payload:
9,074 bytes total, fetched once when Serra is explicitly inspected or its left
Factory return sign is visible. Showing the SERRA arrow from Factory reuses the
released atlas. Initial Costa and Factory inspection do not request the left
supplement. Hidden HUD updates defer the request until the map is shown.
Missing, invalid or interrupted art leaves the procedural arrow usable, with
no per-frame retries. The new supplement shares the HUD disposal signal.

`factory-left-sign-validation.json` records dimensions, hashes, transparent
edges and the measured foot/face. Focused tests inspect every accented glyph
cell, reject a wrong-direction wide image, preserve the right-side closed-route
marker, and cover lazy loading, hidden updates, disposal, failure and callback
behavior. A fresh Factory-right Blender render and repack reproduced the
released right atlas and manifest byte-for-byte; repacking the original seven
PNG frames also reproduced their released atlas and manifest byte-for-byte.
Neither existing runtime image nor manifest is modified for this extension.
