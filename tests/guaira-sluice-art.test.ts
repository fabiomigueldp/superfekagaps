import { GUAIRA_FLOW_STEP as STEP } from '../src/adventure/experimental/guaira/GuairaFluidArt';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { WorldObjects } from '../src/adventure/WorldPhysics';
import { GUAIRA_TRAVERSAL as G, guairaTraversalStage } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { drawGuairaBridgeHoists, drawGuairaSluice, drawGuairaSluiceReservoir, guairaSluiceRise } from '../src/adventure/experimental/guaira/GuairaSluiceArt';
import { drawGuairaTraversalObjects } from '../src/adventure/experimental/guaira/GuairaTraversalArt';
import { drawGuairaReservoirFlow, drawGuairaSluiceFlow } from '../src/adventure/experimental/guaira/GuairaWaterworksArt';
import { guairaInclinedPipeRoute } from '../src/adventure/experimental/guaira/GuairaPipeArt';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';

function raster() {
    const pixels = new Map<string,string>();
    let bounds = [-4096,-4096,4096,4096], pending = bounds;
    const stack: Array<{ fill: string; bounds: number[] }> = [];
    const c = {
        fillStyle: '#123456',
        save() { stack.push({ fill: this.fillStyle, bounds: [...bounds] }); },
        restore() { const s = stack.pop()!; this.fillStyle = s.fill; bounds = s.bounds; },
        beginPath() {}, rect(x:number,y:number,w:number,h:number) { pending = [x,y,x+w,y+h]; },
        clip() { bounds = [Math.max(bounds[0],pending[0]),Math.max(bounds[1],pending[1]),Math.min(bounds[2],pending[2]),Math.min(bounds[3],pending[3])]; },
        fillRect(x:number,y:number,w:number,h:number) {
            assert.ok([x,y,w,h].every(Number.isInteger), 'native pixel grid');
            for (let yy=Math.max(y,bounds[1]); yy<Math.min(y+h,bounds[3]); yy++)
                for (let xx=Math.max(x,bounds[0]); xx<Math.min(x+w,bounds[2]); xx++) pixels.set(`${xx},${yy}`,this.fillStyle);
        },
    };
    return { c: c as unknown as CanvasRenderingContext2D, pixels, balanced: () => !stack.length && c.fillStyle==='#123456' };
}

for (const [id,rightBank] of [[G.bridgeId,224],[G.finalBridgeId,192]] as const) {
    test(`${id}: chains stay attached for the entire native travel, with no tail beneath the deck`, () => {
        const objects = new WorldObjects(guairaTraversalStage().mechanisms), b = objects.get(id)!;
        const colors = new Set(['#817563','#b9a78b','#9b8c73']);
        const axleY = Math.min(224,rightBank)-37;
        for (const y of [336,325.5,301,279.4,250,225,224]) {
            b.y = y; const before = structuredClone(b), p = raster();
            drawGuairaBridgeHoists(p.c,b,224,rightBank,0,0);
            assert.deepEqual(b,before); assert.ok(p.balanced());
            for (const cable of [b.x+5,b.x+b.width-6]) {
                for (let yy=axleY+7; yy<Math.round(y)+2; yy++)
                    assert.ok(colors.has(p.pixels.get(`${cable-1},${yy}`)!), `connected chain at ${cable},${yy}`);
                for (let yy=Math.round(y)+2; yy<354; yy++) assert.equal(p.pixels.has(`${cable-1},${yy}`),false);
            }
            for (const x of [b.x-9,b.x+b.width+8]) assert.ok(p.pixels.has(`${x},${x<b.x?223:rightBank-1}`),'footing touches the native bank');
            assert.ok(![...p.pixels.values()].includes('#ead19b'),'support never claims a playable cap');
        }
    });

    test(`${id}: actual deck covers the chain attachments and keeps its complete supporting cap`, () => {
        const objects = new WorldObjects(guairaTraversalStage().mechanisms), b = objects.get(id)!;
        for (const y of [336,280.3,224]) {
            b.y = y; b.active = true;
            const cx = b.x-24, cy = Math.round(y)-70, p = raster();
            drawGuairaTraversalObjects(p.c,objects,cx+.2,cy+.2,2400,false);
            assert.ok(p.balanced());
            for (let xx=24; xx<24+b.width; xx++) for (const yy of [70,71])
                assert.equal(p.pixels.get(`${xx},${yy}`),'#ead19b',`native cap at ${xx},${yy}`);
        }
    });
}

