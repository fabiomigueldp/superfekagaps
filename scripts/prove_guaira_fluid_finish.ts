/** Authored production-art studies. Gameplay is verified separately with the
 * input-only chapter replay and normal campaign scripts; these are not replays.
 * node --import tsx scripts/prove_guaira_fluid_finish.ts OUTPUT CANVAS BASELINE
 */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,basename,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {WorldObjects,WorldLevel} from '../src/adventure/WorldPhysics';
import {guairaTraversalStage,GUAIRA_TRAVERSAL as T} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {guairaRespirosStage} from '../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import {guairaReliefStage} from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';
import {guairaJunctionStage,JunctionRouting} from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import {pixelText} from '../src/graphics/BitmapFont';

const[outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baselineArg);
const out=resolve(outArg),baseline=resolve(baselineArg),root=resolve('src/adventure/experimental/guaira');mkdirSync(out,{recursive:true});
const{createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
const prepared=new Map<string,string>(),hashes:Record<string,string>={};
function previous(source:string):string{
 const name=basename(source);if(prepared.has(name))return prepared.get(name)!;
 const code=readFileSync(join(baseline,name),'utf8'),file=join(out,'previous-'+name);prepared.set(name,file);
 hashes[name]=createHash('sha256').update(code).digest('hex');
 writeFileSync(file,code.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>{
  const target=resolve(dirname(source),relative+'.ts');return 'from '+JSON.stringify(pathToFileURL(existsSync(join(baseline,basename(target)))?previous(target):target).href);
 }));return file;
}
const configs=[
 {id:'comporta',file:'GuairaTraversalArt.ts',stage:guairaTraversalStage(),camera:[368,108],frame:42},
 {id:'canos',file:'junction/GuairaJunctionArt.ts',stage:guairaJunctionStage(),camera:[350,128],frame:42},
 {id:'respiros',file:'respiros/GuairaRespirosArt.ts',stage:guairaRespirosStage(),camera:[80,144],frame:63},
 {id:'alivio',file:'relief/GuairaReliefArt.ts',stage:guairaReliefStage(),camera:[240,176],frame:90},
];
const studies:any[]=[];
for(const config of configs){
 const source=resolve(root,config.file),old=await import(pathToFileURL(previous(source)).href),now=await import(pathToFileURL(source).href);
 const objects=new WorldObjects(config.stage.mechanisms),level=new WorldLevel(config.stage.level),routing=new JunctionRouting('b');
 if(config.id==='comporta')for(const id of [T.bridgeId,T.finalBridgeId]){const b=objects.get(id)!;b.active=true;b.y=b.py=b.to!.y;}
 if(config.id==='canos')for(const id of ['junction-deck-a','junction-deck-b']){const b=objects.get(id)!;b.active=id.endsWith('b');b.y=b.py=b.active?208:400;}
 const canvas=createCanvas(320,180),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 const draw=(before:boolean,time:number,reduced=false)=>{
  objects.time=time;const state=JSON.stringify({objects,level,routing}),a=before?old:now,[x,y]=config.camera;
  c.clearRect(0,0,320,180);
  if(config.id==='comporta'){
   a.drawGuairaTraversalBackground(c,x,y,time,reduced,true,true);a.drawGuairaTraversalTerrain(c,level,x,y,time,reduced);a.drawGuairaTraversalObjects(c,objects,x,y,time,reduced);
  }else if(config.id==='canos'){
   a.drawJunctionBackground(c,x,y,time,reduced,routing);a.drawJunctionTerrain(c,level,x,y);a.drawJunctionObjects(c,objects,x,y,time,reduced,routing);
  }else if(config.id==='respiros'){
   a.drawRespirosBackground(c,x,y,time,reduced);a.drawRespirosTerrain(c,level,x,y);a.drawRespirosObjects(c,objects,x,y,time,reduced);
  }else{
   a.drawReliefBackground(c,level,x,y,time,reduced);a.drawReliefTerrain(c,level,x,y);a.drawReliefObjects(c,objects,x,y,reduced);
  }
  assert.equal(JSON.stringify({objects,level,routing}),state);return canvas.toBuffer('image/png');
 };
 const pair=createCanvas(640,204),p=pair.getContext('2d'),sheet=createCanvas(1280,816),s=sheet.getContext('2d');
 s.fillStyle='#1d292a';s.fillRect(0,0,1280,816);p.imageSmoothingEnabled=false;
 const folder=join(out,config.id+'-motion');mkdirSync(folder,{recursive:true});
 let index=0;const samples:any[]=[];
 for(let frame=0;frame<252;frame++){
  const time=frame*1000/30;p.fillStyle='#1d292a';p.fillRect(0,0,640,204);
  for(const [col,before]of [true,false].entries()){
   const png=draw(before,time);p.putImageData(c.getImageData(0,0,320,180),col*320,24);pixelText(p,before?'ANTES':'DEPOIS',col*320+6,8,'#e6d4ac');
   if(frame===config.frame)writeFileSync(join(out,config.id+(before?'-before.png':'-after.png')),png);
   if(!before&&frame%16===0){
    const x=index%4*320,y=Math.floor(index/4)*204;s.putImageData(c.getImageData(0,0,320,180),x,y+24);pixelText(s,config.id.toUpperCase()+' '+Math.round(time)+'MS',x+5,y+8,'#e6d4ac');index++;
    samples.push({frame,time});
   }
  }
  writeFileSync(join(folder,String(frame).padStart(4,'0')+'.png'),pair.toBuffer('image/png'));
 }
 const time=config.frame*1000/30,first=draw(false,time);draw(false,0);assert.ok(draw(false,time).equals(first));
 writeFileSync(join(out,config.id+'-survey.png'),sheet.toBuffer('image/png'));
 studies.push({id:config.id,authoredPose:true,actorIncluded:false,clockEditedForStudy:true,readOnlyPaint:true,repeatable:true,fps:30,frames:252,comparisonTime:time,camera:config.camera,samples});
 console.log(config.id+' captured');
}
writeFileSync(join(out,'studies.json'),JSON.stringify({kind:'authored-production-water-animation-studies',baselineHashes:hashes,studies},null,2)+'\n');
