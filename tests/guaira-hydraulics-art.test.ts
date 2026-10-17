import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldObjects, WorldLevel } from '../src/adventure/WorldPhysics';
import { guairaJunctionStage, GUAIRA_JUNCTION as G, JunctionRouting } from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import { drawJunctionCylinder, drawJunctionElbow, drawJunctionPipe } from '../src/adventure/experimental/guaira/junction/GuairaJunctionHardwareArt';
import { drawRespirosObjects, drawRespirosBackground, RESPIROS_WATER_COLORS as W } from '../src/adventure/experimental/guaira/respiros/GuairaRespirosArt';
import { guairaRespirosStage } from '../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import { guairaPipeRoute, drawGuairaPipeFlow, drawGuairaPipeSaddle, guairaInclinedPipeRoute, drawGuairaInclinedPipe, GUAIRA_PIPE_COLORS } from '../src/adventure/experimental/guaira/GuairaPipeArt';
import { drawJunctionIntake } from '../src/adventure/experimental/guaira/junction/GuairaJunctionHardwareArt';
import { drawGuairaAscentBackground } from '../src/adventure/experimental/guaira/GuairaAscentArt';
import { drawGuairaMayorBackground } from '../src/adventure/experimental/guaira/GuairaMayorArenaArt';
import { GuairaMayorModel } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';
import { guairaMayorBrowser } from './helpers/guairaMayorHarness';
import { readFileSync } from 'node:fs';
import { drawJunctionBackground } from '../src/adventure/experimental/guaira/junction/GuairaJunctionArt';
import { drawReliefBackground, drawReliefObjects, RELIEF_MATERIAL_COLORS as R } from '../src/adventure/experimental/guaira/relief/GuairaReliefArt';
import { guairaReliefStage, GUAIRA_RELIEF } from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';
import { guairaJunctionBrowser } from './helpers/guairaJunctionHarness';
import { guairaReliefBrowser } from './helpers/guairaReliefHarness';
import { pixelText } from '../src/graphics/BitmapFont';
import { TileType } from '../src/constants';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { guairaTraversalStage, GUAIRA_TRAVERSAL as T } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { drawGuairaTraversalObjects } from '../src/adventure/experimental/guaira/GuairaTraversalArt';
import { drawGuairaPoolFlow, drawGuairaSluiceImpact } from '../src/adventure/experimental/guaira/GuairaWaterworksArt';

function raster() {
    const pixels = new Map<string,string>();
    let bounds=[-4096,-4096,4096,4096],pending=bounds;
    const stack:Array<{fillStyle:string;globalAlpha:number;globalCompositeOperation:string;bounds:number[]}>=[];
    const c={fillStyle:'#123456',globalAlpha:.7,globalCompositeOperation:'multiply',
        save(){stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,bounds:[...bounds]});},
        restore(){const state=stack.pop()!;bounds=state.bounds;this.fillStyle=state.fillStyle;this.globalAlpha=state.globalAlpha;this.globalCompositeOperation=state.globalCompositeOperation;},
        beginPath(){},rect(x:number,y:number,w:number,h:number){pending=[x,y,x+w,y+h];},
        clip(){bounds=[Math.max(bounds[0],pending[0]),Math.max(bounds[1],pending[1]),Math.min(bounds[2],pending[2]),Math.min(bounds[3],pending[3])];},
        fillRect(x:number,y:number,w:number,h:number){
            assert.ok([x,y,w,h].every(Number.isInteger));
            for(let yy=Math.max(y,bounds[1]);yy<Math.min(y+h,bounds[3]);yy++)
                for(let xx=Math.max(x,bounds[0]);xx<Math.min(x+w,bounds[2]);xx++)pixels.set(`${xx},${yy}`,this.fillStyle);
        },
    };
    return {c:c as unknown as CanvasRenderingContext2D,pixels,balanced:()=>!stack.length&&c.fillStyle==='#123456'&&c.globalAlpha===.7&&c.globalCompositeOperation==='multiply'};
}

