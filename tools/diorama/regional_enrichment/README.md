# Regional diorama enrichment sources

Factory and Domínio use the canonical entry points `../render_fabrica_map.py` (with `../factory_enrichment.py`) and `../render_dominio_map.py`. Their published route/camera contracts are unchanged.

Serra and Reserva keep explicit enrichment entry points with small frozen source contracts beside them. These rebuild without an input .blend file. Keep generated scenes, renders, audit logs and comparison media outside the repository.

## Serra

    blender -b -t 6 -P tools/diorama/regional_enrichment/serra/enrich_serra.py -- --output-dir /tmp/serra-enrichment --samples 128 --percentage 100
    bash tools/diorama/regional_enrichment/serra/run_audits.sh /tmp/serra-enrichment
    python tools/diorama/regional_enrichment/serra/summarize_audits.py --output-dir /tmp/serra-enrichment
    python tools/diorama/regional_enrichment/serra/package_candidate.py --render /tmp/serra-enrichment/serra-enriched.png --output-dir /tmp/serra-enrichment/package

`--build-only` skips rendering. `--base-source` may point at the retained canonical Serra builder. The source cabin atlas is the unchanged existing asset, retained here only for reproducible actor/occlusion checks.

## Reserva

    blender -b -t 8 -P tools/diorama/regional_enrichment/reserva/enrich_reserva.py -- --output-dir /tmp/reserva-enrichment --final
    blender -b -t 4 -P tools/diorama/regional_enrichment/reserva/audit_reserva.py -- --scene /tmp/reserva-enrichment/reserva-enriched.blend --output-dir /tmp/reserva-audit
    blender -b -t 4 -P tools/diorama/regional_enrichment/reserva/audit_connectors.py -- --scene /tmp/reserva-enrichment/reserva-enriched.blend --output-dir /tmp/reserva-audit
    python tools/diorama/regional_enrichment/reserva/package_reserva.py --render /tmp/reserva-enrichment/reserva-after.png --audit-dir /tmp/reserva-audit --output-dir /tmp/reserva-enrichment/package

`--build-only` skips rendering. Its frozen `source/` contains the base builder, node/route/camera and connector contracts, and the original Feka sprite/palette used by clearance checks. The optional local packaging/proof helpers retain their explicit source/output conventions; inspect their arguments before running them.

Only reviewed WebP and matching metadata replace the existing full-frame runtime bases. No extra full-size layer, actor or vehicle is baked into these maps.
