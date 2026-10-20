/** Native art plates with authored camera and warning times.
 * No game loop, input, assertions or browser automation is run here. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {hypotheticalStage} from '../src/adventure/hipotetico/HypotheticalStage';
import {WorldLevel,WorldObjects} from '../src/adventure/WorldPhysics';
import {drawHypotheticalBackground,drawHypotheticalTerrain,drawHypotheticalObjects} from '../src/adventure/hipotetico/HypotheticalArt';
import {pixelText} from '../src/graphics/BitmapFont';

const [destination,canvasModule]=process.argv.slice(2),out=resolve(destination),stills=process.argv.includes('--stills');
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(960,588),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,816),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
const details=createCanvas(1160,944),dc=details.getContext('2d');dc.imageSmoothingEnabled=false;
bc.fillStyle=dc.fillStyle='#122830';bc.fillRect(0,0,1280,816);dc.fillRect(0,0,1160,944);
const stage=hypotheticalStage('chase'),level=new WorldLevel(stage.level),objects=new WorldObjects(stage.mechanisms);
const scenes=[{name:'cais',camera:90,first:0,label:'CAIS / ROTINA E VENTO'},
    {name:'carga',camera:1290,first:3,label:'CARGA / MADEIRA E TECIDOS'},
    {name:'comportas',camera:2490,first:6,label:'COMPORTAS / BOMBAS E VAPOR'},
    {name:'portaria',camera:3690,first:9,label:'PORTARIA / PEDRA E SINAIS'}];
const paint=(b:HypotheticalModel,cx:number,cy=64,reduced=false)=>{
    drawHypotheticalBackground(c,b,cx,cy,reduced);
    drawHypotheticalTerrain(c,level,b,cx,cy);
    drawHypotheticalObjects(c,objects,b,cx,cy,reduced);
};
let outputFrame=0;
try{
    for(const [i,scene]of scenes.entries()){
        const b=new HypotheticalModel('chase');b.x=scene.camera-200;
        for(let frame=0;frame<360;frame+=2){
            if(stills&&![60,170,202,232,300].includes(frame))continue;
            b.tick=720+frame;
            b.chaseReactions.fill(-1);
            for(let j=scene.first;j<scene.first+3;j++)if(frame>=180+(j-scene.first)*22)b.chaseReactions[j]=900+(j-scene.first)*22;
            paint(b,scene.camera);
            if(!stills){
                fc.fillStyle='#122830';fc.fillRect(0,0,960,588);fc.drawImage(screen,0,48,960,540);
                pixelText(fc,scene.label,16,10,'#e2c28b',2);
                pixelText(fc,'CENA DIRIGIDA / '+(frame<180?'ANTES DO ALERTA':'REACAO DO CAIS')+' / SEM COMBATE',16,34,'#b6c5b7');
                writeFileSync(join(out,'frames',String(outputFrame++).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
            }
            if([60,170,202,232,300].includes(frame))writeFileSync(join(out,scene.name+'-'+frame+'.png'),screen.toBuffer('image/png'));
            const moment=[60,202,232,300].indexOf(frame);
            if(moment>=0){
                const x=moment*320,y=i*204;
                bc.drawImage(screen,x,y+24);
                pixelText(bc,scene.name.toUpperCase()+' / '+['ROTINA','ALERTA','RESPOSTA','REPOUSO'][moment],x+8,y+8,'#e2c28b');
            }
            if(frame===60){
                const dx=i%2*580,dy=Math.floor(i/2)*472;
                dc.drawImage(screen,48,40,145,108,dx,dy+40,580,432);pixelText(dc,scene.name.toUpperCase()+' / DETALHE 4X',dx+12,dy+14,'#e2c28b',2);
                paint(b,scene.camera,64,true);writeFileSync(join(out,scene.name+'-reduced.png'),screen.toBuffer('image/png'));
                paint(b,scene.camera,112);writeFileSync(join(out,scene.name+'-vertical.png'),screen.toBuffer('image/png'));
            }
        }
        console.log('Composed '+scene.name);
    }
    writeFileSync(join(out,'chase-atmosphere.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'chase-details.png'),details.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'directed native art',fps:30,seconds:24,frames:outputFrame,
        browser:false,gameplay:false,audio:false,warningAt:180,scenes,
        scope:'Native chase scenery, terrain and mechanisms. Fixed authored viewpoints and staggered warning; foreground actors omitted to expose environment.'},null,2));
}finally{for(const cleanup of clean.reverse())cleanup();}
