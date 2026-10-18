import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldLevel,WorldObjects} from '../src/adventure/WorldPhysics';
import {jetCycle} from '../src/adventure/WorldMachineState';
import {supportsStanding} from '../src/world/tileRules';
import {TileType} from '../src/constants';
import {drawGuairaControl,drawGuairaControlBase,guairaLinkedControl,GUAIRA_CONTROL_COLORS as P} from '../src/adventure/experimental/guaira/GuairaControlArt';
import {guairaTraversalStage} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {guairaJunctionStage} from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import {guairaRespirosStage} from '../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import {guairaAscentStage} from '../src/adventure/experimental/guaira/GuairaAscent';
import {guairaGalleryStage} from '../src/adventure/experimental/guaira/gallery/GuairaGalleryStage';
import {guairaReliefStage} from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';
import {guairaMayorStage} from '../src/adventure/experimental/guaira/GuairaMayorLab';
import {GUAIRA_COURSES,guairaCourseDetours,type GuairaCourseId} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {drawReliefTerrain} from '../src/adventure/experimental/guaira/relief/GuairaReliefArt';

function paint(draw:(c:CanvasRenderingContext2D)=>void){
 const pixels=new Map<string,string>();let color='',clip=[-4096,-4096,4096,4096],pending=clip;
 const stack:Array<{color:string;clip:number[]}>=[];
 const c={get fillStyle(){return color;},set fillStyle(v:string){color=v;},
  save(){stack.push({color,clip:[...clip]});},restore(){({color,clip}=stack.pop()!);},
  beginPath(){},rect(x:number,y:number,w:number,h:number){pending=[x,y,x+w,y+h];},
  clip(){clip=clip.map((n,i)=>i<2?Math.max(n,pending[i]):Math.min(n,pending[i]));},
  fillRect(x:number,y:number,w:number,h:number){
   assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(w>0&&h>0);
   for(let yy=Math.max(y,clip[1]);yy<Math.min(y+h,clip[3]);yy++)
    for(let xx=Math.max(x,clip[0]);xx<Math.min(x+w,clip[2]);xx++)pixels.set(`${xx},${yy}`,color);
  }};
 draw(c as unknown as CanvasRenderingContext2D);assert.equal(stack.length,0);return pixels;
}
const factories={travessia:guairaTraversalStage,patio:guairaJunctionStage,respiros:guairaRespirosStage,
 subida:guairaAscentStage,galeria:guairaGalleryStage,alivio:guairaReliefStage,prefeito:guairaMayorStage};

test('bridge plaque follows the real receiving deck in both directions, never just the requested toggle',()=>{
 const stage=guairaTraversalStage(),o=new WorldObjects(stage.mechanisms),l=new WorldLevel(stage.level);
 const b=o.get('guaira-valve')!,target=o.get(b.link!)!;
 assert.equal(guairaLinkedControl(b,target).phase,'available');
 assert.ok(o.activate(b.id));assert.equal(guairaLinkedControl(b,target).phase,'moving');
 let previous=0;
 for(let n=0;n<150;n++){
  o.update(1000/60,l,b.x);const state=guairaLinkedControl(b,target);
  assert.ok(state.progress>=previous);previous=state.progress;
  if(state.phase==='settled')assert.equal(target.y,target.to!.y);
 }
 assert.equal(previous,1);assert.equal(guairaLinkedControl(b,target).phase,'settled');
 assert.ok(o.activate(b.id));assert.equal(guairaLinkedControl(b,target).phase,'moving');
 for(let n=0;n<150;n++){
  o.update(1000/60,l,b.x);const state=guairaLinkedControl(b,target);assert.ok(state.progress<=previous);previous=state.progress;
 }
 assert.equal(previous,0);assert.equal(guairaLinkedControl(b,target).phase,'available');
});

test('a dry interval never masquerades as an isolated circuit; a reopened valve keeps its warning',()=>{
 const o=new WorldObjects(guairaRespirosStage().mechanisms),b=o.get('guaira-respiro-c-isolation')!,target=o.get(b.link!)!;
 const seen=new Set();
 for(let time=0;time<4200;time+=50){o.time=time;seen.add(jetCycle(target,time).phase);assert.equal(guairaLinkedControl(b,target).phase,'available');}
 assert.ok(seen.size>=4);o.activate(b.id);
 assert.equal(guairaLinkedControl(b,target).phase,'settled');assert.equal(jetCycle(target,o.time).danger,null);
 b.timer=0;assert.ok(o.activate(b.id));assert.equal(guairaLinkedControl(b,target).phase,'available');
 assert.equal(jetCycle(target,o.time).phase,'charging');
});

test('treadles compress and recover inside the actual footprint; pause and reduced motion are stable',()=>{
 for(const width of [28,32])for(const [cx,cy]of [[0,0],[.4,.6],[100,70]]){
  const b=Object.freeze({x:100,y:100,width,height:8,changedAt:1000});
  const draw=(t:number,reduced=false)=>paint(c=>drawGuairaControlBase(c,b,cx,cy,t,reduced,'moving',.5));
  const initial=draw(999),poses=new Set();
  for(const t of [1000,1050,1100,1160]){
   const p=draw(t);poses.add(JSON.stringify([...p]));assert.deepEqual(p,draw(t));
   assert.equal(p.size,width*8);for(const key of p.keys()){const[x,y]=key.split(',').map(Number);
    assert.ok(x>=Math.round(b.x-cx)&&x<Math.round(b.x-cx)+width&&y>=Math.round(b.y-cy)&&y<Math.round(b.y-cy)+8);}
   assert.deepEqual(draw(t,true),draw(999,true),'motion preference cannot animate a stationary treadle');
  }
  assert.equal(poses.size,3);assert.deepEqual(draw(1160),initial);
 }
});

