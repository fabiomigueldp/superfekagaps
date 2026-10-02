import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { Renderer } from '../src/engine/Renderer';
import { STAGES, ISLANDS } from '../src/adventure/campaign';
import { GuairaAscent, GUAIRA_ASCENT as G, guairaAscentStage } from '../src/adventure/experimental/guaira/GuairaAscent';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';
import { Canvas } from './helpers/guairaLabHarness';
import recording from './helpers/guairaAscentReplay.json';

const snapshot = (g: GuairaAscent) => structuredClone({ player: g.player.data,
    objects: g.objects, time: g.time, elapsed: g.elapsed, finished: g.finished, camera: g.camera });
const feet = (g: GuairaAscent) => g.player.data.position.y + g.player.data.height;

function replay(h: ReturnType<typeof guairaAscentBrowser>, game: GuairaAscent, touch = false, stopAtCheckpoint = false) {
    let frame = 0, plankFrames = 0, liftFrames = 0;
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        if (touch) {
            const touches = keys.map((key, i) => ({ identifier: i + 1, target: h.canvas,
                clientX: (key === 'ArrowRight' ? .22 : .93) * 640, clientY: 330 }));
            h.canvas.dispatch('touchstart', { touches });
        } else h.keys(keys);
        for (let n = 0; n < count; n++, frame++) {
            game.update(recording.stepMs);
            assert.equal(game.player.data.isDead, false, `alive at ${frame}`);
            assert.equal(game.player.data.hasHelmet, true, `no damage at ${frame}`);
            if (game.player.data.isGrounded) {
                for (const b of game.objects.bodies) if (Math.abs(feet(game) - b.y) < .001 &&
                    game.player.data.position.x >= b.x && game.player.data.position.x + game.player.data.width <= b.x + b.width) {
                    if (b.id === G.plankId) plankFrames++;
                    else liftFrames++;
                }
            }
            // Native 320×180 framing shows the receiving bank before disembark,
            // and the upper terrace before the final lift jump.
            if (frame === 299) assert.ok(game.camera.x < 400 && game.camera.x + 320 > 512);
            if (frame === 783) {
                assert.ok(game.camera.x < 710 && game.camera.x + 320 > 784);
                assert.ok(G.terraceY - game.camera.y > 23 && G.terraceY - game.camera.y < 150);
            }
            if (stopAtCheckpoint && game.store.save.checkpoint) { h.keys([]); return frame; }
        }
    }
    assert.ok(plankFrames > 150); assert.ok(liftFrames > 150);
    assert.equal(frame, recording.frames);
    return frame;
}

test('isolated ascent clones authored stage and uses native player/input/renderer without storage or campaign expansion', t => {
    const h = guairaAscentBrowser(t), before = structuredClone(STAGES), worlds = structuredClone(ISLANDS), game = h.create();
    assert.ok(game.player instanceof Player); assert.ok(game.input instanceof Input); assert.ok(game.renderer instanceof Renderer);
    assert.equal(game.stage.id, G.id); assert.equal(game.boss, null); assert.deepEqual(game.stage.exits, []);
    assert.deepEqual(game.stage.foes, []); assert.equal(game.stage.level.width, 64); assert.equal(game.stage.level.height, 25);
    assert.equal(game.player.data.position.x, 48); assert.equal(feet(game), 304);
    assert.deepEqual(game.objects.bodies.map(b => [b.kind, b.x, b.y, b.width, b.height]), [['platform',240,304,80,8],['lift',672,304,80,8]]);
    const changed = guairaAscentStage(); changed.level.tiles[19][0] = 0;
    assert.notEqual(guairaAscentStage().level.tiles[19][0], 0);
    game.render(); assert.ok(h.canvas.drawCalls > 0);
    assert.deepEqual(STAGES, before); assert.deepEqual(ISLANDS, worlds); assert.equal(ISLANDS.length, 6);
    assert.equal(game.mapReturnHref, './guaira.html?at=corral');
});

