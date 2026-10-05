/** Reproduce the current atlas actor grid. Run with node --import tsx; --check detects stale reports. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_SPRITES, PLAYER_WALK } from '../../src/assets/playerSpriteSpec';
import { campaignArtBounds, campaignTerrainBounds } from '../../src/adventure/GuairaCampaignArt';
import { parseMapMetadata } from '../../src/adventure/WorldMapArt';
import { atlasActorBounds, atlasActorScale } from '../../src/adventure/WorldAtlasArt';
import { getAtlasCamera, localToAtlas, WORLD_ATLAS_PLACEMENTS, type AtlasBounds } from '../../src/adventure/WorldAtlasModel';
import type { MapCamera } from '../../src/adventure/WorldMapModel';
import { DELICIA_ATLAS } from '../../src/adventure/delicia/DeliciaIsland';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = 'public/assets/world/map/fabrica-diorama.meta.json';
const target = resolve(root, 'docs/world/diorama/fabrica-runtime-envelopes.json');
const names = ['costa', 'porto', 'fabrica', 'serra', 'reserva', 'dominio'];
const runtimeSources = ['tools/diorama/measure_fabrica_envelopes.ts', 'src/assets/playerSpriteSpec.ts',
    'src/adventure/WorldAtlasArt.ts', 'src/adventure/WorldAtlasModel.ts', 'src/adventure/WorldMapArt.ts',
    'src/adventure/WorldMapModel.ts', 'src/adventure/GuairaCampaignArt.ts', 'src/adventure/delicia/DeliciaIsland.ts',
    ...names.map(name => `public/assets/world/map/${name}-diorama.meta.json`),
    ...['fabrica', 'guaira', 'serra'].map(name => `public/assets/world/map/guaira-campaign/${name}.meta.json`),
    'public/assets/world/map/port-factory-bridge.meta.json'];
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const normalizeText = (value: string) => value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const sha256 = (value: string) => createHash('sha256').update(normalizeText(value)).digest('hex');
export const FABRICA_PROFILES = [
    ['desktop', 1180, 757, 94, 563], ['browser-desktop', 1181, 757, 94, 563],
    ['portrait', 400, 606, 92, 425], ['landscape', 846, 392, 68, 307],
    ['compact-boundary', 640, 606, 92, 425], ['desktop-boundary', 641, 606, 92, 425],
    ['editor', 506, 392, 59, 270], ['narrow-portrait', 320, 568, 92, 377],
    ['tall-portrait', 390, 740, 92, 559], ['short-landscape', 844, 390, 68, 305],
] as const;

/** Bound Math.round(origin) + Math.ceil(scale), including every transparent grid cell.
 * Offsets are relative to the foot in CSS pixels; shadow is a separate ground decal. */
export function fabricaRasterEnvelope(camera: MapCamera) {
    const scale = atlasActorScale(camera), span = Math.min(camera.width / 1.6, camera.height) * camera.zoom;
    if (!(span > 0) || !Number.isFinite(span)) throw new Error('Camera must have a finite positive rendered span.');
    const css = { left: -8 * scale - .5, right: 7 * scale + Math.ceil(scale) + .5,
        top: -26 * scale - .5, bottom: -scale + Math.ceil(scale) + .5 };
    const placement = WORLD_ATLAS_PLACEMENTS[3];
    return { actorScale: scale, css, normalized: { left: css.left / (1.6 * span * placement.scale),
        right: css.right / (1.6 * span * placement.scale), top: css.top / (span * placement.scale),
        bottom: css.bottom / (span * placement.scale) } };
}

