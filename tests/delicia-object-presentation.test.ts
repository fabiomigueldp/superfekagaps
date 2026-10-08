import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';
import { deliciaFoePresentation } from '../src/adventure/delicia/DeliciaFoePresentation';
import { DELICIA_ICONS, deliciaProjectileFrame } from '../src/adventure/delicia/DeliciaPixelSprites';

for(const kind of ['bloom','bottler'] as const)test(`${kind} art warns before emission and recoils only after an actual shot`,()=>{
    const source=ALL_DELICIA_STAGES.find(s=>s.enemies.some(e=>e.kind===kind))!;
    const stage=structuredClone(source);stage.hazards=[];stage.machines=[];
    stage.enemies=[{kind,x:350,y:406,patrol:0}];stage.floors=[{x:0,y:450,w:1000,h:450,material:'stone'}];
    const sim=new DeliciaSimulation(stage),enemy=sim.enemies[0];sim.player.x=100;enemy.timer=0;
    sim.update(1/120,noDeliciaInput());
    assert.equal(deliciaFoePresentation(enemy,sim.player.x,sim.time).pose,'tell');
    assert.equal(enemy.shotAt,undefined);assert.equal(sim.projectiles.length,0);
    enemy.timer=0;sim.update(1/120,noDeliciaInput());
    assert.equal(sim.projectiles.length,kind==='bloom'?3:1);
    assert.equal(enemy.shotAt,sim.time);assert.equal(enemy.state,'walk','Recoil art must not introduce a second damaging state');
    const before=structuredClone(sim);
    assert.equal(deliciaFoePresentation(enemy,sim.player.x,sim.time).pose,'attack');
    assert.equal(deliciaFoePresentation(enemy,sim.player.x,sim.time+.25).pose,'walk');
    assert.deepEqual(structuredClone(sim),before,'Reading a pose cannot advance or mutate the simulation');
    enemy.state='stun';assert.equal(deliciaFoePresentation(enemy,sim.player.x,sim.time).pose,'stun','A fresh shot cannot hide vulnerability');
});

test('a flying wasp faces along its actual path and a distant mimic rests',()=>{
    const sim=new DeliciaSimulation(ALL_DELICIA_STAGES.find(s=>s.enemies.some(e=>e.kind==='wasp'))!);
    const wasp=sim.enemies.find(e=>e.kind==='wasp')!;wasp.phase=0;
    assert.equal(deliciaFoePresentation(wasp,0,0).flip,true);
    assert.equal(deliciaFoePresentation(wasp,0,Math.PI/1.6).flip,false);
    const mimic={...wasp,kind:'mimic' as const,x:0,state:'walk' as const};
    assert.equal(deliciaFoePresentation(mimic,200,0).dormant,true);
    assert.equal(deliciaFoePresentation(mimic,100,0).pose,'attack');
});

test('hostile hearts and health pickups remain distinct without their colors',()=>{
    const silhouette=(frame:readonly string[])=>frame.map(row=>row.replace(/[^_]/g,'#')).join('\n');
    assert.notEqual(silhouette(DELICIA_ICONS.heart),silhouette(deliciaProjectileFrame('heart',false)));
    assert.notDeepEqual(DELICIA_ICONS.heart,deliciaProjectileFrame('heart',false));
});
