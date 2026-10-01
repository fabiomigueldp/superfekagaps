import test from 'node:test';
import assert from 'node:assert/strict';
import { stageById } from '../src/adventure/campaign';
import { WorldLevel, WorldObjects, type MovingBody } from '../src/adventure/WorldPhysics';
import { jetCycle, jetCycleTick } from '../src/adventure/WorldMachineState';
import { drawGeyser } from '../src/adventure/WorldGeyserArt';
import { BossEncounter } from '../src/adventure/BossEncounter';
import type { SpriteAtlas } from '../src/graphics/pixels';

const stage = stageById('5-2')!;
const level = () => new WorldLevel(stage.level);
function closeAt(time: number) {
    const objects = new WorldObjects(stage.mechanisms), b = objects.get('j1')!;
    objects.time = time;
    const before = jetCycle(b, time);
    assert.ok(objects.activate('s1'));
    return { objects, b, before };
}

type Fill = [number, number, number, number, string];
function paint(b: MovingBody, time: number, cx = 0, cy = 0, world = 5) {
    const fills: Fill[] = [];
    const c = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) {
        fills.push([x, y, w, h, String(this.fillStyle)]);
    } } as CanvasRenderingContext2D;
    // Static housing is unchanged; record only the moving renderer's operations.
    drawGeyser(c, b, { draw() {} } as unknown as SpriteAtlas, cx, cy, time, world);
    return fills;
}
function residual(b: MovingBody, time: number, cx = 0, cy = 0, world = 5) {
    const baseline = paint({ ...b, jetShutdown: undefined }, time, cx, cy, world);
    const remaining = new Map<string, number>();
    for (const fill of baseline) {
        const key = JSON.stringify(fill);
        remaining.set(key, (remaining.get(key) ?? 0) + 1);
    }
    return paint(b, time, cx, cy, world).filter(fill => {
        const key = JSON.stringify(fill), count = remaining.get(key) ?? 0;
        if (!count) return true;
        remaining.set(key, count - 1);
        return false;
    });
}

test('real 5-2 valve captures the flowing height and is immediately safe throughout the residual', () => {
    const { objects, b, before } = closeAt(2100);
    assert.equal(before.height, 44);
    assert.deepEqual(b.jetShutdown, { at: 2100, height: 44 });
    assert.equal(b.active, true);
    for (const elapsed of [0, 40, 120, 240, 320, 379, 380, 4200]) {
        objects.time = 2100 + elapsed;
        assert.equal(objects.jetDanger(b), null);
        assert.equal(objects.jetState(b), 'off');
    }
    assert.ok(residual(b, 2100).length > 0);
    assert.ok(residual(b, 2340).length > 0);
    assert.deepEqual(residual(b, 2480), []);
    assert.deepEqual(residual(b, 6300), []);
});

test('idle, anticipation, warning, drained and initially closed valves do not invent liquid', () => {
    for (const time of [0, 900, 1000, 1650, 1800, 2500, 2700, 3100]) {
        const { b, before } = closeAt(time);
        assert.equal(before.height, 0);
        assert.equal(b.jetShutdown, undefined);
        for (const elapsed of [0, 100, 240, 380]) assert.deepEqual(residual(b, time + elapsed), []);
    }
    const b = new WorldObjects(stage.mechanisms).get('j1')!;
    assert.equal('jetShutdown' in b, false, 'Old level objects need no new authored field.');
    b.active = true; b.changedAt = 2100;
    assert.deepEqual(residual(b, 2140), [], 'Generic changedAt is not a manual shutdown.');
});

test('partial columns and manually restarted custom cycles capture their actual pre-close height', () => {
    for (const period of [2100, 4200, 8400]) for (const phase of [-10000, 0, 2600]) {
        const objects = new WorldObjects(stage.mechanisms), b = objects.get('j1')!;
        b.period = period; b.phase = phase; b.jetOpenedAt = 10000;
        for (const tick of [1840, 2100, 2400]) {
            b.active = false; b.jetOpenedAt = 10000; objects.get('s1')!.timer = 0;
            objects.time = 10000 + (tick - 1000) * period / 4200;
            const height = jetCycle(b, objects.time).height;
            assert.ok(height > 0);
            objects.activate('s1');
            assert.deepEqual(b.jetShutdown, { at: objects.time, height });
            assert.equal(b.jetOpenedAt, undefined);
            assert.equal(objects.jetDanger(b), null);
        }
    }
});

