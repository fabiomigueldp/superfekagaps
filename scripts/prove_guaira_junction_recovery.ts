/** Production pixels for the Pátio service stair. Native tapes and prepared
 * comparisons are separate. Usage: OUTPUT CANVAS_MODULE BASELINE_DIRECTORY. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {basename,dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import type {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GUAIRA_JUNCTION as G} from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import tapes from '../tests/helpers/guairaJunctionRecoveryReplays.json';
type Run=[number,string[]];
interface Canvas {width:number;height:number;getContext(type:'2d'):CanvasRenderingContext2D;toBuffer(type:'image/png'):Buffer}
const[outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baselineArg);
const out=resolve(outArg),baseline=resolve(baselineArg),root=resolve('src/adventure/experimental/guaira/junction');
mkdirSync(out,{recursive:true});
const{createCanvas}=await import(pathToFileURL(resolve(canvasArg)).href)as{createCanvas(w:number,h:number):Canvas};
const beforeHashes:Record<string,string>={},currentHashes:Record<string,string>={},prepared=new Set<string>();
const hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
function previous(sourceFile:string):string {
    const name=basename(sourceFile),file=join(out,'previous-'+name);
    if(prepared.has(name))return file;prepared.add(name);
    const source=readFileSync(join(baseline,name),'utf8');beforeHashes[name]=hash(source);currentHashes[name]=hash(readFileSync(sourceFile));
    writeFileSync(file,source.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>{
        const target=resolve(dirname(sourceFile),relative+'.ts');
        return `from ${JSON.stringify(pathToFileURL(existsSync(join(baseline,basename(target)))?previous(target):target).href)}`;
    }));return file;
}
const comparisons:object[]=[],records:object[]=[];
for(const before of [true,false]) {
    const source=join(root,'GuairaJunction.ts');
    const Scene=(await import(pathToFileURL(before?previous(source):source).href)).GuairaJunction as
        new(c:HTMLCanvasElement,s:HTMLElement)=>GuairaJunction;
    const cleanups:Array<()=>void>=[],h=guairaBrowser({after:fn=>cleanups.push(fn as()=>void)});
    for(const target of[h.window,h.document,h.canvas])Object.assign(target,{removeEventListener(){}});
    const screen=createCanvas(640,360),frame=createCanvas(320,180),fc=frame.getContext('2d');fc.imageSmoothingEnabled=false;
    h.canvas.getContext=()=>screen.getContext('2d');const create=h.document.createElement;
    h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1)as unknown as ReturnType<typeof create>:create(tag);
    const g=new Scene(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
    g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
    const state=()=>JSON.stringify({p:g.player.data,o:g.objects,camera:g.camera,route:g.routing,t:g.time,coins:g.coins});
    const capture=()=>{const before=state();g.render();assert.equal(state(),before);fc.drawImage(screen as unknown as CanvasImageSource,0,0,320,180);return frame.toBuffer('image/png');};
    let held=new Set<string>();
    function keys(list:string[]){const next=new Set(list);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,key:k==='Space'?' ':k,target:h.canvas});for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,key:k==='Space'?' ':k,target:h.canvas});held=next;}
    const step=(n:number,k:string[]=[])=>{keys(k);for(let i=0;i<n;i++)g.update(1000/60);};
    function checkpoint(){for(const[n,k]of tapes.direct.runs as Run[])for(let i=0;i<n;i++){step(1,k);if(g.store.save.checkpoint){keys([]);return;}}assert.fail('checkpoint not reached');}
    try {
        for(const[name,afterCheckpoint]of [['guardada',-1],['abrindo',28],['aberta',100]]as const) {
            keys([]);g.load(G.id);if(afterCheckpoint>=0){checkpoint();step(afterCheckpoint);}
            // Explicit inspection pose, not an input-driven location.
            g.player.data.position={x:552,y:400-g.player.data.height};g.player.data.velocity={x:0,y:0};g.player.data.isGrounded=true;
            g.camera.x=384;g.camera.y=232;
            const png=capture();assert.ok(png.equals(capture()));writeFileSync(join(out,`${name}-${before?'before':'after'}.png`),png);
            comparisons.push({name,version:before?'before':'after',authoredPose:true,camera:[384,232],playerFeet:[552,400],time:g.objects.time,
                steps:g.objects.bodies.filter(b=>b.id===G.returnLowerId||b.id===G.returnUpperId).map(b=>({id:b.id,y:b.y,active:b.active}))});
        }
        if(before)continue;
        for(const route of ['direct','optional']as const) {
            keys([]);g.load(G.id);let updates=0,images=0,completeAt=0,floorAt=0,returnAt=0,minimumX=Infinity,minHelmetTop=Infinity,maxFeet=0;
            const used=new Set<string>(),folder=join(out,route+'-replay');mkdirSync(folder,{recursive:true});
            const milestones:Record<string,object>={};
            for(const[n,k]of tapes[route].runs as Run[]) {
                keys(k);for(let i=0;i<n;i++) {
                    g.update(1000/60);updates++;const p=g.player.data,feet=p.position.y+p.height;
                    assert.equal(p.isDead,false);assert.equal(p.hasHelmet,true);
                    minHelmetTop=Math.min(minHelmetTop,p.position.y-4-g.camera.y);maxFeet=Math.max(maxFeet,feet-g.camera.y);
                    if(!floorAt&&p.isGrounded&&feet===G.recoveryY&&p.position.x>G.exitGapStartX)floorAt=updates;
                    if(floorAt&&!returnAt) {
                        minimumX=Math.min(minimumX,p.position.x);
                        for(const id of[G.returnLowerId,G.returnUpperId]) {
                            const body=g.objects.get(id)!;
                            if(p.isGrounded&&Math.abs(feet-body.y)<.01&&p.position.x+p.width>body.x&&p.position.x<body.x+body.width)used.add(id);
                        }
                        if(p.isGrounded&&feet===G.middleY&&p.position.x>=384&&p.position.x<576)returnAt=updates;
                    }
                    if(g.finished&&!completeAt)completeAt=updates;
                    for(const[name,condition]of [
                        ['yard',floorAt>0&&!returnAt&&p.isGrounded&&feet===G.recoveryY&&p.position.x<560],
                        ['lower',floorAt>0&&used.has(G.returnLowerId)&&p.isGrounded&&feet===G.returnLowerY],
                        ['upper',floorAt>0&&used.has(G.returnUpperId)&&p.isGrounded&&feet===G.returnUpperY],
                        ['return',returnAt>0],['complete',g.finished]]as const)
                        if(condition&&!milestones[name]) {writeFileSync(join(out,`${route}-${name}.png`),capture());milestones[name]={frame:updates,x:p.position.x,feet,camera:{...g.camera},coins:g.coins};}
                    if((updates-1)%4===0)writeFileSync(join(folder,String(images++).padStart(4,'0')+'.png'),capture());
                }
            }
            assert.equal(g.finished,true);assert.ok(floorAt&&returnAt);assert.equal(used.size,2);
            assert.equal(g.coins,route==='optional'?3:0);
            records.push({route,updates,images,fps:15,completeAt,floorAt,returnAt,recoverySeconds:(returnAt-floorAt)/60,
                minimumX,minHelmetTop,maxFeet,used:[...used],coins:g.coins,damage:false,complete:true,nativeInput:true,
                manualPoseOrClockChanges:false,renderPure:true,milestones});
            console.log(JSON.stringify({route,updates,complete:true,recoverySeconds:(returnAt-floorAt)/60}));
        }
    } finally {g.dispose();cleanups.reverse().forEach(fn=>fn());}
}
writeFileSync(join(out,'report.json'),JSON.stringify({beforeHashes,currentHashes,comparisons,records},null,2));