test('ram stays below its real platform, docks out of view and keeps a stationary foot',()=>{
    const objects=new WorldObjects(guairaJunctionStage().mechanisms),body=objects.get(G.liftAId)!;
    let foot:Map<string,string>|undefined;
    for(const y of [256,324,380,392,399.4,400]) {
        body.y=y;const before=JSON.stringify(body),paint=raster();
        drawJunctionCylinder(paint.c,body,0,0,G.recoveryY);
        assert.equal(JSON.stringify(body),before);assert.ok(paint.balanced());
        for(const key of paint.pixels.keys()) {
            const[x,yy]=key.split(',').map(Number);
            assert.ok(x>=291&&x<317&&yy>=Math.round(body.y+body.height)&&yy<G.recoveryY);
        }
        if(y>=392)assert.equal(paint.pixels.size,0,'a docked platform must not leave a floating cylinder foot above it');
        if(y<350) {
            const current=new Map([...paint.pixels].filter(([key])=>Number(key.split(',')[1])>=395));
            if(foot)assert.deepEqual(current,foot);else foot=current;
        }
        const shifted=raster();drawJunctionCylinder(shifted.c,body,17,31,G.recoveryY);
        assert.equal(shifted.pixels.size,paint.pixels.size);
        for(const[key,color]of paint.pixels){const[x,yy]=key.split(',').map(Number);assert.equal(shifted.pixels.get(`${x-17},${yy-31}`),color);}
    }
});

test('inspection pipe flow crosses its repeat seam in either direction, without escaping the glass',()=>{
    for(const vertical of [false,true])for(const direction of [-1,1] as const) {
        const before=raster(),after=raster();
        drawJunctionPipe(before.c,10,20,64,true,19*140,false,vertical,direction);
        drawJunctionPipe(after.c,10,20,64,true,20*140,false,vertical,direction);
        assert.ok(before.balanced()&&after.balanced());
        for(let along=4;along<60;along++) {
            const at=(i:number)=>`${10+(vertical?4:i)},${20+(vertical?i:4)}`;
            assert.equal(after.pixels.get(at(along)),before.pixels.get(at(along-direction)));
        }
        for(const[key,color]of before.pixels)if(color==='#b7dfd3') {
            const[x,y]=key.split(',').map(Number),along=vertical?y-20:x-10,across=vertical?x-10:y-20;
            assert.ok(along>=0&&along<64&&across===4);
        }
        const fixed=raster(),later=raster(),dry=raster();
        drawJunctionPipe(fixed.c,10,20,64,true,0,true,vertical,direction);
        drawJunctionPipe(later.c,10,20,64,true,90000,true,vertical,direction);
        drawJunctionPipe(dry.c,10,20,64,false,90000,false,vertical,direction);
        assert.deepEqual(fixed.pixels,later.pixels);assert.ok(![...dry.pixels.values()].includes('#68b6bf'));
    }
});

test('quarter-turn sight channels connect both mouths in wet and dry states',()=>{
    for(const wet of [false,true])for(const left of [false,true]) {
        const paint=raster();drawJunctionElbow(paint.c,20,30,wet,left);assert.ok(paint.balanced());
        const liquid=wet?'#68b6bf':'#bd9165';
        for(let i=3;i<=5;i++) {
            assert.equal(paint.pixels.get(`${20+i},38`),liquid);
            assert.equal(paint.pixels.get(`${left?20:28},${30+i}`),liquid);
        }
        for(const key of paint.pixels.keys()){const[x,y]=key.split(',').map(Number);assert.ok(x>=20&&x<29&&y>=30&&y<39);}
        assert.ok(!paint.pixels.has(`${left?28:20},30`),'outer corner stays rounded');
    }
});

