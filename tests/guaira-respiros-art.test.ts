import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { drawRespirosBackground, drawRespirosTerrain, drawRespirosObjects, RESPIROS_WATER_COLORS } from '../src/adventure/experimental/guaira/respiros/GuairaRespirosArt';
import { respirosArtStage } from './helpers/guairaRespirosArtFixture';

type Paint = [string, number, number, number, number, number];
const water = new Set<string>(Object.values(RESPIROS_WATER_COLORS));
/** Integer Canvas rectangle rasterizer records final pixels, not union of old paint. */
class Raster {
    fillStyle = '#000000'; globalAlpha = .37; globalCompositeOperation = 'multiply';
    readonly pixels = new Uint8Array(320 * 180);
    readonly calls: Paint[] = [];
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
        this.calls.push([this.fillStyle, x, y, w, h, this.globalAlpha]);
        const value = water.has(this.fillStyle) && this.globalAlpha === 1 ? 1 : 2;
        const left = Math.max(x, this.bounds[0]), right = Math.min(x + w, this.bounds[2]);
        if (right <= left) return;
        for (let yy = Math.max(y, this.bounds[1]); yy < Math.min(y + h, this.bounds[3]); yy++)
            this.pixels.fill(value, yy * 320 + left, yy * 320 + right);
    }
    get context() { return this as unknown as CanvasRenderingContext2D; }
}
function paint(objects: WorldObjects, cx = 0, cy = 144, reduced = false, decorativeTime = objects.time) {
    const canvas = new Raster(); drawRespirosObjects(canvas.context, objects, cx, cy, decorativeTime, reduced); return canvas;
}
function verifyEnvelope(objects: WorldObjects, cx: number, cy: number, reduced: boolean) {
    const rendered = paint(objects, cx, cy, reduced), expected = new Uint8Array(320 * 180);
    for (const b of objects.bodies) {
        const d = jetCycle(b, objects.time).danger;
        if (!d) continue;
        const left = Math.max(0, Math.floor(d.x - cx)), right = Math.min(320, Math.ceil(d.x + d.width - cx));
        const top = Math.max(23, Math.floor(d.y - cy)), bottom = Math.min(180, Math.ceil(d.y + d.height - cy));
        if (right <= left) continue;
        for (let y = top; y < bottom; y++) expected.fill(1, y * 320 + left, y * 320 + right);
    }
    for (let pixel = 0; pixel < expected.length; pixel++)
        assert.equal(rendered.pixels[pixel] === 1, expected[pixel] === 1,
            `Water mismatch at ${pixel % 320},${Math.floor(pixel / 320)}, t${objects.time}, camera${cx},${cy}, reduced${reduced}`);
}

test('both grates paint exactly the full native danger over all 252 departure phases', () => {
    const objects = new WorldObjects(respirosArtStage().mechanisms);
    for (let frame = 0; frame < 252; frame++) {
        objects.time = frame * 1000 / 60;
        for (const reduced of [false, true]) for (const cx of [96, 270]) verifyEnvelope(objects, cx, 144, reduced);
    }
});

test('first and last dangerous pixels survive fractional camera and non-integral geometry', () => {
    const objects = new WorldObjects(respirosArtStage().mechanisms.slice(0, 1));
    for (const width of [4, 13.25, 96, 176]) for (const camera of [[95.25,143.25],[95.75,144.75],[252.5,144.5]]) {
        objects.bodies[0].width = width; objects.bodies[0].x = 160.25;
        for (const time of [999,1000,1400,1799,1800,1800.5,1801,1920,2100,2330,2499,2499.3,2499.5,2500,2600,2850]) {
            objects.time = time; verifyEnvelope(objects, camera[0], camera[1], false); verifyEnvelope(objects, camera[0], camera[1], true);
        }
    }
});

test('reduced motion removes decoration but preserves gauge and height changes on objects.time', () => {
    const objects = new WorldObjects(respirosArtStage().mechanisms.slice(0, 1));
    objects.time = 1400;
    assert.deepEqual(paint(objects, 96, 144, true, 0).calls, paint(objects, 96, 144, true, 99000).calls);
    const halfCharge = paint(objects, 96, 144, true).calls;
    objects.time = 1750; assert.notDeepEqual(paint(objects, 96, 144, true).calls, halfCharge);
    objects.time = 1900; const rise = paint(objects, 96, 144, true).pixels;
    objects.time = 2450; assert.notDeepEqual(paint(objects, 96, 144, true).pixels, rise);
    objects.time = 2650;
    assert.ok(paint(objects).calls.some(call => call[0] === '#cad6c4'));
    assert.ok(!paint(objects, 0, 144, true).calls.some(call => call[0] === '#cad6c4'));
});

test('warning, dry base and residual mist never use the dangerous water palette', () => {
    const objects = new WorldObjects(respirosArtStage().mechanisms.slice(0, 1));
    for (const time of [0,1000,1600,1799,1800,2500,2600,2849,2850]) {
        objects.time = time;
        assert.ok(!paint(objects).calls.some(call => water.has(call[0])), `Danger colour outside danger at ${time}`);
    }
    objects.bodies[0].active = true; objects.time = 2100;
    assert.ok(!paint(objects).calls.some(call => water.has(call[0])));
});

test('lateral pressure bars remain above the native fallback touch band and advance in reduced motion', () => {
    const objects = new WorldObjects(respirosArtStage().mechanisms.slice(0, 1));
    const gauge = (time: number, reduced: boolean) => {
        objects.time = time;
        return paint(objects, 80, 144, reduced).calls.filter(([color,x,y]) => color === '#edba62' && x >= 68 && x < 77 && y < 145);
    };
    const early = gauge(1100, true), late = gauge(1750, true);
    assert.ok(early.length > 0); assert.ok(late.length > early.length);
    assert.deepEqual(gauge(1750, false), late);
    for (const [,x,y,w,h] of late) { assert.ok(x >= 68 && x + w < 80); assert.ok(y + h <= 140); }
});

