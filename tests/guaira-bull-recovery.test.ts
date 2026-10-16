import assert from 'node:assert/strict';
import test from 'node:test';
import { BULL_RULES as R, SkeletonBullModel } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { GuairaBullEncounter } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { drawSkeletonBull } from '../src/adventure/experimental/guaira/SkeletonBullArt';
import { drawBullBones } from '../src/adventure/experimental/guaira/SkeletonBullBoneArt';
import { textWidth } from '../src/graphics/BitmapFont';
import { guairaBrowser } from './helpers/guairaLabHarness';
import miss from './helpers/guairaBullMissReplay.json';

const player = (x: number) => ({ x, y: 200, width: 14, height: 24 });
function ready(health: number, facing: -1 | 1, bones: boolean) {
    const b = new SkeletonBullModel(); b.health = health; b.x = facing < 0 ? 256 : 16;
    b.state = 'idle'; b.stateTick = R.rest - 1; b.cycle = bones ? 2 : 0;
    b.update(R.tickMs, player(facing < 0 ? 0 : 306)); return b;
}
function step(b: SkeletonBullModel, n = 1) {
    for (let i = 0; i < n; i++) b.update(R.tickMs, player(b.facing < 0 ? 0 : 306));
}
function opening(b: SkeletonBullModel) {
    for (let i = 0; i < 320 && !b.vulnerable; i++) step(b);
    assert.equal(b.vulnerable, true);
}

for (const health of [6, 4, 2]) for (const facing of [-1, 1] as const) for (const bones of [false, true])
test(`missed ${bones ? 'bones' : 'charge'} opening closes fairly: health=${health}, facing=${facing}`, () => {
    const b = ready(health, facing, bones); opening(b);
    while (b.openingTicksRemaining > 1) step(b);
    const side = player(b.x + 17), top = { ...side, y: b.y - 2 }, previous = { ...top, y: b.y - 30 };
    assert.equal(b.contact(side, side, false), 'none'); step(b);
    assert.equal(b.state, 'idle'); assert.equal(b.stateTick, 0); assert.equal(b.rearming, true);
    const x = b.x, cycle = b.cycle, tick = b.tick;
    for (let i = 0; i < R.rest; i++) {
        assert.equal(b.rearming, true); assert.equal(b.vulnerable, false); assert.equal(b.openingTicksRemaining, 0);
        assert.deepEqual(b.hazards, []); assert.equal(b.x, x);
        assert.equal(b.contact(side, side, false), 'none', 'no unannounced side damage while the ribs are visibly closing');
        assert.equal(b.contact(top, previous, true), 'bounce', 'late descending contact cannot award another opening');
        assert.equal(b.health, health); step(b);
    }
    assert.equal(b.tick - tick, R.rest, 'reuse the existing rest instead of lengthening the cycle');
    assert.equal(b.cycle, cycle + 1); assert.equal(b.rearming, false); assert.equal(b.stateTick, 0);
    assert.ok(['tell', 'rattle'].includes(b.state));
    assert.equal(b.contact(side, side, false), 'hurt', 'remaining inside the fully armed body is still unsafe');
    const warning = b.state, duration = b.warningTicks;
    for (let i = 0; i < duration; i++) { assert.equal(b.state, warning); step(b); }
    assert.ok(['charge', 'bones'].includes(b.state), 'the complete next tell is preserved');
});

test('the final valid opening tick still hits; success, defeat and retry never keep a closing grace', () => {
    for (const health of [1, 6]) {
        const b = ready(health, -1, false); opening(b);
        while (b.openingTicksRemaining > 1) step(b);
        const top = { x: b.x + 12, y: b.y - 2, width: 14, height: 24 };
        assert.equal(b.contact(top, { ...top, y: b.y - 30 }, true), health === 1 ? 'defeated' : 'hit');
        assert.equal(b.health, health - 1); assert.equal(b.rearming, false);
        step(b, R.hurt); assert.equal(b.rearming, false);
        assert.equal(new SkeletonBullModel().rearming, false);
    }
});

