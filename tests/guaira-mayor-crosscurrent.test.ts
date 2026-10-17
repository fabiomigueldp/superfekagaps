import assert from 'node:assert/strict';
import test from 'node:test';
import {GuairaMayorModel,MAYOR_ARENA as A,MAYOR_RULES as R,mayorOverlaps,type MayorAccess} from '../src/adventure/experimental/guaira/GuairaMayorModel';
import {drawGuairaMayorStampTarget} from '../src/adventure/experimental/guaira/GuairaMayorArt';
import {guairaMayorBrowser} from './helpers/guairaMayorHarness';
import interrupt from './helpers/guairaMayorInterruptReplay.json';
import full from './helpers/guairaMayorReplay.json';
import ground from './helpers/guairaMayorGroundReplay.json';
import type {Rect} from '../src/types';
const closed:MayorAccess={valveActive:false,liftReady:false,registerOpened:false};
const opened:MayorAccess={valveActive:true,liftReady:true,registerOpened:true};
function advance(m:GuairaMayorModel,n:number,a=closed){for(let i=0;i<n;i++)m.update(R.tickMs,a);}
function until(m:GuairaMayorModel,state:string,a=closed){for(let i=0;i<1200;i++){m.update(R.tickMs,a);if(m.state===state)return;}assert.fail('missing '+state);}
function hit(m:GuairaMayorModel){const p={x:m.opening.x,y:m.y-1,width:14,height:24};return m.contact(p,{...p,y:m.y-25},true);}
function phase(n:number){const m=new GuairaMayorModel();for(let i=1;i<n;i++){until(m,'recover');m.update(R.tickMs,opened);assert.equal(hit(m),'hit');}until(m,'jetWarning');return m;}

for(const n of [2,3])test(`seal ${n}: every high/low shot has its own complete, non-tracking tell`,()=>{
 const m=phase(n),sequence:Array<[string,number]>=[];
 while(m.state==='jetWarning'){
  const cue=m.salvo!;assert.ok(Object.isFrozen(cue)&&Object.isFrozen(cue.rect));
  assert.equal(cue.phase,'warning');sequence.push([cue.lane,cue.direction]);
  const oldJets=m.jets;
  for(let i=0;i<m.jetWarningDuration;i++){
   assert.equal(m.salvo!.shot,cue.shot);assert.deepEqual(m.salvo!.rect,cue.rect);
   assert.equal(m.salvo!.progress,i/m.jetWarningDuration);
   m.update(R.tickMs,{...closed,player:{x:i%2?0:306,y:20,width:14,height:24}});
  }
  assert.equal(m.state,'jetBurst');assert.equal(m.events.filter(e=>e.kind==='jet').length,1);
  assert.equal(m.jets.at(-1)!.age,0);assert.equal(m.jets.at(-1)!.direction,cue.direction);
  assert.ok(oldJets.every(j=>Object.isFrozen(j)));advance(m,m.jetBeatDuration);
 }
 assert.deepEqual(sequence,n===2?[['high',-1],['low',1]]:[['low',1],['high',-1],['low',-1]]);
 assert.equal(m.state,'vault');until(m,'warning');assert.equal(m.strike,1,'ignoring the registers leads through pursuit to the aimed attack');
 until(m,'recover');assert.equal(m.jets.length,0);assert.equal(m.vulnerable,false);
});