for (const touch of [false, true]) test(`${touch ? 'native touch' : 'keyboard'} completes both vehicles and checkpoint without run/pound/coins`, t => {
    const h = guairaAscentBrowser(t, { touch }), game = h.create();
    let completions = 0;
    (game as unknown as { complete(): void }).complete = () => { completions++; };
    replay(h, game, touch);
    assert.equal(game.finished, true); assert.equal(game.coins, 0); assert.equal(game.store.save.checkpoint?.index, 0);
    assert.equal(feet(game), G.terraceY); assert.equal(game.player.data.velocity.x, 0);
    assert.equal(game.mapReturnHref, './guaira.html?at=vazao&visit=ascent-clear');
    assert.deepEqual(game.store.save.completed, []); assert.deepEqual(game.store.save.times, {}); assert.equal(completions, 0);
    const finished = snapshot(game); h.run(game, 90, ['ArrowRight', 'Space']); game.render();
    assert.deepEqual(game.player.data.position, finished.player.position); assert.equal(game.elapsed, finished.elapsed);
    assert.deepEqual(structuredClone(game.objects), finished.objects); assert.match(h.status.textContent, /ramal do bairro segue fechado/);
});

test('standing still stays carried on each native moving body for two whole cycles', t => {
    const h = guairaAscentBrowser(t), game = h.create();
    for (const id of [G.plankId, G.liftId]) {
        h.keys([]); game.load(G.id);
        const b = game.objects.get(id)!, p = game.player.data;
        p.position = { x: b.x + 34, y: b.y - p.height }; p.isGrounded = true;
        for (let i = 0; i < 1200; i++) {
            h.run(game, 1);
            assert.ok(Math.abs(p.position.x - b.x - 34) < .00001, `${id}: no horizontal drift at ${i}`);
            assert.ok(Math.abs(feet(game) - b.y) < .00001, `${id}: feet match at ${i}`);
            assert.equal(p.isGrounded, true); assert.equal(p.isDead, false);
        }
    }
});

for (const id of [G.plankId, G.liftId]) for (const direction of ['ArrowLeft', 'ArrowRight'])
    test(`${id}: walking off ${direction} recovers on the dry path with ordinary jumps`, t => {
        const h = guairaAscentBrowser(t), game = h.create(); h.run(game, 300);
        const b = game.objects.get(id)!, p = game.player.data, lift = id === G.liftId;
        // Begin a focused fall from a supported vehicle. All falling/recovery motion is native Input/Player.
        p.position = { x: b.x + 34, y: b.y - p.height }; p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
        h.run(game, lift && direction === 'ArrowLeft' ? 22 : 40, [direction]); h.run(game, 70);
        assert.ok(feet(game) >= 336); assert.equal(p.isDead, false); assert.equal(p.hasHelmet, true);
        const target = lift ? 680 : 264;
        for (let n = 0; n < 200 && p.position.x > target; n++) h.run(game, 1, ['ArrowLeft']);
        h.run(game, 20); h.run(game, 30, ['Space']); h.run(game, 30);
        assert.ok(feet(game) <= 336, 'a recovery step or returning deck catches the jump');
        h.run(game, 36, ['ArrowLeft', 'Space']); h.run(game, 30);
        assert.equal(feet(game), 304); assert.equal(p.isGrounded, true); assert.equal(p.isDead, false);
        assert.ok(p.position.x < (lift ? 656 : 224));
        if (lift) assert.ok(p.position.x >= 496, 'second recovery stays on checkpoint bank');
    });

