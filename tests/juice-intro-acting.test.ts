import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_WALK } from '../src/assets/playerSpriteSpec';
import { drawJuiceIntro, drawJuiceIntroEscort } from '../src/adventure/experimental/JuiceIntroArt';
import { JuiceIntroDirector, type IntroBeat, type IntroFrame } from '../src/adventure/experimental/JuiceIntroDirector';

interface Fill { x: number; y: number; w: number; h: number; color: string; alpha: number; hero: boolean; }
/** Observe actual painter output in logical coordinates, including alpha and layer transforms. */
function paint(frame: IntroFrame, reduced = false) {
    const fills: Fill[] = [];
    let state = { fillStyle: '', globalAlpha: 1, x: 0, y: 0, sx: 1, sy: 1 }, hero = false;
    const stack: typeof state[] = [];
    const methods = {
        createLinearGradient() { return { addColorStop() {} }; },
        save() { hero = false; stack.push({ ...state }); },
        restore() { hero = false; state = stack.pop()!; },
        translate(x: number, y: number) { state.x += x * state.sx; state.y += y * state.sy; },
        scale(x: number, y: number) { state.sx *= x; state.sy *= y; },
        fillRect(x: number, y: number, w: number, h: number) {
            fills.push({ x: state.x + x * state.sx, y: state.y + y * state.sy, w: w * state.sx, h: h * state.sy,
                color: state.fillStyle, alpha: state.globalAlpha, hero });
            if (state.fillStyle === '#17132388') hero = true;
        },
    };
    const context = new Proxy({}, {
        get: (_, key) => key in state ? state[key as keyof typeof state] : methods[key as keyof typeof methods] ?? (() => {}),
        set: (_, key, value) => { if (key in state) Reflect.set(state, key, value); return true; },
    }) as CanvasRenderingContext2D;
    drawJuiceIntro(context, frame, reduced);
    assert.equal(stack.length, 0, 'balanced painter state');
    return fills;
}
function heroPixels(frame: IntroFrame, reduced = false) {
    // Normalize the editorial camera for this crop; keep the selected motion mode.
    const fills = paint(frame, reduced).filter(f => f.hero);
    const zoom = reduced ? 1 : frame.beat === 'transition' ? 2 - frame.stageExit
        : ['reveal', 'resolve', 'defy'].includes(frame.beat) ? 2 : frame.beat === 'invite' ? 1.5 : 1;
    const focus = reduced ? 160 : frame.beat === 'transition' ? (frame.fekaX + 7) * (1 - frame.stageExit) + 160 * frame.stageExit
        : ['reveal', 'resolve', 'defy'].includes(frame.beat) ? frame.fekaX + 7 : frame.beat === 'invite' ? 244 : 160;
    const pixels: Record<string, string> = {};
    for (const f of fills) {
        const x = Math.round((f.x - 160) / zoom + focus - Math.round(frame.fekaX) + 1);
        const y = Math.round((f.y - 150) / zoom + 16);
        for (let yy = 0; yy < f.h / zoom; yy++) for (let xx = 0; xx < f.w / zoom; xx++) pixels[`${x + xx},${y + yy}`] = f.color;
    }
    return pixels;
}
function spritePixels(rows: readonly string[], startY = 0) {
    const pixels: Record<string, string> = {};
    rows.forEach((row, y) => [...row].forEach((key, x) => { if (y >= startY && PLAYER_PALETTE[key]) pixels[`${x},${y}`] = PLAYER_PALETTE[key]!; }));
    return pixels;
}
function at(beat: IntroBeat, time = 0) {
    const d = new JuiceIntroDirector();
    for (let i = 0; d.beat !== beat && i < 1000; i++) d.advance(50, { right: true, presentPressed: true });
    assert.equal(d.beat, beat);
    for (let t = 0; t < time; t += 50) d.advance(Math.min(50, time - t));
    return d;
}

test('idle holds, opposite inputs and a held boundary never animate feet', () => {
    const d = at('walk');
    const idle = heroPixels(d.frame);
    assert.deepEqual(idle, spritePixels(PLAYER_SPRITES.idle));
    for (const input of [{}, { left: true, right: true }]) {
        d.advance(100, input);
        assert.equal(d.frame.fekaMoving, false);
        assert.deepEqual(heroPixels(d.frame), idle);
    }
    d.advance(100, { left: true }); d.advance(100, { left: true });
    assert.equal(d.fekaX, 28);
    d.advance(100, { left: true });
    assert.equal(d.frame.fekaMoving, false);
    assert.deepEqual(heroPixels(d.frame), idle);
});

