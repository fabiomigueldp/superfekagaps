/** Directed native art footage. Held viewpoints, no foreground combat, no assertions. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HypotheticalBackdrop} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {drawHypotheticalBackground} from '../src/adventure/hipotetico/HypotheticalArt';
import {AFTERMATH_YARDS} from '../src/adventure/hipotetico/HypotheticalAftermath';
import {aftermathActionTiming,type AftermathAction} from '../src/adventure/hipotetico/HypotheticalAftermathScore';
import {isHandling,handlingTiming,AFTERMATH_SCALE} from '../src/adventure/hipotetico/HypotheticalAftermathHandling';
import {SCENIC_STARTS} from '../src/adventure/hipotetico/HypotheticalDevastation';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {pixelText} from '../src/graphics/BitmapFont';

const [destination,canvasModule]=process.argv.slice(2),out=resolve(destination);
const stills=process.argv.includes('--stills');
const weight=process.argv.includes('--weight'),study=weight?'weight':'material';
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(640,408),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,720),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
bc.fillStyle='#102731';bc.fillRect(0,0,1280,720);
const scenes:Array<{district:number;kind:string;title:string;action?:AftermathAction;wet?:boolean}>=weight?
    [{district:0,kind:'weight-shake',title:'SACUDIDA / PORTARIA',action:'shake'},
    {district:1,kind:'weight-sift',title:'PEDRA / CAIS',action:'sift'},
    {district:2,kind:'weight-wrench',title:'CHAPA / ARSENAL',action:'wrench',wet:true},
    {district:3,kind:'weight-breach',title:'INVESTIDA / BASTIAO',action:'breach'}]
    :[{district:0,kind:'creak',title:'MADEIRA / PORTARIA'},
    {district:1,kind:'settle',title:'PEDRA / CAIS'},{district:3,kind:'rattle',title:'METAL / BASTIAO'},
    {district:2,kind:'leak',title:'VAZAMENTO / ARSENAL'}];
const clips:object[]=[],captures:object[]=[];
let frame=0;
try{
    for(const [row,s] of scenes.entries()){
        const yard=AFTERMATH_YARDS[s.district],backdrop=new HypotheticalBackdrop(true),start=SCENIC_STARTS[s.district];
        for(let tick=start;tick<start+yard.start;tick++)backdrop.update(tick);
        const model=new HypotheticalModel('siege',9,s.district,0,true,backdrop);
        const player={x:yard.origin+210,y:198,width:16,height:26},a=model.backdrop.aftermath;
        let preRoll=0;
        for(;preRoll<36000;preRoll++){
            model.update(1000/60,player,2);
            if(weight?a.phase==='perform'&&a.age===0&&a.action===s.action&&(!s.wet||a.yard.environment.wet>0)
                :a.phase==='notice'&&a.age===0&&a.reaction?.kind===s.kind)break;
        }
        if(preRoll===36000){clips.push({...s,available:false});console.log('No authored cue available: '+s.kind);continue;}
        const begin=frame,seen=new Set<number>(),changes:object[]=[];
        let previous='',clipSteps=0;
        for(;clipSteps<720;clipSteps++){
            const timing=aftermathActionTiming(a.action,a.variant);
            const handling=isHandling(a.action)?handlingTiming(a.action):null;
            const contact=weight&&a.action==='shake'?138:handling?Math.min(112,handling.release-12):timing.beats[0]??timing.shots[0]??40;
            const settle=handling?Math.min(timing.duration-6,handling.release+44):contact+42;
            const following=weight?a.action===s.action:a.motivation?.kind===s.kind;
            const column=weight?(a.phase==='perform'&&following?(a.age===8?0:a.age===25?1:a.age===contact?2:a.age===settle?3:-1):-1)
                :a.phase==='notice'&&a.age===10?0:a.phase==='notice'&&a.age===36?1:
                following&&a.phase==='perform'&&a.age===contact?2:following&&a.phase==='perform'&&a.age===settle?3:-1;
            const key=a.phase+':'+a.action;
            if(key!==previous){changes.push({step:clipSteps,phase:a.phase,action:a.action,prop:a.targetProp,motivation:a.motivation?.kind});previous=key;}
            const filming=!stills&&clipSteps%2===0;
            if(filming||column>=0&&!seen.has(column)){
                drawHypotheticalBackground(c,model,a.cameraFor(player.x),64,false);
                if(filming){
                    fc.fillStyle='#102731';fc.fillRect(0,0,640,408);
                    fc.drawImage(screen,0,48,640,360);pixelText(fc,s.title,16,14,'#e2c28b',2);
                    writeFileSync(join(out,'frames',String(frame++).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
                }
                if(column>=0&&!seen.has(column)){
                    seen.add(column);const file=s.kind+'-'+column+'.png';
                    writeFileSync(join(out,file),screen.toBuffer('image/png'));
                    const x=column*320,y=row*180;
                    bc.drawImage(screen,0,0,320,156,x,y+24,320,156);
                    pixelText(bc,s.title.split(' / ')[0]+' / '+(weight?['PREPARAR','APOIAR','FORCAR','ASSENTAR']:['PERCEBER','REAGIR','AGIR','ASSENTAR'])[column],x+8,y+9,'#e2c28b');
                    const pose=a.pose(false);
                    captures.push({file,step:clipSteps,phase:a.phase,age:a.age,action:a.action,prop:a.targetProp,
                        rootX:a.x,feet:pose.feet?.map(p=>({x:a.x+a.facing*p[0]*AFTERMATH_SCALE,y:pose.lift+p[1]*AFTERMATH_SCALE})),
                        impulses:a.yard.environment.impulses.map(p=>({...p}))});
                }
            }
            if(following&&a.phase==='recover'&&a.age===18&&(weight||clipSteps>300))break;
            model.update(1000/60,player,2);
        }
        clips.push({...s,preRoll,firstFrame:begin,frames:frame-begin,steps:clipSteps,changes,reaction:a.reaction});
        console.log(JSON.stringify({scene:s.title,frames:frame-begin,poses:seen.size,preRoll}));
    }
    writeFileSync(join(out,study+'-board.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,study+'-study.json'),JSON.stringify({kind:'directed native art footage',gameplayTest:false,
        heldViewpoints:true,audio:false,foregroundCombat:false,fps:30,frames:frame,seconds:frame/30,clips,captures},null,2));
}finally{for(const f of clean.reverse())f();}
