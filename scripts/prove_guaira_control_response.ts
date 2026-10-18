/** Input-only captures of the actual approach, operation and receiving response.
 * OUTPUT CANVAS. No actor/camera/clock/tile edits; native 60 Hz replay tapes. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {pixelText} from '../src/graphics/BitmapFont';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import type {GuairaCourseId} from '../src/adventure/experimental/guaira/GuairaCourseDesign';

const [output,canvasModule]=process.argv.slice(2);assert.ok(output&&canvasModule);
const out=resolve(output);mkdirSync(out,{recursive:true});
const {createCanvas,loadImage}=await import(pathToFileURL(resolve(canvasModule)).href);
const read=(n:string)=>JSON.parse(readFileSync('tests/helpers/'+n+'.json','utf8').replace(/^\uFEFF/,''));
const field=read('guairaFieldRoutesReplays'),routes=read('guairaReadableRoutesReplays'),exploration=read('guairaExplorationReplays'),maintenance=read('guairaMaintenanceReplays');
const constructors={travessia:GuairaTraversal,patio:GuairaJunction,respiros:GuairaRespiros,subida:GuairaAscent,galeria:GuairaGallery,alivio:GuairaRelief};
const jobs:Array<{id:GuairaCourseId;name:string;tape:any}>=[
 {id:'travessia',name:'travessia-principal',tape:field.travessia},
 {id:'subida',name:'subida-principal',tape:routes.subida},
 {id:'patio',name:'patio-exploracao',tape:exploration.patio},
 ...Object.entries(maintenance).map(([id,tape])=>({id:id as GuairaCourseId,name:id+'-manutencao',tape})),
 {id:'alivio',name:'alivio-registro-alto',tape:read('guairaFinaleReplays')['alivio-high']},
 {id:'galeria',name:'galeria-inspecao',tape:read('guairaAqueductReplays')['galeria-tunnel']},
 ...Object.entries(read('guairaControlResponseReplays')).map(([id,tape])=>({id:id as GuairaCourseId,name:id+'-registro',tape})),
];
const report:any={nativeInputOnly:true,actorCameraClockEdits:false,routes:[],controls:[]},covered=new Set<string>();
for(const {id,name,tape} of jobs){
 const cleanup:Array<()=>void>=[],h=guairaBrowser({after:f=>cleanup.push(f as ()=>void)});
 for(const v of [h.window,h.document,h.canvas])Object.assign(v,{removeEventListener(){}});
 const screen=createCanvas(640,360),frame=createCanvas(320,180),fc=frame.getContext('2d');fc.imageSmoothingEnabled=false;
 h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
 const g=new constructors[id](h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
 g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
 const controls=g.objects.bodies.filter(b=>b.kind==='switch'&&b.id.includes(':course:'));
 const before=new Map<string,any>(),events=new Map<string,any>();let n=0,held=new Set<string>(),damage=0;
 const capture=(b:typeof controls[number])=>{
  const state=()=>JSON.stringify({p:g.player.data,o:g.objects,c:g.camera,tiles:g.level.data.tiles,coins:g.coins,foes:g.foes});
  const initial=state();g.render();assert.equal(state(),initial,'painting is read-only');fc.drawImage(screen,0,0,320,180);
  const target=g.objects.get(b.link!)!;
  return {png:frame.toBuffer('image/png'),frame:n,player:{...g.player.data.position},camera:{...g.camera},
   controlActive:b.active,targetActive:target.active,targetY:target.y,targetTo:target.to?.y,hint:guairaCourseGuidance(g,id)?.hint,detail:guairaCourseGuidance(g,id)?.detail};
 };
 for(const [count,keys]of [[tape.initialSettleFrames||0,[]],...tape.runs]){
  const next=new Set<string>(keys);for(const key of held)if(!next.has(key))h.window.dispatch('keyup',{code:key,target:h.canvas});
  for(const key of next)if(!held.has(key))h.window.dispatch('keydown',{code:key,target:h.canvas});held=next;
  for(let i=0;i<count;i++){
   g.update(1000/60);n++;if(g.player.data.isDead||!g.player.data.hasHelmet)damage++;
   for(const b of controls){
    if(covered.has(b.id))continue;
    const target=g.objects.get(b.link!)!,event=events.get(b.id),p=g.player.data;
    if(!event&&b.changedAt===undefined&&Math.abs(p.position.x+p.width/2-b.x-b.width/2)<72
     &&Math.abs(p.position.y+p.height-b.y-b.height)<24&&(!before.has(b.id)||n-before.get(b.id).frame>=15))before.set(b.id,capture(b));
    if(!event&&b.changedAt!==undefined){
     events.set(b.id,{id:b.id,route:name,scene:id,approach:before.get(b.id),operation:capture(b),at:n});
    }else if(event&&!event.response&&n>=event.at+30&&(target.kind!=='lift'||target.y===target.to?.y)){
     event.response=capture(b);
     // Keep every captured scene at its native camera, even when a result is
     // behind the player. This is evidence of gameplay, not an arranged study.
     const sheet=createCanvas(960,204),c=sheet.getContext('2d');c.fillStyle='#24302c';c.fillRect(0,0,960,204);
     for(const [j,phase]of ['approach','operation','response'].entries()){
      const shot=event[phase];assert.ok(shot,`${b.id} has a real approach before the native pound`);
      c.drawImage(await loadImage(shot.png),j*320,24);
      pixelText(c,['APROXIMACAO','SENTADA','RESPOSTA'][j]+'  '+shot.frame,j*320+8,8,'#f2dfaf');
      const file=b.id.replace(/:/g,'-')+'-'+phase+'.png';writeFileSync(join(out,file),shot.png);shot.file=file;delete shot.png;
     }
     event.sheet=b.id.replace(/:/g,'-')+'-sequence.png';writeFileSync(join(out,event.sheet),sheet.toBuffer('image/png'));
     covered.add(b.id);report.controls.push(event);
    }
   }
  }
 }
 assert.equal(g.finished,tape.finished??true,name+' reaches its recorded endpoint');assert.equal(damage,0,name+' is damage-free');
 const result={name,scope:tape.scope??'complete-stage',frames:n,coins:g.coins,finished:g.finished,damage,activated:controls.filter(b=>b.changedAt!==undefined).map(b=>b.id)};
 report.routes.push(result);console.log(JSON.stringify(result));g.dispose();for(const f of cleanup.reverse())f();
}
report.covered=covered.size;writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
assert.equal(covered.size,11,'Every expanded hydraulic control has an input-only sequence');
