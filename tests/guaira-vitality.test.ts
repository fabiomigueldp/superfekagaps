import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldObjects } from '../src/adventure/WorldPhysics';
import { guairaTraversalStage } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { drawGuairaTraversalObjects } from '../src/adventure/experimental/guaira/GuairaTraversalArt';
import { drawGuairaWorker, GUAIRA_WORKER_BOUNDS, type GuairaWorkerKind, type GuairaWorkerVisualState } from '../src/adventure/experimental/guaira/GuairaWorkerArt';
import { drawGuairaWindPump, drawGuairaChannelFlow, drawGuairaRiceFlow, drawGuairaSluiceFlow, drawGuairaPoolFlow } from '../src/adventure/experimental/guaira/GuairaWaterworksArt';

/** Native helpers emit integer fillRect pixels; this recorder applies their rectangular clips. */
function raster() {
    const pixels = new Map<string, string>();
    type State = { fillStyle: string; clip: number[] };
    let state: State = { fillStyle: '#123456', clip: [-1000,-1000,1000,1000] }, path = state.clip;
    const stack: State[] = [];
    const c = {
        get fillStyle() { return state.fillStyle; }, set fillStyle(value: string) { state.fillStyle = value; },
        save() { stack.push({ fillStyle: state.fillStyle, clip: [...state.clip] }); }, restore() { state = stack.pop()!; },
        beginPath() {}, rect(x: number,y: number,w: number,h: number) { path=[x,y,x+w,y+h]; },
        clip() { state.clip=[Math.max(state.clip[0],path[0]),Math.max(state.clip[1],path[1]),Math.min(state.clip[2],path[2]),Math.min(state.clip[3],path[3])]; },
        fillRect(x: number,y: number,w: number,h: number) {
            assert.ok([x,y,w,h].every(Number.isInteger));
            for(let yy=Math.max(y,state.clip[1]);yy<Math.min(y+h,state.clip[3]);yy++)
                for(let xx=Math.max(x,state.clip[0]);xx<Math.min(x+w,state.clip[2]);xx++) pixels.set(`${xx},${yy}`,state.fillStyle);
        },
    };
    return { c:c as unknown as CanvasRenderingContext2D, pixels, balanced:()=>stack.length===0 && state.fillStyle==='#123456' };
}
const signature=(pixels:Map<string,string>)=>JSON.stringify([...pixels].sort(([a],[b])=>a.localeCompare(b)));
function worker(kind:GuairaWorkerKind,state:GuairaWorkerVisualState) { const r=raster();drawGuairaWorker(r.c,0,0,kind,Object.freeze(state));assert.ok(r.balanced());return r.pixels; }

test('worker articulation keeps fixed boots and a clear running strip for every mechanism pose', () => {
    for(const kind of ['pump','rice'] as const) {
        const base=worker(kind,{activeTimeMs:0,valveActive:false,bridgeRise:0,reducedMotion:false});
        for(const activeTimeMs of [0,1500,2000,2500,2880,3100,7000]) for(const [valveActive,bridgeRise] of [[false,0],[true,.1],[true,.6],[true,1]] as const) {
            const frame=worker(kind,{activeTimeMs,valveActive,bridgeRise,reducedMotion:false});
            for(const key of frame.keys()) {const [x,y]=key.split(',').map(Number);assert.ok(x>=GUAIRA_WORKER_BOUNDS.left&&x<GUAIRA_WORKER_BOUNDS.right&&y>=GUAIRA_WORKER_BOUNDS.top&&y<GUAIRA_WORKER_BOUNDS.bottom);}
            for(let y=-5;y<0;y++) for(const left of [-2,6]) for(let x=left;x<left+5;x++) assert.equal(frame.get(`${x},${y}`),base.get(`${x},${y}`),'work/tool movement cannot overwrite the boots');
        }
    }
});

test('worker pause and reduced motion are stable, including a restored open checkpoint', () => {
    for(const kind of ['pump','rice'] as const) for(const valveActive of [false,true]) {
        const state={activeTimeMs:1500,valveActive,bridgeRise:valveActive?1:0,reducedMotion:false};
        assert.equal(signature(worker(kind,state)),signature(worker(kind,state)));
        assert.equal(signature(worker(kind,{...state,reducedMotion:true,activeTimeMs:0})),signature(worker(kind,{...state,reducedMotion:true,activeTimeMs:99000})));
        assert.equal(signature(worker(kind,{...state,activeTimeMs:NaN})),signature(worker(kind,{...state,activeTimeMs:0})));
    }
});

