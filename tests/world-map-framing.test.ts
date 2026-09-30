import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { COSTA_ART_BOUNDS, frameMapPins, mapActorScale, parseMapMetadata } from '../src/adventure/WorldMapArt';
import { getMapCamera, mapToScreen, type MapCamera, type MapPoint } from '../src/adventure/WorldMapModel';

const metadata = parseMapMetadata(JSON.parse(readFileSync(new URL('../public/assets/world/map/costa-diorama.meta.json', import.meta.url), 'utf8')))!;
const points: Record<number, MapPoint> = Object.fromEntries(Object.values(metadata.nodes).map((point, index) => [index, point]));
const EPSILON = 1e-6;

function requestedCamera(width: number, height: number, selected: number, overview = false, opening = 1): MapCamera {
    const camera = getMapCamera(selected, { overview }, width, height), compact = width < 600;
    const fitHeight = Math.min(width / 1.6, height), focus = points[selected];
    const closeZoom = compact ? Math.min(1.25, Math.max(.45, (height - 140) / (fitHeight * .93))) : 1.04;
    camera.zoom = (overview ? Math.min(.82, closeZoom) : closeZoom) * opening;
    camera.center = { x: .5 + (focus.x - .5) * .12,
        y: .52 + (focus.y - .52) * .035 - (compact ? 60 / (fitHeight * camera.zoom) : 0) };
    return camera;
}

function assertFramed(camera: MapCamera, selected: number): void {
    const compact = camera.width < 600;
    const pinTop = Math.min(compact ? 132 : 12, Math.max(8, camera.height * .35));
    const artTop = mapToScreen({ x: .5, y: COSTA_ART_BOUNDS.top }, camera).y;
    const artBottom = mapToScreen({ x: .5, y: COSTA_ART_BOUNDS.bottom }, camera).y;
    assert.ok(artTop >= (compact ? 135 : 80) - EPSILON, `Lighthouse enters top tools: ${artTop}`);
    assert.ok(artBottom <= camera.height - 12 + EPSILON, `Dock enters footer: ${artBottom}`);
    for (const [index, point] of Object.entries(points)) {
        const q = mapToScreen(point, camera);
        const top = q.y - (compact ? 54 : 58) - (Number(index) === selected ? mapActorScale(camera) * 26 + 4 : 0) - 8;
        assert.ok(top >= pinTop - EPSILON, `Stage ${Number(index) + 1} loses its focus ring: ${top}`);
        assert.ok(q.y + 8 <= camera.height - 12 + EPSILON, `Stage ${Number(index) + 1} leaves scene`);
    }
}

test('Costa silhouette framing clears the desktop roof overlap without clipping the dock', () => {
    const camera = requestedCamera(1180, 555, 0), original = structuredClone(camera);
    const pinsOnly = frameMapPins(camera, points, 0, false);
    assert.ok(mapToScreen({ x: .5, y: COSTA_ART_BOUNDS.top }, pinsOnly).y < 25, 'Reproduce the 1180 × 757 browser finding.');
    assert.deepEqual(pinsOnly, camera, 'Omitting artwork bounds preserves pin-only fallback behavior.');
    const framed = frameMapPins(camera, points, 0, false, COSTA_ART_BOUNDS);
    assertFramed(framed, 0);
    assert.ok(framed.zoom > .935 && framed.zoom < .937);
    assert.equal(framed.center.x, camera.center.x);
    assert.deepEqual(camera, original, 'Framing must not mutate the input camera.');
});

test('artwork and existing pin bounds fit every stage across desktop, portrait, and short landscape', () => {
    // Heights are scene heights after the existing CSS footer inset.
    for (const [width, height] of [[1180, 555], [1440, 698], [1920, 854], [1024, 435],
        [390, 585], [390, 408], [390, 341], [375, 309], [800, 235], [844, 225], [667, 210]]) {
        for (let selected = 0; selected < 5; selected++) for (const overview of [false, true]) {
            const requested = requestedCamera(width, height, selected, overview);
            const framed = frameMapPins(requested, points, selected, width < 600, COSTA_ART_BOUNDS);
            assertFramed(framed, selected);
            assert.ok(framed.zoom <= requested.zoom, 'Framing never enlarges the requested composition.');
            if (width === 844 && !overview) assert.ok(framed.zoom > .65, 'Keep short landscape readable by retaining the separate pin inset.');
            const repeated = frameMapPins(framed, points, selected, width < 600, COSTA_ART_BOUNDS);
            assert.ok(Math.abs(repeated.zoom - framed.zoom) < EPSILON);
            assert.ok(Math.abs(repeated.center.y - framed.center.y) < EPSILON, 'Settled framing must not creep every frame.');
        }
    }
    const mobile = requestedCamera(390, 585, 0);
    assert.deepEqual(frameMapPins(mobile, points, 0, true, COSTA_ART_BOUNDS), mobile, 'A tall mobile composition that already fits stays unchanged.');
});

test('framing after camera interpolation keeps art and controls safe throughout opening, selection, and resize', () => {
    let camera = getMapCamera(0, { overview: true }, 1180, 555);
    for (const [width, height] of [[1180, 555], [390, 341], [844, 225], [390, 585], [1440, 698]]) {
        for (let selected = 0; selected < 5; selected++) {
            for (let frame = 0; frame <= 24; frame++) {
                const raw = requestedCamera(width, height, selected, selected % 2 === 1, .84 + .16 * frame / 24);
                const target = frameMapPins(raw, points, selected, width < 600, COSTA_ART_BOUNDS);
                camera = { ...target, zoom: camera.zoom + (target.zoom - camera.zoom) * .15,
                    center: { x: camera.center.x + (target.center.x - camera.center.x) * .15,
                        y: camera.center.y + (target.center.y - camera.center.y) * .15 } };
                camera = frameMapPins(camera, points, selected, width < 600, COSTA_ART_BOUNDS);
                assertFramed(camera, selected);
            }
        }
    }
});
