/** Directed native art footage: held camera, no player combat, browser or assertions. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {drawHypotheticalBackground} from '../src/adventure/hipotetico/HypotheticalArt';
import {HELICOPTER_SEQUENCE} from '../src/adventure/hipotetico/HypotheticalHelicopterTiming';
import {pixelText} from '../src/graphics/BitmapFont';

const [directory,canvasModule]=process.argv.slice(2),out=resolve(directory);
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const model=new HypotheticalModel('siege'),a=model.backdrop.helicopter;
const player={x:48,y:198,width:16,height:26},screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(640,408),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,612),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
bc.fillStyle='#102630';bc.fillRect(0,0,1280,612);
const shots=[{kind:'scene',at:42,name:'entrada'},{kind:'scene',at:88,name:'saque'},
    {kind:'scene',at:140,name:'mira'},{kind:'scene',at:HELICOPTER_SEQUENCE.fire,name:'disparo'},
    {kind:'flight',at:14,name:'voo'},{kind:'impact',at:4,name:'impacto'},
    {kind:'impact',at:25,name:'ruptura'},{kind:'impact',at:52,name:'queda'},
    {kind:'crash',at:2,name:'contato'},{kind:'crash',at:25,name:'assentamento'},
    {kind:'scene',at:350,name:'destrocos'},{kind:'scene',at:400,name:'retomada'}];
const seen=new Set<string>(),captures:object[]=[],cues:object[]=[],poses:object[]=[];
let frames=0;
try{
    for(let step=0;step<HELICOPTER_SEQUENCE.start+480;step++){
        model.update(1000/60,player,2);
        if(a.age<0)continue;
        for(const cue of a.events)cues.push({age:a.age,seconds:a.age/60,cue});
        const shot=shots.find(s=>!seen.has(s.name)&&(s.kind==='scene'?a.age:s.kind==='flight'?a.launchAt<0?-1:a.tick-a.launchAt:s.kind==='impact'?a.impactAge:a.crashAge)===s.at);
        if(a.age%12===0)poses.push({age:a.age,hull:{...a.hull},launcher:a.launcher,
            projectile:a.rocket?{...a.rocket}:null,pieces:a.pieces.map(p=>({...p})),
            firstGate:model.forecourt,arrival:model.arrival,storyTick:model.backdrop.tick});
        if(a.age%2!==0&&!shot)continue;
        drawHypotheticalBackground(c,model,0,64,false);
        if(shot){
            seen.add(shot.name);const file=shot.name+'.png';writeFileSync(join(out,file),screen.toBuffer('image/png'));
            const index=shots.indexOf(shot),x=index%4*320,y=Math.floor(index/4)*204;
            bc.drawImage(screen,x,y+24);pixelText(bc,shot.name.toUpperCase(),x+10,y+9,'#dfba7d');
            captures.push({file,age:a.age,seconds:a.age/60,impactAge:a.impactAge,crashAge:a.crashAge});
        }
        if(a.age%2===0){
            fc.fillStyle='#102630';fc.fillRect(0,0,640,408);fc.drawImage(screen,0,48,640,360);
            pixelText(fc,'CHEGADA / HELICOPTERO',16,12,'#dfba7d',2);
            pixelText(fc,(a.age/60).toFixed(1)+' S / COMPOSICAO NATIVA',16,34,'#aebfb3');
            writeFileSync(join(out,'frames',String(frames++).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
        }
    }
    writeFileSync(join(out,'storyboard.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'directed native art footage',gameplayTest:false,
        heldCamera:true,audio:false,foregroundCombat:false,fps:30,frames,seconds:frames/30,
        arrivalStart:HELICOPTER_SEQUENCE.start,launchAt:a.launchAt,impactAt:a.impactAt,crashAt:a.crashAt,captures,cues,poses},null,2));
    console.log(JSON.stringify({output:out,frames,captures:captures.length,impactAt:a.impactAt,crashAt:a.crashAt}));
}finally{for(const f of clean.reverse())f();}
