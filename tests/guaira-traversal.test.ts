import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { Renderer } from '../src/engine/Renderer';
import { STAGES, ISLANDS } from '../src/adventure/campaign';
import { GuairaTraversal, GUAIRA_TRAVERSAL as G, guairaTraversalStage } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';
import { Canvas } from './helpers/guairaLabHarness';

const recording = JSON.parse(readFileSync(new URL('./helpers/guairaTraversalReplay.json', import.meta.url), 'utf8')) as {
    stepMs: number; frames: number; runs: Array<[number, string[]]>;
};
const snapshot = (game: GuairaTraversal) => structuredClone({ player: game.player.data,
    objects: game.objects, time: game.time, elapsed: game.elapsed, finished: game.finished });

function replay(h: ReturnType<typeof guairaTraversalBrowser>, game: GuairaTraversal, stopAtCheckpoint = false) {
    let frame = 0, sawJump = false, sawPound = false, sawValve = false, sawLiftMotion = false, sawCheckpoint = false;
    for (const [count, keys] of recording.runs) {
        h.keys(keys);
        for (let n = 0; n < count; n++, frame++) {
            game.update(recording.stepMs);
            const p = game.player.data, bridge = game.objects.get(G.bridgeId)!;
            assert.equal(p.isDead, false, `No death at frame ${frame}`);
            assert.equal(p.hasHelmet, true, `Helmet intact at frame ${frame}`);
            sawJump ||= p.velocity.y < 0;
            sawPound ||= game.player.isGroundPoundActive();
            sawValve ||= game.objects.get(G.valveId)!.active;
            sawLiftMotion ||= bridge.active && bridge.y > G.floor && bridge.y < 336;
            sawCheckpoint ||= game.store.save.checkpoint?.index === 0;
            if (stopAtCheckpoint && sawCheckpoint) { h.keys([]); return { frame, sawJump, sawPound, sawValve, sawLiftMotion, sawCheckpoint }; }
        }
    }
    return { frame, sawJump, sawPound, sawValve, sawLiftMotion, sawCheckpoint };
}

test('local traversal uses real engine and independent cloned stage without campaign expansion', t => {
    const h = guairaTraversalBrowser(t), before = structuredClone(STAGES), worlds = structuredClone(ISLANDS), game = h.create();
    assert.ok(game.player instanceof Player); assert.ok(game.input instanceof Input); assert.ok(game.renderer instanceof Renderer);
    assert.equal(game.stage.id, G.id); assert.equal(game.boss, null); assert.deepEqual(game.stage.exits, []);
    assert.equal(game.stage.level.width, 72); assert.equal(game.stage.level.height, 18);
    assert.equal(game.player.data.position.x, 48); assert.equal(game.player.data.position.y + game.player.data.height,224);
    assert.equal(game.player.data.hasHelmet, true); assert.equal(game.objects.get(G.bridgeId)!.y, 336);
    const changed = guairaTraversalStage(); changed.level.tiles[14][0] = 0;
    assert.notEqual(guairaTraversalStage().level.tiles[14][0], 0);
    game.render(); assert.ok(h.canvas.drawCalls > 0);
    assert.deepEqual(STAGES, before); assert.deepEqual(ISLANDS, worlds); assert.equal(ISLANDS.length, 6);
});

test('frozen keyboard replay solves valve, crosses bridge, reaches checkpoint and completes without campaign finish', t => {
    const h = guairaTraversalBrowser(t), game = h.create();
    let campaignCompletions = 0;
    (game as unknown as { complete(): void }).complete = () => { campaignCompletions++; };
    const go = () => {
        game.load(G.id); h.keys([]);
        const result = replay(h, game);
        assert.equal(result.frame, recording.frames);
        for (const field of ['sawJump', 'sawPound', 'sawValve', 'sawLiftMotion', 'sawCheckpoint'] as const) assert.equal(result[field], true, field);
        assert.equal(game.finished, true); assert.equal(game.bridgeReady, true);
        assert.deepEqual(game.store.save.completed, []); assert.deepEqual(game.store.save.times, {});
        return snapshot(game);
    };
    assert.deepEqual(go(), go()); assert.equal(campaignCompletions, 0);
    const done = snapshot(game); h.run(game, 90, ['ArrowRight', 'Space']); game.render();
    assert.equal(game.elapsed, done.elapsed); assert.ok(game.time > done.time);
    assert.equal(game.player.data.velocity.x, 0); assert.equal(game.player.data.isGrounded, true);
    assert.ok(game.player.data.position.x >= G.finishX && game.player.data.position.x + game.player.data.width < G.width * 16);
    assert.equal(game.player.isGroundPoundActive(), false); assert.equal(campaignCompletions, 0);
    h.keys([]); game.toggleTraversalPause(); const frozen = snapshot(game); h.run(game, 90);
    assert.deepEqual(snapshot(game), frozen); game.toggleTraversalPause(); game.render();
    assert.match(h.status.textContent, /Travessia concluída/);
});

