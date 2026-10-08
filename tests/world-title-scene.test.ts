import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldTitleScene, titleBirds } from '../src/adventure/WorldTitleScene';
import { SpriteAtlas } from '../src/graphics/pixels';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

function fixture(t: Parameters<typeof sceneLifecycleBrowser>[0]) {
    const h = sceneLifecycleBrowser(t), create = h.document.createElement;
    let allocations = 0;
    h.document.createElement = tag => { if (tag === 'canvas') allocations++; return create(tag); };
    const scene = new WorldTitleScene(), atlas = new SpriteAtlas(), c = h.canvas.getContext();
    const ids = new Map<CanvasImageSource, number>();
    let commands: unknown[][] = [];
    c.globalAlpha = 1;
    c.fillRect = (...args) => {
        assert.ok(args.every(Number.isInteger), 'All animated geometry stays on the native pixel grid');
        commands.push(['box', c.fillStyle, c.globalAlpha, ...args]);
    };
    c.drawImage = ((image: CanvasImageSource, ...args: number[]) => {
        assert.ok(args.every(Number.isInteger), 'Cached planes and sprites use integer anchors');
        if (!ids.has(image)) ids.set(image, ids.size);
        commands.push(['image', ids.get(image), ...args]);
    }) as typeof c.drawImage;
    return {
        allocations: () => allocations,
        paint(time: number, reduced = false) {
            commands = []; scene.draw(c, atlas, time, reduced); return commands;
        },
    };
}

test('title redraws are deterministic, including after viewing a different moment', t => {
    const h = fixture(t), first = h.paint(7100);
    h.paint(83000);
    assert.deepEqual(h.paint(7100), first);
    assert.notDeepEqual(h.paint(21900), first, 'The ordinary title has ambient life');
});

test('reduced motion freezes the entire title and removes traversing birds', t => {
    const h = fixture(t), still = h.paint(0, true);
    for (const time of [7100, 42000, 91000, 1200000]) {
        assert.deepEqual(h.paint(time, true), still);
        assert.deepEqual(titleBirds(time, true), []);
    }
    h.paint(17000, false);
    assert.deepEqual(h.paint(17000, true), still, 'A live preference change returns to the stable composition');
});

test('title caches remain bounded after long idles and alternate sprite poses', t => {
    const h = fixture(t);
    // Warm both shoulder poses and the occasional blink.
    for (const time of [0, 4000, 6300]) h.paint(time);
    const warm = h.allocations();
    for (const time of [17000, 68500, 91000, 1200000, 3600000, 86400000]) h.paint(time);
    assert.equal(h.allocations(), warm, 'No new parallax surfaces or sprite variants accumulate');
});

test('bird passages reset outside the canvas and leave quiet intervals', () => {
    let quiet = 0, lively = 0;
    const visible = (time: number) => titleBirds(time).filter(b => b.x > 8 && b.x < 312);
    // A new or disappearing interior bird in 1 ms would reveal a wrapping pop.
    for (let time = 1; time < 200000; time += 37) {
        const before = visible(time - 1), after = titleBirds(time);
        for (const b of before) assert.ok(after.some(a => a.near === b.near && Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1));
        const next = visible(time), previous = titleBirds(time - 1);
        for (const b of next) assert.ok(previous.some(a => a.near === b.near && Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1));
        if (next.length) lively++; else quiet++;
    }
    assert.ok(lively > 0 && quiet > 0, 'Flight is occasional, with breathing room between passages');
});