test('native death before/after checkpoint resets vehicle clocks; whole retry also clears checkpoint and completion', t => {
    const h = guairaAscentBrowser(t), game = h.create();
    for (const checkpoint of [false, true]) {
        h.keys([]); game.load(G.id);
        if (checkpoint) replay(h, game, false, true); else h.run(game, 120);
        const previous = game.player; previous.die('fall');
        for (let n = 0; n < 180 && previous === game.player; n++) h.run(game, 1);
        assert.notEqual(game.player, previous); assert.equal(game.player.data.position.x, checkpoint ? 528 : 48);
        assert.equal(game.player.data.isDead, false); assert.equal(game.objects.time, 0);
        assert.equal(game.objects.get(G.plankId)!.x, 240); assert.equal(game.objects.get(G.liftId)!.y, 304);
        assert.equal(game.finished, false); assert.equal(game.mapReturnHref, './guaira.html?at=corral');
        assert.equal(game.store.save.checkpoint?.index, checkpoint ? 0 : undefined);
    }
    for (let n = 0; n < 3; n++) {
        h.keys([]); game.load(G.id); replay(h, game); assert.equal(game.finished, true);
        game.toggleAscentPause(); game.load(G.id);
        assert.equal(game.state, 'playing'); assert.equal(game.finished, false); assert.equal(game.store.save.checkpoint, null);
        assert.equal(game.objects.time, 0); assert.equal(game.player.data.position.x, 48); assert.equal(game.coins, 0);
    }
});

test('pause, focus loss and hidden tab freeze vehicle carry and clear held inputs', t => {
    const h = guairaAscentBrowser(t), game = h.create();
    for (const pause of [() => { h.key('Escape'); h.run(game, 1); }, () => h.pointer(305, 10),
        () => h.window.dispatch('blur'), () => h.hidden(true)]) {
        h.keys([]); game.load(G.id); h.run(game, 25, ['ArrowRight']); pause();
        assert.equal(game.state, 'paused'); const frozen = snapshot(game);
        h.run(game, 90); game.render(); assert.deepEqual(snapshot(game), frozen);
        assert.equal(game.input.getState().right, false);
        h.hidden(false); h.key('Escape', true); assert.equal(game.state, 'paused');
        h.key('Escape'); h.run(game, 1); assert.equal(game.state, 'playing');
    }
});

test('completion requires grounded terrace and stays idle through pause/resume', t => {
    const h = guairaAscentBrowser(t), game = h.create();
    game.player.data.position = { x: 944, y: 60 }; game.player.data.isGrounded = false;
    h.run(game, 1); assert.equal(game.finished, false);
    h.keys([]); game.load(G.id); replay(h, game); game.toggleAscentPause();
    const frozen = snapshot(game); h.run(game, 60); assert.deepEqual(snapshot(game), frozen);
    game.toggleAscentPause(); h.run(game, 60, ['ArrowLeft', 'Space']);
    assert.deepEqual(game.player.data.position, frozen.player.position); assert.equal(game.player.data.velocity.x, 0);
});

