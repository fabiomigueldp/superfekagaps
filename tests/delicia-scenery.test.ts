import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_DELICIA_STAGES} from '../src/adventure/delicia/DeliciaContent';
import {DeliciaSimulation,movingFloor,noDeliciaInput} from '../src/adventure/delicia/DeliciaSimulation';

test('ferry collision surfaces stay between their banks throughout a full cycle',()=>{
 let checked=0;
 for(const stage of ALL_DELICIA_STAGES)for(const ferry of stage.floors.filter(f=>f.kind==='moving')){
  const channel=stage.hazards.find(h=>h.kind==='juice'&&ferry.x>=h.x&&ferry.x<h.x+h.w)!;
  assert.ok(channel,`${stage.id}: ferry has a channel`);
  const period=2*Math.PI/(ferry.speed??1.6);
  for(let step=0;step<=120;step++){
   const b=movingFloor(ferry,period*step/120);
   assert.ok(b.x>=channel.x+5.9,`${stage.id}: left bank`);
   assert.ok(b.x+b.w<=channel.x+channel.w-5.9,`${stage.id}: right bank`);
  }
  checked++;
 }
 assert.ok(checked>20);
});

test('valves have a foundation and do not occupy checkpoint flags or lift shafts',()=>{
 for(const stage of ALL_DELICIA_STAGES)for(const valve of stage.valves){
  assert.ok(stage.floors.some(f=>f.y===valve.y&&f.x<=valve.x-20&&f.x+f.w>=valve.x+20),`${stage.id}: ${valve.id} floats`);
  for(const cp of stage.checkpoints)assert.ok(valve.x+36<cp.x-4||valve.x-20>cp.x+35||valve.y<cp.y-26,`${stage.id}: valve overlaps flag`);
  for(const f of stage.floors.filter(f=>f.kind==='lift'||f.kind==='spring'))assert.ok(valve.x+36<f.x-8||valve.x-20>f.x+f.w+8,`${stage.id}: valve overlaps lift`);
 }
});

test('mandatory valve landings can be crossed on foot without forced updrafts',()=>{
 for(const authored of ALL_DELICIA_STAGES.filter(s=>s.biome==='orchard')){
  const stage=structuredClone(authored);stage.enemies=[];stage.hazards=[];
  const zone=stage.zones![2],ground=stage.floors.find(f=>f.x===zone.x&&f.h>50)!;
  const sim=new DeliciaSimulation(stage);sim.player.x=zone.x+45;sim.player.y=ground.y-sim.player.h;sim.player.grounded=true;
  for(let step=0;step<250&&sim.player.x<zone.x+ground.w-55;step++){
   sim.update(1/120,{...noDeliciaInput(),right:true});
   assert.ok(Math.abs(sim.player.y+sim.player.h-ground.y)<1,`${stage.id}: wind hijacked the ground route`);
  }
  assert.ok(sim.player.x>zone.x+ground.w-60);assert.equal(sim.player.health,4);
 }
});

test('collectibles do not hide inside the static valve wheel or duplicate an upper reward',()=>{
 for(const stage of ALL_DELICIA_STAGES){
  for(const p of stage.pickups)for(const valve of stage.valves){
   const distance=Math.hypot(p.x-valve.x,p.y-(valve.y-42));
   assert.ok(distance>29,`${stage.id}: ${p.id} overlaps ${valve.id}`);
  }
  for(const seal of stage.pickups.filter(p=>p.kind==='seal'))for(const other of stage.pickups.filter(p=>p.id!==seal.id)){
   assert.ok(Math.hypot(seal.x-other.x,seal.y-other.y)>24,`${stage.id}: ${seal.id} overlaps ${other.id}`);
  }
 }
});
