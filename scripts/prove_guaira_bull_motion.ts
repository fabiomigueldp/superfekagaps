/** Production 60fps proof. Input events only; no actor, camera, health or clock edits. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {GuairaBullEncounter} from '../src/adventure/experimental/guaira/GuairaBullLab';
import {drawSkeletonBull} from '../src/adventure/experimental/guaira/SkeletonBullArt';
import {pixelText} from '../src/graphics/BitmapFont';
const [outArg,canvasArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg,'OUTPUT and CANVAS required');
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href),out=resolve(outArg);mkdirSync(out,{recursive:true});
const primary=JSON.parse(readFileSync('tests/helpers/guairaLabReplay.json','utf8'));
const turn=primary.markers.returnTell;
const marks=new Map<number,string>([[126,'APOIO ANTES DO ARRANQUE'],[130,'ACELERACAO'],[138,'GALOPADA'],[152,'ATRAVESSAR A ARENA'],
 [166,'COMECAR A FREAR'],[172,'ULTIMO APOIO'],[173,'COSTELAS ABERTAS'],[180,'CONTRA-ATAQUE'],
 [turn,'SEGURAR O PESO'],[turn+7,'RECOLHER A CABECA'],[turn+14,'VIRAR DE FRENTE'],[turn+21,'TROCAR OS APOIOS'],
 [turn+28,'APONTAR O RETORNO'],[turn+35,'PREPARAR O IMPULSO'],[turn+42,'NOVO ARRANQUE'],[turn+90,'FIM DA SEGUNDA CORRIDA']]);
const report:any={nativeInputOnly:true,actorOrClockEdits:false,captureFps:30,simulationHz:60,routes:{}};
for(const [key,file]of [['jump','guairaLabReplay'],['ground','guairaBullPoundReplay'],['failure','guairaBullArcFailureReplay']]){
 const cleanup:Array<()=>void>=[],h=guairaBrowser({after:fn=>cleanup.push(fn as ()=>void)});
 for(const v of [h.window,h.document,h.canvas])Object.assign(v,{removeEventListener(){}});
 const screen=createCanvas(640,360),frame=createCanvas(320,180),atlas=createCanvas(1280,816),fc=frame.getContext('2d'),ac=atlas.getContext('2d');
 const strip=createCanvas(960,160),sc=strip.getContext('2d'),pose=createCanvas(80,64),pc=pose.getContext('2d');
 sc.imageSmoothingEnabled=false;sc.fillStyle='#292a30';sc.fillRect(0,0,960,160);
 fc.imageSmoothingEnabled=ac.imageSmoothingEnabled=false;ac.fillStyle='#262d2b';ac.fillRect(0,0,1280,816);
 h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
 const g=h.create(),tape=JSON.parse(readFileSync('tests/helpers/'+file+'.json','utf8'));
 g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
 const dir=join(out,key+'-frames');mkdirSync(dir,{recursive:true});
 let held=new Set<string>(),n=0,health=6,last='',cell=0,helmet=true;
 const audit:any={frames:0,hitFrames:[],warnings:[],events:[],damage:[],minHead:Infinity,screens:[],motion:[]};let saved=0;
 for(const [count,keys]of tape.runs){const next=new Set<string>(keys);
  for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
  for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;
  for(let i=0;i<count;i++){
   g.update(1000/60);n++;const b=(g.boss as GuairaBullEncounter).model,p=g.player.data;
   audit.minHead=Math.min(audit.minHead,Math.round(p.position.y)-Math.round(g.camera.y)-4);
   if(helmet&&!p.hasHelmet)audit.damage.push(n);helmet=p.hasHelmet;
   assert.equal(p.isDead,false);
   if(b.health<health)audit.hitFrames.push(n);health=b.health;
   if(b.state!==last){audit.events.push({frame:n,state:b.state,phase:b.phaseNumber,leg:b.chargeLeg,bx:b.x,px:p.position.x});if(['tell','turn','rattle'].includes(b.state))audit.warnings.push(n);last=b.state;}
   if(b.state==='charge')audit.motion.push({frame:n,tick:b.stateTick,leg:b.chargeLeg,x:b.x,speed:b.chargeVelocity,distance:b.chargeDistance,slowing:b.slowingCharge,contacts:b.footfalls});
   const state=()=>JSON.stringify({b:g.boss,p:g.player.data,o:g.objects,c:g.camera,t:g.time});
   const before=state();g.render();assert.equal(state(),before,'paint is read-only');
   fc.drawImage(screen,0,0,320,180);
   const selected=n===(key==='jump'?turn+14:key==='ground'?tape.markers.finalVolley+29:474);
   const png=n%2===0||selected||key==='jump'&&marks.has(n)?frame.toBuffer('image/png'):undefined;
   if(n%2===0)writeFileSync(join(dir,String(++saved).padStart(5,'0')+'.png'),png!);
   if(selected)writeFileSync(join(out,key+'.png'),png!);
   if(key==='jump'&&b.state==='turn'&&b.stateTick%7===0){
    const i=b.stateTick/7;pc.clearRect(0,0,80,64);pc.save();pc.translate(16-b.x,16-b.y);drawSkeletonBull(pc,b);pc.restore();
    sc.drawImage(pose,i*160,22,160,128);pixelText(sc,String(i+1),i*160+8,8,'#f0ddae');
   }
   if(key==='jump'&&marks.has(n)){
    const name=key+'-'+n+'.png';writeFileSync(join(out,name),png!);audit.screens.push({frame:n,file:name,caption:marks.get(n)});
    const x=cell%4*320,y=Math.floor(cell/4)*204;ac.putImageData(fc.getImageData(0,0,320,180),x,y+24);pixelText(ac,marks.get(n)!,x+6,y+8,'#f0ddae');cell++;
   }
  }
 }
 assert.equal(n,tape.frames);assert.deepEqual(audit.hitFrames,tape.expectedHits.map((h:any)=>h.frame+1));
 assert.deepEqual(audit.damage,tape.expectedDamageFrames);assert.ok(audit.minHead>=23);assert.equal(g.boss?.health,tape.expectedFinalHealth);
 assert.deepEqual(g.store.save.completed,[]);audit.frames=n;audit.finished=g.boss?.phase==='defeated';report.routes[key]=audit;
 if(key==='jump'){writeFileSync(join(out,'combat-atlas.png'),atlas.toBuffer('image/png'));writeFileSync(join(out,'pivot-strip.png'),strip.toBuffer('image/png'));}
 g.dispose();for(const fn of cleanup.reverse())fn();console.log(key,JSON.stringify({frames:n,hits:audit.hitFrames,minHead:audit.minHead}));
}
writeFileSync(join(out,'proof.json'),JSON.stringify(report,null,2)+'\n');
