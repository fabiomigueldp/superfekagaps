import test from 'node:test';
import assert from 'node:assert/strict';
import {drawGuairaRisingWater,drawGuairaDrainDrops} from '../src/adventure/experimental/guaira/GuairaFluidArt';
import {drawGuairaPipe,drawGuairaPipeFlow,guairaPipeRoute,GUAIRA_PIPE_COLORS as P} from '../src/adventure/experimental/guaira/GuairaPipeArt';
import {drawGuairaSluiceFlow,drawGuairaPoolDepth} from '../src/adventure/experimental/guaira/GuairaWaterworksArt';

class Pixels {
 fillStyle='';globalAlpha=1;globalCompositeOperation='source-over';pixels=Array<string>(320*180).fill('');
 bounds=[0,0,320,180];pending=this.bounds;stack:Array<{fillStyle:string;globalAlpha:number;globalCompositeOperation:string;bounds:number[]}>=[];
 save(){this.stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,bounds:this.bounds});}
 restore(){Object.assign(this,this.stack.pop());}beginPath(){}
 rect(x:number,y:number,w:number,h:number){this.pending=[x,y,x+w,y+h];}
 clip(){this.bounds=this.bounds.map((v,i)=>i<2?Math.max(v,this.pending[i]):Math.min(v,this.pending[i]));}
 fillRect(x:number,y:number,w:number,h:number){
  assert.ok([x,y,w,h].every(Number.isInteger));const l=Math.max(x,this.bounds[0]),r=Math.min(x+w,this.bounds[2]);
  if(r<=l)return;for(let yy=Math.max(y,this.bounds[1]);yy<Math.min(y+h,this.bounds[3]);yy++)this.pixels.fill(this.fillStyle,yy*320+l,yy*320+r);
 }
 get c(){return this as unknown as CanvasRenderingContext2D;}at(x:number,y:number){return this.pixels[y*320+x];}
}
const W={body:'#40b8cb',shade:'#329eb7',foam:'#c6f0df',light:'#76d7df',edge:'#267f98'};
const danger={x:60,y:30,width:96,height:128};
const paint=(draw:(c:CanvasRenderingContext2D)=>void)=>{const p=new Pixels();draw(p.c);assert.equal(p.stack.length,0);assert.equal(p.fillStyle,'');return p;};

for(const [name,minimum,draw]of [
 ['pipe',7,(c:CanvasRenderingContext2D,t:number)=>drawGuairaPipe(c,30,60,180,true,t,false)],
 ['fall',8,(c:CanvasRenderingContext2D,t:number)=>drawGuairaSluiceFlow(c,40,30,165,true,t,false)],
 ['pressure',9,(c:CanvasRenderingContext2D,t:number)=>drawGuairaRisingWater(c,danger,t,0,0,false,W)],
]as const)test(`${name}: flow advances visibly throughout a 60 Hz frame sequence`,()=>{
 const poses=new Set<string>();for(let frame=0;frame<15;frame++)poses.add(paint(c=>draw(c,frame*1000/60)).pixels.join(','));
 assert.ok(poses.size>=minimum,`${poses.size} unique poses: liquid should not hold for the old 70–140ms steps`);
});

test('pressure ribbons remain rooted at the nozzle as the live height and camera change',()=>{
 const full=paint(c=>drawGuairaRisingWater(c,danger,2176,0,0,false,W));
 const short={...danger,y:80,height:78},before=JSON.stringify(short);
 const clipped=paint(c=>drawGuairaRisingWater(c,short,2176,0,0,false,W));
 const shifted=paint(c=>drawGuairaRisingWater(c,short,2176,17,11,false,W));
 for(let y=81;y<158;y++)for(let x=60;x<156;x++){
  assert.equal(clipped.at(x,y),full.at(x,y),'raising the water front must not drag its texture');
  assert.equal(shifted.at(x-17,y-11),clipped.at(x,y));
 }
 assert.equal(JSON.stringify(short),before);
 assert.deepEqual(paint(c=>drawGuairaRisingWater(c,danger,0,0,0,true,W)).pixels,paint(c=>drawGuairaRisingWater(c,danger,99000,0,0,true,W)).pixels);
});

test('local sight glass and a complete network have identical source-to-outlet phase in every direction',()=>{
 for(const vertical of [false,true])for(const direction of [-1,1]as const)for(const time of [0,17,32,608,640,10001]){
  const start=direction===1?0:62,end=direction===1?62:0;
  const route=guairaPipeRoute(vertical?[[64,60+start],[64,60+end]]:[[60+start,64],[60+end,64]]);
  const local=paint(c=>drawGuairaPipe(c,60,60,63,true,time,false,vertical,direction));
  const network=paint(c=>{drawGuairaPipe(c,60,60,63,true,time,false,vertical,direction,false);drawGuairaPipeFlow(c,route,0,0,time,false);});
  assert.deepEqual(local.pixels,network.pixels);
 }
});

test('short pipe ferrules leave every inspection pixel open, wet or dry',()=>{
 for(const length of [7,12,65])for(const vertical of [false,true])for(const wet of [false,true]){
  const p=paint(c=>drawGuairaPipe(c,60,60,length,wet,0,true,vertical,1,false));
  for(let along=0;along<length;along++)for(let across=3;across<=5;across++)assert.equal(p.at(60+(vertical?across:along),60+(vertical?along:across)),wet?P.water:P.dry);
 }
});

test('submerged ripples emerge gradually from the impact and cross their repeat seam without jumping',()=>{
 const draw=(t:number,reduced=false,wet=true)=>paint(c=>drawGuairaPoolDepth(c,10,190,60,wet,t,reduced,82));
 const a=draw(41*110),b=draw(42*110);
 for(let x=83;x<190;x++)assert.equal(b.at(x,65),a.at(x-1,65));
 for(let x=10;x<81;x++)assert.equal(b.at(x,65),a.at(x+1,65));
 assert.notDeepEqual(a.pixels,b.pixels);assert.deepEqual(draw(0,true).pixels,draw(99999,true).pixels);
 for(const p of [a,b])for(let y=0;y<180;y++)for(let x=0;x<320;x++)if(p.at(x,y)){
  assert.ok(x>=10&&x<190&&y>=65&&y<82);assert.ok(!Object.values(W).includes(p.at(x,y)));
 }
 assert.ok(draw(100,false,false).pixels.every(p=>!p));
});

test('shutdown residue accelerates into the drain, expires and never covers the walking surface',()=>{
 const draw=(age:number,reduced=false)=>paint(c=>drawGuairaDrainDrops(c,10,170,100,160,age,'#cad6c4',reduced));
 const heights=[0,60,120,180,240,299].map(age=>{
  const p=draw(age);for(let y=170;y<180;y++)for(let x=0;x<320;x++)assert.equal(p.at(x,y),'');
  return p.pixels.findIndex((color,i)=>!!color&&i%320===90)/320|0;
 });
 const drops=heights.slice(1).map((y,i)=>y-heights[i]);for(let i=1;i<drops.length;i++)assert.ok(drops[i]>drops[i-1]);
 for(const age of [-1,300,900,NaN])assert.ok(draw(age).pixels.every(p=>!p));
 assert.ok(draw(120,true).pixels.every(p=>!p));
});
