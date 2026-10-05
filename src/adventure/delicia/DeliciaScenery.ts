import type { StageMachine, StageZone } from './DeliciaContent';
import type { DeliciaSimulation } from './DeliciaSimulation';
import { steamPhase } from './DeliciaSimulation';
import { drawAtlasSprite } from './DeliciaSpriteFrames';

const TAU=Math.PI*2;
const box=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string,r=0)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
const line=(c:CanvasRenderingContext2D,x:number,y:number,xx:number,yy:number,color:string,w=2)=>{c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();};
const dot=(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();};
const ORDER:StageZone['landmark'][]=['port','mill','arches','chalice','archive','factory','garden','bell','crown'];
const DIMENSIONS:Record<StageZone['landmark'],[number,number]>={port:[270,245],mill:[265,300],arches:[340,240],chalice:[265,230],archive:[275,255],factory:[310,285],garden:[300,225],bell:[170,290],crown:[345,305]};

/** Buildings belong to a terrace in the level, not a repeating screen-space
 * strip. Their feet share that terrace's coordinates throughout camera travel. */
export function drawLandmarks(c:CanvasRenderingContext2D,sim:DeliciaSimulation,time:number,sheet?:HTMLImageElement):void {
 c.save();c.translate(-sim.cameraX,-sim.cameraY);
 for(const zone of sim.stage.zones??[]){
  const terrace=sim.stage.floors.find(f=>f.h>50&&f.x===zone.x);if(!terrace)continue;
  const x=terrace.x+terrace.w*.5,foot=terrace.y+5;
  if(x<sim.cameraX-400||x>sim.cameraX+1360)continue;
  const [width,height]=DIMENSIONS[zone.landmark];
  c.save();c.globalAlpha=.84;
  // A visible, continuous plinth is partially buried by the playable surface.
  box(c,x-width*.49,foot-9,width*.98,14,'#73795a',3);
  if(sheet)drawAtlasSprite(c,sheet,ORDER.indexOf(zone.landmark),3,3,x,foot,width,height,'landmarks-v5');
  else{
   box(c,x-width*.35,foot-height*.7,width*.7,height*.7,'#a9a081',5);
   box(c,x-width*.39,foot-height*.7-12,width*.78,14,'#9c7350',4);
   box(c,x-15,foot-65,30,65,'#3d6358',12);
  }
  if(zone.landmark==='factory')for(let i=0;i<3;i++)dot(c,x+width*.26+Math.sin(time*.6+i)*6,foot-height-((time*10+i*18)%45),7+i*2,'#d7d8b819');
  c.restore();
 }
 c.restore();
}

/** Low, grounded details only. No opaque atlas mats or repeated boilers in gaps. */
export function drawSetDressing(c:CanvasRenderingContext2D,sim:DeliciaSimulation,sheet?:HTMLImageElement):void {
 c.save();c.translate(-sim.cameraX,-sim.cameraY);c.globalAlpha=.7;
 const floors=sim.stage.floors.filter(f=>f.h>50);
 for(let index=0;index<floors.length;index++){
  const f=floors[index];if(f.x+f.w<sim.cameraX||f.x>sim.cameraX+960||index%3===0||sim.boss)continue;
  const x=f.x+f.w-34,y=f.y;
  if(sheet){
   const biome=sim.stage.biome,prop=biome==='orchard'?0:biome==='harbor'?1:biome==='cellar'?4:biome==='refinery'?3:2;
   drawAtlasSprite(c,sheet,prop,3,2,x-24,y+3,prop===4?65:94,prop===4?70:60);
   continue;
  }
  if(sim.stage.biome==='orchard'){
   // Behind the ground lip: a small terrace planter, never a floating canopy.
   box(c,x-46,y-18,68,20,'#817c58',3);
   for(let j=0;j<5;j++){dot(c,x-35+j*11,y-23-(j%2)*5,12,j%2?'#658353':'#4c7050');if(j%2===0)dot(c,x-33+j*11,y-28,3,'#d5a156');}
  }else if(sim.stage.biome==='harbor'){
   box(c,x-36,y-37,29,38,'#857044',2);line(c,x-34,y-32,x-9,y-6,'#c1a376',3);line(c,x-34,y-6,x-9,y-32,'#c1a376',3);
   line(c,x+7,y,x+7,y-57,'#857655',6);dot(c,x+7,y-57,4,'#c9b489');
  }else if(sim.stage.biome==='cellar'){
   box(c,x-46,y-49,54,50,'#4b6554',3);
   for(let row=0;row<2;row++)for(let j=0;j<3;j++){
    box(c,x-40+j*15,y-40+row*24,9,18,j%2?'#b0a471':'#7e9d82',3);box(c,x-38+j*15,y-44+row*24,5,5,'#bda66f');
   }
  }else if(sim.stage.biome==='refinery'||sim.stage.biome==='citadel'){
   line(c,x-45,y-1,x-45,y-55,'#3f675e',9);line(c,x-45,y-55,x+5,y-55,'#3f675e',9);line(c,x+5,y-55,x+5,y,'#3f675e',9);
   for(const xx of [x-45,x+5]){line(c,xx-7,y-13,xx+7,y-13,'#ad9b68',4);box(c,xx-10,y-5,20,7,'#718671');}
  }else{
   for(const xx of [x-45,x+8]){box(c,xx-4,y-40,8,40,'#a6a486',2);box(c,xx-7,y-42,14,5,'#c9ba8e');}
   line(c,x-45,y-26,x+8,y-26,'#a6a486',5);
  }
 }
 c.restore();
}

