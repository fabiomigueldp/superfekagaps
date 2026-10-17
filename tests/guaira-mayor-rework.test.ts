import assert from 'node:assert/strict';
import test from 'node:test';
import {GuairaMayorModel,MAYOR_ARENA as A,MAYOR_RULES as R,mayorOverlaps,type MayorAccess} from '../src/adventure/experimental/guaira/GuairaMayorModel';
import {guairaMayorBrowser} from './helpers/guairaMayorHarness';
import groundRoute from './helpers/guairaMayorGroundReplay.json';
import {drawGuairaMayorStampTarget} from '../src/adventure/experimental/guaira/GuairaMayorArt';
import type {Rect} from '../src/types';
const closed:MayorAccess={valveActive:false,liftReady:false,registerOpened:false};
const ready:MayorAccess={valveActive:true,liftReady:true,registerOpened:true};
function advance(m:GuairaMayorModel,n:number,a:MayorAccess=closed){for(let i=0;i<n;i++)m.update(R.tickMs,a);}
function next(m:GuairaMayorModel,state:string,a:MayorAccess=closed){for(let i=0;i<800;i++){m.update(R.tickMs,a);if(m.state===state)return;}assert.fail('state not reached: '+state);}
function strike(m:GuairaMayorModel){m.update(R.tickMs,ready);const p={x:m.opening.x,y:m.y-1,width:14,height:24};return m.contact(p,{...p,y:m.y-25},true);}
function secondPhase(){const m=new GuairaMayorModel();next(m,'recover');assert.equal(strike(m),'hit');next(m,'warning');return m;}

for(const x of [0,40,80,144,208,240,306])test(`aim at x=${x} locks a reachable landing and retains the entire warning`,()=>{
 const m=new GuairaMayorModel(),a={...closed,player:{x,y:200,width:14,height:24}};
 advance(m,R.intro+R.idle,a);const q=m.stampTarget;assert.ok(Object.isFrozen(q));
 assert.ok(q.x>=0&&q.x+q.width<=320);assert.ok([176,224,160].includes(q.y+q.height));
 const changed={...closed,player:{...a.player,x:306-x}};
 for(let i=0;i<R.warning+R.leap;i++){
  assert.equal(m.stampTarget,q);assert.equal(m.danger,null);assert.equal(m.vulnerable,false);m.update(R.tickMs,changed);
 }
 assert.equal(m.state,'stamp');assert.equal(m.danger,q);assert.equal(m.y+m.height,q.y+q.height);
 assert.ok(Math.abs(m.x+m.width/2-q.x-q.width/2)<1e-6);
 const p={x:q.x+2,y:q.y+q.height-12,width:8,height:12};
 assert.equal(m.contact(p,p,false),'hurt');assert.equal(m.contact({...p,x:q.x-8},p,false),'none');
 advance(m,R.stamp);assert.equal(m.danger,null);next(m,'recover');assert.equal(m.x,264);assert.equal(m.y,120);
});

test('phase escalation adds moving pressure then a second independently locked strike',()=>{
 const m=secondPhase();const firstTarget=m.stampTarget;
 next(m,'returning');assert.equal(m.waves.length,2);assert.equal(m.phaseNumber,2);
 const waves=m.waves;advance(m,1);
 assert.ok(m.waves[0].x<waves[0].x&&m.waves[1].x>waves[1].x);assert.ok(Object.isFrozen(waves[0]));
 next(m,'recover');assert.equal(strike(m),'hit');assert.equal(m.waves.length,0);
 next(m,'warning',{...closed,player:{x:80,y:200,width:14,height:24}});assert.equal(m.phaseNumber,3);assert.equal(m.strike,1);
 next(m,'stamp');assert.equal(m.canOpenRegister,false);m.update(R.tickMs,ready);assert.equal(m.registerOpenedThisCycle,false);
 next(m,'warning',{...closed,player:{x:248,y:136,width:14,height:24}});assert.equal(m.strike,2);assert.equal(m.stateTick,0);
 const secondTarget=m.stampTarget;assert.notDeepEqual(firstTarget,secondTarget);
 assert.equal(m.warningDuration,42);advance(m,R.secondWarning+R.secondLeap);assert.equal(m.danger,secondTarget);
 assert.equal(m.canOpenRegister,true);next(m,'returning');assert.equal(m.waves.length,2);
 const x=m.waves[0].x;advance(m,1);assert.ok(Math.abs(m.waves[0].x-x+2.6)<1e-6);
});

