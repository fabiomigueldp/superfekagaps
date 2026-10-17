import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaMayorModel, MAYOR_RULES as R, mayorOverlaps, type MayorAccess } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { drawGuairaMayor, drawGuairaMayorStampTarget, drawGuairaMayorRushForeground, MAYOR_PALETTE as P, type GuairaMayorArtState } from '../src/adventure/experimental/guaira/GuairaMayorArt';
import { drawGuairaMayorFeedback } from '../src/adventure/experimental/guaira/GuairaMayorFeedbackArt';
import { drawGuairaMayorBackground } from '../src/adventure/experimental/guaira/GuairaMayorArenaArt';
import type { Rect } from '../src/types';

const closed:MayorAccess={valveActive:false,liftReady:false,registerOpened:false};
const opened:MayorAccess={valveActive:true,liftReady:true,registerOpened:true};
function until(m:GuairaMayorModel,state:string,access=closed){
    for(let i=0;i<2000&&m.state!==state;i++)m.update(R.tickMs,access);
    assert.equal(m.state,state);
}
function phase(n:number,x=80){
    const m=new GuairaMayorModel();
    for(let i=1;i<n;i++){
        until(m,'recover');m.update(R.tickMs,opened);
        const p={x:m.opening.x,y:m.y-1,width:14,height:24};
        assert.equal(m.contact(p,{...p,y:m.y-25},true),'hit');
    }
    until(m,'jetWarning',{...closed,player:{x,y:200,width:14,height:24}});return m;
}

// Integer production paint, including mirror transforms and intersecting clips.
function raster(draw:(c:CanvasRenderingContext2D)=>void){
    const pixels=new Map<string,string>();let color='',tx=0,ty=0,sx=1,sy=1,paths:Rect[]=[],clips:Rect[][]=[];
    const stack:Array<{tx:number;ty:number;sx:number;sy:number;clips:Rect[][]}>=[];
    const rect=(x:number,y:number,w:number,h:number)=>({x:Math.min(tx+x*sx,tx+(x+w)*sx),y:Math.min(ty+y*sy,ty+(y+h)*sy),width:Math.abs(w*sx),height:Math.abs(h*sy)});
    const c={get fillStyle(){return color;},set fillStyle(value:string){color=value;},
        save(){stack.push({tx,ty,sx,sy,clips:[...clips]});},restore(){({tx,ty,sx,sy,clips}=stack.pop()!);},
        translate(x:number,y:number){tx+=x*sx;ty+=y*sy;},scale(x:number,y:number){sx*=x;sy*=y;},
        beginPath(){paths=[];},rect(x:number,y:number,w:number,h:number){paths.push(rect(x,y,w,h));},clip(){clips=[...clips,paths];},
        fillRect(x:number,y:number,w:number,h:number){
            assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(w>0&&h>0);
            const q=rect(x,y,w,h);
            for(let yy=q.y;yy<q.y+q.height;yy++)for(let xx=q.x;xx<q.x+q.width;xx++)
                if(clips.every(group=>group.some(r=>xx>=r.x&&xx<r.x+r.width&&yy>=r.y&&yy<r.y+r.height)))pixels.set(`${xx},${yy}`,color);
        }};
    draw(c as unknown as CanvasRenderingContext2D);assert.equal(stack.length,0);return pixels;
}