test('gait reuses authored walk frames, follows distance, stops on release and respects reduced motion', () => {
    const d = at('walk');
    d.advance(100, { right: true });
    assert.equal(d.frame.fekaMoving, true);
    assert.equal(d.frame.fekaWalkDistance, 5.5);
    assert.deepEqual(heroPixels(d.frame), spritePixels(PLAYER_WALK[1]));
    d.advance(100, { right: true });
    assert.deepEqual(heroPixels(d.frame), spritePixels(PLAYER_WALK[2]));
    assert.deepEqual(heroPixels(d.frame, true), spritePixels(PLAYER_SPRITES.idle));
    const distance = d.frame.fekaWalkDistance;
    d.advance(100);
    assert.equal(d.frame.fekaWalkDistance, distance);
    assert.deepEqual(heroPixels(d.frame), spritePixels(PLAYER_SPRITES.idle));
});

test('shove and backward retreat animate only during displacement and keep authored marks', () => {
    const shove = at('push');
    assert.equal(shove.fekaX, 98);
    for (let i = 0; i < 4; i++) shove.advance(100);
    assert.equal(shove.fekaX, 112);
    shove.advance(100); assert.equal(shove.frame.fekaMoving, false);
    const retreat = at('emerge', 900);
    assert.equal(retreat.fekaX, 112); assert.equal(retreat.frame.fekaMoving, false);
    retreat.advance(100);
    assert.ok(retreat.fekaX < 112); assert.equal(retreat.frame.fekaMoving, true);
    const pixels = heroPixels(retreat.frame), step = Math.floor(retreat.frame.fekaWalkDistance / 5.5) % PLAYER_WALK.length;
    for (const [key, color] of Object.entries(spritePixels(PLAYER_WALK[step], 22))) assert.equal(pixels[key], color, key);
    const headY = step % 3 === 1 ? 1 : 0;
    for (const [key, color] of Object.entries(spritePixels(PLAYER_WALK[step]))) {
        if (Number(key.split(',')[1]) < 11 + headY) assert.equal(pixels[key], color, `retreat preserves head ${key}`);
    }
    for (let i = 0; i < 14; i++) retreat.advance(100);
    assert.equal(retreat.fekaX, 68); assert.equal(retreat.frame.fekaMoving, false);
    const rested = heroPixels(retreat.frame); retreat.advance(100);
    assert.deepEqual(heroPixels(retreat.frame), rested);
    retreat.skip(); assert.equal(retreat.frame.fekaMoving, false);
});

test('shirt covers the reveal start, rises with hands, tucks at waist and returns before combat', () => {
    assert.deepEqual(heroPixels(at('reveal').frame), spritePixels(PLAYER_SPRITES.idle));
    const firstLift = heroPixels(at('reveal', 100).frame);
    assert.equal(firstLift['8,15'], PLAYER_PALETTE.B, 'torso still covered at the first lift pixel');
    const raised = heroPixels(at('reveal', 300).frame);
    assert.equal(raised['8,15'], PLAYER_PALETTE.L, 'thin torso appears after garment has risen');
    assert.equal(raised['7,-5'], PLAYER_PALETTE.b, 'same blue garment above head');
    const tucked = heroPixels(at('reveal', 550).frame);
    assert.equal(tucked['7,18'], PLAYER_PALETTE.b, 'blue garment sits at waist');
    assert.equal(tucked['8,15'], PLAYER_PALETTE.L);
    assert.deepEqual(heroPixels(at('transition', 750).frame), spritePixels(PLAYER_SPRITES.idle));
    const final = at('complete').frame;
    assert.equal(final.fekaX, 68); assert.equal(final.stageExit, 1);
    assert.deepEqual(heroPixels(final), spritePixels(PLAYER_SPRITES.idle));
    assert.deepEqual(heroPixels(at('reveal', 300).frame, true), raised, 'reduced motion retains the essential shirt action');
});