for (const bullX of [16, 256]) for (const direction of [-1, 1])
test(`native walk can leave the centre of the closing body: bull=${bullX}, direction=${direction}`, t => {
    const h = guairaBrowser(t), g = h.create(), b = (g.boss as GuairaBullEncounter).model;
    // Seed only the boundary case. The full twenty-four-tick retreat uses the
    // real Player's ordinary walking acceleration, with no sprint or teleport.
    b.x = bullX; b.state = 'recover'; b.stateTick = R.recover - 1;
    g.player.data.position.x = b.x + (b.width - g.player.data.width) / 2;
    g.update(R.tickMs); assert.equal(b.rearming, true);
    const code = direction < 0 ? 'ArrowLeft' : 'ArrowRight';
    h.window.dispatch('keydown', { key: code, code, target: h.canvas });
    for (let tick = 0; tick < R.rest; tick++) {
        g.update(R.tickMs); assert.equal(g.player.data.hasHelmet, true); assert.equal(g.player.data.isDead, false);
    }
    assert.equal(b.state, 'tell'); assert.equal(b.rearming, false);
    const p = g.player.getRect();
    assert.ok(direction < 0 ? p.x + p.width <= b.x : p.x >= b.x + b.width);
    assert.equal(b.health, 6);
});

function controls(h: ReturnType<typeof guairaBrowser>, touch: boolean) {
    let held = new Set<string>();
    return (codes: string[]) => {
        if (touch) {
            const x: Record<string, number> = { ArrowLeft: .07, ArrowRight: .22, ArrowDown: .5, ShiftLeft: .76, Space: .93 };
            h.canvas.dispatch('touchstart', { touches: codes.map((code, i) => ({ identifier: i + 1, target: h.canvas, clientX: x[code] * 640, clientY: 330 })) });
        } else {
            const next = new Set(codes);
            for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            held = next;
        }
    };
}
for (const touch of [false, true]) for (const reducedMotion of [false, true])
test(`native missed-opening route retreats, pauses and punishes the next charge: touch=${touch}, reduced=${reducedMotion}`, t => {
    const h = guairaBrowser(t, { touch, reducedMotion }), g = h.create(), keys = controls(h, touch), hits: number[] = [];
    let frame = 0, health = 6, closingTicks = 0;
    for (const [count, codes] of miss.runs as Array<[number, string[]]>) {
        keys(codes);
        for (let i = 0; i < count; i++) {
            g.update(R.tickMs); frame++; const b = (g.boss as GuairaBullEncounter).model;
            assert.equal(g.player.data.hasHelmet, true, `frame ${frame}`); assert.equal(g.player.data.isDead, false);
            if (b.health < health) hits.push(frame); health = b.health;
            if (b.rearming) {
                closingTicks++; assert.equal(g.boss!.hint, 'COSTELAS FECHANDO! RECUE');
                assert.ok(textWidth(g.boss!.hint) <= 267); g.render(); assert.ok(h.status.textContent.includes(g.boss!.hint));
            }
            if (frame === 251) {
                keys([]); g.toggleLabPause(); const paused = JSON.stringify({ b, p: g.player.data, c: g.camera, t: g.time });
                for (let n = 0; n < 20; n++) { g.update(100); g.render(); }
                assert.equal(JSON.stringify({ b, p: g.player.data, c: g.camera, t: g.time }), paused);
                g.toggleLabPause(); keys(codes);
            }
        }
    }
    assert.equal(frame, miss.frames); assert.equal(closingTicks, R.rest);
    assert.deepEqual(hits, miss.expectedHits.map(h => h.frame + 1)); assert.equal(health, miss.expectedFinalHealth);
    assert.equal(g.canAdvanceToAscent, false); assert.deepEqual(g.store.save.completed, []);
    g.load('guaira-lab'); assert.equal((g.boss as GuairaBullEncounter).model.rearming, false); assert.equal(g.boss!.health, 6);
});

