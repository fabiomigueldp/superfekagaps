import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossModel } from '../src/adventure/experimental/JuiceMinibossModel';
const player = { x: 50, y: 192, width: 14, height: 32 };
function until(b: JuiceMinibossModel, state: string, limit = 400) {
    for (let i = 0; b.phase !== state && i < limit; i++) b.update(1000 / 60, player);
    assert.equal(b.phase, state);
}
test('experimental attacks have a locked target and full warning', () => {
    const b = new JuiceMinibossModel(); until(b, 'warning');
    const locked = b.targetX;
    for (let i = 0; i < 25; i++) b.update(16, { ...player, x: 180 });
    assert.equal(b.phase, 'warning'); assert.equal(b.targetX, locked);
    until(b, 'attack'); assert.ok(b.events.some(e => e.kind === 'launch'));
});
test('all patterns recover inside the arena and fan drops expire', () => {
    const b = new JuiceMinibossModel(); const patterns = new Set();
    for (let i = 0; i < 1400; i++) {
        b.update(1000 / 60, player); patterns.add(b.attack);
        assert.ok(b.x >= b.arena.left && b.x + b.width <= b.arena.right);
        assert.ok(b.y + b.height <= b.arena.floor + .001);
        assert.ok(b.drops.length <= 5);
    }
    assert.deepEqual([...patterns].sort(), ['dash', 'fan', 'pounce']);
});
test('only recovery accepts a stomp and repeated overlap cannot double hit', () => {
    const b = new JuiceMinibossModel(); until(b, 'recover');
    const p = { ...player, x: b.x + 6, y: b.y - 20 };
    const prev = { ...p, y: b.y - p.height - 2 };
    assert.equal(b.contact(p, prev, true), 'hit'); assert.equal(b.health, 5);
    assert.equal(b.contact(p, prev, true), 'none'); assert.equal(b.health, 5);
    assert.equal(b.drops.length, 0);
});
test('paused and invalid delta do not advance; delayed frame cannot skip anticipation', () => {
    const b = new JuiceMinibossModel(); until(b, 'warning'); const t = b.phaseTime;
    b.update(0, player); b.update(NaN, player); assert.equal(b.phaseTime, t);
    b.update(5000, player); assert.equal(b.phase, 'warning');
});
test('defeat clears danger permanently', () => {
    const b = new JuiceMinibossModel(); b.health = 1; until(b, 'recover');
    const p = { ...player, x: b.x + 5, y: b.y - 20 };
    assert.equal(b.contact(p, { ...p, y: b.y - p.height - 2 }, true), 'defeated');
    for (let i = 0; i < 100; i++) b.update(16, player);
    assert.deepEqual(b.hazards, []); assert.equal(b.phase, 'defeated');
});

for (const health of [6, 3]) for (const x of [0, 306]) {
    test(`fan locks the actual player center at corner ${x}, health ${health}, for the full warning`, () => {
        const b = new JuiceMinibossModel(), corner = { ...player, x };
        b.health = health; b.phase = 'rest'; b.cycle = health === 6 ? 1 : 2;
        while (b.phase === 'rest') b.update(1000 / 120, corner);
        assert.equal(b.attack, 'fan'); assert.equal(b.phase, 'warning');
        assert.equal(b.targetX, x + corner.width / 2);
        assert.equal(b.targetY, corner.y + corner.height / 2);
        const launch = b.fanLaunch, time = b.time;
        // Walk away during anticipation. Neither the target nor the warning may home.
        while (b.phase === 'warning') b.update(1000 / 120, { ...corner, x: 160, y: 120 });
        assert.deepEqual(b.fanLaunch, launch);
        assert.ok(b.time - time >= b.warningMs);
        assert.equal(b.warningMs, health === 6 ? 650 : 500);
        while (b.drops.length === 0) b.update(1000 / 120, { ...corner, x: 160 });
        assert.equal(b.drops.length, 5);
        b.drops.forEach((drop, i) => {
            assert.equal(drop.x + 4, launch.x); assert.equal(drop.y + 4, launch.y);
            assert.equal(drop.vx, launch.vectors[i].vx); assert.equal(drop.vy, launch.vectors[i].vy);
        });
    });
}

test('fan aiming does not relax the dash and pounce landing clamps', () => {
    for (const cycle of [0, 2]) for (const x of [0, 306]) {
        const b = new JuiceMinibossModel(); b.phase = 'rest'; b.cycle = cycle;
        while (b.phase === 'rest') b.update(1000 / 120, { ...player, x });
        assert.equal(b.targetX, x === 0 ? 46 : 274);
        assert.equal(b.attack, cycle === 0 ? 'dash' : 'pounce');
    }
});