test('cast fades in place, clears before the lab reveal and leaves the final handoff clean', () => {
    const podiums = (f: IntroFrame) => paint(f, true).filter(r => r.w === 48 && r.h === 12 && r.color === '#262231');
    const initial = podiums(at('transition').frame), fading = podiums(at('transition', 300).frame);
    assert.equal(initial.length, 2); assert.equal(fading.length, 2);
    assert.deepEqual(fading.map(({ x, y }) => [x, y]), initial.map(({ x, y }) => [x, y]));
    assert.ok(fading.every(r => r.alpha > 0 && r.alpha < 1));
    for (const t of [750, 1800, 2900]) assert.deepEqual(podiums(at('transition', t).frame), []);
    assert.deepEqual(podiums(at('complete').frame), []);
    assert.equal(at('transition', 1800).frame.stageExit, 1);
});

/** Rasterize the articulated actor independently, including the exit's mirrored pose. */
function escortPixels(frame: IntroFrame, reduced = false) {
    let x = 0, y = 0, sx = 1, sy = 1, color = '';
    const states: number[][] = [], pixels: Record<string, string> = {};
    const c = {
        save() { states.push([x, y, sx, sy]); },
        restore() { [x, y, sx, sy] = states.pop()!; },
        translate(dx: number, dy: number) { x += dx * sx; y += dy * sy; },
        scale(dx: number, dy: number) { sx *= dx; sy *= dy; },
        set fillStyle(value: string) { color = value; },
        fillRect(xx: number, yy: number, w: number, h: number) {
            if (color.length !== 7) return; // The ground shadow is not anatomy.
            const x0 = Math.min(x + xx * sx, x + (xx + w) * sx);
            const y0 = Math.min(y + yy * sy, y + (yy + h) * sy);
            for (let j = 0; j < Math.abs(h * sy); j++) for (let i = 0; i < Math.abs(w * sx); i++) {
                pixels[`${x0 + i},${y0 + j}`] = color;
            }
        },
    } as unknown as CanvasRenderingContext2D;
    drawJuiceIntroEscort(c, frame, reduced);
    assert.equal(states.length, 0);
    return pixels;
}

test('escort has planted footsteps, holds still without movement, and freezes decorative gait in reduced motion', () => {
    const base = { ...at('walk').frame, fekaMoving: true, fekaX: 57, fekaWalkDistance: 21 };
    const first = escortPixels(base);
    const later = escortPixels({ ...base, fekaX: 59, fekaWalkDistance: 23 });
    const sole = (pixels: Record<string, string>) => Object.keys(pixels).filter(key => key.endsWith(',159')).sort();
    assert.deepEqual(sole(later), sole(first), 'support sole stays planted while the body crosses over it');
    assert.notDeepEqual(later, first, 'swinging foot and actor advance');
    const idle = { ...base, fekaMoving: false };
    assert.deepEqual(escortPixels(idle), escortPixels({ ...idle, timeMs: idle.timeMs + 1300 }));
    assert.deepEqual(escortPixels(base, true), escortPixels(idle, true));
});

test('escort keeps connected anatomy through gait, shoulder contact, and the turn before exiting', () => {
    const frames = [at('walk').frame, at('push', 100).frame, at('push', 350).frame, at('push', 550).frame,
        { ...at('prepare').frame, elapsedMs: 50 }, { ...at('prepare').frame, elapsedMs: 350 }];
    for (const frame of frames) {
        const pixels = escortPixels(frame), unseen = new Set(Object.keys(pixels));
        const stack = [unseen.values().next().value!]; unseen.delete(stack[0]);
        while (stack.length) {
            const [x, y] = stack.pop()!.split(',').map(Number);
            for (const key of [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`]) {
                if (unseen.delete(key)) stack.push(key);
            }
        }
        assert.equal(unseen.size, 0, `${frame.beat}: hands, elbows, neck and feet form one connected actor`);
        if (frame.beat === 'push') assert.ok(pixels[`${Math.round(frame.fekaX) + 3},144`], 'palm meets Feka shoulder');
    }
    assert.deepEqual(escortPixels({ ...at('prepare').frame, elapsedMs: 800 }), {});
    assert.deepEqual(escortPixels(at('reveal').frame), {});
});
