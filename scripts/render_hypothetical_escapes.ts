/** Directed native animation footage, with held player positions. No browser,
 * gameplay input, assertions or difficulty evaluation. */
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
const names=['portaria','cais','arsenal','bastiao'];
const scenes=names.map((name,i)=>{
    const backdrop=new HypotheticalBackdrop(true),yard=AFTERMATH_YARDS[i],start=SCENIC_STARTS[i];
    for(let tick=start;tick<start+yard.start;tick++)backdrop.update(tick);
    return {name,model:new HypotheticalModel('siege',9,i,0,true,backdrop),
        player:{x:yard.origin+210,y:198,width:16,height:26},start:-1,frames:0};
});
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(640,408),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,816),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
bc.fillStyle='#102630';bc.fillRect(0,0,1280,816);
const detail=createCanvas(1280,736),dc=detail.getContext('2d');dc.imageSmoothingEnabled=false;
dc.fillStyle='#102630';dc.fillRect(0,0,1280,736);
const shots=[{at:32,label:'ESCONDERIJO'},{at:84,label:'FUGA'},{at:132,label:'PERSEGUICAO'},{at:214,label:'CONSEQUENCIA'}];
const clips:object[]=[],poses:object[]=[],cues:object[]=[],captures:object[]=[];
try{
    for(let step=0;step<7200;step++){
        if(scenes.every(s=>s.frames>=300))break;
        for(const [i,s] of scenes.entries()){
            if(s.frames>=300)continue;
            const a=s.model.backdrop.aftermath;
            s.model.update(1000/60,s.player,2);
            if(s.start<0&&a.phase==='pursuit'&&a.yard.escape.age===1){
                s.start=a.tick;mkdirSync(join(out,'frames',s.name),{recursive:true});
                clips.push({yard:s.name,kind:a.yard.escape.entry.kind,start:a.tick,story:s.model.backdrop.tick});
                console.log('Composing '+s.name+' / '+a.yard.escape.entry.kind);
            }
            if(s.start<0)continue;
            const e=a.yard.escape,frame=s.frames++;
            for(const event of a.events)cues.push({yard:s.name,frame,event});
            drawHypotheticalBackground(c,s.model,a.cameraFor(s.player.x),64,false);
            fc.fillStyle='#102630';fc.fillRect(0,0,640,408);fc.drawImage(screen,0,48,640,360);
            pixelText(fc,s.name.toUpperCase()+' / '+(e.entry.kind==='rubble'?'ESCOMBROS':'ESCOTILHA'),16,12,'#dfba7d',2);
            pixelText(fc,(frame/60).toFixed(1)+' S / COMPOSICAO NATIVA',16,34,'#aebfb3');
            writeFileSync(join(out,'frames',s.name,String(frame).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
            const shot=shots.find(q=>q.at===frame);
            if(shot){
                const file=s.name+'-'+frame+'.png';writeFileSync(join(out,file),screen.toBuffer('image/png'));
                const x=shots.indexOf(shot)*320,y=i*204;
                bc.drawImage(screen,x,y+24);pixelText(bc,s.name.toUpperCase()+' / '+shot.label,x+7,y+8,'#dfba7d');
                const detailY=i*184;
                dc.drawImage(screen,116,44,160,80,x,detailY+24,320,160);
                pixelText(dc,s.name.toUpperCase()+' / '+shot.label,x+7,detailY+8,'#dfba7d');
                captures.push({file,yard:s.name,frame,age:e.age,phase:a.phase});
            }
            if(frame%6===0)poses.push({yard:s.name,frame,phase:a.phase,actorX:a.x,velocity:a.velocity,
                age:e.age,kind:e.entry.kind,aim:a.pose(false).aim,person:{...e.entry.person},
                opening:e.opening(e.entry),shots:a.shots.map(p=>({...p})),marks:e.entry.marks});
        }
    }
    writeFileSync(join(out,'storyboard.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'detail-board.png'),detail.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'directed native art footage',gameplayTest:false,
        heldPlayers:true,foregroundCombat:false,audio:false,fps:60,
        frames:scenes.map(s=>({yard:s.name,frames:s.frames})),clips,captures,cues,poses},null,2));
    console.log(JSON.stringify({output:out,frames:scenes.map(s=>({yard:s.name,frames:s.frames})),clips}));
}finally{for(const f of clean.reverse())f();}