test('bitmap toolbar is 44px, keyboard safe, repeatable and has explicit map anchors before/after completion', async t => {
    const h = guairaAscentBrowser(t); await import('../src/guaira-subida');
    const game = h.window.worldGame as GuairaAscent;
    for (const [control, name] of [[h.pause,'Pausar'],[h.retry,'Recomeçar subida'],[h.exit,'Voltar ao mapa de Guaíra']] as const) {
        assert.equal(control.getAttribute('aria-label'), name); assert.ok(control.children[0] instanceof Canvas);
        assert.equal((control.children[0] as Canvas).height, 44);
        for (const [key,code] of [[' ','Space'],['Enter','Enter']]) {
            game.input.reset(); assert.equal(h.window.dispatch('keydown', { key, code, target: control }), false);
            game.input.update(); assert.equal(game.input.getState().jumpPressed, false);
            h.window.dispatch('keyup', { key, code, target: control });
        }
    }
    assert.equal(h.exit.getAttribute('href'), './guaira.html?at=corral');
    replay(h, game, false, true); h.frame();
    assert.equal(game.finished, false); assert.equal(h.exit.getAttribute('href'), './guaira.html?at=corral', 'a checkpoint is not a completed visit');
    h.retry.dispatch('click');
    const exitArt = h.exit.children[0] as Canvas, mapWidth = exitArt.width;
    replay(h, game);
    assert.equal(h.exit.dispatch('click'), false, 'return activation reads a completion before RAF');
    assert.equal(h.exit.getAttribute('href'), './guaira.html?at=vazao&visit=ascent-clear'); h.frame();
    assert.equal(h.exit.getAttribute('aria-label'), 'Voltar à Casa da Vazão no mapa');
    assert.equal(h.exit.textContent, 'Voltar à Casa da Vazão no mapa');
    assert.equal(h.exit.title, 'Voltar à Casa da Vazão no mapa');
    assert.equal(h.exit.children[0], exitArt); assert.equal(exitArt.width, mapWidth);
    assert.match(h.status.textContent, /CASA volta ao mapa/);
    assert.match(h.status.textContent, /Prefeito: encontro opcional para reabrir a água/);
    h.pause.dispatch('click'); h.frame(); assert.equal(game.state, 'paused'); assert.equal(h.pause.getAttribute('aria-label'), 'Continuar');
    assert.equal(h.exit.getAttribute('href'), './guaira.html?at=vazao&visit=ascent-clear');
    assert.equal(h.exit.getAttribute('aria-label'), 'Voltar à Casa da Vazão no mapa');
    assert.equal(h.exit.dispatch('click'), false);
    const controlsWidth = [h.pause, h.retry, h.exit].reduce((sum, control) => sum + (control.children[0] as Canvas).width, 0);
    assert.ok(controlsWidth + 2 * 4 + 2 * 6 <= 320, 'Continuar/Tentar/Casa fit the 320px toolbar');
    h.retry.dispatch('click'); assert.equal(game.finished, false); assert.equal(game.state, 'playing');
    assert.equal(h.exit.getAttribute('href'), './guaira.html?at=corral', 'Retry clears the visit before RAF');
    assert.equal(h.exit.getAttribute('aria-label'), 'Voltar ao mapa de Guaíra');
    assert.equal(h.exit.dispatch('click'), false); h.frame(); assert.equal(h.canvas.focused, true);
    assert.deepEqual(h.storageCalls, []);
    const html = readFileSync(new URL('../guaira-subida.html', import.meta.url), 'utf8');
    assert.match(html, /min-height:44px;min-width:44px/); assert.match(html, /id="lab-exit" href="\.\/guaira.html\?at=corral"/);
    assert.doesNotMatch(html, /traversal-boss|guaira-lab\.html|localStorage/);
    assert.equal(Array.from(html.matchAll(/<(?:button|a)\b/g)).length, 3);
});

test('reduced motion removes cosmetic landing dust and shake while required vehicles still move', t => {
    const h = guairaAscentBrowser(t, { reducedMotion: true }), game = h.create();
    assert.equal(game.reducedMotion, true); assert.equal(game.store.save.preferences.shake, false);
    h.run(game, 30, ['Space']); h.run(game, 30);
    assert.equal((game as unknown as { sparks: unknown[] }).sparks.length, 0);
    assert.ok(game.objects.get(G.plankId)!.x > 240); assert.ok(game.objects.get(G.liftId)!.y < 304);
    game.render(); assert.ok(h.canvas.drawCalls > 0);
});

test('touch cancellation clears held movement/jump before a new boarding attempt', t => {
    const h = guairaAscentBrowser(t, { touch: true }), game = h.create();
    const right = { identifier: 1, clientX: .22 * 640, clientY: 330, target: h.canvas };
    const jump = { identifier: 2, clientX: .93 * 640, clientY: 330, target: h.canvas };
    h.canvas.dispatch('touchstart', { touches: [right, jump] }); h.run(game, 1);
    assert.ok(game.player.data.velocity.x > 0); assert.ok(game.player.data.velocity.y < 0);
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [right, jump] }); h.run(game, 1);
    assert.equal(game.input.getState().right, false); assert.equal(game.input.getState().jump, false);
    h.window.dispatch('blur'); game.load(G.id); h.run(game, 2);
    assert.equal(game.player.data.position.x, 48); assert.equal(feet(game), 304);
});
