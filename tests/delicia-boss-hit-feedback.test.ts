import assert from 'node:assert/strict';
import test from 'node:test';
import { bossPhase, type BossMissile } from '../src/adventure/delicia/DeliciaBoss';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

const DT = 1 / 120;
const sources = ['seed', 'stomp', 'pound', 'reflected-heart', 'reflected-juice', 'reflected-seed', 'reflected-wave'] as const;
type Source = typeof sources[number];
function fixture(character: 'jaja' | 'guina', assist = false) {
    const stage = structuredClone(DELICIA_STAGES.find(stage => stage.boss === character)!);
    Object.assign(stage, { enemies: [], hazards: [], machines: [], pickups: [], checkpoints: [], echoes: [], zones: [] });
    const sim = new DeliciaSimulation(stage, assist), boss = sim.boss!;
    boss.start(); boss.beat = 'recover'; boss.openValve();
    Object.assign(sim.player, { x: 100, y: 396, grounded: true });
    return { sim, boss };
}
function contact(sim: DeliciaSimulation, source: Source): { x: number; y: number; life?: number } {
    const boss = sim.boss!;
    if (source === 'stomp' || source === 'pound') {
        Object.assign(sim.player, { x: boss.x + 20, y: boss.y - sim.player.h - 1, grounded: false, vy: 300, pounding: source === 'pound' });
        return { x: boss.x, y: boss.y };
    }
    const missile: BossMissile = { x: boss.x + 5, y: boss.y + 50, w: 12, h: 10,
        vx: 0, vy: 0, gravity: 0, kind: source === 'seed' ? 'seed' : source.slice(10) as BossMissile['kind'], life: 2, friendly: source === 'seed' };
    if (source === 'seed') sim.projectiles.push(missile);
    else { boss.reflect(missile); boss.missiles.push(missile); }
    return missile;
}
for (const character of ['jaja', 'guina'] as const) for (const assist of [false, true])
for (const source of sources) for (const outcome of ['normal', 'phase', 'fatal'] as const) {
    test(`${character}, assist ${assist}, ${source}, ${outcome}: one immediate hit cue for accepted damage`, () => {
        const { sim, boss } = fixture(character, assist), power = source === 'pound' ? 2 : 1;
        if (outcome === 'phase') boss.hp = Math.floor(boss.maxHp * .66) + power;
        if (outcome === 'fatal') boss.hp = power;
        boss.phase = bossPhase(boss.hp, boss.maxHp);
        const hp = boss.hp, impact = contact(sim, source);
        sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, hp - power); assert.equal(boss.hitFlash, .2);
        assert.deepEqual(sim.events.filter(event => event.kind === 'boss-hit'), [{ kind: 'boss-hit', x: impact.x, y: impact.y }]);
        const stomp = source === 'stomp' || source === 'pound', color = stomp ? '#ffe7a9' : '#ffdc87';
        assert.equal(sim.particles.filter(particle => particle.color === color).length, stomp ? 26 : 20);
        assert.deepEqual(sim.events.map(event => event.kind), outcome === 'normal' ? ['boss-hit'] : ['boss-hit', outcome === 'phase' ? 'phase' : 'defeat']);
        if (stomp) { assert.equal(sim.player.vy, -1260); assert.equal(sim.player.pounding, false); }
        else assert.equal(impact.life, 0, 'Accepted projectile is consumed.');
        sim.update(DT, noDeliciaInput());
        assert.equal(sim.events.filter(event => event.kind === 'boss-hit').length, 0, 'No replay on the next step.');
    });
}
for (const character of ['jaja', 'guina'] as const) for (const source of sources)
for (const blocked of ['shield', 'attack', 'cooldown', 'defeated'] as const) {
    test(`${character}, ${source}, ${blocked}: rejected damage emits no hit cue`, () => {
        const { sim, boss } = fixture(character);
        if (blocked === 'shield') boss.shield = true;
        if (blocked === 'attack') boss.beat = 'idle';
        if (blocked === 'cooldown') { boss.hit(); sim.events = []; sim.particles = []; }
        if (blocked === 'defeated') { boss.hp = 0; boss.beat = 'defeated'; }
        const hp = boss.hp;
        contact(sim, source); sim.update(DT, noDeliciaInput());
        assert.equal(boss.hp, hp);
        assert.equal(sim.events.filter(event => event.kind === 'boss-hit').length, 0);
        assert.equal(sim.particles.filter(particle => ['#ffe7a9', '#ffdc87'].includes(particle.color)).length, 0);
    });
}
for (const character of ['jaja', 'guina'] as const) test(`${character}: reflected damage remains earned before a lethal projectile`, () => {
    const { sim, boss } = fixture(character); sim.player.health = 1;
    contact(sim, 'reflected-heart');
    sim.projectiles.push({ ...sim.player, vx: 0, vy: 0, gravity: 0, kind: 'juice', life: 1, friendly: false });
    sim.update(DT, noDeliciaInput());
    assert.equal(boss.hp, boss.maxHp - 1); assert.equal(sim.dead, true);
    assert.deepEqual(sim.events.map(event => event.kind), ['boss-hit', 'hurt']);
});
for (const character of ['jaja', 'guina'] as const) test(`${character}: simultaneous reflected and direct hits share the original damage cooldown`, () => {
    const { sim, boss } = fixture(character);
    contact(sim, 'reflected-heart'); contact(sim, 'seed'); contact(sim, 'stomp');
    sim.update(DT, noDeliciaInput());
    assert.equal(boss.hp, boss.maxHp - 1);
    assert.equal(sim.events.filter(event => event.kind === 'boss-hit').length, 1);
    assert.equal(sim.particles.filter(particle => particle.color === '#ffdc87').length, 20);
    assert.equal(sim.particles.filter(particle => particle.color === '#ffe7a9').length, 0);
});
for (const character of ['jaja', 'guina'] as const) test(`${character}: reflection into armor still relieves pressure without claiming damage`, () => {
    const { sim, boss } = fixture(character); boss.shield = true; boss.pressure = 50;
    contact(sim, 'reflected-heart'); sim.update(DT, noDeliciaInput());
    assert.equal(boss.hp, boss.maxHp); assert.equal(boss.pressure, 20); assert.equal(boss.shield, false);
    assert.equal(sim.events.filter(event => event.kind === 'boss-hit').length, 0);
});
