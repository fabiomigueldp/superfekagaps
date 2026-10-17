import assert from 'node:assert/strict';
import test from 'node:test';
import { SkeletonBullModel, BULL_RULES as R } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { drawSkeletonBull } from '../src/adventure/experimental/guaira/SkeletonBullArt';
import { drawBullFootfalls } from '../src/adventure/experimental/guaira/SkeletonBullMotionArt';
import { bullChargeWarningRange } from '../src/adventure/experimental/guaira/GuairaLabArt';

const player = { x: 10, y: 200, width: 14, height: 24 };
function ready(facing: -1 | 1, runway = 240, health = 6) {
    const b = new SkeletonBullModel(); b.x = facing < 0 ? 16 + runway : 256 - runway;
    b.health = health; b.state = 'idle'; b.stateTick = 23;
    b.update(R.tickMs, { ...player, x: facing < 0 ? 0 : 306 }); return b;
}
function steps(b: SkeletonBullModel, count: number) { for (let i = 0; i < count; i++) b.update(R.tickMs, player); }
type Paint = Array<Array<number | string>>;
function paint(b: SkeletonBullModel, reduced = false, dust = false) {
    const calls: Paint = []; let depth = 0;
    const c = { fillStyle: '', save() { depth++; }, restore() { depth--; },
        translate(x: number, y: number) { calls.push(['translate', x, y]); }, scale(x: number, y: number) { calls.push(['scale', x, y]); },
        fillRect(x: number, y: number, w: number, h: number) {
            assert.ok([x, y, w, h].every(Number.isInteger)); assert.ok(w > 0 && h > 0);
            calls.push([this.fillStyle, x, y, w, h]);
        } };
    const before = JSON.stringify(b);
    (dust ? drawBullFootfalls : drawSkeletonBull)(c as unknown as CanvasRenderingContext2D, b, reduced);
    assert.equal(JSON.stringify(b), before); assert.equal(depth, 0); return calls;
}

for (const facing of [-1, 1] as const) for (const runway of [48, 120, 240])
test(`charge accelerates and stops inside its announced lane without changing the punish timing: ${facing}/${runway}`, () => {
    const b = ready(facing, runway), range = bullChargeWarningRange(b), origin = b.x;
    steps(b, R.tell); assert.equal(b.state, 'charge'); assert.equal(b.chargeVelocity, 0);
    const speeds: number[] = [];
    while (b.state === 'charge') {
        const x = b.x; b.update(R.tickMs, { ...player, x: facing < 0 ? 306 : 0 });
        speeds.push(Math.abs(b.x - x));
        assert.equal(b.facing, facing); assert.ok(b.x >= range.left && b.x + b.width <= range.right);
        for (const box of b.hazards) assert.ok(box.x >= range.left - 1e-8 && box.x + box.width <= range.right + 1e-8);
        assert.equal(b.vulnerable, String(b.state) === 'brake', 'deceleration itself never falsely opens the ribs');
    }
    const peak = Math.max(...speeds);
    assert.ok(peak > 5 && peak <= 6 + 1e-8);
    assert.ok(speeds.every(speed => speed > 0));
    assert.ok(speeds[0] < peak * .6 && speeds.at(-1)! < peak * .6, 'both ends have an actual low-speed step');
    assert.equal(speeds.length, Math.ceil(runway / R.speed));
    assert.equal(Math.abs(b.x - origin), runway); assert.equal(b.chargeDistance, runway); assert.equal(b.chargeVelocity, 0);
    assert.equal(b.openingTicksRemaining, R.brake + R.recover);
    for (let i = 0; i < R.brake + R.recover; i++) { assert.equal(b.vulnerable, true); steps(b, 1); }
    assert.equal(b.state, 'idle');
});

