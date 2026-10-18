/** Before/after studies of production art; these are authored inspections,
 * separate from the input-only chapter replay. OUTPUT CANVAS BASELINE */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,basename,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {WorldObjects,WorldLevel} from '../src/adventure/WorldPhysics';
import {TileType} from '../src/constants';
import {pixelText} from '../src/graphics/BitmapFont';
import {guairaRespirosStage,GUAIRA_RESPIROS as R} from '../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import {guairaReliefStage,GUAIRA_RELIEF as L} from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';
import {guairaMayorStage} from '../src/adventure/experimental/guaira/GuairaMayorLab';
import {GuairaMayorModel} from '../src/adventure/experimental/guaira/GuairaMayorModel';

const[outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baselineArg);
const out=resolve(outArg),baseline=resolve(baselineArg),root=resolve('src/adventure/experimental/guaira');mkdirSync(out,{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
const prepared=new Map<string,string>(),hashes:Record<string,string>={},currentHashes:Record<string,string>={};
function previous(source:string):string{
 const name=basename(source);if(prepared.has(name))return prepared.get(name)!;
 const code=readFileSync(join(baseline,name),'utf8'),file=join(out,'previous-'+name);prepared.set(name,file);
 hashes[name]=createHash('sha256').update(code).digest('hex');
 currentHashes[name]=createHash('sha256').update(readFileSync(source)).digest('hex');
 writeFileSync(file,code.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>{
  const target=resolve(dirname(source),relative+'.ts');return 'from '+JSON.stringify(pathToFileURL(existsSync(join(baseline,basename(target)))?previous(target):target).href);
 }));return file;
}
const configs=[
 {id:'respiros',file:'respiros/GuairaRespirosArt.ts',stage:guairaRespirosStage(),camera:[80,144],crop:[76,138,104,28],frame:79},
 {id:'isolamento',file:'respiros/GuairaRespirosArt.ts',stage:guairaRespirosStage(),camera:[640,144],crop:[60,125,88,40],frame:18},
 {id:'retorno',file:'relief/GuairaReliefArt.ts',stage:guairaReliefStage(),camera:[200,176],crop:[86,94,68,30],frame:80},
 {id:'bica',file:'GuairaMayorArenaArt.ts',stage:guairaMayorStage(),camera:[0,64],crop:[8,130,98,31],frame:80},
];
const studies:unknown[]=[];
for(const config of configs){
 const source=resolve(root,config.file),old=await import(pathToFileURL(previous(source)).href),now=await import(pathToFileURL(source).href);
 const objects=new WorldObjects(config.stage.mechanisms),level=new WorldLevel(config.stage.level),mayor=new GuairaMayorModel();
 const frame=createCanvas(320,180),c=frame.getContext('2d'),pair=createCanvas(640,336),p=pair.getContext('2d');
 c.imageSmoothingEnabled=p.imageSmoothingEnabled=false;
 const sheet=createCanvas(1280,816),s=sheet.getContext('2d');s.fillStyle='#24302c';s.fillRect(0,0,1280,816);
 const draw=(before:boolean,time:number,reduced=false)=>{
  const a=before?old:now,[x,y]=config.camera,state=JSON.stringify({objects,level,mayor});
  c.fillStyle='#24302c';c.fillRect(0,0,320,180);
  if(config.id==='retorno'){
   a.drawReliefBackground(c,level,x,y,time,reduced);a.drawReliefTerrain(c,level,x,y);a.drawReliefObjects(c,objects,x,y,reduced);
  }else if(config.id==='bica'){
   a.drawGuairaMayorBackground(c,mayor,x,y,time,reduced,objects);a.drawGuairaMayorTerrain(c,level,x,y);a.drawGuairaMayorObjects(c,objects,mayor,x,y,time,reduced);
  }else{
   a.drawRespirosBackground(c,x,y,time,reduced);a.drawRespirosTerrain(c,level,x,y);
   if(config.id==='respiros')a.drawRespirosObjects(c,objects,x,y,time,reduced);
   else a.drawGuairaPressureOutlet(c,objects.get(R.thirdJetId)!,x,y,time,reduced);
  }
  assert.equal(JSON.stringify({objects,level,mayor}),state,'painting must not change the authored state');
  return frame.toBuffer('image/png');
 };
 const folder=join(out,config.id+'-motion');mkdirSync(folder,{recursive:true});
 const samples:unknown[]=[];
 const marks=config.id==='respiros'?[0,40,56,64,70,74,75,76,77,78,79,80,81,82,84,86]:
  config.id==='isolamento'?[0,10,14,15,16,17,18,19,20,22,24,89,90,105,114,125]:Array.from({length:16},(_,i)=>i*16);
 for(let n=0;n<252;n++){
  const time=n*1000/30+(config.id==='isolamento'?1100:0);objects.time=time;
  if(config.id==='isolamento'&&(n===15||n===90)){
   // Authored activation, using the real switch to obtain its exact shutdown
   // snapshot and fresh charging phase. There is no player in this study.
   objects.get(R.serviceValveId)!.timer=0;assert.equal(objects.activate(R.serviceValveId),true);
  }
  if(n===45){
   if(config.id==='retorno'){level.data.tiles[10][15]=TileType.EMPTY;objects.get(L.jetId)!.active=true;}
   if(config.id==='bica'){mayor.state='released';mayor.sealsRemaining=0;}
  }
  p.fillStyle='#24302c';p.fillRect(0,0,640,336);
  for(const[col,before]of[true,false].entries()){
   const png=draw(before,time);pixelText(p,before?'ANTES':'DEPOIS',col*320+8,8,'#e6d4ac');
   p.drawImage(frame,col*320,24);
   const [x,y,w,h]=config.crop;p.drawImage(frame,x,y,w,h,col*320+Math.floor((320-w*3)/2),228,w*3,h*3);
   pixelText(p,'DETALHE 3X',col*320+8,211,'#c2c5aa');
   if(n===config.frame){writeFileSync(join(out,config.id+(before?'-before.png':'-after.png')),png);}
   const index=marks.indexOf(n);
   if(!before&&index>=0){
    const xx=index%4*320,yy=Math.floor(index/4)*204;s.drawImage(frame,xx,yy+24);
    pixelText(s,config.id.toUpperCase()+' '+Math.round(time)+'MS',xx+5,yy+8,'#e6d4ac');samples.push({frame:n,time});
   }
  }
  writeFileSync(join(folder,String(n).padStart(4,'0')+'.png'),pair.toBuffer('image/png'));
  if(n===config.frame)writeFileSync(join(out,config.id+'-poster.png'),pair.toBuffer('image/png'));
 }
 const first=draw(false,objects.time);draw(false,0);assert.ok(draw(false,objects.time).equals(first));
 writeFileSync(join(out,config.id+'-survey.png'),sheet.toBuffer('image/png'));
 studies.push({id:config.id,authoredPose:true,actorIncluded:false,componentOnly:config.id==='isolamento',readOnlyPaint:true,
  repeatable:true,fps:30,frames:252,camera:config.camera,crop:config.crop,comparisonFrame:config.frame,samples});
 console.log(config.id+' captured');
}
writeFileSync(join(out,'studies.json'),JSON.stringify({kind:'authored-production-outlet-studies',baselineHashes:hashes,currentHashes,studies},null,2)+'\n');
