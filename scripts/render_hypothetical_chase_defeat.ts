/** Directed animation plates using native painters. No gameplay run, browser,
 * collision simulation, assertions or test runner. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {Renderer} from '../src/engine/Renderer';
import {Player} from '../src/entities/Player';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {hypotheticalStage} from '../src/adventure/hipotetico/HypotheticalStage';
import {WorldLevel} from '../src/adventure/WorldPhysics';
import {drawHypotheticalBackground,drawHypotheticalTerrain,drawHypotheticalCombat,drawHypotheticalDinosaur,dinosaurPose} from '../src/adventure/hipotetico/HypotheticalArt';
import {HypotheticalChaseDefeat,CHASE_CAPTURE,drawChasePlayerSplash} from '../src/adventure/hipotetico/HypotheticalChaseDefeat';
import {chaseCollapsedEdge} from '../src/adventure/hipotetico/HypotheticalChaseDetails';
import {CHASE_BREAKS} from '../src/adventure/hipotetico/HypotheticalLayout';
import {pixelText} from '../src/graphics/BitmapFont';

const [destination,canvasModule]=process.argv.slice(2),out=resolve(destination),stills=process.argv.includes('--stills');
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const native=createCanvas(320,180),c=native.getContext('2d');c.imageSmoothingEnabled=false;
const display=createCanvas(320,180);display.style={};const renderer=new Renderer(display);
const film=createCanvas(960,588),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,416),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
const close=createCanvas(1280,464),cc=close.getContext('2d');cc.imageSmoothingEnabled=false;
const contact=createCanvas(1280,696),hc=contact.getContext('2d');hc.imageSmoothingEnabled=false;
const causes=createCanvas(960,204),dc=causes.getContext('2d');dc.imageSmoothingEnabled=false;
for(const [ctx,w,height]of [[bc,1280,416],[cc,1280,464],[hc,1280,696],[dc,960,204]] as const){ctx.fillStyle='#122830';ctx.fillRect(0,0,w,height);}
const moments=[0,225,390,445,610,740,1010,1240],labels=['IMPACTO','ALCANCE','CONTATO','MANDIBULA','SUSTENTAR E ERGUER','CABECA ERGUIDA','ENGOLIR','EXPIRAR'];
// Freeze the pixels for a plate before reusing the source canvas for the next pose.
const snapshot=()=>{const copy=createCanvas(320,180);copy.getContext('2d').putImageData(c.getImageData(0,0,320,180),0,0);return copy;};
let movieFrame=0;
const make=(x:number,px:number,py:number)=>{
    const b=new HypotheticalModel('chase');b.x=x;b.y=224;b.tick=800;b.age=80;b.state='rest';b.travel=x+18;b.facing=1;b.velocity=3.5;b.motionSpeed=3.5;
    b.chaseBreaks=CHASE_BREAKS.map(site=>site.x<x+60?775:-1);b.chaseReactions=b.chaseReactions.map((_,i)=>i*400<x?770:-1);
    const level=new WorldLevel(hypotheticalStage('chase').level),edge=chaseCollapsedEdge(x)/16;
    for(let col=0;col<edge;col++)for(let y=13;y<18;y++)level.data.tiles[y][col]=0;
    const player=new Player(0,0).data;player.position={x:px,y:py};player.deathOrigin={...player.position};player.deathKind='hit';
    player.isDead=true;player.isGrounded=player.deathWasGrounded=py>=200;player.deathTimerMax=player.deathTimer=CHASE_CAPTURE.duration;
    const view={x:px-150,y:64,shakeTimer:0};
    return {b,level,player,view};
};
const writeMovie=(name:string)=>{
    if(stills)return;
    fc.fillStyle='#122830';fc.fillRect(0,0,960,588);fc.drawImage(native,0,48,960,540);
    pixelText(fc,name,14,11,'#e2c28b',2);pixelText(fc,'ANIMACAO DIRIGIDA / RENDERIZADORES DO JOGO / SEM PARTIDA / SEM AUDIO',14,34,'#afc1b5');
    writeFileSync(join(out,'frames',String(movieFrame++).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
};
try{
    for(const [index,scene]of [{name:'CAPTURA NO CHAO',x:440,px:455,py:200},{name:'CONTATO PROXIMO AO PEITO',x:448,px:440,py:200},{name:'CAPTURA DURANTE O SALTO',x:1040,px:1058,py:166}].entries()){
        const {b,level,player,view}=make(scene.x,scene.px,scene.py);
        const defeat=new HypotheticalChaseDefeat(dinosaurPose(b,0,0),player,view,{kind:'caught',x:scene.px,y:scene.py+12,direction:1},b.tick);
        const paint=(ms:number,reduced=false,isolated=false)=>{
            const [cx,cy]=defeat.cameraAt(ms,reduced),actor=defeat.poseAt(ms,reduced);
            const scenic=defeat.scenery(b,ms);
            if(isolated){c.fillStyle='#263f48';c.fillRect(0,0,320,180);drawHypotheticalDinosaur(c,{...actor,x:actor.x-cx,y:actor.y-cy});}
            else {drawHypotheticalBackground(c,scenic,cx,cy,reduced);drawHypotheticalTerrain(c,level,scenic,cx,cy);drawHypotheticalCombat(c,scenic,cx,cy,reduced,actor);}
            defeat.drawForeground(c,ms,cx,cy,reduced);
            if(!isolated){
                c.fillStyle='#122830';c.fillRect(0,0,320,31);pixelText(c,'FLAVIO HIPOTETICO',7,5,'#e2c28b');pixelText(c,defeat.hint,7,20,'#eae1ca');
                const focus=defeat.mouthAt(ms);renderer.drawSceneIris((ms-CHASE_CAPTURE.fade)/(CHASE_CAPTURE.black-CHASE_CAPTURE.fade),focus[0]-cx,focus[1]-cy,c);
            }
        };
        if(index===0)for(const [i,ms]of moments.entries()){
            paint(ms);writeFileSync(join(out,`capture-${i}.png`),native.toBuffer('image/png'));
            bc.drawImage(snapshot(),(i%4)*320,Math.floor(i/4)*208+28);pixelText(bc,labels[i]+' / '+ms+'MS',(i%4)*320+8,Math.floor(i/4)*208+10,'#e2c28b');
            paint(ms,false,true);cc.drawImage(snapshot(),120,52,160,104,(i%4)*320,Math.floor(i/4)*232+24,320,208);
            pixelText(cc,labels[i],(i%4)*320+8,Math.floor(i/4)*232+8,'#e2c28b');
        }
        for(const ms of [224,225,389,390]){
            paint(ms,false,true);writeFileSync(join(out,`contact-${index}-${ms}.png`),native.toBuffer('image/png'));
        }
        for(const [i,ms]of [225,390,500,1010].entries()){
            paint(ms,false,true);hc.drawImage(snapshot(),120,52,160,104,i*320,index*232+24,320,208);
            pixelText(hc,[scene.name.split(' ').slice(-1)[0],ms+'MS'].join(' / '),i*320+8,index*232+8,'#e2c28b');
        }
        if(!stills)for(let frame=0;frame<60;frame++){paint(frame*1000/30);writeMovie(scene.name);}
        paint(560,true);writeFileSync(join(out,`capture-reduced-${index}.png`),native.toBuffer('image/png'));
    }
    for(const [index,kind]of (['shot','wave','fall'] as const).entries()){
        const px=kind==='fall'?600:700;
        const {b,level,player,view}=make(px-110,px,kind==='fall'?292:200);player.deathTimerMax=kind==='fall'?1050:1500;
        player.deathKind=kind==='fall'?'fall':'hit';player.deathDirection=1;
        const defeat=new HypotheticalChaseDefeat(dinosaurPose(b,0,0),player,view,kind==='fall'?null:{kind,x:px,y:kind==='wave'?219:211,direction:1},b.tick);
        const paint=(ms:number)=>{
            player.deathTimer=player.deathTimerMax-ms;
            const scenic=defeat.scenery(b,ms);
            drawHypotheticalBackground(c,scenic,view.x,64,false);drawHypotheticalTerrain(c,level,scenic,view.x,64);
            drawHypotheticalCombat(c,scenic,view.x,64,false,defeat.poseAt(ms));renderer.drawPlayer(player,view,c);
            defeat.drawForeground(c,ms,view.x,64,false);
            if(kind==='fall')drawChasePlayerSplash(c,607,ms+180,view.x,64,false);
            c.fillStyle='#122830';c.fillRect(0,0,320,31);pixelText(c,'FLAVIO HIPOTETICO',7,5,'#e2c28b');pixelText(c,defeat.hint,7,20,'#eae1ca');
            if(kind==='fall')renderer.drawSceneIris((ms-300)/550,607-view.x,237-64,c);else renderer.drawPlayerTransition(player,view,c);
        };
        paint(90);dc.drawImage(snapshot(),index*320,24);pixelText(dc,['TIRO','ONDA BAIXA','QUEDA NO RIO'][index],index*320+8,8,'#e2c28b');
        if(!stills)for(let frame=0;frame<(kind==='fall'?34:47);frame++){paint(frame*1000/30);writeMovie(['TIRO / IMPACTO E RECUO NATIVO','ONDA / LEITURA DA DERROTA','RIO / AGUA E RETOMADA'][index]);}
    }
    writeFileSync(join(out,'capture-sequence.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'capture-details.png'),close.toBuffer('image/png'));
    writeFileSync(join(out,'capture-contact.png'),contact.toBuffer('image/png'));
    writeFileSync(join(out,'death-causes.png'),causes.toBuffer('image/png'));
    console.log(`Composed native art plates; ${movieFrame} directed frames.`);
}finally{renderer.dispose();for(const dispose of clean.reverse())dispose();}