test('pressurised water trails rise continuously across every wrap during full discharge',()=>{
    const objects=new WorldObjects(guairaRespirosStage().mechanisms.slice(0,1));
    const paint=(time:number)=>{objects.time=time;const r=raster(),before=JSON.stringify(objects);drawRespirosObjects(r.c,objects,80,144,-9999,false);assert.equal(JSON.stringify(objects),before);assert.ok(r.balanced());return r.pixels;};
    let movingPixels=0;
    for(const time of [1960,2030,2100,2170,2240]) {
        const before=paint(time),after=paint(time+70);
        for(let x=82;x<174;x++)for(let y=55;y<151;y++) {
            assert.equal(after.get(`${x},${y}`),before.get(`${x},${y+1}`),`one upward pixel at ${time}, ${x},${y}`);
            if(after.get(`${x},${y}`)===W.light&&before.get(`${x},${y}`)!==W.light)movingPixels++;
        }
    }
    assert.ok(movingPixels>100,'comparison must exercise moving light trails, not only the flat water fill');
});

test('one flow retains its distance through successive right, up and down bends and the repeat seam',()=>{
    const path=guairaPipeRoute([[20,80],[60,80],[60,40],[120,40],[120,120]]);
    for(let step=0;step<22;step++) {
        const a=raster(),b=raster();
        drawGuairaPipeFlow(a.c,path,0,0,step*100,false);
        drawGuairaPipeFlow(b.c,path,0,0,(step+1)*100,false);
        for(let d=1;d<path.length;d++)assert.equal(b.pixels.get(path[d].join(',')),a.pixels.get(path[d-1].join(',')));
        assert.ok(a.balanced()&&b.balanced());
    }
    const a=raster(),b=raster();
    drawGuairaPipeFlow(a.c,path,0,0,0,true);drawGuairaPipeFlow(b.c,path,0,0,99900,true);
    assert.deepEqual(a.pixels,b.pixels);
    const pointSet=new Set(path.map(p=>p.join(',')));
    for(const point of a.pixels.keys())assert.ok(pointSet.has(point));
});

test('production B flow crosses both elbow mouths continuously and A stays dry until the real switch',()=>{
    const routing=new JunctionRouting('b');routing.step('a',1);
    const paths=[guairaPipeRoute([[304,214],[304,204],[319,204]]),guairaPipeRoute([[624,204],[636,204],[636,220]])];
    let reflections=0;
    for(const points of paths) {
        const cx=points[0][0]-50,cy=160;
        const paint=(time:number)=>{const r=raster();drawJunctionBackground(r.c,cx,cy,time,false,routing);return r.pixels;};
        for(let step=0;step<20;step++) {
            const a=paint(step*100),b=paint((step+1)*100);
            const at=(d:number)=>`${points[d][0]-cx},${points[d][1]-cy}`;
            for(let d=1;d<points.length;d++) {
                assert.equal(b.get(at(d)),a.get(at(d-1)),`joined flow at ${points[d]} / ${step}`);
                if(b.get(at(d))==='#b7dfd3')reflections++;
            }
        }
    }
    assert.ok(reflections>70);
    const branch=()=>{const r=raster();drawJunctionBackground(r.c,240,236,1200,true,routing);return r.pixels.get('43,104');};
    assert.equal(branch(),'#bd9165','A remains dry throughout the 400ms request warning');
    routing.step('a',400);assert.equal(branch(),'#68b6bf','only actual supply wets A');
});

test('relief diverts visible water into the connected screened return and isolates the feed',()=>{
    const stage=guairaReliefStage(),level=new WorldLevel(stage.level);
    const paint=(time:number,reduced=false)=>{const c=raster();drawReliefBackground(c.c,level,220,176,time,reduced);assert.ok(c.balanced());return c.pixels;};
    for(const open of [false,true]) {
        if(open)level.data.tiles[10][15]=TileType.EMPTY;
        const before=JSON.stringify(level),a=paint(0),b=paint(700);
        assert.notDeepEqual(a,b,'water moves in the selected route');
        assert.deepEqual(paint(0,true),paint(700,true),'reduced flow is fixed');
        // Sample beside the centre reflection, at real port and glass edges.
        for(const pixels of [a,b]) {
            assert.equal(pixels.get('130,131'),open?'#aa8d67':R.safe,'feed at world 350,307');
            assert.equal(pixels.get('61,102'),open?R.safe:'#aa8d67','return at world 281,278');
            assert.equal(pixels.get('43,110'),open?'#aa8d67':R.safe,'lower tee at world 263,286');
            assert.equal(pixels.get('44,97'),R.safe,'source at world 264,273');
            if(open)for(const x of [291,292,293,294,295])assert.equal(pixels.get(`${x-220},102`),R.safe,'no gap at the screened return mouth');
        }
        assert.equal(JSON.stringify(level),before);
    }
});