for (const facing of [-1, 1] as const) test(`return pivots through six grounded silhouettes while the future route stays locked: ${facing}`, () => {
    const b = ready(facing, 240, 2); steps(b, R.tell);
    while (b.state === 'charge') steps(b, 1);
    assert.equal(b.state, 'turn'); const x = b.x, shapes = new Set<string>(), reduced = paint(b, true);
    for (let age = 0; age < R.turn; age++) {
        assert.equal(b.x, x); assert.equal(b.chargeVelocity, 0); assert.equal(b.facing, -facing); assert.equal(b.vulnerable, false);
        const calls = paint(b); shapes.add(JSON.stringify(calls));
        assert.deepEqual(calls.find(c => c[0] === 'scale'), ['scale', age < 21 ? facing : -facing, 1]);
        const feet = calls.filter(c => c[0] === '#302836' && Number(c[2]) > 20 && c[3] === 6 && c[4] === 4);
        assert.equal(feet.length, 4); assert.ok(feet.every(c => Number(c[2]) <= 30));
        assert.deepEqual(paint(b, true), reduced); steps(b, 1);
    }
    assert.equal(shapes.size, 6); assert.equal(b.state, 'charge'); assert.equal(b.chargeDistance, 0);
    assert.equal(b.chargeLeg, 2); steps(b, 1); assert.equal(Math.sign(b.chargeVelocity), -facing);
});

test('gallop follows real distance instead of an independently advancing animation clock', () => {
    const b = ready(-1); steps(b, R.tell + 20); const before = paint(b);
    b.stateTick += 4; assert.deepEqual(paint(b), before, 'an equal position, travel and velocity keep the same articulation');
});

for (const facing of [-1, 1] as const) test(`hoof contacts remain on the floor behind the moving body and expire: ${facing}`, () => {
    const b = ready(facing); steps(b, R.tell + 1);
    const contact = b.footfalls[0], origin = b.x;
    assert.equal(contact.y, b.arena.floor); assert.ok(Object.isFrozen(contact));
    const before = paint(b, false, true); assert.ok(before.length > 0); assert.deepEqual(paint(b, true, true), []);
    steps(b, 5); assert.notEqual(b.x, origin); assert.equal(b.footfalls[0], contact);
    assert.equal(b.footfalls[0].x, contact.x, 'a planted contact cannot slide with the actor');
    const paused = paint(b, false, true); assert.deepEqual(paint(b, false, true), paused);
    assert.notDeepEqual(paused, before, 'only the simulation ages the dust');
    steps(b, 11); assert.ok(!b.footfalls.includes(contact));
    while (b.state === 'charge') {
        assert.ok(b.footfalls.length <= 6);
        for (const call of paint(b, false, true)) {
            assert.ok(Number(call[2]) >= b.arena.floor - 7 && Number(call[2]) + Number(call[4]) <= b.arena.floor);
        }
        steps(b, 1);
    }
    assert.ok(b.footfalls.some(c => c.skid), 'deceleration plants a separate forward skid');
    steps(b, 16); assert.deepEqual(b.footfalls, []); assert.deepEqual(paint(b, false, true), []);
});

test('batched fixed steps preserve the velocity profile, contacts and stopping position', () => {
    const a = ready(-1), b = ready(-1); steps(a, R.tell); steps(b, R.tell);
    for (let batch = 0; batch < 8; batch++) {
        a.update(100, player); steps(b, 6);
        assert.equal(a.x, b.x); assert.equal(a.chargeVelocity, b.chargeVelocity);
        assert.equal(a.chargeDistance, b.chargeDistance); assert.deepEqual(a.footfalls, b.footfalls);
        assert.equal(a.state, b.state); assert.equal(a.stateTick, b.stateTick);
    }
    assert.equal(a.state, 'brake'); const snapshot = JSON.stringify({ x: a.x, tick: a.tick, contacts: a.footfalls });
    for (const dt of [0, -1, NaN, Infinity]) {
        a.update(dt, player); assert.equal(JSON.stringify({ x: a.x, tick: a.tick, contacts: a.footfalls }), snapshot);
    }
});

test('a successful stomp and a fresh encounter cannot retain motion dust', () => {
    const b = ready(-1); steps(b, R.tell + 48); assert.ok(b.footfalls.length > 0);
    const p = { ...player, x: b.x + 12, y: b.y - 2 };
    assert.equal(b.contact(p, { ...p, y: b.y - 25 }, true), 'hit');
    assert.deepEqual(b.footfalls, []); assert.deepEqual(paint(b, false, true), []);
    assert.deepEqual(new SkeletonBullModel().footfalls, []);
});
