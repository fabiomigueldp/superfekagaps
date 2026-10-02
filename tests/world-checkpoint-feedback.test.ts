import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { SAVE_KEY } from '../src/adventure/progress';
import { guairaTraversalStage } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { fitText, pixelText, textWidth } from '../src/graphics/BitmapFont';
import { ART } from '../src/graphics/palette';
import { guairaBrowser } from './helpers/guairaLabHarness';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';

function reachCheckpoint(game: WorldGame) {
    const cp = game.stage.checkpoints[0], p = game.player.data;
    p.position = { x: cp.x * 16, y: cp.y * 16 - p.height };
    p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
    game.update(1000 / 60);
    assert.equal(game.store.save.checkpoint?.index, 0);
}

for (const ephemeral of [false, true]) test(`${ephemeral ? 'ephemeral' : 'campaign'} checkpoint feedback matches its actual lifetime and fits the native panel`, t => {
    const h = guairaBrowser(t), data = new Map<string, string>();
    let storageAccesses = 0;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() {
        storageAccesses++;
        return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) };
    } });
    const canvas = h.canvas as unknown as HTMLCanvasElement;
    const game = new WorldGame(canvas, ephemeral), stage = guairaTraversalStage();
    stage.id = '1-1';
    game.load(stage.id, false, stage);
    reachCheckpoint(game);
    const feedback = game as unknown as { toast: string; toastTimer: number };
    const expected = ephemeral ? 'PONTO SEGURO NESTA TENTATIVA' : 'CAMINHO GUARDADO';
    assert.equal(feedback.toast, expected);
    assert.equal(feedback.toastTimer, 1500);
    assert.ok(textWidth(expected) <= 238);
    assert.equal(fitText(expected, 238), expected, 'The full lifetime qualifier must survive the bitmap fit.');

    // Capture the real render to verify that the complete phrase is drawn inside
    // the existing 250 px panel, not merely stored in the toast field.
    const context = game.renderer.getContext(), pixels: number[][] = [];
    const fill = context.fillRect.bind(context);
    t.mock.method(context, 'fillRect', (x: number, y: number, w: number, h: number) => {
        if (context.fillStyle === ART.goldLight && y >= 35 && y <= 41) pixels.push([x, y, w, h]);
        fill(x, y, w, h);
    });
    game.render();
    const expectedPixels: number[][] = [];
    pixelText({ fillRect: (...rect: number[]) => expectedPixels.push(rect) } as unknown as CanvasRenderingContext2D,
        expected, 160, 35, ART.goldLight, 1, 'center');
    const start = pixels.findIndex(rect => rect.every((value, i) => value === expectedPixels[0][i]));
    assert.ok(start >= 0);
    assert.deepEqual(pixels.slice(start, start + expectedPixels.length), expectedPixels);
    assert.ok(expectedPixels.every(([x, y, w, height]) => x >= 41 && x + w <= 279 && y >= 31 && y + height <= 46));

    const reentered = new WorldGame(canvas, ephemeral);
    assert.deepEqual(reentered.store.save.checkpoint, ephemeral ? null : game.store.save.checkpoint);
    reentered.load(stage.id, true, stage);
    assert.equal(reentered.player.data.position.x, (ephemeral ? stage.level.playerSpawn.x : stage.checkpoints[0].x) * 16);
    assert.equal(data.has(SAVE_KEY), !ephemeral);
    assert.equal(storageAccesses, ephemeral ? 0 : 2);
});

for (const [scene, browser] of [['travessia', guairaTraversalBrowser], ['subida', guairaAscentBrowser]] as const)
    test(`${scene} status explains the attempt-only safe point and resetting when reentering`, t => {
        const h = browser(t), game = h.create();
        reachCheckpoint(game); game.render();
        assert.match(h.status.textContent, /ponto seguro.*nesta tentativa/i);
        assert.match(h.status.textContent, new RegExp(`sair e reentrar reinicia a ${scene}`));
        game.player.die('fall'); game.render();
        assert.match(h.status.textContent, /retorno automático ao ponto seguro desta tentativa/i);
        const reentered = h.create();
        assert.equal(reentered.store.save.checkpoint, null);
        assert.equal(reentered.player.data.position.x, reentered.stage.level.playerSpawn.x * 16);
    });
