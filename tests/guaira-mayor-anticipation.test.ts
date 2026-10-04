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
    assert.equal(m.state, 'stamp'); assert.equal(m.stateTick, 0); assert.deepEqual(m.danger, A.vent);
    for (let tick = 0; tick < R.stamp; tick++) {
        assert.equal(m.state, 'stamp'); assert.deepEqual(m.danger, A.vent);
        raster(m); raster(m, true); advance(m, 1);
    }
    assert.equal(m.state, 'recover'); assert.equal(m.stateTick, 0); assert.equal(m.danger, null);
});
