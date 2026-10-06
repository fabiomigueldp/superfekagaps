import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import { STAGES } from '../src/adventure/campaign';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { carrierRoute } from '../src/adventure/WorldCarrierMotion';
import { carrierFamily, carrierMountIsAnchored, carrierMounts, carrierStructureBounds, carrierWheelCenters, carrierRailClearance, carrierRenderTrolley, carrierRenderRoute, carrierSceneHeadroom } from '../src/adventure/WorldCarrierStructure';
import { drawCarrier, drawCarrierTrack, drawSupport } from '../src/adventure/WorldTransportArt';
import { drawWorldObjects } from '../src/adventure/WorldMechanisms';
import type { SpriteAtlas } from '../src/graphics/pixels';
import type { MechanismSpec } from '../src/adventure/types';

function recorder() {
    const calls: unknown[][] = [];
    const context = new Proxy({}, {
        get(_target, key) { if (key === 'canvas') return undefined; return (...args: unknown[]) => calls.push([key, ...args]); },
        set(_target, key, value) { calls.push(['set', key, value]); return true; },
    }) as CanvasRenderingContext2D;
    return { context, calls };
}
const make = (spec: Partial<MechanismSpec> = {}) => new WorldObjects([
    { id: 'carrier', kind: 'platform', x: 40, y: 140, width: 64, height: 8, to: { x: 240, y: 80 }, ...spec },
]).bodies[0];

test('every campaign carrier foundation occupies real solid terrain, including seven bank cantilevers', () => {
    let count = 0, wall = 0;
    for (const stage of STAGES) {
        const level = new WorldLevel(stage.level), objects = new WorldObjects(stage.mechanisms);
        for (const body of objects.bodies) {
            if (!body.to || !['platform', 'lift', 'support', 'swing'].includes(body.kind)) continue;
            count++;
            assert.equal(body.mounts?.length, 2, `${stage.id}:${body.id}: authored mount pair`);
            for (const mount of body.mounts!) {
                assert.equal(carrierMountIsAnchored(mount, level), true, `${stage.id}:${body.id}: ${JSON.stringify(mount)}`);
                if (mount.kind === 'wall') wall++;
            }
            assert.deepEqual(carrierMounts(body, level), body.mounts);
        }
    }
    assert.equal(count, 36); assert.equal(wall, 2);
});

test('rigid rail, endpoint stops and foundations never move or kink with the trolley', () => {
    const stage = STAGES.find(stage => stage.id === '2-1')!, level = new WorldLevel(stage.level);
    const body = new WorldObjects(stage.mechanisms).get('p2')!, route = carrierRoute(body)!;
    let first: unknown[][] | undefined;
    for (const progress of [0, .17, .5, 1, .5, 0]) {
        body.x = route.home.x + (route.to.x - route.home.x) * progress;
        body.y = route.home.y + (route.to.y - route.home.y) * progress;
        const before = structuredClone(body), r = recorder();
        drawCarrierTrack(r.context, body, 1216, 96, level);
        assert.ok(r.calls.length > 0);
        if (!first) first = r.calls; else assert.deepEqual(r.calls, first);
        assert.deepEqual(body, before, 'Rendering is read-only.');
    }
});

test('wheel contacts follow horizontal, ascending, descending and reverse-direction rails', () => {
    for (const [dx, dy] of [[200, 0], [200, -60], [200, 60], [-200, 60], [-200, -60]]) {
        const body = make({ to: { x: 40 + dx, y: 140 + dy } }), route = carrierRoute(body)!;
        for (const p of [0, .25, .75, 1]) {
            body.x = route.home.x + dx * p; body.y = route.home.y + dy * p;
            const trolley = carrierRenderTrolley(body), wheels = carrierWheelCenters(body);
            assert.equal(trolley.y, body.y - carrierRailClearance(body));
            for (const offset of [-body.width / 2, 0, body.width / 2]) {
                const railY = trolley.y + dy / dx * offset;
                assert.ok(railY <= body.y - 40, 'Minimum rail clearance covers standing helmets at both deck edges.');
            }
            wheels.forEach((wheel, index) => {
                const vx = wheel.x - trolley.x, vy = wheel.y - trolley.y;
                assert.ok(Math.abs(vx * route.tangent.x + vy * route.tangent.y - (index ? 6 : -6)) < 1e-8);
                assert.ok(Math.abs(Math.abs(vx * route.normal.x + vy * route.normal.y) - 4) < 1e-8);
            });
            if (dy) assert.notEqual(wheels[0].y, wheels[1].y, 'Inclined bogie does not keep both axles at the same height.');
        }
    }
});