export function measureFabricaEnvelopes() {
    if ([PLAYER_SPRITES.idle, ...PLAYER_WALK].some(frame => frame.length !== 26 || frame.some(row => row.length > 16)))
        throw new Error('The atlas grid changed; reconcile actor bounds before generating its geometry proof.');
    const raw = read(source), published = JSON.parse(raw);
    const bridge = JSON.parse(read('public/assets/world/map/port-factory-bridge.meta.json'));
    const layers = names.map((name, index) => {
        const world = index + 1, metadata = parseMapMetadata(JSON.parse(read(`public/assets/world/map/${name}-diorama.meta.json`)), world);
        if (!metadata) throw new Error(`Invalid published ${name} metadata.`);
        const approach = world === 2 ? bridge.islands.porto : world === 3 ? bridge.islands.fabrica : null;
        return { world, metadata, placement: WORLD_ATLAS_PLACEMENTS[world],
            approachBounds: approach ? [approach.approachBounds as AtlasBounds] : [] };
    });
    const connectionBounds = [campaignArtBounds('fabrica'), campaignTerrainBounds('guaira'), campaignArtBounds('serra'),
        { left: DELICIA_ATLAS.left, top: DELICIA_ATLAS.top, right: DELICIA_ATLAS.left + DELICIA_ATLAS.widthInMap,
            bottom: DELICIA_ATLAS.top + DELICIA_ATLAS.heightInMap }, ...Object.values(bridge.overlays).map(value => {
            const layer = value as { left: number; top: number; widthInMap: number; heightInMap: number };
            return { left: layer.left, top: layer.top, right: layer.left + layer.widthInMap, bottom: layer.top + layer.heightInMap };
        })];
    const profiles = FABRICA_PROFILES.flatMap(([profile, width, height, headerBottom, footerTop]) =>
        (['close', 'panorama'] as const).map(mode => {
            const hudInsetsCssPx = { top: Math.max(16, Math.min(height * .35, headerBottom + 14)),
                bottom: Math.max(12, Math.min(height * .48, height - footerTop + 12)) };
            const candidates = Object.entries(layers[2].metadata.nodes).map(([selectedStage, point]) => {
                const camera = getAtlasCamera({ mode: mode === 'close' ? 'island' : 'overview', activeWorld: 3, layers,
                    width, height, insets: { ...hudInsetsCssPx, left: 16, right: 16 }, connectionBounds,
                    ...(mode === 'close' ? { focus: localToAtlas(point, layers[2].placement) } : {}) });
                return { selectedStage, camera, ...fabricaRasterEnvelope(camera) };
            });
            const normalized = { left: Math.min(...candidates.map(c => c.normalized.left)),
                right: Math.max(...candidates.map(c => c.normalized.right)), top: Math.min(...candidates.map(c => c.normalized.top)),
                bottom: Math.max(...candidates.map(c => c.normalized.bottom)) };
            return { profile, width, height, headerBottom, footerTop, hudInsetsCssPx, mode, normalized,
                candidates: candidates.map(({ selectedStage, camera, actorScale }) => ({ selectedStage, camera, actorScale })) };
        }));
    return { version: 2, model: 'world-atlas', sourceScript: 'tools/diorama/measure_fabrica_envelopes.ts', source,
        hashEncoding: 'UTF-8 text with LF line endings, excluding BOM',
        metadataSha256: sha256(raw), sourceHashes: Object.fromEntries(runtimeSources.map(path => [path, sha256(read(path))])),
        sourceGeometry: Object.fromEntries(['world', 'size', 'camera', 'nodes', 'routes', 'secretRoute', 'worldRoutes'].map(key => [key, published[key]])),
        physicalNormalized: atlasActorBounds({ x: 0, y: 0 }, undefined, false),
        units: 'CSS pixels, independent of devicePixelRatio; normalized offsets use the full Factory image and its unit-scale atlas placement. physicalNormalized is the camera-independent actor body before pixel rounding.',
        scope: 'Ten fixed viewport/HUD scenarios, five Factory selections, settled island and terrain panorama cameras. Panorama includes six dioramas, cargo bridge, Guaira terrain/airports and Delicia. These are deterministic model inputs, not fresh browser HUD measurements. Vehicle-dependent focus bounds, channel travel, interpolation and arbitrary other viewports are outside this proof.',
        formula: 'atlasActorBounds supplies the physical 16x26 body. atlasActorScale(getAtlasCamera(...)) supplies the rounded pixel envelope normalized against the rendered Factory span. Each profile unions every selection and both facings. Raster overdraw at small panorama scales is reported separately from physical clearance. Shadow and foot support are separate checks.',
        support: 'World support/headroom and ground shadow audits are independent of the upright actor billboard; the lowest billboard ray is 10% of its height.',
        artBoundsUsed: published.artBounds, profiles };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const report = measureFabricaEnvelopes(), bytes = JSON.stringify(report, null, 2) + '\n';
    if (process.argv.includes('--check')) {
        if (normalizeText(readFileSync(target, 'utf8')) !== bytes) throw new Error('Factory atlas envelopes are stale. Regenerate with this script and review the new geometry audit.');
        console.log('Factory atlas envelope report is current.');
    } else {
        const cache = resolve(root, '.cache/diorama/fabrica-runtime-envelopes.json');
        mkdirSync(dirname(cache), { recursive: true }); writeFileSync(cache, bytes); writeFileSync(target, bytes);
        console.log(JSON.stringify({ target, profiles: report.profiles.length, model: report.model }));
    }
}
