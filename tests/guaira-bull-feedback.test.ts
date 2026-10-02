import assert from 'node:assert/strict';
import test from 'node:test';
import { BULL_RULES as R, SkeletonBullModel } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { BULL_PALETTE, drawSkeletonBull } from '../src/adventure/experimental/guaira/SkeletonBullArt';

const player = { x: 68, y: 200, width: 14, height: 24 };
type Paint = [string, number, number, number, number];
function paint(b: SkeletonBullModel, reducedMotion = false) {
    const calls: Paint[] = []; let depth = 0;
    const c = { fillStyle: '', save() { depth++; }, restore() { depth--; }, translate() {}, scale() {},
        fillRect(x: number, y: number, w: number, h: number) {
            assert.ok([x, y, w, h].every(Number.isInteger));
            assert.ok(w > 0 && h > 0);
            calls.push([this.fillStyle, x, y, w, h]);
        } };
    const before = JSON.stringify(b);
    drawSkeletonBull(c as unknown as CanvasRenderingContext2D, b, reducedMotion);
    assert.equal(JSON.stringify(b), before); assert.equal(depth, 0);
    return calls;
}
const openingMarks = (calls: Paint[]) => calls.filter(([color, , , w, h]) => color === '#fff1bf' && w === 4 && h === 2).length;

for (const cycle of [0, 2]) test(`${cycle === 0 ? 'charge' : 'bones'} preparation has three readable beats inside the original complete warning`, () => {
    const b = new SkeletonBullModel(); b.state = 'idle'; b.stateTick = 23; b.cycle = cycle;
    b.update(R.tickMs, player);
    const state = b.state, direction = b.facing, x = b.x, poses = new Set<string>(), reduced = paint(b, true);
    const duration = cycle === 0 ? 42 : 48;
    for (let tick = 0; tick < duration; tick++) {
        assert.equal(b.state, state); assert.equal(b.facing, direction); assert.equal(b.x, x);
        assert.equal(b.vulnerable, false); assert.deepEqual(b.hazards, []);
        if (tick % (duration / 3) === 0) poses.add(JSON.stringify(paint(b)));
        assert.deepEqual(paint(b, true), reduced, 'reduced motion keeps a static committed warning');
        b.update(R.tickMs, { ...player, x: 306 });
    }
    assert.equal(poses.size, 3);
    assert.equal(b.state, cycle === 0 ? 'charge' : 'bones');
    assert.equal(b.facing, direction, 'crossing sides during the tell still cannot retarget the attack');
});

for (const reducedMotion of [false, true]) test(`opening clock stays continuous across brake/recover and signals the last punishable tick (reduced ${reducedMotion})`, () => {
    const b = new SkeletonBullModel();
    // Reach a natural braking boundary, including its residual charge sweep.
    for (let tick = 0; tick < 300 && !b.vulnerable; tick++) b.update(R.tickMs, player);
    assert.equal(b.state, 'brake');
    for (let remaining = 72; remaining > 0; remaining--) {
        assert.equal(b.openingTicksRemaining, remaining); assert.equal(b.vulnerable, true);
        const marks = openingMarks(paint(b, reducedMotion));
        assert.equal(marks, remaining > 34 ? 3 : remaining > 17 ? 2 : 1);
        assert.deepEqual(paint(b, reducedMotion), paint(b, reducedMotion), 'paused rendering holds the exact cue');
        b.update(R.tickMs, player);
    }
    assert.equal(b.state, 'idle'); assert.equal(b.openingTicksRemaining, 0);
    assert.equal(openingMarks(paint(b, reducedMotion)), 0);
});

test('reduced-motion recovery changes only the three timing marks, never the articulated pose', () => {
    const b = new SkeletonBullModel(); b.state = 'recover';
    const skeleton = (calls: Paint[]) => calls.filter(([, , y, w, h]) => !(y === 6 && w === 4 && h === 2));
    const start = paint(b, true);
    for (const tick of [18, 35, 51]) {
        b.stateTick = tick;
        assert.deepEqual(skeleton(paint(b, true)), skeleton(start));
    }
});

for (const reducedMotion of [false, true]) test(`real punish cancels opening marks and has a distinct bounded hit reaction (reduced ${reducedMotion})`, () => {
    const b = new SkeletonBullModel(); b.state = 'recover'; b.stateTick = 51;
    const attack = { x: b.x + 12, y: b.y - 10, width: 14, height: 24 };
    assert.equal(b.contact(attack, { ...attack, y: b.y - 30 }, true), 'hit');
    assert.equal(b.health, 5); assert.equal(b.openingTicksRemaining, 0);
    assert.deepEqual(b.hazards, []); assert.deepEqual(b.visibleBones, []);
    const hurt = paint(b, reducedMotion), poses = new Set<string>();
    for (let tick = 0; tick < 30; tick++) {
        assert.equal(b.state, 'hurt'); assert.equal(b.vulnerable, false);
        const calls = paint(b, reducedMotion); poses.add(JSON.stringify(calls));
        assert.ok(calls.some(([color, , , w, h]) => color === BULL_PALETTE.glow && w === 25 && h === 7), 'the core acknowledges the hit');
        assert.ok(calls.some(([color, , , w, h]) => color === '#fff1bf' && w === 3 && h === 5), 'local impact notch persists without flashing');
        assert.equal(b.contact(attack, { ...attack, y: b.y - 30 }, true), 'none', 'one hit per opening');
        b.update(R.tickMs, player);
    }
    assert.equal(poses.size, reducedMotion ? 1 : 3);
    assert.equal(b.state, 'idle'); assert.notDeepEqual(paint(b, reducedMotion), hurt);
    assert.equal(b.health, 5);
});

test('defeat and retry cannot retain a hit reaction or an opening countdown', () => {
    const b = new SkeletonBullModel(); b.state = 'recover'; b.health = 1;
    const attack = { x: b.x + 12, y: b.y - 10, width: 14, height: 24 };
    assert.equal(b.contact(attack, { ...attack, y: b.y - 30 }, true), 'defeated');
    for (const model of [b, new SkeletonBullModel()]) {
        assert.equal(model.openingTicksRemaining, 0); assert.equal(openingMarks(paint(model)), 0);
        assert.equal(paint(model).some(([color, , , w, h]) => color === '#fff1bf' && w === 3 && h === 5), false);
    }
});