type Paint = [string, number, number, number, number];
function paint(b: SkeletonBullModel, reduced = false, bones = false) {
    const calls: Paint[] = []; let depth = 0;
    const c = { fillStyle: '', save() { depth++; }, restore() { depth--; }, translate() {}, scale() {},
        fillRect(x: number, y: number, w: number, h: number) {
            assert.ok([x, y, w, h].every(Number.isInteger)); assert.ok(w > 0 && h > 0);
            calls.push([this.fillStyle, x, y, w, h]);
        } };
    const before = JSON.stringify(b);
    (bones ? drawBullBones : drawSkeletonBull)(c as unknown as CanvasRenderingContext2D, b, reduced);
    assert.equal(JSON.stringify(b), before); assert.equal(depth, 0); return calls;
}
test('closing meets the last open silhouette, then plants four bounded poses and settles into idle', () => {
    const b = ready(6, -1, false); opening(b); while (b.openingTicksRemaining > 1) step(b);
    const withoutMarks = paint(b).filter(([, x, y, w, h]) =>
        !(y === 5 && w === 6 && h === 4 && [-12, -4, 4].includes(x)) &&
        !(y === 6 && w === 4 && h === 2 && [-11, -3, 5].includes(x)));
    step(b); assert.deepEqual(paint(b), withoutMarks, 'closing does not snap the body or leave a false opening marker');
    const poses = new Set<string>(), reduced = paint(b, true); let settled: Paint[] = [];
    for (let i = 0; i < R.rest; i++) {
        const calls = paint(b); poses.add(JSON.stringify(calls)); settled = calls;
        assert.deepEqual(paint(b), calls); assert.deepEqual(paint(b, true), reduced);
        const hoofs = calls.filter(([color, , y, w, h]) => color === '#302836' && y > 20 && w === 6 && h === 4);
        assert.equal(hoofs.length, 4); assert.ok(hoofs.every(([, , y]) => y === 30)); step(b);
    }
    assert.equal(poses.size, 4);
    const idle = new SkeletonBullModel(); idle.state = 'idle'; assert.deepEqual(settled, paint(idle));
});

for (const facing of [-1, 1] as const) for (const health of [6, 4])
test(`loose ribs meet both actual launch positions without introducing warning hazards: facing=${facing}, health=${health}`, () => {
    const b = ready(health, facing, true), reduced = paint(b, true, true);
    for (let i = 0; i < R.rattle; i++) {
        assert.deepEqual(b.hazards, []); assert.deepEqual(b.visibleBones, []);
        assert.deepEqual(paint(b, true, true), reduced);
        if (i === R.rattle - 1) {
            const calls = paint(b, false, true);
            for (const launch of b.boneLaunchPoses) for (const offset of [-1, 6])
                assert.ok(calls.some(([color, x, y, w, h]) => color === '#826461' && x === launch.x + offset && y === launch.y - 1 && w === 5 && h === 9));
        }
        step(b);
    }
    assert.equal(b.state, 'bones');
    assert.deepEqual(b.bones.map(({ x, y, width, height }) => ({ x, y, width, height })), b.boneLaunchPoses);
    const preview = b.boneLaunchPoses; preview[0].x = -999;
    assert.notEqual(b.bones[0].x, -999, 'render launch descriptors cannot modify actual projectiles');
});

for (const facing of [-1, 1] as const)
test(`bone tumble and ground contacts follow the real hop, clear with recovery and freeze without a render clock: facing=${facing}`, () => {
    const b = ready(4, facing, true); step(b, R.rattle);
    const shapes = new Set<string>(), widths = new Set<number>();
    for (let age = 0; age < b.boneFlightDuration; age++) {
        const calls = paint(b, false, true); assert.deepEqual(paint(b, false, true), calls);
        const bone = b.bones[0];
        if (age < 20 && bone) shapes.add(JSON.stringify(calls.filter(([color]) => color === '#f0ddae').map(([color, x, y, w, h]) => [color, x - bone.x, y - bone.y, w, h])));
        for (const [color, , , width] of calls) if (color === '#9b6b51') widths.add(width);
        assert.equal(paint(b, true, true).some(([color]) => color === '#d5ab7c'), false, 'reduced motion omits contact dust');
        if (age === R.boneHop) {
            for (const p of b.bones) assert.ok(calls.some(([color, x]) => color === '#d5ab7c' && x === p.x + 1), 'bounce dust originates at the actual landing');
        }
        step(b);
    }
    assert.equal(shapes.size, 4); assert.ok(widths.has(5) && widths.has(10), 'shadow narrows at the physical apex');
    assert.equal(b.state, 'recover'); assert.deepEqual(paint(b, false, true), []);
});