test('wind-pump sails progress through distinct poses while tower and axle stay fixed', () => {
    const poses:Map<string,string>[]=[];
    for(let time=0;time<=1400;time+=100){const r=raster();drawGuairaWindPump(r.c,50,80,time,false);assert.ok(r.balanced());poses.push(r.pixels);}
    assert.ok(new Set(poses.map(signature)).size>3,'the old two-pose toggle must not return');
    for(const pose of poses)for(const [key,color] of poses[0]){const [x,y]=key.split(',').map(Number);if(y>=40||x>=48&&x<53&&y>=21&&y<26)assert.equal(pose.get(key),color);}
    const a=raster(),b=raster();drawGuairaWindPump(a.c,50,80,0,true);drawGuairaWindPump(b.c,50,80,55555,true);assert.equal(signature(a.pixels),signature(b.pixels));
});

test('dry channels draw nothing and reduced water is deterministic and clipped', () => {
    const painters=[
        (c:CanvasRenderingContext2D,t:number,wet:boolean,rm:boolean)=>drawGuairaChannelFlow(c,10,130,20,wet,t,rm,-1),
        (c:CanvasRenderingContext2D,t:number,wet:boolean,rm:boolean)=>drawGuairaRiceFlow(c,10,20,120,wet,t,rm,1),
        (c:CanvasRenderingContext2D,t:number,wet:boolean,rm:boolean)=>drawGuairaSluiceFlow(c,10,20,100,wet,t,rm),
    ];
    for(const paint of painters){const dry=raster();paint(dry.c,5000,false,false);assert.equal(dry.pixels.size,0);const a=raster(),b=raster();paint(a.c,0,true,true);paint(b.c,9000,true,true);assert.equal(signature(a.pixels),signature(b.pixels));assert.ok(a.balanced()&&b.balanced());const clipped=raster();clipped.c.beginPath();clipped.c.rect(30,30,20,20);clipped.c.clip();paint(clipped.c,9000,true,false);for(const key of clipped.pixels.keys()){const [x,y]=key.split(',').map(Number);assert.ok(x>=30&&x<50&&y>=30&&y<50);}}
});

test('repeating channel, rice and falling-water patterns cross their wrap one pixel forward', () => {
    for(const direction of [-1,1] as const){const a=raster(),b=raster();drawGuairaChannelFlow(a.c,0,160,0,true,31*120,false,direction);drawGuairaChannelFlow(b.c,0,160,0,true,32*120,false,direction);for(let x=20;x<140;x++)for(let y=2;y<5;y++)assert.equal(b.pixels.get(`${x},${y}`),a.pixels.get(`${x-direction},${y}`));}
    for(const row of [0,1]){const a=raster(),b=raster();drawGuairaRiceFlow(a.c,0,0,160,true,38*240,false,row);drawGuairaRiceFlow(b.c,0,0,160,true,39*240,false,row);for(let x=20;x<140;x++)for(let y=6;y<12;y++)assert.equal(b.pixels.get(`${x},${y}`),a.pixels.get(`${x-1},${y}`));}
    const a=raster(),b=raster();drawGuairaSluiceFlow(a.c,0,0,100,true,18*90,false);drawGuairaSluiceFlow(b.c,0,0,100,true,19*90,false);for(let y=20;y<80;y++)for(let x=17;x<35;x++)assert.equal(b.pixels.get(`${x},${y}`),a.pixels.get(`${x},${y-1}`));
});


test('pool wrap radiates outward and its integrated pixels stay on the authored surface row', () => {
    const a=raster(),b=raster();drawGuairaPoolFlow(a.c,0,184,20,true,26*240,false,95);drawGuairaPoolFlow(b.c,0,184,20,true,27*240,false,95);
    for(let x=20;x<75;x++)assert.equal(b.pixels.get(`${x},23`),a.pixels.get(`${x+1},23`));
    for(let x=115;x<165;x++)assert.equal(b.pixels.get(`${x},23`),a.pixels.get(`${x-1},23`));
    const objects=new WorldObjects(guairaTraversalStage().mechanisms);
    const bridge=objects.get('guaira-bridge')!;bridge.active=true;bridge.y=224;objects.get('guaira-valve')!.active=true;
    const state=JSON.stringify(objects.bodies),result=raster();
    drawGuairaTraversalObjects(result.c,objects,416,112,6480,false);
    const pool=[...result.pixels].filter(([,color])=>color==='#b0dcce');assert.ok(pool.length>0);
    for(const [key] of pool){const[x,y]=key.split(',').map(Number);assert.equal(y,156);assert.ok(x>=12&&x<196);}
    assert.equal(JSON.stringify(objects.bodies),state);
});
