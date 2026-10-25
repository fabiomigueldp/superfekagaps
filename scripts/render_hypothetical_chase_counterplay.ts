/** Directed native art composition. No gameplay update, input simulation,
 * assertions, validation runner or browser. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {Player} from '../src/entities/Player';
import {WorldLevel,WorldObjects} from '../src/adventure/WorldPhysics';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {hypotheticalStage} from '../src/adventure/hipotetico/HypotheticalStage';
import {CHASE_COUNTERS,CHASE_BREAKS,CHASE_ATTACKS} from '../src/adventure/hipotetico/HypotheticalLayout';
import {chaseCollapsedEdge} from '../src/adventure/hipotetico/HypotheticalChaseDetails';
import {CHASE_STRIKE_REACH,chaseStrikeX} from '../src/adventure/hipotetico/HypotheticalChasePerformance';
import {chaseRiflePitch,chaseShotSpeed} from '../src/adventure/hipotetico/HypotheticalChaseGunplay';
import {drawHypotheticalBackground,drawHypotheticalTerrain,drawHypotheticalObjects,drawHypotheticalCombat} from '../src/adventure/hipotetico/HypotheticalArt';
import {pixelText} from '../src/graphics/BitmapFont';

const [destination,canvasModule]=process.argv.slice(2),out=resolve(destination),stills=process.argv.includes('--stills');
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
// Control modules now read browser capabilities at import time. Establish the
// native authoring boundaries first, with no saved player preferences.
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
Object.assign(h.document,{documentElement:{dataset:{}}});
const {Renderer}=await import('../src/engine/Renderer');
const native=createCanvas(320,180),c=native.getContext('2d');c.imageSmoothingEnabled=false;
const display=createCanvas(320,180);display.style={};const renderer=new Renderer(display);
const plate=(w:number,h:number)=>{const canvas=createCanvas(w,h),context=canvas.getContext('2d');context.imageSmoothingEnabled=false;context.fillStyle='#122830';context.fillRect(0,0,w,h);return {canvas,context};};
const board=plate(1280,612),details=plate(1280,672),combo=plate(1280,204),movie=plate(960,588);
const snapshot=()=>{const copy=createCanvas(320,180);copy.getContext('2d').putImageData(c.getImageData(0,0,320,180),0,0);return copy;};
const make=()=>{
    const stage=hypotheticalStage('chase'),level=new WorldLevel(stage.level),o=new WorldObjects(stage.mechanisms),b=new HypotheticalModel('chase');
    const hero=new Player(0,0).data;hero.hasHelmet=true;hero.facingRight=true;hero.isGrounded=true;hero.velocity.x=3.5;
    b.state='rest';b.facing=1;b.age=80;b.velocity=b.motionSpeed=3.5;
    return{stage,level,o,b,hero};
};
let frames=0;
const film=(title:string)=>{
    if(stills)return;
    const fc=movie.context;fc.fillStyle='#122830';fc.fillRect(0,0,960,588);fc.drawImage(snapshot(),0,48,960,540);
    pixelText(fc,title,14,10,'#e2c28b',2);
    pixelText(fc,'COMPOSICAO DIRIGIDA / RENDERIZADORES NATIVOS / SEM PARTIDA OU AUDIO',14,34,'#afc1b5');
    writeFileSync(join(out,'frames',String(frames++).padStart(5,'0')+'.png'),movie.canvas.toBuffer('image/png'));
};
const paint=(scene:ReturnType<typeof make>,cx:number,reduced=false)=>{
    const {b,o,level,hero}=scene,edge=chaseCollapsedEdge(b.x)/16;
    level.data.tiles=scene.stage.level.tiles.map((row,y)=>row.map((tile,x)=>y>=13&&x<edge?0:tile));
    o.bodies=o.bodies.filter(p=>p.x>=edge*16);level.bodies=o.bodies;
    b.chaseBreaks=CHASE_BREAKS.map(s=>chaseStrikeX(s)>b.x+CHASE_STRIKE_REACH?-1:b.tick-Math.floor((b.x+CHASE_STRIKE_REACH-chaseStrikeX(s))/3.5));
    b.chaseReactions=b.chaseReactions.map((_,i)=>i*400<b.x?b.tick-90:-1);
    const shoulder=b.rifleShoulder,angle=chaseRiflePitch(b.pursuitKind);
    b.targetX=shoulder.x+Math.cos(angle)*232;b.targetY=shoulder.y+Math.sin(angle)*232;
    drawHypotheticalBackground(c,b,cx,64,reduced);drawHypotheticalTerrain(c,level,b,cx,64);
    drawHypotheticalObjects(c,o,b,cx,64,reduced);drawHypotheticalCombat(c,b,cx,64,reduced);
    renderer.drawPlayer(hero,{x:cx,y:64,targetX:cx,targetY:64,shakeTimer:0,shakeMagnitude:0,bounds:level.getBounds()},c);
    c.fillStyle='#122830';c.fillRect(0,0,320,16);pixelText(c,'FLAVIO HIPOTETICO',7,5,'#e2c28b');
};
try{
    for(const [i,s]of CHASE_COUNTERS.entries()){
        const scene=make(),{b,hero}=scene,release=900,hit=912;
        const state=b.counters.loads[i];
        state.hitX=s.load.x+s.load.width/2;
        state.released=release;state.hitY=b.counters.poseAt(i,hit).bounds.y+b.counters.poseAt(i,hit).bounds.height;
        for(let frame=0;frame<120;frame++){
            const age=frame-20;b.tick=release+age;b.age=80+frame;
            state.released=age<0?-1:release;state.struck=age<12?-1:hit;
            const after=Math.max(0,age-12),u=Math.min(1,after/42);
            const directedTravel=age<=12?age*3.5:42+3.5*(.32*Math.min(42,after)+.68*42*(u**3-.5*u**4)+Math.max(0,after-42));
            b.x=s.pad.x-108+directedTravel;b.travel=b.x+18;b.velocity=b.motionSpeed=3.5*b.counters.speedScale(b.tick);
            const px=s.pad.x+age*3.5,fall=Math.max(0,(px-(s.pad.x+30))/3.5);
            hero.position={x:px,y:Math.min(200,s.pad.y-24+fall*fall*.25)};
            hero.animationFrame=Math.floor(frame/5)%6;
            const cx=s.pad.x-152;
            const column=[-10,6,16,42].indexOf(age);
            if(!stills&&frame%2===0){paint(scene,cx);film(['CAIS / MADEIRA','COMPORTAS / CONTRAPESO','PORTARIA / CARGA'][i]);}
            if(column>=0){
                paint(scene,cx);const copy=snapshot();
                board.context.drawImage(copy,column*320,i*204+24);
                pixelText(board.context,['ROTA ALTA','SOLTURA','IMPACTO','RETOMADA'][column],column*320+8,i*204+8,'#e2c28b');
                details.context.drawImage(copy,60,30,160,100,column*320,i*224+24,320,200);
                pixelText(details.context,['CAIS','COMPORTAS','PORTARIA'][i]+' / '+['PEDAL','CABO','CARGA','REACAO'][column],column*320+8,i*224+8,'#e2c28b');
            }
            if(age===16){paint(scene,cx,true);writeFileSync(join(out,`load-${i}-reduced.png`),native.toBuffer('image/png'));}
        }
    }
    const scene=make(),{b,hero}=scene,emitter=new HypotheticalModel('chase');
    const first=CHASE_ATTACKS[CHASE_ATTACKS.length-1],next=first.followup!,firstEnd=first.tell+first.duration,secondStart=firstEnd+next.tell;
    for(let t=0;t<firstEnd+next.tell+next.duration;t++){
        b.tick=1400+t;b.x=first.x-110+t*3.5;b.travel=b.x+18;b.pursuitCount=2;b.pursuitStep=t<firstEnd?0:1;
        const local=t<firstEnd?t:t-firstEnd,v=t<firstEnd?first:next;
        b.pursuitKind=v.kind;b.pursuitTell=v.tell;b.state=local<v.tell?'tell':'attack';b.age=local<v.tell?local:local-v.tell;
        const angle=chaseRiflePitch(v.kind),shoulder=b.rifleShoulder;
        b.targetX=shoulder.x+Math.cos(angle)*232;b.targetY=shoulder.y+Math.sin(angle)*232;
        b.shots=[];b.muzzle=0;
        for(const [start,volley]of [[first.tell,first],[secondStart,next]] as const)for(const at of volley.shots){
            const since=t-start-at;if(since<0||since>30)continue;
            const pitch=chaseRiflePitch(volley.kind),speed=chaseShotSpeed(volley),vy=Math.sin(pitch)*speed,vx=Math.cos(pitch)*speed;
            // An explicitly authored firing pose supplies the native muzzle.
            // This composes a trajectory; it does not update gameplay.
            emitter.tick=b.tick-since;emitter.x=b.x-since*3.5;emitter.travel=emitter.x+18;
            emitter.state='attack';emitter.attack='rifle';emitter.age=at;
            emitter.velocity=emitter.motionSpeed=3.5;emitter.pursuitKind=volley.kind;emitter.muzzle=5;
            emitter.chaseBreaks=CHASE_BREAKS.map(s=>chaseStrikeX(s)>emitter.x+CHASE_STRIKE_REACH?-1:
                emitter.tick-Math.floor((emitter.x+CHASE_STRIKE_REACH-chaseStrikeX(s))/3.5));
            const muzzle=emitter.aim,xx=muzzle.x+since*vx,yy=muzzle.y+since*vy;
            if(yy>=219)continue;
            b.shots.push({x:xx,y:yy,px:xx-vx,py:yy-vy,width:5,height:5,vx,vy,age:since,life:100,kind:'bullet'});
            if(since<5)b.muzzle=5-since;
        }
        const jump=Math.max(0,t-112);hero.position={x:first.x+t*3.5,y:200-Math.max(0,8*jump-.25*jump*jump)};
        hero.isGrounded=jump===0||jump>=32;hero.animationFrame=Math.floor(t/5)%6;
        const cx=hero.position.x-150;
        if(!stills&&t%2===0){paint(scene,cx);film('PORTARIA / PREPARACAO E CONTINUIDADE DAS RAJADAS');}
        const col=[28,52,84,118].indexOf(t);
        if(col>=0){paint(scene,cx);combo.context.drawImage(snapshot(),col*320,24);pixelText(combo.context,['PREPARACAO','PRIMEIRA SALVA','TROCA DE MIRA','SEGUNDA SALVA'][col],col*320+8,8,'#e2c28b');}
    }
    writeFileSync(join(out,'counterplay.png'),board.canvas.toBuffer('image/png'));
    writeFileSync(join(out,'counterplay-details.png'),details.canvas.toBuffer('image/png'));
    writeFileSync(join(out,'final-volley.png'),combo.canvas.toBuffer('image/png'));
    console.log(`Composed native counterplay plates; ${frames} directed frames.`);
}finally{renderer.dispose();for(const dispose of clean.reverse())dispose();}
