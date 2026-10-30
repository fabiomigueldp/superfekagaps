import assert from 'node:assert/strict';
import test from 'node:test';
import { bossPhase, type DeliciaBoss, type BossMissile } from '../src/adventure/delicia/DeliciaBoss';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

const DT = 1 / 60;
function fixture(character: 'jaja' | 'guina', shield = false) {
    const stage = structuredClone(DELICIA_STAGES.find(stage => stage.boss === character)!);
    Object.assign(stage, { enemies: [], hazards: [], machines: [], pickups: [], checkpoints: [], echoes: [], zones: [] });
    const sim = new DeliciaSimulation(stage), boss = sim.boss!;
    boss.start(); boss.beat = 'recover'; boss.openValve();
    boss.pressure = 50; boss.shield = shield;
    return { sim, boss };
}
function reflected(boss: DeliciaBoss, life = 2): BossMissile {
    const missile: BossMissile = { x: boss.x + 10, y: boss.y + 50, w: 26, h: 26,
        vx: -180, vy: 0, gravity: 110, kind: 'heart', life: 5, friendly: false };
    boss.reflect(missile);
    // Model the remaining lifetime of an already reflected projectile.
    missile.life = life;
    return missile;
}

for (const character of ['jaja', 'guina'] as const) for (const shield of [false, true]) {
    for (const life of [-DT, 0, DT / 2, DT]) test(`${character}, shield ${shield}: expired reflected heart (${life}s) cannot affect HP, pressure or armor`, () => {
        const { sim, boss } = fixture(character, shield), hp = boss.hp;
        boss.missiles.push(reflected(boss, life));
        sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, hp);
        assert.equal(boss.pressure, 50);
        assert.equal(boss.shield, shield);
        assert.equal(boss.hitFlash, 0);
        assert.deepEqual(sim.events, []);
        assert.deepEqual(boss.missiles, []);
        sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, hp); assert.equal(boss.pressure, 50); assert.equal(boss.shield, shield);
        assert.deepEqual(sim.events, [], 'An expired impact cannot be deferred to the next step.');
    });

    test(`${character}, shield ${shield}: live reflection retains its damage or pressure-relief effect`, () => {
        const { sim, boss } = fixture(character, shield), hp = boss.hp, missile = reflected(boss, DT * 2);
        boss.missiles.push(missile);
        sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, shield ? hp : hp - 1);
        assert.equal(boss.pressure, shield ? 20 : 50);
        assert.equal(boss.shield, false);
        assert.deepEqual(sim.events.map(event => event.kind), shield ? [] : ['boss-hit']);
        assert.equal(missile.life, 0);
        assert.deepEqual(boss.missiles, []);
        sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, shield ? hp : hp - 1);
        assert.equal(boss.pressure, shield ? 20 : 50);
        assert.deepEqual(sim.events, []);
    });
}

for (const character of ['jaja', 'guina'] as const) for (const outcome of ['phase', 'defeat'] as const) {
    test(`${character}: ${outcome} clears remaining reflected impacts in the same step`, () => {
        const { sim, boss } = fixture(character);
        boss.hp = outcome === 'phase' ? Math.floor(boss.maxHp * .66) + 1 : 1;
        boss.phase = bossPhase(boss.hp, boss.maxHp);
        const hp = boss.hp, first = reflected(boss), stale = reflected(boss), staleBefore = { ...stale };
        boss.missiles.push(first, stale);
        sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, hp - 1);
        assert.equal(boss.beat, outcome === 'phase' ? 'transition' : 'defeated');
        assert.deepEqual(sim.events.map(event => event.kind), ['boss-hit', outcome]);
        assert.equal(boss.pressure, 50, 'A cleared projectile must not apply pressure relief through a rejected hit.');
        assert.equal(first.life, 0);
        assert.deepEqual(boss.missiles, []);
        assert.deepEqual(stale, staleBefore, 'The old queue must stop advancing after the hit clears it.');
        sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, hp - 1); assert.equal(boss.pressure, 50);
        assert.deepEqual(sim.events, []);
    });
}

for (const character of ['jaja', 'guina'] as const) {
    test(`${character}: an expired reflection does not prevent the following live reflection`, () => {
        const { sim, boss } = fixture(character), hp = boss.hp;
        const expired = reflected(boss, DT), live = reflected(boss);
        boss.missiles.push(expired, live);
        sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, hp - 1);
        assert.equal(boss.pressure, 50);
        assert.deepEqual(sim.events.map(event => event.kind), ['boss-hit']);
        assert.equal(live.life, 0); assert.deepEqual(boss.missiles, []);
    });

    test(`${character}: without a phase change later missiles retain normal contact and movement`, () => {
        const { sim, boss } = fixture(character), hp = boss.hp;
        const first = reflected(boss), second = reflected(boss);
        const flying: BossMissile = { x: 1000, y: 100, w: 26, h: 26,
            vx: 180, vy: 0, gravity: 0, kind: 'heart', life: 1, friendly: false };
        boss.missiles.push(first, second, flying);
        sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, hp - 1, 'The second live contact still shares the damage cooldown.');
        assert.equal(boss.pressure, 20, 'A live rejected reflection still relieves pressure.');
        assert.deepEqual(sim.events.map(event => event.kind), ['boss-hit']);
        assert.equal(first.life, 0); assert.equal(second.life, 0);
        assert.deepEqual(boss.missiles, [flying]);
        assert.equal(flying.x, 1000 + 180 * DT); assert.equal(flying.life, 1 - DT);
    });
}
