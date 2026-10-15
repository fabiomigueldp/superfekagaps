import assert from 'node:assert/strict';
import test from 'node:test';
import { drawGuairaLandscape, drawGuairaTree, drawGuairaFieldBank, drawGuairaAwning, drawGuairaPerchedBird, guairaBirds, guairaBreeze, type GuairaLandscape } from '../src/adventure/experimental/guaira/GuairaScenery';
import { guairaBrowser } from './helpers/guairaLabHarness';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { GuairaJunction } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import { GuairaRespiros } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import { GuairaBullLab } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { GuairaAscent } from '../src/adventure/experimental/guaira/GuairaAscent';
import { GuairaMayorLab } from '../src/adventure/experimental/guaira/GuairaMayorLab';
import { drawGuairaAscentBackground } from '../src/adventure/experimental/guaira/GuairaAscentArt';

const landscapes: GuairaLandscape[] = ['village', 'junction', 'rice', 'corral', 'heights', 'town'];
class Raster {
    fillStyle = '#010203'; globalAlpha = .37; globalCompositeOperation = 'multiply';
    pixels = Array<string>(320 * 180).fill('');
    bounds = [0, 23, 320, 180]; pending = this.bounds;
    stack: Array<{ fillStyle: string; globalAlpha: number; globalCompositeOperation: string; bounds: number[] }> = [];
    save() { this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation, bounds: this.bounds }); }
    restore() { Object.assign(this, this.stack.pop()); }
    beginPath() {}
    rect(x: number, y: number, w: number, h: number) { this.pending = [x, y, x + w, y + h]; }
    clip() { this.bounds = this.bounds.map((v, i) => i < 2 ? Math.max(v, this.pending[i]) : Math.min(v, this.pending[i])); }
    fillRect(x: number, y: number, w: number, h: number) {
        assert.ok([x, y, w, h].every(Number.isInteger), 'Native pixel grid, including moving leaves and wings');
        const left = Math.max(x, this.bounds[0]), right = Math.min(x + w, this.bounds[2]);
        if (right <= left) return;
        for (let yy = Math.max(y, this.bounds[1]); yy < Math.min(y + h, this.bounds[3]); yy++)
            this.pixels.fill(this.fillStyle, yy * 320 + left, yy * 320 + right);
    }
    get context() { return this as unknown as CanvasRenderingContext2D; }
}

test('all landscapes are continuous below the horizon, respect the HUD clip and restore Canvas state', () => {
    const land = new Set(['#b8b39a', '#c8bea0', '#a5aa86', '#c0ab87', '#b7b38b', '#8fa58b', '#afbc9d', '#929e7d']);
    for (const kind of landscapes) for (const cx of [0, 337, 719.8, 1100, 1500]) {
        const c = new Raster(); drawGuairaLandscape(c.context, cx, 64.2, 6400, false, kind);
        assert.ok(c.pixels.slice(0, 320 * 23).every(color => color === ''));
        assert.ok(c.pixels.slice(320 * 154).every(color => land.has(color)), 'No detached mesa, sky crack or floating strip below the hills');
        assert.equal(c.stack.length, 0); assert.equal(c.fillStyle, '#010203');
        assert.equal(c.globalAlpha, .37); assert.equal(c.globalCompositeOperation, 'multiply');
        assert.deepEqual(c.bounds, [0, 23, 320, 180]);
    }
});

test('flocks enter and leave beyond the frame, have quiet intervals and never pop on camera wrapping', () => {
    let active = 0, quiet = 0;
    for (const kind of landscapes) for (const cx of [0, 720, 1472]) for (let time = 1; time < 92000; time += 113) {
        const before = guairaBirds(kind, cx, 64, time - 1), after = guairaBirds(kind, cx + .1, 64, time);
        for (const [a, b] of [[before, after], [after, before]]) for (const bird of a.filter(b => b.x > 8 && b.x < 312))
            assert.ok(b.some(next => next.index === bird.index && Math.abs(next.x - bird.x) <= 1 && Math.abs(next.y - bird.y) <= 1));
        if (after.length) active++; else quiet++;
        assert.deepEqual(guairaBirds(kind, cx, 64, time, true), []);
    }
    assert.ok(quiet > active, 'Calm sky has more breathing room than bird activity');
});

test('wind is gentle and rooted scenery remains attached while its tips articulate', () => {
    const paint = (time: number) => {
        const c = new Raster(); drawGuairaTree(c.context, 120, 150, 82, time, 580);
        drawGuairaAwning(c.context, 200, 65, 27, time, 660); return c.pixels;
    };
    const still = paint(0), moving = paint(8900);
    assert.notDeepEqual(still, moving);
    assert.deepEqual(still.slice(120 * 320), moving.slice(120 * 320), 'Soil shadow and lower trunk never drift');
    for (let y = 65; y < 67; y++) assert.deepEqual(still.slice(y * 320 + 199, y * 320 + 229), moving.slice(y * 320 + 199, y * 320 + 229), 'Cloth stays fixed to its lintel');
    for (let time = 0; time < 30000; time += 16) {
        assert.ok(Math.abs(guairaBreeze(time, 580, 2)) <= 2);
        assert.ok(Math.abs(guairaBreeze(time + 16, 580, 2) - guairaBreeze(time, 580, 2)) <= 1);
    }
});