test('hoist fixed gantry remains visible when its moving deck is offscreen', () => {
    const objects = new WorldObjects([{ id: 'lift', kind: 'lift', x: 100, y: 100, width: 64, height: 8,
        to: { x: 100, y: 500 }, mounts: [{ x: 104, y: 530, kind: 'ground' }, { x: 158, y: 530, kind: 'ground' }] }]);
    objects.bodies[0].y = 500;
    const expected = recorder(); drawCarrierTrack(expected.context, objects.bodies[0], 0, 0);
    const actual = recorder(); drawWorldObjects(actual.context, objects, {} as SpriteAtlas, 0, 0, 0, 2);
    assert.ok(expected.calls.length > 0); assert.deepEqual(actual.calls, expected.calls);
    const bounds = carrierStructureBounds(objects.bodies[0], carrierMounts(objects.bodies[0]))!;
    assert.ok(bounds.top < 100 && bounds.bottom >= 530);
});

test('wall-mounted lowering support keeps its foundation fixed through lowering and raising', () => {
    const stage = STAGES.find(stage => stage.id === '6-1')!, level = new WorldLevel(stage.level);
    const body = new WorldObjects(stage.mechanisms).get('sup1')!, route = carrierRoute(body)!;
    assert.equal(carrierFamily(body), 'lowering');
    let first: unknown[][] | undefined;
    for (const p of [0, .5, 1, .5, 0]) {
        body.y = route.home.y + (route.to.y - route.home.y) * p; body.active = p > 0;
        const fixed = recorder(); drawCarrierTrack(fixed.context, body, 1312, 72, level);
        if (!first) first = fixed.calls; else assert.deepEqual(fixed.calls, first);
        const before = structuredClone(body), moving = recorder(); drawSupport(moving.context, body, 1312, 72, 1500);
        assert.ok(moving.calls.some(call => call[0] === 'fillRect' && call[1] === 112 && call[2] === Math.round(body.y - 72) && call[3] === body.width));
        assert.deepEqual(body, before);
    }
});

test('legacy mount discovery uses actual solid ground, never the bottom of a void map', () => {
    const stage = structuredClone(STAGES[0]); stage.level.width = 32;
    stage.level.tiles = Array.from({ length: 23 }, () => Array(32).fill(0));
    const empty = new WorldLevel(stage.level), body = make({ to: { x: 240, y: 140 } });
    assert.deepEqual(carrierMounts(body, empty), [null, null]);
    const ground = new WorldLevel(stage.level); ground.data.tiles[14].fill(1);
    const mounts = carrierMounts(body, ground);
    assert.ok(mounts.every(mount => mount?.y === 224 && carrierMountIsAnchored(mount, ground)));
    body.mounts = [{ x: 40, y: 300, kind: 'ground' }, { x: 250, y: 300, kind: 'ground' }];
    assert.deepEqual(carrierMounts(body, empty), [null, null], 'Invalid explicit mounts are not presented as valid foundations.');
});

test('deck footprint and static dais remain unchanged, and legacy diagonal kinds choose compatible rail equipment', () => {
    for (const kind of ['platform', 'lift', 'support', 'swing'] as const) {
        const body = make({ kind }); assert.equal(carrierFamily(body), 'rail');
        const r = recorder(); drawCarrier(r.context, body, 0, 0, 0, 2);
        assert.ok(r.calls.some(call => call[0] === 'fillRect' && call[1] === body.x && call[2] === body.y && call[3] === body.width && call[4] === 2));
    }
    for (const to of [undefined, { x: 40, y: 140 }]) {
        const body = make({ to }); assert.equal(carrierFamily(body), 'static');
        const r = recorder(); drawCarrierTrack(r.context, body, 0, 0); assert.equal(r.calls.length, 0);
    }
});

