import test from 'node:test';
import assert from 'node:assert/strict';
import { burnerPresentation, drawBurner } from '../src/adventure/WorldBurnerArt';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { WorldObjects } from '../src/adventure/WorldPhysics';
import { SpriteAtlas, type PixelFrame, type PixelPalette } from '../src/graphics/pixels';

const burner = (width = 13) => new WorldObjects([{ id: 'b', kind: 'jet', x: 80, y: 176, width, height: 48, period: 4200 }]).bodies[0];
class Capture {
    fillStyle = '';
    rectangles: [number, number, number, number, string][] = [];
    fillRect(x: number, y: number, w: number, h: number) { this.rectangles.push([x, y, w, h, this.fillStyle]); }
}
class ArtCapture extends SpriteAtlas {
    override draw(_ctx: CanvasRenderingContext2D, frame: PixelFrame, palette: PixelPalette) {
        assert.equal(frame.length, 30);
        for (const row of frame) {
            assert.equal(row.length, 42);
            for (const key of row) assert.ok(key in palette, `Undefined palette ${key}`);
        }
    }
}
const paint = (b: ReturnType<typeof burner>, time: number, cx = 0, cy = 0) => {
    const c = new Capture();
    drawBurner(c as unknown as CanvasRenderingContext2D, b, new ArtCapture(), cx, cy, time, 6);
    return c.rectangles;
};
test('every dangerous burner pixel remains visible during rise, flow and fall, including all corners', () => {
    const hot = new Set(['#b4513e', '#e98343', '#ffd17a', '#f4ad57', '#fff0b5', '#f8be6d']);
    for (const width of [4, 12.8, 13, 24]) for (let time = 1800; time < 2500; time += 11) {
        const b = burner(width), d = jetCycle(b, time).danger;
        if (!d) continue;
        const pixels = new Set<string>();
        for (const [x, y, w, h, color] of paint(b, time)) if (hot.has(color))
            for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixels.add(`${xx},${yy}`);
        for (let y = d.y; y < d.y + d.height; y++) for (let x = d.x; x < d.x + d.width; x++)
            assert.ok(pixels.has(`${x},${y}`), `Invisible hazard ${x},${y} at ${time} ms, width ${width}`);
    }
});
test('preheat and cooling cannot change the jet danger timing or leave an invisible hot column', () => {
    const b = burner();
    for (const time of [0, 1000, 1500, 1799, 1800, 1801, 1920, 2100, 2330, 2499, 2500, 2600, 2850]) {
        const s = burnerPresentation(b, time), cycle = jetCycle(b, time);
        assert.deepEqual(s.danger, cycle.danger);
        assert.equal(s.phase, cycle.phase);
        assert.equal(s.height, cycle.height);
        assert.ok(s.heat >= 0 && s.heat <= 1);
        if (!s.danger) assert.ok(!paint(b, time).some(p => p[4] === '#b4513e'), 'No lingering dense flame after danger has ended');
    }
    assert.equal(burnerPresentation(b, 1000).preheat, 0);
    assert.ok(burnerPresentation(b, 1700).preheat > .8);
    assert.equal(burnerPresentation(b, 2600).danger, null);
    b.active = true;
    assert.equal(burnerPresentation(b, 2100).heat, 0);
    assert.equal(burnerPresentation(b, 2100).danger, null);
});
test('warning has a dark-backed symbol and is not dependent on flame color or sound', () => {
    const rects = paint(burner(), 1700);
    assert.ok(rects.some(([x, y, w, h, color]) => x === 83 && y === 196 && w === 8 && h === 11 && color === '#192c44'));
    assert.ok(rects.some(p => p[4] === '#ffe6a0'));
});
test('burner render freezes with simulation time, aligns to the pixel grid, and never mutates state', () => {
    for (const time of [0, 1400, 1700, 1840, 2100, 2460, 2600]) {
        const b = burner(), snapshot = structuredClone(b), first = paint(b, time);
        assert.deepEqual(paint(b, time), first);
        assert.deepEqual(paint(b, time, 20, 10), first.map(([x, y, w, h, color]) => [x - 20, y - 10, w, h, color]));
        assert.deepEqual(b, snapshot);
        assert.ok(first.every(p => p.slice(0, 4).every(Number.isInteger)));
    }
});
test('phase offsets and custom periods preserve the same state-to-art contract', () => {
    const b = burner(); b.phase = -2100;
    assert.deepEqual(burnerPresentation(b, 4200).danger, jetCycle(b, 4200).danger);
    b.period = 8400; b.phase = 0;
    assert.equal(burnerPresentation(b, 3000).phase, 'charging');
    assert.ok(burnerPresentation(b, 4200).danger);
});
