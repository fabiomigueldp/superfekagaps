import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { freshSave, SAVE_KEY } from '../src/adventure/progress';
import { guairaTraversalStage } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { fitText, pixelText } from '../src/graphics/BitmapFont';
import { ART } from '../src/graphics/palette';
import { guairaBrowser } from './helpers/guairaLabHarness';

function reachCheckpoint(game: WorldGame, index = 0) {
    const cp = game.stage.checkpoints[index], p = game.player.data;
    p.position = { x: cp.x * 16, y: cp.y * 16 - p.height };
    p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
    game.update(1000 / 60);
    assert.equal(game.store.save.checkpoint?.index, index);
}

for (const failure of ['quota', 'read', 'unavailable', 'corrupt'] as const)
test(`campaign checkpoint reports session-only after ${failure} storage failure without losing its retry`, t => {
    const h = guairaBrowser(t), original = failure === 'corrupt' ? '{broken' : JSON.stringify(freshSave());
    let raw = original, writes = 0, reads = 0;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() {
        if (failure === 'unavailable') throw Error('Storage unavailable');
        return {
            getItem: () => { if (failure === 'read' && reads++ > 0) throw Error('Read unavailable'); return raw; },
            setItem: (key: string, value: string) => {
                assert.equal(key, SAVE_KEY);
                if (failure === 'quota') throw Error('QuotaExceededError');
                writes++; raw = value;
            }
        };
    } });
    const canvas = h.canvas as unknown as HTMLCanvasElement, game = new WorldGame(canvas), stage = guairaTraversalStage();
    stage.id = '1-1'; game.load(stage.id, false, stage);
    reachCheckpoint(game);
    const feedback = game as unknown as { toast: string; toastTimer: number };
    const expected = 'PONTO SEGURO SÓ NESTA SESSÃO';
    assert.equal(feedback.toast, expected, 'A failed write must not claim the checkpoint was saved.');
    assert.equal(feedback.toastTimer, 4000);
    assert.ok(game.store.warning); assert.equal(raw, original); assert.equal(writes, 0);
    assert.equal(fitText(expected, 238), expected);

    const context = game.renderer.getContext(), pixels: number[][] = [];
    const fill = context.fillRect.bind(context);
    t.mock.method(context, 'fillRect', (x: number, y: number, w: number, height: number) => {
        if (context.fillStyle === ART.goldLight && y >= 33 && y <= 41) pixels.push([x, y, w, height]);
        fill(x, y, w, height);
    });
    game.render();
    const expectedPixels: number[][] = [];
    pixelText({ fillRect: (...rect: number[]) => expectedPixels.push(rect) } as unknown as CanvasRenderingContext2D,
        expected, 160, 35, ART.goldLight, 1, 'center');
    const start = pixels.findIndex(rect => rect.every((value, i) => value === expectedPixels[0][i]));
    assert.ok(start >= 0); assert.deepEqual(pixels.slice(start, start + expectedPixels.length), expectedPixels);
    assert.ok(expectedPixels.every(([x, y, w, height]) => x >= 41 && x + w <= 279 && y >= 31 && y + height <= 46));

    const player = game.player;
    player.die('fall');
    for (let frame = 0; frame < 240 && game.player === player; frame++) game.update(1000 / 60);
    assert.notEqual(game.player, player, 'The real death flow still returns to the session checkpoint.');
    assert.equal(game.player.data.position.x, stage.checkpoints[0].x * 16);
    assert.equal(game.store.save.checkpoint?.index, 0);
    const reentered = new WorldGame(canvas); reentered.load(stage.id, true, stage);
    assert.equal(reentered.store.save.checkpoint, null);
    assert.equal(reentered.player.data.position.x, stage.level.playerSpawn.x * 16);
    assert.equal(raw, original); assert.equal(writes, 0);
});

test('the next checkpoint reports durable storage again after a refused write recovers', t => {
    const h = guairaBrowser(t);
    let raw = JSON.stringify(freshSave()), unavailable = true;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: () => raw,
        setItem: (_key: string, value: string) => { if (unavailable) throw Error('QuotaExceededError'); raw = value; }
    } });
    const canvas = h.canvas as unknown as HTMLCanvasElement, game = new WorldGame(canvas), stage = guairaTraversalStage();
    stage.id = '1-1'; game.load(stage.id, false, stage);
    reachCheckpoint(game);
    assert.equal((game as unknown as { toast: string }).toast, 'PONTO SEGURO SÓ NESTA SESSÃO');
    unavailable = false; reachCheckpoint(game, 1);
    assert.equal((game as unknown as { toast: string }).toast, 'CAMINHO GUARDADO');
    assert.equal((game as unknown as { toastTimer: number }).toastTimer, 1500);
    assert.equal(game.store.warning, '');
    const reentered = new WorldGame(canvas); reentered.load(stage.id, true, stage);
    assert.equal(reentered.store.save.checkpoint?.index, 1);
    assert.equal(reentered.player.data.position.x, stage.checkpoints[1].x * 16);
});
