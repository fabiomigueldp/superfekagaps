import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldGame } from '../src/adventure/WorldGame';
import { drawGuairaCoinReadout } from '../src/adventure/experimental/guaira/GuairaCoinReadout';
import { pixelText, textWidth } from '../src/graphics/BitmapFont';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';
import { guairaRespirosBrowser } from './helpers/guairaRespirosHarness';

type Pixel = [number, number, string];
function textPixels(label: string) {
    const pixels: Pixel[] = [];
    const c = { fillStyle: '', fillRect(x: number, y: number) { pixels.push([x, y, this.fillStyle]); } };
    pixelText(c as unknown as CanvasRenderingContext2D, label, 202, 8, '#f5cf82');
    return pixels;
}

test('attempt-only readout is bounded, sanitized, static and restores painter state', () => {
    for (const [coins, label] of [[0, '0'], [1, '1'], [17, '17'], [2.9, '2'], [99, '99'],
        [100, '99+'], [Infinity, '0'], [NaN, '0'], [-7, '0']] as const) {
        const pixels: Pixel[] = [], calls: number[][] = [], stack: string[] = [];
        const c = { fillStyle: '#123456',
            save() { stack.push(this.fillStyle); }, restore() { this.fillStyle = stack.pop()!; },
            fillRect(x: number, y: number, width: number, height: number) {
                assert.equal(width, 1); assert.equal(height, 1);
                pixels.push([x, y, this.fillStyle]);
            } };
        drawGuairaCoinReadout(c as unknown as CanvasRenderingContext2D, {
            drawCoin(x, y, time) { calls.push([x, y, time]); }
        }, coins);
        assert.deepEqual(calls, [[184, 4, 0]], 'native sprite always uses the still frame');
        assert.deepEqual(pixels, textPixels(`${label} NO TRECHO`));
        assert.ok(pixels.every(([x, y]) => x >= 202 && x < 279 && y >= 8 && y < 15));
        assert.equal(c.fillStyle, '#123456'); assert.equal(stack.length, 0);
    }
    for (const [x, label] of [[57, 'TRAVESSIA DE SERVICO'], [57, 'PRANCHA DE INSPECAO'],
        [57, 'RUA DA VALA SECA'], [69, 'ESPERE A AGUA BAIXAR']] as const)
        assert.ok(x + textWidth(label) < 184, 'scene title must not reach the coin slot');
});

/** Record actual production HUD pixels after its background has covered the world. */
function observeReadout(game: WorldGame) {
    game.render(); // The scene overlays its HUD on the composited native frame.
    const c = game.renderer.getContext(), original = c.fillRect.bind(c);
    const pixels = new Map<string, string>(), sprites: number[][] = [];
    c.fillRect = (x, y, w, h) => {
        for (let yy = Math.max(8, Math.ceil(y)); yy < Math.min(15, y + h); yy++)
            for (let xx = Math.max(202, Math.ceil(x)); xx < Math.min(279, x + w); xx++)
                pixels.set(`${xx},${yy}`, String(c.fillStyle));
        original(x, y, w, h);
    };
    const drawCoin = game.renderer.drawCoin.bind(game.renderer);
    game.renderer.drawCoin = (x, y, time, context) => {
        if (x === 184 && y === 4) sprites.push([x, y, time]);
        drawCoin(x, y, time, context);
    };
    return () => {
        pixels.clear(); sprites.length = 0;
        const before = JSON.stringify({ player: game.player.data, objects: game.objects, camera: game.camera,
            coins: game.coins, time: game.time, elapsed: game.elapsed, save: game.store.save, audio: game.audio.enabled });
        game.render();
        assert.equal(JSON.stringify({ player: game.player.data, objects: game.objects, camera: game.camera,
            coins: game.coins, time: game.time, elapsed: game.elapsed, save: game.store.save, audio: game.audio.enabled }), before);
        assert.deepEqual(sprites[sprites.length - 1], [184, 4, 0]);
        const expected = new Set(textPixels(`${game.coins} NO TRECHO`).map(([x, y]) => `${x},${y}`));
        const actual = new Set([...pixels].filter(([, color]) => color === '#f5cf82').map(([key]) => key));
        assert.deepEqual(actual, expected, 'visible glyphs equal the current native attempt ledger');
    };
}

for (const [scene, browser] of [['ascent', guairaAscentBrowser], ['traversal', guairaTraversalBrowser],
    ['respiros', guairaRespirosBrowser]] as const) for (const reducedMotion of [false, true])
    test(`${scene}: muted ${reducedMotion ? 'reduced-motion' : 'ordinary'} pickup, pause, death and retry show the native ledger`, t => {
        const h = browser(t, { reducedMotion }), game = h.create(); game.audio.enabled = false;
        const verify = observeReadout(game);
        verify(); assert.equal(game.coins, 0);
        // Focused contact fixture only; real WorldGame awards the pickup.
        const coin = game.stage.pickups.find(item => item.kind === 'coin')!;
        game.player.data.position = { x: coin.x, y: coin.y };
        game.player.data.velocity = { x: 0, y: 0 }; game.player.data.isGrounded = false;
        game.update(1000 / 60);
        assert.equal(game.coins, 1); verify(); verify();
        assert.equal(game.audio.enabled, false); assert.equal(game.finished, false);
        h.key('Escape'); game.update(1000 / 60);
        assert.equal(game.state, 'paused'); game.update(250); verify();
        h.key('Escape'); game.update(1000 / 60); assert.equal(game.state, 'playing');
        const player = game.player; player.die('fall');
        for (let frame = 0; frame < 180 && game.player === player; frame++) game.update(1000 / 60);
        assert.notEqual(game.player, player); assert.equal(game.coins, 1); verify();
        game.load(game.stage.id); assert.equal(game.coins, 0); verify();
        assert.deepEqual(game.store.save.completed, []);
        assert.deepEqual(h.storageCalls, []);
    });
