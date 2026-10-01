# Coastal map source

Costa v6 is reconstructed from procedural Python with no binary scene input. Follow `costa-v6/README.md`; supply this repository and an explicit output directory.

Porto is reconstructed from the retained canonical `tools/diorama/render_porto_map.py` plus the enrichment pass:

    blender -b -t 8 -P tools/diorama/coastal_enrichment/enrich_porto.py -- --repo-root /absolute/repo --output-dir /tmp/porto-enrichment --samples 192 --percentage 100
    blender -b -t 8 -P tools/diorama/coastal_enrichment/audit_porto_enrichment.py -- --repo-root /absolute/repo --scene /tmp/porto-enrichment/porto-enriched.blend --output-dir /tmp/porto-enrichment
    python tools/diorama/coastal_enrichment/package_porto_candidate.py --repo-root /absolute/repo --image /tmp/porto-enrichment/porto-after.png --audit-dir /tmp/porto-enrichment --output-dir /tmp/porto-enrichment/package

Keep all generated output outside the repository until its pixels and audit are reviewed. Copy only the approved WebP and matching metadata into `public/assets/world/map`. Package Costa's final RGBA at WebP quality 91, method 6, exact alpha, without resizing; update its normalized artBounds from the PNG alpha bounds. Both shipped layers remain 1920 × 1200.

The production map uses the existing per-island lazy-loading path. These are replacements, not extra full-frame overlays. Blender scenes, reference images and proof captures are not production assets.