test('standpipe plate distinguishes charge, actual danger and dry recovery without a second clock', () => {
    const objects = new WorldObjects(respirosArtStage().mechanisms.slice(0, 1));
    const plate = (time: number, reduced = false) => {
        objects.time = time;
        return paint(objects, 80, 144, reduced, -99000).calls
            .filter(([,x,y,w,h]) => x >= 66 && x + w <= 79 && y >= 96 && y + h <= 109);
    };
    const dry = plate(0), charge = plate(1000), danger = plate(2100);
    assert.notDeepEqual(charge, dry); assert.notDeepEqual(danger, dry); assert.notDeepEqual(danger, charge);
    for (const time of [1000,1100,1600,1799,1800,1800.4]) {
        assert.equal(jetCycle(objects.bodies[0], time).danger, null);
        assert.deepEqual(plate(time), charge, `Imminent pressure remains announced at ${time}`);
        assert.deepEqual(plate(time, true), charge);
    }
    for (const time of [1801,1920,2330,2480,2499]) {
        assert.ok(jetCycle(objects.bodies[0], time).danger);
        assert.deepEqual(plate(time), danger, `Even the last dangerous pixel retains its exclamation at ${time}`);
        assert.deepEqual(plate(time, true), danger);
    }
    for (const time of [2499.5,2500,2650,2850,4200]) {
        assert.equal(jetCycle(objects.bodies[0], time).danger, null);
        assert.deepEqual(plate(time), dry, `No false danger after the water clears at ${time}`);
        assert.deepEqual(plate(time, true), dry);
    }
    objects.bodies[0].active = true;
    assert.deepEqual(plate(2100), dry, 'A closed valve never receives a danger marker');
});

test('each authored jet owns an unobstructive phase plate above touch controls', async () => {
    const { guairaRespirosStage } = await import('../src/adventure/experimental/guaira/respiros/GuairaRespirosStage');
    const objects = new WorldObjects(guairaRespirosStage().mechanisms);
    for (const body of objects.bodies) for (const cy of [132,144]) for (const time of [0,1100,2100,2499,2500]) {
        const solo = new WorldObjects([{ ...body, phase: 0 }]); solo.time = time;
        const cx = body.x - 80, py = Math.ceil(body.y + body.height - 4 - cy) - 64;
        const plate = paint(solo, cx, cy).calls.filter(([,x,y,w,h]) => x >= 66 && x + w <= 79 && y >= py && y + h <= py + 13);
        assert.ok(plate.length >= 6);
        for (const [color,x,y,w,h] of plate) {
            assert.ok(x + w < body.x - cx, 'Plate never hides the liquid collision boundary');
            assert.ok(y >= 23 && y + h < 145, 'Plate stays between the HUD and fallback touch band');
            assert.ok(!water.has(color), 'Only real dangerous liquid uses the water palette');
        }
        solo.bodies[0].phase = body.phase;
        const ownPlate = () => paint(solo, cx, cy).calls
            .filter(([,x,y,w,h]) => x >= 66 && x + w <= 79 && y >= py && y + h <= py + 13);
        assert.deepEqual(ownPlate(), (() => {
            solo.bodies[0].phase = 0; solo.time = time + (body.phase ?? 0);
            return ownPlate();
        })(), 'Each plate follows its own authored cycle offset');
    }
});

test('all three painters restore Canvas state, repeat deterministically, and mutate no input', () => {
    const stage = respirosArtStage(), level = new WorldLevel(stage.level), objects = new WorldObjects(stage.mechanisms);
    for (const time of [0,1400,1801,2100,2499,2600]) for (const reduced of [false, true]) {
        objects.time = time;
        const before = JSON.stringify({ level, objects });
        const render = () => {
            const c = new Raster();
            drawRespirosBackground(c.context, 96.25, 144.75, time, reduced);
            drawRespirosTerrain(c.context, level, 96.25, 144.75);
            drawRespirosObjects(c.context, objects, 96.25, 144.75, time, reduced);
            assert.equal(c.depth, 0); assert.equal(c.fillStyle, '#000000'); assert.equal(c.globalAlpha, .37);
            assert.equal(c.globalCompositeOperation, 'multiply'); return c.calls;
        };
        assert.deepEqual(render(), render()); assert.equal(JSON.stringify({ level, objects }), before);
    }
    const a = new Raster(), b = new Raster();
    drawRespirosBackground(a.context, 0, 144, 0, true); drawRespirosBackground(b.context, 0, 144, 9345, true);
    assert.deepEqual(a.calls, b.calls);
});

test('authored final pair paints its independent envelopes and never paints water across the dry refuge', async () => {
    const { guairaRespirosStage, GUAIRA_RESPIROS: G } = await import('../src/adventure/experimental/guaira/respiros/GuairaRespirosStage');
    const objects = new WorldObjects(guairaRespirosStage().mechanisms);
    for (let frame = 0; frame < 252; frame++) {
        objects.time = frame * 1000 / 60;
        for (const reduced of [false, true]) {
            verifyEnvelope(objects, 648, 132, reduced);
            verifyEnvelope(objects, 768, 132, reduced);
            const pixels = paint(objects, 768, 132, reduced).pixels;
            for (let x = G.thirdEnd; x < G.fourthStart; x++)
                assert.notEqual(pixels[(G.floor - 133) * 320 + x - 768], 1);
        }
    }
});
