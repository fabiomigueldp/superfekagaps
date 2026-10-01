import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossModel, type JuicePhase, type JuiceAttack } from '../src/adventure/experimental/JuiceMinibossModel';
import { drawJuiceMiniboss } from '../src/adventure/experimental/JuiceMinibossArt';

function record(b: JuiceMinibossModel) {
    const calls: unknown[][] = [];
    const context = new Proxy({}, {
        get: (_, key) => (...args: unknown[]) => { calls.push([key, ...args]); },
        set: (_, key, value) => { calls.push(['set', key, value]); return true; },
    }) as CanvasRenderingContext2D;
    drawJuiceMiniboss(context, b, 0, 64);
    return calls;
}

for (const [phase, attack] of [
    ['rest', 'dash'], ['warning', 'fan'], ['attack', 'dash'],
    ['attack', 'pounce'], ['recover', 'pounce'], ['hurt', 'fan'], ['defeated', 'fan'],
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
