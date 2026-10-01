import test from 'node:test';
import assert from 'node:assert/strict';
import { SpriteAtlas, type PixelFrame, type PixelPalette } from '../src/graphics/pixels';
import { drawGeyser } from '../src/adventure/WorldGeyserArt';
import { geyserDroplet, geyserPresentation, type GeyserPose } from '../src/adventure/WorldGeyserState';
import { GEYSER_HOUSINGS, GEYSER_PALETTE } from '../src/adventure/WorldGeyserAssets';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { WorldObjects } from '../src/adventure/WorldPhysics';
import { stageById } from '../src/adventure/campaign';

const make = () => new WorldObjects([{ id: 'j', kind: 'jet', x: 80, y: 48, width: 12.8, height: 48, period: 4200 }]).bodies[0];
type Fill = [number, number, number, number, string];
function recorder() {
    const fills: Fill[] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { fills.push([x, y, w, h, String(this.fillStyle)]); } } as CanvasRenderingContext2D;
    const atlas = { draw(c: CanvasRenderingContext2D, frame: PixelFrame, palette: PixelPalette, x: number, y: number) {
        frame.forEach((row, yy) => [...row].forEach((symbol, xx) => {
            const color = palette[symbol];
            if (color) { c.fillStyle = color; c.fillRect(Math.round(x) + xx, Math.round(y) + yy, 1, 1); }
        }));
    } } as SpriteAtlas;
    return { fills, ctx, atlas };
}

test('geyser tells separate anticipation, bubbling and pressure without extending danger', () => {
    const b = make();
    const samples: [number, GeyserPose][] = [[0, 'rest'], [900, 'anticipation'], [1100, 'bubble'], [1650, 'pressure'], [1850, 'eruption'], [2100, 'sustain'], [2400, 'retract'], [2600, 'settle'], [3100, 'rest']];
    for (const [time, pose] of samples) {
        const state = geyserPresentation(b, time);
        assert.equal(state.pose, pose);
        assert.deepEqual(state.danger, jetCycle(b, time).danger);
        if (['rest', 'anticipation', 'bubble', 'pressure', 'settle'].includes(pose)) assert.equal(state.danger, null);
        assert.ok(state.progress >= 0 && state.progress <= 1);
    }
    for (let t = 0; t < 4200; t += 1000 / 60) {
        assert.deepEqual(geyserPresentation(b, t).danger, jetCycle(b, t).danger, `Danger must not change at ${t} ms`);
    }
});

test('presentation respects offset periods, pause and an immediately closed valve', () => {
    const b = make();
    b.phase = -10000; b.period = 8400;
    for (const time of [-1500, 0, 990, 1800, 2330, 2600]) {
        assert.deepEqual(geyserPresentation(b, time), geyserPresentation(b, time + b.period));
    }
    b.phase = 0; b.period = 4200;
    assert.equal(geyserPresentation(b, 2100).pose, 'sustain');
    b.active = true;
    for (let time = 0; time < 4200; time += 50) {
        assert.equal(geyserPresentation(b, time).pose, 'closed');
        assert.equal(geyserPresentation(b, time).danger, null);
    }
});

test('all dangerous column pixels are painted, including the neck and fractional camera offsets', () => {
    const b = make();
    for (const world of [3, 5]) for (const time of [1802, 1840, 1920, 2100, 2400, 2498]) for (const camera of [0, .45, 20.8]) {
        const { fills, ctx, atlas } = recorder();
        drawGeyser(ctx, b, atlas, camera, camera, time, world);
        const danger = jetCycle(b, time).danger;
        if (!danger) continue;
        for (let y = Math.round(danger.y - camera); y < Math.round(danger.y - camera) + danger.height; y++)
            for (let x = Math.round(danger.x - camera); x < Math.round(danger.x - camera) + Math.round(danger.width); x++)
                assert.ok(fills.some(([xx, yy, w, h]) => x >= xx && x < xx + w && y >= yy && y < yy + h), `Unpainted danger pixel ${x},${y} at ${time} ms`);
    }
});

test('pixel art is deterministic, finite, grid-aligned and does not mutate physics', () => {
    const b = make(), original = structuredClone(b);
    for (const world of [3, 5]) for (const time of [0, 900, 1200, 1600, 1840, 2100, 2400, 2600, 3100]) {
        const a = recorder(), z = recorder();
        drawGeyser(a.ctx, b, a.atlas, 0, 0, time, world);
        drawGeyser(z.ctx, b, z.atlas, 0, 0, time, world);
        assert.deepEqual(a.fills, z.fills, 'A paused frame must not keep animating.');
        const shifted = recorder();
        drawGeyser(shifted.ctx, b, shifted.atlas, 20, 10, time, world);
        assert.deepEqual(shifted.fills, a.fills.map(([x, y, w, h, color]) => [x - 20, y - 10, w, h, color]),
            'Scrolling the camera must not animate the liquid texture at a frozen simulation time.');
        for (const [x, y, w, h, color] of a.fills) {
            assert.ok([x, y, w, h].every(Number.isInteger));
            assert.ok(w > 0 && h > 0);
            assert.match(color, /^#[0-9a-f]{6}$/i);
        }
        assert.deepEqual(b, original, 'Rendering must not advance the machine.');
    }
});

test('cosmetic droplets reach the floor before their impact rings and expire', () => {
    assert.equal(geyserDroplet(-.001, 50, 10, 80, 1, 9), null);
    assert.equal(geyserDroplet(1.001, 50, 10, 80, 1, 9), null);
    const flight = geyserDroplet(.7799, 50, 10, 80, 1, 9)!;
    const impact = geyserDroplet(.78, 50, 10, 80, 1, 9)!;
    assert.equal(flight.impact, false); assert.equal(impact.impact, true);
    assert.ok(Math.abs(flight.x - impact.x) < .01);
    assert.ok(Math.abs(flight.y - impact.y) < .05);
    assert.equal(impact.y, 80);
    assert.equal(geyserDroplet(1, 50, 10, 80, 1, 9)!.y, 80);
    assert.ok(geyserDroplet(.4, 50, 10, 80, -1, 9)!.x < 50);
});

test('factory and cold housings use valid cached native frames', () => {
    for (const frame of Object.values(GEYSER_HOUSINGS)) {
        assert.equal(frame.length, 30);
        assert.ok(frame.every(row => row.length === 42));
        for (const row of frame) for (const symbol of row) assert.ok(symbol in GEYSER_PALETTE);
    }
    assert.notDeepEqual(GEYSER_HOUSINGS.factory, GEYSER_HOUSINGS.cold);
});

test('authored factory and cold encounters retain their learnable offsets and safe intervals', () => {
    let machines = 0;
    for (const world of [3, 5]) for (let n = 1; n <= 5; n++) {
        const stage = stageById(`${world}-${n}`)!;
        for (const b of new WorldObjects(stage.mechanisms).bodies.filter(b => b.kind === 'jet')) {
            machines++;
            let danger = 0, warning = 0, safe = 0;
            for (let t = 0; t < 4200; t += 10) {
                const s = geyserPresentation(b, t);
                if (s.danger) danger += 10;
                else safe += 10;
                if (s.phase === 'charging') warning += 10;
            }
            assert.equal(warning, 800, `${stage.id}/${b.id}`);
            assert.ok(danger <= 700 && danger >= 680);
            assert.ok(safe >= 3500, 'The art patch must not silently increase the duty cycle.');
        }
    }
    assert.ok(machines >= 15);
});