test('route transfer stays amber and functional states remain readable without decorative motion',()=>{
 const b={x:40,y:80,width:32,height:8},base=paint(c=>drawGuairaControlBase(c,b,0,0,0,true,'warning',.75));
 assert.ok([...base.values()].includes(P.working));assert.ok(![...base.values()].includes(P.ready));
 const states=[{kind:'bridge',phase:'available',progress:0},{kind:'bridge',phase:'moving',progress:.5},
  {kind:'bridge',phase:'settled',progress:1},{kind:'isolation',phase:'available',progress:0},
  {kind:'isolation',phase:'settled',progress:1}]as const;
 const poses=new Set();for(const state of states){
  const before=JSON.stringify({b,state}),draw=(time:number,reduced:boolean)=>paint(c=>drawGuairaControl(c,b,state,0,0,time,reduced));
  const p=draw(0,false);assert.deepEqual(p,draw(999999,true));assert.equal(JSON.stringify({b,state}),before);poses.add(JSON.stringify([...p]));
  for(const key of p.keys()){const[x,y]=key.split(',').map(Number);assert.ok(x>=40&&x<72&&y>=62&&y<88);}
 }
 assert.equal(poses.size,states.length,'state changes alter the etched mechanism, not only its colour');
});

test('all 18 hydraulic switches have a linked target, full footing and no collectible across their plaque',()=>{
 let count=0;
 for(const[id,factory]of Object.entries(factories)){
  const s=factory();for(const b of s.mechanisms!.filter(b=>b.kind==='switch')){
   count++;assert.ok(s.mechanisms!.some(t=>t.id===b.link),b.id);
   const foot=b.y+b.height;
   for(let x=b.x;x<b.x+b.width;x++)assert.ok(supportsStanding(s.level.tiles[foot/16]?.[Math.floor(x/16)]??0)||
    s.mechanisms!.some(t=>['support','lift','platform'].includes(t.kind)&&t.y===foot&&x>=t.x&&x<t.x+t.width),b.id+' unsupported');
   if(id==='prefeito')continue;
   for(const p of s.pickups)assert.ok(!(p.x<b.x+b.width/2+12&&p.x+16>b.x+b.width/2-12&&p.y<b.y-4&&p.y+18>b.y-18),b.id+' obscured by '+p.id);
  }
 }
 assert.equal(count,18);
});

test('four maintenance landings have a tile of preparation room on both sides and signs stay supported',()=>{
 const ids=['guaira-respiro-c-isolation',':workshop-grate:valve',':return-grate:valve',':independent-ramal:valve'];let count=0;
 for(const id of ['respiros','patio','alivio'] as const){
  const s=factories[id]();for(const b of s.mechanisms!.filter(b=>b.kind==='switch'&&ids.some(id=>b.id.endsWith(id)))){
   count++;for(let x=b.x-16;x<b.x+b.width+16;x++)assert.ok(supportsStanding(s.level.tiles[(b.y+b.height)/16]?.[Math.floor(x/16)]??0));
  }
  for(const d of guairaCourseDetours(id as GuairaCourseId))if(d.entrySignOffset){
   const sx=GUAIRA_COURSES[id].start+d.entry+d.entrySignOffset;
   for(let x=sx+7;x<sx+10;x++)assert.ok(supportsStanding(s.level.tiles[d.entryY/16]?.[Math.floor(x/16)]??0));
   for(const b of s.mechanisms!.filter(b=>b.kind==='switch'))assert.ok(!(sx-4<b.x+b.width/2+12&&sx+22>b.x+b.width/2-12&&d.entryY-32<b.y-4&&d.entryY-19>b.y-18));
  }
 }
 assert.equal(count,4);
});

test('relief seals cover precisely the real brittle tiles and disappear individually after breakage',()=>{
 const l=new WorldLevel(guairaReliefStage().level),draw=()=>paint(c=>drawReliefTerrain(c,l,200,100));
 const initial=draw();for(const col of [15,16,17]){
  const x=col*16-200;for(let yy=60;yy<76;yy++)for(let xx=x;xx<x+16;xx++)assert.ok(initial.has(`${xx},${yy}`));
  assert.equal(initial.get(`${x+5},64`),P.enamel);
 }
 l.data.tiles[10][16]=TileType.EMPTY;const open=draw();
 for(let yy=60;yy<76;yy++)for(let xx=56;xx<72;xx++)assert.equal(open.get(`${xx},${yy}`),undefined,'the relief hole cannot retain an ornamental rim');
 for(const col of [15,17])for(let yy=60;yy<76;yy++)for(let xx=col*16-200;xx<col*16-184;xx++)assert.equal(open.get(`${xx},${yy}`),initial.get(`${xx},${yy}`));
});