test('small bearing spokes visibly rotate in final pixels and reverse for leftward rails', async () => {
    const { drawCarrierBearing, carrierWheelTravel } = await import('../src/adventure/WorldTransportArt');
    function pixels(distance: number) {
        const pixels = new Map<string, string>();
        const context = { fillStyle: '', fillRect(x: number, y: number, width: number, height: number) {
            for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) pixels.set(`${xx},${yy}`, this.fillStyle);
        } };
        drawCarrierBearing(context as CanvasRenderingContext2D, 10, 10, distance);
        return JSON.stringify([...pixels].sort());
    }
    assert.notEqual(pixels(0), pixels(Math.PI * 2), 'Quarter-turn spoke survives the rim and hub.');
    const stationary = make(), first = recorder(), later = recorder();
    stationary.px = stationary.x; stationary.py = stationary.y;
    drawCarrier(first.context, stationary, 0, 0, 0, 2);
    drawCarrier(later.context, stationary, 0, 0, 9000, 2);
    assert.deepEqual(first.calls, later.calls, 'Advancing presentation time cannot animate a stationary bearing.');
    const right = make(), left = make({ to: { x: -160, y: 80 } });
    right.x += 40; right.y -= 12; left.x -= 40; left.y -= 12;
    assert.ok(carrierWheelTravel(right) > 0 && carrierWheelTravel(left) < 0);
    assert.equal(Math.abs(carrierWheelTravel(right)), Math.abs(carrierWheelTravel(left)));
});

test('malformed optional mount data cannot crash direct custom scene rendering', () => {
    const body = make();
    for (const invalid of [null, {}, [null, null], [{ x: 0, y: 0 }, null]]) {
        body.mounts = invalid as never;
        assert.doesNotThrow(() => carrierMounts(body));
        assert.ok(carrierMounts(body).every(mount => mount === null));
        const r = recorder(); assert.doesNotThrow(() => drawCarrierTrack(r.context, body, 0, 0));
    }
});

test('a trolley remains visible when its deck has just moved below the camera', () => {
    const objects = new WorldObjects([{ id: 'p', kind: 'platform', x: 60, y: 220, width: 64, height: 8, to: { x: 250, y: 200 } }]);
    const fixed = recorder(); drawCarrierTrack(fixed.context, objects.bodies[0], 0, 0);
    const all = recorder(); drawWorldObjects(all.context, objects, {} as SpriteAtlas, 0, 0, 0, 2);
    assert.ok(all.calls.length > fixed.calls.length, 'Moving bogie and hanger are not culled with the offscreen deck.');
});

test('authored rigid rails remain above the rider envelope and clear of solid roofs', async () => {
    const { isSolidTile } = await import('../src/world/tileRules');
    for (const stage of STAGES) for (const b of new WorldObjects(stage.mechanisms).bodies) {
        if (carrierFamily(b) !== 'rail') continue;
        const route = carrierRenderRoute(b)!;
        for (let p = 0; p <= 1; p += .01) {
            const x = route.rail.from.x + (route.rail.to.x - route.rail.from.x) * p;
            const y = route.rail.from.y + (route.rail.to.y - route.rail.from.y) * p;
            for (const yy of [y, y + 3]) assert.equal(isSolidTile(stage.level.tiles[Math.floor(yy / 16)]?.[Math.floor(x / 16)]), false, `${stage.id}:${b.id}: rail must not tunnel through solid terrain`);
        }
    }
});

test('mount validation shares one terrain snapshot and offscreen equipment reads none', () => {
    const stage = STAGES.find(stage => stage.id === '2-1')!, level = new WorldLevel(stage.level);
    const body = new WorldObjects(stage.mechanisms).get('p2')!, original = level.getRenderTiles.bind(level);
    let reads = 0; level.getRenderTiles = () => { reads++; return original(); };
    carrierMounts(body, level); assert.equal(reads, 1);
    reads = 0; drawCarrierTrack(recorder().context, body, 9000, 0, level); assert.equal(reads, 0);
    body.mounts = undefined; reads = 0; carrierMounts(body, level); assert.equal(reads, 1);
});