test('relief warning never flashes a dry signal on the zero-height rising boundary',()=>{
    const objects=new WorldObjects(guairaReliefStage().mechanisms),b=objects.get(GUAIRA_RELIEF.jetId)!;
    const glyph=raster();pixelText(glyph.c,'!',49,103,R.ink);
    for(const time of [2699,2700,2700.2,2701]) {
        objects.time=time;const actual=raster();drawReliefObjects(actual.c,objects,320,176,true);
        const letters=new Map([...actual.pixels].filter(([key])=>{const[x,y]=key.split(',').map(Number);return x>=49&&x<54&&y>=103&&y<110;}));
        assert.deepEqual(letters,glyph.pixels,`warning at ${time}`);
    }
    assert.equal(jetCycle(b,2700).danger,null,'exercise the first rising tick before visible liquid');
    assert.equal(jetCycle(b,2700).phase,'rising');
});

for(const scene of ['patio','relief'] as const)test(`${scene} pipe animation uses native time through impact freeze and pause`,t=>{
    const h=scene==='patio'?guairaJunctionBrowser(t):guairaReliefBrowser(t),g=h.create();
    const run=(frames:number)=>{for(let i=0;i<frames;i++)g.update(1000/60);};
    run(3);
    const paint=()=>{const c=raster();g.art.background(c.c,{} as never,220,176,g.time+99999);return c.pixels;};
    const before=paint(),time=g.objects.time,presentation=g.time;
    (g as unknown as {hitStop:number}).hitStop=200;run(6);
    assert.equal(g.objects.time,time);assert.ok(g.time>presentation);assert.deepEqual(paint(),before);
    if('toggleJunctionPause' in g)g.toggleJunctionPause();else g.toggleReliefPause();
    run(12);assert.deepEqual(paint(),before);
});

test('inclined pipes keep an open sight channel through every joint in either direction',()=>{
    for(const [from,to] of [[[40,90],[160,60]],[[160,60],[40,90]],[[40,60],[140,68]]] as const) {
        const route=guairaInclinedPipeRoute(from,to), liquid=new Set([GUAIRA_PIPE_COLORS.water,GUAIRA_PIPE_COLORS.glint]);
        const paint=(time:number,reduced=false,wet=true,cx=0,cy=0)=>{const p=raster();drawGuairaInclinedPipe(p.c,route,cx,cy,wet,time,reduced);assert.ok(p.balanced());return p.pixels;};
        for(let step=0;step<21;step++) {
            const a=paint(step*100),b=paint((step+1)*100);
            for(let d=0;d<route.length;d++) {
                const [x,y]=route[d];for(const dy of [-1,0,1])assert.ok(liquid.has(a.get(`${x},${y+dy}`)!),'no collar plugs the glass');
                if(d)assert.equal(b.get(route[d].join(',')),a.get(route[d-1].join(',')),'reflection travels continuously, even at repeat seam');
            }
        }
        assert.deepEqual(paint(0,true),paint(99990,true));
        assert.ok(![...paint(500,false,false).values()].some(color=>liquid.has(color)),'inactive pipe stays dry');
        const a=paint(800),shift=paint(800,false,true,17.2,20.2);
        for(const[key,color]of a){const[x,y]=key.split(',').map(Number);assert.equal(shift.get(`${x-17},${y-20}`),color);}
    }
});

