import assert from 'node:assert/strict';
import test from 'node:test';
import { SkeletonBullModel, BULL_RULES } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { drawSkeletonBull } from '../src/adventure/experimental/guaira/SkeletonBullArt';
import { bullChargeWarningRange, drawBullWarning } from '../src/adventure/experimental/guaira/GuairaLabArt';

function recorder() {
    const calls: unknown[][] = []; let color = '', depth = 0;
    const c = {
        get fillStyle() { return color; }, set fillStyle(value: string) { color = value; },
        fillRect(x: number, y: number, w: number, h: number) {
            assert.ok([x, y, w, h].every(Number.isInteger)); assert.ok(w > 0 && h > 0);
            calls.push([color, x, y, w, h]);
        },
        save() { depth++; }, restore() { depth--; },
        translate(x: number, y: number) { calls.push(['translate', x, y]); },
        scale(x: number, y: number) { calls.push(['scale', x, y]); },
    };
    return { c: c as unknown as CanvasRenderingContext2D, calls, balanced: () => depth === 0 };
}

test('charge warning covers every later body and swept hazard in both locked directions', () => {
    for (const facing of [-1, 1] as const) for (const x of [80, 160, 246]) {
        const b = new SkeletonBullModel(); b.state = 'tell'; b.facing = facing; b.x = x;
        const range = bullChargeWarningRange(b), p = { x: facing < 0 ? 0 : 306, y: 200, width: 14, height: 24 };
        for (let tick = 0; tick < 130; tick++) {
            b.update(BULL_RULES.tickMs, p);
            assert.ok(b.x >= range.left && b.x + b.width <= range.right);
            for (const h of b.hazards) assert.ok(h.x >= range.left && h.x + h.width <= range.right);
            if (b.vulnerable) break;
        }
    }
});

test('charge chevrons stay in their lane and low-bone marks remain distinct', () => {
    const b = new SkeletonBullModel(); b.state = 'tell'; b.x = 160; b.facing = 1;
    const range = bullChargeWarningRange(b), charge = recorder(); drawBullWarning(charge.c, b);
    for (const [, x, y, width, height] of charge.calls as [string, number, number, number, number][]) {
        assert.ok(x >= range.left && x + width <= range.right);
        assert.ok(y >= b.arena.floor - 6 && y + height <= b.arena.floor);
    }
    const arrows = charge.calls.filter(c => c[0] === '#edcaf5'); assert.ok(arrows.length > 0);
    b.state = 'rattle'; const bones = recorder(); drawBullWarning(bones.c, b);
    assert.ok(bones.calls.some(c => c[0] === '#f0ddae' && c[3] === 7));
    assert.ok(!bones.calls.some(c => c[0] === '#edcaf5'));
    b.state = 'charge'; const active = recorder(); drawBullWarning(active.c, b); assert.equal(active.calls.length, 0);
});

test('native bull poses articulate without modifying the simulation or using fractional pixels', () => {
    const b = new SkeletonBullModel(); const poses = new Set<string>();
    for (const state of ['idle', 'tell', 'rattle', 'charge', 'brake', 'recover', 'defeated'] as const) {
        b.state = state; b.stateTick = 12;
        const before = JSON.stringify(b), r = recorder(); drawSkeletonBull(r.c, b);
        assert.equal(JSON.stringify(b), before); assert.ok(r.balanced()); poses.add(JSON.stringify(r.calls));
    }
    assert.equal(poses.size, 7);
    b.state = 'charge'; const strides = new Set<string>();
    for (let tick = 0; tick < 18; tick += 3) { b.stateTick = tick; const r = recorder(); drawSkeletonBull(r.c, b); strides.add(JSON.stringify(r.calls)); }
    assert.equal(strides.size, 6);
});

test('pause repeats the same pose and reduced motion is stable between opening-clock marks', () => {
    const b = new SkeletonBullModel();
    for (const state of ['idle', 'tell', 'rattle', 'charge', 'brake', 'recover'] as const) {
        b.state = state; b.stateTick = 7;
        const a = recorder(), pause = recorder(); drawSkeletonBull(a.c, b); drawSkeletonBull(pause.c, b);
        assert.deepEqual(a.calls, pause.calls);
        const start = recorder(), later = recorder(); drawSkeletonBull(start.c, b, true);
        b.stateTick = state === 'recover' ? 8 : 35; b.tick += 100;
        drawSkeletonBull(later.c, b, true); assert.deepEqual(start.calls, later.calls);
    }
});
