import assert from 'node:assert/strict';
import test from 'node:test';
import { BULL_RULES as R, SkeletonBullModel } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { BULL_PALETTE as P, drawSkeletonBull } from '../src/adventure/experimental/guaira/SkeletonBullArt';

const player = { x: 68, y: 200, width: 14, height: 24 };
type Paint = [string, number, number, number, number];
function paint(b: SkeletonBullModel, reduced = false) {
    const calls: Paint[] = []; let depth = 0;
    const c = { fillStyle: '', save() { depth++; }, restore() { depth--; }, translate() {}, scale() {},
        fillRect(x: number, y: number, w: number, h: number) {
            assert.ok([x, y, w, h].every(Number.isInteger)); assert.ok(w > 0 && h > 0);
            calls.push([this.fillStyle, x, y, w, h]);
        } };
    const before = JSON.stringify(b);
    drawSkeletonBull(c as unknown as CanvasRenderingContext2D, b, reduced);
    assert.equal(JSON.stringify(b), before, 'painting must not advance or modify the encounter');
    assert.equal(depth, 0);
    return calls;
}
function naturalBrake(facing: -1 | 1) {
    const b = new SkeletonBullModel();
    for (let tick = 0; tick < 600; tick++) {
        b.update(R.tickMs, player);
        if (b.state === 'brake' && b.facing === facing) return b;
    }
    throw new Error('The ordinary encounter did not reach the requested braking direction');
}
const dust = (calls: Paint[]) => calls.filter(([color]) => color === '#DB9C68');
const marks = (calls: Paint[]) => calls.filter(([color, x, , w, h]) => color === '#fff1bf' && [-11, -3, 5].includes(x) && w === 4 && h === 2);
const hoofs = (calls: Paint[]) => calls.filter(([color, , y, w, h]) => color === P.horn && y > 20 && w === 6 && h === 4);
const torsoY = (calls: Paint[]) => calls.find(([color, , , w, h]) => color === P.shade && w === 38 && h === 17)![2];

for (const facing of [-1, 1] as const) test(`natural brake grounds three poses and meets recovery without a snap, facing ${facing}`, () => {
    const b = naturalBrake(facing), x = b.x, poses = new Set<string>(), beats: Paint[][] = [];
    let last: Paint[] = [];
    for (let tick = 0; tick < R.brake; tick++) {
        assert.equal(b.state, 'brake'); assert.equal(b.stateTick, tick); assert.equal(b.x, x);
        assert.equal(b.facing, facing); assert.equal(b.vulnerable, true);
        assert.equal(b.openingTicksRemaining, R.brake + R.recover - tick);
        const calls = paint(b); poses.add(JSON.stringify(calls));
        assert.deepEqual(calls, paint(b), 'pause and repeated render keep the exact same pose');
        assert.equal(marks(calls).length, 3, 'the whole brake is already punishable');
        assert.ok(calls.some(([color, , , w, h]) => color === P.core && w === 25 && h === 9), 'the exposed core never closes while settling');
        assert.equal(hoofs(calls).length, 4);
        assert.ok(hoofs(calls).every(([, , y]) => y === 30), 'all four hooves remain on the combat floor');
        if ([0, 7, 14].includes(tick)) beats.push(calls);
        last = calls; b.update(R.tickMs, player);
    }
    assert.equal(poses.size, 3); assert.deepEqual(beats.map(torsoY), [7, 10, 9], 'weight compresses, then settles');
    assert.deepEqual(beats.map(calls => dust(calls).length), [3, 2, 0]);
    assert.equal(b.state, 'recover'); assert.equal(b.stateTick, 0); assert.equal(b.openingTicksRemaining, R.recover);
    assert.deepEqual(paint(b), last, 'last brake and first recovery have the same entire silhouette and cues');
});

for (const facing of [-1, 1] as const) test(`reduced-motion brake has one static exposed-core pose, facing ${facing}`, () => {
    const b = naturalBrake(facing), first = paint(b, true);
    assert.equal(dust(first).length, 0); assert.equal(marks(first).length, 3);
    assert.equal(torsoY(first), 9);
    for (let tick = 0; tick <= R.brake; tick++) {
        assert.deepEqual(paint(b, true), first); b.update(R.tickMs, player);
    }
});

for (const tick of [0, 7, 14, 19]) test(`a real top contact interrupts braking pose ${tick} without retained dust or a false opening`, () => {
    const b = naturalBrake(-1);
    for (let i = 0; i < tick; i++) b.update(R.tickMs, player);
    const attack = { x: b.x + 12, y: b.y - 10, width: 14, height: 24 };
    assert.equal(b.contact(attack, { ...attack, y: b.y - 30 }, true), 'hit');
    assert.equal(b.state, 'hurt'); assert.equal(b.health, 5); assert.equal(b.openingTicksRemaining, 0);
    for (const reduced of [false, true]) {
        const calls = paint(b, reduced);
        assert.equal(dust(calls).length, 0); assert.equal(marks(calls).length, 0);
    }
});