test('final inlet receives the first valve while its outlet waits for the second valve',()=>{
    const objects=new WorldObjects(guairaTraversalStage().mechanisms);
    const paint=()=>{const p=raster();const before=JSON.stringify(objects);drawGuairaTraversalObjects(p.c,objects,1100,100,0,true);assert.equal(JSON.stringify(objects),before);return p.pixels;};
    let p=paint();assert.equal(p.get('80,90'),'#b68c63');assert.equal(p.get('200,82'),'#b68c63');
    objects.activate(T.valveId);p=paint();assert.equal(p.get('80,90'),'#63b6bf');assert.equal(p.get('200,82'),'#b68c63');
    objects.activate(T.finalValveId);p=paint();assert.equal(p.get('80,90'),'#63b6bf');assert.equal(p.get('200,82'),'#63b6bf');
});

test('receiving ripples originate symmetrically at the real spill, including off-centre pools',()=>{
    for(const source of [53,95,121])for(const time of [0,240,3120,6240,6480]) {
        const p=raster();drawGuairaPoolFlow(p.c,0,184,20,true,time,false,source);
        for(let d=0;d<Math.min(source,184-source);d++)assert.equal(p.pixels.get(`${source-1-d},23`),p.pixels.get(`${source+d},23`));
        for(const key of p.pixels.keys()){const[x,y]=key.split(',').map(Number);assert.equal(y,23);assert.ok(x>=0&&x<184);}
    }
});

test('impact foam stays in the wet basin, with a stable reduced-motion pose and no damaging-water colors',()=>{
    const poses=new Set<string>();
    const paint=(time:number,wet=true,reduced=false)=>{const p=raster();drawGuairaSluiceImpact(p.c,20,110,80,68,wet,time,reduced);assert.ok(p.balanced());return p.pixels;};
    for(let time=0;time<720;time+=120) {
        const p=paint(time);poses.add(JSON.stringify([...p]));
        for(const[key,color]of p){const[x,y]=key.split(',').map(Number);assert.ok(x>=20&&x<110&&y>=80&&y<84);assert.ok(!Object.values(W).includes(color as never));}
    }
    assert.ok(poses.size>=6);assert.equal(paint(300,false).size,0);assert.deepEqual(paint(0,true,true),paint(95500,true,true));
});

test('pump feed flows through both visible elbow mouths before entering the buried grate supply',()=>{
    const route=guairaPipeRoute([[104,271],[104,283],[158,283],[158,294]]);
    const paint=(time:number)=>{const p=raster();drawRespirosBackground(p.c,0,144,time,false);assert.ok(p.balanced());return p.pixels;};
    let moving=0;
    for(let step=0;step<20;step++) {
        const a=paint(step*100),b=paint((step+1)*100);
        for(let d=1;d<route.length;d++) {
            const key=(i:number)=>`${route[i][0]},${route[i][1]-144}`;
            assert.equal(b.get(key(d)),a.get(key(d-1)),'no break at a pipe junction');
            if(b.get(key(d))==='#bad0b5'&&a.get(key(d))!=='#bad0b5')moving++;
        }
    }
    assert.ok(moving>30);
});

test('both grate-side warnings retain the charging arrow on the first zero-height rising tick',()=>{
    const objects=new WorldObjects(guairaRespirosStage().mechanisms);
    for(const body of objects.bodies.filter(b=>b.kind==='jet'))for(const normalized of [1799,1800,1801,2100,2499.5,2500]) {
        objects.time=(normalized-(body.phase??0)+4200)%4200;
        const state=jetCycle(body,objects.time),p=raster(),cx=body.x-60,cy=144;
        drawRespirosObjects(p.c,objects,cx,cy,99999,false);
        const rows=state.danger?['..#..','..#..','..#..','.....','..#..']:
            state.phase==='charging'||state.phase==='rising'?['..#..','.###.','#####','..#..','..#..']:['.....','.....','.....','#####','.....'];
        for(const left of [62,60+body.width-7])for(let y=0;y<5;y++)for(let x=0;x<5;x++)
            assert.equal(p.pixels.get(`${left+x},${168+y}`)==='#f0d29a',rows[y][x]==='#',`${body.id}: phase ${normalized}, glyph ${x},${y}`);
    }
});

