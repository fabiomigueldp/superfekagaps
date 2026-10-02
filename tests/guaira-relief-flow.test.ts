import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { WorldObjects } from '../src/adventure/WorldPhysics';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { guairaReliefStage, GUAIRA_RELIEF as G } from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';
import { drawReliefObjects, RELIEF_MATERIAL_COLORS as P } from '../src/adventure/experimental/guaira/relief/GuairaReliefArt';
import { drawReliefFlow } from '../src/adventure/experimental/guaira/relief/GuairaReliefFlow';
import { guairaReliefBrowser } from './helpers/guairaReliefHarness';

class Raster {
    fillStyle = '#000000'; globalAlpha = .37; globalCompositeOperation = 'multiply';
    readonly pixels = Array<string>(320 * 180).fill('');
    readonly calls: Array<[string, number, number, number, number]> = [];
    private bounds = [0, 0, 320, 180]; private pending = this.bounds;
    private stack: Array<{ fillStyle: string; globalAlpha: number; globalCompositeOperation: string; bounds: number[] }> = [];
    get depth() { return this.stack.length; }
    save() { this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation, bounds: this.bounds }); }
    restore() { Object.assign(this, this.stack.pop()); }
    beginPath() {}
    rect(x: number, y: number, w: number, h: number) { this.pending = [x, y, x + w, y + h]; }
    clip() { this.bounds = [Math.max(this.bounds[0], this.pending[0]), Math.max(this.bounds[1], this.pending[1]), Math.min(this.bounds[2], this.pending[2]), Math.min(this.bounds[3], this.pending[3])]; }
    fillRect(x: number, y: number, w: number, h: number) {
        assert.ok([x,y,w,h].every(Number.isInteger));
        assert.equal(this.globalAlpha,1); assert.equal(this.globalCompositeOperation,'source-over');
        this.calls.push([this.fillStyle,x,y,w,h]);
        const left = Math.max(x,this.bounds[0]), right = Math.min(x+w,this.bounds[2]);
        if (right <= left) return;
        for (let yy = Math.max(y,this.bounds[1]); yy < Math.min(y+h,this.bounds[3]); yy++)
            this.pixels.fill(this.fillStyle,yy*320+left,yy*320+right);
    }
    get context() { return this as unknown as CanvasRenderingContext2D; }
    at(x: number,y: number) { return this.pixels[y*320+x]; }
}
const liquid = new Set<string>([P.water,P.waterShade,P.foam]);
const fixture = () => new WorldObjects(guairaReliefStage().mechanisms);
function paint(objects:WorldObjects,reduced=false,cx=240,cy=176) {
    const c=new Raster();
    drawReliefObjects(c.context,objects,cx,cy,reduced);
    assert.equal(c.depth,0);assert.equal(c.fillStyle,'#000000');assert.equal(c.globalAlpha,.37);
    assert.equal(c.globalCompositeOperation,'multiply');return c;
}

test('one full native cycle preserves every opaque damage pixel and all nonliquid pixels',()=>{
    const objects=fixture(), b=objects.get(G.jetId)!, hardware=createHash('sha256');
    for(let frame=0;frame<252;frame++) {
        objects.time=frame*1000/60;const d=jetCycle(b,objects.time).danger;
        for(const reduced of [false,true]) {
            const after=paint(objects,reduced);
            hardware.update(after.pixels.map(p=>liquid.has(p)?'':p).join(','));
            for(let yy=0;yy<180;yy++)for(let xx=0;xx<320;xx++) {
                const expected=!!d&&xx>=d.x-240&&xx<d.x+d.width-240&&yy>=Math.max(23,Math.floor(d.y-176))&&yy<Math.ceil(d.y+d.height-176);
                assert.equal(liquid.has(after.at(xx,yy)),expected,`danger at ${frame}:${xx},${yy}`);
            }
        }
    }
    // Frozen aaf1734 nonliquid raster across the complete cycle: hardware and warnings stay unchanged.
    assert.equal(hardware.digest('hex'),'99fee56906a3685dfa790e1f83e9eddd63148ec796baa46ad053b03023100bb1');
});

test('streams advect upward one pixel per native 24ms without screen-relative phase changes',()=>{
    const objects=fixture();objects.time=2904;const a=paint(objects);
    objects.time+=24;const b=paint(objects);
    assert.notDeepEqual(a.pixels,b.pixels);
    for(let y=33;y<159;y++)for(let x=144;x<272;x++)assert.equal(b.at(x,y),a.at(x,y+1));
    const shifted=paint(objects,false,251,169);
    for(let y=33;y<159;y++)for(let x=144;x<272;x++)assert.equal(b.at(x,y),shifted.at(x-11,y+7));
    assert.deepEqual(paint(objects,false,251.2,168.6).pixels,shifted.pixels);
});

test('reduced decoration freezes at full height while the native envelope and gauge continue',()=>{
    const objects=fixture();objects.time=2850;const a=paint(objects,true);
    objects.time=3150;assert.deepEqual(a.pixels,paint(objects,true).pixels);
    objects.time=2750;const rising=paint(objects,true);
    assert.ok(rising.pixels.filter(p=>liquid.has(p)).length<a.pixels.filter(p=>liquid.has(p)).length);
    objects.time=3320;const falling=paint(objects,true);
    assert.ok(falling.pixels.filter(p=>liquid.has(p)).length<a.pixels.filter(p=>liquid.has(p)).length);
});

test('flow is repeatable, restores context, mutates no data and stays bounded',()=>{
    const objects=fixture();objects.time=2976;const b=objects.get(G.jetId)!;
    const d=jetCycle(b,objects.time).danger!,before=JSON.stringify({objects,d});
    assert.deepEqual(paint(objects).calls,paint(objects).calls);
    assert.equal(JSON.stringify({objects,d}),before);
    const c=new Raster();drawReliefFlow(c.context,d,objects.time,240,176,false,P);
    assert.ok(c.calls.length<=138,`${c.calls.length} bounded rectangles`);
    for(const [,x,y,w,h] of c.calls)assert.ok(x>=144&&x+w<=272&&y>=32&&y+h<=160);
    assert.equal(c.depth,0);assert.equal(c.globalAlpha,.37);
});

for(const interruption of ['pause','hidden'] as const)test(`${interruption} freezes native clock and decorative movement`,t=>{
    const h=guairaReliefBrowser(t),g=h.create();h.run(g,154,['ArrowRight']);h.run(g,20);
    assert.equal(jetCycle(g.objects.get(G.jetId)!,g.objects.time).phase,'flowing');
    const before=paint(g.objects),time=g.objects.time;
    if(interruption==='pause')g.toggleReliefPause();else h.hidden(true);
    h.run(g,120);assert.equal(g.objects.time,time);assert.deepEqual(paint(g.objects).pixels,before.pixels);
    if(interruption==='hidden')h.hidden(false);g.toggleReliefPause();h.run(g,2);
    assert.ok(g.objects.time>time);assert.notDeepEqual(paint(g.objects).pixels,before.pixels);
});