test('custom Guaíra object painters retain ownership of their existing equipment structures', async () => {
    const { WorldArt } = await import('../src/adventure/WorldArt');
    const { guairaAscentStage } = await import('../src/adventure/experimental/guaira/GuairaAscent');
    const stage = guairaAscentStage(), level = new WorldLevel(stage.level), objects = new WorldObjects(stage.mechanisms), art = new WorldArt();
    assert.equal(objects.bodies.filter(body => body.to).length, 3);
    art.genericStructures = false; // Explicitly set by the real custom chapter adapters.
    art.objects = () => {};
    const untouched = recorder(); art.structures(untouched.context, objects, 200, 160, level);
    assert.equal(untouched.calls.length, 0, 'No generic rail or foundation is injected into custom presentation.');
    for (const b of objects.bodies.filter(body => body.to)) {
        const mounts = carrierMounts(b, level);
        assert.ok(mounts.every(mount => mount === null || carrierMountIsAnchored(mount, level)), 'Generic fallback, if requested, never invents a foundation.');
    }
});

test('shared station hoists leave fixed headroom for the higher transfer carriage', () => {
    const stage = STAGES.find(stage => stage.id === '4-5')!, objects = new WorldObjects(stage.mechanisms);
    const before = carrierSceneHeadroom(objects.bodies), transfer = objects.get('transfer')!, route = carrierRenderRoute(transfer)!;
    for (const id of ['left', 'right']) assert.ok(before.get(id)! <= route.rail.from.y - 14, 'Crosshead clears the transfer bogie as well as the rider.');
    for (const b of objects.bodies) if (b.to) { b.x = b.to.x; b.y = b.to.y; }
    assert.deepEqual(carrierSceneHeadroom(objects.bodies), before, 'Headroom cannot jump with current equipment poses.');
    const left = objects.get('left')!, c = recorder();
    drawCarrierTrack(c.context, left, 0, 0, new WorldLevel(stage.level), before.get(left.id));
    assert.ok(c.calls.some(call => call[0] === 'fillRect' && call[2] === before.get(left.id)! - 5));
});

test('the actual FactoryCampaign wrapper preserves rear structures and forwards the terrain/body-pass arguments', async t => {
    const h = sceneLifecycleBrowser(t), require = createRequire(import.meta.url), css = require.extensions['.css'];
    require.extensions['.css'] = () => {};
    let FactoryCampaign: typeof import('../src/adventure/factory/FactoryCampaign').FactoryCampaign;
    try { ({ FactoryCampaign } = require('../src/adventure/factory/FactoryCampaign')); }
    finally { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; }
    const game = new FactoryCampaign(h.canvas as unknown as HTMLCanvasElement); t.after(() => game.dispose());
    game.load('2-1'); game.state = 'playing'; Object.assign(game.camera, { x: 1150, y: 80 });
    const art = (game as unknown as { art: import('../src/adventure/WorldArt').WorldArt }).art;
    assert.equal(art.genericStructures, true);
    const painted = recorder(); art.structures(painted.context, game.objects, game.camera.x, game.camera.y, game.level);
    assert.ok(painted.calls.length > 0, 'The real delegating wrapper still paints rail geometry.');
    const order: string[] = [], structures = art.structures.bind(art), terrain = art.terrain.bind(art), objects = art.objects.bind(art);
    t.mock.method(art, 'structures', (...args: Parameters<typeof structures>) => { order.push('structures'); return structures(...args); });
    t.mock.method(art, 'terrain', (...args: Parameters<typeof terrain>) => { order.push('terrain'); return terrain(...args); });
    t.mock.method(art, 'objects', (...args: Parameters<typeof objects>) => {
        order.push('objects'); assert.equal(args[6], game.level); assert.equal(args[7], false);
        return objects(...args);
    });
    game.render();
    assert.deepEqual(order.slice(0, 3), ['structures', 'terrain', 'objects']);
});

test('all seven fully custom Guaíra equipment adapters explicitly opt out of generic structures', () => {
    for (const file of ['GuairaAscent', 'GuairaTraversal', 'GuairaMayorLab', 'junction/GuairaJunction',
        'respiros/GuairaRespiros', 'relief/GuairaRelief', 'gallery/GuairaGallery']) {
        const source = readFileSync(new URL(`../src/adventure/experimental/guaira/${file}.ts`, import.meta.url), 'utf8');
        assert.match(source, /this\.art\.genericStructures = false;\s*this\.art\.objects =/);
    }
});
