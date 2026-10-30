import assert from 'node:assert/strict';
import test from 'node:test';
import { type BossMissile } from '../src/adventure/delicia/DeliciaBoss';
import { DELICIA_STAGES, type Box, type EnemySpec } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

const DT = 1 / 60;
const pulp: EnemySpec = { kind: 'pulp', x: 600, y: 396, patrol: 100 };
function fixture(character?: 'jaja' | 'guina', enemies: EnemySpec[] = []) {
    const stage = structuredClone(character ? DELICIA_STAGES.find(stage => stage.boss === character)! : DELICIA_STAGES[0]);
    Object.assign(stage, { enemies, hazards: [], machines: [], pickups: [], checkpoints: [], echoes: [], zones: [] });
    const sim = new DeliciaSimulation(stage);
    sim.player.grounded = true;
    if (sim.boss) { sim.boss.start(); sim.boss.beat = 'recover'; sim.boss.openValve(); }
    return sim;
}
function seed(target: Box, life: number): BossMissile {
    return { x: target.x + 5, y: target.y + 5, w: 12, h: 10,
        vx: 640, vy: -35, gravity: 85, kind: 'seed', life, friendly: true };
}
const combatEvents = (sim: DeliciaSimulation) => sim.events.filter(event => event.kind === 'enemy' || event.kind === 'boss-hit');

for (const target of ['enemy', 'jaja', 'guina'] as const) {
    for (const life of [-DT, 0, DT / 2, DT]) test(`${target}: seed with ${life}s remaining cannot hit after this step expires it`, () => {
        const sim = fixture(target === 'enemy' ? undefined : target, target === 'enemy' ? [pulp] : []);
        const victim = sim.boss ?? sim.enemies[0], hp = victim.hp;
        const missile = seed(sim.boss?.rect ?? sim.enemies[0], life);
        sim.projectiles.push(missile);
        sim.update(DT, noDeliciaInput());
        assert.equal(victim.hp, hp);
        assert.deepEqual(combatEvents(sim), []);
        assert.equal(sim.enemiesDefeated, 0);
        assert.deepEqual(sim.projectiles, []);
        sim.update(DT, noDeliciaInput());
        assert.equal(victim.hp, hp, 'An expired seed cannot defer damage to the next step.');
    });

    test(`${target}: seed still alive after the step deals one hit and is consumed`, () => {
        const sim = fixture(target === 'enemy' ? undefined : target, target === 'enemy' ? [pulp] : []);
        const victim = sim.boss ?? sim.enemies[0], hp = victim.hp;
        const missile = seed(sim.boss?.rect ?? sim.enemies[0], DT * 2);
        sim.projectiles.push(missile);
        sim.update(DT, noDeliciaInput());
        assert.equal(victim.hp, hp - 1);
        assert.equal(combatEvents(sim).length, 1);
        assert.equal(missile.life, 0);
        assert.deepEqual(sim.projectiles, []);
        sim.update(DT, noDeliciaInput());
        assert.equal(victim.hp, hp - 1);
        assert.deepEqual(combatEvents(sim), []);
    });
}

for (const kind of ['pulp', 'sentinel'] as const) test(`${kind}: consuming a seed on an enemy prevents a second collision with the boss`, () => {
    // Shipped boss arenas have no ordinary enemies. This synthetic overlap
    // protects single consumption without asserting an authored encounter exists.
    const sim = fixture('jaja', [{ ...pulp, kind, x: 780 }]), enemy = sim.enemies[0], boss = sim.boss!;
    const enemyHp = enemy.hp, bossHp = boss.hp, missile = seed(enemy, 1);
    sim.projectiles.push(missile);
    sim.update(DT, noDeliciaInput());
    assert.equal(enemy.hp, kind === 'sentinel' ? enemyHp : enemyHp - 1);
    assert.equal(enemy.state, kind === 'sentinel' ? 'stun' : 'dead');
    assert.equal(boss.hp, bossHp, 'An enemy hit or armored block consumes the seed before boss contact.');
    assert.deepEqual(combatEvents(sim).map(event => event.kind), kind === 'sentinel' ? [] : ['enemy']);
    assert.equal(missile.life, 0);
    assert.deepEqual(sim.projectiles, []);
});