test('pulley position is fixed, rotation follows displacement and fractional cameras cannot shimmer', () => {
    const b = new WorldObjects(guairaTraversalStage().mechanisms).get(G.bridgeId)!;
    const paint = (cx:number,cy:number) => { const p=raster(); drawGuairaBridgeHoists(p.c,b,224,224,cx,cy); return p.pixels; };
    const initial = paint(0,0);
    assert.deepEqual(paint(.2,.2),initial);
    const shifted = paint(17,31);
    for (const [key,color] of initial) { const [x,y]=key.split(',').map(Number); assert.equal(shifted.get(`${x-17},${y-31}`),color); }
    b.y -= 5;
    const moved = paint(0,0);
    for (const x of [417,622]) assert.equal(moved.get(`${x},187`),'#ede0b3','axle stays fixed');
    assert.notDeepEqual([...initial].filter(([k]) => k.endsWith(',185')), [...moved].filter(([k]) => k.endsWith(',185')), 'spokes rotate');
    b.home!.y = 400; b.to!.y = 200; b.y = 300;
    assert.equal(guairaSluiceRise(b),.5,'gate uses authored endpoints, not a separate 112px animation');
});

test('opening the shutter reveals a fixed falling stream instead of pulling its reflections upward', () => {
    for (let step=0; step<20; step++) {
        const closed=raster(),open=raster(),later=raster();
        drawGuairaSluiceFlow(closed.c,30,100,170,true,step*STEP.falling,false,100);
        drawGuairaSluiceFlow(open.c,30,89,170,true,step*STEP.falling,false,100);
        drawGuairaSluiceFlow(later.c,30,89,170,true,(step+1)*STEP.falling,false,100);
        for (let y=101; y<169; y++) for (let x=47; x<65; x++) {
            assert.equal(open.pixels.get(`${x},${y}`),closed.pixels.get(`${x},${y}`));
            assert.equal(later.pixels.get(`${x},${y}`),open.pixels.get(`${x},${y-1}`),'water advances down one pixel, including the wrap');
        }
    }
});

test('the last pool and rice plot respond only to their own native valve', t => {
    const h=guairaTraversalBrowser(t),g=h.create();
    const background=()=>{const p=raster();g.art.background(p.c,{} as never,1360,88,g.time);return p.pixels;};
    const pool=()=>{const p=raster();g.art.objects!(p.c,g.objects,1120,112,g.time);return p.pixels.get('12,153');};
    const dry=background(); assert.equal(pool(),'#8c5e4b');
    g.objects.activate(G.valveId);
    assert.deepEqual(background(),dry,'first valve cannot irrigate the final plot'); assert.equal(pool(),'#8c5e4b');
    g.objects.activate(G.finalValveId);
    assert.notDeepEqual(background(),dry); assert.equal(pool(),'#63b6bf');
    g.load(G.id); assert.deepEqual(background(),dry); assert.equal(pool(),'#8c5e4b');
});

