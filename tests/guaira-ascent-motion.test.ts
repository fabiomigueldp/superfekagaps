import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { guairaAscentStage, GUAIRA_ASCENT as G } from '../src/adventure/experimental/guaira/GuairaAscent';
import { drawGuairaAscentObjects } from '../src/adventure/experimental/guaira/GuairaAscentArt';
import { ascentMechanicalPose } from '../src/adventure/experimental/guaira/GuairaAscentMotion';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';
import recording from './helpers/guairaAscentReplay.json';

class Raster {
    fillStyle = '#010203';
    readonly pixels = Array<string>(320 * 180).fill('');
    readonly calls: Array<[string, number, number, number, number]> = [];
    private bounds = [0, 0, 320, 180];
    private pending = this.bounds;
    private stack: Array<{ fillStyle: string; bounds: number[] }> = [];
    get depth() { return this.stack.length; }
    save() { this.stack.push({ fillStyle: this.fillStyle, bounds: this.bounds }); }
    restore() { Object.assign(this, this.stack.pop()); }
    beginPath() {}
    rect(x: number, y: number, w: number, h: number) { this.pending = [x, y, x + w, y + h]; }
    clip() { this.bounds = [Math.max(this.bounds[0], this.pending[0]), Math.max(this.bounds[1], this.pending[1]), Math.min(this.bounds[2], this.pending[2]), Math.min(this.bounds[3], this.pending[3])]; }
    fillRect(x: number, y: number, w: number, h: number) {
        assert.ok([x,y,w,h].every(Number.isInteger));
        assert.ok(w >= 0 && h >= 0);
        this.calls.push([this.fillStyle,x,y,w,h]);
        const left = Math.max(x,this.bounds[0]), right = Math.min(x+w,this.bounds[2]);
        if (right <= left) return;
        for (let yy = Math.max(y,this.bounds[1]); yy < Math.min(y+h,this.bounds[3]); yy++)
            this.pixels.fill(this.fillStyle,yy*320+left,yy*320+right);
    }
    get context() { return this as unknown as CanvasRenderingContext2D; }
    at(x: number,y: number) { return this.pixels[y*320+x]; }
}
function fixture() { const stage = guairaAscentStage(); return { level: new WorldLevel(stage.level), objects: new WorldObjects(stage.mechanisms) }; }
function paint(objects: WorldObjects, cx: number, cy: number, reduced = false, time = objects.time) {
    const raster = new Raster();
    drawGuairaAscentObjects(raster.context, objects, cx, cy, time, reduced);
    assert.equal(raster.depth, 0); assert.equal(raster.fillStyle, '#010203');
    return raster;
}

test('wheel turns follow distance, reverse naturally and never depend on render time', () => {
    const { objects } = fixture(), body = objects.get(G.plankId)!;
    const before = structuredClone(body), home = body.home!.x;
    assert.deepEqual(ascentMechanicalPose(body, 'x', false), { turn: 0, homeCompression: 2, endCompression: 0 });
    body.x = home + 6;
    assert.deepEqual(ascentMechanicalPose(body, 'x', false), { turn: 2, homeCompression: 1, endCompression: 0 });
    body.x = home + 24; const outbound = ascentMechanicalPose(body, 'x', false);
    body.x = body.to!.x;
    assert.equal(ascentMechanicalPose(body, 'x', false).endCompression, 2);
    body.x = home + 24;
    assert.deepEqual(ascentMechanicalPose(body, 'x', false), outbound, 'returning to a physical position returns the same spoke pose');
    const state = structuredClone(objects);
    assert.deepEqual(paint(objects, 160, 230, false, 0).pixels, paint(objects, 160, 230, false, 9e9).pixels);
    assert.deepEqual(structuredClone(objects), state, 'rendering owns no simulation state');
    body.x = home;
    assert.deepEqual(body, before);
});

