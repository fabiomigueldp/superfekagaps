import assert from 'node:assert/strict';
import test from 'node:test';
import { drawGuairaMayor, drawGuairaMayorStampTarget, MAYOR_PALETTE as P,
    type GuairaMayorArtState, type MayorCounterpressure } from '../src/adventure/experimental/guaira/GuairaMayorArt';
import { drawGuairaMayorObjects, MAYOR_ART_OBJECTS as O } from '../src/adventure/experimental/guaira/GuairaMayorArenaArt';

const seam=Object.freeze({x:208,y:140,width:32,height:20});
function state(phase:'warning'|'active'|null,elapsed=0):GuairaMayorArtState {
    const duration=phase==='warning'?60:24;
    const counterpressure:MayorCounterpressure|null=phase?Object.freeze({phase,rect:seam,ticksRemaining:duration-elapsed,progress:elapsed/duration}):null;
    return Object.freeze({x:264,y:120,width:28,height:40,state:'recover',stateTick:100,tick:700,
        vulnerable:true,accessRequested:true,stampTarget:{x:112,y:204,width:112,height:20},publicWaterOpen:false,sealsRemaining:2,counterpressure});
}

/** Integer raster of production fillRect commands, including the actor mirror. */
function paint(draw:(c:CanvasRenderingContext2D)=>void){
    const pixels=new Map<string,string>();let color='',tx=0,ty=0,sx=1,sy=1;
    const stack:number[][]=[];
    const c={
        get fillStyle(){return color;},set fillStyle(v:string){color=v;},
        save(){stack.push([tx,ty,sx,sy]);},restore(){[tx,ty,sx,sy]=stack.pop()!;},
        beginPath(){},rect(){},clip(){},
        translate(x:number,y:number){tx+=x*sx;ty+=y*sy;},scale(x:number,y:number){sx*=x;sy*=y;},
        fillRect(x:number,y:number,w:number,h:number){
            assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(w>0&&h>0);
            const left=Math.min(tx+x*sx,tx+(x+w)*sx),top=Math.min(ty+y*sy,ty+(y+h)*sy);
            for(let yy=top;yy<top+h;yy++)for(let xx=left;xx<left+w;xx++)pixels.set(`${xx},${yy}`,color);
        }
    };
    draw(c as unknown as CanvasRenderingContext2D);assert.equal(stack.length,0);
    return {pixels,at:(x:number,y:number)=>pixels.get(`${x},${y}`)};
}
const target=(m:GuairaMayorArtState,reduced=false,cx=0,cy=0)=>paint(c=>drawGuairaMayorStampTarget(c,m,cx,cy,reduced));
const actor=(m:GuairaMayorArtState,reduced=false)=>paint(c=>drawGuairaMayor(c,m,0,0,reduced));

test('seam warning has exact frozen bounds and a monotonic model-driven gauge',()=>{
    const lit:number[]=[];
    for(const elapsed of [0,20,40,59]){
        const m=state('warning',elapsed),before=JSON.stringify(m),normal=target(m),reduced=target(m,true);
        assert.deepEqual(normal.pixels,reduced.pixels,'reduced motion retains the functional warning');
        assert.deepEqual(target({...m,tick:999999,stateTick:250}).pixels,normal.pixels,'other clocks cannot move the gauge');
        for(const key of normal.pixels.keys()){
            const [x,y]=key.split(',').map(Number);
            assert.ok(x>=208&&x<240&&y>=140&&y<160,`warning leaked at ${key}`);
        }
        for(const x of [208,239])for(let y=140;y<160;y++)assert.equal(normal.at(x,y),P.warning);
        assert.equal(normal.at(208,140),P.warning);assert.equal(normal.at(239,159),P.warning);
        lit.push([...Array(24)].filter((_,i)=>normal.at(212+i,154)===P.warning).length);
        assert.equal(JSON.stringify(m),before,'painting cannot consume warning time');
    }
    assert.equal(lit[0],0);assert.ok(lit[1]>lit[0]&&lit[2]>lit[1]&&lit[3]>lit[2]);
});

test('every first and last danger pixel is water in both motion modes and camera offsets',()=>{
    const water=new Set<string>([P.water,P.waterLight,P.waterShade]);
    for(const elapsed of [0,23])for(const reduced of [false,true])for(const [cx,cy] of [[0,0],[3.4,63.6]]){
        const m=state('active',elapsed),p=target(m,reduced,cx,cy),x=Math.round(208-cx),y=Math.round(140-cy);
        assert.equal(p.pixels.size,32*20,'all 640 dangerous pixels are represented');
        for(let yy=y;yy<y+20;yy++)for(let xx=x;xx<x+32;xx++)assert.ok(water.has(p.at(xx,yy)!),`missing water at ${xx},${yy}`);
        assert.equal(p.at(x-1,y),undefined);assert.equal(p.at(x+32,y+19),undefined);
        assert.deepEqual(p.pixels,target(m,reduced,cx,cy).pixels,'pause repeats the exact water raster');
    }
    assert.equal(target(state(null)).pixels.size,0,'clearing the pulse clears the seam immediately');
});

test('pressure order articulates hand, stamp and face while keeping the true upper back exposed',()=>{
    const base=actor(state(null)),poses=new Set<string>();
    for(const m of [state('warning',0),state('warning',30),state('active',0)]){
        const before=JSON.stringify(m),normal=actor(m),reduced=actor(m,true);
        assert.deepEqual(normal.pixels,reduced.pixels,'all meaningful gestures survive reduced motion');
        assert.deepEqual(normal.pixels,actor(m).pixels,'paused order is stable');
        assert.equal(JSON.stringify(m),before);
        for(let y=120;y<126;y++)for(let x=264;x<292;x++)
            assert.equal(normal.at(x,y),base.at(x,y),`order covered opening at ${x},${y}`);
        poses.add(JSON.stringify([...normal.pixels]));
    }
    assert.equal(poses.size,3,'lift, extended order and downward discharge are distinct authored poses');
});

test('both crossing arrows become wait inlays until the pulse is over',()=>{
    const bodies=new Map([
        [O.lift,{...{x:112,y:160,width:112,height:8},kind:'lift',active:true,home:{x:112,y:224},to:{x:112,y:160}}],
        [O.deck,{x:224,y:160,width:92,height:8,kind:'support',active:true}],
        [O.valve,{x:64,y:216,width:32,height:8,kind:'switch',active:true}]
    ]);
    const objects=(m:GuairaMayorArtState)=>paint(c=>drawGuairaMayorObjects(c,bodies,m,0,0));
    for(const phase of ['warning','active'] as const){
        const p=objects(state(phase));
        assert.equal(p.at(204,162),P.warning,'lift carries amber wait hourglass');
        assert.equal(p.at(77,218),P.warning,'register repeats the wait meaning');
        assert.notEqual(p.at(211,164),P.waterLight,'no forward arrow remains on the lift');
        assert.equal(p.at(213,160),P.bronzeLight,'outlet is flush with the real platform');
    }
    const clear=objects(state(null));
    assert.equal(clear.at(211,164),P.waterLight,'forward route returns after the pulse');
    assert.equal(clear.at(76,220),P.waterLight);
});
