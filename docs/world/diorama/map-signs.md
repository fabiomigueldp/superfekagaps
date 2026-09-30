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

The accepted atlas is 560 × 232 pixels and 30,000 bytes. Its seven frames
preserve full-contrast original bitmap IDs and combine selection/completion
without hiding either state. The native phase and dock targets remain
56 × 58 and 104 × 56 CSS pixels. Only decoration moves to align the measured
feet; rounding that translation leaves less than half a CSS pixel of error.

Repacking the original PNGs reproduced the atlas and manifest byte-for-byte.
A fresh Blender render through the portable source also reproduced the stage
pixels and measured metadata. Alpha checks cover the outer two pixels of every
packed frame, including the completion pennant and contact shadow.
