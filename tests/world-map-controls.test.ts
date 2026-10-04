import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseMapMetadata } from '../src/adventure/WorldMapArt';
import { COAST_PORT_PLACEMENTS, WORLD_ATLAS_PLACEMENTS, atlasIslandBounds, getAtlasCamera, localToAtlas } from '../src/adventure/WorldAtlasModel';
import { campaignTerrainBounds } from '../src/adventure/GuairaCampaignArt';
import { mapToScreen } from '../src/adventure/WorldMapModel';
import { layoutMapControls, layoutCompactIslandControls, type MapControlBounds, type MapControlPlacement } from '../src/adventure/WorldMapView';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}`, import.meta.url), 'utf8'));
const journey = read('coast-port-journey.meta.json');
const layers = ['costa', 'porto'].map((name, index) => ({ world: index + 1, metadata: parseMapMetadata(read(`${name}-diorama.meta.json`), index + 1)!,
    placement: COAST_PORT_PLACEMENTS[index + 1], overlay: journey.islands[name].overlay }));
const rect = (point: MapControlPlacement) => ({ left: point.x - point.width / 2, right: point.x + point.width / 2, top: point.y - point.height, bottom: point.y });
function assertSeparated(points: MapControlPlacement[], bounds: MapControlBounds) {
    points.forEach((point, index) => {
        const a = rect(point);
        assert.ok(point.width >= 44 && point.height >= 44, 'Do not shrink the native hit target to avoid a collision.');
        assert.ok(a.left >= bounds.left && a.right <= bounds.right && a.top >= bounds.top && a.bottom <= bounds.bottom,
            `Control ${index} clips measured HUD bounds: ${JSON.stringify({ a, bounds })}`);
        points.slice(index + 1).forEach((other, n) => {
            const b = rect(other);
            assert.ok(a.right + 8 <= b.left || b.right + 8 <= a.left || a.bottom + 8 <= b.top || b.bottom + 8 <= a.top,
                `Native targets ${index}/${index + n + 1} overlap: ${JSON.stringify({ a, b })}`);
        });
    });
}

test('compact island targets reject packed rows outside their own shore instead of labeling a neighbor', () => {
    const owners = Array.from({ length: 6 }, (_, n) => ({ left: 190 + n * 4, right: 210 + n * 4, top: 90, bottom: 120 }));
    const points = owners.map(owner => ({ x: (owner.left + owner.right) / 2, y: owner.bottom + 8, width: 44, height: 44 }));
    assert.equal(layoutCompactIslandControls(points, owners, { left: 8, right: 464, top: 66, bottom: 189 }), null);
});

test('Porto zoom200% regression moves the dock onto nearby free water and keeps phase signs near their terrain', () => {
    // Measured positions from the real 590×378 browser screenshot.
    const phases = [{ x: 214, y: 218 }, { x: 260, y: 163 }, { x: 306, y: 220 }, { x: 398, y: 247 }, { x: 418, y: 178 }]
        .map(point => ({ ...point, width: 56, height: 58 }));
    const dock = { x: 158, y: 205, width: 104, height: 56 }, bounds = { left: 8, top: 64, right: 582, bottom: 302 };
    const result = layoutMapControls([...phases, dock], bounds);
    assertSeparated(result, bounds);
    phases.forEach((point, index) => assert.ok(Math.hypot(result[index].x - point.x, result[index].y - point.y) <= 12,
        'Only the tiny phase hit-box collision needs a secondary adjustment.'));
    assert.ok(result[5].x < dock.x, 'Costa dock label should use the free sea to the left.');
    assert.ok(Math.hypot(result[5].x - dock.x, result[5].y - dock.y) <= 36, 'Keep the dock leader short.');
});

test('actual Costa and Porto native control bounds stay separate at portrait, browser zoom and short-landscape cameras', () => {
    const sizes = [[320, 568, 104, 144], [400, 606, 104, 128], [590, 378, 64, 80], [846, 392, 64, 84],
        [1181, 757, 70, 120], [1024, 270, 64, 84], [844, 225, 62, 72]];
    for (const [width, height, top, bottom] of sizes) for (const world of [1, 2]) for (const mode of ['island', 'overview'] as const) {
        const camera = getAtlasCamera({ mode, activeWorld: world, layers, width, height, insets: { top, bottom, left: 16, right: 16 } });
        const phases = Object.values(layers[world - 1].metadata.nodes).map(point => {
            const screen = mapToScreen(localToAtlas(point, layers[world - 1].placement), camera);
            return { x: screen.x + 36, y: screen.y, width: 56, height: 58 };
        });
        const docks = ['costa', 'porto'].flatMap((name, index) => {
            const screen = mapToScreen(localToAtlas(journey.islands[name].dock, COAST_PORT_PLACEMENTS[index + 1]), camera);
            return screen.x > 8 && screen.x < width - 8 && screen.y > top && screen.y < height - bottom
                ? [{ ...screen, width: 104, height: 56 }] : [];
        });
        const original = structuredClone([...phases, ...docks]);
        const bounds = { left: 8, right: width - 8, top: top + 2, bottom: height - bottom - 2 };
        const result = layoutMapControls(original, bounds);
        assertSeparated(result, bounds);
        assert.deepEqual(result, layoutMapControls(original, bounds), 'Placement is deterministic and cannot drift while idle.');
        assert.deepEqual(original, [...phases, ...docks], 'Layout never modifies projected anchors or world geography.');
    }
});

test('control spacing survives camera interpolation without moving offscreen labels onto the wrong island', () => {
    for (const [width, height, top, bottom] of [[320, 568, 104, 144], [590, 378, 64, 80], [846, 392, 64, 84]]) {
        const settings = { layers, width, height, insets: { top, bottom, left: 16, right: 16 } };
        const origin = getAtlasCamera({ ...settings, mode: 'island', activeWorld: 1 });
        for (const mode of ['island', 'overview'] as const) {
            const target = getAtlasCamera({ ...settings, mode, activeWorld: 2 });
            for (let step = 0; step <= 20; step++) {
                const t = step / 20, camera = { ...target, zoom: origin.zoom + (target.zoom - origin.zoom) * t,
                    center: { x: origin.center.x + (target.center.x - origin.center.x) * t, y: origin.center.y + (target.center.y - origin.center.y) * t } };
                const phases = Object.values(layers[1].metadata.nodes).flatMap(point => {
                    const screen = mapToScreen(localToAtlas(point, layers[1].placement), camera);
                    return screen.x >= 0 && screen.x <= width && screen.y >= top && screen.y <= height - bottom
                        ? [{ x: screen.x + 36, y: screen.y, width: 56, height: 58 }] : [];
                });
                const docks = layers.flatMap((layer, index) => {
                    const screen = mapToScreen(localToAtlas(journey.islands[index ? 'porto' : 'costa'].dock, layer.placement), camera);
                    return screen.x > 8 && screen.x < width - 8 && screen.y > top && screen.y < height - bottom
                        ? [{ ...screen, width: 104, height: 56 }] : [];
                });
                const bounds = { left: 8, right: width - 8, top: top + 2, bottom: height - bottom - 2 };
                assertSeparated(layoutMapControls([...phases, ...docks], bounds), bounds);
            }
        }
    }
});

test('subpixel camera easing cannot flip a dock sign between equally close free sides', () => {
    const bounds = { left: 8, top: 150, right: 582, bottom: 238 };
    let offsets: Array<{ x: number; y: number }> = [], previousX = 0, side = 0;
    for (let frame = 0; frame < 90; frame++) {
        const points = [{ x: 260, y: 210, width: 56, height: 58 },
            { x: 260 + Math.sin(frame * .7) * .35, y: 208, width: 104, height: 56 }];
        const result = layoutMapControls(points, bounds, 8, offsets);
        assertSeparated(result, bounds);
        const direction = Math.sign(result[1].x - points[1].x);
        if (frame) {
            assert.equal(direction, side, 'Keep the established dock side through subpixel camera changes.');
            assert.ok(Math.abs(result[1].x - previousX) <= 1, 'The native label must not jitter across candidate solutions.');
        }
        offsets = result.map((point, index) => ({ x: point.x - points[index].x, y: point.y - points[index].y }));
        previousX = result[1].x; side = direction;
    }
});


test('seven-region panorama keeps named Guaíra targets separate or explicitly falls back on compact screens', () => {
    const islands = ['costa','porto','fabrica','serra','reserva','dominio'].map((name, index) => ({
        world: index + 1, metadata: parseMapMetadata(read(`${name}-diorama.meta.json`), index + 1)!, placement: WORLD_ATLAS_PLACEMENTS[index + 1] }));
    for (const [width, height] of [[1920,850], [1180,720], [640,480], [390,700], [320,568], [844,270]]) {
        const compact = width < 640 || height < 480;
        const camera = getAtlasCamera({ mode: 'overview', activeWorld: 1, layers: islands, width, height,
            insets: { top: 70, bottom: 130, left: 16, right: 16 }, connectionBounds: [campaignTerrainBounds('guaira')] });
        const boxes = [...islands.map(atlasIslandBounds), campaignTerrainBounds('guaira')];
        const owners = boxes.map(box => {
            const a = mapToScreen({ x: box.left, y: box.top }, camera), b = mapToScreen({ x: box.right, y: box.bottom }, camera);
            return { left: a.x, top: a.y, right: b.x, bottom: b.y };
        });
        const points = owners.map((owner, i) => ({ x: (owner.left + owner.right) / 2, y: owner.bottom + (compact ? 8 : 32),
            width: compact && i < 6 ? 44 : 128, height: 44 }));
        const bounds = { left: 8, right: width - 8, top: 72, bottom: height - 132 };
        const result = compact ? layoutCompactIslandControls(points, owners, bounds) : layoutMapControls(points, bounds);
        if (result) { assert.equal(result.length, 7); assertSeparated(result, bounds); }
        else assert.ok(compact, 'Wide atlas must keep all seven labels on terrain.');
    }
});
