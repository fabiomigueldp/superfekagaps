import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaMayorModel, MAYOR_ARENA as A, MAYOR_RULES as R, type MayorAccess } from '../src/adventure/experimental/guaira/GuairaMayorModel';

const closed: MayorAccess = { valveActive: false, liftReady: false, registerOpened: false };
const ready: MayorAccess = { valveActive: true, liftReady: true, registerOpened: false };
const opened: MayorAccess = { ...ready, registerOpened: true };
function advance(b: GuairaMayorModel, count: number, access = closed) {
    for (let i = 0; i < count; i++) b.update(R.tickMs, access);
}
function topHit(b: GuairaMayorModel, width = 14) {
    const p = { x: width === 14 ? 274 : 208, y: 119, width, height: 24 };
    return b.contact(p, { ...p, y: 95 }, true);
}
function laterRecovery() {
    const b = new GuairaMayorModel();
    advance(b, R.intro + R.idle + R.warning + R.stamp);
    b.update(R.tickMs, opened); assert.equal(topHit(b), 'hit');
    advance(b, R.hurt + R.idle + R.warning + R.stamp);
    assert.equal(b.state, 'recover'); assert.equal(b.sealsRemaining, 2);
    return b;
}

test('first seal stays a tutorial and later pressure requires a fresh opening plus actual lift readiness', () => {
    const first = new GuairaMayorModel();
    advance(first, R.intro + R.idle + R.warning + R.stamp);
    advance(first, 140, opened);
    assert.equal(first.vulnerable, true); assert.equal(first.counterpressure, null); assert.equal(first.danger, null);
    const b = laterRecovery();
    advance(b, 10, ready);
    assert.equal(b.registerOpenedThisCycle, false); assert.equal(b.counterpressure, null);
    b.update(R.tickMs, { ...opened, liftReady: false });
    advance(b, 35, { ...ready, liftReady: false });
    assert.equal(b.registerOpenedThisCycle, true); assert.equal(b.vulnerable, false); assert.equal(b.counterpressure, null);
    b.update(R.tickMs, ready);
    assert.equal(b.vulnerable, true);
    assert.deepEqual(b.counterpressure, { phase: 'warning', rect: A.seam, ticksRemaining: 60, progress: 0 });
});

test('one immutable seam receives a full 60-tick warning and exactly 24 ticks of actual contact danger', () => {
    const b = laterRecovery(); b.update(R.tickMs, opened);
    const signal = b.counterpressure!, rect = signal.rect;
    assert.ok(Object.isFrozen(signal)); assert.ok(Object.isFrozen(rect));
    assert.deepEqual(rect, { x: 208, y: 140, width: 32, height: 20 });
    for (let tick = 0; tick < R.counterpressureWarning; tick++) {
        assert.equal(b.counterpressure!.phase, 'warning'); assert.equal(b.danger, null);
        assert.equal(b.counterpressure!.rect, rect);
        assert.equal(b.counterpressure!.ticksRemaining, 60 - tick);
        assert.equal(b.counterpressure!.progress, tick / 60);
        assert.equal(b.contact(rect, rect, false), 'none'); b.update(R.tickMs, ready);
    }
    for (let tick = 0; tick < R.counterpressureActive; tick++) {
        assert.equal(b.counterpressure!.phase, 'active'); assert.equal(b.danger, rect);
        assert.equal(b.counterpressure!.ticksRemaining, 24 - tick);
        assert.equal(b.counterpressure!.progress, tick / 24);
        assert.equal(b.contact(rect, rect, false), 'hurt');
        assert.equal(b.contact({ ...rect, x: rect.x - rect.width }, rect, false), 'none', 'edge contact is safe');
        assert.equal(b.contact({ ...rect, y: rect.y - rect.height }, rect, false), 'none', 'above the exact water is safe');
        b.update(R.tickMs, ready);
    }
    assert.equal(b.counterpressure, null); assert.equal(b.danger, null);
    advance(b, 30, opened); assert.equal(b.counterpressure, null, 'fresh events cannot create a second pulse');
    assert.equal(b.stateTick, 115, 'pressure never extends the 270-tick recovery');
    assert.deepEqual(signal, { phase: 'warning', rect, ticksRemaining: 60, progress: 0 }, 'previous public snapshots remain unchanged');
});

