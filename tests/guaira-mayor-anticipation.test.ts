import assert from 'node:assert/strict';
import test from 'node:test';
import { drawGuairaMayor, MAYOR_PALETTE as P, type GuairaMayorArtState } from '../src/adventure/experimental/guaira/GuairaMayorArt';
import { GuairaMayorModel, MAYOR_ARENA as A, MAYOR_RULES as R } from '../src/adventure/experimental/guaira/GuairaMayorModel';

/** Production integer paint, including the actor's real facing transform. */
function raster(m: GuairaMayorArtState, reduced = false, cx = 0, cy = 0) {
    const pixels = new Map<string, string>();
    let color = '', tx = 0, ty = 0, sx = 1, sy = 1;
    const stack: number[][] = [];
    const c = {
        get fillStyle() { return color; }, set fillStyle(value: string) { color = value; },
        save() { stack.push([tx, ty, sx, sy]); }, restore() { [tx, ty, sx, sy] = stack.pop()!; },
        translate(x: number, y: number) { tx += x * sx; ty += y * sy; },
        scale(x: number, y: number) { sx *= x; sy *= y; },
        fillRect(x: number, y: number, w: number, h: number) {
            assert.ok([x, y, w, h].every(Number.isInteger)); assert.ok(w > 0 && h > 0);
            const left = Math.min(tx + x * sx, tx + (x + w) * sx), top = Math.min(ty + y * sy, ty + (y + h) * sy);
            for (let yy = top; yy < top + h; yy++) for (let xx = left; xx < left + w; xx++)
                pixels.set(`${xx},${yy}`, color);
        }
    };
    const before = JSON.stringify(m);
    drawGuairaMayor(c as unknown as CanvasRenderingContext2D, m, cx, cy, reduced);
    assert.equal(JSON.stringify(m), before, 'the painter cannot write to model state');
    assert.equal(stack.length, 0, 'canvas transforms are balanced');
    return pixels;
}
const closed = { valveActive: false, liftReady: false, registerOpened: false };

test('hydraulic commands have distinct wind-up and recoil poses with a fixed reduced-motion tell', () => {
    const m = new GuairaMayorModel();
    advance(m, R.intro + R.idle + R.warning + R.leap + R.stamp + R.returning);
    m.update(R.tickMs, { valveActive: true, liftReady: true, registerOpened: true });
    assert.equal(m.contact({x:274,y:119,width:14,height:24},{x:274,y:95,width:14,height:24},true),'hit');
    advance(m,R.hurt+R.idle);assert.equal(m.state,'jetWarning');
    const poses:Map<string,string>[]=[],reduced=raster(m,true);
    for(let i=0;i<R.jetWarning;i++){
        if([0,16,32].includes(i))poses.push(raster(m));
        assert.deepEqual(raster(m,true),reduced,'the raised pointing arm stays legible without decorative motion');
        advance(m,1);
    }
    assert.equal(new Set(poses.map(p=>JSON.stringify([...p]))).size,3);
    const discharge=raster(m);assert.equal(m.state,'jetBurst');advance(m,12);
    assert.notDeepEqual(raster(m),discharge,'the discharge has a separate braced recoil and held order');
    for(const p of [...poses,discharge])assert.equal(Math.max(...[...p.keys()].map(key=>Number(key.split(',')[1]))),A.deckY-1);
});

test('resting blink closes both eyes briefly, changes only the face and freezes with reduced motion', () => {
    const m = new GuairaMayorModel(); m.state = 'intro'; m.tick = 0;
    const open = raster(m), signature = (p: Map<string,string>) => JSON.stringify([...p]);
    const openSignature = signature(open), closedTicks: number[] = [];
    for (let tick = 0; tick < 600; tick++) {
        m.tick = tick;
        const pose = raster(m);
        if (signature(pose) !== openSignature) {
            closedTicks.push(tick);
            for (const [key, color] of pose) if (color !== open.get(key)) {
                const [x,y] = key.split(',').map(Number);
                assert.ok(x >= 271 && x <= 284 && y >= 121 && y <= 133, 'blink escaped the eyes');
            }
            assert.deepEqual(raster(m), pose, 'pause retains exactly the same eyelids');
        }
        if (tick % 30 === 0 || tick % 300 >= 274 && tick % 300 < 280)
            assert.deepEqual(raster(m, true), open, 'reduced motion holds the open eyes');
    }
    assert.equal(closedTicks.length, 12, 'two 100 ms blinks in ten seconds, not two seconds with a masked face');
    assert.deepEqual(closedTicks.slice(0,6), [274,275,276,277,278,279]);
});
function advance(m: GuairaMayorModel, ticks: number) {
    for (let i = 0; i < ticks; i++) m.update(R.tickMs, closed);
}
function warning(tick = 0) {
    const m = new GuairaMayorModel(); advance(m, R.intro + R.idle + tick);
    assert.equal(m.state, 'warning'); return m;
}

test('the existing warning clock raises the stamp in three authored, held beats', () => {
    const poses = [0, 20, 40].map(tick => raster(warning(tick)));
    assert.equal(new Set(poses.map(p => JSON.stringify([...p]))).size, 3);
    for (const [i, tick] of [19, 39, 59].entries()) assert.deepEqual(raster(warning(tick)), poses[i]);
    const tops = poses.map(p => Math.min(...[...p].filter(([, color]) => color === P.woodLight)
        .map(([key]) => Number(key.split(',')[1]))));
    assert.deepEqual(tops, [117, 113, 111], 'stamp is raised from the first warning tick, then held above the head');
    for (const p of poses) assert.equal([...p.values()].filter(color => color === P.warning).length, 20,
        'all three solid amber warning marks remain visible, without flashing');
});