test('wall saddles grip pipe edges without blocking any of the three sight-glass pixels',()=>{
    for(const vertical of [false,true])for(const wet of [false,true])for(const time of [0,100,1900,2000]) {
        const p=raster();drawJunctionPipe(p.c,50,70,80,wet,time,false,vertical);
        const before=new Map(p.pixels);
        drawGuairaPipeSaddle(p.c,vertical?54:90,vertical?110:74,vertical);
        assert.ok(p.balanced());assert.notDeepEqual(p.pixels,before);
        for(let along=0;along<80;along++)for(const across of [3,4,5]) {
            const key=`${50+(vertical?across:along)},${70+(vertical?along:across)}`;
            assert.equal(p.pixels.get(key),before.get(key),'mount never occludes the complete glass');
        }
    }
});

test('patio intake is seated and its inspection water descends continuously inside a fixed casing',()=>{
    const paint=(time:number,reduced=false)=>{const p=raster();drawJunctionIntake(p.c,120,250,time,reduced);assert.ok(p.balanced());return p.pixels;};
    const first=paint(0);
    for(let step=0;step<12;step++) {
        const a=paint(step*140),b=paint((step+1)*140);
        for(let y=262;y<273;y++)assert.equal(b.get(`135,${y}`),a.get(`135,${y-1}`));
        for(const[key,color]of b)if(color!==first.get(key)) {
            const[x,y]=key.split(',').map(Number);assert.ok(x>=129&&x<141&&y>=261&&y<273);
        }
    }
    for(let y=283;y<289;y++)assert.ok(first.has(`135,${y}`),'the inlet meets its stone footing');
    assert.deepEqual(paint(0,true),paint(99999,true));
    const routing=new JunctionRouting('b'),p=raster();drawJunctionBackground(p.c,350,128,0,true,routing);
    // The B sign occludes the upper part of its trestle; the exposed post below
    // that board must remain continuous all the way to the patio footing.
    for(const x of [410,550])for(let y=229;y<250;y++)assert.ok(['#b39b74','#8f8067'].includes(p.pixels.get(`${x-350},${y-128}`)!),'pipe trestle reaches the real patio');
});

test('relief return flow rounds the final corner and descends behind its screen only when opened',()=>{
    const level=new WorldLevel(guairaReliefStage().level);
    const paint=(time:number)=>{const p=raster();drawReliefBackground(p.c,level,220,176,time,false);return p.pixels;};
    const dry=paint(0);assert.equal(dry.get('124,110'),'#a08e73');
    level.data.tiles[10][15]=TileType.EMPTY;
    const route=guairaPipeRoute([[339,279],[344,279],[344,289]]);
    for(let step=0;step<21;step++) {
        const a=paint(step*100),b=paint((step+1)*100);
        for(let d=1;d<route.length;d++) {
            const[x,y]=route[d],[px,py]=route[d-1];
            assert.equal(b.get(`${x-220},${y-176}`),a.get(`${px-220},${py-176}`),'continuous return through the corner');
        }
        assert.equal(b.get('125,108'),R.pipeShade,'screen bar remains in front of the water');
    }
});

test('ascent feed retains one flow through the cistern elbow and wall mounts while the public branch stays dry',()=>{
    const paint=(time:number)=>{const p=raster();drawGuairaAscentBackground(p.c,1088,38,time,false);return p.pixels;};
    // Bureau coordinates are translated 320 pixels to the final terrace.
    const route=guairaPipeRoute([[824,89],[824,103],[944,103]]);
    for(let step=0;step<21;step++) {
        const a=paint(step*100),b=paint((step+1)*100);
        for(let d=1;d<route.length;d++) {
            const[x,y]=route[d],[px,py]=route[d-1];
            assert.equal(b.get(`${x-768},${y-38}`),a.get(`${px-768},${py-38}`),'source-to-tank flow, including repeat');
        }
        assert.equal(b.get('56,86'),'#b18b62','public branch below the locked gate is dry');
    }
});

