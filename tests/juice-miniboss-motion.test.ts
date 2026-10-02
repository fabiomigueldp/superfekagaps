import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossModel, type JuiceAttack } from '../src/adventure/experimental/JuiceMinibossModel';
import { juicePose } from '../src/adventure/experimental/JuiceAnimation';
import { JuiceCombatEffects } from '../src/adventure/experimental/JuiceCombatEffects';

for (const attack of ['dash', 'fan', 'pounce'] as JuiceAttack[]) for (const health of [6, 2]) {
    test(`${attack}, health ${health}: the charged pose and release/recovery have no discontinuity`, () => {
        const b = new JuiceMinibossModel(); b.attack = attack; b.health = health; b.time = 1200;
        b.phase = 'warning'; b.phaseTime = b.warningMs;
        const charged = juicePose(b);
        b.phase = 'attack'; b.phaseTime = 0;
        const launch = juicePose(b);
        for (const key of ['sx', 'sy', 'lean', 'mouth'] as const)
            assert.ok(Math.abs(charged[key] - launch[key]) < 1e-10, `${key} snaps at release`);
        b.phaseTime = b.attackMs;
        const end = juicePose(b);
        b.phase = 'recover'; b.phaseTime = 0;
        const landing = juicePose(b);
        for (const key of ['sx', 'sy', 'lean', 'mouth'] as const)
            assert.ok(Math.abs(end[key] - landing[key]) < 1e-10, `${key} snaps on recovery`);
    });
}

test('fan releases its one-shot cue together with visible droplets, after holding its inflated pose', () => {
    const b = new JuiceMinibossModel(); b.phase = 'attack'; b.attack = 'fan';
    const player = { x: 60, y: 198, width: 14, height: 26 };
    const inflated = juicePose(b, true);
    let cues = 0;
    for (let i = 0; i < 35; i++) {
        const hadDrops = b.drops.length > 0;
        b.update(1000 / 60, player);
        const spit = b.events.filter(e => e.kind === 'spit');
        cues += spit.length;
        if (!hadDrops && b.drops.length) assert.equal(spit.length, 1);
        if (b.phaseTime < b.fanReleaseMs) assert.deepEqual(juicePose(b, true), inflated);
    }
    assert.equal(cues, 1);
});

test('cosmetic particles are bounded, expire on simulation time and never mutate combat', () => {
    const fx = new JuiceCombatEffects(), b = new JuiceMinibossModel();
    for (let i = 0; i < 100; i++) fx.add('drip', 50 + i, 224, 1000);
    assert.ok(fx.size <= 24);
    fx.add('hit', 80, 180, 1000); fx.add('landing', 80, 224, 1000); fx.add('spit', 80, 206, 1000); fx.add('defeat', 80, 224, 1000);
    b.time = 1100;
    const state = JSON.stringify(b), effects = JSON.stringify(fx);
    const record = (reduced: boolean) => {
        const calls: unknown[][] = [];
        const c = new Proxy({}, { get: (_o, key) => (...args: unknown[]) => calls.push([key, ...args]),
            set: (_o, key, value) => { calls.push(['set', key, value]); return true; } }) as CanvasRenderingContext2D;
        fx.draw(c, b, 0, 64, reduced); return calls;
    };
    const a = record(false);
    assert.deepEqual(record(false), a, 'rendering cannot advance paused particles');
    assert.ok(a.every(call => call.every(value => typeof value !== 'number' || Number.isFinite(value))));
    assert.equal(a.filter(c => c[0] === 'save').length, a.filter(c => c[0] === 'restore').length);
    assert.deepEqual(record(true), [], 'motion reduction removes cosmetic particles');
    assert.equal(JSON.stringify(b), state); assert.equal(JSON.stringify(fx), effects);
    fx.advance(2000); assert.equal(fx.size, 0);
});
