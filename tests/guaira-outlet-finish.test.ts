import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldObjects, WorldLevel } from '../src/adventure/WorldPhysics';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { TileType } from '../src/constants';
import { drawGuairaVentDrops, drawGuairaPressureResidue } from '../src/adventure/experimental/guaira/GuairaFluidArt';
import { drawGuairaDrainSurface, drawGuairaSpoutFlow } from '../src/adventure/experimental/guaira/GuairaWaterworksArt';
import { drawGuairaPressureOutlet, drawRespirosObjects } from '../src/adventure/experimental/guaira/respiros/GuairaRespirosArt';
import { guairaRespirosStage } from '../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import { guairaReliefStage, GUAIRA_RELIEF as G } from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';
import { drawReliefBackground, drawReliefObjects } from '../src/adventure/experimental/guaira/relief/GuairaReliefArt';
import { drawGuairaMayorBackground } from '../src/adventure/experimental/guaira/GuairaMayorArenaArt';
import { GuairaMayorModel } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { drawMayorReserve } from '../src/adventure/experimental/guaira/GuairaMayorTownArt';

function paint(draw:(c:CanvasRenderingContext2D)=>void){
 const pixels=new Map<string,string>();let bounds=[-4096,-4096,4096,4096],pending=bounds;
 const stack:Array<{fill:string;bounds:number[];alpha:number;composite:string}>=[];
 const c={fillStyle:'#123456',globalAlpha:.7,globalCompositeOperation:'multiply',
  save(){stack.push({fill:this.fillStyle,bounds:[...bounds],alpha:this.globalAlpha,composite:this.globalCompositeOperation});},
  restore(){const s=stack.pop()!;bounds=s.bounds;this.fillStyle=s.fill;this.globalAlpha=s.alpha;this.globalCompositeOperation=s.composite;},
  beginPath(){},rect(x:number,y:number,w:number,h:number){pending=[x,y,x+w,y+h];},
  clip(){bounds=bounds.map((v,i)=>i<2?Math.max(v,pending[i]):Math.min(v,pending[i]));},
  fillRect(x:number,y:number,w:number,h:number){assert.ok([x,y,w,h].every(Number.isInteger));
   for(let yy=Math.max(y,bounds[1]);yy<Math.min(y+h,bounds[3]);yy++)
    for(let xx=Math.max(x,bounds[0]);xx<Math.min(x+w,bounds[2]);xx++)pixels.set(`${xx},${yy}`,this.fillStyle);
  }};
 draw(c as unknown as CanvasRenderingContext2D);assert.equal(stack.length,0);assert.equal(c.globalAlpha,.7);assert.equal(c.globalCompositeOperation,'multiply');
 return pixels;
}
const residue=(p:Map<string,string>)=>new Map([...p].filter(([,color])=>['#cad6c4','#a4b6a7'].includes(color)).sort());

test('vent droplets arc back into their own grate, settle separately and leave every safe bank clear',()=>{
 for(const width of [4,13.25,80,96,176])for(const fraction of [0,.25,.75])for(let ms=0;ms<350;ms+=5){
  const left=40.25-fraction,mouth=180.75-fraction;
  const p=paint(c=>drawGuairaVentDrops(c,left,mouth,width,1-ms/350,false));
  assert.ok(p.size<=8,'sparse droplets, never a curtain');
  for(const[key,color]of p){const[x,y]=key.split(',').map(Number);
   assert.ok(x>left&&x<left+width-1&&y>=Math.floor(mouth)-8&&y<Math.floor(mouth));
   assert.ok(['#cad6c4','#a4b6a7'].includes(color));
  }
 }
 const firstY=(ms:number)=>Math.min(...[...paint(c=>drawGuairaVentDrops(c,40,180,100,1-ms/350,false)).keys()]
  .map(k=>k.split(',').map(Number)).filter(([x])=>x<70).map(([,y])=>y));
 assert.ok(firstY(90)<firstY(0));assert.ok(firstY(220)>firstY(90),'a droplet returns instead of drifting upward forever');
 const count=(ms:number)=>paint(c=>drawGuairaVentDrops(c,40,180,100,1-ms/350,false)).size;
 assert.ok(count(310)<count(180));assert.equal(count(349),0);
 for(const vent of [0,-1,1.1,NaN])assert.equal(paint(c=>drawGuairaVentDrops(c,40,180,96,vent,false)).size,0);
 assert.equal(paint(c=>drawGuairaVentDrops(c,40,180,96,.5,true)).size,0);
});

test('original, expanded and relief outlets render the same native residual arcs, without a presentation clock',()=>{
 for(const scene of ['respiros','alivio']as const){
  const stage=scene==='respiros'?guairaRespirosStage():guairaReliefStage();
  const objects=new WorldObjects(scene==='respiros'?stage.mechanisms!.slice(0,1):stage.mechanisms);
  const b=scene==='respiros'?objects.bodies[0]:objects.get(G.jetId)!;
  const cx=b.x-80,cy=b.y+b.height-164;
  for(const tick of [2510,2580,2650,2750,2840]){
   objects.time=(tick/4200+1)*(b.period??4200)-(b.phase??0);
   const before=JSON.stringify(objects);
   const core=paint(c=>scene==='respiros'?drawRespirosObjects(c,objects,cx,cy,-99999,false):drawReliefObjects(c,objects,cx,cy,false));
   const common=paint(c=>drawGuairaPressureOutlet(c,b,cx,cy,objects.time,false));
   assert.deepEqual(residue(core),residue(common));assert.equal(JSON.stringify(objects),before);
   if(tick===2650)assert.ok(residue(core).size>0);
  }
 }
});