for (const reducedMotion of [false,true]) test(`hydraulic art freezes with the native simulation, including impact and respawn (reduced: ${reducedMotion})`, t => {
    const h=guairaTraversalBrowser(t,{reducedMotion}),g=h.create(); g.objects.activate(G.valveId); h.run(g,8);
    const paint=()=>{const p=raster();g.art.background(p.c,{} as never,360,112,g.time+99999);g.art.objects!(p.c,g.objects,360,112,g.time+99999);return p.pixels;};
    const before=paint(),clock=g.objects.time,presentation=g.time;
    (g as unknown as {hitStop:number}).hitStop=200; h.run(g,6);
    assert.equal(g.objects.time,clock); assert.ok(g.time>presentation); assert.deepEqual(paint(),before);
    g.toggleTraversalPause(); h.run(g,12); assert.deepEqual(paint(),before); g.toggleTraversalPause();
    (g as unknown as {hitStop:number}).hitStop=0; g.player.data.respawnRevealTimer=400; h.run(g,6);
    assert.equal(g.objects.time,clock); assert.deepEqual(paint(),before);
    g.player.data.respawnRevealTimer=0; h.run(g,20); assert.notDeepEqual(paint(),before,'real deck and chain travel still visible with reduced motion');
});

test('completed crossing keeps ambient water alive without advancing mechanisms, and pauses it', t => {
    const h=guairaTraversalBrowser(t),g=h.create();
    const replay=JSON.parse(readFileSync(new URL('./helpers/guairaTraversalReplay.json',import.meta.url),'utf8')) as {runs:Array<[number,string[]]>};
    for (const [n,keys] of replay.runs) h.run(g,n,keys);
    assert.equal(g.finished,true); const state=structuredClone(g.objects),elapsed=g.elapsed;
    const paint=()=>{const p=raster();g.art.objects!(p.c,g.objects,416,112,g.time);return p.pixels;};
    const before=paint(); h.run(g,10); assert.notDeepEqual(paint(),before);
    assert.deepEqual(structuredClone(g.objects),state); assert.equal(g.elapsed,elapsed);
    g.toggleTraversalPause(); const paused=paint(); h.run(g,20); assert.deepEqual(paint(),paused);
});

test('reservoir currents approach the outlet and descend through the coping without a wrap jump', () => {
    const paint=(time:number,reduced=false)=>{const p=raster();drawGuairaReservoirFlow(p.c,20,30,true,time,reduced);assert.ok(p.balanced());return p.pixels;};
    for(let step=0;step<23;step++) {
        const a=paint(step*STEP.surface),b=paint((step+1)*STEP.surface);
        for(let x=35;x<61;x++) assert.equal(b.get(`${x},37`),a.get(`${x-1},37`),'left current approaches throat');
        for(let x=63;x<89;x++) assert.equal(b.get(`${x},37`),a.get(`${x+1},37`),'right current approaches throat');
    }
    for(let step=0;step<14;step++) {
        const a=paint(step*STEP.falling),b=paint((step+1)*STEP.falling);
        for(let y=44;y<56;y++) for(let x=55;x<69;x++)
            assert.equal(b.get(`${x},${y}`),a.get(`${x},${y-1}`),'throat flows down through the repeat seam');
    }
    assert.deepEqual(paint(0,true),paint(99999,true));
    for(const time of [NaN,-100,Infinity]) assert.deepEqual(paint(time),paint(0));
});

test('basin animation changes only water pixels, with a stable stone rim, clay bank and closed pose', () => {
    const paint=(active:boolean,time:number,reduced=false)=>{
        const p=raster();drawGuairaSluiceReservoir(p.c,40.2,50.2,active,time,reduced);assert.ok(p.balanced());return p.pixels;
    };
    const base=paint(false,0),liquid=new Set(['#326f81','#83c0bb','#b3d6c5','#79b1ad','#477e82']);
    assert.deepEqual(paint(false,12345),base);
    assert.deepEqual(paint(true,0,true),paint(true,12345,true));
    let changes=0;
    for(let time=0;time<4500;time+=140) for(const[key,color]of paint(true,time)) if(color!==base.get(key)) {
        assert.ok(liquid.has(base.get(key)!),`animation stays within the existing water at ${key}`);changes++;
    }
    assert.ok(changes>0);
});