test('waves hurt only their visible moving bounds, expire at the edge, and fresh pressure diverts them',()=>{
 for(const divert of [false,true]){
  const m=secondPhase();next(m,'returning');const saved=m.waves;
  const p={x:saved[0].x+2,y:206,width:8,height:18};assert.equal(m.contact(p,p,false),'hurt');
  assert.equal(m.contact({...p,y:182},p,false),'none','a jump above the crest is safe');
  if(divert){m.update(R.tickMs,ready);assert.equal(m.waves.length,0);assert.ok(m.events.some(e=>e.kind==='drain'));assert.equal(m.accessRequested,true);}
  else{advance(m,160);assert.equal(m.waves.length,0);assert.equal(m.registerOpenedThisCycle,false);}
  assert.equal(saved[0].age,0,'previous snapshots never move');
 }
});

test('an early valve can suppress the final pressure wave but cannot skip the last double strike',()=>{
 const m=secondPhase();next(m,'stamp');m.update(R.tickMs,ready);next(m,'returning',{...ready,registerOpened:false});
 assert.equal(m.waves.length,0);next(m,'recover',ready);assert.equal(strike(m),'hit');
 next(m,'stamp');m.update(R.tickMs,ready);assert.equal(m.accessRequested,false);
 next(m,'warning');assert.equal(m.strike,2);assert.equal(m.accessRequested,false);
});

for(const touch of [false,true])for(const reducedMotion of [false,true])test(`ground route: jump pressure, drain the lower register and win with ${touch?'touch':'keyboard'}, reduced=${reducedMotion}`,t=>{
 const h=guairaMayorBrowser(t,{touch,reducedMotion}),g=h.create();let n=0,overWave=0,carried=0,drained=0;
 const hits:number[]=[],stampXs:number[]=[],valves=new Set<number>();let seals=3;
 for(const [count,keys]of groundRoute.runs as Array<[number,string[]]>){
  if(touch)h.canvas.dispatch('touchstart',{touches:keys.map((k,i)=>({identifier:i+1,target:h.canvas,clientX:(k==='ArrowLeft'?.07:k==='ArrowRight'?.22:k==='ArrowDown'?.5:.93)*640,clientY:330}))});else h.keys(keys);
  for(let i=0;i<count;i++){
   g.update(R.tickMs);n++;const m=g.mayor,p=g.player.getRect(),lift=g.objects.get(A.liftId)!;
   assert.equal(g.player.data.hasHelmet,true,`helmet frame ${n}`);assert.equal(g.player.data.isDead,false);
   if(m.sealsRemaining<seals){hits.push(n);seals=m.sealsRemaining;}
   if(m.events.some(e=>e.kind==='stamp'))stampXs.push(m.x);
   if(m.events.some(e=>e.kind==='drain'))drained++;
   for(const w of m.waves)if(p.x<w.x+w.width&&p.x+p.width>w.x&&p.y+p.height<=w.y)overWave++;
   if(g.player.data.isGrounded&&Math.abs(p.y+p.height-lift.y)<1e-6&&lift.y!==lift.py)carried++;
   for(const e of g.objects.events)if(e.kind==='switch')valves.add(e.x);
  }
 }
 assert.deepEqual(hits,groundRoute.hitFrames);assert.equal(g.mayor.publicWaterOpen,true);
 assert.ok(overWave>3,'Feka actually cleared the travelling water');assert.ok(carried>30,'real lift carry in both lower routes');
 assert.ok(drained>=1);assert.ok(stampXs.some(x=>x>100&&x<200));
 assert.deepEqual([...valves].sort((a,b)=>a-b),[A.valve.x,A.upperValve.x]);
 assert.equal(g.mayor.dangers.length,0);assert.ok(g.player.data.position.x<50);g.render();
});

