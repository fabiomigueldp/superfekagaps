/** Input-only proof of the mayor's three routes, with production pixels and physics. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {guairaMayorBrowser} from '../tests/helpers/guairaMayorHarness';
import {MAYOR_ARENA as A} from '../src/adventure/experimental/guaira/GuairaMayorModel';
import {pixelText} from '../src/graphics/BitmapFont';
const [outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg,'OUTPUT and CANVAS module required');
const {createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href);
const out=resolve(outArg);mkdirSync(out,{recursive:true});
const report:any={nativeInputOnly:true,actorOrClockEdits:false,stepMs:1000/60,captureFps:60,baseline:!!baselineArg,sourceHashes:{},routes:{}};
const prepared=new Set<string>();
function previous(sourceFile:string):string{
 const name=basename(sourceFile),file=join(out,'previous-'+name);if(prepared.has(name))return file;prepared.add(name);
 const source=readFileSync(join(resolve(baselineArg!),name),'utf8');report.sourceHashes[name]=createHash('sha256').update(source).digest('hex');
 writeFileSync(file,source.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>{
  const target=resolve(dirname(sourceFile),relative+'.ts');
  return 'from '+JSON.stringify(pathToFileURL(existsSync(join(resolve(baselineArg!),basename(target)))?previous(target):target).href);
 }));return file;
}
const {GuairaMayorLab}=await import(pathToFileURL(baselineArg?previous(resolve('src/adventure/experimental/guaira/GuairaMayorLab.ts')):resolve('src/adventure/experimental/guaira/GuairaMayorLab.ts')).href);
const rhythm=process.env.GUAIRA_MAYOR_PROOF==='rhythm';
const crosscurrent=rhythm||process.env.GUAIRA_MAYOR_PROOF==='crosscurrent';
const marks=new Map<number,string>(crosscurrent?[[496,'JATO ALTO'],[525,'COMANDO'],[548,'DISPARO'],[600,'JATO BAIXO'],[650,'TRAVESSIA'],[664,'SALTO E NOVO ALVO'],[756,'CARIMBADA'],[800,'ONDA'],[1093,'ULTIMO LACRE'],[1218,'ALTURA ALTERNADA'],[1288,'DIRECAO INVERTIDA'],[1708,'AGUA LIBERADA']]:[[102,'ALVO FIXO'],[178,'SALTO'],[200,'IMPACTO'],[236,'RETORNO'],[588,'CARIMBADA NO CHAO'],[632,'SALTO SOBRE A ONDA'],[646,'PRESSAO DESVIADA'],[716,'CONTRA-ATAQUE'],[776,'DESCARGA NA EMENDA'],[1041,'SEGUNDO ALVO'],[1111,'SEGUNDA CARIMBADA'],[1329,'AGUA LIBERADA']]);
const routes=[['upper','guairaMayorReplay'],['wait','guairaMayorJumpPulseReplay'],['ground','guairaMayorGroundReplay']];
if(crosscurrent)routes.push(['interrupt','guairaMayorInterruptReplay']);
if(rhythm)routes.push(['retry','guairaMayorRetryReplay']);
const retryMarks=new Map([[1062,'NOVA SEQUENCIA'],[1108,'BAIXO DA DIREITA'],[1146,'PROXIMO JATO ALTO'],[1192,'ALTURA DIFERENTE'],[1230,'CARIMBO MIRADO'],[1346,'REFUGIO CONTRA A ONDA'],[1589,'REGISTRO TARDIO'],[1598,'TEMPO PARA SUBIR'],[1659,'ABERTURA REAL'],[1719,'DESCARGA DA EMENDA'],[1779,'CONTRA-ATAQUE'],[2476,'AGUA DO BAIRRO']]);
for(const [key,file]of baselineArg?[['before','baseline-mayor-replay']]:routes){
 const cleanup:Array<()=>void>=[],h=guairaMayorBrowser({after:f=>cleanup.push(f as ()=>void)});
 for(const o of [h.window,h.document,h.canvas])Object.assign(o,{removeEventListener(){}});
 const screen=createCanvas(640,360),frame=createCanvas(320,180),atlas=createCanvas(1280,612),fc=frame.getContext('2d'),ac=atlas.getContext('2d');
 fc.imageSmoothingEnabled=ac.imageSmoothingEnabled=false;ac.fillStyle='#1f262b';ac.fillRect(0,0,1280,612);
 h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):create(tag);
 const g=new GuairaMayorLab(h.canvas,h.status);g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
 const tape=JSON.parse(readFileSync(baselineArg?join(dirname(resolve(baselineArg)),file+'.json'):'tests/helpers/'+file+'.json','utf8'));
 const dir=join(out,key+'-frames');mkdirSync(dir,{recursive:true});
 let n=0,video=0,atlasIndex=0,lastState='',seals=3;
 const audit:any={frames:0,hits:[],events:[],minHead:Infinity,damage:[],screens:[]};
 for(const [count,keys]of tape.runs){h.keys(keys);for(let i=0;i<count;i++){
  g.update(1000/60);n++;const m=g.mayor,p=g.player.data;
  audit.minHead=Math.min(audit.minHead,Math.round(p.position.y)-Math.round(g.camera.y)-4);
  if(p.isDead||!p.hasHelmet)audit.damage.push(n);
  if(m.sealsRemaining<seals){audit.hits.push(n);seals=m.sealsRemaining;}
  const state=m.state+':'+m.strike+':'+(m.counterpressure?.phase??'')+':'+(m.salvo?.shot??'');
  if(state!==lastState){audit.events.push({frame:n,state,target:m.stampTarget,player:{...p.position},boss:{x:m.x,y:m.y}});lastState=state;}
  {
   const before=JSON.stringify({p:g.player.data,m:g.mayor,o:g.objects,c:g.camera});g.render();
   assert.equal(JSON.stringify({p:g.player.data,m:g.mayor,o:g.objects,c:g.camera}),before,'painting is read-only');
   fc.drawImage(screen,0,0,320,180);
   writeFileSync(join(dir,String(++video).padStart(5,'0')+'.png'),frame.toBuffer('image/png'));
   const selected=key==='retry'?retryMarks:marks;
   if((key==='ground'||key==='retry')&&selected.has(n)){
    const file=key+'-'+n+'.png';writeFileSync(join(out,file),frame.toBuffer('image/png'));
    audit.screens.push({frame:n,file,caption:selected.get(n)});
    // Copy pixels now: deferred drawImage may otherwise retain the reusable
    // frame canvas and silently replace an earlier atlas cell with a later pose.
    const x=atlasIndex%4*320,y=Math.floor(atlasIndex/4)*204;ac.putImageData(fc.getImageData(0,0,320,180),x,y+24);
    pixelText(ac,selected.get(n)!,x+6,y+8,'#f4dca9');atlasIndex++;
   }
   if(key==='interrupt'&&[526,553,571,642,838,875,945,1068].includes(n))writeFileSync(join(out,'interrupt-'+n+'.png'),frame.toBuffer('image/png'));
  }
 }}
 assert.equal(g.mayor.publicWaterOpen,true);assert.deepEqual(audit.hits,tape.hitFrames??[322,652,982]);
 assert.equal(audit.damage.length,0);assert.ok(audit.minHead>=26);assert.equal(g.mayor.danger,null);
 assert.ok(g.player.data.position.x<100);assert.equal(g.player.data.position.y+g.player.data.height,A.floor);
 audit.frames=n;audit.videoFrames=video;audit.finished=true;report.routes[key]=audit;
 if(key==='ground')writeFileSync(join(out,'combat-atlas.png'),atlas.toBuffer('image/png'));
 if(key==='retry')writeFileSync(join(out,'retry-atlas.png'),atlas.toBuffer('image/png'));
 g.dispose();for(const clean of cleanup.reverse())clean();
 console.log(key,JSON.stringify({frames:n,hits:audit.hits,minHead:audit.minHead,damage:0}));
}
writeFileSync(join(out,'proof.json'),JSON.stringify(report,null,2)+'\n');