for(const phaseNumber of [2,3])for(const x of [80,248])test(`phase ${phaseNumber}, x ${x}: a fast full crossing brakes inside its committed lane without snapping`,()=>{
    const m=phase(phaseNumber,x),a={...closed,player:{x,y:200,width:14,height:24}};
    until(m,'rush',a);const lane=m.rush!.lane,initial=m.x,velocities:number[]=[],footsteps=new Set<string>();
    while(m.state==='rush'){
        const before=m.x,stopping=m.rush!.stopping;
        m.update(R.tickMs,a);velocities.push(Math.abs(m.x-before));
        assert.ok(m.x-8>=lane.x-.001&&m.x+36<=lane.x+lane.width+.001);
        if(stopping&&m.state==='rush'){
            assert.ok(m.dangers.length>0,'decelerating water cannot become a hidden safe zone');
            const q=m.rush!.rect,p={x:q.x+12,y:220,width:8,height:4};
            assert.equal(m.contact(p,p,false),'hurt');
        }
        for(const e of m.feedback.filter(e=>e.kind==='footstep'))footsteps.add(`${e.x},${e.y}`);
    }
    const peak=Math.max(...velocities),cruise=velocities.map(v=>Math.abs(v-peak)<1e-7);
    const tail=velocities.slice(cruise.lastIndexOf(true)+1);
    assert.ok(Math.abs(peak-(phaseNumber===3?R.finalRushSpeed:R.rushSpeed))<1e-7);
    assert.ok(velocities.filter(v=>Math.abs(v-peak)<1e-7).length>=20,'the core attack retains its fast traversal');
    assert.ok(Math.abs(m.x-initial)>=196);assert.ok(tail.length>=8);
    assert.ok(tail.every((v,i)=>i===0||v<=tail[i-1]+1e-8),'braking never accelerates back toward the player');
    assert.ok(velocities.at(-1)!<=.25+.001,'no full-speed final step');assert.equal(m.rush!.speed,0);
    assert.ok(footsteps.size>=7&&footsteps.size<=8,'bounded footfalls are distributed along the crossing');
    const end=m.x;for(let i=0;i<R.brake;i++)m.update(R.tickMs,a);
    assert.equal(m.x,end,'settling cannot slide outside the announced destination');
});

test('cutting pressure removes false wave tells but preserves the committed physical strike',()=>{
    const m=phase(2);until(m,'jetBurst');m.update(R.tickMs,opened);until(m,'warning');
    assert.equal(m.pressureInterrupted,true);assert.equal(m.waveWarning,false);
    const ink=raster(c=>drawGuairaMayorStampTarget(c,m));
    for(const key of ink.keys()){
        const [x,y]=key.split(',').map(Number);
        assert.ok(mayorOverlaps({x,y,width:.5,height:.5},m.stampTarget),'only the real landing is announced');
    }
    until(m,'stamp');assert.ok(m.dangers.length>0);until(m,'returning');assert.equal(m.waves.length,0);
    until(m,'recover');until(m,'idle');until(m,'warning');assert.equal(m.waveWarning,true,'pressure is restored in the next cycle');
    m.cancelAttacks();assert.equal(m.waveWarning,false);
});

test('a fresh post-stamp register removes the outgoing-wave signal immediately',()=>{
    const m=phase(2);until(m,'stamp');assert.equal(m.waveWarning,true);
    m.update(R.tickMs,opened);assert.equal(m.waveWarning,false);
    until(m,'returning',{...opened,registerOpened:false});assert.equal(m.waves.length,0);
});

for(const x of [80,248])for(const reduced of [false,true])test(`foreground water remains visible over the actor and inside contact (x=${x}, reduced=${reduced})`,()=>{
    const m=phase(2,x);until(m,'rush',{...closed,player:{x,y:200,width:14,height:24}});
    for(let n=0;n<12;n++)m.update(R.tickMs,closed);
    const before=JSON.stringify(m),cx=3.4,cy=63.6;
    const actor=raster(c=>drawGuairaMayor(c,m,cx,cy,reduced));
    const front=raster(c=>drawGuairaMayorRushForeground(c,m,cx,cy,reduced));
    const composite=raster(c=>{drawGuairaMayor(c,m,cx,cy,reduced);drawGuairaMayorRushForeground(c,m,cx,cy,reduced);});
    const contours=m.dangers.map(q=>({...q,x:Math.round(q.x-cx),y:Math.round(q.y-cy)}));
    const water=new Set<string>([P.water,P.waterLight,P.waterShade]);let revealed=0;
    for(const [key,color]of front){
        const [px,py]=key.split(',').map(Number);
        assert.ok(contours.some(q=>mayorOverlaps({x:px+.1,y:py+.1,width:.8,height:.8},q)));
        assert.ok(water.has(color));assert.equal(composite.get(key),color);
        if(actor.has(key)&&!water.has(actor.get(key)!))revealed++;
    }
    assert.ok(revealed>80,'a meaningful part of the crest survives the actor layer');
    assert.deepEqual(raster(c=>drawGuairaMayorRushForeground(c,m,cx,cy,reduced)),front);
    assert.equal(JSON.stringify(m),before);m.cancelAttacks();
    assert.equal(raster(c=>drawGuairaMayorRushForeground(c,m)).size,0);
});

