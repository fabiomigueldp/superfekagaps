import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_DELICIA_STAGES,DELICIA_STAGES} from '../src/adventure/delicia/DeliciaContent';
import {DeliciaSimulation,noDeliciaInput,movingFloor} from '../src/adventure/delicia/DeliciaSimulation';
import {DeliciaBoss} from '../src/adventure/delicia/DeliciaBoss';
import {awardDeliciaMedals,freshDeliciaSave,parseDeliciaSave} from '../src/adventure/delicia/DeliciaProgress';

test('every traversal has four authored landmarks, readable encounter spaces and persistent pickup IDs',()=>{
 const landmarks=new Set<string>(),machines=new Set<string>();
 for(const stage of ALL_DELICIA_STAGES.filter(s=>!s.boss)){
  assert.equal(stage.zones?.length,4);assert.equal(stage.checkpoints.length,3);assert.equal(stage.echoes?.length,3);
  assert.ok(stage.width>4200);for(const z of stage.zones!)landmarks.add(z.landmark);for(const m of stage.machines!)machines.add(m.kind);
  for(const f of stage.floors)if(f.requiresValve)assert.ok(stage.valves.some(v=>v.id===f.requiresValve));
  assert.deepEqual(stage.pickups.filter(p=>p.kind==='seal').map(p=>p.id),[1,2,3].map(n=>`${stage.id}:s${n}`));
 }
 assert.equal(landmarks.size,9);assert.deepEqual([...machines].sort(),['jet','press','wind']);
 assert.ok(ALL_DELICIA_STAGES.some(s=>s.enemies.some(e=>e.kind==='bloom')));
});

test('vertical lifts carry a standing player using the same surface used for drawing',()=>{
 const stage=structuredClone(DELICIA_STAGES[3]);stage.enemies=[];stage.hazards=[];stage.machines=[];
 const floor=stage.floors.find(f=>f.kind==='lift')!;const sim=new DeliciaSimulation(stage);const initial=movingFloor(floor,0);
 sim.player.x=initial.x+15;sim.player.y=initial.y-sim.player.h-.1;
 for(let i=0;i<120;i++)sim.update(1/120,noDeliciaInput());
 const actual=movingFloor(floor,sim.time);assert.ok(Math.abs(sim.player.y+sim.player.h-actual.y)<1);assert.ok(sim.player.grounded);
 assert.notEqual(actual.y,initial.y);
});

test('opening a sluice restores physical collision on its suspended bridge',()=>{
 const stage=structuredClone(DELICIA_STAGES[2]);stage.enemies=[];stage.hazards=[];stage.machines=[];
 const bridge=stage.floors.find(f=>f.kind==='bridge')!;const sim=new DeliciaSimulation(stage);
 assert.equal(sim.floorAvailable(bridge),false);const valve=stage.valves.find(v=>v.id===bridge.requiresValve)!;
 sim.player.x=valve.x;sim.player.y=valve.y-sim.player.h;sim.update(1/120,{...noDeliciaInput(),interact:true});
 assert.equal(sim.floorAvailable(bridge),true);sim.player.x=bridge.x+20;sim.player.y=bridge.y-sim.player.h-10;sim.player.vy=100;
 for(let i=0;i<30;i++)sim.update(1/120,noDeliciaInput());assert.ok(Math.abs(sim.player.y+sim.player.h-bridge.y)<1);
});

test('press tells are harmless, the active piston damages, and the source valve disables it',()=>{
 const stage=structuredClone(DELICIA_STAGES[7]);stage.enemies=[];stage.hazards=[];
 const press=stage.machines!.find(m=>m.kind==='press')!;const sim=new DeliciaSimulation(stage);
 sim.player.x=press.x+15;sim.player.y=press.y+press.h-sim.player.h;sim.time=press.period*.65-press.phase;
 sim.update(1/120,noDeliciaInput());assert.equal(sim.player.health,4);
 sim.time=press.period*.82-press.phase;sim.update(1/120,noDeliciaInput());assert.equal(sim.player.health,3);
 sim.valves.add(press.disabledBy!);sim.player.invincible=0;sim.player.x=press.x+15;sim.player.y=press.y+press.h-sim.player.h;
 sim.update(1/120,noDeliciaInput());assert.equal(sim.player.health,3);
});