test('mayor supply keeps the private inlet wet and opens the whole public route only on release',()=>{
    const mayor=new GuairaMayorModel(),paint=(time:number)=>{const p=raster();drawGuairaMayorBackground(p.c,mayor,0,64,time,false);return p.pixels;};
    for(const seals of [3,2,1,0]) {
        mayor.sealsRemaining=seals;const p=paint(0);
        assert.equal(p.get('150,129'),'#b18b62','partial seal removal cannot wet the public main');
        assert.equal(p.get('290,129'),'#80afa7','private pipe remains fed');
    }
    mayor.state='released';
    const route=guairaPipeRoute([[65,194],[36,194],[36,204]]);
    for(let step=0;step<21;step++) {
        const a=paint(step*100),b=paint((step+1)*100);
        for(let d=1;d<route.length;d++) {
            const[x,y]=route[d],[px,py]=route[d-1];
            // The nozzle's pale discharge begins at y203; the pipe is continuous above it.
            if(y>=203)continue;
            assert.equal(b.get(`${x},${y-64}`),a.get(`${px},${py-64}`));
        }
        assert.equal(b.get('150,129'),'#80afa7');
    }
});

for(const scene of ['subida','prefeito']as const)for(const reducedMotion of [false,true])
test(`${scene}: water follows simulation through hitstop, reveal and pause (reduced ${reducedMotion})`,t=>{
    const h=scene==='subida'?guairaAscentBrowser(t,{reducedMotion}):guairaMayorBrowser(t,{reducedMotion}),g=h.create();
    const run=(n:number)=>{for(let i=0;i<n;i++)g.update(1000/60);};run(8);
    const paint=()=>{const p=raster();g.art.background(p.c,{}as never,scene==='subida'?1088:0,scene==='subida'?38:64,g.time+99999);return p.pixels;};
    const initial=paint(),clock=g.objects.time,presentation=g.time;
    (g as unknown as{hitStop:number}).hitStop=200;run(6);
    assert.equal(g.objects.time,clock);assert.ok(g.time>presentation);assert.deepEqual(paint(),initial);
    if('toggleAscentPause'in g)g.toggleAscentPause();else g.toggleLabPause();run(12);assert.deepEqual(paint(),initial);
    if('toggleAscentPause'in g)g.toggleAscentPause();else g.toggleLabPause();
    (g as unknown as{hitStop:number}).hitStop=0;g.player.data.respawnRevealTimer=400;run(6);
    assert.equal(g.objects.time,clock);assert.deepEqual(paint(),initial);
    g.player.data.respawnRevealTimer=0;run(20);
    if(!reducedMotion)assert.notDeepEqual(paint(),initial);
});

test('completed ascent keeps water moving with fixed gameplay state and still freezes on pause',t=>{
    const h=guairaAscentBrowser(t),g=h.create();
    const baseline=raster();g.art.background(baseline.c,{}as never,1088,38,0);
    const replay=JSON.parse(readFileSync(new URL('./helpers/guairaAscentReplay.json',import.meta.url),'utf8'))as{runs:Array<[number,string[]]>};
    for(const[n,keys]of replay.runs)h.run(g,n,keys);
    assert.equal(g.finished,true);const objects=structuredClone(g.objects),elapsed=g.elapsed;
    const paint=()=>{const p=raster();g.art.background(p.c,{}as never,1088,38,g.time);return p.pixels;};
    const before=paint();h.run(g,18);assert.notDeepEqual(paint(),before);assert.deepEqual(structuredClone(g.objects),objects);assert.equal(g.elapsed,elapsed);
    g.toggleAscentPause();const paused=paint();h.run(g,20);assert.deepEqual(paint(),paused);
    g.load(g.stage.id);assert.equal(g.objects.time,0);
    assert.deepEqual(paint(),baseline.pixels);
});