test('earth banks retain their world shape as the camera scrolls vertically or past their sloping edges', () => {
    const paint = (cx: number, cy: number, bottom: number) => {
        const c = new Raster(); c.bounds = [0, 0, 320, 180];
        drawGuairaFieldBank(c.context, 90 - cx, 40 - cy, 102, bottom - cy);
        return c.pixels;
    };
    for (const [cx, cy, bottom] of [[0,60,280],[-238,0,160],[-236,0,160],[197,0,160],[201,0,160]]) {
        const reference = paint(0, 0, bottom), translated = paint(cx, cy, bottom);
        let differences = 0;
        for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
            const wx = x + cx, wy = y + cy;
            if (wx >= 0 && wx < 320 && wy >= 0 && wy < 180 && translated[y * 320 + x] !== reference[wy * 320 + wx]) differences++;
        }
        assert.equal(differences, 0, `Camera ${cx},${cy} must translate the complete bank without reshaping or popping`);
    }
});

test('roof birds stay in one connected silhouette with fixed feet throughout their idle cycle', () => {
    const poses = new Set<string>();
    for (const facing of [-1, 1] as const) for (let time = 0; time < 17500; time += 211) {
        const c = new Raster(); drawGuairaPerchedBird(c.context, 100, 90, time, 239, facing);
        const occupied = new Set<number>(); c.pixels.forEach((color, i) => { if (color) occupied.add(i); });
        assert.ok(occupied.has(89 * 320 + 99) && occupied.has(89 * 320 + 102), 'Both feet keep contact with the same roof');
        assert.ok([...occupied].every(i => Math.floor(i / 320) < 90), 'No animation penetrates the roof');
        poses.add([...occupied].join(','));
        const reached = new Set<number>(), pending = [89 * 320 + 99];
        while (pending.length) {
            const pixel = pending.pop()!;
            if (reached.has(pixel) || !occupied.has(pixel)) continue;
            reached.add(pixel);
            for (const dy of [-1,0,1]) for (const dx of [-1,0,1]) if (dx || dy) pending.push(pixel + dy * 320 + dx);
        }
        assert.equal(reached.size, occupied.size, 'Turning head and tail cannot leave floating pixels');
    }
    assert.ok(poses.size > 2, 'Occasional small gestures are visible');
});

test('ascent houses meet their yards and signposts reach the bank instead of ending in midair', () => {
    const c = new Raster(); drawGuairaAscentBackground(c.context, 0, 168, 0, true);
    const at = (x: number, y: number) => c.pixels[(y - 168) * 320 + x];
    for (const x of [25, 40, 63]) for (let y = 292; y < 296; y++)
        assert.equal(at(x, y), '#c49c74', 'Earth continues from the house footing to the walking bank');
    for (let y = 288; y < 296; y++) assert.equal(at(205, y), '#a58a68', 'Guidance sign has a complete fixed support');
});

for (const Scene of [GuairaTraversal, GuairaJunction, GuairaRespiros, GuairaBullLab, GuairaAscent, GuairaMayorLab])
    for (const reducedMotion of [false, true]) test(`${Scene.name}: native background uses the paused clock and freezes decoration in reduced motion (${reducedMotion})`, t => {
        const h = guairaBrowser(t, { reducedMotion });
        const game = new Scene(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
        const c = game.renderer.getContext(); let calls: unknown[][] = [];
        c.fillRect = (x, y, w, height) => { calls.push([c.fillStyle, x, y, w, height]); };
        const paint = () => {
            calls = []; const before = JSON.stringify({ player: game.player.data, objects: game.objects, save: game.store.save });
            game.art.background(c, { id: 1 } as never, game.camera.x, game.camera.y, game.time);
            assert.equal(JSON.stringify({ player: game.player.data, objects: game.objects, save: game.store.save }), before);
            return calls;
        };
        game.time = game.objects.time = 6400; const first = paint();
        game.time = game.objects.time = 23700;
        if (reducedMotion) assert.deepEqual(paint(), first); else assert.notDeepEqual(paint(), first);
        game.time = game.objects.time = 6400; assert.deepEqual(paint(), first);
        h.window.dispatch('blur'); assert.equal(game.state, 'paused');
        for (let i = 0; i < 120; i++) game.update(1000 / 60);
        assert.deepEqual(paint(), first, 'No independent decorative timer during focus loss');
    });