test('warning anticipation never slides the feet, torso base, head or gate key', () => {
    const held = raster(warning(59));
    for (const tick of [0, 19, 20, 39]) {
        const pose = raster(warning(tick));
        const keys = new Set([...pose.keys(), ...held.keys()]);
        for (const key of keys) {
            const [x, y] = key.split(',').map(Number);
            if (pose.get(key) !== held.get(key)) assert.ok(x >= 244 && x <= 274 && y >= 110 && y < 135,
                `wind-up escaped the raised arm and stamp at ${key}`);
            if (y >= 135 || x >= 279) assert.equal(pose.get(key), held.get(key), `planted art changed at ${key}`);
        }
        for (let y = 121; y < 133; y++) for (let x = 271; x < 284; x++)
            assert.equal(pose.get(`${x},${y}`), held.get(`${x},${y}`), 'face keeps its original reading');
        assert.equal(Math.max(...[...pose.keys()].map(key => Number(key.split(',')[1]))), A.deckY - 1);
    }
});

test('reduced motion keeps one complete raised silhouette for all sixty warning ticks', () => {
    const full = raster(warning(59));
    for (let tick = 0; tick < R.warning; tick++) assert.deepEqual(raster(warning(tick), true), full);
});

test('paused clocks, missing signals and integer camera placement are deterministic', () => {
    const m = warning(20), first = raster(m);
    assert.deepEqual(raster(m), first, 'repainting cannot animate a paused warning');
    m.tick += 9000;
    assert.deepEqual(raster(m), first, 'the global idle clock cannot advance an attack gesture');
    const art: GuairaMayorArtState = { ...m, publicWaterOpen: m.publicWaterOpen, warningProgress: m.warningProgress };
    for (const progress of [undefined, NaN, Infinity, 1, 5])
        assert.deepEqual(raster({ ...art, warningProgress: progress }), raster(warning(59)), 'unknown or completed progress holds a clear warning');
    assert.deepEqual(raster({ ...art, warningProgress: -2 }), raster(warning(0)));
    const shifted = raster(m, false, 3.4, 63.6);
    for (const [key, color] of first) {
        const [x, y] = key.split(',').map(Number);
        assert.equal(shifted.get(`${x - 3},${y - 64}`), color);
    }
});

test('preparation cannot consume time, expose the back or delay the first dangerous tick', () => {
    const m = warning();
    for (let tick = 0; tick < R.warning; tick++) {
        assert.equal(m.stateTick, tick); assert.equal(m.state, 'warning');
        assert.equal(m.danger, null); assert.equal(m.vulnerable, false);
        raster(m); raster(m, true); advance(m, 1);
    }
    assert.equal(m.state, 'leap'); const target = m.stampTarget;
    for (let n = 0; n < R.leap; n++) { assert.equal(m.danger, null); raster(m); advance(m, 1); }
    assert.equal(m.state, 'stamp'); assert.equal(m.stateTick, 0); assert.equal(m.danger, target);
    for (let tick = 0; tick < R.stamp; tick++) {
        assert.equal(m.state, 'stamp'); assert.equal(m.danger, target);
        raster(m); raster(m, true); advance(m, 1);
    }
    assert.equal(m.state, 'returning'); advance(m, R.returning);
    assert.equal(m.state, 'recover'); assert.equal(m.stateTick, 0); assert.equal(m.danger, null);
});

test('walking, flight, landing and recoil have authored poses on the simulation clock',()=>{
    const m=new GuairaMayorModel(),signature=(p:Map<string,string>)=>JSON.stringify([...p]);
    m.state='idle';const strides=new Set<string>();
    for(let tick=0;tick<32;tick+=4){m.tick=tick;strides.add(signature(raster(m)));assert.deepEqual(raster(m),raster(m));}
    assert.equal(strides.size,5,'five distinct weight-bearing leg silhouettes');
    m.state='leap';const flight=[3,16,27].map(tick=>{m.stateTick=tick;return signature(raster(m));});
    assert.equal(new Set(flight).size,3,'tucked takeoff, apex and extended landing legs');
    m.state='returning';m.stateTick=22;assert.notEqual(signature(raster(m)),flight[1],'return jump lowers the tool');
    m.state='stamp';const impact=[2,10,20].map(tick=>{m.stateTick=tick;return signature(raster(m));});
    assert.equal(new Set(impact).size,3,'compression, impact hold and recovery');
    m.state='hurt';const recoil=[2,16,32].map(tick=>{m.stateTick=tick;return signature(raster(m));});
    assert.equal(new Set(recoil).size,3);
    m.state='leap';m.stateTick=16;const normal=raster(m);m.facing=1;
    assert.notDeepEqual(raster(m),normal,'travel direction actually changes the silhouette');
    assert.deepEqual(raster(m,true),raster(m,true),'reduced motion retains a deterministic readable action');
});

test('landing compression keeps soles and heavy tools on the real surface',()=>{
    const m=new GuairaMayorModel();m.state='stamp';
    const first=raster(m);
    for(let tick=0;tick<24;tick++){
        m.stateTick=tick;const p=raster(m);
        assert.equal(Math.max(...[...p.keys()].map(key=>Number(key.split(',')[1]))),A.deckY-1,'no part sinks through the running surface');
        if(tick<16)for(let y=153;y<160;y++)for(const [x0,x1] of [[264,274],[282,294]])
            for(let x=x0;x<x1;x++)assert.equal(p.get(`${x},${y}`),first.get(`${x},${y}`),'the knees absorb the squash, not the boots');
    }
});
