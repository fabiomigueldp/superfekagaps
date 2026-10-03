import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossModel } from '../src/adventure/experimental/JuiceMinibossModel';
const player = { x: 50, y: 192, width: 14, height: 32 };
function until(b: JuiceMinibossModel, state: string, limit = 400) {
    for (let i = 0; b.phase !== state && i < limit; i++) b.update(1000 / 120, player);
    assert.equal(b.phase, state);
}
function stomp(b: JuiceMinibossModel) {
    const p = { ...player, x: b.x + 6, y: b.y - 20 };
    return b.contact(p, { ...p, y: b.y - p.height - 2 }, true);
}
test('experimental attacks have a locked target and full warning', () => {
    const b = new JuiceMinibossModel(); until(b, 'warning');
    const locked = b.targetX;
    for (let i = 0; i < 25; i++) b.update(16, { ...player, x: 180 });
    assert.equal(b.phase, 'warning'); assert.equal(b.targetX, locked);
    until(b, 'attack'); assert.ok(b.events.some(e => e.kind === 'launch'));
});

for (const health of [6, 2]) test(`phase ${health === 6 ? 1 : 2} patterns stay bounded and retain recovery`, () => {
    const b = new JuiceMinibossModel(); b.health = health;
    const patterns = new Set(), recovery = new Set();
    for (let i = 0; i < 1800; i++) {
        b.update(1000 / 60, player); patterns.add(b.attack);
        assert.ok(b.x >= b.arena.left && b.x + b.width <= b.arena.right);
        assert.ok(b.y + b.height <= b.arena.floor + .001);
        assert.ok(b.drops.length <= (health === 6 ? 7 : 9));
        assert.ok(b.geysers.length <= 2);
        if (b.phase === 'recover') {
            recovery.add(b.attack);
            assert.ok(b.geysers.every(g => g.phase === 'recede'));
        }
    }
    assert.deepEqual([...patterns].sort(), ['dash', 'fan', 'pounce']);
    assert.deepEqual([...recovery].sort(), ['dash', 'fan', 'pounce']);
});

test('only recovery accepts a stomp and repeated overlap cannot double hit', () => {
    const b = new JuiceMinibossModel(); until(b, 'recover');
    b.geysers.push({ x: 70, y: 160, width: 22, height: 64, phase: 'active', phaseTime: 0, progress: 0 });
    assert.equal(stomp(b), 'hit'); assert.equal(b.health, 5);
    assert.equal(stomp(b), 'none'); assert.equal(b.health, 5);
    assert.deepEqual(b.drops, []); assert.deepEqual(b.geysers, []);
});

test('fourth stomp introduces stage two exactly once, with a full safe transformation', () => {
    const b = new JuiceMinibossModel(); b.health = 4; b.phase = 'recover';
    stomp(b); assert.equal(b.health, 3); assert.equal(b.enraged, false);
    until(b, 'rest'); assert.equal(b.geysers.length, 0);
    b.phase = 'recover'; stomp(b); assert.equal(b.health, 2); assert.equal(b.enraged, true);
    until(b, 'enrage'); assert.ok(b.events.some(e => e.kind === 'enrage'));
    const started = b.time;
    for (let i = 0; i < 110; i++) {
        b.update(1000 / 120, player);
        assert.equal(b.phase, 'enrage'); assert.deepEqual(b.hazards, []);
        assert.equal(stomp(b), 'none'); assert.equal(b.health, 2);
    }
    until(b, 'rest'); assert.ok(b.time - started >= 1200 - .001);
    until(b, 'warning'); assert.equal(b.attack, 'fan'); assert.ok(b.geysers.length > 0);
    b.phase = 'recover'; stomp(b); until(b, 'rest'); assert.equal(b.health, 1);
});

