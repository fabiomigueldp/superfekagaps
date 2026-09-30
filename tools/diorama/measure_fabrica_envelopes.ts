/** Reproduce measured HUD/actor envelopes. Run: node --import tsx tools/diorama/measure_fabrica_envelopes.ts */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { frameMapPins, mapActorScale, parseMapMetadata } from '../../src/adventure/WorldMapArt.ts';

const source = fileURLToPath(new URL('../../public/assets/world/map/fabrica-diorama.meta.json', import.meta.url));
const raw = readFileSync(source, 'utf8'), data = parseMapMetadata(JSON.parse(raw), 3);
if (!data) throw new Error('Fábrica metadata must contain five valid nodes and complete matching routes.');
const artBounds = data.artBounds ?? { top: 0, bottom: 1 };
const points = Object.fromEntries(Object.values(data.nodes).map((point, i) => [10 + i, point]));
// Fixed measured scene width/height, header bottom and footer top in CSS pixels.
// Changing a profile requires comparing the resulting envelopes and rerunning its billboard audit.
const profiles = [
    ['desktop', 1180, 757, 94, 563], ['browser-desktop', 1181, 757, 94, 563],
    ['portrait', 400, 606, 92, 425], ['landscape', 846, 392, 68, 307],
    ['compact-boundary', 640, 606, 92, 425], ['desktop-boundary', 641, 606, 92, 425],
    ['editor', 506, 392, 59, 270], ['narrow-portrait', 320, 568, 92, 377],
] as const;
const results = profiles.flatMap(([profile, width, height, headerBottom, footerTop]) => [false, true].map(overview => {
    const compact = width <= 640, fit = Math.min(width / 1.6, height);
    const hud = { top: headerBottom + 14, bottom: height - footerTop + 12 };
    const candidates = [10, 11, 12, 13, 14].flatMap(selected => [.84, 1].map(opening => {
        const focus = points[selected];
        const zoom = (compact ? Math.min(1.25, Math.max(.45, (height - 140) / (fit * .93))) : 1.04) * opening;
        let camera = frameMapPins({ width, height, zoom, center: { x: .5 + (focus.x - .5) * .12,
            y: .52 + (focus.y - .52) * .035 - (compact ? 60 / (fit * zoom) : 0) } },
        points, selected, compact, artBounds, hud);
        if (overview) camera.zoom *= .82;
        camera = frameMapPins(camera, points, selected, compact, artBounds, hud);
        const actorScale = mapActorScale(camera), s = fit * camera.zoom;
        // Bounds of any painted full-grid pixel after Math.round(origin) + Math.ceil(scale).
        // The actual transparent glyph is contained within this conservative 16×26 grid box.
        const css = { left: -8 * actorScale - .5, right: 7 * actorScale + Math.ceil(actorScale) + .5,
            top: -26 * actorScale - .5, bottom: -actorScale + Math.ceil(actorScale) + .5 };
        return { selectedStage: `3-${selected - 9}`, opening, cameraZoom: camera.zoom, actorScale,
            renderedArtHeightCssPx: s, nominalSpriteCssPx: { width: 16 * actorScale, height: 26 * actorScale },
            reportedEnvelopeCssPx: { width: 16 * actorScale + 2, height: 26 * actorScale + 2 },
            reportedEnvelopeNormalized: { width: (16 * actorScale + 2) / (1.6 * s), height: (26 * actorScale + 2) / s },
            rasterGridBoundsFromFootCssPx: css,
            rasterGridBoundsFromFootNormalized: { left: css.left / (1.6 * s), right: css.right / (1.6 * s),
                top: css.top / s, bottom: css.bottom / s } };
    }));
    candidates.sort((a, b) => b.reportedEnvelopeNormalized.height - a.reportedEnvelopeNormalized.height);
    return { profile, width, height, headerBottom, footerTop, hudInsetsCssPx: hud,
        mode: overview ? 'panorama' : 'close', worstCandidate: candidates[0], candidates };
}));
const output = {
    source: 'public/assets/world/map/fabrica-diorama.meta.json', metadataSha256: createHash('sha256').update(raw).digest('hex'), artBounds,
    units: 'Sprite/frame and HUD measurements use CSS pixels, independent of devicePixelRatio. Normalized coordinates use the full 1920×1200 exported image, x right and y down. Bounds are relative to the foot anchor.',
    scope: 'Five stage selections, opening factors 0.84 and 1, fitted close/panorama targets. Does not claim a universal bound over arbitrary tiny viewports or resize/camera interpolation transients.',
    support: 'Blender support/headroom audits are separate world-space checks. Their 0.52-unit support footprint must not be equated with this camera-facing 16×26 sprite grid.',
    formula: 'S=min(viewportWidth/1.6,viewportHeight)*camera.zoom; x CSS pixels divide by 1.6*S and y CSS pixels by S. Use rasterGridBoundsFromFootNormalized for precisely anchored camera-ray tests; reportedEnvelopeNormalized is a padded width/height summary.',
    results,
};
const cache = fileURLToPath(new URL('../../.cache/diorama/', import.meta.url));
mkdirSync(cache, { recursive: true });
const target = cache + '/fabrica-runtime-envelopes-full.json';
writeFileSync(target, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ target, artBounds: output.artBounds, metadataSha256: output.metadataSha256,
    envelopes: results.map(({ profile, mode, worstCandidate }) => ({ profile, mode, ...worstCandidate.reportedEnvelopeNormalized })) }, null, 2));

const compact = {
    units: output.units, scope: output.scope, formula: output.formula, support: output.support,
    source: output.source, metadataSha256: output.metadataSha256, artBoundsUsed: output.artBounds,
    sourceScript: 'tools/diorama/measure_fabrica_envelopes.ts',
    profiles: results.map(({ profile, width, height, headerBottom, footerTop, hudInsetsCssPx, mode, worstCandidate }) => ({
        profile, width, height, headerBottom, footerTop, hudInsetsCssPx, mode,
        selectedStage: worstCandidate.selectedStage, opening: worstCandidate.opening,
        normalized: worstCandidate.rasterGridBoundsFromFootNormalized,
        actorScale: worstCandidate.actorScale, cameraZoom: worstCandidate.cameraZoom,
    })),
};
writeFileSync(fileURLToPath(new URL('../../docs/world/diorama/fabrica-runtime-envelopes.json', import.meta.url)), JSON.stringify(compact, null, 2) + '\n');
