# Four-region art and map navigation refinement

Fábrica, Serra, Reserva and Domínio replace their existing 1920 × 1200 RGBA island bases with richer authored Blender geometry/materials. Five landings, stage IDs, routes, timings, cameras, island placement, terminal overlays and moving vehicles remain unchanged. Metadata differs only in measured artBounds for Fábrica/Serra/Reserva; Domínio metadata is byte-identical.

The four image downloads together shrink by 28,992 bytes; decoded RGBA dimensions do not grow. `regional-enrichment-manifest.json` records the exact assets. Procedural source is retained; scenes and visual comparison media remain in the separate authoring packages.

Source audits cover the original Feka, supported paths and their two approaches. Added terrain has also been tested against all 1,034 recorded current boat64 poses: zero open-water contacts, including 602 Reserva–Domínio outbound, inbound and reversing poses. The older Domínio connector geometry audit used eight headings; it is not substituted for the independent boat64 raster check. Existing terminal/low-body projection contacts stay documented separately. Browser framing, compositing and travel remain the final integration gate.

## Navigation feedback

An idle blocked preview now offers **Voltar ao Feka**, returning directly to the last arrived stage. Choosing Feka's current island from the region menu likewise restores that exact arrival rather than sending him to phase 1. Travelling states keep the existing journey controls and cannot use this return action mid-transit.

The panorama toggle reads **MAPA / ILHA**, with matching accessible names and tooltips. Short-height layouts retain three compact seal marks, or **Encontro** for a boss, next to the stage title. The return label uses two bitmap lines so targets stay at least 44px without increasing footer height. These changes preserve progression rules, optional collectibles and the existing map layout.
