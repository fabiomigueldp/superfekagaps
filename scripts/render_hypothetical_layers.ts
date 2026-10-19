/** Directed native compositing plates. Actor blocking and scene ages are
 * authored here; this is not gameplay, a test suite or browser automation. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {HypotheticalBackdrop} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {drawHypotheticalBackground} from '../src/adventure/hipotetico/HypotheticalArt';
import {AFTERMATH_YARDS} from '../src/adventure/hipotetico/HypotheticalAftermath';
import {SCENIC_STARTS} from '../src/adventure/hipotetico/HypotheticalDevastation';
import {BASTION_TOWER} from '../src/adventure/hipotetico/HypotheticalTower';
import {pixelText} from '../src/graphics/BitmapFont';

const [directory,canvasModule]=process.argv.slice(2),out=resolve(directory);
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(640,408),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,1020),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
const details=createCanvas(1280,1020),dc=details.getContext('2d');dc.imageSmoothingEnabled=false;
bc.fillStyle=dc.fillStyle='#102630';bc.fillRect(0,0,1280,1020);dc.fillRect(0,0,1280,1020);
const plates=[{name:'chegada',district:0,center:180,story:200},
    ...['portaria','cais','arsenal','bastiao'].map((name,district)=>({name,district,
        center:district===3?BASTION_TOWER.x:AFTERMATH_YARDS[district].origin+245,
        story:SCENIC_STARTS[district]+AFTERMATH_YARDS[district].start+24}))];
const records:object[]=[];
try{
    for(const [row,plate] of plates.entries()){
        const b=new HypotheticalBackdrop(true);
        for(let t=1;t<=plate.story;t++)b.update(t);
        const model=new HypotheticalModel('siege',9,plate.district,0,true,b),a=b.aftermath;
        a.active=true;a.district=plate.district;a.phase='patrol';a.facing=1;a.velocity=.7;
        const yard=a.yard;
        // Stage existing damaged props, without starting any new encounter.
        if(plate.name!=='chegada'){
            yard.damage=2;yard.shiftedAt=80;yard.brokenAt=120;yard.environment.wet=.7;
            for(const prop of yard.props)prop.wear=2;
        }
        if(plate.district===3){
            a.tower.impactAt=1;a.tower.tick=361;a.tower.age=500;
            a.tower.destruction.start(-1);
            for(let age=1;age<=360;age++)a.tower.destruction.step(age);
        }
        const camera=plate.center-160,folder=join(out,'frames',plate.name);
        mkdirSync(folder,{recursive:true});
        for(let frame=0;frame<240;frame++){
            a.tick=600+frame;a.age=frame%74;a.travel=frame*.7;
            a.x=plate.center-84+frame*.7;model.backgroundX=a.x;
            drawHypotheticalBackground(c,model,camera,64,false);
            fc.fillStyle='#102630';fc.fillRect(0,0,640,408);fc.drawImage(screen,0,48,640,360);
            pixelText(fc,plate.name.toUpperCase()+' / CAMADAS DO CENARIO',16,12,'#dfba7d',2);
            pixelText(fc,(frame/60).toFixed(1)+' S / TRAVESSIA DIRIGIDA',16,34,'#aebfb3');
            writeFileSync(join(folder,String(frame).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
            const col=[30,90,150,210].indexOf(frame);
            if(col>=0){
                const x=col*320,y=row*204,file=plate.name+'-'+frame+'.png';
                writeFileSync(join(out,file),screen.toBuffer('image/png'));
                bc.drawImage(screen,x,y+24);pixelText(bc,plate.name.toUpperCase()+' / '+frame,x+7,y+8,'#dfba7d');
                dc.drawImage(screen,80,58,160,90,x,y+24,320,180);
                pixelText(dc,plate.name.toUpperCase()+' / '+frame,x+7,y+8,'#dfba7d');
                records.push({scene:plate.name,frame,file,actorX:a.x,cameraX:camera,story:b.tick});
                if(frame===90){
                    drawHypotheticalBackground(c,model,camera,64,true);
                    writeFileSync(join(out,plate.name+'-reduced.png'),screen.toBuffer('image/png'));
                    drawHypotheticalBackground(c,model,camera,112,false);
                    writeFileSync(join(out,plate.name+'-vertical.png'),screen.toBuffer('image/png'));
                }
            }
        }
        console.log('Composed '+plate.name);
    }
    writeFileSync(join(out,'layers-board.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'layers-detail.png'),details.toBuffer('image/png'));
    writeFileSync(join(out,'layers-study.json'),JSON.stringify({kind:'directed compositing plates',
        gameplayTest:false,browser:false,audio:false,fps:60,framesPerScene:240,
        staged:'Rear scenery history; authored walk across static remnants; settled tower physics; no foreground combat.',records},null,2));
}finally{for(const cleanup of clean.reverse())cleanup();}
