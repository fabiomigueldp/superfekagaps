/** Native, input-only survey of all eight Guaíra scenes. Optional baseline
 * imports reconstruct only the saved files; all other dependencies stay native.
 * node --import tsx scripts/prove_guaira_chapter_readability.ts OUTPUT CANVAS [BASELINE]
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,basename,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {pixelText} from '../src/graphics/BitmapFont';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
const [outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg,'OUTPUT and CANVAS module required');
const captureStride=Number(process.env.GUAIRA_CAPTURE_STRIDE??4);assert.ok([1,2,4].includes(captureStride),'capture stride must be 1, 2 or 4');
const captureFrom=Number(process.env.GUAIRA_CAPTURE_FROM??1),captureTo=Number(process.env.GUAIRA_CAPTURE_TO??Infinity);
assert.ok(Number.isInteger(captureFrom)&&captureFrom>=1&&(captureTo===Infinity||Number.isInteger(captureTo)&&captureTo>=captureFrom),'valid native capture window required');
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
const out=resolve(outArg),root=resolve('src/adventure/experimental/guaira');mkdirSync(out,{recursive:true});
const hashes:Record<string,string>={},prepared=new Set<string>();
function previous(sourceFile:string):string {
 const name=basename(sourceFile),file=join(out,'previous-'+name);if(prepared.has(name))return file;prepared.add(name);
 const source=readFileSync(join(resolve(baselineArg),name),'utf8');hashes[name]=createHash('sha256').update(source).digest('hex');
 const dependency=(relative:string)=>{const target=resolve(dirname(sourceFile),relative+'.ts');
  return JSON.stringify(pathToFileURL(existsSync(join(resolve(baselineArg),basename(target)))?previous(target):target).href);};
 writeFileSync(file,source.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>`from ${dependency(relative)}`)
  .replace(/import\((['"])(\.[^'"]+)\1\)/g,(_m,_q,relative:string)=>`import(${dependency(relative)})`));return file;
}
const registry=join(root,'chapter/GuairaChapterScenes.ts');
const {loadGuairaChapterScene}=await import(pathToFileURL(baselineArg?previous(registry):registry).href);
const read=(name:string)=>JSON.parse(readFileSync('tests/helpers/'+name+'.json','utf8').replace(/^\uFEFF/,''));
const field=read('guairaFieldRoutesReplays'),routes=read('guairaReadableRoutesReplays');
const runs:any={travessia:field.travessia,patio:read('guairaJunctionOptionalReplay'),respiros:field.respiros,lab:read('guairaLabReplay'),subida:routes.subida,prefeito:read('guairaMayorReplay'),galeria:routes.galeria,alivio:read('guairaReliefRoutesReplays').high};
if(process.env.GUAIRA_COURSE_REPLAYS)for(const key of ['travessia','patio','respiros','subida','galeria','alivio'])
 runs[key]=JSON.parse(readFileSync(join(process.env.GUAIRA_COURSE_REPLAYS,key+'-draft.json'),'utf8'));
const ids:any={travessia:'guaira-travessia',patio:'guaira-patio-comportas',respiros:'guaira-respiros',lab:'guaira-lab',subida:'guaira-subida',prefeito:'guaira-prefeito'};
const report:any={};
for(const [key,tape] of Object.entries(runs) as any){
 if(process.env.GUAIRA_SCENES&&!process.env.GUAIRA_SCENES.split(',').includes(key))continue;
 const cleanup:Array<()=>void>=[],h=guairaBrowser({after:f=>cleanup.push(f as ()=>void)});
 for(const v of [h.window,h.document,h.canvas])Object.assign(v,{removeEventListener(){}});
 const screen=createCanvas(640,360),frame=createCanvas(320,180),sheet=createCanvas(1280,4*204),fc=frame.getContext('2d'),sc=sheet.getContext('2d');
 fc.imageSmoothingEnabled=false;sc.imageSmoothingEnabled=false;sc.fillStyle='#131e25';sc.fillRect(0,0,1280,816);
 h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
 const c=h.canvas as unknown as HTMLCanvasElement,s=h.status as unknown as HTMLElement;
 const g:any=ids[key]?(await loadGuairaChapterScene(ids[key]))(c,s).game:key==='galeria'?new GuairaGallery(c,s):new GuairaRelief(c,s);
 g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
 let held=new Set<string>(),n=0,index=0,lastY=g.camera.y,lastX=g.camera.x,lastGround='',lastHint='';
 const sample:any={frames:0,minHelmet:Infinity,maxFeet:0,maxCameraStepY:0,maxCameraStepX:0,contacts:[],hints:[],snapshots:[],damage:[],jumps:[]};
 let lastSupported:any=null,air:Array<any>=[];
 const total=tape.runs.reduce((sum:number,x:any)=>sum+x[0],0)+(tape.initialSettleFrames||0);
 const sheetMarks=new Set(Array.from({length:16},(_,i)=>Math.round(i*(total-1)/15)+1));
 const marks=new Set([...sheetMarks,...(tape.notes??[]).map((note:any)=>note.frame),...(({patio:[123,1745,1769],subida:[1014,1038,1056],respiros:[379],prefeito:[519]} as Record<string,number[]>)[key]??[])]);
 const video=join(out,key+'-replay');if(!baselineArg)mkdirSync(video,{recursive:true});let videoFrames=0;
 const capture=()=>{const state=()=>JSON.stringify({p:g.player.data,o:g.objects,b:g.boss,c:g.camera,coins:g.coins,t:g.time,tiles:g.level.data.tiles});
  const before=state();g.render();assert.equal(state(),before,'native paint is read-only');fc.drawImage(screen,0,0,320,180);return frame.toBuffer('image/png');};
 for(const [count,keys]of [[tape.initialSettleFrames||0,[]],...tape.runs]){
  const next=new Set<string>(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});
  for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;
  for(let i=0;i<count;i++){
   g.update(1000/60);n++;const p=g.player.data,feet=p.position.y+p.height;
   sample.minHelmet=Math.min(sample.minHelmet,p.position.y-10-g.camera.y);sample.maxFeet=Math.max(sample.maxFeet,feet-g.camera.y);
   sample.maxCameraStepY=Math.max(sample.maxCameraStepY,Math.abs(g.camera.y-lastY));sample.maxCameraStepX=Math.max(sample.maxCameraStepX,Math.abs(g.camera.x-lastX));lastY=g.camera.y;lastX=g.camera.x;
   if(p.isDead||!p.hasHelmet)sample.damage.push(n);
   const now={n,x:p.position.x,feet,y:p.position.y,camX:g.camera.x,camY:g.camera.y};
   if(p.isGrounded){
    if(air.length&&lastSupported){const apex=air.reduce((best,frame)=>frame.feet<best.feet?frame:best,air[0]);
     if(apex.feet<lastSupported.feet-10)sample.jumps.push({start:lastSupported,apex,end:now,landingAtTakeoff:{x:now.x-lastSupported.camX,y:now.feet-lastSupported.camY},landingAtApex:{x:now.x-apex.camX,y:now.feet-apex.camY}});
    }
    air=[];lastSupported=now;
    const support=Math.round(feet)+':'+Math.floor(p.position.x/32);if(support!==lastGround){sample.contacts.push({n,x:Math.round(p.position.x),feet:Math.round(feet)});lastGround=support;}
   }else air.push(now);
   if(g.boss?.hint&&g.boss.hint!==lastHint){lastHint=g.boss.hint;sample.hints.push({n,hint:lastHint});}
   const videoFrame=!baselineArg&&n%captureStride===0&&n>=captureFrom&&n<=captureTo;
   if(marks.has(n)||videoFrame){
    const png=capture();
    if(videoFrame)writeFileSync(join(video,String(++videoFrames).padStart(5,'0')+'.png'),png);
    if(!marks.has(n))continue;
    const file=key+'-'+n+'.png';writeFileSync(join(out,file),png);
    const snap={n,file,p:{...p.position},feet,camera:{x:g.camera.x,y:g.camera.y},hint:g.boss?.hint,status:h.status.textContent};sample.snapshots.push(snap);
    if(sheetMarks.has(n)){const x=index%4*320,y=Math.floor(index/4)*204;sc.putImageData(fc.getImageData(0,0,320,180),x,y+24);
     pixelText(sc,key.toUpperCase()+' #'+n+'  X'+Math.round(p.position.x)+' Y'+Math.round(feet),x+4,y+8,'#ffe1ab');index++;}
   }
  }
 }
 sample.frames=n;sample.videoFrames=videoFrames;sample.captureFps=60/captureStride;
 sample.videoWindow={firstFrame:Math.ceil(captureFrom/captureStride)*captureStride,lastFrame:Math.floor(Math.min(n,captureTo)/captureStride)*captureStride};
 sample.finished=g.finished??g.mayor?.publicWaterOpen??(g.boss?.phase==='defeated');sample.coins=g.coins;report[key]=sample;
 assert.equal(sample.finished,true);assert.equal(sample.damage.length,0);assert.equal(n,total);
 writeFileSync(join(out,key+'-sheet.png'),sheet.toBuffer('image/png'));g.dispose();for(const fn of cleanup.reverse())fn();
 console.log(key,JSON.stringify({finished:sample.finished,coins:sample.coins,minHelmet:sample.minHelmet,maxFeet:sample.maxFeet,maxCameraStepX:sample.maxCameraStepX,maxCameraStepY:sample.maxCameraStepY,damage:sample.damage.length}));
}
const reportPath=join(out,'audit.json'),prior=process.env.GUAIRA_SCENES&&existsSync(reportPath)?JSON.parse(readFileSync(reportPath,'utf8')):null;
writeFileSync(reportPath,JSON.stringify({nativeInputOnly:true,actorOrClockEdits:false,baseline:!!baselineArg,
 conservativeTopNote:'minHelmet uses a conservative physics y-10 bound; the real sprite top is y-4, verified separately in browser-verification.json.',
 baselineHashes:{...prior?.baselineHashes,...hashes},scenes:{...prior?.scenes,...report}},null,2));

