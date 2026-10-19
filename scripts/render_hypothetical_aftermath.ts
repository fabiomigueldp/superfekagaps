/** Native art study with held player positions; not a playthrough or a difficulty test. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HypotheticalBackdrop} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {drawHypotheticalBackground} from '../src/adventure/hipotetico/HypotheticalArt';
import {AFTERMATH_YARDS} from '../src/adventure/hipotetico/HypotheticalAftermath';
import {SCENIC_STARTS} from '../src/adventure/hipotetico/HypotheticalDevastation';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {pixelText} from '../src/graphics/BitmapFont';
const [destination,canvasModule]=process.argv.slice(2),out=resolve(destination);
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)});
const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const names=['portaria','cais','arsenal','bastiao'];
const scenes=names.map((name,i)=>{
    const backdrop=new HypotheticalBackdrop(true),start=SCENIC_STARTS[i],yard=AFTERMATH_YARDS[i];
    for(let tick=start;tick<start+yard.start;tick++)backdrop.update(tick);
    const model=new HypotheticalModel('siege',9,i,0,true,backdrop);
    const player={x:yard.origin+252,y:198,width:16,height:26};
    return {name,model,player,cameraX:player.x-132,seen:new Set<string>(),samples:[] as object[]};
});
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(640,408),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,640),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
bc.fillStyle='#102731';bc.fillRect(0,0,1280,640);
const shots=[{phase:'search',age:76,label:'farejar'},{phase:'rummage',age:58,label:'investigar'},
    {phase:'flush',age:68,label:'reagir'},{phase:'turn-out',age:22,label:'virar'},
    {phase:'patrol',age:60,label:'patrulhar'},{phase:'survey',age:50,label:'observar'}];
const captures:object[]=[],transitions:object[]=[];
try{
    for(let step=0;step<2160;step++){
        if(step%3===0){fc.fillStyle='#102731';fc.fillRect(0,0,640,408);}
        for(const [i,s] of scenes.entries()){
            const a=s.model.backdrop.aftermath,previous=a.phase;
            s.model.update(1000/60,s.player,2);
            if(a.phase!==previous)transitions.push({scene:s.name,step,phase:a.phase,cycle:a.cycle});
            if(step%120===0)s.samples.push({step,story:s.model.backdrop.tick,ambient:a.tick,phase:a.phase,age:a.age,
                x:a.x,cleared:s.model.route.cleared,damage:a.yards[i].damage});
            const shot=shots.find(x=>x.phase===a.phase&&x.age===a.age&&!s.seen.has(x.label));
            if(step%3!==0&&!shot)continue;
            drawHypotheticalBackground(c,s.model,s.cameraX,64,false);
            if(step%3===0){
                const x=i%2*320,y=Math.floor(i/2)*204;
                fc.drawImage(screen,x,y+24);pixelText(fc,s.name.toUpperCase(),x+10,y+9,'#e2c28b');
            }
            if(shot){
                s.seen.add(shot.label);const file=s.name+'-'+shot.label+'.png';
                writeFileSync(join(out,file),screen.toBuffer('image/png'));
                captures.push({file,step,story:s.model.backdrop.tick,phase:a.phase,age:a.age,cycle:a.cycle});
                const column=shots.indexOf(shot);
                if(column<4){
                    const x=column*320,y=i*160;
                    bc.drawImage(screen,0,0,320,136,x,y+24,320,136);
                    pixelText(bc,s.name.toUpperCase()+' / '+shot.label.toUpperCase(),x+7,y+9,'#e2c28b');
                }
            }
        }
        if(step%3===0)writeFileSync(join(out,'frames',String(step/3).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
    }
    writeFileSync(join(out,'activity-board.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'authored native renderer study',gameplayTest:false,
        frames:720,fps:20,seconds:36,heldPlayers:true,captures,transitions,
        scenes:scenes.map(s=>({name:s.name,cameraX:s.cameraX,playerX:s.player.x,samples:s.samples}))},null,2));
    console.log(JSON.stringify({output:out,frames:720,captures:captures.length}));
}finally{for(const f of clean.reverse())f();}