test('expanded outlets inherit isolation drops, expire them and discard a previous shutdown on reopening',()=>{
 const objects=new WorldObjects(guairaRespirosStage().mechanisms!.slice(0,1)),b=objects.bodies[0];
 b.active=true;b.jetShutdown={at:2100,height:128};
 const draw=(time:number,reduced=false)=>residue(paint(c=>drawGuairaPressureOutlet(c,b,80,144,time,reduced)));
 assert.equal(draw(2100).size,8);assert.ok(draw(2250).size>0);assert.equal(draw(2400).size,0);assert.equal(draw(2150,true).size,0);
 b.active=false;b.jetOpenedAt=2150;
 assert.equal(draw(2150).size,0,'new native warning starts clean');
 const before=JSON.stringify(b),p=paint(c=>drawGuairaPressureResidue(c,b,jetCycle(b,2200),80,144,2200,false));
 assert.equal(p.size,0);assert.equal(JSON.stringify(b),before);
});

test('small spill streaks descend continuously through their seam and stay in the three-pixel mouth',()=>{
 const draw=(time:number,reduced=false)=>paint(c=>drawGuairaSpoutFlow(c,30,40,54,time,reduced));
 for(let step=0;step<23;step++){
  const a=draw(step*28),b=draw((step+1)*28);
  for(let y=41;y<54;y++)assert.equal(b.get(`31,${y}`),a.get(`31,${y-1}`));
  for(const key of b.keys()){const[x,y]=key.split(',').map(Number);assert.ok(x>=30&&x<33&&y>=40&&y<54);}
 }
 assert.deepEqual(draw(0,true),draw(98765,true));
});

test('receiving currents originate at their intake, stay submerged and keep moving through repeat seams',()=>{
 const draw=(time:number,reduced=false)=>paint(c=>drawGuairaDrainSurface(c,10,110,40,63,time,reduced));
 for(const t of [2100,2200,2300,2400]){
  const a=draw(t),b=draw(t+100);
  for(let x=12;x<54;x++)assert.equal(b.get(`${x},40`),a.get(`${x+1},40`));
  for(let x=72;x<108;x++)assert.equal(b.get(`${x},40`),a.get(`${x-1},40`));
  for(const key of b.keys()){const[x,y]=key.split(',').map(Number);assert.ok(x>=10&&x<110&&y>=40&&y<44);}
 }
 assert.deepEqual(draw(0,true),draw(99999,true));
});

test('relief sump ripples stay behind the screen and the actual release owns every wet pixel',()=>{
 const level=new WorldLevel(guairaReliefStage().level);
 const area=(p:Map<string,string>)=>new Map([...p].filter(([key])=>{const[x,y]=key.split(',').map(Number);return x>=296&&x<343&&y>=283&&y<287;}));
 const draw=(time:number,reduced=false)=>paint(c=>drawReliefBackground(c,level,200,176,time,reduced));
 const world=(time:number,reduced=false)=>new Map([...draw(time,reduced)].map(([k,v])=>{const[x,y]=k.split(',').map(Number);return[`${x+200},${y+176}`,v];}));
 assert.deepEqual(area(world(0)),area(world(500)));
 level.data.tiles[10][15]=TileType.EMPTY;
 const a=world(0),b=world(500);assert.notDeepEqual(area(a),area(b));
 for(const x of [297,305,313,321,329,337])for(let y=281;y<290;y++)assert.equal(a.get(`${x},${y}`),'#8c7157');
 assert.deepEqual(area(world(0,true)),area(world(500,true)));
});

test('public spout reaches the basin only after release, its feet meet the real floor and its water never covers that floor',()=>{
 const mayor=new GuairaMayorModel();
 const draw=(time:number,reduced=false)=>paint(c=>drawGuairaMayorBackground(c,mayor,0,64,time,reduced));
 const wet=new Set(['#80afa7','#62958e','#bad0b5']);
 for(const seals of [3,2,1,0]){
  mayor.sealsRemaining=seals;const p=draw(0);
  for(let y=209;y<213;y++)assert.ok(!wet.has(p.get(`36,${y-64}`)!));
 }
 mayor.state='released';const before=JSON.stringify(mayor);
 for(const time of [0,100,500]){
  const p=draw(time);
  for(let y=202;y<213;y++)assert.ok(wet.has(p.get(`36,${y-64}`)!),'no gap between pipe, mouth and receiving surface');
  for(const x of [20,87])for(let y=220;y<224;y++)assert.ok(['#b49b75','#8f775a'].includes(p.get(`${x},${y-64}`)!));
  for(let x=10;x<102;x++)assert.ok(!wet.has(p.get(`${x},160`)!),'floor y224 stays clear');
 }
 assert.deepEqual(draw(0,true),draw(99999,true));assert.equal(JSON.stringify(mayor),before);
});

test('reserve glass reflection enters and leaves through its edges instead of jumping from bottom to top',()=>{
 const draw=(time:number,reduced=false)=>paint(c=>drawMayorReserve(c,0,64,time,reduced,false));
 for(let step=0;step<24;step++){
  const a=draw(step*100),b=draw((step+1)*100);
  for(let y=187;y<194;y++)assert.equal(b.get(`290,${y-64}`)==='#b4cbb0',a.get(`290,${y-1-64}`)==='#b4cbb0');
  for(const[key,color]of b)if(color==='#b4cbb0'){const[x,y]=key.split(',').map(Number);assert.ok(x===290&&y>=122&&y<130);}
 }
 assert.deepEqual(draw(0,true),draw(99999,true));
});