test('lift sheaves use vertical travel and both endpoint buffers remain bounded', () => {
    const { objects } = fixture(), lift = objects.get(G.liftId)!;
    lift.y -= 8;
    assert.equal(ascentMechanicalPose(lift, 'y', false).turn, -2);
    for (let y = 120; y <= 324; y += .5) {
        lift.y = y; const pose = ascentMechanicalPose(lift, 'y', false);
        assert.ok(Math.abs(pose.turn) < Math.PI * 2);
        assert.ok([pose.homeCompression, pose.endCompression].every(n => Number.isInteger(n) && n >= 0 && n <= 2));
        assert.ok(pose.homeCompression === 0 || pose.endCompression === 0);
    }
});

test('reduced motion, degenerate travel and non-finite presentation inputs have a stable neutral pose', () => {
    const { objects } = fixture(), body = objects.get(G.plankId)!;
    const still = { turn: 0, homeCompression: 0, endCompression: 0 };
    for (let x = 240; x <= 400; x += 5) { body.x = x; assert.deepEqual(ascentMechanicalPose(body, 'x', true), still); }
    body.to = { ...body.home! }; assert.deepEqual(ascentMechanicalPose(body, 'x', false), still);
    body.to.x += 160;
    for (const x of [NaN, Infinity, -Infinity]) { body.x = x; assert.deepEqual(ascentMechanicalPose(body, 'x', false), still); }
});

test('all three native supporting caps remain exact throughout motion and no new bright false ledges appear', () => {
    const { level, objects } = fixture();
    for (let frame = 0; frame < 600; frame++) {
        objects.update(1000 / 60, level, 700);
        if (frame % 19 !== 0) continue;
        const before = structuredClone(objects);
        for (const body of objects.bodies) for (const reduced of [false, true]) {
            const cx = Math.round(body.x) - 100, cy = Math.round(body.y) - 70;
            const raster = paint(objects, cx, cy, reduced);
            for (let x = 100; x < 100 + body.width; x++) for (const y of [70,71])
                assert.equal(raster.at(x,y), '#f2d69b', `${body.id} cap at ${frame},${x},${y}`);
            for (const [color,x,y,w,h] of raster.calls) if (color === '#f2d69b') {
                assert.ok(objects.bodies.some(b => x === Math.round(b.x)-cx && y === Math.round(b.y)-cy && w === b.width && h === 2), 'only a real deck owns the bright cap');
            }
        }
        assert.deepEqual(structuredClone(objects), before);
    }
});

test('normal spokes visibly change while reduced-mode sheaves remain fixed across required lift travel', () => {
    const { level, objects } = fixture();
    const crop = (reduced: boolean) => {
        const p = paint(objects, 600, 100, reduced);
        return Array.from({length: 9}, (_, y) => p.pixels.slice((23+y)*320+73,(23+y)*320+82));
    };
    const normal = crop(false), reduced = crop(true);
    objects.update(850, level, 700);
    assert.notDeepEqual(crop(false), normal);
    assert.deepEqual(crop(true), reduced);
    assert.deepEqual(paint(objects,600,100,true,0).pixels,paint(objects,600,100,true,100000).pixels);
});

test('muted reduced-motion keyboard replay still finishes every crossing, freezes on pause and resets on retry', t => {
    const h = guairaAscentBrowser(t, { reducedMotion: true }), game = h.create();
    h.key('m'); h.run(game, 1);
    // Reset the attempt clock without altering the selected audio preference.
    game.load(G.id);
    const audio = game.audio.enabled; assert.equal(audio, false, 'M selected mute');
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        h.run(game, count, keys);
        const snapshot = structuredClone(game.objects);
        game.render(); assert.deepEqual(structuredClone(game.objects), snapshot);
        assert.equal(game.player.data.isDead, false);
    }
    assert.equal(game.finished, true); assert.equal(game.audio.enabled, audio);
    assert.equal(game.store.save.checkpoint?.index, 1);
    game.toggleAscentPause(); const frozen = paint(game.objects,600,100,true).pixels;
    h.run(game,90); assert.deepEqual(paint(game.objects,600,100,true).pixels,frozen);
    game.load(G.id);
    assert.equal(game.objects.time,0); assert.equal(game.finished,false);
    assert.deepEqual(ascentMechanicalPose(game.objects.get(G.liftId)!,'y',false),{turn:0,homeCompression:2,endCompression:0});
});