test('geyser targets lock, telegraph for 900ms and only active columns collide', () => {
    const b = new JuiceMinibossModel(); b.health = 2; until(b, 'warning');
    const locked = b.geysers.map(g => ({ x: g.x, y: g.y, width: g.width, height: g.height }));
    assert.equal(locked.length, 2);
    assert.ok(Math.abs(locked[0].x - locked[1].x) >= 96, 'There is room to escape between jets.');
    const started = b.time;
    for (let i = 0; i < 100; i++) {
        b.update(1000 / 120, { ...player, x: 270 });
        assert.ok(b.geysers.every(g => g.phase === 'warning'));
        assert.deepEqual(b.hazards, [], 'Floor bubbling is harmless anticipation.');
        assert.deepEqual(b.geysers.map(g => ({ x: g.x, y: g.y, width: g.width, height: g.height })), locked);
    }
    until(b, 'attack'); assert.ok(b.time - started >= b.geyserWarningMs - .001);
    assert.equal(b.hazards.length, 0, 'The front starts at the floor, not at full height.');
    assert.equal(b.events.filter(e => e.kind === 'geyser').length, 2);
    b.update(50, player);
    assert.ok(b.hazards.length > 0);
    assert.ok(b.hazards.every(h => h.y > b.arena.floor - 64), 'No invisible collision ahead of the rising liquid.');
    b.update(100, player); b.update(25, player);
    for (const vent of locked) assert.ok(b.hazards.some(h => h.y === vent.y), 'The front reaches the advertised height.');
    until(b, 'recover'); assert.ok(b.geysers.every(g => g.phase === 'recede'));
    assert.ok(b.hazards.every(h => h.height === 8), 'Receding jets cannot hurt a recovery stomp.');
});

test('paused and invalid delta do not advance; delayed frame cannot skip anticipation', () => {
    const b = new JuiceMinibossModel(); b.health = 2; until(b, 'warning');
    const snapshot = structuredClone({ time: b.time, phaseTime: b.phaseTime, geysers: b.geysers });
    b.update(0, player); b.update(NaN, player); b.update(-1, player);
    assert.deepEqual({ time: b.time, phaseTime: b.phaseTime, geysers: b.geysers }, snapshot);
    b.update(5000, player); assert.equal(b.phase, 'warning'); assert.deepEqual(b.hazards, []);
});

test('defeat clears every danger permanently', () => {
    const b = new JuiceMinibossModel(); b.health = 1; until(b, 'recover');
    assert.equal(stomp(b), 'defeated');
    for (let i = 0; i < 100; i++) b.update(16, player);
    assert.deepEqual(b.drops, []); assert.deepEqual(b.geysers, []);
    assert.deepEqual(b.hazards, []); assert.equal(b.phase, 'defeated');
});

for (const health of [6, 2]) for (const x of [0, 306]) {
    test(`fan locks the actual player center at corner ${x}, health ${health}, for the full warning`, () => {
        const b = new JuiceMinibossModel(), corner = { ...player, x };
        b.health = health; b.phase = 'rest'; b.cycle = health === 6 ? 1 : 0;
        while (b.phase === 'rest') b.update(1000 / 120, corner);
        assert.equal(b.attack, 'fan'); assert.equal(b.phase, 'warning');
        assert.equal(b.targetX, x + corner.width / 2);
        assert.equal(b.targetY, corner.y + corner.height / 2);
        const launch = b.fanLaunch, time = b.time;
        while (b.phase === 'warning') b.update(1000 / 120, { ...corner, x: 160, y: 120 });
        assert.deepEqual(b.fanLaunch, launch);
        assert.ok(b.time - time >= b.warningMs);
        assert.ok(b.warningMs >= 680);
        while (b.drops.length === 0) b.update(1000 / 120, { ...corner, x: 160 });
        assert.equal(b.drops.length, health === 6 ? 7 : 9);
        b.drops.forEach((drop, i) => {
            assert.equal(drop.x + 4, launch.x); assert.equal(drop.y + 4, launch.y);
            assert.equal(drop.vx, launch.vectors[i].vx); assert.equal(drop.vy, launch.vectors[i].vy);
        });
    });
}

test('fan aiming does not relax dash and pounce landing clamps', () => {
    for (const cycle of [0, 2]) for (const x of [0, 306]) {
        const b = new JuiceMinibossModel(); b.phase = 'rest'; b.cycle = cycle;
        while (b.phase === 'rest') b.update(1000 / 120, { ...player, x });
        assert.equal(b.targetX, x === 0 ? 46 : 274);
        assert.equal(b.attack, cycle === 0 ? 'dash' : 'pounce');
    }
});
