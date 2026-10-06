import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { STAGES } from '../src/adventure/campaign';
import { drawWorldObjects } from '../src/adventure/WorldMechanisms';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { drawCarrierTrack } from '../src/adventure/WorldTransportArt';
import type { SpriteAtlas } from '../src/graphics/pixels';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function recorder() {
    const calls: unknown[][] = [];
    const methods = new Set(['fillRect', 'save', 'restore', 'beginPath', 'rect', 'clip']);
    const context = new Proxy({}, {
        get(_target, key) {
            if (methods.has(String(key))) return (...args: unknown[]) => calls.push([key, ...args]);
            throw new Error(`Unexpected canvas method: ${String(key)}`);
        },
        set(_target, key, value) { calls.push(['set', key, value]); return true; },
    }) as CanvasRenderingContext2D;
    const atlas = { draw(_context: CanvasRenderingContext2D, ...args: unknown[]) {
        calls.push(['sprite', ...args]);
    } } as unknown as SpriteAtlas;
    return { context, atlas, calls };
}
function capture(objects: WorldObjects, cx: number, cy: number, world: number) {
    const paint = recorder(), bodies = objects.bodies;
    let reads = 0;
    objects.bodies = new Proxy(bodies, { get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver);
    } });
    try { drawWorldObjects(paint.context, objects, paint.atlas, cx, cy, 99999, world); }
    finally { objects.bodies = bodies; }
    return { reads, calls: paint.calls, hash: digest(JSON.stringify(paint.calls)) };
}

// Exact command fingerprints recorded before this optimization, at e951929.
// They cover style writes, every primitive, clipping and full sprite frames/palettes.
const baseline = [
    ['3-2', 8651, '9212a4e95cb2459c470dfc2cfa9a1c7f74f984f72f357c93856999a74fdf1b37'],
    ['5-3', 3848, 'aa76a79a2d8dd6f2a9d07293acd7935163834b6e1de239e2ed66aeef3a95ed23'],
    ['5-5', 6520, '303c2c0411e89cdda97ed78261c4a393d3dbe5eb2c996e17b549c8dc51ea9476'],
    ['4-2', 2148, '71b5dcd9612fd414fa209f1e2e607c3d38bd1e0e4e002589416b7bb6e2291f79'],
    ['3-4', 5416, 'bec078808b590a360777de79d4c23472e646dced97f0a2c8b39254e0ec3d6a55'],
] as const;

test('authored mechanism scenes retain exact paint commands with at most one badge-index scan', () => {
    for (const [id, commands, hash] of baseline) {
        const stage = STAGES.find(s => s.id === id)!;
        const objects = new WorldObjects(stage.mechanisms), level = new WorldLevel(stage.level);
        const hashes: string[] = [];
        let total = 0;
        for (const elapsed of [0, 1800]) {
            if (elapsed) for (let tick = 0; tick < 108; tick++) objects.update(1000 / 60, level, 160);
            for (const cx of [0, 256, 768, 1280, 5000]) {
                const before = structuredClone(objects);
                const actual = capture(objects, cx, 80, stage.world);
                hashes.push(actual.hash); total += actual.calls.length;
                assert.ok(actual.reads <= objects.bodies.length * 2, `${id}: at most two total body passes`);
                assert.equal(capture(objects, cx, 80, stage.world).hash, actual.hash, 'Paused repaint stays identical.');
                assert.deepEqual(structuredClone(objects), before, 'Rendering never changes simulation state.');
                if (id === '3-2' && cx === 0) {
                    // Previously: 12 body visits + 12 * 12 badge-index visits = 156.
                    assert.equal(actual.reads, 24);
                }
                if (cx === 5000) {
                    assert.equal(actual.reads, objects.bodies.length, 'All-offscreen frames never build a badge index.');
                    assert.equal(actual.calls.length, 0);
                }
            }
        }
        assert.equal(total, commands, id);
        assert.equal(digest(hashes.join(':')), hash, id);
    }
});

