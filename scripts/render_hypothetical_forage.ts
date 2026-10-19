/** Native animation authoring: held-player compositions, no gameplay input,
 * assertions, browser automation or difficulty evaluation. */
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
const scenes=['portaria','cais','arsenal','bastiao'].map((name,i)=>{
    const backdrop=new HypotheticalBackdrop(true),yard=AFTERMATH_YARDS[i],start=SCENIC_STARTS[i];
    for(let tick=start;tick<start+yard.start;tick++)backdrop.update(tick);
    return {name,model:new HypotheticalModel('siege',9,i,0,true,backdrop),
        player:{x:yard.origin+210,y:198,width:16,height:26},start:-1,frames:0};
});
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(640,408),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1600,816),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
const detail=createCanvas(1600,736),dc=detail.getContext('2d');dc.imageSmoothingEnabled=false;
bc.fillStyle='#102630';bc.fillRect(0,0,1600,816);dc.fillStyle='#102630';dc.fillRect(0,0,1600,736);
const clips:object[]=[],poses:object[]=[],cues:object[]=[],captures:object[]=[];
try{
    for(let step=0;step<8400;step++){
        if(scenes.every(s=>s.frames>=360))break;
        for(const [i,s] of scenes.entries()){
            if(s.frames>=360)continue;
            const a=s.model.backdrop.aftermath;
            s.model.update(1000/60,s.player,2);
            const f=a.yard?.forage;
            if(!f)continue;
            if(s.start<0&&a.phase==='forage'&&f.age===1){
                s.start=a.tick;mkdirSync(join(out,'frames',s.name),{recursive:true});
                clips.push({yard:s.name,variant:f.variant,start:a.tick,story:s.model.backdrop.tick});
                console.log('Composing '+s.name+' / '+f.variant);
            }
            if(s.start<0)continue;
            const frame=s.frames++;
            for(const event of a.events)cues.push({yard:s.name,frame,event});
            drawHypotheticalBackground(c,s.model,a.cameraFor(s.player.x),64,false);
            fc.fillStyle='#102630';fc.fillRect(0,0,640,408);fc.drawImage(screen,0,48,640,360);
            pixelText(fc,s.name.toUpperCase()+' / '+(f.variant===0?'FAREJAR E RECOLHER':'RUIDO E RETOMADA'),16,12,'#dfba7d',2);
            pixelText(fc,(frame/60).toFixed(1)+' S / COMPOSICAO NATIVA',16,34,'#aebfb3');
            writeFileSync(join(out,'frames',s.name,String(frame).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
            const shots=[{at:28,label:'ATENCAO'},{at:96+f.offset,label:'APOIO'},
                {at:140+f.offset,label:'OCLUSAO'},{at:236+f.offset,label:'RECUPERACAO'},{at:280+f.offset,label:'CONTINUIDADE'}];
            const shot=shots.find(q=>q.at===frame);
            if(shot){
                const file=s.name+'-'+shot.label.toLowerCase()+'.png';writeFileSync(join(out,file),screen.toBuffer('image/png'));
                const x=shots.indexOf(shot)*320,y=i*204;
                bc.drawImage(screen,x,y+24);pixelText(bc,s.name.toUpperCase()+' / '+shot.label,x+7,y+8,'#dfba7d');
                dc.drawImage(screen,116,44,160,80,x,i*184+24,320,160);
                pixelText(dc,s.name.toUpperCase()+' / '+shot.label,x+7,i*184+8,'#dfba7d');
                captures.push({file,yard:s.name,frame,age:f.age,phase:a.phase});
                if(shot.label==='OCLUSAO'){
                    drawHypotheticalBackground(c,s.model,a.cameraFor(s.player.x),64,true);
                    writeFileSync(join(out,s.name+'-reduced.png'),screen.toBuffer('image/png'));
                }
            }
            if(frame%6===0)poses.push({yard:s.name,frame,phase:a.phase,actorX:a.x,
                age:f.age,variant:f.variant,pose:a.pose(false),jaw:a.jawAnchor,cover:f.cover,
                target:f.targetX,removedAt:f.entry.removedAt,person:{...f.entry.person}});
        }
    }
    writeFileSync(join(out,'storyboard.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'detail-board.png'),detail.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'directed native art footage',gameplayTest:false,
        heldPlayers:true,foregroundCombat:false,audio:false,fps:60,
        frames:scenes.map(s=>({yard:s.name,frames:s.frames})),clips,captures,cues,poses},null,2));
    console.log(JSON.stringify({output:out,frames:scenes.map(s=>({yard:s.name,frames:s.frames})),clips}));
}finally{for(const f of clean.reverse())f();}
