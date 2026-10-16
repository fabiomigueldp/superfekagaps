/** Production-renderer comparisons; authored poses are separate from unedited native-input replays.
 * node --import tsx scripts/prove_guaira_connections.ts OUTPUT CANVAS_MODULE BASELINE
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import { GuairaTraversal, GUAIRA_TRAVERSAL as G } from '../src/adventure/experimental/guaira/GuairaTraversal';
import * as current from '../src/adventure/experimental/guaira/GuairaTraversalArt';
import { GuairaRespiros } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import * as respirosArt from '../src/adventure/experimental/guaira/respiros/GuairaRespirosArt';
import { pixelText } from '../src/graphics/BitmapFont';

interface Canvas { width:number; height:number; getContext(type:'2d'):CanvasRenderingContext2D; toBuffer(type:'image/png'):Buffer }
const [outArg,canvasArg,baselineArg]=process.argv.slice(2);
assert.ok(outArg&&canvasArg&&baselineArg);
const out=resolve(outArg),baseline=resolve(baselineArg),root=resolve('src/adventure/experimental/guaira');
mkdirSync(out,{recursive:true});
const {createCanvas,loadImage}=await import(pathToFileURL(resolve(canvasArg)).href) as {
    createCanvas(w:number,h:number):Canvas; loadImage(bytes:Buffer):Promise<CanvasImageSource>;
};
const hashes:Record<string,string>={},prepared=new Set<string>();
function previous(name:string):string {
    const file=join(out,`baseline-${name}.ts`); if(prepared.has(name))return file; prepared.add(name);
    const source=readFileSync(join(baseline,name+'.ts'),'utf8');
    hashes[name]=createHash('sha256').update(source).digest('hex');
    writeFileSync(file,source.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>{
        const folder=name==='GuairaRespirosArt'?'respiros':'.';
        const dep=basename(relative),target=existsSync(join(baseline,dep+'.ts'))?previous(dep):resolve(root,folder,relative+'.ts');
        return `from ${JSON.stringify(pathToFileURL(target).href)}`;
    })); return file;
}
const old=await import(pathToFileURL(previous('GuairaTraversalArt')).href) as typeof current;
const cleanups:Array<()=>void>=[],h=guairaBrowser({after:fn=>cleanups.push(fn as ()=>void)});
for(const target of [h.window,h.document,h.canvas])Object.assign(target,{removeEventListener(){}});
const screen=createCanvas(640,360);h.canvas.getContext=()=>screen.getContext('2d');
const create=h.document.createElement;
h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1) as unknown as ReturnType<typeof create>:create(tag);
const game=new GuairaTraversal(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
game.renderer.setTouchControlsVisible(false);game.store.save.preferences.shake=false;
const native={...game.art},frame=createCanvas(320,180),fc=frame.getContext('2d');fc.imageSmoothingEnabled=false;
const fresh=(w:number,height:number)=>{const canvas=createCanvas(w,height),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#302b35';c.fillRect(0,0,w,height);return{canvas,c};};
function capture(before:boolean|null,reduced=false) {
    if(before===null)Object.assign(game.art,native);
    else {
        const a=before?old:current;
        game.art.background=(c,_i,x,y)=>a.drawGuairaTraversalBackground(c,x,y,game.objects.time,reduced,
            !!game.objects.get(G.bridgeId)?.active,!!game.objects.get(G.finalBridgeId)?.active);
        game.art.terrain=(c,level,_i,x,y)=>a.drawGuairaTraversalTerrain(c,level,x,y,game.objects.time,reduced);
        game.art.objects=(c,objects,x,y)=>a.drawGuairaTraversalObjects(c,objects,x,y,objects.time,reduced);
    }
    const state=()=>JSON.stringify({p:game.player.data,o:game.objects,camera:game.camera,save:game.store.save,tiles:game.level.data.tiles});
    const beforeState=state();game.render();assert.equal(state(),beforeState);
    fc.drawImage(screen as unknown as CanvasImageSource,0,0,320,180);return frame.toBuffer('image/png');
}
const poses=[
    {key:'rua-fechada',final:false,active:false,y:336},
    {key:'rua-subindo',final:false,active:true,y:280},
    {key:'rua-pronta',final:false,active:true,y:224},
    {key:'arroz-fechada',final:true,active:false,y:336},
    {key:'arroz-subindo',final:true,active:true,y:280},
    {key:'arroz-pronta',final:true,active:true,y:224},
];
function pose(p:typeof poses[number]) {
    game.load(G.id);game.player.data.respawnRevealTimer=0;
    game.camera.x=p.final?1088:368;game.camera.y=p.final?96:108;
    game.player.data.position.x=p.final?1384:656;game.player.data.position.y=(p.final?192:224)-game.player.data.height;
    game.time=game.objects.time=1400;
    if(p.final){const a=game.objects.get(G.bridgeId)!;a.active=true;a.y=a.py=224;game.objects.get(G.valveId)!.active=true;}
    const body=game.objects.get(p.final?G.finalBridgeId:G.bridgeId)!;body.active=p.active;body.y=body.py=p.y;
    game.objects.get(p.final?G.finalValveId:G.valveId)!.active=p.active;
}
const snapshots:object[]=[],replays:object[]=[],sheet=fresh(1280,2304);
for(const[row,p]of poses.entries()) {
    pose(p);
    for(const[col,before]of[true,false].entries()) {
        const png=capture(before);writeFileSync(join(out,`${p.key}-${before?'before':'after'}.png`),png);
        pixelText(sheet.c,`${before?'ANTES':'DEPOIS'} / ${p.key.toUpperCase()}`,col*640+8,row*384+8,'#f0ddae');
        sheet.c.drawImage(await loadImage(png),col*640,row*384+24,640,360);
    }
    const first=capture(false);assert.ok(first.equals(capture(false)));
    const reduced=capture(false,true);game.objects.time+=300;assert.ok(reduced.equals(capture(false,true)));
    snapshots.push({...p,camera:{x:game.camera.x,y:game.camera.y},stateUnchanged:true,deterministic:true,reducedStable:true,authoredPose:true});
}
writeFileSync(join(out,'comparacoes.png'),sheet.canvas.toBuffer('image/png'));
for(const final of[false,true]) {
    const p=poses[final?4:1],key=final?'arroz':'rua',folder=join(out,key+'-motion');mkdirSync(folder,{recursive:true});pose(p);
    const b=game.objects.get(final?G.finalBridgeId:G.bridgeId)!;
    for(let i=0;i<120;i++) {
        game.time=game.objects.time=i*1000/30;b.y=b.py=Math.max(224,336-i*55/30);
        const pair=fresh(1280,384);
        for(const[col,before]of[true,false].entries()) {
            pixelText(pair.c,`${before?'ANTES':'DEPOIS'} / ${key==='rua'?'RUA DA VALA':'CANAL DO ARROZ'}`,col*640+8,8,'#f0ddae');
            pair.c.drawImage(await loadImage(capture(before)),col*640,24,640,360);
        }
        writeFileSync(join(folder,`${String(i).padStart(4,'0')}.png`),pair.canvas.toBuffer('image/png'));
    }
}
for(const [key,file] of [['taipas','guairaTraversalReplay.json'],['manutencao','guairaTraversalMaintenanceReplay.json']] as const) {
    const recording=JSON.parse(readFileSync(join('tests/helpers',file),'utf8')) as {stepMs:number;runs:Array<[number,string[]]>};
    game.load(G.id);let held=new Set<string>(),updates=0,images=0;const folder=join(out,key+'-replay');mkdirSync(folder,{recursive:true});
    const event=(type:string,code:string)=>h.window.dispatch(type,{code,key:code==='Space'?' ':code,target:h.canvas});
    for(const[count,keys]of recording.runs) {
        const next=new Set(keys);for(const code of held)if(!next.has(code))event('keyup',code);for(const code of next)if(!held.has(code))event('keydown',code);held=next;
        for(let i=0;i<count;i++,updates++) {
            game.update(recording.stepMs);assert.equal(game.player.data.hasHelmet,true);assert.equal(game.player.data.isDead,false);
            if(updates%4===0)writeFileSync(join(folder,`${String(images++).padStart(4,'0')}.png`),capture(null));
        }
    }
    for(const code of held)event('keyup',code);assert.equal(game.finished,true);
    writeFileSync(join(out,key+'-complete.png'),capture(null));
    replays.push({key,updates,images,fps:15,finished:true,damage:false,manualPoseOrClockChanges:false});
}
game.dispose();cleanups.reverse().forEach(fn=>fn());
{
    const oldRespiros=await import(pathToFileURL(previous('GuairaRespirosArt')).href) as typeof respirosArt;
    const cleanup:Array<()=>void>=[],host=guairaBrowser({after:fn=>cleanup.push(fn as ()=>void)});
    for(const target of[host.window,host.document,host.canvas])Object.assign(target,{removeEventListener(){}});
    const display=createCanvas(640,360);host.canvas.getContext=()=>display.getContext('2d');
    const create=host.document.createElement;
    host.document.createElement=tag=>tag==='canvas'?createCanvas(1,1) as unknown as ReturnType<typeof create>:create(tag);
    const scene=new GuairaRespiros(host.canvas as unknown as HTMLCanvasElement,host.status as unknown as HTMLElement);
    scene.renderer.setTouchControlsVisible(false);scene.store.save.preferences.shake=false;
    const native={...scene.art},nativeFrame=createCanvas(320,180),c=nativeFrame.getContext('2d');c.imageSmoothingEnabled=false;
    const capture=(before:boolean|null,reduced=false)=>{
        if(before===null)Object.assign(scene.art,native);
        else {
            const a=before?oldRespiros:respirosArt;
            scene.art.background=(c,_i,x,y)=>a.drawRespirosBackground(c,x,y,scene.objects.time,reduced);
            scene.art.terrain=(c,l,_i,x,y)=>a.drawRespirosTerrain(c,l,x,y);
            scene.art.objects=(c,o,x,y)=>a.drawRespirosObjects(c,o,x,y,o.time,reduced);
        }
        const state=()=>JSON.stringify({p:scene.player.data,o:scene.objects,camera:scene.camera,save:scene.store.save});
        const snapshot=state();scene.render();assert.equal(state(),snapshot);c.drawImage(display as unknown as CanvasImageSource,0,0,320,180);
        return nativeFrame.toBuffer('image/png');
    };
    const pose=(time:number)=>{
        scene.load(scene.stage.id);scene.player.data.respawnRevealTimer=0;
        scene.camera.x=0;scene.camera.y=144;scene.player.data.position.x=120;scene.player.data.position.y=304-scene.player.data.height;
        scene.time=scene.objects.time=time;
    };
    const details=fresh(1280,1536);
    for(const[row,[key,time]]of ([['respiros-seco',0],['respiros-aviso',1799],['respiros-inicio',1800],['respiros-jato',2100]] as const).entries()) {
        pose(time);
        for(const[col,before]of[true,false].entries()) {
            const png=capture(before);writeFileSync(join(out,`${key}-${before?'before':'after'}.png`),png);
            pixelText(details.c,`${before?'ANTES':'DEPOIS'} / ${key.toUpperCase()}`,col*640+8,row*384+8,'#f0ddae');
            details.c.drawImage(await loadImage(png),col*640,row*384+24,640,360);
        }
        const first=capture(false);assert.ok(first.equals(capture(false)));
        // Inspect the reduced art separately from the native avatar's idle pose.
        // Pressure is gameplay state and remains fixed at this authored phase.
        const reducedArt=(presentation:number)=>{
            const p=fresh(320,180);
            respirosArt.drawRespirosBackground(p.c,0,144,presentation,true);
            respirosArt.drawRespirosObjects(p.c,scene.objects,0,144,presentation,true);
            return p.canvas.toBuffer('image/png');
        };
        assert.ok(reducedArt(0).equals(reducedArt(99999)));
        snapshots.push({key,time,camera:{x:0,y:144},deterministic:true,stateUnchanged:true,reducedStable:true,authoredPose:true});
    }
    writeFileSync(join(out,'respiros-comparacoes.png'),details.canvas.toBuffer('image/png'));
    pose(0);const motion=join(out,'respiros-motion');mkdirSync(motion,{recursive:true});
    for(let i=0;i<126;i++) {
        scene.time=scene.objects.time=i*1000/30;const pair=fresh(1280,384);
        for(const[col,before]of[true,false].entries()) {
            pixelText(pair.c,`${before?'ANTES':'DEPOIS'} / RESPIROS`,col*640+8,8,'#f0ddae');
            pair.c.drawImage(await loadImage(capture(before)),col*640,24,640,360);
        }
        writeFileSync(join(motion,`${String(i).padStart(4,'0')}.png`),pair.canvas.toBuffer('image/png'));
    }
    const recording=JSON.parse(readFileSync('tests/helpers/guairaRespirosReplay.json','utf8')) as {stepMs:number;initialSettleFrames?:number;runs:Array<[number,string[]]>};
    scene.load(scene.stage.id);for(let i=0;i<(recording.initialSettleFrames??0);i++)scene.update(recording.stepMs);
    let held=new Set<string>(),updates=0,images=0;const folder=join(out,'respiros-replay');mkdirSync(folder,{recursive:true});
    const event=(type:string,code:string)=>host.window.dispatch(type,{code,key:code==='Space'?' ':code,target:host.canvas});
    for(const[count,keys]of recording.runs) {
        const next=new Set(keys);for(const code of held)if(!next.has(code))event('keyup',code);for(const code of next)if(!held.has(code))event('keydown',code);held=next;
        for(let i=0;i<count;i++,updates++) {
            scene.update(recording.stepMs);assert.equal(scene.player.data.hasHelmet,true);assert.equal(scene.player.data.isDead,false);
            if(updates%4===0)writeFileSync(join(folder,`${String(images++).padStart(4,'0')}.png`),capture(null));
        }
    }
    for(const code of held)event('keyup',code);assert.equal(scene.finished,true);writeFileSync(join(out,'respiros-complete.png'),capture(null));
    replays.push({key:'respiros',updates,images,fps:15,finished:true,damage:false,manualPoseOrClockChanges:false});
    scene.dispose();cleanup.reverse().forEach(fn=>fn());
}
const report={hashes,snapshots,replays,motion:{authored:true,fps:30,frames:{rua:120,arroz:120,respiros:126}}};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
