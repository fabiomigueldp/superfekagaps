import assert from 'node:assert/strict';
import test from 'node:test';
import { drawWorldCheckpoint } from '../src/adventure/WorldCheckpointArt';
import { WorldGame } from '../src/adventure/WorldGame';
import { ink } from '../src/adventure/WorldPainting';
import { guairaBrowser } from './helpers/guairaLabHarness';

type Paint = [number, number, number, number, string];
function flagPaint(x: number, y: number, reached: boolean): Paint[] {
    const calls: Paint[] = [];
    const c = { fillStyle: '', fillRect: (x: number, y: number, w: number, h: number) =>
        calls.push([x, y, w, h, c.fillStyle]) };
    drawWorldCheckpoint(c as unknown as CanvasRenderingContext2D, x, y, reached);
    return calls;
}

test('reached flags carry a high-contrast check rather than a color-only status', () => {
    function silhouette(reached: boolean) {
        const pixels = new Map<string, string>();
        for (const [x, y, w, h, color] of flagPaint(0, 35, reached))
            for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++)
                pixels.set(`${xx},${yy}`, color);
        return Array.from({ length: 8 }, (_, y) => Array.from({ length: 13 }, (_, x) =>
            pixels.get(`${x + 3},${y + 2}`) === ink ? '#' : '.').join(''));
    }
    assert.deepEqual(silhouette(false), Array(8).fill('.............'));
    assert.deepEqual(silhouette(true), [
        '.............',
        '........##...',
        '........##...',
        '..##..##.....',
        '..##..##.....',
        '....##.......',
        '....##.......',
        '.............',
    ]);
    const luminance = (hex: string) => [0, 2, 4].map(i => parseInt(hex.slice(i + 1, i + 3), 16) / 255)
        .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    assert.ok((luminance('#86d2ad') + .05) / (luminance(ink) + .05) >= 7);
});

test('checkpoint art stays deterministic on the native grid and inside the original flag footprint', () => {
    for (const reached of [false, true]) {
        const calls = flagPaint(3.4, 48.4, reached);
        assert.deepEqual(calls, flagPaint(3.4, 48.4, reached));
        assert.ok(calls.length <= 7, 'No particles, extra surfaces or animated state are needed.');
        for (const [x, y, w, h] of calls) {
            assert.ok([x, y, w, h].every(Number.isInteger));
            assert.ok(x >= 3 && x + w <= 20 && y >= 13 && y + h <= 48);
        }
    }
});

for (const reducedMotion of [false, true]) for (const muted of [false, true])
test(`native checkpoint render follows activation and resume with reduced motion ${reducedMotion}, mute ${muted}`, t => {
    const h = guairaBrowser(t, { reducedMotion });
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    game.load('1-1', false); game.audio.enabled = !muted;
    const sounds: string[] = [];
    t.mock.method(game.audio, 'sfx', (sound: string) => sounds.push(sound));
    const c = game.renderer.getContext(), calls: Paint[] = [];
    const fill = c.fillRect.bind(c);
    t.mock.method(c, 'fillRect', (x: number, y: number, w: number, height: number) => {
        calls.push([x, y, w, height, String(c.fillStyle)]); fill(x, y, w, height);
    });
    function renderAndCheck(reachedIndex: number) {
        const state = JSON.stringify({ save: game.store.save, player: game.player.data, camera: game.camera });
        const soundCount = sounds.length;
        calls.length = 0; game.render();
        assert.equal(JSON.stringify({ save: game.store.save, player: game.player.data, camera: game.camera }), state);
        assert.equal(sounds.length, soundCount, 'Painting the reached shape must never replay activation audio.');
        game.stage.checkpoints.forEach((cp, i) => {
            const expected = flagPaint(cp.x * 16 - Math.round(game.camera.x), cp.y * 16 - Math.round(game.camera.y), i <= reachedIndex);
            const start = calls.findIndex(call => JSON.stringify(call) === JSON.stringify(expected[0]));
            assert.ok(start >= 0, `Checkpoint ${i} was not drawn.`);
            assert.deepEqual(calls.slice(start, start + expected.length), expected);
        });
    }
    function reach(index: number) {
        const cp = game.stage.checkpoints[index], p = game.player.data;
        p.position = { x: cp.x * 16, y: cp.y * 16 - p.height };
        p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
        game.update(1000 / 60);
        assert.equal(game.store.save.checkpoint?.index, index);
    }
    renderAndCheck(-1);
    reach(0); renderAndCheck(0); renderAndCheck(0);
    reach(1); renderAndCheck(1);
    game.load('1-1', true); renderAndCheck(1);
    assert.equal(sounds.filter(sound => sound === 'checkpoint').length, 2);
});
