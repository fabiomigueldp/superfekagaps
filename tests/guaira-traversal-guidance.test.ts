import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { GuairaTraversal, GUAIRA_TRAVERSAL as G } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { loadGuairaChapterScene } from '../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';
import { pixelText, textWidth } from '../src/graphics/BitmapFont';

/** Observe the real overlay painter; retain native input, actor, camera and world. */
function watchOverlay(t: TestContext, game: GuairaTraversal) {
    game.render();
    const c = game.renderer.getContext(), calls: Array<[number, number, number, number, string]> = [];
    const original = c.fillRect.bind(c);
    t.mock.method(c, 'fillRect', (x: number, y: number, w: number, h: number) => {
        calls.push([x, y, w, h, c.fillStyle as string]); original(x, y, w, h);
    });
    return () => {
        calls.length = 0;
        const snapshot = () => structuredClone({ player: game.player.data, camera: game.camera, objects: game.objects,
            time: game.time, elapsed: game.elapsed, state: game.state, finished: game.finished, save: game.store.save });
        const before = snapshot(); game.render(); assert.deepEqual(snapshot(), before, 'painting cannot change the run');
        return { calls: [...calls], valveBanner: calls.some(([x, y, w, h]) => x === 44 && y === 31 && w === 236 && h === 19) };
    };
}

for (const reducedMotion of [false, true]) test(`native held jump clears the banner and its shadow, then restores guidance (reduced motion: ${reducedMotion})`, t => {
    const h = guairaTraversalBrowser(t, { reducedMotion }), game = h.create(), paint = watchOverlay(t, game);
    h.run(game, 92, ['ArrowRight', 'ShiftLeft']); h.run(game, 12);
    assert.equal(paint().valveBanner, true);
    assert.ok(textWidth('PULE. NO AR, APERTE BAIXO') <= 232, 'ordered instruction fits inside the native panel');
    const expected = new Map([[7, true], [8, false], [9, false], [17, false], [22, false], [29, false], [30, true], [45, true]]);
    for (let frame = 1; frame <= 45; frame++) {
        h.run(game, 1, ['Space']);
        if (!expected.has(frame)) continue;
        assert.equal(paint().valveBanner, expected.get(frame), `jump frame ${frame}`);
        assert.equal(h.status.textContent, 'Pule primeiro. No ar, aperte baixo sobre a placa; espere a ponte subir');
        assert.ok(!game.player.data.isDead && game.player.data.hasHelmet);
        assert.equal(game.objects.get(G.valveId)!.active, false, 'jump alone cannot open the valve');
    }
    assert.equal(game.player.data.isGrounded, true);
    // A second ordinary gesture still gets the same actor clearance.
    h.run(game, 16); h.run(game, 17, ['Space']); assert.equal(paint().valveBanner, false);
    game.toggleTraversalPause(); assert.equal(paint().valveBanner, false); assert.match(h.status.textContent, /Pausado/);
    game.toggleTraversalPause(); assert.equal(paint().valveBanner, false); assert.match(h.status.textContent, /Pule.*baixo/);
    h.run(game, 1, ['ArrowDown']); assert.equal(game.player.isGroundPoundActive(), true);
    h.run(game, 50); assert.equal(game.objects.get(G.valveId)!.active, true);
    assert.equal(paint().valveBanner, true); assert.match(h.status.textContent, /ponte está subindo/);
    h.run(game, 150); assert.equal(game.bridgeReady, true);
    assert.equal(paint().valveBanner, true); assert.match(h.status.textContent, /Ponte pronta/);
    h.run(game, 17, ['Space']); assert.equal(paint().valveBanner, false);
    assert.match(h.status.textContent, /Ponte pronta/);
});

test('compact touch jump keeps page instruction while the physical actor passes the banner', t => {
    const h = guairaTraversalBrowser(t, { touch: true }), game = h.create(), paint = watchOverlay(t, game);
    h.run(game, 92, ['ArrowRight', 'ShiftLeft']); h.run(game, 12);
    h.canvas.dispatch('touchstart', { touches: [{ identifier: 1, clientX: .93 * 640, clientY: 330, target: h.canvas }] });
    for (let frame = 0; frame < 17; frame++) game.update(1000 / 60);
    assert.equal(game.player.data.isGrounded, false); assert.equal(paint().valveBanner, false);
    assert.equal(h.status.textContent, 'Pule primeiro. No ar, aperte baixo sobre a placa; espere a ponte subir');
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [] });
    h.run(game, 60); assert.equal(game.player.data.isGrounded, true); assert.equal(paint().valveBanner, true);
});

for (const chapter of [false, true]) test(`native completed route retains ${chapter ? 'chapter' : 'free-lab'} continuation copy`, async t => {
    const h = guairaTraversalBrowser(t);
    const game = chapter ? (await loadGuairaChapterScene('guaira-travessia'))(
        h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement).game as GuairaTraversal : h.create();
    const paint = watchOverlay(t, game);
    const replay = JSON.parse(readFileSync(new URL('./helpers/guairaTraversalReplay.json', import.meta.url), 'utf8')) as { runs: Array<[number, string[]]> };
    for (const [count, keys] of replay.runs) h.run(game, count, keys);
    assert.equal(game.finished, true); assert.equal(game.canAdvanceToBoss, true);
    const { calls, valveBanner } = paint(); assert.equal(valveBanner, false);
    const expected: Array<[number, number, number, number, string]> = [];
    const context = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { expected.push([x, y, w, h, this.fillStyle]); } };
    pixelText(context as unknown as CanvasRenderingContext2D, chapter ? 'CONTINUAR: VER OS RESPIROS' : 'CURRAL: ENFRENTE OSSABRAVO', 160, 65, '#edcaf5', 1, 'center');
    assert.deepEqual(calls.filter(([,,,,color]) => color === '#edcaf5'), expected);
    assert.match(h.status.textContent, /Travessia concluída/);
    game.toggleTraversalPause(); paint(); assert.equal(game.canAdvanceToBoss, false); assert.match(h.status.textContent, /Pausado/);
    game.toggleTraversalPause(); assert.deepEqual(paint().calls.filter(([,,,,color]) => color === '#edcaf5'), expected);
});
