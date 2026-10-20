/** Native art authoring: directed poses, no gameplay updates, input replay,
 * assertions, browser session or validation runner. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {Renderer} from '../src/engine/Renderer';
import {Player} from '../src/entities/Player';
import {WorldLevel,WorldObjects} from '../src/adventure/WorldPhysics';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {hypotheticalStage} from '../src/adventure/hipotetico/HypotheticalStage';
import {drawHypotheticalBackground,drawHypotheticalTerrain,drawHypotheticalObjects,drawHypotheticalCombat} from '../src/adventure/hipotetico/HypotheticalArt';
import {HypotheticalChasePatrol} from '../src/adventure/hipotetico/HypotheticalChasePatrol';
import {drawChasePatrol} from '../src/adventure/hipotetico/HypotheticalChasePatrolArt';
import {launcherGeometry} from '../src/adventure/hipotetico/HypotheticalTower';
import {hypotheticalMotion,smoothMotion,dinosaurFootAnchor} from '../src/adventure/hipotetico/HypotheticalMotion';
import {CHASE_BREAKS,CHASE_FALLEN_DECKS,CHASE_LEAP,CHASE_PATROLS,CHASE_PORTICO} from '../src/adventure/hipotetico/HypotheticalLayout';
import {CHASE_QUAYS} from '../src/adventure/hipotetico/HypotheticalChaseLife';
import {chaseCollapsedEdge} from '../src/adventure/hipotetico/HypotheticalChaseDetails';
import {CHASE_STRIKE_REACH,chaseStrikeX} from '../src/adventure/hipotetico/HypotheticalChasePerformance';
import {pixelText} from '../src/graphics/BitmapFont';

const [destination,canvasModule,frameDestination]=process.argv.slice(2);
const out=resolve(destination),frames=resolve(frameDestination);
mkdirSync(out,{recursive:true});mkdirSync(frames,{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const native=createCanvas(320,180),c=native.getContext('2d');c.imageSmoothingEnabled=false;
const display=createCanvas(320,180);display.style={};const renderer=new Renderer(display);
const plate=(w:number,h:number)=>{const canvas=createCanvas(w,h),context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
    context.fillStyle='#132b34';context.fillRect(0,0,w,h);return {canvas,context};};
const board=plate(1280,816),details=plate(640,288),movie=plate(960,588);
const contacts=plate(1280,612);
let frameNumber=0;
const make=()=>{
    const stage=hypotheticalStage('chase'),level=new WorldLevel(stage.level),objects=new WorldObjects(stage.mechanisms),b=new HypotheticalModel('chase');
    const hero=new Player(0,0).data;hero.hasHelmet=true;hero.facingRight=true;hero.isGrounded=true;hero.velocity.x=3.5;
    b.state='rest';b.age=90;b.velocity=b.motionSpeed=3.5;return {stage,level,objects,b,hero};
};
type Scene=ReturnType<typeof make>;
function paint(s:Scene,cx:number,patrol?:HypotheticalChasePatrol,reduced=false){
    const {b,level,objects,hero}=s,edge=chaseCollapsedEdge(b.x)/16;
    if(hero.position.x>3056&&b.course.porticoAt===-1)b.course.porticoAt=b.course.launchAt=b.course.impactAt=0;
    level.data.tiles=s.stage.level.tiles.map((row,y)=>row.map((tile,x)=>y>=13&&x<edge?0:tile));
    objects.bodies=new WorldObjects(s.stage.mechanisms).bodies.filter(p=>p.x>=edge*16);
    for(const [i,d]of CHASE_FALLEN_DECKS.entries())if(b.course.fallenDeck(i).ready&&d.x>=edge*16)
        objects.bodies.push(...new WorldObjects([{...d,kind:'support'}]).bodies);
    level.bodies=objects.bodies;
    b.chaseBreaks=CHASE_BREAKS.map(site=>chaseStrikeX(site)>b.x+CHASE_STRIKE_REACH?-1:b.tick-Math.floor((b.x+CHASE_STRIKE_REACH-chaseStrikeX(site))/3.5));
    b.chaseAlerts=CHASE_BREAKS.map(site=>chaseStrikeX(site)>b.x+128?-1:b.tick-Math.floor((b.x+128-chaseStrikeX(site))/3.5));
    b.chaseReactions=CHASE_QUAYS.map(site=>site.x>b.x+210?-1:b.tick-Math.floor((b.x+210-site.x)/3.5));
    drawHypotheticalBackground(c,b,cx,64,reduced);drawHypotheticalTerrain(c,level,b,cx,64);
    drawHypotheticalObjects(c,objects,b,cx,64,reduced);
    if(patrol)drawChasePatrol(c,patrol,cx,64,reduced);
    drawHypotheticalCombat(c,b,cx,64,reduced);
    renderer.drawPlayer(hero,{x:cx,y:64,shakeTimer:0},c);
    c.fillStyle='#132b34';c.fillRect(0,0,320,16);pixelText(c,'FLAVIO HIPOTETICO',8,5,'#e6c390');
}
function film(title:string){
    const fc=movie.context;fc.fillStyle='#132b34';fc.fillRect(0,0,960,588);
    fc.drawImage(native,0,48,960,540);pixelText(fc,title,14,9,'#e6c390',2);
    pixelText(fc,'COMPOSICAO DIRIGIDA / RENDERIZADOR NATIVO / SEM PARTIDA OU AUDIO',14,34,'#a9c0b6');
    writeFileSync(join(frames,String(frameNumber++).padStart(5,'0')+'.png'),movie.canvas.toBuffer('image/png'));
}
function cell(row:number,col:number,title:string){
    board.context.drawImage(native,col*320,row*204+24);
    pixelText(board.context,title,col*320+8,row*204+8,'#e6c390');
}
function contact(row:number,col:number,title:string){
    contacts.context.drawImage(native,col*320,row*204+24);
    pixelText(contacts.context,title,col*320+8,row*204+8,'#e6c390');
}
function running(s:Scene,tick:number,playerX:number,playerY=200){
    const {b,hero}=s;b.tick=b.course.tick=tick;b.x=playerX-110;b.travel=b.x+18;
    hero.position={x:playerX,y:playerY};hero.isGrounded=playerY===200;hero.animationFrame=Math.floor(tick/5)%6;
}
try{
    const s=make(),b=s.b,start=1000,fire=CHASE_PORTICO.fire,flight=34,impact=start+fire+flight;
    running(s,start+fire,CHASE_PORTICO.trigger+fire*3.5);
    b.course.porticoAt=start;b.course.launchAt=start+fire;
    const g=launcherGeometry({bow:b.bow,...hypotheticalMotion(b)},b.chaseLauncher!);
    const source={x:b.x+g.mouth[0],y:b.y+g.mouth[1],backX:b.x+g.exhaust[0],backY:b.y+g.exhaust[1]};
    const dx=CHASE_PORTICO.targetX-source.x,dy=CHASE_PORTICO.targetY-source.y,length=Math.hypot(dx,dy);
    for(let a=0;a<=190;a+=2){
        const jump=a>=132&&a<=164?a-132:-1;
        running(s,start+a,CHASE_PORTICO.trigger+a*3.5,jump<0?200:200-8*jump+.25*jump*jump);
        b.course.porticoAt=start;b.course.launchAt=a<fire?-1:start+fire;b.course.impactAt=a<fire+flight?-1:impact;
        b.course.launch=a<fire?null:{...source,dx:dx/length,dy:dy/length};b.course.rocket=null;b.course.trail=[];
        if(a>=fire&&a<fire+flight){
            const t=(a-fire)/flight,progress=t*t*.25+t*.75;
            b.course.rocket={x:source.x+dx*progress,y:source.y+dy*progress,fromX:source.x,fromY:source.y,
                dx:dx/length,dy:dy/length,age:a-fire,remaining:length*(1-progress),speed:14,motorAge:a<fire+6?-1:a-fire-6};
            for(let i=0;i<Math.min(30,(a-fire-6)*2);i++){
                const p=Math.max(0,progress-i*.012);
                b.course.trail.push({x:source.x+dx*p,y:source.y+dy*p,born:b.tick-i*.4,seed:i});
            }
        }
        const lead=b.course.cameraLead(s.hero.position.x),cx=s.hero.position.x-150+lead;
        paint(s,cx);film('PORTICO / PREPARACAO, DISPARO E TRAVESSIA');
        const col=[32,60,88,128].indexOf(a);if(col>=0)cell(0,col,['SACAR E APOIAR','FOGUETE','RUPTURA','NOVOS APOIOS'][col]);
        const detailCol=[96,116,130,148].indexOf(a);
        if(detailCol>=0)contact(0,detailCol,['TENSIONAR','SOLTAR E GIRAR','PRIMEIRO CONTATO','ASSENTAR'][detailCol]);
        if(a===32||a===56){
            const col=a===32?0:1;details.context.drawImage(native,0,24,160,132,col*320,24,320,264);
            pixelText(details.context,col?'SAIDA DO CANO':'CAVALEIRO / APOIO',col*320+8,8,'#e6c390');
        }
    }
    for(const [i,upper]of [false,true].entries()){
        running(s,1240,2828,upper?120:184);b.course.tick=1240;b.course.impactAt=impact;b.course.rocket=null;
        paint(s,2680,undefined,i===1);cell(1,i,upper?'PASSARELA DE MANUTENCAO':'DECKS ASSENTADOS');
    }
    for(let a=-50;a<=148;a+=2){
        const water=make();running(water,1800+a,4022+a*3.5);
        water.b.course.floodWarningAt=1720;water.b.course.floodAt=a<0?-1:1800;
        const jump=a-18;if(jump>=0&&jump<=32){
            water.hero.position.y=200-8*jump+.25*jump*jump;water.hero.isGrounded=false;
        }
        paint(water,water.hero.position.x-110);film('COMPORTAS / PRESSAO, RUPTURA E FRENTE DE AGUA');
        if(a===-20)cell(1,2,'PRESSAO NO RESERVATORIO');
        if(a===36){cell(1,3,'CRUZAR A CRISTA');writeFileSync(join(out,'water.png'),native.toBuffer('image/png'));}
        const col=[4,12,32,110].indexOf(a);
        if(col>=0)contact(1,col,['TAMPA / PRIMEIRO JATO','FORMAR A CRISTA','AGUA E GRAVIDADE','ESCOAR NO CANAL'][col]);
    }
    for(let a=0;a<=108;a+=2){
        const leap=make();running(leap,2400+a,CHASE_LEAP.trigger+a*3.5);
        leap.b.course.leapAt=2400;leap.b.course.leapFrom=CHASE_LEAP.trigger-110+87;leap.b.course.leapTo=CHASE_LEAP.landingX;
        const land=CHASE_LEAP.prepare+CHASE_LEAP.flight,px=leap.b.course.leapPosition;
        const gait=(leap.b.course.leapFrom+18)/11;
        leap.b.course.takeoffFeet=[dinosaurFootAnchor(gait,true,1,0,0),dinosaurFootAnchor(gait,false,1,0,0)];
        leap.b.x=px??(a<CHASE_LEAP.prepare?CHASE_LEAP.trigger-110+a*2.9:CHASE_LEAP.landingX+Math.max(0,a-land)*2.4);
        leap.b.y=224-leap.b.course.leapHeight;leap.b.travel=leap.b.x+18;
        const jump=a-76;if(jump>=0&&jump<=32){leap.hero.position.y=200-8*jump+.25*jump*jump;leap.hero.isGrounded=false;}
        paint(leap,leap.hero.position.x-126);film('PASSARELAS / IMPULSO, VOO E ATERRISSAGEM');
        const col=[18,48,land,90].indexOf(a);if(col>=0)cell(2,col,['PREPARACAO','TRAJETORIA','CONTATO','RECUPERACAO'][col]);
        const detailCol=[28,46,70,78].indexOf(a);
        if(detailCol>=0)contact(2,detailCol,['APOIO / IMPULSO','PERNAS RECOLHIDAS','ESTENDER OS PES','ABSORVER O IMPACTO'][detailCol]);
    }
    for(const [index,spec]of CHASE_PATROLS.entries()){
        for(let a=0;a<=130;a+=2){
            const scene=make();running(scene,3000+a,spec.trigger+a*3.5);
            const e=new HypotheticalChasePatrol(spec,()=>scene.b.x),tell=Math.round(e.warningDuration/(1000/60));
            e.engaged=true;e.age=a*1000/60;
            e.phase=a<tell?'warning':a<tell+23?'attack':a<tell+41?'recoil':'walk';
            e.timer=(a<tell?a:a<tell+23?a-tell:a<tell+41?a-tell-23:a-tell-41)*1000/60;
            e.motionX=e.phase==='attack'?-2.35:e.phase==='walk'?1.7:0;
            e.distance=Math.max(0,a-tell)*2.35;
            if(spec.role==='scout'){
                e.x=spec.x-2.35*Math.min(23,Math.max(0,a-tell))+1.7*Math.max(0,a-tell-41);
                if(index===2&&a>=tell&&a<tell+19){const t=a-tell;e.y=spec.y-e.height-4.6*t+.25*t*t;e.vy=-4.6+.5*t;}
            }else{
                e.x=spec.x+1.1*Math.min(24,Math.max(0,a-tell));
                const cart=e.cart!;cart.released=a>=tell;cart.distance=2.7*Math.max(0,a-tell);cart.x=spec.x-72-cart.distance;
                if(cart.x+cart.width<scene.b.x+24){cart.broken=true;cart.impactAge=Math.max(0,a-tell-17)*1000/60;}
            }
            if(scene.b.x+36>e.x+e.width){e.dead=true;e.deadTimer=400;}
            const jump=a-(spec.role==='loader'?34:30);
            if(jump>=0&&jump<=32){scene.hero.position.y=200-8*jump+.25*jump*jump;scene.hero.isGrounded=false;}
            paint(scene,scene.hero.position.x-110,e);film(spec.role==='loader'?'CARGA / OPERADOR E CARRINHO':'BATEDOR / PREPARACAO E MOVIMENTO COMPROMETIDO');
            if(index===0&&(a===24||a===44))cell(3,a===24?0:1,a===24?'BATEDOR / PREPARACAO':'BATEDOR / INVESTIDA');
            if(index===1&&(a===30||a===50))cell(3,a===30?2:3,a===30?'OPERADOR / LIBERACAO':'CARRINHO / TRAVESSIA');
        }
    }
    writeFileSync(join(out,'chase-expansion.png'),board.canvas.toBuffer('image/png'));
    writeFileSync(join(out,'rider-details.png'),details.canvas.toBuffer('image/png'));
    writeFileSync(join(out,'event-detail.png'),contacts.canvas.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'directed native art',revision:'contact-2',gameplay:false,audio:false,frames:frameNumber,fps:30},null,2)+'\n');
    console.log(`Authored ${frameNumber} directed frames and native art plates.`);
}finally{renderer.dispose();for(const dispose of clean.reverse())dispose();}
