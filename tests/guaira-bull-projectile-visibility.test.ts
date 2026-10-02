import assert from 'node:assert/strict';
import test from 'node:test';
import { BULL_RULES as R, intersects, SkeletonBullModel } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { GuairaBullEncounter } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { drawGuairaBoss } from '../src/adventure/experimental/guaira/GuairaLabArt';
import { guairaBrowser } from './helpers/guairaLabHarness';

const player = { x: 0, y: 200, width: 14, height: 24 };
function volley(side: 'left' | 'right') {
    const b = new SkeletonBullModel(); b.x = side === 'left' ? 256 : 16;
    b.state = 'idle'; b.stateTick = 23; b.cycle = 2;
    for (let tick = 0; tick <= R.rattle; tick++) b.update(R.tickMs, { ...player, x: side === 'left' ? 0 : 306 });
    assert.equal(b.state, 'bones');
    return b;
}

function paint(b: SkeletonBullModel, reducedMotion = false) {
    const calls: Array<[string, number, number, number, number]> = [];
    const c = { fillStyle: '', save() {}, restore() {}, translate() {}, scale() {},
        fillRect(x: number, y: number, w: number, h: number) { calls.push([this.fillStyle, x, y, w, h]); } };
    const before = JSON.stringify(b);
    drawGuairaBoss(c as unknown as CanvasRenderingContext2D, b, 0, 64, reducedMotion);
    assert.equal(JSON.stringify(b), before, 'the production painter cannot change simulation or retained poses');
    return calls;
}

for (const side of ['left', 'right'] as const) for (const reducedMotion of [false, true])
    test(`${side} real edge hit paints its departed bone, freezes on pause and clears on resume/reset (reduced motion ${reducedMotion})`, t => {
        const h = guairaBrowser(t, { reducedMotion }), g = h.create(), b = (g.boss as GuairaBullEncounter).model;
        b.x = side === 'left' ? 256 : 16; b.state = 'idle'; b.stateTick = 23; b.cycle = 2;
        g.player.data.position.x = side === 'left' ? 0 : 306;
        const start = side === 'left' ? 126 : 123, hitFrame = side === 'left' ? 140 : 137;
        for (let frame = 0; frame <= hitFrame; frame++) {
            if (frame === start || frame === start + 1)
                h.window.dispatch(frame === start ? 'keydown' : 'keyup', { key: ' ', code: 'Space', target: h.canvas });
            g.update(R.tickMs);
            assert.equal(g.player.data.hasHelmet, frame < hitFrame);
            assert.equal(g.player.data.isDead, false);
        }
        assert.equal(b.state, 'bones'); assert.equal(b.bones.length, 1);
        assert.equal(b.bones.some(bone => intersects(bone, g.player.getRect())), false);
        assert.equal(b.touches(g.player.getRect()), true, 'the original same-update sweep still damages the real Player');
        const endpoint = { x: side === 'left' ? 4 : 307, y: 215, width: 10, height: 7 };
        assert.deepEqual(b.visibleBones[b.visibleBones.length - 1], endpoint); assert.equal(b.visibleBones.length, 2);
        const calls = paint(b, reducedMotion);
        assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['#493444', endpoint.x - 1, 214, 12, 9])), 'the unchanged bone painter receives the last endpoint');
        assert.deepEqual(paint(b, reducedMotion), calls);
        g.toggleLabPause(); const paused = JSON.stringify({ boss: b, player: g.player.data });
        for (let tick = 0; tick < 6; tick++) { g.update(100); g.render(); }
        assert.equal(JSON.stringify({ boss: b, player: g.player.data }), paused);
        assert.deepEqual(paint(b, reducedMotion), calls);
        g.toggleLabPause(); g.update(R.tickMs);
        assert.deepEqual(b.visibleBones, b.bones, 'the next update drops the departed pose together with its sweep');
        assert.equal(paint(b).some(call => call[0] === '#493444' && call[1] === endpoint.x - 1), false);
        g.load('guaira-lab'); assert.deepEqual((g.boss as GuairaBullEncounter).model.visibleBones, []);
    });

for (const side of ['left', 'right'] as const) test(`${side} catch-up retains an early departed endpoint for every remaining step, then recovery cancels it`, () => {
    const b = volley(side), exitTick = side === 'left' ? 92 : 89;
    for (let tick = 1; tick < exitTick; tick++) b.update(R.tickMs, player);
    b.update(100, player);
    assert.equal(b.stateTick, exitTick + 5);
    const endpoint = { x: side === 'left' ? 4 : 307, y: 215, width: 10, height: 7 };
    assert.deepEqual(b.visibleBones[b.visibleBones.length - 1], endpoint);
    assert.ok(b.hazards.some(hazard => intersects(hazard, endpoint)), 'the endpoint survives while its earlier substep sweep remains active');
    b.update(100, player); // This catch-up crosses the trailing projectile's safe recovery boundary.
    assert.equal(b.state, 'recover'); assert.deepEqual(b.bones, []);
    assert.deepEqual(b.hazards, []); assert.deepEqual(b.visibleBones, []);
    assert.equal(paint(b).some(call => call[0] === '#493444'), false);
});

test('all departed endpoints are retained across substeps without reusing or advancing removed objects', () => {
    const b = volley('left');
    b.bones = [7, 10].map(x => ({ x, y: 215, width: 10, height: 7, vx: -3, life: 20 }));
    b.update(100, player);
    assert.deepEqual(b.bones, []);
    assert.deepEqual(b.visibleBones, [4, 4].map(x => ({ x, y: 215, width: 10, height: 7 })));
    assert.equal(b.hazards.length, 3, 'retain the existing one- and two-step sweeps only');
    assert.equal(paint(b).filter(call => call[0] === '#493444').length, 2);
});

for (const dt of [0, -1, NaN, R.tickMs / 2]) test(`a new update (${dt}) cannot leave an old departed pose without its sweep`, () => {
    const b = volley('left');
    for (let tick = 0; tick < 92; tick++) b.update(R.tickMs, player);
    assert.equal(b.visibleBones.length, 2);
    const tick = b.tick; b.update(dt, player);
    assert.equal(b.tick, tick); assert.deepEqual(b.visibleBones, b.bones);
    assert.equal(b.touches(player), false);
});

for (const health of [1, 6]) test(`a successful opening hit cancels retained poses and hazards (health ${health})`, () => {
    const b = volley('left');
    for (let tick = 0; tick < 92; tick++) b.update(R.tickMs, player);
    assert.equal(b.visibleBones.length, 2);
    // Seed the vulnerable phase to exercise contact cancellation with an outstanding render buffer.
    b.state = 'recover'; b.health = health;
    const top = { x: b.x + 10, y: b.y - 10, width: 14, height: 24 };
    assert.equal(b.contact(top, { ...top, y: b.y - 30 }, true), health === 1 ? 'defeated' : 'hit');
    assert.deepEqual(b.bones, []); assert.deepEqual(b.hazards, []); assert.deepEqual(b.visibleBones, []);
    assert.equal(paint(b).some(call => call[0] === '#493444'), false);
});