test('badge order, duplicate links and editor mutations take effect on the next draw', () => {
    const objects = new WorldObjects([
        { id: 'b-switch', kind: 'switch', link: 'b', x: 20, y: 100, width: 16, height: 16 },
        { id: 'a', kind: 'belt', x: 60, y: 100, width: 36, height: 8 },
        { id: 'a-switch', kind: 'switch', link: 'a', x: 110, y: 100, width: 16, height: 16 },
        { id: 'b', kind: 'platform', x: 150, y: 100, width: 36, height: 8 },
        { id: 'duplicate', kind: 'switch', link: 'b', x: 210, y: 100, width: 16, height: 16 },
    ]);
    const steps: [string, () => void, string][] = [
        ['initial', () => {}, '5c42c5e91a46195f39cc11303b588aa529222b810a581fa5216ad95063869f13'],
        ['relink', () => { objects.bodies[0].link = 'a'; }, '7bfa47948fa14424bc517fa7410e5918aeaff655b1ee54068d4a61d5a0c265c9'],
        ['empty', () => { objects.bodies[0].link = ''; }, 'b97b57c1f61b65104571f8bd079b263ed1e81811d88ef482a19010e8a01e1c81'],
        ['remove link', () => { objects.bodies[2].link = undefined; }, '5f1744fa68e1e9cfa8dacce83d9427d31d961f13183abde44435bab56a6452ab'],
        ['reorder', () => { objects.bodies.reverse(); }, '1861681e455c085e439586c9a31d8d2dc19182901a0e94890bdb798234b89f3d'],
        ['replace', () => { objects.bodies = structuredClone(objects.bodies); objects.bodies[0].link = 'a'; },
            '8d570ffc4ce1fd6fbd316bc41d4bcbeb09a8917bd4ce2f5cb220dc59a53ddc19'],
        ['activate', () => { for (const b of objects.bodies) b.active = true; },
            'c141d9e6ef68ef34a987ce0f23ad3b29cc8aba49499cb4b95dbe346439a5b946'],
        ['add link', () => { objects.bodies.push({ ...objects.bodies[0], id: 'new-switch', link: 'b', x: 260 }); },
            '4e716b6f85a17efc4030482502a4546dd4a5899615db8adc02c037430add2fc2'],
    ];
    for (const [name, update, hash] of steps) {
        update();
        const before = structuredClone(objects), actual = capture(objects, 0, 0, 3);
        assert.equal(actual.hash, hash, name);
        assert.equal(actual.reads, objects.bodies.length * 2, name);
        assert.deepEqual(structuredClone(objects), before, name);
    }
});

test('an offscreen carrier retains its visible track without scanning badge links', () => {
    const objects = new WorldObjects([
        { id: 'carrier', kind: 'platform', x: 40, y: 100, width: 36, height: 8, to: { x: 650, y: 100 } },
        { id: 'switch', kind: 'switch', link: 'carrier', x: 700, y: 100, width: 16, height: 16 },
    ]);
    objects.bodies[0].x = 650;
    const expected = recorder();
    drawCarrierTrack(expected.context, objects.bodies[0], 0, 0);
    assert.ok(expected.calls.length > 0);
    const actual = capture(objects, 0, 0, 4);
    assert.deepEqual(actual.calls, expected.calls);
    assert.equal(actual.reads, objects.bodies.length);
});

test('visible targets and launchers do not need badge indexing', () => {
    const objects = new WorldObjects([
        { id: 'target', kind: 'target', x: 40, y: 100, width: 20, height: 32 },
        { id: 'launcher', kind: 'launcher', x: 100, y: 100, width: 16, height: 16 },
        { id: 'switch', kind: 'switch', link: 'launcher', x: 700, y: 100, width: 16, height: 16 },
    ]);
    const actual = capture(objects, 0, 0, 3);
    assert.ok(actual.calls.length > 0);
    assert.equal(actual.reads, objects.bodies.length);
});
