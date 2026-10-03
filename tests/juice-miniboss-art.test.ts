import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossModel, type JuicePhase, type JuiceAttack } from '../src/adventure/experimental/JuiceMinibossModel';
import { drawJuiceMiniboss } from '../src/adventure/experimental/JuiceMonsterPainter';

function record(b: JuiceMinibossModel, reducedMotion = false) {
    const calls: unknown[][] = [];
    const properties = new Map<PropertyKey, unknown>([['globalAlpha', 1]]);
    const context = new Proxy({}, {
        get: (_, key) => properties.has(key) ? properties.get(key) : (...args: unknown[]) => { calls.push([key, ...args]); },
        set: (_, key, value) => { properties.set(key, value); calls.push(['set', key, value]); return true; },
    }) as CanvasRenderingContext2D;
    drawJuiceMiniboss(context, b, 0, 64, reducedMotion);
    return calls;
}

for (const [phase, attack] of [
    ['rest', 'dash'], ['warning', 'fan'], ['attack', 'dash'],
    ['attack', 'pounce'], ['recover', 'pounce'], ['hurt', 'fan'], ['enrage', 'fan'], ['defeated', 'fan'],
] as [JuicePhase, JuiceAttack][]) {
    test(`slime painter is deterministic, balanced and non-mutating in ${phase}/${attack}`, () => {
        const b = new JuiceMinibossModel();
        Object.assign(b, { phase, attack, time: 1234, phaseTime: 200, targetX: 80, targetY: 212 });
        const state = JSON.stringify(b);
        const calls = record(b);
        assert.equal(JSON.stringify(b), state);
        assert.deepEqual(record(b), calls);
        assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
        assert.ok(calls.some(c => c[0] === 'bezierCurveTo'), 'continuous viscous silhouette');
        assert.ok(calls.every(c => c.slice(1).every(n => typeof n !== 'number' || Number.isFinite(n))));
    });
}

test('resting slime and droplets contain no green fruit palette; their surface moves with model time', () => {
    const b = new JuiceMinibossModel(); b.phase = 'rest';
    b.drops = [{ x: 100, y: 180, width: 8, height: 8, vx: .1, vy: -.04, life: 1000 }];
    const calls = record(b);
    const colors = calls.filter(c => c[0] === 'set' && (c[1] === 'fillStyle' || c[1] === 'strokeStyle')).map(c => c[2]);
    for (const color of ['#dded67', '#b5ce39', '#698329', '#f9ffc3']) assert.ok(!colors.includes(color));
    b.time = 300;
    assert.notDeepEqual(record(b), calls);
});

test('the slime painter anchors its silhouette to the model dimensions', () => {
    const b = new JuiceMinibossModel();
    Object.assign(b, { phase: 'rest', width: 44, height: 46, x: 120, y: 178, time: 0 });
    const calls = record(b);
    assert.ok(calls.some(c => c[0] === 'translate' && c[1] === 142 && c[2] === 159.5), 'art is anchored to the real feet');
    assert.ok(calls.some(c => c[0] === 'scale' && c[1] === 1 && c[2] === 1), 'art derives its scale from the collision body');
    b.width *= 1.5;
    assert.notDeepEqual(record(b), calls, 'a wider collision body also widens and recenters the drawing');
});

test('fan anticipation follows every locked launch direction in both stages', () => {
    for (const health of [6, 2]) {
        const b = new JuiceMinibossModel();
        Object.assign(b, { phase: 'warning', attack: 'fan', health, phaseTime: 240, targetX: 50, targetY: 198 });
        const calls = record(b), fan = b.fanLaunch;
        const segments: number[][] = [];
        let start: number[] | undefined;
        for (const call of calls) {
            if (call[0] === 'moveTo') start = [Number(call[1]), Number(call[2])];
            if (call[0] === 'lineTo' && start) segments.push([...start, Number(call[1]), Number(call[2])]);
            if (call[0] === 'beginPath') start = undefined;
        }
        for (const vector of fan.vectors) {
            assert.ok(segments.some(([ax, ay, bx, by]) => {
                const dx = bx - ax, dy = by - ay;
                const offsetX = ax - fan.x, offsetY = ay - (fan.y - 64);
                return Math.abs(dx * vector.vy - dy * vector.vx) < 1e-8
                    && Math.abs(offsetX * vector.vy - offsetY * vector.vx) < 1e-8
                    && dx * vector.vx + dy * vector.vy > 0;
            }), 'each launched droplet has a visible ray with the same origin and direction');
        }
    }
});

test('stage two has a distinct pressure state and recovery a distinct opening', () => {
    const b = new JuiceMinibossModel(); b.phase = 'rest'; b.time = 1500;
    const calm = record(b); b.health = 2;
    assert.notDeepEqual(record(b), calm, 'stage two changes the skin, eyes and liquid pressure');
    const enraged = record(b); b.phase = 'recover';
    assert.notDeepEqual(record(b), enraged, 'recovery exposes a readable stomp opening');
});

test('reduced motion freezes idle decoration in both stages while attack warnings still advance', () => {
    for (const health of [6, 2]) {
        const b = new JuiceMinibossModel();
        Object.assign(b, { phase: 'rest', health, time: 1200 });
        const still = record(b, true);
        b.time = 4510;
        assert.deepEqual(record(b, true), still, 'breathing, blinking, gas and pressure stay still');
        Object.assign(b, { phase: 'warning', attack: 'fan', phaseTime: 20, targetX: 60, targetY: 200 });
        const early = record(b, true);
        b.phaseTime = 450;
        assert.notDeepEqual(record(b, true), early, 'a functional telegraph still shows its approach to launch');
    }
});