test('ordinary jump leaves valve closed and the lowered bridge cannot be used to bypass the puzzle', t => {
    const h = guairaTraversalBrowser(t), game = h.create();
    h.run(game, 95, ['ArrowRight', 'ShiftLeft']); h.run(game, 45, ['Space']);
    assert.equal(game.objects.get(G.valveId)!.active, false);
    // Sweep take-off frames up to the last coyote-time jump over the lip.
    for (const approach of [103, 105, 107, 109, 111, 113, 115, 117]) {
        h.keys([]); game.load(G.id); h.run(game, approach, ['ArrowRight', 'ShiftLeft']);
        let died = false; h.keys(['ArrowRight', 'ShiftLeft', 'Space']);
        for (let i = 0; i < 100; i++) {
            game.update(1000 / 60);
            assert.ok(game.player.data.position.x < G.pitEnd, `Bypass at take-off frame ${approach}`);
            if (game.player.data.isDead) { died = true; break; }
        }
        assert.equal(died, true, `Fall at take-off frame ${approach}`);
        assert.equal(game.finished, false); assert.equal(game.store.save.checkpoint, null);
        assert.equal(game.objects.get(G.valveId)!.active, false);
    }
});

test('death after checkpoint restores solved sluice and local helmet snapshot; new retry resets all', t => {
    const h = guairaTraversalBrowser(t), game = h.create(); replay(h, game, true);
    assert.equal(game.store.save.checkpoint?.index, 0); const previous = game.player;
    game.player.die('fall');
    for (let i = 0; i < 200 && game.player === previous; i++) h.run(game, 1);
    assert.notEqual(game.player, previous); assert.equal(game.player.data.position.x, G.checkpointX);
    assert.equal(game.objects.get(G.valveId)!.active, true); assert.equal(game.bridgeReady, true);
    assert.equal(game.player.data.hasHelmet, true); assert.equal(game.player.data.isDead, false);
    assert.ok((game.player.data.respawnRevealTimer ?? 0) > 0);
    h.run(game, 140); h.run(game, 140, ['ArrowRight', 'ShiftLeft']); assert.equal(game.finished, true);
    game.load(G.id); assert.equal(game.finished, false); assert.equal(game.player.data.position.x, 48);
    assert.equal(game.store.save.checkpoint, null); assert.equal(game.objects.get(G.valveId)!.active, false);
    assert.equal(game.objects.get(G.bridgeId)!.y, 336); assert.equal(game.coins, 0);
    assert.deepEqual(game.store.save.completed, []);
});

test('death before checkpoint resets valve and ordinary damage uses the existing helmet/death pipeline', t => {
    const h = guairaTraversalBrowser(t), game = h.create();
    game.objects.activate(G.valveId); h.run(game, 150); assert.equal(game.bridgeReady, true);
    assert.deepEqual(game.player.takeDamage(), { damaged: false, helmetUsed: true });
    game.player.data.invincibleTimer = 0;
    (game as unknown as { hurt(x: number): void }).hurt(200);
    const previous = game.player; assert.equal(previous.data.isDead, true);
    for (let i = 0; i < 200 && game.player === previous; i++) h.run(game, 1);
    assert.notEqual(game.player, previous); assert.equal(game.player.data.position.x, 48);
    assert.equal(game.player.data.hasHelmet, true); assert.equal(game.objects.get(G.valveId)!.active, false);
    assert.equal(game.objects.get(G.bridgeId)!.y, 336);
});

