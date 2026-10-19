/** Magnified art inspection from the production NPC timeline; separate from native-play proof. */
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { HypotheticalBackdrop } from '../src/adventure/hipotetico/HypotheticalBackdrop';
import { drawBystanders,bystanderPose } from '../src/adventure/hipotetico/HypotheticalBystanders';
import { pixelText } from '../src/graphics/BitmapFont';
const [destination,canvasModule]=process.argv.slice(2);assert.ok(destination&&canvasModule);
const out=resolve(destination);mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const canvas=createCanvas(320,180),c=canvas.getContext('2d'),sheet=createCanvas(320,180),sc=sheet.getContext('2d');
const ids=[0,1,3,4],names=['CASACO','CAMISA','LENCO','BOLSA'];
const timeline:Array<HypotheticalBackdrop>=[];const source=new HypotheticalBackdrop(true);
for(let tick=0;tick<=1200;tick++){
 if(tick)source.update(tick);
 const b=new HypotheticalBackdrop(true);Object.assign(b,JSON.parse(JSON.stringify(source)));timeline.push(b);
}
function paintPerson(ctx:CanvasRenderingContext2D,b:HypotheticalBackdrop,index:number,originX:number,base:number,scale:number){
 const selected=new HypotheticalBackdrop(true);Object.assign(selected,{tick:b.tick,shots:[],impacts:[]});
 selected.people.splice(0,selected.people.length,b.people[index]);
 const before=JSON.stringify(b);ctx.save();ctx.translate(originX,base);ctx.scale(scale,scale);
 ctx.translate(-b.people[index].originX,0);drawBystanders(ctx,selected,0,false);ctx.restore();assert.equal(JSON.stringify(b),before);
}
let videoFrames=0;
for(let frame=0;frame<300;frame+=2){
 c.fillStyle='#233b43';c.fillRect(0,0,320,180);pixelText(c,'INSPECAO DE ANIMACAO  2X',8,5,'#e7cb9c');
 for(let row=0;row<4;row++){
  const index=ids[row],initial=timeline[0].people[index],tick=initial.alertAt-10+frame,b=timeline[tick],p=b.people[index],pose=bystanderPose(p,tick);
  const x=row%2*160,y=20+Math.floor(row/2)*80;
  c.fillStyle=row%2?'#344e50':'#2d454a';c.fillRect(x,y,160,80);pixelText(c,names[row],x+7,y+5,'#e7cb9c');
  const phase=p.hitAt!==null?(tick-p.hitAt>40?'REPOUSO':'QUEDA'):p.stoppedAt!==null?'ABRIGO':pose.running?(p.velocity<.22&&p.distance>10?'FREIA':'CORRE'):tick>=p.alertAt?'ALERTA':'ESPERA';
  pixelText(c,phase,x+102,y+5,'#bdc7b5');c.fillStyle='#7b8f81';c.fillRect(x+6,y+66,147,1);
  paintPerson(c,b,index,x+15,y+65,2);
 }
 writeFileSync(join(out,'frames',String(videoFrames++).padStart(5,'0')+'.png'),canvas.toBuffer('image/png'));
}
sc.fillStyle='#233b43';sc.fillRect(0,0,320,180);
for(const [column,label] of ['NOTA','SAIDA','PASSO','FREIO','ABRIGO','RECUO','GIRO','REPOUSO'].entries())pixelText(sc,label,column*40+2,5,'#e7cb9c');
const samples:Array<{index:number;ticks:number[]}>=[];
for(let row=0;row<4;row++){
 const index=ids[row],p=timeline[1200].people[index];assert.ok(p.hitAt!==null&&p.stoppedAt!==null);
 const ticks=[p.alertAt+3,p.alertAt+13,p.alertAt+34,p.stoppedAt-7,p.stoppedAt+7,p.hitAt+3,p.hitAt+18,p.hitAt+45];samples.push({index,ticks});
 ticks.forEach((tick,col)=>{
  const x=col*40,y=20+row*40,b=timeline[tick],person=b.people[index];
  sc.fillStyle=(row+col)%2?'#344e50':'#2d454a';sc.fillRect(x,y,40,40);sc.fillStyle='#70877c';sc.fillRect(x+2,y+33,36,1);
  paintPerson(sc,b,index,x+11-person.distance,y+32,1);
 });
}
writeFileSync(join(out,'bystander-motion.png'),sheet.toBuffer('image/png'));
const report={inspectionOnly:true,productionNpcTimeline:true,relocatedForLayout:true,scale:2,videoFrames,seconds:videoFrames/30,contactSheetPoses:32,samples};
writeFileSync(join(out,'motion-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
