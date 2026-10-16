/** Production comparisons and separate native-input replays for the other waterworks.
 * node --import tsx scripts/prove_guaira_network_finish.ts OUTPUT CANVAS_MODULE BASELINE [--stills]
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { WorldGame } from '../src/adventure/WorldGame';
import type { JunctionRouting } from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import type { GuairaMayorModel } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import { pixelText } from '../src/graphics/BitmapFont';
import { TileType } from '../src/constants';

interface Canvas { width:number; height:number; getContext(type:'2d'):CanvasRenderingContext2D; toBuffer(type:'image/png'):Buffer }
type Game=WorldGame & {routing?:JunctionRouting;mayor?:GuairaMayorModel;finished?:boolean};
type Pose={key:string;cx:number;cy:number;x:number;feet:number;time:number;open?:boolean;supply?:'a'|'b'};
type Run=[number,string[]];
const[outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baselineArg);
const out=resolve(outArg),baseline=resolve(baselineArg),root=resolve('src/adventure/experimental/guaira');
const stills=process.argv.includes('--stills');mkdirSync(out,{recursive:true});
const{createCanvas,loadImage}=await import(pathToFileURL(resolve(canvasArg)).href)as{
    createCanvas(w:number,h:number):Canvas;loadImage(bytes:Buffer):Promise<CanvasImageSource>;
};
const hashes:Record<string,string>={},sourceFiles:Record<string,string>={},prepared=new Set<string>();
function previous(folder:string,name:string):string {
    const file=join(out,`baseline-${name}.ts`);if(prepared.has(name))return file;prepared.add(name);
    const source=readFileSync(join(baseline,name+'.ts'),'utf8');
    hashes[name]=createHash('sha256').update(source).digest('hex');sourceFiles[name]=resolve(root,folder,name+'.ts');
    writeFileSync(file,source.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>{
        const dep=basename(relative),target=existsSync(join(baseline,dep+'.ts'))?
            previous(dirname(resolve(root,folder,relative)),dep):resolve(root,folder,relative+'.ts');
        return `from ${JSON.stringify(pathToFileURL(target).href)}`;
    }));return file;
}
const fresh=(w:number,h:number)=>{const canvas=createCanvas(w,h),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#302b35';c.fillRect(0,0,w,h);return{canvas,c};};
const definitions=[
    {key:'patio',folder:'junction',game:'GuairaJunction',art:'GuairaJunctionArt',prefix:'drawJunction',replay:'guairaJunctionReplay.json',poses:[
        {key:'patio-entrada',cx:0,cy:168,x:170,feet:304,time:1400,supply:'a'},
        {key:'patio-apoios',cx:300,cy:128,x:432,feet:256,time:1600,supply:'b'},
        {key:'patio-curva',cx:500,cy:128,x:700,feet:208,time:1600,supply:'b'}]},
    {key:'respiros',folder:'respiros',game:'GuairaRespiros',art:'GuairaRespirosArt',prefix:'drawRespiros',replay:'guairaRespirosReplay.json',poses:[
        {key:'respiros-estacao',cx:0,cy:144,x:120,feet:304,time:1400},
        {key:'respiros-arrozais',cx:320,cy:144,x:350,feet:304,time:900}]},
    {key:'alivio',folder:'relief',game:'GuairaRelief',art:'GuairaReliefArt',prefix:'drawRelief',replay:'guairaReliefReplay.json',poses:[
        {key:'alivio-fechado',cx:200,cy:176,x:352,feet:336,time:1500},
        {key:'alivio-retorno',cx:200,cy:176,x:352,feet:336,time:1500,open:true},
        {key:'alivio-coletor',cx:112,cy:96,x:230,feet:160,time:3000,open:true}]},
    {key:'subida',folder:'.',game:'GuairaAscent',art:'GuairaAscentArt',prefix:'drawGuairaAscent',replay:'guairaAscentReplay.json',poses:[
        {key:'subida-inspecao',cx:824,cy:80,x:960,feet:240,time:1400},
        {key:'subida-reserva',cx:1024,cy:0,x:1250,feet:144,time:1400}]},
    {key:'prefeito',folder:'.',game:'GuairaMayorLab',art:'GuairaMayorArenaArt',prefix:'drawGuairaMayor',replay:'guairaMayorReplay.json',poses:[
        {key:'prefeito-lacrado',cx:0,cy:64,x:48,feet:224,time:1400},
        {key:'prefeito-aberto',cx:0,cy:64,x:48,feet:224,time:1400,open:true}]},
] as const;
const snapshots:object[]=[],replays:object[]=[],motion:object[]=[];
for(const config of definitions) {
    const old=await import(pathToFileURL(previous(config.folder,config.art)).href);
    const current=await import(pathToFileURL(resolve(root,config.folder,config.art+'.ts')).href);
    const cleanups:Array<()=>void>=[],h=guairaBrowser({after:fn=>cleanups.push(fn as ()=>void)});
    for(const target of[h.window,h.document,h.canvas])Object.assign(target,{removeEventListener(){}});
    const screen=createCanvas(640,360);h.canvas.getContext=()=>screen.getContext('2d');
    const create=h.document.createElement;
    h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1)as unknown as ReturnType<typeof create>:create(tag);
    const module=await import(pathToFileURL(resolve(root,config.folder,config.game+'.ts')).href);
    const Scene=module[config.game]as new(canvas:HTMLCanvasElement,status:HTMLElement)=>Game;
    const game=new Scene(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
    game.renderer.setTouchControlsVisible(false);game.store.save.preferences.shake=false;
    const native={...game.art},frame=createCanvas(320,180),fc=frame.getContext('2d');fc.imageSmoothingEnabled=false;
    function background(c:CanvasRenderingContext2D,before:boolean,x:number,y:number,time:number,reduced:boolean) {
        const a=before?old:current,fn=a[config.prefix+'Background'];
        if(config.key==='alivio')fn(c,game.level,x,y,time,reduced);
        else if(config.key==='prefeito')fn(c,game.mayor,x,y,time,reduced);
        else fn(c,x,y,time,reduced,game.routing);
    }
    function capture(before:boolean|null,reduced=false) {
        Object.assign(game.art,native);
        if(before!==null) {
            const a=before?old:current,p=config.prefix;
            game.art.background=(c,_i,x,y)=>background(c,before,x,y,game.objects.time,reduced);
            if(config.key==='patio') game.art.objects=(c,o,x,y)=>a[p+'Objects'](c,o,x,y,o.time,reduced,game.routing);
            else if(config.key==='alivio') game.art.objects=(c,o,x,y)=>a[p+'Objects'](c,o,x,y,reduced);
            else if(config.key!=='prefeito')game.art.objects=(c,o,x,y)=>a[p+'Objects'](c,o,x,y,o.time,reduced);
            game.art.terrain=(c,l,_i,x,y)=>config.key==='subida'?
                a[p+'Terrain'](c,l,x,y,game.objects.time,reduced):a[p+'Terrain'](c,l,x,y,reduced);
        }
        const state=()=>JSON.stringify({p:game.player.data,o:game.objects,r:game.routing,m:game.mayor,tiles:game.level.data.tiles,camera:game.camera,save:game.store.save});
        const beforeState=state();game.render();assert.equal(state(),beforeState);
        fc.drawImage(screen as unknown as CanvasImageSource,0,0,320,180);return frame.toBuffer('image/png');
    }
    function pose(p:Pose) {
        game.load(game.stage.id);game.player.data.respawnRevealTimer=0;
        game.camera.x=p.cx;game.camera.y=p.cy;game.player.data.position.x=p.x;game.player.data.position.y=p.feet-game.player.data.height;
        game.time=game.objects.time=p.time;
        if(game.routing) {
            game.routing.selected=game.routing.supplied=p.supply??'a';game.routing.warningRemaining=0;
            for(const[id,outlet,y]of[['junction-deck-a','a',256],['junction-deck-b','b',208]]as const) {
                const b=game.objects.get(id)!;b.active=p.supply===outlet;b.y=b.py=b.active?y:400;
            }
        }
        if(config.key==='alivio'&&p.open) {
            game.level.data.tiles[10][15]=TileType.EMPTY;
            const b=game.objects.get('relief-service-grate')!;b.active=b.observedActive=true;
        }
        if(game.mayor&&p.open) {game.mayor.state='released';game.mayor.sealsRemaining=0;}
    }
    const sheet=fresh(1280,config.poses.length*384);
    for(const[row,p]of config.poses.entries()) {
        pose(p);
        for(const[col,before]of[true,false].entries()) {
            const png=capture(before);writeFileSync(join(out,`${p.key}-${before?'before':'after'}.png`),png);
            pixelText(sheet.c,`${before?'ANTES':'DEPOIS'} / ${p.key.toUpperCase()}`,col*640+8,row*384+8,'#f0ddae');
            sheet.c.drawImage(await loadImage(png),col*640,row*384+24,640,360);
        }
        assert.ok(capture(false).equals(capture(false)));
        const fixed=(time:number)=>{const f=fresh(320,180);background(f.c,false,p.cx,p.cy,time,true);return f.canvas.toBuffer('image/png');};
        assert.ok(fixed(0).equals(fixed(99999)));
        snapshots.push({...p,stage:config.key,authoredPose:true,stateUnchanged:true,deterministic:true,reducedBackgroundStable:true});
    }
    writeFileSync(join(out,config.key+'-sheet.png'),sheet.canvas.toBuffer('image/png'));
    if(!stills) {
        pose(config.poses[1]);const folder=join(out,config.key+'-motion');mkdirSync(folder,{recursive:true});
        for(let i=0;i<126;i++) {
            game.time=game.objects.time=i*1000/30;const pair=fresh(1280,384);
            for(const[col,before]of[true,false].entries()) {
                pixelText(pair.c,`${before?'ANTES':'DEPOIS'} / ${config.key.toUpperCase()}`,col*640+8,8,'#f0ddae');
                pair.c.drawImage(await loadImage(capture(before)),col*640,24,640,360);
            }
            writeFileSync(join(folder,`${String(i).padStart(4,'0')}.png`),pair.canvas.toBuffer('image/png'));
        }
        motion.push({stage:config.key,authored:true,fps:30,frames:126});
        const recording=JSON.parse(readFileSync(join('tests/helpers',config.replay),'utf8'))as{
            stepMs?:number;initialSettleFrames?:number;runs:Run[];maintenance:Run[];interval:Run[]};
        const routes=config.key==='alivio'?[['alivio-abertura',recording.maintenance],['alivio-intervalo',recording.interval]]as const:[[config.key,recording.runs]]as const;
        for(const[key,runs]of routes) {
            game.load(game.stage.id);const dt=recording.stepMs??1000/60;
            for(let i=0;i<(recording.initialSettleFrames??0);i++)game.update(dt);
            let held=new Set<string>(),updates=0,images=0;const folder=join(out,key+'-replay');mkdirSync(folder,{recursive:true});
            const event=(type:string,code:string)=>h.window.dispatch(type,{code,key:code==='Space'?' ':code,target:h.canvas});
            for(const[count,keys]of runs) {
                const next=new Set(keys);for(const code of held)if(!next.has(code))event('keyup',code);for(const code of next)if(!held.has(code))event('keydown',code);held=next;
                for(let i=0;i<count;i++,updates++) {
                    game.update(dt);assert.equal(game.player.data.isDead,false);assert.equal(game.player.data.hasHelmet,true);
                    if(updates%4===0)writeFileSync(join(folder,`${String(images++).padStart(4,'0')}.png`),capture(null));
                }
            }
            for(const code of held)event('keyup',code);
            assert.equal(game.mayor?.publicWaterOpen??game.finished,true);
            writeFileSync(join(out,key+'-complete.png'),capture(null));
            replays.push({key,updates,images,fps:15,complete:true,damage:false,nativeArtRestored:true,manualPoseOrClockChanges:false});
        }
    }
    game.dispose();cleanups.reverse().forEach(fn=>fn());
    console.log(JSON.stringify({stage:config.key,stills,poses:config.poses.length}));
}
for(const config of definitions)if(existsSync(join(baseline,config.game+'.ts'))) {
    hashes[config.game]=createHash('sha256').update(readFileSync(join(baseline,config.game+'.ts'))).digest('hex');
    sourceFiles[config.game]=resolve(root,config.folder,config.game+'.ts');
}
const currentHashes=Object.fromEntries(Object.entries(sourceFiles).map(([name,file])=>[name,createHash('sha256').update(readFileSync(file)).digest('hex')]));
const report={hashes,currentHashes,snapshots,motion,replays};writeFileSync(join(out,stills?'stills.json':'report.json'),JSON.stringify(report,null,2));
