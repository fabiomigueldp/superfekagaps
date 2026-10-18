/** Authored art inspection, separate from input-only gameplay replays.
 * OUTPUT CANVAS BASELINE; views include the real terrain and target hardware. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,basename,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {ISLANDS} from '../src/adventure/campaign';
import {pixelText} from '../src/graphics/BitmapFont';
import {TileType} from '../src/constants';

const [outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baselineArg);
const out=resolve(outArg),baseline=resolve(baselineArg),root=resolve('src/adventure/experimental/guaira');mkdirSync(out,{recursive:true});
const {createCanvas,loadImage}=await import(pathToFileURL(resolve(canvasArg)).href);
const prepared=new Map<string,string>(),hashes:Record<string,string>={};
function previous(source:string):string{
 const name=basename(source);if(prepared.has(name))return prepared.get(name)!;
 const code=readFileSync(join(baseline,name),'utf8'),file=join(out,'previous-'+name);prepared.set(name,file);
 hashes[name]=createHash('sha256').update(code).digest('hex');
 const dependency=(relative:string)=>{const target=resolve(dirname(source),relative+'.ts');
  return JSON.stringify(pathToFileURL(existsSync(join(baseline,basename(target)))?previous(target):target).href);};
 writeFileSync(file,code.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>'from '+dependency(relative))
  .replace(/import\((['"])(\.[^'"]+)\1\)/g,(_m,_q,relative:string)=>'import('+dependency(relative)+')'));
 return file;
}
const configs=[['travessia','GuairaTraversal','GuairaTraversal'],['patio','junction/GuairaJunction','GuairaJunction'],
 ['respiros','respiros/GuairaRespiros','GuairaRespiros'],['subida','GuairaAscent','GuairaAscent'],
 ['galeria','gallery/GuairaGallery','GuairaGallery'],['alivio','relief/GuairaRelief','GuairaRelief'],
 ['prefeito','GuairaMayorLab','GuairaMayorLab']];
const report:any[]=[];
for(const [scene,file,cls]of configs){
 const source=join(root,file+'.ts'),modules=[await import(pathToFileURL(previous(source)).href),await import(pathToFileURL(source).href)];
 const captures:Array<Map<string,Buffer[]>>=[new Map(),new Map()];
 let ids:string[]=[],positions:Record<string,any>={};
 for(const [version,module]of modules.entries()){
  const clean:Array<()=>void>=[],h=guairaBrowser({after:f=>clean.push(f as ()=>void)});
  for(const v of [h.window,h.document,h.canvas])Object.assign(v,{removeEventListener(){}});
  const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
  const g:any=new module[cls](h.canvas,h.status);g.renderer.setTouchControlsVisible(false);
  ids=g.objects.bodies.filter((b:any)=>b.kind==='switch').map((b:any)=>b.id);if(scene==='alivio')ids.push('relief-lid');
  const frame=createCanvas(320,180),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
  const panel=createCanvas(640,300),p=panel.getContext('2d');p.imageSmoothingEnabled=false;
  for(const [index,id]of ids.entries()){
   g.load(g.stage.id);
   const lid=id==='relief-lid',body=lid?{x:240,y:160,width:48,height:16}:g.objects.get(id);
   const cx=scene==='prefeito'?0:Math.max(0,body.x-104),cy=scene==='prefeito'?64:body.y-112;
   const target=lid?g.objects.get('relief-service-grate'):g.objects.get(body.link??'');
   positions[id]={x:body.x,y:body.y,cx,cy,target:target?.id};
   const movie=process.env.GUAIRA_STUDY_MOVIES!=='0'&&(scene==='travessia'||scene==='patio'||scene==='respiros')&&index===0;
   const folder=join(out,scene+'-'+index+'-'+version);if(movie)mkdirSync(folder,{recursive:true});
   const frames:Buffer[]=[];
   const paint=()=>{
    const state=JSON.stringify({o:g.objects,l:g.level.data,r:g.routing,m:g.mayor});
    c.clearRect(0,0,320,180);const island=ISLANDS[g.stage.world-1];
    g.art.background(c,island,cx,cy,g.objects.time,g.stage.number);
    g.art.structures(c,g.objects,cx,cy,g.level);
    g.art.terrain(c,g.level,island,cx,cy,g.objects.time,false);
    g.art.objects(c,g.objects,cx,cy,g.objects.time,g.stage.world,g.level,false);
    for(const pickup of g.stage.pickups)if(pickup.kind==='coin')g.renderer.drawCoin(pickup.x-cx,pickup.y-cy,g.objects.time,c);
    for(const foe of g.foes)g.art.foe(c,foe,cx,cy,g.objects.time);
    c.fillStyle='#24302c';c.fillRect(0,0,320,23);
    pixelText(c,scene.toUpperCase()+' / '+(index+1)+'  '+(version?'DEPOIS':'ANTES'),8,8,'#f2dfaf');
    assert.equal(JSON.stringify({o:g.objects,l:g.level.data,r:g.routing,m:g.mayor}),state,'painting is read-only');
    return frame.toBuffer('image/png');
   };
   for(let n=0;n<240;n++){
    if(n===30||n===150){
     if(lid){if(n===30){g.level.data.tiles[10][16]=TileType.EMPTY;target.active=true;}}
     else if(scene!=='prefeito')assert.ok(g.objects.activate(id));
    }
    if(g.routing&&id.startsWith('junction-')){
     g.routing.step(g.objects.get('junction-entry-plate').active?'a':'b',1000/30);
     g.applySupply();
    }
    g.objects.update(1000/30,g.level,body.x);
    if([0,31,120].includes(n)||movie){
     const png=paint();if([0,31,120].includes(n))frames.push(png);
     if(movie){
      // Native-scale view at left and a strictly nearest-neighbour detail at right.
      p.fillStyle='#24302c';p.fillRect(0,0,640,300);p.drawImage(frame,0,0);
      p.drawImage(frame,Math.round(body.x-cx)-12,Math.round(body.y-cy)-24,56,40,360,56,224,160);
      pixelText(p,'DETALHE 4X',360,32,'#f2dfaf');pixelText(p,'ESTUDO DE ARTE',8,220,'#c1c7ad');
      pixelText(p,'ACIONAMENTO E REARME REAIS',8,234,'#c1c7ad');
      writeFileSync(join(folder,String(n).padStart(4,'0')+'.png'),panel.toBuffer('image/png'));
     }
    }
   }
   captures[version].set(id,frames);
  }
  g.dispose();for(const f of clean.reverse())f();
 }
 const sheet=createCanvas(960,ids.length*2*204),s=sheet.getContext('2d');s.imageSmoothingEnabled=false;
 s.fillStyle='#24302c';s.fillRect(0,0,sheet.width,sheet.height);
 for(const [index,id]of ids.entries()){
  for(const version of [0,1])for(let phase=0;phase<3;phase++){
   const frame=await loadImage(captures[version].get(id)![phase]),x=phase*320,y=(index*2+version)*204;
   s.drawImage(frame,x,y+24);pixelText(s,(version?'DEPOIS':'ANTES')+' '+(scene==='prefeito'?'EM REPOUSO':['REPOUSO','ACIONADO','RESPOSTA'][phase]),x+8,y+7,'#f2dfaf');
  }
  report.push({scene,id,...positions[id],actorIncluded:false,authoredInspection:true});
 }
 writeFileSync(join(out,scene+'-controls.png'),sheet.toBuffer('image/png'));console.log(scene,ids.length);
}
writeFileSync(join(out,'studies.json'),JSON.stringify({kind:'authored-interactables-inspection',controls:report,baselineHashes:hashes},null,2)+'\n');
