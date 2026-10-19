/** Authored composition study using the production renderer. Positions and
 * progression are staged explicitly; these images are not gameplay validation. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setMaxListeners} from 'node:events';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {HypotheticalGame} from '../src/adventure/hipotetico/HypotheticalGame';
import {SIEGE_SECTORS} from '../src/adventure/hipotetico/HypotheticalSiege';
import {drawHypotheticalBackground,drawHypotheticalObjects,drawHypotheticalTerrain} from '../src/adventure/hipotetico/HypotheticalArt';

const [directory,canvasModule]=process.argv.slice(2),out=resolve(directory);
mkdirSync(out,{recursive:true});
const {createCanvas,loadImage}=await import(pathToFileURL(resolve(canvasModule)).href);
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)});
// The motion board hosts four separate scenes on the same authoring surface.
setMaxListeners(32,h.window,h.document);
const screen=createCanvas(640,360),native=createCanvas(320,180),nc=native.getContext('2d');
h.canvas.getContext=()=>screen.getContext('2d');
const create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const board=createCanvas(1280,720),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
const sources:Array<{file:string;sector:string;camera:number;state:string}>=[];
for(const [i,s] of SIEGE_SECTORS.entries()){
    const g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    g.renderer.setTouchControlsVisible(false);g.store.save.preferences.shake=false;
    const authored=g as unknown as {arrivalSeen:boolean;siegeCheckpoint:number};
    authored.arrivalSeen=true;authored.siegeCheckpoint=i;g.act='siege';g.load('hipotetico-siege',true);
    g.fight.tick=900;g.fight.route.active=true;
    g.fight.route.ticks=360;
    g.player.data.position.x=s.trigger+12;g.player.data.position.y=224-g.player.data.height;
    g.camera.x=Math.max(0,s.trigger-38);g.camera.y=64;
    for(const e of g.foes)if('awake' in e)e.awake=true;
    g.render();nc.drawImage(screen,0,0,320,180);
    const png=native.toBuffer('image/png');
    writeFileSync(join(out,`district-${i}.png`),png);
    sources.push({file:`district-${i}.png`,sector:s.name,camera:g.camera.x,state:'authored active encounter'});
    bc.drawImage(await loadImage(png),i%2*640,Math.floor(i/2)*360,640,360);
    // An explicitly staged clearance, not an input-driven enemy defeat.
    g.fight.route.remaining[i]=0;g.fight.route.update(s.trigger+12,0);
    for(const e of g.foes)e.dead=true;
    g.camera.x=Math.min(1728,s.gate-250);g.player.data.position.x=s.gate-70;
    for(let frame=0;frame<=300;frame++){
        g.fight.tick++;g.fight.route.update(s.gate-70,0);
        g.objects.update(1000/60,g.level,s.gate-70);
        const gate=g.objects.get(`siege-gate-${i}`)!;
        gate.height=g.fight.route.gateHeight(i);gate.active=gate.height===0;
        if([8,36,72,180,300].includes(frame)){
            g.render();nc.drawImage(screen,0,0,320,180);
            const file=`district-${i}-clear-${frame}.png`;
            writeFileSync(join(out,file),native.toBuffer('image/png'));
            sources.push({file,sector:s.name,camera:g.camera.x,state:`authored clearance +${frame} frames`});
        }
    }
    g.dispose();
}
writeFileSync(join(out,'districts.png'),board.toBuffer('image/png'));
writeFileSync(join(out,'compositions.json'),JSON.stringify({kind:'Authored production-renderer compositions; no gameplay assertions',sources},null,2)+'\n');
if(process.argv.includes('--motion')){
    mkdirSync(join(out,'frames'),{recursive:true});
    const scenes=SIEGE_SECTORS.map((s,i)=>{
        const game=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
        const pose=game as unknown as {arrivalSeen:boolean;siegeCheckpoint:number};
        pose.arrivalSeen=true;pose.siegeCheckpoint=i;game.act='siege';game.load('hipotetico-siege',true);
        game.fight.route.active=true;game.camera.x=s.gate-250;game.camera.y=64;
        return game;
    });
    const film=createCanvas(640,360),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
    for(let frame=0;frame<160;frame++){
        for(const [i,game] of scenes.entries()){
            const sector=SIEGE_SECTORS[i];
            for(let step=0;step<3;step++){
                game.fight.tick++;
                // Clearance at two seconds is an art-director cue, not combat.
                game.fight.route.update(sector.trigger+12,frame<40?sector.guards.length:0);
                game.objects.update(1000/60,game.level,sector.trigger+12);
                const gate=game.objects.get(`siege-gate-${i}`)!;
                gate.height=game.fight.route.gateHeight(i);gate.active=gate.height===0;
            }
            const c=nc as unknown as CanvasRenderingContext2D,cx=game.camera.x;
            drawHypotheticalBackground(c,game.fight,cx,64,false);
            drawHypotheticalTerrain(c,game.level,game.fight,cx,64);
            drawHypotheticalObjects(c,game.objects,game.fight,cx,64);
            const png=native.toBuffer('image/png');
            fc.drawImage(await loadImage(png),i%2*320,Math.floor(i/2)*180);
        }
        writeFileSync(join(out,'frames',String(frame).padStart(4,'0')+'.png'),film.toBuffer('image/png'));
    }
    for(const scene of scenes)scene.dispose();
}
for(const f of cleanup.reverse())f();
console.log(`Authored district compositions: ${out}`);
