/** Native level-design captures. Prepared comparisons are separate from input-only replays.
 * node --import tsx scripts/prove_guaira_level_design.ts OUTPUT CANVAS_MODULE BASELINE
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import type { WorldGame } from '../src/adventure/WorldGame';
import { pixelText } from '../src/graphics/BitmapFont';
import recording from '../tests/helpers/guairaLevelDesignReplays.json';
import reliefRecording from '../tests/helpers/guairaReliefReplay.json';

type Game=WorldGame&{finished:boolean};
type Run=[number,string[]];
interface Canvas {width:number;height:number;getContext(type:'2d'):CanvasRenderingContext2D;toBuffer(type:'image/png'):Buffer}
const[outArg,canvasArg,baselineArg]=process.argv.slice(2);assert.ok(outArg&&canvasArg&&baselineArg);
const out=resolve(outArg),baseline=resolve(baselineArg),root=resolve('src/adventure/experimental/guaira');
mkdirSync(out,{recursive:true});
const{createCanvas,loadImage}=await import(pathToFileURL(resolve(canvasArg)).href)as{
    createCanvas(w:number,h:number):Canvas;loadImage(bytes:Buffer):Promise<CanvasImageSource>};
const sourceFiles:Record<string,string>={},beforeHashes:Record<string,string>={},prepared=new Set<string>();
function previous(sourceFile:string):string {
    const name=basename(sourceFile,'.ts'),file=join(out,`previous-${name}.ts`);
    if(prepared.has(name))return file;prepared.add(name);
    const source=readFileSync(join(baseline,name+'.ts'),'utf8');
    sourceFiles[name]=sourceFile;beforeHashes[name]=createHash('sha256').update(source).digest('hex');
    writeFileSync(file,source.replace(/from (['"])(\.[^'"]+)\1/g,(_m,_q,relative:string)=>{
        const target=resolve(dirname(sourceFile),relative+'.ts');
        const dependency=existsSync(join(baseline,basename(target)))?previous(target):target;
        return `from ${JSON.stringify(pathToFileURL(dependency).href)}`;
    }));return file;
}
const configs=[
    {key:'travessia',file:'GuairaTraversal',name:'GuairaTraversal',cx:0,cy:64,x:126,feet:224,poster:113},
    {key:'respiros',file:'respiros/GuairaRespiros',name:'GuairaRespiros',cx:480,cy:132,x:600,feet:304,poster:653},
    {key:'galeria',file:'gallery/GuairaGallery',name:'GuairaGallery',cx:160,cy:184,x:270,feet:288,poster:298},
    {key:'subida',file:'GuairaAscent',name:'GuairaAscent',cx:824,cy:96,x:1040,feet:240,poster:1094},
    {key:'alivio',file:'relief/GuairaRelief',name:'GuairaRelief',cx:48,cy:112,x:192,feet:224,poster:256},
] as const;
const comparisons:object[]=[],replays:object[]=[];
for(const config of configs) {
    const pair=createCanvas(1280,384),pc=pair.getContext('2d');pc.imageSmoothingEnabled=false;pc.fillStyle='#302b35';pc.fillRect(0,0,1280,384);
    for(const before of[true,false]) {
        const sourceFile=resolve(root,config.file+'.ts');
        const module=await import(pathToFileURL(before?previous(sourceFile):sourceFile).href);
        const cleanups:Array<()=>void>=[],h=guairaBrowser({after:fn=>cleanups.push(fn as ()=>void)});
        for(const target of[h.window,h.document,h.canvas])Object.assign(target,{removeEventListener(){}});
        const screen=createCanvas(640,360);h.canvas.getContext=()=>screen.getContext('2d');
        const create=h.document.createElement;
        h.document.createElement=tag=>tag==='canvas'?createCanvas(1,1)as unknown as ReturnType<typeof create>:create(tag);
        const Scene=module[config.name]as new(c:HTMLCanvasElement,s:HTMLElement)=>Game;
        const game=new Scene(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
        game.renderer.setTouchControlsVisible(false);game.store.save.preferences.shake=false;
        const frame=createCanvas(320,180),fc=frame.getContext('2d');fc.imageSmoothingEnabled=false;
        const state=()=>JSON.stringify({p:game.player.data,objects:game.objects,tiles:game.level.data.tiles,camera:game.camera,coins:game.coins});
        const capture=()=>{
            const old=state();game.render();assert.equal(state(),old,'paint preserves simulation');
            fc.drawImage(screen as unknown as CanvasImageSource,0,0,320,180);return frame.toBuffer('image/png');
        };
        try {
            // Explicit comparison pose, not a claimed played position.
            game.player.data.position={x:config.x,y:config.feet-game.player.data.height};
            game.camera.x=config.cx;game.camera.y=config.cy;game.time=game.objects.time=2000;
            const png=capture(),version=before?'before':'after';
            writeFileSync(join(out,`${config.key}-${version}.png`),png);
            assert.ok(png.equals(capture()),'deterministic pose');
            pixelText(pc,`${before?'ANTES':'DEPOIS'} / ${config.key.toUpperCase()}`,before?8:648,8,'#f0ddae');
            pc.drawImage(await loadImage(png),before?0:640,24,640,360);
            if(before)continue;
            // A fresh native attempt removes every authored pose and clock above.
            game.load(game.stage.id);let held=new Set<string>(),updates=0,images=0,completeAt=0;
            const folder=join(out,config.key+'-replay');mkdirSync(folder,{recursive:true});
            const runs=(config.key==='alivio'?reliefRecording.maintenance:recording[config.key].runs)as Run[];
            let minHelmetTop=Infinity,maxFeet=0;const contacts:Record<string,number>={},pickups:Record<string,number>={};
            const event=(type:string,code:string)=>h.window.dispatch(type,{code,key:code==='Space'?' ':code,target:h.canvas});
            for(const[count,keys]of runs) {
                const next=new Set(keys);for(const k of held)if(!next.has(k))event('keyup',k);for(const k of next)if(!held.has(k))event('keydown',k);held=next;
                for(let i=0;i<count;i++) {
                    game.update(1000/60);updates++;
                    assert.equal(game.player.data.isDead,false);assert.equal(game.player.data.hasHelmet,true);
                    if(game.finished&&!completeAt)completeAt=updates;
                    minHelmetTop=Math.min(minHelmetTop,game.player.data.position.y-4-game.camera.y);
                    maxFeet=Math.max(maxFeet,game.player.data.position.y+game.player.data.height-game.camera.y);
                    if(game.player.data.isGrounded) {
                        const height=Math.round(game.player.data.position.y+game.player.data.height);
                        contacts[height]=(contacts[height]??0)+1;
                    }
                    for(const id of(game as unknown as{collected:Set<string>}).collected)pickups[id]??=updates;
                    if((updates-1)%4===0)writeFileSync(join(folder,`${String(images++).padStart(4,'0')}.png`),capture());
                    if(updates===config.poster)writeFileSync(join(out,config.key+'-detail.png'),capture());
                }
            }
            for(const k of held)event('keyup',k);
            assert.equal(game.finished,true);assert.ok(completeAt>0);
            writeFileSync(join(out,config.key+'-complete.png'),capture());
            replays.push({key:config.key,updates,completeAt,seconds:completeAt/60,images,fps:15,complete:true,damage:false,
                coins:game.coins,checkpoint:game.store.save.checkpoint?.index,minHelmetTop,maxFeet,contacts,pickups,
                nativeInput:true,manualPoseOrClockChanges:false,renderPure:true});
        } finally {game.dispose();cleanups.reverse().forEach(fn=>fn());}
    }
    writeFileSync(join(out,config.key+'-comparison.png'),pair.toBuffer('image/png'));
    comparisons.push({stage:config.key,camera:[config.cx,config.cy],player:[config.x,config.feet],time:2000,authoredPose:true});
    console.log(JSON.stringify({stage:config.key,complete:true}));
}
const currentHashes=Object.fromEntries(Object.entries(sourceFiles).map(([name,file])=>[name,createHash('sha256').update(readFileSync(file)).digest('hex')]));
writeFileSync(join(out,'report.json'),JSON.stringify({beforeHashes,currentHashes,comparisons,replays},null,2));