test('one live seed still hits only the first of two overlapping enemies', () => {
    const sim = fixture(undefined, [pulp, pulp]);
    sim.projectiles.push(seed(sim.enemies[0], 1));
    sim.update(DT, noDeliciaInput());
    assert.deepEqual(sim.enemies.map(enemy => enemy.hp), [0, 1]);
    assert.equal(sim.enemiesDefeated, 1);
    assert.equal(combatEvents(sim).length, 1);
    assert.deepEqual(sim.projectiles, []);
});

test('a seed fired through the real input travels and damages an enemy before expiry', () => {
    const sim = fixture(undefined, [{ ...pulp, x: 200 }]), health = sim.player.health;
    let shots = 0, hits = 0;
    for (let step = 0; step < 30 && sim.enemies[0].hp > 0; step++) {
        sim.update(DT, { ...noDeliciaInput(), seed: step === 0 });
        shots += sim.events.filter(event => event.kind === 'seed').length;
        hits += combatEvents(sim).length;
    }
    assert.equal(shots, 1); assert.equal(hits, 1);
    assert.equal(sim.enemies[0].hp, 0);
    assert.equal(sim.player.health, health);
    assert.deepEqual(sim.projectiles, []);
});

for (const parry of [false, true]) test(`expired hostile projectile causes neither damage nor reflection (parry ${parry})`, () => {
    const sim = fixture(), health = sim.player.health;
    const missile: BossMissile = { ...seed(sim.player, DT), friendly: false, vx: 0, vy: 0, gravity: 0 };
    sim.projectiles.push(missile);
    sim.update(DT, { ...noDeliciaInput(), parry });
    assert.equal(sim.player.health, health);
    assert.equal(sim.parries, 0);
    assert.equal(missile.friendly, false);
    assert.ok(!sim.events.some(event => event.kind === 'hurt' || event.kind === 'parry'));
    assert.deepEqual(sim.projectiles, []);
});

test('parrying a live ordinary projectile preserves reflection and its subsequent enemy hit', () => {
    const sim = fixture(undefined, [{ ...pulp, x: 220 }]), health = sim.player.health;
    const missile: BossMissile = { ...seed(sim.player, 1), x: sim.player.x + sim.player.w / 2,
        y: sim.player.y + sim.player.h / 2, kind: 'juice', vx: -185, vy: 0, gravity: 350, friendly: false };
    sim.projectiles.push(missile);
    sim.update(DT, { ...noDeliciaInput(), parry: true });
    assert.equal(sim.parries, 1); assert.equal(missile.friendly, true);
    assert.equal(missile.vx, 370); assert.equal(missile.vy, -70); assert.equal(missile.gravity, 0);
    assert.equal(missile.life, 1 - DT); assert.equal(sim.player.parryTime, 0);
    assert.equal(sim.events.filter(event => event.kind === 'parry').length, 1);
    let hits = 0;
    for (let step = 0; step < 60 && sim.projectiles.length; step++) {
        sim.update(DT, noDeliciaInput()); hits += combatEvents(sim).length;
    }
    assert.equal(hits, 1); assert.equal(sim.enemies[0].hp, 0);
    assert.equal(sim.player.health, health); assert.equal(sim.parries, 1);
    assert.deepEqual(sim.projectiles, []);
});

for (const character of ['jaja', 'guina'] as const) test(`${character}: a live boss projectile can still be parried and return one hit`, () => {
    const sim = fixture(character), boss = sim.boss!, hp = boss.hp, health = sim.player.health;
    const missile: BossMissile = { ...seed(sim.player, 1), x: sim.player.x + sim.player.w / 2,
        y: sim.player.y + sim.player.h / 2, kind: 'heart', vx: -185, vy: 0, gravity: 110, friendly: false };
    boss.missiles.push(missile);
    sim.update(DT, { ...noDeliciaInput(), parry: true });
    assert.equal(sim.parries, 1); assert.equal(missile.friendly, true);
    assert.equal(missile.vx, 580); assert.equal(missile.vy, -50); assert.equal(missile.gravity, 0);
    assert.equal(missile.life, 2); assert.equal(sim.player.parryTime, 0);
    assert.equal(sim.events.filter(event => event.kind === 'parry').length, 1);
    let hits = 0;
    for (let step = 0; step < 120 && boss.missiles.length; step++) {
        sim.update(DT, noDeliciaInput()); hits += combatEvents(sim).length;
    }
    assert.equal(boss.hp, hp - 1); assert.equal(hits, 1);
    assert.equal(sim.player.health, health); assert.equal(sim.parries, 1);
    assert.equal(missile.life, 0); assert.deepEqual(boss.missiles, []);
});