test('a descent below the balcony projects its shadow on the lower floor',()=>{
    const m:GuairaMayorArtState={x:264,y:170,width:28,height:40,facing:-1,state:'vault',stateTick:20,tick:500,
        stampTarget:null,publicWaterOpen:false,sealsRemaining:2};
    const p=raster(c=>drawGuairaMayor(c,m));
    assert.equal(p.get('270,222'),P.creamDark);assert.equal(p.get('270,158'),undefined);
    const upper=raster(c=>drawGuairaMayor(c,{...m,y:90}));assert.equal(upper.get('270,158'),P.creamDark);
});

test('both boots remain above the physical foot plane throughout the landing extension',()=>{
    for(const facing of [-1,1] as const)for(let tick=0;tick<=32;tick++){
        const m:GuairaMayorArtState={x:144,y:120,width:28,height:40,facing,state:'leap',stateTick:tick,tick,
            motionProgress:tick/32,stampTarget:null,publicWaterOpen:false,sealsRemaining:2};
        const soles=[...raster(c=>drawGuairaMayor(c,m))].filter(([,color])=>color===P.sole);
        assert.ok(soles.length>0);
        assert.ok(soles.every(([key])=>Number(key.split(',')[1])<m.y+m.height),'boot sole must not sink through its landing plane');
    }
});

test('heel feedback is deterministic, non-damaging in color and quiet with reduced motion',()=>{
    const m=phase(2);until(m,'rush');for(let n=0;n<14;n++)m.update(R.tickMs,closed);
    const footsteps=m.feedback.filter(e=>e.kind==='footstep');assert.ok(footsteps.length>0);
    const state:GuairaMayorArtState={...m,stampTarget:m.stampTarget,publicWaterOpen:false,feedback:footsteps};
    const before=JSON.stringify(m),p=raster(c=>drawGuairaMayorFeedback(c,state,0,64));
    assert.ok(p.size>0);assert.deepEqual(raster(c=>drawGuairaMayorFeedback(c,state,0,64)),p);
    assert.ok([...p.values()].every(c=>![P.water,P.waterLight,P.waterShade].includes(c as typeof P.water)));
    assert.equal(raster(c=>drawGuairaMayorFeedback(c,state,0,64,true)).size,0);assert.equal(JSON.stringify(m),before);
});

for(const reduced of [false,true])test(`the balcony nozzle opens with the real crossfire, closes after discharge and clears on cancellation (reduced=${reduced})`,()=>{
    const m=phase(2,248),a={...closed,player:{x:248,y:136,width:14,height:24}};
    until(m,'rushWarning',a);
    const paint=()=>raster(c=>drawGuairaMayorBackground(c,m,0,64,0,reduced));
    assert.equal(paint().get('311,81'),P.warning);
    until(m,'rush',a);assert.equal(m.crossfire,null);assert.equal(m.jets.at(-1)!.age,0);
    assert.equal(paint().get('311,81'),P.waterLight,'launch cannot shut the source as the packet leaves it');
    for(let n=0;n<11;n++)m.update(R.tickMs,a);
    assert.equal(paint().get('314,84'),P.waterLight,'the shutter has a final partially open beat');
    assert.equal(paint().get('314,87'),P.ink);
    m.update(R.tickMs,a);assert.equal(paint().get('311,81'),P.bronzeLight);
    until(m,'warning');until(m,'recover');until(m,'idle');until(m,'jetWarning');
    m.cancelAttacks();assert.ok(![...paint().values()].includes(P.warning),'cancellation clears nozzle warnings too');
});
