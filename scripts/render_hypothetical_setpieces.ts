/** Art direction study: authored scenic times, not a gameplay or difficulty test. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {HypotheticalBackdrop} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {drawHypotheticalBackground} from '../src/adventure/hipotetico/HypotheticalArt';
import {SCENIC_STARTS,DESTRUCTION_SITES,devastationAt} from '../src/adventure/hipotetico/HypotheticalDevastation';
import {SIEGE_SECTORS} from '../src/adventure/hipotetico/HypotheticalSiege';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {pixelText} from '../src/graphics/BitmapFont';
const [directory,canvasModule]=process.argv.slice(2),out=resolve(directory);
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)});
const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const frames=[-12,0,8,20,32,52,82,140],names=['cais','arsenal','bastiao'];
const models=names.map((_,i)=>{
    const backdrop=new HypotheticalBackdrop(true),start=SCENIC_STARTS[i+1];
    backdrop.x=devastationAt(start).x;backdrop.tick=start;
    return new HypotheticalModel('siege',9,0,0,false,backdrop);
});
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const board=createCanvas(1280,720),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
bc.fillStyle='#102731';bc.fillRect(0,0,1280,720);
const film=createCanvas(960,204),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const labels=['PREPARAR','CONTATO','RACHADURA','PAREDE','QUEDA','TELHADO','POEIRA','RUINA'];
const captures:Array<{file:string;scene:string;age:number}>=[];
try{
 for(let local=0;local<=320;local++){
    fc.fillStyle='#102731';fc.fillRect(0,0,960,204);
    for(const [i,b] of models.entries()){
        b.tick=SCENIC_STARTS[i+1]+local;b.backdrop.update(b.tick);b.backgroundX=b.backdrop.x;
        const age=local-180,site=DESTRUCTION_SITES[i+2],cx=site.x-152;
        drawHypotheticalBackground(c,b,cx,64,false);
        if(local%2===0){
            fc.drawImage(screen,i*320,24);
            pixelText(fc,names[i].toUpperCase(),i*320+12,9,'#e2c28b');
        }
        const shot=frames.indexOf(age);
        if(shot>=0){
            const file=`${names[i]}-${labels[shot].toLowerCase()}.png`;
            writeFileSync(join(out,file),screen.toBuffer('image/png'));captures.push({file,scene:names[i],age});
            // Two frames per column: 4 columns, 6 rows; native 320x180 art.
            const bx=(shot%4)*320,by=i*240+(shot<4?0:120);
            bc.drawImage(screen,0,24,320,100,bx,by+20,320,100);
            pixelText(bc,names[i].toUpperCase()+' / '+labels[shot],bx+6,by+7,'#e2c28b');
        }
    }
    if(local%2===0)writeFileSync(join(out,'frames',String(local/2).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
 }
 writeFileSync(join(out,'direction-board.png'),board.toBuffer('image/png'));
 writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'authored render study',gameplayTest:false,
    cameras:names.map((scene,i)=>({scene,x:DESTRUCTION_SITES[i+2].x-152,sector:SIEGE_SECTORS[i+1].origin})),
    frames:161,fps:30,captures},null,2));
 console.log(JSON.stringify({output:out,frames:161,captures:captures.length}));
}finally{for(const f of clean.reverse())f();}
