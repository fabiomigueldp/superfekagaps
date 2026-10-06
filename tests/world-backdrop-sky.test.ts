import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldBackdrop } from '../src/adventure/WorldBackdrop';
import { box } from '../src/adventure/WorldPainting';
import { ISLANDS } from '../src/adventure/campaign';
import type { Island } from '../src/adventure/types';

function recordingContext(alpha = 1) {
    const calls: unknown[][] = [];
    const context = { fillStyle: '', globalAlpha: alpha,
        fillRect(...args: number[]) { calls.push(['fillRect', ...args, context.fillStyle, context.globalAlpha]); },
        drawImage(...args: unknown[]) { calls.push(['drawImage', ...args, context.globalAlpha]); } };
    return { context: context as unknown as CanvasRenderingContext2D, calls };
}

function canvasHarness(t: TestContext) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
    let allocations = 0;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        createElement: () => {
            allocations++;
            return { width: 0, height: 0, getContext: () => ({ fillStyle: '', globalAlpha: 1, fillRect() {} }) };
        }
    } });
    t.after(() => {
        if (original) Object.defineProperty(globalThis, 'document', original);
        else Reflect.deleteProperty(globalThis, 'document');
    });
    return { allocations: () => allocations };
}

/** Preserve the original uncached frame commands, reusing only the unchanged
 * native layer builder so image identity, ordering and coordinates also compare.
 */
function referenceDraw(backdrop: WorldBackdrop, c: CanvasRenderingContext2D, island: Island,
    cx: number, cy: number, time: number, variant = 0) {
    const channels = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
    const a = channels(island.sky[0]), b = channels(island.sky[1]);
    for (let y = 0; y < 180; y += 3) {
        const t = y / 180;
        box(c, 0, y, 320, 3, `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`);
    }
    const layers = (backdrop as unknown as { layers(world: number, variant: number): HTMLCanvasElement[] })
        .layers(island.id, variant);
    layers.forEach((layer, i) => {
        const f = [.055, .16, .31][i], x = -(((cx * f + (i === 0 && island.id !== 5 ? time * .00065 : 0)) % 640 + 640) % 640), y = Math.round(-cy * [.035, .09, .14][i]);
        c.drawImage(layer, Math.round(x), y);
        c.drawImage(layer, Math.round(x + 640), y);
    });
    if (island.id === 5) for (let i = 0; i < 15; i++) {
        const x = ((i * 83 - cx * .22) % 340 + 340) % 340 - 10, y = (i * 37 + time * .005) % 180;
        box(c, x, y, 1, 1, '#acd7e780');
    }
}

test('cached sky retains every original rectangle, parallax layer and Reserva mote', t => {
    canvasHarness(t);
    const backdrop = new WorldBackdrop();
    for (const island of ISLANDS) for (const [cx, cy, time, variant] of [
        [0, 80, 0, 1], [128, 40, 1250, 4], [-97.5, -65, 8000, 5],
    ]) for (const alpha of [1, .37]) {
        const actual = recordingContext(alpha), reference = recordingContext(alpha);
        referenceDraw(backdrop, reference.context, island, cx, cy, time, variant);
        backdrop.draw(actual.context, island, cx, cy, time, variant);
        assert.deepEqual(actual.calls, reference.calls, `Biome ${island.id}, camera ${cx},${cy}, time ${time}, variant ${variant}`);
        assert.equal(actual.calls.filter(call => call[0] === 'fillRect').length, island.id === 5 ? 75 : 60);
        assert.equal(actual.calls.filter(call => call[0] === 'drawImage').length, 6);
    }
});

test('both in-place sky edits and replacement palettes are reflected immediately', t => {
    canvasHarness(t);
    const backdrop = new WorldBackdrop(), island = structuredClone(ISLANDS[0]);
    const changes = [
        () => {},
        () => { island.sky[0] = '#010203'; },
        () => { island.sky[1] = '#fefdfc'; },
        () => { island.sky = [...ISLANDS[1].sky]; },
        () => { island.sky = [...ISLANDS[0].sky]; },
    ];
    for (const change of changes) {
        change();
        const before = structuredClone(island), actual = recordingContext(), reference = recordingContext();
        referenceDraw(backdrop, reference.context, island, 12, 30, 900, 1);
        backdrop.draw(actual.context, island, 12, 30, 900, 1);
        assert.deepEqual(actual.calls, reference.calls);
        assert.deepEqual(island, before, 'Rendering must not change the authored palette.');
    }
});

test('warm sky draws remove repeated color work and retain only one pair per backdrop', t => {
    const surfaces = canvasHarness(t), backdrop = new WorldBackdrop(), second = new WorldBackdrop();
    const island = structuredClone(ISLANDS[0]), c = recordingContext().context;
    backdrop.draw(c, island, 0, 80, 1250, 1);
    second.draw(c, island, 0, 80, 1250, 1);
    const initialSurfaces = surfaces.allocations();
    const count = (draw: () => void) => {
        const counts = { maps: 0, joins: 0, parses: 0 };
        const map = Array.prototype.map, join = Array.prototype.join, parse = globalThis.parseInt;
        Array.prototype.map = function(this: unknown, ...args: unknown[]) {
            counts.maps++; return Reflect.apply(map, this, args);
        } as typeof map;
        Array.prototype.join = function(this: unknown, ...args: unknown[]) {
            counts.joins++; return Reflect.apply(join, this, args);
        };
        globalThis.parseInt = (value, radix) => { counts.parses++; return parse(value, radix); };
        try { draw(); }
        finally { Array.prototype.map = map; Array.prototype.join = join; globalThis.parseInt = parse; }
        return counts;
    };
    const rebuild = { maps: 62, joins: 60, parses: 6 }, warm = { maps: 0, joins: 0, parses: 0 };
    assert.deepEqual(count(() => referenceDraw(backdrop, c, island, 0, 80, 1250, 1)), rebuild);
    assert.deepEqual(count(() => backdrop.draw(c, island, 120, -17, 5000, 1)), warm);
    island.sky = [...island.sky];
    assert.deepEqual(count(() => backdrop.draw(c, island, 0, 80, 1250, 1)), warm, 'Equal primitive colors reuse the pair.');
    island.sky[0] = '#010203';
    assert.deepEqual(count(() => backdrop.draw(c, island, 0, 80, 1250, 1)), rebuild);
    assert.deepEqual(count(() => backdrop.draw(c, island, 0, 80, 1250, 1)), warm);
    assert.deepEqual(count(() => second.draw(c, ISLANDS[0], 0, 80, 1250, 1)), warm, 'Instances do not replace each other’s pair.');
    island.sky[1] = '#fefdfc';
    assert.deepEqual(count(() => backdrop.draw(c, island, 0, 80, 1250, 1)), rebuild);
    island.sky = [...ISLANDS[0].sky];
    assert.deepEqual(count(() => backdrop.draw(c, island, 0, 80, 1250, 1)), rebuild, 'Returning to an older pair recomputes it; no growing cache.');
    assert.equal(surfaces.allocations(), initialSurfaces, 'The sky cache creates no raster surfaces.');
});
