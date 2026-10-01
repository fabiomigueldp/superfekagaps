import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fallbackMapMetadata, parseMapMetadata } from '../src/adventure/WorldMapArt';
import { mapToScreen, screenToMap, type MapPoint } from '../src/adventure/WorldMapModel';
import { ATLAS_ART_BOUNDS, ATLAS_FOCUS_CLEARANCE, COAST_PORT_PLACEMENTS, atlasIslandBounds, atlasIslandCamera,
    atlasNodePoints, atlasToLocal, atlasTravelWindow, getAtlasCamera, localPathToAtlas, localToAtlas, transformAtlasMetadata,
    type AtlasCameraOptions, type AtlasIslandDescriptor } from '../src/adventure/WorldAtlasModel';
import { atlasActorScale, atlasBoatBounds, type BoatAtlasFrame } from '../src/adventure/WorldAtlasArt';

const layers: AtlasIslandDescriptor[] = ['costa', 'porto'].map((name, index) => ({ world: index + 1,
    metadata: parseMapMetadata(JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}-diorama.meta.json`, import.meta.url), 'utf8')), index + 1)!,
    placement: COAST_PORT_PLACEMENTS[index + 1] }));
const sizes = [[1181, 757], [400, 606], [320, 568], [846, 392]];
const EPS = 1e-7;
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < EPS, `${actual} != ${expected}`);
const frame: BoatAtlasFrame = { width: 384, height: 256, passengerFoot: { x: 198, y: 148 },
    widthInMap: 4.15 / 20.6, passengerPixelScale: 3 };

test('fixed placements preserve authored stage points and polylines without mutating local exports', () => {
    const original = structuredClone(layers);
    const points = atlasNodePoints(layers);
    for (const layer of layers) {
        const transformed = transformAtlasMetadata(layer.metadata, layer.placement);
        for (const [id, local] of Object.entries(layer.metadata.nodes)) {
            assert.deepEqual(transformed.nodes[id], localToAtlas(local, layer.placement));
            close(atlasToLocal(transformed.nodes[id], layer.placement).x, local.x);
            close(atlasToLocal(transformed.nodes[id], layer.placement).y, local.y);
        }
        for (const [id, path] of Object.entries(layer.metadata.routes))
            assert.deepEqual(transformed.routes[id], localPathToAtlas(path, layer.placement));
        assert.deepEqual(transformed.secretRoute, localPathToAtlas(layer.metadata.secretRoute, layer.placement));
    }
    assert.ok(points[5].x > 1, 'Porto lives in the same wider world, beyond Costa image coordinates.');
    assert.ok(points[5].x > points[0].x);
    assert.deepEqual(layers, original);
});

test('projection and island-local cameras agree exactly beyond the unit square', () => {
    const placement = { origin: { x: 1.1, y: -.12 }, scale: .83 };
    for (const [width, height] of sizes) for (const zoom of [.4, 1.3, 2]) {
        const camera = { width, height, zoom, center: { x: 1.15, y: .45 } };
        const localCamera = atlasIslandCamera(camera, placement);
        for (const local of [{ x: 0, y: 0 }, { x: .4, y: .8 }, { x: 1, y: 1 }]) {
            const point = localToAtlas(local, placement);
            const screen = mapToScreen(point, camera), fromLocal = mapToScreen(local, localCamera);
            close(screen.x, fromLocal.x); close(screen.y, fromLocal.y);
            const recovered = screenToMap(screen, camera);
            close(recovered.x, point.x); close(recovered.y, point.y);
        }
    }
});

test('selection and camera mode change the view without swapping or resizing island geography', () => {
    for (const [width, height] of sizes) for (const activeWorld of [1, 2]) for (const mode of ['island', 'overview', 'channel'] as const) {
        const camera = getAtlasCamera({ width, height, layers, activeWorld, mode,
            travelPoints: [{ x: .65, y: .93 }, { x: 1.25, y: .73 }], insets: { top: 72, bottom: 110 } });
        const originA = mapToScreen(localToAtlas({ x: 0, y: 0 }, layers[0].placement), camera);
        const originB = mapToScreen(localToAtlas({ x: 0, y: 0 }, layers[1].placement), camera);
        const endA = mapToScreen(localToAtlas({ x: 1, y: 1 }, layers[0].placement), camera);
        const endB = mapToScreen(localToAtlas({ x: 1, y: 1 }, layers[1].placement), camera);
        close(endA.x - originA.x, endB.x - originB.x);
        close(endA.y - originA.y, endB.y - originB.y);
        close((originB.x - originA.x) / (endA.x - originA.x), 1.1);
        close((originB.y - originA.y) / (endA.y - originA.y), -.12);
    }
});

function assertInside(point: MapPoint, options: AtlasCameraOptions, clearance = 0) {
    const camera = getAtlasCamera(options), screen = mapToScreen(point, camera), hud = options.insets;
    assert.ok(screen.x - clearance >= (hud?.left ?? 0) - EPS, `Left clipped: ${JSON.stringify(screen)}`);
    assert.ok(screen.x + clearance <= options.width - (hud?.right ?? 0) + EPS, `Right clipped: ${JSON.stringify(screen)}`);
    assert.ok(screen.y - clearance >= (hud?.top ?? 0) - EPS, `Top clipped: ${JSON.stringify(screen)}`);
    assert.ok(screen.y + clearance <= options.height - (hud?.bottom ?? 0) + EPS, `Bottom clipped: ${JSON.stringify(screen)}`);
}

test('active and overview cameras fit authored silhouettes and 44px focus clearances at every target viewport', () => {
    for (const [width, height] of sizes) for (const activeWorld of [1, 2]) for (const mode of ['island', 'overview'] as const) {
        const visible = mode === 'overview' ? layers : [layers[activeWorld - 1]];
        const options: AtlasCameraOptions = { width, height, layers, activeWorld, mode, showPins: true,
            insets: { top: width < 500 ? 68 : 64, bottom: height < 450 ? 90 : 118, left: 18, right: 18 } };
        for (const layer of visible) {
            const bounds = atlasIslandBounds(layer);
            assertInside({ x: bounds.left, y: bounds.top }, options, 12);
            assertInside({ x: bounds.right, y: bounds.bottom }, options, 12);
            for (const point of Object.values(layer.metadata.nodes))
                assertInside(localToAtlas(point, layer.placement), options, ATLAS_FOCUS_CLEARANCE);
        }
        assert.deepEqual(getAtlasCamera(options), getAtlasCamera(options), 'The fit is stateless and cannot creep frame by frame.');
    }
});

test('channel framing fits authored crossing points and anchored boat while cropping distant land on phones', () => {
    // The model consumes authored global routes; these are an independent geometry fixture.
    const travelPoints = [{ x: .61, y: .95 }, { x: .82, y: .96 }, { x: 1.12, y: .90 }, { x: 1.27, y: .74 }];
    for (const [width, height] of sizes) {
        const foot = travelPoints[1], boat = atlasBoatBounds(foot, frame);
        const window = width < 600 ? atlasTravelWindow(travelPoints, foot) : travelPoints;
        const options: AtlasCameraOptions = { width, height, layers, activeWorld: 1, mode: 'channel',
            travelPoints: window, focus: foot, focusBounds: [boat], showPins: false,
            insets: { top: 65, right: 16, bottom: 110, left: 16 } };
        for (const point of window) assertInside(point, options, ATLAS_FOCUS_CLEARANCE);
        assertInside({ x: boat.left, y: boat.top }, options, 12);
        assertInside({ x: boat.right, y: boat.bottom }, options, 12);
        const channel = getAtlasCamera(options), overview = getAtlasCamera({ ...options, mode: 'overview', travelPoints: [], focusBounds: [] });
        if (width < 500) assert.ok(channel.zoom > overview.zoom * 1.8, 'Phone journey is a closer view of the docks and boat.');
        assert.ok(atlasActorScale(channel, frame) * 26 >= 20, 'Feka stays readable during the crossing.');
    }
});

test('phone travel windows remain on authored segments through turns and reversals', () => {
    const path = [{ x: .6, y: .8 }, { x: .8, y: .9 }, { x: 1.1, y: .9 }, { x: 1.3, y: .7 }];
    const original = structuredClone(path);
    for (const focus of path) {
        const window = atlasTravelWindow(path, focus);
        const reverse = atlasTravelWindow([...path].reverse(), focus).reverse();
        assert.equal(window.length, reverse.length);
        window.forEach((point, index) => { close(point.x, reverse[index].x); close(point.y, reverse[index].y); });
        for (const point of window) assert.ok(path.slice(1).some((b, index) => {
            const a = path[index], cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
            return Math.abs(cross) < EPS && point.x >= Math.min(a.x, b.x) - EPS && point.x <= Math.max(a.x, b.x) + EPS &&
                point.y >= Math.min(a.y, b.y) - EPS && point.y <= Math.max(a.y, b.y) + EPS;
        }), 'The camera only frames points on the existing path.');
        assert.ok(Math.max(...window.map(point => point.x)) - Math.min(...window.map(point => point.x)) <= .36 + EPS);
    }
    assert.deepEqual(path, original);
    assert.deepEqual(atlasTravelWindow([], path[0]), [path[0]]);
    assert.deepEqual(atlasTravelWindow([path[0], path[0]], path[0]), [path[0]]);
});

test('actual shipped berths, dock overlays and all eight passenger frames fit measured mobile and desktop HUDs', () => {
    const journey = JSON.parse(readFileSync(new URL('../public/assets/world/map/coast-port-journey.meta.json', import.meta.url), 'utf8'));
    const boat = JSON.parse(readFileSync(new URL('../public/assets/world/map/journey-boat.meta.json', import.meta.url), 'utf8'));
    const realLayers = layers.map((layer, index) => ({ ...layer, overlay: journey.islands[index ? 'porto' : 'costa'].overlay }));
    for (const [width, height] of sizes) for (const [index, name] of ['costa', 'porto'].entries()) {
        const dock = journey.islands[name], placement = COAST_PORT_PLACEMENTS[index + 1];
        const foot = localToAtlas(dock.berth.passenger, placement);
        const boarding = localPathToAtlas(dock.boardingRoute, placement);
        for (const heading of boat.frames) {
            const realFrame: BoatAtlasFrame = { ...boat.frame, passengerPixelScale: boat.passengerPixelScale, passengerFoot: heading.passengerFootPixels };
            const bounds = atlasBoatBounds(foot, realFrame);
            const options: AtlasCameraOptions = { mode: 'channel', activeWorld: index + 1, width, height, layers: realLayers,
                insets: { top: 65, right: 16, bottom: 110, left: 16 }, focus: foot, focusBounds: [bounds], travelPoints: boarding };
            assertInside({ x: bounds.left, y: bounds.top }, options, 12);
            assertInside({ x: bounds.right, y: bounds.bottom }, options, 12);
            assert.ok(atlasActorScale(getAtlasCamera(options), realFrame) * 26 > 23, `Passenger too small at ${width}×${height}, ${name}.`);
        }
        const bounds = atlasIslandBounds(realLayers[index]);
        const options: AtlasCameraOptions = { mode: 'island', activeWorld: index + 1, width, height, layers: realLayers,
            insets: { top: 65, right: 16, bottom: 110, left: 16 } };
        assertInside({ x: bounds.left, y: bounds.top }, options, 12);
        assertInside({ x: bounds.right, y: bounds.bottom }, options, 12);
    }
    assert.ok(atlasIslandBounds(realLayers[0]).bottom > ATLAS_ART_BOUNDS[1].bottom, 'The new Costa gangway extends the old silhouette.');
});

test('camera uses real insets and tolerates missing art, empty scenes and very small viewports', () => {
    const fallback = { world: 3, metadata: fallbackMapMetadata(3), placement: { origin: { x: 3, y: 0 }, scale: 1 } };
    assert.deepEqual(atlasIslandBounds(fallback), { left: 3, top: 0, right: 4, bottom: 1 });
    for (const dimensions of [[320, 568], [1, 1], [NaN, Infinity]]) {
        const camera = getAtlasCamera({ width: dimensions[0], height: dimensions[1], layers: [], activeWorld: 99, mode: 'channel',
            insets: { top: NaN, bottom: 1000 }, focus: { x: Infinity, y: NaN } });
        assert.ok([camera.width, camera.height, camera.center.x, camera.center.y, camera.zoom].every(Number.isFinite));
        assert.ok(camera.zoom > 0);
    }
    const base: AtlasCameraOptions = { width: 1181, height: 757, layers, activeWorld: 1, mode: 'island' };
    const tight = getAtlasCamera({ ...base, insets: { top: 90, bottom: 220 } });
    const open = getAtlasCamera({ ...base, insets: { top: 16, bottom: 20 } });
    assert.ok(open.zoom > tight.zoom, 'Removing a measured panel returns space to the artwork.');
    assert.equal(ATLAS_ART_BOUNDS[1].top, 96 / 1200);
    assert.equal(layers[1].metadata.artBounds?.left, .142708, 'Parser preserves the enriched Porto silhouette (274/1920, rounded to six decimals).');
});

test('partial or reversed horizontal silhouette bounds are rejected, legacy vertical bounds remain supported', () => {
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/porto-diorama.meta.json', import.meta.url), 'utf8'));
    for (const bad of [{ left: NaN }, { right: 1.1 }, { left: .9, right: .1 }])
        assert.equal(parseMapMetadata({ ...raw, artBounds: { top: .1, bottom: .9, ...bad } }, 2), null);
    assert.deepEqual(parseMapMetadata({ ...raw, artBounds: { top: .1, bottom: .9 } }, 2)?.artBounds, { top: .1, bottom: .9 });
});

test('a bridge approach expands only its own island fit while complete span bounds belong to panorama', () => {
    const original = structuredClone(layers);
    const approach = { left: .7, top: .7, right: 1.12, bottom: 1.08 };
    const port = { ...layers[1], approachBounds: [approach] };
    // Deliberately synthetic connection envelope extends below the land; it is
    // independent of the production artist's pending bridge crop.
    const span = { left: 1.95, top: .7, right: 2.6, bottom: 1.7 };
    const extended = [layers[0], port];
    const expected = localToAtlas({ x: approach.right, y: approach.bottom }, port.placement);
    const bounds = atlasIslandBounds(port);
    close(bounds.right, expected.x); close(bounds.bottom, expected.y);
    assert.deepEqual(atlasIslandBounds(layers[0]), atlasIslandBounds(extended[0]));
    for (const [width, height] of sizes) {
        const base: AtlasCameraOptions = { width, height, layers: extended, activeWorld: 2, mode: 'island',
            insets: { top: 65, bottom: 110, left: 16, right: 16 } };
        assert.deepEqual(getAtlasCamera({ ...base, connectionBounds: [span] }), getAtlasCamera(base),
            'Factory bridge art must not pull the Porto island view into panorama.');
        assertInside(expected, base, 12);
        const overview: AtlasCameraOptions = { ...base, mode: 'overview', connectionBounds: [span] };
        assertInside({ x: span.left, y: span.top }, overview, 12);
        assertInside({ x: span.right, y: span.bottom }, overview, 12);
        const crossing: AtlasCameraOptions = { ...base, mode: 'channel', travelPoints: [{ x: 2, y: .8 }, { x: 2.4, y: .9 }] };
        assert.deepEqual(getAtlasCamera({ ...crossing, connectionBounds: [span] }), getAtlasCamera(crossing),
            'The travel window follows the route, not the whole raised bridge silhouette.');
    }
    assert.deepEqual(layers, original);
});

test('invalid optional bridge bounds cannot corrupt island or panorama cameras', () => {
    const malformed = [{ left: NaN, top: 0, right: 2, bottom: 2 }, { left: 2, top: 0, right: 1, bottom: 2 }];
    assert.deepEqual(atlasIslandBounds({ ...layers[1], approachBounds: malformed }), atlasIslandBounds(layers[1]));
    const options: AtlasCameraOptions = { width: 400, height: 606, layers, activeWorld: 2, mode: 'overview' };
    assert.deepEqual(getAtlasCamera({ ...options, connectionBounds: malformed }), getAtlasCamera(options));
});
