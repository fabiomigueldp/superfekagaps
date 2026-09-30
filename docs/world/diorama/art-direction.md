# Costa dos Gaps: original rendered diorama

This is original procedural Blender artwork, created for the Costa first playable map slice. It borrows the archipelago concept's subject vocabulary and tropical color direction while using new geometry, composition, camera, and materials. The source reference is `docs/world/conceitos/imagens/13-arquipelago.png`.

## Visual construction

- Elevated orthographic three-quarter camera; one continuous sandy shoreline
- Layered, eroded sandstone terraces, scalloped turf caps, trailing coastal plants
- Individually shaped coconut fronds, trunk collars, meadow shrubs, aloe, flowers and shells
- Natural sandstone arch, physically modeled plank-and-rope gap bridge, and carved stair climbs
- Burnt-coral/ivory striped lighthouse with glazed lantern, balcony rail, brass finial, and keeper's tiled-roof cottage
- Small timber dock with piles, rope, barrels and mooring coil
- Five unobstructed natural circular clearings, leaving runtime markers and characters separate
- Separate miniature Porto with warehouses, crane and suspended cargo, wharf, cargo boxes and tugboat

No text, stage numerals, numbered markers, character, or UI is baked into the art. The arch and bridge geometry have actual openings. Routes are exported from authored world-space paths through the same camera used for rendering.

## Reproduction

From repository root, with Blender 4.x installed:

```sh
blender -b -t 12 -P tools/diorama/render_costa.py
blender -b -t 6 -P tools/diorama/render_porto.py
python tools/diorama/package_assets.py
```

A faster half-size inspection uses `-- --preview` after the Costa script. It also writes a disposable Blender scene to `/tmp/costa-diorama-source.blend`; `render_cached.py` can render this cache at final quality. No Blender binary scene is required in version control.

Cycles CPU is used with transparent film. The installed Blender build lacks OpenImageDenoise, so the scripts explicitly disable unavailable denoising and use sufficiently sampled final renders. Color values are authored in sRGB and converted to linear shader values.

## Compositing contract

`costa-diorama.png` and its WebP variants are full 1920×1200 RGBA images. The shadow shares the camera and 8:5 canvas framing, packaged at 640×400 for efficient low-frequency alpha compositing. `porto-distant.png` is a separate 960×600 RGBA 8:5 miniature and can be placed/scaled independently.

Do not crop the Costa art or use `object-fit: cover` independently of its overlays. Position both the image and runtime coordinates in the same full 8:5 rectangle. Preserve premultiplied/straight-alpha conventions when importing to the engine.

`costa-diorama.meta.json` exports normalized coordinates with a top-left origin:

- `nodes['1-1' … '1-5']`: `x`, `y`, plus authored world position and clearing radius
- `routes['0:1' … '3:4']`: arrays of normalized polyline points
- `secretRoute`: the dotted optional branch from the arch clearing to the lighthouse approach
- `worldRoutes`, `camera`, and `size`: source-space documentation

`art-manifest.json` records canvas dimensions, nonzero alpha bounds, and shipped byte sizes. Main WebP variants use quality 91 with lossless alpha. The contact shadow is smoothed and alpha-quantized during packaging; use it beneath the island at the same full image bounds. The additional `.lossless.webp` files preserve the source PNG pixels.