export function drawMachine(c:CanvasRenderingContext2D,m:StageMachine,sim:DeliciaSimulation,time:number):void {
 const disabled=!!m.disabledBy&&sim.valves.has(m.disabledBy),phase=disabled?'safe':steamPhase(sim.time,m.period,m.phase);
 if(m.kind==='wind'){
  for(let i=0;i<9;i++){const x=m.x+12+(i*31)%m.w,y=m.y+m.h-((time*55+i*29)%m.h);line(c,x,y,x+9,y-17,'#ddedb870',1.5);}return;
 }
 const foot=m.y+m.h;
 if(m.kind==='jet'){
  box(c,m.x-4,foot-8,m.w+8,8,'#5b8c76',3);box(c,m.x+3,foot-4,m.w-6,4,'#b1d8b1',2);
  if(phase==='safe'){dot(c,m.x+m.w/2,foot-13,3,'#a2d3a6');return;}
  const h=phase==='tell'?20:m.h;
  for(let i=0;i<6;i++){const yy=foot-((time*230+i*23)%h);dot(c,m.x+m.w/2+Math.sin(i+time*9)*8,yy,phase==='tell'?3:6,'#ffc96da0');}
  if(phase==='tell'){const x=m.x+m.w/2;line(c,x,foot-20,x,foot-38,'#c0f1d0',2);line(c,x,foot-38,x-5,foot-31,'#c0f1d0',2);line(c,x,foot-38,x+5,foot-31,'#c0f1d0',2);}return;
 }
 // A bolted portal supports the press. Back posts sit outside its marked lane.
 for(const x of [m.x-18,m.x+m.w+18]){
  box(c,x-6,m.y-14,12,m.h+14,'#31584f',2);line(c,x-2,m.y,x-2,foot,'#83a18b',2);
  box(c,x-12,foot-9,24,9,'#698778',2);dot(c,x,m.y,3,'#d0ae6d');
 }
 box(c,m.x-29,m.y-21,m.w+58,23,'#486e5f',4);box(c,m.x-22,m.y-20,m.w+44,4,'#a7b38c');
 for(const x of [m.x-17,m.x+m.w+17])dot(c,x,m.y-9,3,'#ddbf7b');
 const extension=phase==='active'?m.h-23:phase==='tell'?18+Math.sin(time*25)*2:8;
 box(c,m.x+m.w/2-8,m.y,16,extension,'#b69f73');line(c,m.x+m.w/2-3,m.y,m.x+m.w/2-3,m.y+extension,'#efdcb0',2);
 box(c,m.x,m.y+extension,m.w,23,'#c8ad71',3);
 for(let i=0;i<m.w-10;i+=18)line(c,m.x+i+3,m.y+extension+6,m.x+i+11,m.y+extension+15,'#526755',4);
 dot(c,m.x+m.w/2,m.y-10,5,disabled?'#a5e9c3':phase==='tell'?'#ffdb91':phase==='active'?'#fa9a72':'#728a6b');
 // The full danger column is visible, matching the collision region.
 if(phase==='tell'||phase==='active'){
  box(c,m.x,m.y+30,m.w,m.h-30,phase==='tell'?'#ffd58d20':'#edb26333');
  for(let i=0;i<m.w-10;i+=16)line(c,m.x+i,foot-3,m.x+i+9,foot-10,phase==='tell'?'#ffdd95':'#ffe0a3',3);
 }
}

export function drawAtmosphere(c:CanvasRenderingContext2D,sim:DeliciaSimulation,time:number):void {
 const interior=['cellar','refinery','citadel'].includes(sim.stage.biome);
 for(let i=0;i<14;i++){
  const x=((i*147.7-sim.cameraX*.16+time*(interior?5:11))%1010+1010)%1010-25,y=(i*83.3+Math.sin(time*.4+i)*17)%350;
  dot(c,x,y,interior?1:1.5,interior?'#ffda9b30':'#fff5c05a');
 }
}