test('reopening clears the snapshot and preserves debounce and the complete 800 ms warning', () => {
    const { objects, b } = closeAt(2100), l = level();
    assert.equal(objects.activate('s1'), false);
    assert.deepEqual(b.jetShutdown, { at: 2100, height: 44 });
    objects.update(400, l, b.x);
    assert.ok(objects.activate('s1'));
    assert.equal(b.jetShutdown, undefined);
    assert.equal(b.jetOpenedAt, 2500);
    assert.equal(jetCycleTick(b, 2500), 1000);
    for (let elapsed = 0; elapsed <= 800; elapsed += 10) assert.equal(jetCycle(b, 2500 + elapsed).danger, null);
    assert.ok(jetCycle(b, 3310).danger);
});

test('shutdown beads only fall, remain sparse, stay bounded and follow the simulation camera', () => {
    for (const world of [3, 5]) for (const time of [1802, 1840, 2100, 2400, 2498]) {
        const { b } = closeAt(time), original = structuredClone(b);
        if (!b.jetShutdown) continue;
        let lastTop = -Infinity;
        for (let elapsed = 0; elapsed <= 400; elapsed += 10) {
            const camera = .45, fills = residual(b, time + elapsed, camera, camera, world);
            const mouth = Math.round(b.y + b.height - camera) - 4;
            const mid = Math.round(b.x - camera) + Math.round(b.width) / 2;
            assert.deepEqual(paint(b, time + elapsed), paint(b, time + elapsed), 'Pause is deterministic.');
            assert.deepEqual(residual(b, time + elapsed, camera + 20, camera + 10, world),
                fills.map(([x, y, w, h, color]) => [x - 20, y - 10, w, h, color]));
            assert.ok(fills.reduce((area, [, , w, h]) => area + w * h, 0) <= 42, 'Never retain a solid plume.');
            for (const [x, y, w, h, color] of fills) {
                assert.ok([x, y, w, h].every(Number.isInteger));
                assert.ok(w > 0 && w <= 2 && h > 0 && h <= 3);
                assert.ok(x >= mid - 7 && x + w <= mid + 9);
                assert.ok(y >= mouth - b.jetShutdown.height && y + h <= mouth + 1);
                assert.ok(['#d1d9ee', '#d7b8e5', '#f4d8f6', '#cbb9db'].includes(color));
            }
            if (fills.length) {
                const top = Math.min(...fills.map(fill => fill[1]));
                assert.ok(top >= lastTop, 'Residual only descends, with no new pressure spurt.');
                lastTop = top;
            }
            assert.deepEqual(b, original, 'Drawing never mutates simulation state.');
        }
        assert.deepEqual(residual(b, time - 1), []);
    }
});

test('boss-authored pressure resets do not create a manual shutdown or change their idle lead-in', () => {
    for (const id of ['3-5', '5-5']) {
        const bossStage = stageById(id)!, objects = new WorldObjects(bossStage.mechanisms);
        const boss = new BossEncounter(bossStage.encounter!), b = objects.get('bossJet')!;
        const l = new WorldLevel(bossStage.level);
        boss.health--; b.active = true; b.observedActive = true; objects.time = 2000;
        boss.update(16, { x: 40, y: 200, width: 14, height: 24 }, objects, l);
        objects.update(16, l, 160);
        assert.equal(b.jetShutdown, undefined);
        assert.equal(b.jetOpenedAt, undefined);
        assert.equal(jetCycleTick(b, objects.time), 16);
        assert.equal(jetCycle(b, 2999).phase, 'idle');
        assert.equal(jetCycle(b, 3000).phase, 'charging');
        assert.ok(jetCycle(b, 3820).danger);
    }
});
