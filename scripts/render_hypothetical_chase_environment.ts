/** Native environment authoring. Cameras, actors and event ages are staged;
 * no gameplay updates, input replay, assertions or browser review. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {Player} from '../src/entities/Player';
import {WorldLevel,WorldObjects} from '../src/adventure/WorldPhysics';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {hypotheticalStage} from '../src/adventure/hipotetico/HypotheticalStage';
import {drawHypotheticalBackground,drawHypotheticalTerrain,drawHypotheticalObjects,drawHypotheticalCombat} from '../src/adventure/hipotetico/HypotheticalArt';
import {CHASE_BREAKS,CHASE_DISTRICTS,CHASE_GAPS,CHASE_FALLEN_DECKS} from '../src/adventure/hipotetico/HypotheticalLayout';
import {CHASE_ROADSIDE,drawChaseRoadside} from '../src/adventure/hipotetico/HypotheticalChaseRoadside';
import {CHASE_QUAYS} from '../src/adventure/hipotetico/HypotheticalChaseLife';
import {chaseStrikeX,CHASE_STRIKE_REACH} from '../src/adventure/hipotetico/HypotheticalChasePerformance';
import {chaseCollapsedEdge} from '../src/adventure/hipotetico/HypotheticalChaseDetails';
import {pixelText} from '../src/graphics/BitmapFont';

const [destination,canvasModule]=process.argv.slice(2),out=resolve(destination);
mkdirSync(out,{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const cleanup:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>cleanup.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
Object.assign(h.document,{documentElement:{dataset:{}}});
const {Renderer}=await import('../src/engine/Renderer');
const display=createCanvas(320,180);display.style={};const renderer=new Renderer(display);
const makePlate=(w:number,height:number)=>{
    const canvas=createCanvas(w,height),c=canvas.getContext('2d');
    c.imageSmoothingEnabled=false;c.fillStyle='#142e37';c.fillRect(0,0,w,height);return {canvas,c};
};
const native=makePlate(320,180),atlas=makePlate(1280,1224),details=makePlate(960,696),motion=makePlate(960,600);
const cameras=[[32,256,620,880],[1152,1416,1648,1888],[2264,2480,2688,3040],
    [3552,3792,4112,4656],[4960,5264,5576,6064],[6592,6872,7328,7720]];
const fixtureNames={mooring:'AMARRACAO',net:'REDE',reel:'CARRETEL',tools:'FERRAMENTAS',cabinet:'ARMARIO',pipe:'TUBULACAO'};
function scene(cx:number,tick=800){
    const stage=hypotheticalStage('chase'),level=new WorldLevel(stage.level),objects=new WorldObjects(stage.mechanisms);
    const b=new HypotheticalModel('chase'),hero=new Player(0,0).data;
    b.x=cx+40;b.tick=b.course.tick=tick;b.travel=b.x+18;b.velocity=b.motionSpeed=3.5;b.state='rest';b.age=80;
    b.chaseBreaks=CHASE_BREAKS.map(s=>chaseStrikeX(s)>b.x+CHASE_STRIKE_REACH?-1:tick-Math.floor((b.x+CHASE_STRIKE_REACH-chaseStrikeX(s))/3.5));
    b.chaseAlerts=CHASE_BREAKS.map(s=>chaseStrikeX(s)>b.x+128?-1:tick-Math.floor((b.x+128-chaseStrikeX(s))/3.5));
    b.chaseReactions=CHASE_QUAYS.map(s=>s.x+160>b.x+210?-1:tick-Math.floor((b.x+210-s.x-160)/3.5));
    if(cx>=2480){
        b.course.porticoAt=tick-70;b.course.launchAt=tick-18;
        if(cx>=2688)b.course.impactAt=tick-72;
    }
    const edge=chaseCollapsedEdge(b.x),col=edge/16;
    for(let j=Math.max(0,col-8);j<col;j++)if(stage.level.tiles[14][j])
        b.bridgeDebris.push({x:j*16,born:tick-(col-j)*4,material:0});
    level.data.tiles=stage.level.tiles.map((r,y)=>r.map((t,x)=>y>=13&&x<col?0:t));
    objects.bodies=objects.bodies.filter(p=>p.x>=edge);
    if(cx>=2688)for(const d of CHASE_FALLEN_DECKS)if(d.x>=edge)objects.bodies.push(...new WorldObjects([{...d,kind:'support'}]).bodies);
    level.bodies=objects.bodies;
    const px=cx+150,gap=CHASE_GAPS.some(([a,z])=>px>=a*16&&px<z*16);
    const deck=objects.bodies.find(p=>px>=p.x&&px+14<=p.x+p.width);
    const top=deck?.y??(level.data.tiles[13][Math.floor(px/16)]?208:224);
    hero.position={x:px,y:gap&&!deck?152:top-24};hero.hasHelmet=true;hero.facingRight=true;
    hero.isGrounded=!gap||Boolean(deck);hero.velocity.x=3.5;hero.animationFrame=3;
    return {b,hero,level,objects};
}
function paint(s:ReturnType<typeof scene>,cx:number,reduced=false){
    const {c}=native,{b,hero,level,objects}=s;
    drawHypotheticalBackground(c,b,cx,64,reduced);drawHypotheticalTerrain(c,level,b,cx,64);
    drawHypotheticalObjects(c,objects,b,cx,64,reduced);drawHypotheticalCombat(c,b,cx,64,reduced);
    renderer.drawPlayer(hero,{x:cx,y:64,shakeTimer:0},c);
}
try{
    for(const [row,views]of cameras.entries())for(const [col,cx]of views.entries()){
        const s=scene(cx);paint(s,cx);
        atlas.c.drawImage(native.canvas,col*320,row*204+24);
        pixelText(atlas.c,CHASE_DISTRICTS[row].name+' / '+['ENTRADA','PERCURSO','ALTURA','SAIDA'][col],col*320+8,row*204+8,'#d8c69f');
        if(col===0||col===3)writeFileSync(join(out,`district-${row}-${col}.png`),native.canvas.toBuffer('image/png'));
        if(col===0){paint(s,cx,true);writeFileSync(join(out,`district-${row}-reduced.png`),native.canvas.toBuffer('image/png'));}
    }
    // Native details of all six kinds, composed on their actual banks.
    for(const [i,index]of [0,1,2,3,4,6].entries()){
        const prop=CHASE_ROADSIDE[index],cx=prop.x-120,s=scene(cx);
        s.b.x=cx-100;s.b.bridgeDebris=[];paint(s,cx);
        const x=i%3*320,y=Math.floor(i/3)*348;
        details.c.drawImage(native.canvas,96,104,80,80,x,y+28,320,320);
        pixelText(details.c,fixtureNames[prop.kind]+' / PIXELS NATIVOS 4X',x+8,y+10,'#d8c69f');
    }
    for(const [row,index]of [1,2,4].entries())for(const [col,age]of [-1,8,17,29].entries()){
        const prop=CHASE_ROADSIDE[index],b=new HypotheticalModel('chase'),cx=prop.x-100;
        const anchor=Math.floor((prop.x+prop.width/2)/16)*16;
        b.tick=900+Math.max(0,age);b.x=age<0?prop.x-70:anchor+48+age*3.5;b.travel=b.x+18;
        if(age>=0)b.bridgeDebris=[{x:anchor,born:900,material:0}];
        native.c.fillStyle='#365e68';native.c.fillRect(0,0,320,180);
        native.c.fillStyle='#4c817f';native.c.fillRect(0,176,320,4);
        drawChaseRoadside(native.c,b,cx,64,false);
        motion.c.drawImage(native.canvas,80,120,80,60,col*240,row*200+20,240,180);
        pixelText(motion.c,fixtureNames[prop.kind]+' / '+['APOIO','SOLTURA','CONTATO','AGUA'][col],col*240+8,row*200+6,'#d8c69f');
    }
    writeFileSync(join(out,'environment.png'),atlas.canvas.toBuffer('image/png'));
    writeFileSync(join(out,'fixtures.png'),details.canvas.toBuffer('image/png'));
    writeFileSync(join(out,'fixture-motion.png'),motion.canvas.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'directed native art',gameplay:false,browser:false,
        frames:0,views:cameras,scope:'24 authored environment views; six native fixture details; three staged falling fixtures. No simulation advanced.'},null,2));
    console.log('Composed 24 environment views and native fixture detail/motion plates.');
}finally{renderer.dispose();for(const f of cleanup.reverse())f();}
