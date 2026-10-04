import assert from 'node:assert/strict';
import test from 'node:test';
import { drawGuairaTraversalBackground, drawGuairaTraversalTerrain } from '../src/adventure/experimental/guaira/GuairaTraversalArt';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';

/** The quiet plumbing landmark stays static and subordinate to the real lip. */
test('maintenance downpipe is a compact static backdrop, with no playable or reward colors', t => {
    const h = guairaTraversalBrowser(t), game = h.create(), c = game.renderer.getContext();
    const cx = 700, cy = 108;
    const calls: Array<[number, number, number, number, string]> = [];
    t.mock.method(c, 'fillRect', (x: number, y: number, w: number, height: number) => {
        const wx = x + cx, wy = y + cy;
        if (wx >= 757 && wx + w <= 779 && wy >= 216 && wy + height <= 251)
            calls.push([wx, wy, w, height, String(c.fillStyle)]);
    });
    const before = structuredClone({ stage: game.stage, level: game.level.data, player: game.player.data,
        objects: game.objects, save: game.store.save });
    let expected: typeof calls | undefined;
    for (const reduced of [false, true]) for (const time of [0, 1920, 4000]) {
        calls.length = 0;
        drawGuairaTraversalBackground(c, cx + .2, cy + .2, time, reduced, true);
        assert.ok(calls.length >= 12, 'the authored pipe and its sparse collars are present');
        if (expected) assert.deepEqual(calls, expected, 'route clue is not an animated prompt');
        else expected = [...calls];
        assert.ok(calls.every(([, , w]) => w <= 13), 'no platform-length lip');
        assert.ok(calls.every(([, , , , color]) => !['#dcc28b', '#f0be83', '#ead19b', '#ffe7a3'].includes(color)),
            'no supporting cap, action-cue or reward highlight');
    }
    assert.deepEqual(structuredClone({ stage: game.stage, level: game.level.data, player: game.player.data,
        objects: game.objects, save: game.store.save }), before);
});

test('native terrain still paints over the pipe attachment at the original bank and lower floor', t => {
    const h = guairaTraversalBrowser(t), game = h.create(), c = game.renderer.getContext();
    const caps: Array<[number, number, number, number]> = [];
    t.mock.method(c, 'fillRect', (x: number, y: number, w: number, height: number) => {
        if (c.fillStyle === '#dcc28b') caps.push([x + 700, y + 108, w, height]);
    });
    drawGuairaTraversalTerrain(c, game.level, 700, 108, 0, false);
    assert.ok(caps.some(([x, y, w, height]) => x === 752 && y === 208 && w === 16 && height === 2));
    assert.ok(caps.some(([x, y, w, height]) => x === 768 && y === 256 && w === 16 && height === 2));
    assert.ok(!caps.some(([x, y]) => x === 768 && y < 256), 'the descent remains genuinely open');
});
