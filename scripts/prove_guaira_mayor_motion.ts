/** A close view of production poses, reached only through native keyboard input. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaMayorBrowser} from '../tests/helpers/guairaMayorHarness';
import {drawGuairaMayor,drawGuairaMayorRushForeground,drawGuairaMayorStampTarget} from '../src/adventure/experimental/guaira/GuairaMayorArt';
import {drawGuairaMayorFeedback} from '../src/adventure/experimental/guaira/GuairaMayorFeedbackArt';
import {MAYOR_RULES as R,type GuairaMayorModel} from '../src/adventure/experimental/guaira/GuairaMayorModel';
import {pixelText} from '../src/graphics/BitmapFont';

const [out,canvasModule]=process.argv.slice(2);assert.ok(out&&canvasModule,'OUTPUT_DIR CANVAS_MODULE');
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const cleanup:Array<()=>void>=[],h=guairaMayorBrowser({after:f=>cleanup.push(f as ()=>void)});
for(const o of [h.window,h.document,h.canvas])Object.assign(o,{removeEventListener(){}});
const g=h.create(),tape=JSON.parse(readFileSync('tests/helpers/guairaMayorGroundReplay.json','utf8'));
const board=createCanvas(960,640),c=board.getContext('2d');c.imageSmoothingEnabled=false;
c.fillStyle='#233638';c.fillRect(0,0,960,640);
const markers:Array<[string,(m:GuairaMayorModel)=>boolean]>=[
 ['POUSO',m=>m.state==='rushWarning'&&m.stateTick===0],
 ['APOIA O PESO',m=>m.state==='rushWarning'&&m.stateTick===6],
 ['PREPARA',m=>m.state==='rushWarning'&&m.stateTick===24],
 ['ARRANQUE',m=>m.state==='rush'&&m.stateTick===3],
 ['PASSADA 1',m=>m.state==='rush'&&m.rush!.distance>=30],
 ['PASSADA 2',m=>m.state==='rush'&&m.rush!.distance>=42],
 ['PASSADA 3',m=>m.state==='rush'&&m.rush!.distance>=54],
 ['PASSADA 4',m=>m.state==='rush'&&m.rush!.distance>=66],
 ['DESACELERA',m=>m.state==='rush'&&m.rush!.stopping],
 ['SEGURA O PESO',m=>m.state==='rush'&&m.rush!.stopping&&m.rush!.speed<2],
 ['ASSENTA',m=>m.state==='brake'&&m.stateTick===1],
 ['RETOMA A GUARDA',m=>m.state==='brake'&&m.stateTick===12],
 ['REARMA',m=>m.state==='warning'&&m.stateTick===24],
 ['RECOLHE OS JOELHOS',m=>m.state==='leap'&&m.stateTick===12],
 ['PREPARA O IMPACTO',m=>m.state==='leap'&&m.stateTick===29],
 ['CARIMBADA',m=>m.state==='stamp'&&m.stateTick===2],
];
const captured=new Set<string>(),samples:any[]=[];let frame=0;
try{
 for(const [n,keys]of tape.runs){h.keys(keys);for(let tick=0;tick<n;tick++){
  g.update(R.tickMs);frame++;assert.equal(g.player.data.hasHelmet,true);assert.equal(g.player.data.isDead,false);
  const m=g.mayor;if(m.phaseNumber!==2)continue;
  for(const [label,match]of markers){if(captured.has(label)||!match(m))continue;
   const index=markers.findIndex(([name])=>name===label),x=index%4*240,y=Math.floor(index/4)*160;
   const before=JSON.stringify(m);c.fillStyle='#2c4343';c.fillRect(x+2,y+2,236,156);
   pixelText(c,label,x+8,y+10,'#efd5ae');
   const foot=m.y+m.height,cx=m.x+m.width/2-60,cy=foot-54;
   c.save();c.beginPath();c.rect(x+4,y+26,232,114);c.clip();c.translate(x,y+26);c.scale(2,2);
   c.fillStyle='#6f8073';c.fillRect(5,54,110,1);
   drawGuairaMayorFeedback(c,m,cx,cy);drawGuairaMayorStampTarget(c,m,cx,cy);
   drawGuairaMayor(c,m,cx,cy);drawGuairaMayorRushForeground(c,m,cx,cy);c.restore();
   pixelText(c,'QUADRO '+frame+(m.rush?'  V '+m.rush.speed.toFixed(1):''),x+8,y+146,'#a4bbb0');
   assert.equal(JSON.stringify(m),before);captured.add(label);
   samples.push({label,frame,state:m.state,tick:m.stateTick,speed:m.rush?.speed,distance:m.rush?.distance});
  }
 }}
 assert.equal(captured.size,16);assert.equal(g.mayor.publicWaterOpen,true);
 mkdirSync(out,{recursive:true});writeFileSync(out+'/motion-atlas.png',board.toBuffer('image/png'));
 writeFileSync(out+'/motion-poses.json',JSON.stringify({nativeInputOnly:true,actorOrClockEdits:false,complete:true,samples},null,2)+'\n');
 console.log(JSON.stringify({poses:captured.size,frames:frame,complete:true}));
}finally{g.dispose();for(const f of cleanup.reverse())f();}
