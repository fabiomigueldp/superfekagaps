import assert from 'node:assert/strict';
import test from 'node:test';
import { DELICIA_STAGES, type DeliciaStage } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

const DT = 1 / 120;
function gateContact(health: number) {
    const stage = DELICIA_STAGES[0], sim = new DeliciaSimulation(stage);
    stage.valves.forEach(v => sim.valves.add(v.id));
    // The authored last pulp can patrol into the gate approach. Invincibility
    // can naturally expire while Feka crosses the flag with one heart left.
    Object.assign(sim.player, { x: stage.gate.x - 34, y: 396, grounded: true, vx: 290, health, invincible: DT / 2 });
    const enemy = sim.enemies.at(-1)!;
    enemy.x = enemy.home + enemy.patrol / 2 - 1;
    enemy.vx = 55;
    sim.update(DT, { ...noDeliciaInput(), right: true });
    return sim;
}
function fixture(): DeliciaStage {
    const stage = structuredClone(DELICIA_STAGES[0]);
    Object.assign(stage, { spawn: { x: 100, y: 396 }, enemies: [], hazards: [], machines: [], pickups: [], checkpoints: [], valves: [] });
    stage.floors = [{ x: 0, y: 450, w: stage.width, h: 450, material: 'stone' }];
    return stage;
}

test('fatal contact at the authored Delícia gate does not complete or advance the campaign', () => {
    const sim = gateContact(1);
    assert.equal(sim.dead, true);
    assert.equal(sim.finished, false);
    assert.deepEqual(sim.events.map(e => e.kind), ['hurt']);
    sim.update(DT, noDeliciaInput());
    assert.deepEqual(sim.events, []);
});
test('nonfatal contact at the same gate still permits completion', () => {
    const sim = gateContact(2);
    assert.equal(sim.dead, false);
    assert.equal(sim.finished, true);
    assert.ok(sim.events.some(e => e.kind === 'hurt'));
    assert.ok(sim.events.some(e => e.kind === 'clear'));
});
for (const health of [1, 2]) test(`hazard contact before pickups and checkpoints, health ${health}`, () => {
    const stage = fixture();
    stage.hazards = [{ x: 95, y: 390, w: 55, h: 60, kind: 'thorns' }];
    stage.pickups = [{ id: 'reward', x: 117, y: 423, kind: 'seal' }, { id: 'heart', x: 117, y: 423, kind: 'heart' }];
    stage.checkpoints = [{ x: 100, y: 396 }];
    const sim = new DeliciaSimulation(stage);
    sim.player.health = health;
    sim.update(DT, noDeliciaInput());
    assert.equal(sim.dead, health === 1);
    assert.equal(sim.collected.size, health === 1 ? 0 : 2);
    assert.equal(sim.checkpoint, health === 1 ? -1 : 0);
    assert.equal(sim.player.health, health === 1 ? 0 : 2);
});
test('fatal enemy contact stops later enemies and projectile damage to a boss', () => {
    const stage = fixture();
    stage.boss = 'jaja';
    stage.enemies = [{ kind: 'pulp', x: 100, y: 396, patrol: 135 }, { kind: 'pulp', x: 100, y: 440, patrol: 135 }];
    const sim = new DeliciaSimulation(stage);
    sim.player.health = 1;
    sim.boss!.beat = 'recover';
    sim.boss!.hp = 1; sim.boss!.openValve();
    sim.projectiles = [{ ...sim.boss!.rect, vx: 0, vy: 0, gravity: 0, kind: 'seed', life: 1, friendly: true }];
    sim.update(DT, noDeliciaInput());
    assert.equal(sim.dead, true);
    assert.equal(sim.enemies[1].timer, 0);
    assert.equal(sim.boss!.hp, 1);
    assert.ok(!sim.events.some(e => e.kind === 'boss-hit' || e.kind === 'enemy' || e.kind === 'defeat'));
});
test('fatal projectile stops later friendly projectiles and boss contact', () => {
    const stage = fixture(); stage.boss = 'jaja';
    const sim = new DeliciaSimulation(stage);
    sim.player.health = 1; sim.boss!.beat = 'recover'; sim.boss!.hp = 1; sim.boss!.openValve();
    sim.projectiles = [
        { x: 100, y: 396, w: 34, h: 54, vx: 0, vy: 0, gravity: 0, kind: 'juice', life: 1, friendly: false },
        { ...sim.boss!.rect, vx: 0, vy: 0, gravity: 0, kind: 'seed', life: 1, friendly: true }
    ];
    sim.update(DT, noDeliciaInput());
    assert.equal(sim.dead, true);
    assert.equal(sim.boss!.hp, 1);
    assert.deepEqual(sim.events.map(e => e.kind), ['hurt']);
});
for (const source of ['boss missile', 'boss gap', 'press', 'juice', 'fall'] as const) test(`${source}: lethal contact cannot collect or activate a checkpoint`, () => {
    const stage = fixture();
    if(source.startsWith('boss'))stage.boss='jaja';
    if(source==='press')stage.machines=[{id:'press',kind:'press',x:95,y:390,w:55,h:60,period:4,phase:3.3}];
    if(source==='juice')stage.hazards=[{kind:'juice',x:95,y:390,w:55,h:60}];
    stage.pickups=[{id:'reward',kind:'seal',x:117,y:423}];
    stage.checkpoints=[{x:100,y:396}];
    const sim=new DeliciaSimulation(stage);sim.player.health=1;
    if(source==='boss missile')sim.boss!.missiles=[{x:100,y:396,w:34,h:54,vx:0,vy:0,gravity:0,kind:'juice',life:1,friendly:false}];
    if(source==='boss gap')sim.boss!.gaps=[{x:90,y:450,w:80,h:450,life:1}];
    if(source==='fall'){
        sim.player.y=845;
        stage.pickups[0].y=872;stage.checkpoints[0].y=845;
    }
    sim.update(DT,noDeliciaInput());
    assert.equal(sim.dead,true);
    assert.equal(sim.checkpoint,-1);
    assert.equal(sim.collected.size,0);
    assert.equal(sim.finished,false);
    assert.ok(!sim.events.some(e=>['collect','checkpoint','clear'].includes(e.kind)));
});
test('a boss hit resolved before lethal contact remains earned without postmortem completion', () => {
    const stage=fixture();stage.boss='jaja';
    const sim=new DeliciaSimulation(stage);sim.player.health=1;
    sim.boss!.beat='recover';sim.boss!.hp=1;sim.boss!.openValve();
    sim.projectiles=[
        {...sim.boss!.rect,vx:0,vy:0,gravity:0,kind:'seed',life:1,friendly:true},
        {x:100,y:396,w:34,h:54,vx:0,vy:0,gravity:0,kind:'juice',life:1,friendly:false}
    ];
    sim.update(DT,noDeliciaInput());
    assert.equal(sim.boss!.hp,0);
    assert.equal(sim.dead,true);
    assert.equal(sim.finished,false);
    assert.deepEqual(sim.events.map(e=>e.kind),['boss-hit','hurt']);
});