for(const offset of [-8,-4,0,4,8])for(const held of [10,14,18])test(`ground wave timing: ${offset} ticks, ${held} held jump ticks`,t=>{
 const h=guairaMayorBrowser(t),g=h.create();const runs=structuredClone(groundRoute.runs) as Array<[number,string[]]>;
 const lead = runs.findIndex(([n, keys]) => n === 78 && keys.length === 0);
 assert.ok(lead > 0);runs[lead][0]+=offset;runs[lead+1][0]=held;runs[lead+4][0]-=offset+held-14;
 const safe = offset < 8 && (held === 18 || offset >= -4 && held === 14 || offset === 4);
 let firstDamage = 0, frame=0;
 for(const [count,keys]of runs){h.keys(keys);for(let i=0;i<count;i++){
  g.update(R.tickMs);frame++;
  if(!g.player.data.hasHelmet&&!firstDamage){firstDamage=frame;
   assert.ok(g.mayor.waves.some(w=>mayorOverlaps(w,g.player.getRect())), 'only contact with the visible crest punishes an early dive or late jump');
  }
 }}
 assert.equal(firstDamage===0,safe);
 if(safe)assert.equal(g.mayor.publicWaterOpen,true);
});

test('stepped splash and curled waves have no painted-safe holes or invisible lethal corners',()=>{
 const stamp=new GuairaMayorModel();next(stamp,'stamp');
 const waves=secondPhase();next(waves,'returning');
 for(const m of [stamp,waves])for(const reduced of [false,true]){
  const pixels=new Set<string>();let paths:Rect[]=[],clips:Rect[][]=[];const stack:Rect[][][]=[];
  const c={fillStyle:'',save(){stack.push([...clips]);},restore(){clips=stack.pop()!;},beginPath(){paths=[];},
   rect(x:number,y:number,width:number,height:number){paths.push({x,y,width,height});},clip(){clips=[...clips,paths];},
   fillRect(x:number,y:number,w:number,h:number){
    assert.ok([x,y,w,h].every(Number.isInteger));
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(clips.every(group=>group.some(q=>xx>=q.x&&xx<q.x+q.width&&yy>=q.y&&yy<q.y+q.height)))pixels.add(`${xx},${yy}`);
   }};
  const before=JSON.stringify(m);drawGuairaMayorStampTarget(c as unknown as CanvasRenderingContext2D,m,0,0,reduced);
  assert.equal(JSON.stringify(m),before);assert.equal(stack.length,0);
  for(let y=190;y<226;y++)for(let x=0;x<320;x++){
   const p={x:x+.1,y:y+.1,width:.8,height:.8};
   assert.equal(m.contact(p,p,false)==='hurt',pixels.has(`${x},${y}`),`paint/contact at ${x},${y}`);
  }
  assert.ok(pixels.size>200);
  const bounds=m.state==='stamp'?m.stampTarget:m.waves[0];
  assert.equal(pixels.has(`${bounds.x},${bounds.y}`),false,'upper outer corners are visibly and physically empty');
 }
});

test('native valve pair resets on each tell and hit-stop cannot replay the water sound',t=>{
 const h=guairaMayorBrowser(t),g=h.create(),sounds:string[]=[];t.mock.method(g.audio,'sfx',(kind:string)=>{sounds.push(kind);});
 for(const id of [A.valveId,A.upperValveId]){
  h.keys([]);g.load(A.id);g.objects.activate(id);g.boss!.update(R.tickMs,g.player.getRect(),g.objects,g.level);
  assert.equal(g.objects.get(A.valveId)!.active,true);assert.equal(g.objects.get(A.upperValveId)!.active,true);assert.equal(g.objects.get(A.liftId)!.active,true);
  h.run(g,R.intro+R.idle-1);assert.equal(g.mayor.state,'warning');
  for(const id of [A.valveId,A.upperValveId,A.liftId])assert.equal(g.objects.get(id)!.active,false);
  h.run(g,20);assert.equal(g.objects.activate(id),true);
  g.boss!.update(R.tickMs,g.player.getRect(),g.objects,g.level);
  assert.equal(g.objects.get(A.liftId)!.active,false,'premature toggles cannot raise a platform through the committed landing');
  h.run(g,R.warning+R.leap-21);
  assert.equal(g.mayor.state,'stamp');assert.equal(g.objects.get(A.liftId)!.y,A.floor);
 }
 h.keys([]);g.load(A.id);sounds.length=0;
 for(const [count,keys]of groundRoute.runs as Array<[number,string[]]>){h.run(g,count,keys);}
 // Four impacts, two waves, five salvo shots, three rush beats (including
 // simultaneous balcony shots) and one seam discharge. No duplicate launch cue.
 assert.equal(sounds.filter(s=>s==='jet').length,15);
 const before=sounds.length;g.toggleLabPause();h.run(g,60);g.render();assert.equal(sounds.length,before);
});
