import assert from 'node:assert/strict';
import test from 'node:test';
import { SpriteAtlas, type PixelFrame, type PixelPalette } from '../src/graphics/pixels';
import { drawWorldSeal } from '../src/adventure/WorldSealArt';
import { SEALS, WORLD_PALETTE } from '../src/adventure/WorldAssets';
import { WorldArt } from '../src/adventure/WorldArt';
import { WorldGame } from '../src/adventure/WorldGame';
import { guairaBrowser } from './helpers/guairaLabHarness';

type Draw = { frame: PixelFrame; palette: PixelPalette; x: number; y: number };
function capture(time: number, collected: boolean): Draw {
    let draw!: Draw;
    const context = { globalAlpha: .7, save() {}, restore() {} };
    const atlas = { draw(_c: CanvasRenderingContext2D, frame: PixelFrame, palette: PixelPalette, x: number, y: number) {
        draw = { frame, palette, x, y };
    } };
    drawWorldSeal(context as CanvasRenderingContext2D, atlas as SpriteAtlas, 10.4, 20.4, time, collected);
    assert.equal(context.globalAlpha, .7, 'Painting does not overwrite caller opacity.');
    return draw;
}

test('available seals retain every original frame, palette, anchor and bob phase', () => {
    for (let time = 0; time <= 2560; time += 20) {
        assert.deepEqual(capture(time, false), {
            frame: SEALS[Math.floor(time / 160) % 4], palette: WORLD_PALETTE,
            x: 10.4, y: 20.4 + Math.round(Math.sin(time / 320) * 2)
        });
    }
});

test('earned seals have a static completion shape inside the original 16 by 18 sprite', () => {
    const earned = capture(0, true);
    assert.equal(earned.frame.length, 18);
    assert.ok(earned.frame.every(row => row.length === 16));
    assert.deepEqual(earned.frame.slice(6, 12).map(row => row.slice(4, 12).replace(/[^K]/g, '.')), [
        '......KK', '......KK', 'KK..KK..', 'KK..KK..', '..KK....', '..KK....'
    ]);
    for (let time = 0; time <= 2560; time += 20) assert.deepEqual(capture(time, true), earned);
    assert.notDeepEqual(earned.frame, SEALS[0], 'The status is a shape distinction, not just opacity or color.');
    for (let y = 0; y < 18; y++) for (let x = 0; x < 16; x++)
        assert.equal(earned.frame[y][x] === '_', SEALS[0][y][x] === '_', 'The original silhouette is preserved.');
});

for (const reducedMotion of [false, true])
test(`native seal lifecycle distinguishes earned locations after replay and death, reduced motion ${reducedMotion}`, t => {
    const h = guairaBrowser(t, { reducedMotion });
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    game.load('1-1', false);
    const seal = game.stage.pickups.find(item => item.kind === 'seal')!;
    const sounds: string[] = [];
    t.mock.method(game.audio, 'sfx', (kind: string) => sounds.push(kind));
    const states: Array<{ x: number; y: number; collected: boolean; draw: Draw }> = [];
    let inSeal = false, observedDraw!: Draw;
    const originalDraw = game.art.atlas.draw.bind(game.art.atlas);
    t.mock.method(game.art.atlas, 'draw', (...args: Parameters<SpriteAtlas['draw']>) => {
        if (inSeal) observedDraw = { frame: args[1], palette: args[2], x: args[3], y: args[4] };
        originalDraw(...args);
    });
    const original = WorldArt.prototype.seal;
    t.mock.method(game.art, 'seal', function(this: WorldArt, c: CanvasRenderingContext2D, x: number, y: number, time: number, collected = false) {
        inSeal = true;
        original.call(this, c, x, y, time, collected);
        inSeal = false;
        states.push({ x, y, collected, draw: observedDraw });
    });
    const positionAtSeal = () => {
        game.player.data.position = { x: seal.x, y: seal.y };
        game.player.data.velocity = { x: 0, y: 0 };
        game.camera.x = seal.x - 152;
        game.camera.y = seal.y - 88;
    };
    function renderedSeal(expected: boolean | null) {
        states.length = 0;
        const state = JSON.stringify({ save: game.store.save, player: game.player.data, camera: game.camera });
        const soundCount = sounds.length;
        game.render(); game.render();
        assert.equal(JSON.stringify({ save: game.store.save, player: game.player.data, camera: game.camera }), state);
        assert.equal(sounds.length, soundCount, 'Rendering never replays collection audio.');
        const calls = states.filter(s => s.x === seal.x - Math.round(game.camera.x));
        if (expected === null) assert.equal(calls.length, 0, 'Just-collected seal disappears for this attempt.');
        else {
            assert.equal(calls.length, 2);
            assert.ok(calls.every(s => s.collected === expected));
            const expectedDraw = capture(game.time, expected);
            assert.deepEqual(calls[0].draw, { ...expectedDraw, x: calls[0].x,
                y: calls[0].y + (expected ? 0 : Math.round(Math.sin(game.time / 320) * 2)) });
        }
    }
    positionAtSeal(); renderedSeal(false);
    game.update(1000 / 60);
    assert.ok(game.store.save.seals.includes(seal.id));
    renderedSeal(null);
    game.load('1-1', false); positionAtSeal(); renderedSeal(true);
    game.update(1000 / 60);
    assert.equal(game.store.save.seals.filter(id => id === seal.id).length, 1);
    assert.equal(sounds.filter(kind => kind === 'seal').length, 1);
    game.player.die('fall');
    for (let i = 0; i < 160; i++) game.update(1000 / 60);
    assert.equal(game.player.data.isDead, false);
    positionAtSeal(); renderedSeal(true);
    assert.equal(game.store.save.seals.filter(id => id === seal.id).length, 1);
});
