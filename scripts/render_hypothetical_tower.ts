/** Authored native art sequence, without player input, browser or gameplay assertions. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {HypotheticalBackdrop} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {drawHypotheticalBackground} from '../src/adventure/hipotetico/HypotheticalArt';
import {SCENIC_STARTS} from '../src/adventure/hipotetico/HypotheticalDevastation';
import {SIEGE_SECTORS} from '../src/adventure/hipotetico/HypotheticalSiege';
import {pixelText} from '../src/graphics/BitmapFont';

const [directory,canvasModule]=process.argv.slice(2),out=resolve(directory);
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const backdrop=new HypotheticalBackdrop(true);
backdrop.update(SCENIC_STARTS[3]);
const model=new HypotheticalModel('siege',9,3,0,true,backdrop),a=backdrop.aftermath,t=a.tower;
const player={x:SIEGE_SECTORS[3].origin+190,y:198,width:16,height:26},cameraX=player.x-132;
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(640,384),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,408),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
bc.fillStyle='#102630';bc.fillRect(0,0,1280,408);
const shots=[{kind:'sequence',at:1,name:'torre'},{kind:'sequence',at:58,name:'sacar'},
    {kind:'sequence',at:120,name:'mirar'},{kind:'launch',at:10,name:'disparo'},
    {kind:'impact',at:4,name:'explosao'},{kind:'impact',at:68,name:'ruptura'},
    {kind:'impact',at:126,name:'queda'},{kind:'impact',at:250,name:'ruinas'}];
const seen=new Set<string>(),captures:object[]=[],cues:object[]=[],samples:object[]=[];
let first=-1,frames=0;
try{
    for(let step=0;step<3000;step++){
        model.update(1000/60,player,2);
        if(t.age===0&&first<0)first=step;
        if(first<0)continue;
        const elapsed=step-first;if(elapsed>=1200)break;
        for(const event of t.events)cues.push({frame:elapsed,seconds:elapsed/60,event});
        const shot=shots.find(s=>!seen.has(s.name)&&(s.kind==='sequence'?t.age:s.kind==='launch'?t.launchAt<0?-1:t.tick-t.launchAt:t.impactAge)===s.at);
        if(elapsed%60===0)samples.push({frame:elapsed,phase:a.phase,age:t.age,impactAge:t.impactAge,action:a.action,
            destroyed:t.destroyed,rocket:t.rocket?{...t.rocket}:null,launcher:a.launcherPose});
        if(elapsed%2!==0&&!shot)continue;
        drawHypotheticalBackground(c,model,cameraX,64,false);
        if(shot){
            seen.add(shot.name);const file=shot.name+'.png';writeFileSync(join(out,file),screen.toBuffer('image/png'));
            captures.push({file,frame:elapsed,age:t.age,impactAge:t.impactAge});
            const index=shots.indexOf(shot),x=index%4*320,y=Math.floor(index/4)*204;
            bc.putImageData(c.getImageData(0,0,320,180),x,y+24);pixelText(bc,shot.name.toUpperCase(),x+10,y+9,'#dfba7d');
        }
        if(elapsed%2===0){
            fc.fillStyle='#102630';fc.fillRect(0,0,640,384);
            pixelText(fc,'BASTIAO / TORRE   '+(elapsed/60).toFixed(1)+' S',14,9,'#dfba7d');
            fc.drawImage(screen,0,24,640,360);
            writeFileSync(join(out,'frames',String(frames++).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
        }
    }
    writeFileSync(join(out,'storyboard.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'authored native scenic composition',gameplayTest:false,
        fps:30,frames,seconds:frames/30,cameraX,playerX:player.x,first,captures,cues,samples},null,2));
    console.log(JSON.stringify({output:out,frames,captures:captures.length}));
}finally{for(const f of cleanup.reverse())f();}
