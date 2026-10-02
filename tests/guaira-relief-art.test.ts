import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { TileType as T } from '../src/constants';
import { guairaReliefStage, GUAIRA_RELIEF as G } from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';
import { drawReliefBackground, drawReliefTerrain, drawReliefObjects, RELIEF_MATERIAL_COLORS as P } from '../src/adventure/experimental/guaira/relief/GuairaReliefArt';
import { GALLERY_MATERIAL_COLORS as M } from '../src/adventure/experimental/guaira/gallery/GuairaGalleryArt';

/** Final pixel recorder catches accidental opaque paint over an erased lid. */
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
function fixture() { const stage=guairaReliefStage(); return {level:new WorldLevel(stage.level),objects:new WorldObjects(stage.mechanisms)}; }
function objectsPaint(objects: WorldObjects,reduced=false) { const c=new Raster(); drawReliefObjects(c.context,objects,320,176,reduced); return c; }

test('closed and open scenery reserve damage liquid and continuous safe caps for native authorities', () => {
    const {level}=fixture();
    for (const open of [false,true]) {
        if (open) level.data.tiles[10][15]=T.EMPTY;
        for (const [x,y] of [[0,176],[144,96],[320,176]]) {
            const c=new Raster(); drawReliefBackground(c.context,level,x,y);
            assert.ok(c.calls.every(([color])=>!liquid.has(color) && color!==M.cap));
            assert.ok(c.pixels.slice(0,320*23).every(color=>color===''));
        }
    }
});

test('safe landings stay continuous and every removed lid tile stays visibly removed', () => {
    const {level}=fixture(), terrain=()=>{const c=new Raster();drawReliefTerrain(c.context,level,128,128);return c;};
    const before=terrain();
    for(let xx=112;xx<160;xx++) for(let yy=32;yy<48;yy++) assert.notEqual(before.at(xx,yy),M.cap);
    for(let xx=32;xx<160;xx++) for(let yy=96;yy<98;yy++) assert.equal(before.at(xx,yy),M.cap);
    for(const col of [15,16,17]) {
        level.data.tiles[10][col]=T.EMPTY; const after=terrain();
        for(let yy=32;yy<48;yy++) for(let xx=col*16-128;xx<col*16-112;xx++) assert.equal(after.at(xx,yy),'');
    }
});

test('the connected gauge follows native pressure and holds zero after relief in reduced motion', () => {
    const {objects}=fixture(),b=objects.get(G.jetId)!;
    const offset=(G.period-(b.phase??0)%G.period)%G.period;
    objects.time=1100+offset; const early=objectsPaint(objects,true).calls.filter(([color])=>color===P.gauge).length;
    objects.time=1750+offset; const late=objectsPaint(objects,true).calls.filter(([color])=>color===P.gauge).length;
    assert.ok(late>early); assert.deepEqual(objectsPaint(objects,true).calls,objectsPaint(objects,false).calls);
    b.active=true;
    for(const time of [1900,2400,5000]) {
        objects.time=time;
        assert.ok(!objectsPaint(objects,true).calls.some(([color])=>color===P.gauge || liquid.has(color)));
    }
});

test('native closure has only sparse pale residuals, then clears them; reduced mode is immediately quiet', () => {
    const {objects}=fixture(),b=objects.get(G.jetId)!;
    b.active=true; b.jetShutdown={at:2100,height:128}; objects.time=2100;
    const closed=objectsPaint(objects);
    assert.ok(!closed.calls.some(([color])=>liquid.has(color)));
    const drops=closed.calls.filter(([color])=>color===P.mist);
    assert.equal(drops.length,5); assert.ok(drops.every(([, , ,w,h])=>w===2 && h===1));
    assert.ok(!objectsPaint(objects,true).calls.some(([color])=>color===P.mist));
    objects.time=2400; assert.ok(!objectsPaint(objects).calls.some(([color])=>color===P.mist));
});

test('opaque native liquid pixels equal the live damage envelope throughout a full cycle', () => {
    const {objects}=fixture(),b=objects.get(G.jetId)!;
    for(let frame=0;frame<252;frame++) {
        objects.time=frame*1000/60;
        const d=jetCycle(b,objects.time).danger;
        for(const reduced of [false,true]) {
            const c=objectsPaint(objects,reduced);
            for(let yy=23;yy<180;yy++) for(let xx=0;xx<320;xx++) {
                const expected=!!d && xx>=d.x-320 && xx<d.x+d.width-320 && yy>=Math.floor(d.y-176) && yy<Math.ceil(d.y+d.height-176);
                assert.equal(liquid.has(c.at(xx,yy)),expected,`envelope t${objects.time} at ${xx},${yy}`);
            }
        }
    }
});

test('all art restores Canvas state, respects clipping, repeats and mutates no level or objects', () => {
    const {level,objects}=fixture(); objects.time=2150;
    const before=JSON.stringify({level,objects});
    const render=()=>{
        const c=new Raster();drawReliefBackground(c.context,level,128.25,96.75);
        drawReliefTerrain(c.context,level,128.25,96.75);drawReliefObjects(c.context,objects,128.25,96.75,false);
        assert.equal(c.depth,0);assert.equal(c.fillStyle,'#000000');assert.equal(c.globalAlpha,.37);
        assert.equal(c.globalCompositeOperation,'multiply'); return c.calls;
    };
    assert.deepEqual(render(),render());assert.equal(JSON.stringify({level,objects}),before);
});
