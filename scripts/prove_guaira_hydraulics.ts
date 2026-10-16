/** Production-renderer inspection poses. Native-input playthroughs are captured
 * separately by prove_guaira_scenery.ts --replay.
 * node --import tsx scripts/prove_guaira_hydraulics.ts OUTPUT CANVAS_MODULE BASELINE_DIRECTORY
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import type { WorldGame } from '../src/adventure/WorldGame';
import type { JunctionRouting } from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import { pixelText } from '../src/graphics/BitmapFont';

interface Canvas {width:number;height:number;getContext(type:'2d'):CanvasRenderingContext2D;toBuffer(type:'image/png'):Buffer}
type Game=WorldGame&{routing?:JunctionRouting};
const[outArg,canvasArg,baseArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baseArg);
const out=resolve(outArg),baseline=resolve(baseArg);mkdirSync(out,{recursive:true});
const{createCanvas,loadImage}=await import(pathToFileURL(resolve(canvasArg)).href)as{
    createCanvas(w:number,h:number):Canvas;loadImage(bytes:Buffer):Promise<CanvasImageSource>;
};
const sourceRoot=resolve('src/adventure/experimental/guaira');
const hashes:Record<string,string>={},snapshots:object[]=[],motion:object[]=[];
const fresh=(w:number,h:number)=>{const canvas=createCanvas(w,h),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#302b35';c.fillRect(0,0,w,h);return{canvas,c};};
async function previous(folder:string,name:string) {
    const source=readFileSync(join(baseline,`${name}.ts`),'utf8');hashes[name]=createHash('sha256').update(source).digest('hex');
    const rewritten=source.replace(/from (['"])(\.[^'"]+)\1/g,(_match,_quote,relative:string)=>
        `from ${JSON.stringify(pathToFileURL(resolve(sourceRoot,folder,relative+'.ts')).href)}`);
    const file=join(out,`baseline-${name}.ts`);writeFileSync(file,rewritten);return import(pathToFileURL(file).href);
}
for(const config of [
    {key:'patio',file:'junction/GuairaJunction',name:'GuairaJunction',art:'GuairaJunctionArt',prefix:'drawJunction'},
    {key:'respiros',file:'respiros/GuairaRespiros',name:'GuairaRespiros',art:'GuairaRespirosArt',prefix:'drawRespiros'},
] as const) {
    const folder=dirname(config.file),old=await previous(folder,config.art);
    const current=await import(pathToFileURL(resolve(sourceRoot,folder,config.art+'.ts')).href);
    const cleanups:Array<()=>void>=[],h=guairaBrowser({after:fn=>cleanups.push(fn as ()=>void)});
    for(const target of [h.window,h.document,h.canvas])Object.assign(target,{removeEventListener(){}});
    const screen=createCanvas(640,360);h.canvas.getContext=()=>screen.getContext('2d');
    const create=h.document.createElement;h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1)as unknown as ReturnType<typeof create>:create(tag);
    const module=await import(pathToFileURL(resolve(sourceRoot,config.file+'.ts')).href);
    const Scene=module[config.name]as new(canvas:HTMLCanvasElement,status:HTMLElement)=>Game;
    const game=new Scene(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
    game.renderer.setTouchControlsVisible(false);game.store.save.preferences.shake=false;game.player.data.respawnRevealTimer=0;
    const frame=createCanvas(320,180),fc=frame.getContext('2d');fc.imageSmoothingEnabled=false;
    function painters(before:boolean,reduced=false) {
        const art=before?old:current,p=config.prefix;
        game.art.background=(c,_island,cx,cy,time)=>art[p+'Background'](c,cx,cy,time,reduced,game.routing);
        game.art.terrain=(c,level,_island,cx,cy)=>art[p+'Terrain'](c,level,cx,cy);
        game.art.objects=(c,objects,cx,cy,time)=>art[p+'Objects'](c,objects,cx,cy,time,reduced,game.routing);
    }
    function capture(before:boolean,time:number,reduced=false) {
        painters(before,reduced);game.time=game.objects.time=time;
        const state=JSON.stringify({p:game.player.data,o:game.objects,route:game.routing,save:game.store.save,camera:game.camera});
        game.render();assert.equal(JSON.stringify({p:game.player.data,o:game.objects,route:game.routing,save:game.store.save,camera:game.camera}),state);
        fc.drawImage(screen as unknown as CanvasImageSource,0,0,320,180);return frame.toBuffer('image/png');
    }
    function pose(cx:number,cy:number,x:number,feet:number,aY=304,bY=400,supply:'a'|'b'='a') {
        game.camera.x=cx;game.camera.y=cy;game.player.data.position.x=x;game.player.data.position.y=feet-game.player.data.height;
        if(game.routing) {
            game.routing.supplied=game.routing.selected=supply;game.routing.warningRemaining=0;
            const a=game.objects.get('junction-deck-a')!,b=game.objects.get('junction-deck-b')!;
            a.y=a.py=aY;b.y=b.py=bY;a.active=supply==='a';b.active=supply==='b';
        }
    }
    const poses=config.key==='patio'?[
        {key:'patio-rede',cx:240,cy:128,x:432,feet:256,time:2100,a:256,b:400,supply:'a' as const},
        {key:'patio-base',cx:200,cy:236,x:260,feet:304,time:2100,a:304,b:400,supply:'a' as const},
        {key:'patio-curva',cx:500,cy:128,x:700,feet:208,time:2100,a:400,b:208,supply:'b' as const},
    ]:[
        {key:'respiros-carga',cx:80,cy:144,x:128,feet:304,time:1600,a:0,b:0,supply:'a' as const},
        {key:'respiros-jato',cx:80,cy:144,x:128,feet:304,time:2100,a:0,b:0,supply:'a' as const},
        {key:'respiros-queda',cx:80,cy:144,x:128,feet:304,time:2400,a:0,b:0,supply:'a' as const},
    ];
    const sheet=fresh(1280,3*384);
    for(const[row,p]of poses.entries()) {
        pose(p.cx,p.cy,p.x,p.feet,p.a,p.b,p.supply);
        for(const[column,before]of [true,false].entries()) {
            const png=capture(before,p.time);
            writeFileSync(join(out,`${p.key}-${before?'before':'after'}.png`),png);
            pixelText(sheet.c,`${before?'ANTES':'DEPOIS'} / ${p.key.toUpperCase()}`,column*640+8,row*384+8,'#f0ddae');
            // Freeze the source image: this Canvas backend can defer drawImage
            // from a mutable canvas until the destination is finally flushed.
            sheet.c.drawImage(await loadImage(png),column*640,row*384+24,640,360);
        }
        const first=capture(false,p.time);capture(false,0);assert.ok(capture(false,p.time).equals(first));
        writeFileSync(join(out,`${p.key}-reduced.png`),capture(false,p.time,true));
        snapshots.push({key:p.key,time:p.time,camera:{x:p.cx,y:p.cy},repeatable:true,stateUnchanged:true});
    }
    writeFileSync(join(out,config.key+'-sheet.png'),sheet.canvas.toBuffer('image/png'));
    const p=poses[config.key==='patio'?0:1];pose(p.cx,p.cy,p.x,p.feet,p.a,p.b,p.supply);
    const frames=join(out,config.key+'-motion');mkdirSync(frames,{recursive:true});
    const count=126;
    for(let i=0;i<count;i++) {
        const pair=fresh(1280,384),time=i*1000/30;
        for(const[column,before]of [true,false].entries()) {
            const png=capture(before,time);
            pixelText(pair.c,`${before?'ANTES':'DEPOIS'} / ${config.key.toUpperCase()}`,column*640+8,8,'#f0ddae');
            pair.c.drawImage(await loadImage(png),column*640,24,640,360);
        }
        writeFileSync(join(frames,`${String(i).padStart(4,'0')}.png`),pair.canvas.toBuffer('image/png'));
    }
    motion.push({phase:config.key,fps:30,frames:count,seconds:count/30,authoredPoses:true,gameplayVictory:false});
    if(config.key==='respiros') {
        const pixels=(before:boolean,time:number)=>{
            game.objects.time=time;const canvas=createCanvas(320,180),c=canvas.getContext('2d');
            (before?old:current).drawRespirosObjects(c,game.objects,80,144,time,false);
            return c.getImageData(0,0,320,180).data;
        };
        const results=[];
        for(const before of [true,false]) {
            const a=pixels(before,2030),b=pixels(before,2100),shifts=[];
            for(let shift=-10;shift<=10;shift++) {
                let mismatches=0;
                for(let y=60;y<140;y++)for(let channel=0;channel<4;channel++)
                    if(b[(y*320+86)*4+channel]!==a[((y-shift)*320+86)*4+channel])mismatches++;
                shifts.push({shift,mismatches});
            }
            shifts.sort((a,b)=>a.mismatches-b.mismatches);
            results.push({version:before?'before':'after',bestShift:shifts[0]});
        }
        assert.deepEqual(results.map(r=>r.bestShift),[{shift:6,mismatches:0},{shift:-1,mismatches:0}]);
        writeFileSync(join(out,'flow-continuity.json'),JSON.stringify({column:86,fromMs:2030,toMs:2100,results},null,2));
    }
    game.dispose();cleanups.reverse().forEach(fn=>fn());
}
const report={kind:'production-renderers-authored-inspection',baseline:'source snapshots before this round',hashes,snapshots,motion,stateUnchanged:true};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