test('each upstream basin draws water only after its own valve opens', t => {
    const h=guairaTraversalBrowser(t),g=h.create();
    const colors=new Set(['#beddd0','#b5d7c8']);
    const currents=(final:boolean)=>{
        const p=raster();g.art.background(p.c,{} as never,final?1088:368,final?96:108,g.time);
        return [...p.pixels.values()].filter(color=>colors.has(color)).length;
    };
    assert.equal(currents(false),0);assert.equal(currents(true),0);
    g.objects.activate(G.valveId);assert.ok(currents(false)>0);assert.equal(currents(true),0);
    g.objects.activate(G.finalValveId);assert.ok(currents(true)>0);
    g.load(G.id);assert.equal(currents(false),0);assert.equal(currents(true),0);
});

test('wall sockets keep the whole inclined sight glass clear up to both masonry faces', () => {
    const objects=new WorldObjects(guairaTraversalStage().mechanisms);
    const ports=[
        {wall:498,side:-1,from:[500,198],to:[411,210],id:G.bridgeId,cx:368,cy:108},
        {wall:547,side:1,from:[546,198],to:[627,210],id:G.bridgeId,cx:368,cy:108},
        {wall:1215,side:-1,from:[1117,210],to:[1217,179],id:G.bridgeId,cx:1088,cy:96},
        {wall:1264,side:1,from:[1263,179],to:[1363,187],id:G.finalBridgeId,cx:1088,cy:96},
    ] as const;
    for(const first of [false,true]) for(const final of [false,true]) for(const time of [0,100,700,1900,2000]) {
        objects.get(G.bridgeId)!.active=first;objects.get(G.finalBridgeId)!.active=final;
        for(const port of ports) {
            const p=raster();drawGuairaTraversalObjects(p.c,objects,port.cx+.2,port.cy+.2,time,false);
            const water=objects.get(port.id)!.active?new Set(['#63b6bf','#a6d6c8']):new Set(['#b68c63']);
            const route=guairaInclinedPipeRoute(port.from,port.to);
            for(let distance=1;distance<=8;distance++) {
                const point=route.find(([x])=>x===port.wall+port.side*distance)!;
                for(const offset of [-1,0,1]) assert.ok(water.has(p.pixels.get(`${point[0]-port.cx},${point[1]+offset-port.cy}`)!),
                    `socket at ${port.wall} cannot cover glass ${point[0]},${point[1]+offset}`);
            }
        }
    }
});

test('sluice screw remains joined to the moving nut and its handwheel follows displacement, not time', () => {
    const b=new WorldObjects(guairaTraversalStage().mechanisms).get(G.bridgeId)!;
    const paint=(time:number,reduced=false)=>{const p=raster();drawGuairaSluice(p.c,b,498,175,368.2,108.2,time,reduced);assert.ok(p.balanced());return p.pixels;};
    const before=structuredClone(b);
    const wheel=(p:Map<string,string>)=>[...p].filter(([key])=>{const y=Number(key.split(',')[1]);return y>=55&&y<=61;});
    const initial=wheel(paint(0));assert.deepEqual(initial,wheel(paint(9999)));
    b.y=320;assert.notDeepEqual(wheel(paint(0)),initial);
    for(const y of [336,325.5,301,279.4,250,225,224]) {
        b.y=y;const a=paint(0),end=67+14-Math.round((336-y)/112*11)+8;
        for(let row=63;row<end;row++) assert.ok(['#c6a675','#6e6250'].includes(a.get(`154,${row}`)!),`thread reaches the nut below the fixed yoke at ${row}`);
        assert.equal(a.get(`154,${end}`),'#bca077');
        assert.deepEqual(a,paint(9999,true),'mechanical pose remains readable with reduced motion');
    }
    b.y=before.y;assert.deepEqual(b,before,'rendering is read-only');
});