for (const age of [0, 30, 60, 70]) test(`manual reclosure at pressure tick ${age} cancels and consumes only this cycle`, () => {
    const b = laterRecovery(); b.update(R.tickMs, opened); advance(b, age, ready);
    assert.ok(b.counterpressure); b.update(R.tickMs, closed);
    assert.equal(b.counterpressure, null); assert.equal(b.danger, null); assert.equal(b.vulnerable, false);
    b.update(R.tickMs, opened); advance(b, 90, ready);
    assert.equal(b.counterpressure, null); assert.equal(b.vulnerable, true, 'reopening retains the ordinary valid top hit');
    advance(b, R.recover - b.stateTick + R.idle + R.warning + R.stamp, ready);
    assert.equal(b.state, 'recover'); assert.equal(b.registerOpenedThisCycle, false);
    b.update(R.tickMs, opened);
    assert.deepEqual(b.counterpressure, { phase: 'warning', rect: A.seam, ticksRemaining: 60, progress: 0 }, 'next stamped cycle gets one new pulse');
});

test('reclosing before lift arrival also consumes the pending pulse and remains a valid reopening', () => {
    const b = laterRecovery(); b.update(R.tickMs, { ...opened, liftReady: false });
    b.update(R.tickMs, closed); b.update(R.tickMs, opened);
    assert.equal(b.vulnerable, true); assert.equal(b.counterpressure, null); assert.equal(topHit(b), 'hit');
});

for (const remaining of [90, 65, 5]) test(`late opening with ${remaining} recovery ticks left expires safely and is replayable`, () => {
    const b = laterRecovery(); advance(b, R.recover - remaining);
    b.update(R.tickMs, opened); assert.equal(b.counterpressure!.phase, 'warning');
    advance(b, remaining - 1, ready);
    assert.equal(b.state, 'idle'); assert.equal(b.counterpressure, null); assert.equal(b.danger, null);
    assert.equal(b.sealsRemaining, 2); assert.equal(b.vulnerable, false);
    advance(b, R.idle + R.warning + R.stamp, ready);
    assert.equal(b.registerOpenedThisCycle, false); assert.equal(b.counterpressure, null);
    b.update(R.tickMs, opened); assert.equal(b.counterpressure!.ticksRemaining, 60);
});

test('top contact wins over simultaneous water contact; successful hits and release clear pressure', () => {
    const b = laterRecovery(); b.update(R.tickMs, opened); advance(b, 60, ready);
    assert.equal(b.counterpressure!.phase, 'active');
    assert.equal(b.contact({ x: 274, y: 130, width: 14, height: 24 }, b, false), 'none', 'body side contact never hurts');
    assert.equal(topHit(b, 80), 'hit', 'falling top hit takes precedence even when the rectangle also intersects water');
    assert.equal(b.counterpressure, null); assert.equal(b.danger, null);
    advance(b, R.hurt + R.idle + R.warning + R.stamp);
    b.update(R.tickMs, opened); advance(b, 60, ready);
    assert.equal(topHit(b), 'defeated'); assert.equal(b.publicWaterOpen, true);
    assert.equal(b.counterpressure, null); advance(b, 360, opened); assert.equal(b.counterpressure, null);
});

test('invalid time cannot mutate pressure and a resumed frame cannot consume its full warning', () => {
    const b = laterRecovery(); b.update(R.tickMs, opened); const snapshot = structuredClone(b);
    for (const dt of [0, -1, NaN, Infinity]) b.update(dt, closed);
    assert.deepEqual(structuredClone(b), snapshot);
    b.update(10000, ready);
    assert.equal(b.counterpressure!.phase, 'warning'); assert.equal(b.counterpressure!.ticksRemaining, 54);
});
