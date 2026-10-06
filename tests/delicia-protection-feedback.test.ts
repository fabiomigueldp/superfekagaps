import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { DeliciaArt } from '../src/adventure/delicia/DeliciaArt';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

function simulation() {
    const stage = structuredClone(DELICIA_STAGES[0]);
    stage.enemies = []; stage.hazards = []; stage.machines = [];
    return new DeliciaSimulation(stage);
}

function renderer(t: TestContext) {
    const art = new DeliciaArt(), sim = simulation();
    const sprite = t.mock.method(art.atlas, 'draw', () => {});
    const strokes: { path: unknown[]; color: unknown; width: unknown; alpha: unknown }[] = [];
    let path: unknown[] = [];
    const state: Record<string, unknown> = { globalAlpha: 1 }, stack: Record<string, unknown>[] = [];
    const context = new Proxy(state, { get(target, key: string) {
        if (key in target) return target[key];
        if (key.startsWith('create')) return () => ({ addColorStop() {} });
        if (key === 'save') return () => stack.push({ ...target });
        if (key === 'restore') return () => { for (const name of Object.keys(target)) delete target[name]; Object.assign(target, stack.pop()); };
        if (key === 'beginPath') return () => { path = []; };
        if (key === 'ellipse') return (...args: unknown[]) => { path = args; };
        if (key === 'stroke') return () => strokes.push({ path, color: target.strokeStyle, width: target.lineWidth, alpha: target.globalAlpha });
        return () => {};
    } }) as unknown as CanvasRenderingContext2D;
    const draw = (reduced: boolean) => {
        strokes.length = 0; const draws = sprite.mock.calls.length, before = structuredClone(sim);
        art.draw(context, sim, reduced);
        assert.deepEqual(structuredClone(sim), before, 'Rendering never alters gameplay or its timers.');
        return { sprites: sprite.mock.calls.length - draws, cue: strokes.filter(stroke => stroke.path[2] === 25 && stroke.path[3] === 33) };
    };
    return { sim, draw, strokes };
}

test('reduced motion keeps a steady, outlined protection cue and a fully visible player after damage', t => {
    const { sim, draw } = renderer(t);
    assert.deepEqual(draw(true), { sprites: 1, cue: [] });
    sim.hurt(sim.player.x + 50);
    assert.equal(sim.player.health, 3); assert.equal(sim.player.invincible, 1.5);
    let previous: ReturnType<typeof draw> | undefined;
    for (const time of [0, .08, .16, .24, .32, 1.4]) {
        sim.time = time;
        const frame = draw(true);
        assert.equal(frame.sprites, 1, 'The player remains visible on both ordinary blink phases.');
        assert.deepEqual(frame.cue.map(stroke => [stroke.color, stroke.width, stroke.alpha]), [['#173738', 5, 1], ['#f2cf89', 2, 1]]);
        assert.deepEqual(frame.cue[0].path, [sim.player.x + sim.player.w / 2, sim.player.y + sim.player.h / 2, 25, 33, 0, 0, Math.PI * 2]);
        if (previous) assert.deepEqual(frame, previous, 'The protection cue does not pulse or move with time.');
        previous = frame;
    }
});

test('ordinary invulnerability blinking is unchanged and switching reduction never hides the player', t => {
    const { sim, draw } = renderer(t); sim.player.invincible = 1;
    sim.time = .08;
    assert.deepEqual(draw(false), { sprites: 0, cue: [] });
    assert.equal(draw(true).sprites, 1); assert.equal(draw(true).cue.length, 2);
    assert.deepEqual(draw(false), { sprites: 0, cue: [] });
    sim.time = .16;
    assert.deepEqual(draw(false), { sprites: 1, cue: [] });
});

test('steady protection does not replace or tint the separate parry window', t => {
    const { sim, draw, strokes } = renderer(t);
    sim.player.invincible = 1; sim.player.parryTime = .2;
    assert.equal(draw(true).cue.length, 2);
    assert.ok(strokes.some(stroke => stroke.color === '#a5f2e2' && stroke.width === 3 && stroke.alpha === 1));
    sim.player.invincible = 0;
    assert.deepEqual(draw(true), { sprites: 1, cue: [] });
    assert.ok(strokes.some(stroke => stroke.color === '#a5f2e2' && stroke.width === 3 && stroke.alpha === 1));
});

for (const protection of ['damage', 'dash', 'fall'] as const) test(`${protection} protection is shown only while its real simulation timer is active`, t => {
    const { sim, draw } = renderer(t);
    if (protection === 'damage') sim.hurt(sim.player.x + 50);
    else if (protection === 'dash') sim.update(1 / 120, { ...noDeliciaInput(), dash: true });
    else { sim.player.y = sim.stage.height; sim.update(1 / 120, noDeliciaInput()); }
    assert.ok(sim.player.invincible > 0); assert.equal(draw(true).cue.length, 2);
    const health = sim.player.health;
    sim.hurt(sim.player.x + 50); assert.equal(sim.player.health, health, 'Feedback matches actual immunity.');
    for (let i = 0; i < 240 && sim.player.invincible > 0; i++) sim.update(1 / 120, noDeliciaInput());
    assert.equal(sim.player.invincible, 0); assert.equal(sim.dead, false);
    assert.deepEqual(draw(true), { sprites: 1, cue: [] });
});

type NativeCanvas = { createCanvas(width: number, height: number): HTMLCanvasElement };
const require = createRequire(import.meta.url);
let native: NativeCanvas | undefined;
try { native = require('@napi-rs/canvas') as NativeCanvas; }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') throw error; }

test('native reduced frames distinguish protection without obscuring or flashing the player',
    { skip: native ? false : 'Optional @napi-rs/canvas is not installed' }, t => {
        const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
        Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => native!.createCanvas(1, 1) } });
        t.after(() => previous ? Object.defineProperty(globalThis, 'document', previous) : Reflect.deleteProperty(globalThis, 'document'));
        const art = new DeliciaArt(), sim = simulation(), canvas = native!.createCanvas(960, 540), context = canvas.getContext('2d')!;
        const frame = () => { art.draw(context, sim, true); return context.getImageData(0, 0, 960, 540).data; };
        const normal = frame(); sim.player.invincible = 1.5; const protectedFrame = frame();
        assert.notDeepEqual(protectedFrame, normal, 'Reduced protection must remain visually distinct from ordinary play.');
        sim.time = .08; assert.deepEqual(frame(), protectedFrame, 'No hidden phase.');
        sim.time = .16; assert.deepEqual(frame(), protectedFrame, 'No flashing phase.');
        // The cue surrounds Feka; the head and torso retain their native pixels.
        for (let y = sim.player.y + 8; y < sim.player.y + sim.player.h - 8; y++)
            for (let x = sim.player.x + 7; x < sim.player.x + sim.player.w - 7; x++) {
                const offset = (y * 960 + x) * 4;
                assert.deepEqual(protectedFrame.slice(offset, offset + 4), normal.slice(offset, offset + 4));
            }
        sim.player.invincible = 0; assert.deepEqual(frame(), normal, 'The cue ends with protection.');
    });