test('pause/blur/hidden freezes bridge motion and ignores repeat Escape; reduced motion removes shake', t => {
    const h = guairaTraversalBrowser(t, { reducedMotion: true }), game = h.create();
    assert.equal(game.reducedMotion, true); assert.equal(game.store.save.preferences.shake, false);
    game.objects.activate(G.valveId);
    for (const pause of [() => { h.key('Escape'); h.run(game, 1); }, () => h.pointer(305, 10),
        () => h.window.dispatch('blur'), () => h.hidden(true)]) {
        h.run(game, 2); pause(); assert.equal(game.state, 'paused');
        const frozen = snapshot(game); h.run(game, 90); game.render(); assert.deepEqual(snapshot(game), frozen);
        assert.deepEqual((game as unknown as { buttons: unknown[] }).buttons, []);
        h.hidden(false); h.key('Escape', true); assert.equal(game.state, 'paused');
        h.key('Escape'); h.run(game, 1); assert.equal(game.state, 'playing');
    }
});

test('native touch keeps movement/jump/sentada with cancellation and no extra attack button', t => {
    const h = guairaTraversalBrowser(t, { touch: true }), game = h.create();
    const touch = (identifier: number, x: number) => ({ identifier, clientX: x * 640, clientY: 330, target: h.canvas });
    const right = touch(1, .22), jump = touch(2, .93), down = touch(3, .5);
    h.canvas.dispatch('touchstart', { touches: [right, jump] }); h.run(game, 1);
    assert.ok(game.player.data.velocity.x > 0); assert.ok(game.player.data.velocity.y < 0);
    h.canvas.dispatch('touchstart', { touches: [right, down] }); h.run(game, 1);
    assert.ok(game.player.isGroundPoundActive());
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [right, down] }); h.run(game, 1);
    assert.equal(game.input.getState().right, false); assert.equal(game.input.getState().down, false); game.render();
});

test('native bitmap toolbar is keyboard-safe, 44px, reveals boss only on completion and returns to isolated map', async t => {
    const h = guairaTraversalBrowser(t); await import('../src/guaira-travessia');
    const game = h.window.worldGame as GuairaTraversal;
    assert.equal(h.boss.hidden, true);
    for (const [control, name] of [[h.pause, 'Pausar'], [h.retry, 'Recomeçar travessia'],
        [h.exit, 'Voltar ao mapa de Guaíra'], [h.boss, 'Enfrentar Ossabravo']] as const) {
        assert.equal(control.getAttribute('aria-label'), name); assert.equal(control.textContent, name);
        assert.ok(control.children[0] instanceof Canvas); assert.equal((control.children[0] as Canvas).height, 44);
        for (const [key, code] of [[' ', 'Space'], ['Enter', 'Enter']]) {
            game.input.reset(); assert.equal(h.window.dispatch('keydown', { key, code, target: control }), false);
            game.input.update(); assert.equal(game.input.getState().jumpPressed, false); assert.equal(game.input.getState().start, false);
            h.window.dispatch('keyup', { key, code, target: control });
        }
    }
    replay(h, game); h.frame(); assert.equal(h.boss.hidden, false);
    assert.equal(h.pause.hidden, true); assert.equal(h.exit.getAttribute('href'), './guaira.html?at=rice');
    h.key('Escape'); h.run(game, 1); h.frame(); assert.equal(game.state, 'paused');
    assert.equal(h.boss.hidden, true); assert.equal(h.pause.hidden, false); assert.equal(h.pause.getAttribute('aria-label'), 'Continuar');
    h.pause.dispatch('click'); h.frame(); assert.equal(game.state, 'playing'); assert.equal(h.boss.hidden, false);
    h.retry.dispatch('click'); h.frame(); assert.equal(game.state, 'playing'); assert.equal(h.boss.hidden, true); assert.equal(h.pause.hidden, false); assert.equal(game.finished, false);
    assert.equal(h.exit.getAttribute('href'), './guaira.html?at=town');
    assert.equal(h.canvas.focused, true);
    const html = readFileSync(new URL('../guaira-travessia.html', import.meta.url), 'utf8');
    assert.match(html, /id="lab-exit" href="\.\/guaira.html\?at=town"/);
    assert.match(html, /id="traversal-boss" href="\.\/guaira-lab.html" hidden/);
    assert.match(html, /min-height:44px;min-width:44px/);
    assert.doesNotMatch(html, /KeyX|HP|localStorage/);
});