test('a source jet launches without damage and fragile paths regenerate for retries',()=>{
 const stage=structuredClone(DELICIA_STAGES[3]);stage.enemies=[];stage.hazards=[];
 const jet=stage.machines!.find(m=>m.kind==='jet')!;const sim=new DeliciaSimulation(stage);
 sim.time=jet.period*.82-jet.phase;sim.player.x=jet.x+5;sim.player.y=jet.y+jet.h-sim.player.h;sim.update(1/120,noDeliciaInput());
 assert.ok(sim.player.vy<-700);assert.equal(sim.player.health,4);assert.ok(sim.events.some(e=>e.kind==='jet'));
 const fragile=new DeliciaSimulation(DELICIA_STAGES[4]);const index=fragile.stage.floors.findIndex(f=>f.kind==='crumble');fragile.crumble.set(index,1.1);
 for(let i=0;i<550;i++)fragile.update(1/120,noDeliciaInput());assert.equal(fragile.crumble.has(index),false);
});

test('all press columns have matching warning geometry and phase transitions clear old attacks',()=>{
 const boss=new DeliciaBoss('guina');boss.phase=2;boss.start();
 for(let i=0;i<400&&boss.beat!=='attack';i++)boss.update(1/120,{x:1200,y:396,w:34,h:54});
 assert.equal(boss.attack,'press');
 const columns=boss.warnings;assert.equal(columns.length,2);boss.update(1/120,{x:1200,y:396,w:34,h:54});assert.deepEqual(boss.danger,columns);
 boss.beat='recover';boss.hp=17;boss.openValve();boss.gaps.push({x:500,y:450,w:180,h:450,life:4});
 boss.missiles.push({x:200,y:400,w:22,h:22,vx:200,vy:0,gravity:0,kind:'juice',life:4,friendly:false});
 boss.phase=1;assert.ok(boss.hit(2));assert.equal(boss.beat,'transition');assert.equal(boss.danger.length,0);assert.equal(boss.missiles.length,0);assert.equal(boss.gaps.length,0);assert.equal(boss.hit(),false);
});

test('whirlpool releases distinct timed waves instead of stacking simultaneous hitboxes',()=>{
 const boss=new DeliciaBoss('jaja');boss.start();boss.phase=3;
 for(let i=0;i<1000&&!(boss.attack==='whirlpool'&&boss.beat==='attack');i++)boss.update(1/120,{x:150,y:396,w:34,h:54});
 const emissions:number[]=[];
 for(let i=0;i<265;i++){boss.update(1/120,{x:150,y:396,w:34,h:54});if(boss.events.some(e=>e.kind==='shot'))emissions.push(boss.time);}
 assert.equal(emissions.length,4);for(let i=1;i<emissions.length;i++)assert.ok(emissions[i]-emissions[i-1]>.5);
});

test('medals survive old-save migration and cannot be earned from assist or checkpoint records',()=>{
 const save=freshDeliciaSave();const run={eligible:true,damage:0,seals:3,seconds:30,parries:3};
 assert.deepEqual(awardDeliciaMedals(save,'delicia-1',run),['clean','seals','tempo']);
 assert.deepEqual(awardDeliciaMedals(save,'delicia-2',{...run,eligible:false}),[]);
 save.assists=true;assert.deepEqual(awardDeliciaMedals(save,'delicia-3',run),[]);
 const restored=parseDeliciaSave(JSON.stringify(save));assert.deepEqual(restored.medals['delicia-1'],['clean','seals','tempo']);
 const old={...save,medals:undefined};assert.deepEqual(parseDeliciaSave(JSON.stringify(old)).medals,{});
});
