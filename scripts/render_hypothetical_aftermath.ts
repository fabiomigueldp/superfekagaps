/** Native art study with held player positions; not a playthrough or a difficulty test. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HypotheticalBackdrop} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {drawHypotheticalBackground} from '../src/adventure/hipotetico/HypotheticalArt';
import {AFTERMATH_YARDS} from '../src/adventure/hipotetico/HypotheticalAftermath';
import {SCENIC_STARTS} from '../src/adventure/hipotetico/HypotheticalDevastation';
import {SIEGE_WIDTH} from '../src/adventure/hipotetico/HypotheticalSiege';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {pixelText} from '../src/graphics/BitmapFont';
const [destination,canvasModule]=process.argv.slice(2),out=resolve(destination);
const orchestration=process.argv.includes('--orchestration');
const stills=process.argv.includes('--stills');
const handling=process.argv.includes('--handling')||orchestration,routines=process.argv.includes('--routines')||handling;
const steps=orchestration?7200:handling?4800:routines?3600:2160,stride=orchestration?2:3;
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
    const player={x:yard.origin+(handling?210:252),y:198,width:16,height:26};
    return {name,model,player,cameraX:player.x-132,seen:new Set<string>(),samples:[] as object[]};
});
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(640,408),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(routines?1920:1280,640),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
bc.fillStyle='#102731';bc.fillRect(0,0,board.width,640);
const shots:Array<{phase:string;age:number;label:string;action?:string}>=orchestration?
    [{phase:'perform',action:'shake',age:112,label:'sacudir'},{phase:'perform',action:'shake',age:138,label:'contrapeso'},
    {phase:'perform',action:'breach',age:52,label:'ariete'},{phase:'perform',action:'breach',age:98,label:'rajada'},
    {phase:'notice',age:20,label:'escutar'},{phase:'perform',action:'fire',age:95,label:'varrer'}]:handling?
    [{phase:'perform',action:'haul',age:34,label:'aproximar'},{phase:'perform',action:'haul',age:76,label:'firmar'},
    {phase:'perform',action:'haul',age:116,label:'erguer'},{phase:'perform',action:'haul',age:174,label:'soltar'},
    {phase:'perform',action:'sift',age:112,label:'afastar'},{phase:'perform',action:'wrench',age:114,label:'forcar'}]:routines?
    [{phase:'perform',action:'ram',age:48,label:'ariete'},{phase:'perform',action:'stomp',age:54,label:'pisada'},
    {phase:'perform',action:'rake',age:68,label:'remexer'},{phase:'perform',action:'tail',age:52,label:'caudada'},
    {phase:'perform',action:'fire',age:48,label:'rajada'},{phase:'perform',action:'bellow',age:48,label:'rugido'}]
    :[{phase:'search',age:76,label:'farejar'},{phase:'rummage',age:58,label:'investigar'},
    {phase:'flush',age:68,label:'reagir'},{phase:'turn-out',age:22,label:'virar'},
    {phase:'patrol',age:60,label:'patrulhar'},{phase:'survey',age:50,label:'observar'}];
const captures:object[]=[],transitions:object[]=[],incidents:object[]=[];
try{
    for(let step=0;step<steps;step++){
        const filming=!stills&&step%stride===0;
        if(filming){fc.fillStyle='#102731';fc.fillRect(0,0,640,408);}
        for(const [i,s] of scenes.entries()){
            if(routines&&!orchestration&&step>=steps-1200){
                // The final twenty seconds study reframing inside the same
                // courtyard; these are explicit authoring poses, not inputs.
                s.player.x=AFTERMATH_YARDS[i].origin+(handling?210:252)+(handling?90:130)*Math.sin((step-steps+1200)/1200*Math.PI*2);
                s.cameraX=Math.max(0,Math.min(SIEGE_WIDTH-320,s.player.x-132));
            }
            const a=s.model.backdrop.aftermath,previous=a.phase;
            s.model.update(1000/60,s.player,2);
            if(orchestration)s.cameraX=a.cameraFor(s.player.x);
            if(a.phase!==previous)transitions.push({scene:s.name,step,phase:a.phase,cycle:a.cycle,action:a.action,count:a.actionCount,
                targetProp:a.targetProp,variant:a.variant});
            for(const e of a.yards[i].environment.incidents)if(e.born===a.tick)incidents.push({scene:s.name,step,...e});
            if(step%120===0)s.samples.push({step,story:s.model.backdrop.tick,ambient:a.tick,phase:a.phase,age:a.age,
                x:a.x,playerX:s.player.x,cameraX:s.cameraX,cleared:s.model.route.cleared,damage:a.yards[i].damage,action:a.action,
                shots:a.shots.length,impacts:a.impacts.length,casings:a.casings.length,
                materials:handling?a.yards[i].props.map(p=>({material:p.material,piece:p.piece?{...p.piece}:null,hinge:p.hinge,wear:p.wear})):undefined});
            const shot=shots.find(x=>x.phase===a.phase&&x.age===a.age&&(!x.action||x.action===a.action)&&!s.seen.has(x.label));
            if(!filming&&!shot)continue;
            drawHypotheticalBackground(c,s.model,s.cameraX,64,false);
            const pixels=c.getImageData(0,0,320,180);
            if(filming){
                const x=i%2*320,y=Math.floor(i/2)*204;
                fc.putImageData(pixels,x,y+24);pixelText(fc,s.name.toUpperCase(),x+10,y+9,'#e2c28b');
            }
            if(shot){
                s.seen.add(shot.label);const file=s.name+'-'+shot.label+'.png';
                writeFileSync(join(out,file),screen.toBuffer('image/png'));
                captures.push({file,step,story:s.model.backdrop.tick,phase:a.phase,age:a.age,cycle:a.cycle,action:a.action,targetProp:a.targetProp});
                const column=shots.indexOf(shot);
                if(column<(routines?6:4)){
                    const x=column*320,y=i*160;
                    bc.putImageData(c.getImageData(0,0,320,136),x,y+24);
                    pixelText(bc,s.name.toUpperCase()+' / '+shot.label.toUpperCase(),x+7,y+9,'#e2c28b');
                }
            }
        }
        if(filming)writeFileSync(join(out,'frames',String(step/stride).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
    }
    writeFileSync(join(out,'activity-board.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,stills?'pose-study.json':'art-study.json'),JSON.stringify({kind:'authored native renderer study',gameplayTest:false,
        frames:stills?0:steps/stride,fps:60/stride,seconds:steps/60,heldPlayers:orchestration||!routines,
        cameraStudy:orchestration?'Held positions with the native tower camera framing':routines?(steps/60-20)+' seconds held, then 20 seconds of authored camera travel':null,
        captures,transitions,incidents,
        scenes:scenes.map(s=>({name:s.name,cameraX:s.cameraX,playerX:s.player.x,samples:s.samples}))},null,2));
    console.log(JSON.stringify({output:out,frames:stills?0:steps/stride,captures:captures.length}));
}finally{for(const f of clean.reverse())f();}