test('a fresh sentada cuts water but retains pursuit and requires a new opening after the physical combo',()=>{
 const m=phase(2);m.update(R.tickMs,opened);assert.equal(m.registerOpenedThisCycle,false);assert.equal(m.state,'jetWarning');
 until(m,'jetBurst',{...opened,registerOpened:false});assert.equal(m.jets.length,1);
 advance(m,5,{...opened,registerOpened:false});assert.equal(m.state,'jetBurst');
 const packet=m.jets[0];m.update(R.tickMs,{...opened,liftReady:false});
 assert.equal(m.state,'vault');assert.equal(m.pressureInterrupted,true);assert.equal(m.jets.length,0);
 assert.equal(m.dangers.length,0);assert.equal(m.vulnerable,false);assert.equal(m.events.filter(e=>e.kind==='interrupt').length,1);
 assert.equal(packet.age,5,'previous snapshots cannot be drained retroactively');
 until(m,'recover',{...opened,registerOpened:false});assert.equal(m.vulnerable,false);
 assert.equal(m.registerOpenedThisCycle,false,'the interrupted valve is not a fresh post-combo opening');
 m.update(R.tickMs,opened);assert.equal(m.vulnerable,true);
 advance(m,90,{...opened,registerOpened:false});assert.equal(m.counterpressure,null,'the interruption spends the seam attack');
 assert.equal(hit(m),'hit');assert.equal(m.sealsRemaining,1);
});

test('missing an interrupt or its top hit never soft-locks the next attack',()=>{
 const m=phase(3);until(m,'jetBurst');m.update(R.tickMs,opened);assert.equal(m.pressureInterrupted,true);
 until(m,'recover',{...opened,registerOpened:false});
 advance(m,R.recover-m.stateTick,{...opened,registerOpened:false});assert.equal(m.state,'idle');
 until(m,'jetWarning',{...opened,registerOpened:false});assert.equal(m.pressureInterrupted,false);
 assert.equal(m.salvo!.shot,1);assert.equal(m.registerOpenedThisCycle,false);
 for(const dt of [0,-1,NaN,Infinity]){const before=JSON.stringify(m);m.update(dt,opened);assert.equal(JSON.stringify(m),before);}
 m.update(10000,closed);assert.equal(m.state,'jetWarning');assert.equal(m.stateTick,6,'a resumed frame cannot consume the warning');
});

test('solid jet pixels and contact agree, including empty corners and passage above/below the lane',()=>{
 const m=phase(2);
 for(const shot of [1,2]){
  until(m,'jetBurst');advance(m,20);
  for(const reduced of [false,true]){
   const pixels=new Set<string>();let paths:Rect[]=[],clips:Rect[][]=[];const stack:Rect[][][]=[];
   const c={fillStyle:'',save(){stack.push([...clips]);},restore(){clips=stack.pop()!;},beginPath(){paths=[];},
    rect(x:number,y:number,width:number,height:number){paths.push({x,y,width,height});},clip(){clips=[...clips,paths];},
    fillRect(x:number,y:number,w:number,h:number){assert.ok([x,y,w,h].every(Number.isInteger));
     for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(clips.every(group=>group.some(q=>xx>=q.x&&xx<q.x+q.width&&yy>=q.y&&yy<q.y+q.height)))pixels.add(`${xx},${yy}`);
    }};
   const before=JSON.stringify(m);drawGuairaMayorStampTarget(c as unknown as CanvasRenderingContext2D,m,0,0,reduced);
   assert.equal(JSON.stringify(m),before);assert.equal(stack.length,0);
   for(let y=140;y<226;y++)for(let x=0;x<320;x++){
    const p={x:x+.1,y:y+.1,width:.8,height:.8};
    assert.equal(m.contact(p,p,false)==='hurt',pixels.has(`${x},${y}`),`shot ${shot} ${x},${y}`);
   }
   assert.ok(pixels.size>350);
  }
  if(shot===1)until(m,'jetWarning');
 }
});

