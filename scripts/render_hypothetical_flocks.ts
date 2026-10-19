/** Directed native art footage. Held player positions, no browser, assertions
 * or combat simulation; clips are performances chosen by the game's director. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {HypotheticalBackdrop} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {drawHypotheticalBackground} from '../src/adventure/hipotetico/HypotheticalArt';
import {AFTERMATH_YARDS} from '../src/adventure/hipotetico/HypotheticalAftermath';
import {SCENIC_STARTS} from '../src/adventure/hipotetico/HypotheticalDevastation';
import {pixelText} from '../src/graphics/BitmapFont';

const [directory,canvasModule]=process.argv.slice(2),out=resolve(directory);
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const names=['PORTARIA','CAIS','ARSENAL'];
const scenes=names.map((name,i)=>{
    const backdrop=new HypotheticalBackdrop(true),yard=AFTERMATH_YARDS[i],start=SCENIC_STARTS[i];
    for(let tick=start;tick<start+yard.start;tick++)backdrop.update(tick);
    const model=new HypotheticalModel('siege',9,i,0,true,backdrop);
    return {name,model,player:{x:yard.origin+210,y:198,width:16,height:26},recording:null as null|{key:string;start:number;frames:number}};
});
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(640,408),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,612),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
bc.fillStyle='#102630';bc.fillRect(0,0,1280,612);
const detail=createCanvas(1280,752),dc=detail.getContext('2d');dc.imageSmoothingEnabled=false;
dc.fillStyle='#102630';dc.fillRect(0,0,1280,752);
const keys=['abertura','pisada','rugido','cauda'],seen=new Set<string>(),framesByKey:Record<string,number>={};
const clips:object[]=[],poses:object[]=[],captures:object[]=[],transitions:object[]=[];
const moments=[46,96,178];
const detailMoments=[74,96,128,158];
try{
    for(let step=0;step<18000;step++){
        if(seen.size===4&&scenes.every(s=>!s.recording))break;
        for(const s of scenes){
            const a=s.model.backdrop.aftermath,previous=a.phase;
            s.model.update(1000/60,s.player,2);
            if(a.phase!==previous)transitions.push({yard:s.name,step,phase:a.phase,action:a.action,variant:a.variant});
            const key=a.phase==='flush'?'abertura':a.phase==='perform'&&a.action==='flush-fire'?keys[1+a.variant%3]:null;
            if(key&&a.age===1&&!seen.has(key)&&!s.recording){
                seen.add(key);s.recording={key,start:a.tick,frames:0};
                mkdirSync(join(out,'frames',key),{recursive:true});
                clips.push({key,yard:s.name,ambientStart:a.tick,action:a.action,variant:a.variant,story:s.model.backdrop.tick});
                console.log('Composing '+key+' in '+s.name);
            }
            const shot=s.recording;if(!shot)continue;
            drawHypotheticalBackground(c,s.model,a.cameraFor(s.player.x),64,false);
            const frame=shot.frames++;
            fc.fillStyle='#102630';fc.fillRect(0,0,640,408);fc.drawImage(screen,0,48,640,360);
            pixelText(fc,s.name+' / '+shot.key.toUpperCase(),16,12,'#dfba7d',2);
            pixelText(fc,(frame/60).toFixed(1)+' S / ANIMACAO NATIVA',16,34,'#aebfb3');
            writeFileSync(join(out,'frames',shot.key,String(frame).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
            if(moments.includes(frame)){
                const file=shot.key+'-'+frame+'.png';writeFileSync(join(out,file),screen.toBuffer('image/png'));
                const x=keys.indexOf(shot.key)*320,y=moments.indexOf(frame)*204;
                bc.drawImage(screen,x,y+24);pixelText(bc,shot.key.toUpperCase()+' / '+frame,x+8,y+8,'#dfba7d');
                captures.push({file,key:shot.key,frame});
            }
            if(detailMoments.includes(frame)){
                const x=keys.indexOf(shot.key)*320,y=detailMoments.indexOf(frame)*188;
                dc.drawImage(screen,142,18,160,82,x,y+24,320,164);
                pixelText(dc,shot.key.toUpperCase()+' / '+frame,x+8,y+8,'#dfba7d');
            }
            if(frame%6===0)poses.push({key:shot.key,frame,phase:a.phase,age:a.age,action:a.action,
                aim:a.pose(false).aim,barrel:a.barrel,shots:a.shots.map(p=>({...p})),
                birds:a.yard.flock.birds.map(b=>({id:b.id,state:b.state,x:b.x,y:b.y,hitAt:b.hitAt})),
                remains:a.yard.flock.remains.length});
            if(shot.frames>=240){framesByKey[shot.key]=shot.frames;s.recording=null;}
        }
    }
    writeFileSync(join(out,'activity-board.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'flight-board.png'),detail.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'directed native art footage',gameplayTest:false,
        heldPlayers:true,foregroundCombat:false,audio:false,fps:60,framesByKey,clips,captures,poses,transitions},null,2));
    console.log(JSON.stringify({output:out,framesByKey,clips}));
}finally{for(const f of clean.reverse())f();}
