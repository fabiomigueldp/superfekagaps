/** Native input captures, including a saved pre-change comparison.
 * node --import tsx scripts/prove_guaira_rooftop_routes.ts OUTPUT CANVAS BASELINE
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,basename,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaAscentBrowser} from '../tests/helpers/guairaAscentHarness';
import type {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {pixelText} from '../src/graphics/BitmapFont';
import roof from '../tests/helpers/guairaRooftopReplay.json';
import lift from '../tests/helpers/guairaAscentReplay.json';

const [outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baselineArg);
const out=resolve(outArg),baseline=resolve(baselineArg),root=resolve('src/adventure/experimental/guaira');
mkdirSync(out,{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
const prepared=new Set<string>(),hashes:Record<string,{before:string;after:string}>={};
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
function previous(sourceFile:string):string {
 const name=basename(sourceFile),file=join(out,'previous-'+name);if(prepared.has(name))return file;prepared.add(name);
 const source=readFileSync(join(baseline,name),'utf8');hashes[name]={before:sha(source),after:sha(readFileSync(sourceFile))};
 writeFileSync(file,source.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>{
  const target=resolve(dirname(sourceFile),relative+'.ts');return `from ${JSON.stringify(pathToFileURL(existsSync(join(baseline,basename(target)))?previous(target):target).href)}`;
 }));return file;
}
const source=join(root,'GuairaAscent.ts');
const Before=(await import(pathToFileURL(previous(source)).href)).GuairaAscent as typeof GuairaAscent;
type Run=[number,string[]];
const report:{nativeInputOnly:boolean;actorOrClockEdits:boolean;hashes:typeof hashes;routes:object[];comparisons:object[]}=
 {nativeInputOnly:true,actorOrClockEdits:false,hashes,routes:[],comparisons:[]};
for(const mode of ['before','roof','lift'] as const){
 const cleanup:Array<()=>void>=[],h=guairaAscentBrowser({after:f=>cleanup.push(f as ()=>void)});
 for(const v of [h.window,h.document,h.canvas])Object.assign(v,{removeEventListener(){}});
 const screen=createCanvas(640,360),frame=createCanvas(320,180),sheet=createCanvas(960,612);
 const fc=frame.getContext('2d'),sc=sheet.getContext('2d');fc.imageSmoothingEnabled=false;sc.imageSmoothingEnabled=false;
 sc.fillStyle='#172b32';sc.fillRect(0,0,960,612);
 h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
 h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
 const g=mode==='before'?new Before(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement):h.create();
 g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
 const folder=join(out,mode+'-frames');if(mode!=='before')mkdirSync(folder,{recursive:true});
 const tape=mode==='lift'?lift:roof;
 const marks=mode==='lift'?Array.from({length:9},(_,i)=>Math.round(1+(tape.frames-1)*i/8)):[200,439,488,548,558,580,602,754,910];
 let n=0,videoFrames=0,sheetIndex=0,completedAt=0,lastY=g.camera.y,maxStep=0,minHead=Infinity,maxFeet=0;
 const supports=new Set<number>(),pickups:Record<string,number>={},snapshots:object[]=[];
 const state=()=>JSON.stringify({p:g.player.data,o:g.objects,camera:g.camera,time:g.time,coins:g.coins,tiles:g.level.data.tiles});
 const capture=()=>{const before=state();g.render();assert.equal(state(),before,'render does not move the simulation');
  fc.drawImage(screen,0,0,320,180);return frame.toBuffer('image/png');};
 try{
  for(const[count,keys]of tape.runs as Run[]){
   h.keys(keys);
   for(let i=0;i<count;i++){
    if(mode==='before'&&n===439)break;
    g.update(1000/60);n++;
    const p=g.player.data,feet=p.position.y+p.height;
    assert.equal(p.isDead,false);assert.equal(p.hasHelmet,true);
    minHead=Math.min(minHead,p.position.y-10-g.camera.y);maxFeet=Math.max(maxFeet,feet-g.camera.y);
    maxStep=Math.max(maxStep,Math.abs(g.camera.y-lastY));lastY=g.camera.y;
    if(p.isGrounded)supports.add(Math.round(feet));
    if(g.finished&&!completedAt)completedAt=n;
    for(const id of (g as unknown as {collected:Set<string>}).collected)pickups[id]??=n;
    if(n===439&&mode!=='lift'){
     const file='choice-'+(mode==='before'?'before':'after')+'.png';writeFileSync(join(out,file),capture());
     report.comparisons.push({file,n,player:{...p.position},camera:{...g.camera},coins:g.coins});
    }
    if(mode==='before')continue;
    if(n%4===0||marks.includes(n)){
     const png=capture();
     if(n%4===0)writeFileSync(join(folder,String(++videoFrames).padStart(5,'0')+'.png'),png);
     if(marks.includes(n)){
      const file=mode+'-'+n+'.png';writeFileSync(join(out,file),png);
      snapshots.push({n,file,player:{...p.position},feet,camera:{x:g.camera.x,y:g.camera.y},status:h.status.textContent});
      const x=sheetIndex%3*320,y=Math.floor(sheetIndex/3)*204;
      pixelText(sc,mode.toUpperCase()+' #'+n,x+7,y+8,'#f1d6a4');sc.drawImage(frame,x,y+24);sheetIndex++;
     }
    }
   }
   if(mode==='before'&&n===439)break;
  }
  if(mode!=='before'){
   assert.equal(g.finished,true);assert.equal(n,tape.frames);assert.equal(g.coins,mode==='roof'?12:1);
   assert.ok(minHead>=23&&maxFeet<=172);
   // The established vehicle route has a 9.3px camera clamp on its first
   // jump. The new roof route stays below 8px, including the sprint transfer.
   assert.ok(maxStep<=(mode==='roof'?8.001:9.301),JSON.stringify({mode,maxStep}));
   writeFileSync(join(out,mode+'-sheet.png'),sheet.toBuffer('image/png'));
   report.routes.push({mode,n,completedAt,videoFrames,coins:g.coins,supports:[...supports],pickups,minHead,maxFeet,maxStep,snapshots});
   console.log(JSON.stringify({mode,n,completedAt,coins:g.coins,minHead,maxFeet,maxStep}));
  }
 }finally{g.dispose();cleanup.reverse().forEach(f=>f());}
}
writeFileSync(join(out,'native-verification.json'),JSON.stringify(report,null,2));
