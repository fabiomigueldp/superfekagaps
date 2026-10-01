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
two-pixel steps remain whole pixels at the 64 × 22 compact display size. The
same painter is used for atlas and fallback boards, including locked previews.
It never overlaps accent cells or changes the foot/target. Keyboard focus keeps
its separate native white outline; it does not move the selection marker.

The marker pass passed 504 TypeScript + 3 server tests in 12.80 s, both
TypeScript projects and diff checks. Vite built in 1.25 s: 491.89 kB JS /
152.43 kB gzip. No image, CSS, hitbox, camera, route or save changed. Actual
desktop and compact preview review will compare selected Domínio with keyboard
focus on Reserva, so those two states can be judged independently.

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