for(const touch of [false,true])for(const reducedMotion of [false,true])test(`two native interrupts win through both registers: touch=${touch}, reduced=${reducedMotion}`,t=>{
 const h=guairaMayorBrowser(t,{touch,reducedMotion}),g=h.create();let frame=0,seals=3,stamps=0,shots=0;
 const hits:number[]=[],cuts:Array<{frame:number,valve:number}>=[];
 for(const [count,keys]of interrupt.runs as Array<[number,string[]]>){
  if(touch)h.canvas.dispatch('touchstart',{touches:keys.map((key,i)=>({identifier:i+1,target:h.canvas,clientX:(key==='ArrowLeft'?.07:key==='ArrowRight'?.22:key==='ArrowDown'?.5:.93)*640,clientY:330}))});else h.keys(keys);
  for(let i=0;i<count;i++){
   g.update(R.tickMs);frame++;const m=g.mayor;
   assert.equal(g.player.data.hasHelmet,true,`frame ${frame}`);assert.equal(g.player.data.isDead,false);
   assert.ok(Math.round(g.player.data.position.y)-Math.round(g.camera.y)-4>=26);
   if(m.events.some(e=>e.kind==='stamp'))stamps++;
   if(m.events.some(e=>e.kind==='jet'))shots++;
   if(m.events.some(e=>e.kind==='interrupt')){
    cuts.push({frame,valve:g.objects.events.find(e=>e.kind==='switch')!.x});
    assert.equal(m.jets.length,0);assert.equal(m.dangers.length,0);assert.equal(m.counterpressure,null);
   }
   if(m.sealsRemaining<seals){hits.push(frame);seals=m.sealsRemaining;}
  }
 }
 assert.deepEqual(hits,interrupt.hitFrames);assert.deepEqual(cuts.map(c=>c.valve),[A.upperValve.x,A.valve.x]);
 assert.equal(stamps,4,'cuts retain all aimed physical attacks');assert.equal(shots,2);
 assert.ok(hits[2]<full.hitFrames[2]-150,'cutting the volleys earns a faster and hydraulically safer victory');
 assert.equal(g.mayor.publicWaterOpen,true);assert.deepEqual(g.store.save.completed,[]);assert.deepEqual(h.storageCalls,[]);
});

for(const at of [525,548,600])test(`native pause, blur, retry freeze or clear a volley at ${at}`,t=>{
 const h=guairaMayorBrowser(t),g=h.create();let n=0;
 for(const [count,keys]of full.runs as Array<[number,string[]]>){h.run(g,Math.min(count,at-n),keys);n+=Math.min(count,at-n);if(n===at)break;}
 assert.ok(g.mayor.salvo);h.keys([]);
 for(const pause of [()=>g.toggleLabPause(),()=>h.window.dispatch('blur')]){
  pause();const before=JSON.stringify({m:g.mayor,p:g.player.data,o:g.objects});h.run(g,90);g.render();
  assert.equal(JSON.stringify({m:g.mayor,p:g.player.data,o:g.objects}),before);g.toggleLabPause();
 }
 g.load(A.id);assert.equal(g.mayor.state,'intro');assert.equal(g.mayor.salvo,null);assert.equal(g.mayor.jets.length,0);
});

for(const [offset,safe]of [[-24,false],[-6,true],[0,true],[12,true],[20,false]] as const)
 test(`the low jet tolerates a deliberate jump at ${offset} ticks; missing the visible packet takes damage`,t=>{
  const h=guairaMayorBrowser(t),g=h.create();let frame=0;
  for(const [count,keys]of ground.runs as Array<[number,string[]]>){const n=Math.min(count,495-frame);h.run(g,n,keys);frame+=n;if(frame===495)break;}
  const step=(n:number,keys:string[]=[])=>{h.keys(keys);for(let i=0;i<n;i++){
   const helmet=g.player.data.hasHelmet;g.update(R.tickMs);
   if(helmet&&!g.player.data.hasHelmet)assert.ok(g.mayor.dangers.some(q=>mayorOverlaps(q,g.player.getRect())),'the actual visible packet caused the missed dodge');
  }};
  step(154+offset);step(14,['Space']);step(57-offset);
  assert.equal(g.player.data.hasHelmet,safe);assert.equal(g.player.data.isDead,false);
  assert.equal(g.mayor.sealsRemaining,2,'no health or completion shortcut was used');
  assert.equal(g.mayor.state,'rushWarning');
 });
