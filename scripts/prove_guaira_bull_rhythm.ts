/** Production 60fps proof. Input events only; no actor, camera, health or clock edits. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {GuairaBullEncounter} from '../src/adventure/experimental/guaira/GuairaBullLab';
import {pixelText} from '../src/graphics/BitmapFont';
const [outArg,canvasArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg,'OUTPUT and CANVAS required');
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href),out=resolve(outArg);mkdirSync(out,{recursive:true});
const marks=new Map([[110,'ANTECIPACAO'],[140,'GALOPADA'],[180,'PRIMEIRO ACERTO'],[420,'ARCO DOS OSSOS'],[463,'OSSOS QUICAM'],[756,'IDA E VOLTA'],[860,'AVISO DO RETORNO'],[918,'SEGUNDO SALTO'],[961,'COSTELAS EXPOSTAS'],[1177,'A OSSADA CEDE'],[1201,'PESO NO CHAO'],[1267,'AGUA NO CURRAL']]);
const report:any={nativeInputOnly:true,actorOrClockEdits:false,captureFps:60,routes:{}};
for(const [key,file]of [['jump','guairaLabReplay'],['pound','guairaBullPoundReplay']]){
 const cleanup:Array<()=>void>=[],h=guairaBrowser({after:fn=>cleanup.push(fn as ()=>void)});
 for(const v of [h.window,h.document,h.canvas])Object.assign(v,{removeEventListener(){}});
 const screen=createCanvas(640,360),frame=createCanvas(320,180),atlas=createCanvas(1280,612),fc=frame.getContext('2d'),ac=atlas.getContext('2d');
 fc.imageSmoothingEnabled=ac.imageSmoothingEnabled=false;ac.fillStyle='#262d2b';ac.fillRect(0,0,1280,612);
 h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
 const g=h.create(),tape=JSON.parse(readFileSync('tests/helpers/'+file+'.json','utf8'));
 g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
 const dir=join(out,key+'-frames');mkdirSync(dir,{recursive:true});
 let held=new Set<string>(),n=0,health=6,last='',cell=0;
 const audit:any={frames:0,hitFrames:[],warnings:[],events:[],damage:[],minHead:Infinity,screens:[]};
 for(const [count,keys]of tape.runs){const next=new Set<string>(keys);
  for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
  for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;
  for(let i=0;i<count;i++){
   g.update(1000/60);n++;const b=(g.boss as GuairaBullEncounter).model,p=g.player.data;
   audit.minHead=Math.min(audit.minHead,Math.round(p.position.y)-Math.round(g.camera.y)-4);
   if(!p.hasHelmet||p.isDead)audit.damage.push(n);
   if(b.health<health)audit.hitFrames.push(n);health=b.health;
   if(b.state!==last){audit.events.push({frame:n,state:b.state,phase:b.phaseNumber,leg:b.chargeLeg,bx:b.x,px:p.position.x});if(['tell','turn','rattle'].includes(b.state))audit.warnings.push(n);last=b.state;}
   const state=()=>JSON.stringify({b:g.boss,p:g.player.data,o:g.objects,c:g.camera,t:g.time});
   const before=state();g.render();assert.equal(state(),before,'paint is read-only');
   fc.drawImage(screen,0,0,320,180);const png=frame.toBuffer('image/png');writeFileSync(join(dir,String(n).padStart(5,'0')+'.png'),png);
   if(key==='jump'&&marks.has(n)){
    const name=key+'-'+n+'.png';writeFileSync(join(out,name),png);audit.screens.push({frame:n,file:name,caption:marks.get(n)});
    const x=cell%4*320,y=Math.floor(cell/4)*204;ac.putImageData(fc.getImageData(0,0,320,180),x,y+24);pixelText(ac,marks.get(n)!,x+6,y+8,'#f0ddae');cell++;
   }
  }
 }
 assert.equal(n,tape.frames);assert.deepEqual(audit.hitFrames,tape.expectedHits.map((h:any)=>h.frame+1));
 assert.equal(audit.damage.length,0);assert.ok(audit.minHead>=23);assert.equal(g.boss?.phase,'defeated');
 assert.deepEqual(g.store.save.completed,[]);audit.frames=n;audit.finished=true;report.routes[key]=audit;
 if(key==='jump')writeFileSync(join(out,'combat-atlas.png'),atlas.toBuffer('image/png'));
 g.dispose();for(const fn of cleanup.reverse())fn();console.log(key,JSON.stringify({frames:n,hits:audit.hitFrames,minHead:audit.minHead}));
}
writeFileSync(join(out,'proof.json'),JSON.stringify(report,null,2)+'\n');
