import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceLabHost } from '../src/adventure/experimental/JuiceLabHost';
import { JuiceMinibossLab } from '../src/adventure/experimental/JuiceMinibossLab';
import { juiceEpilogueBrowser, replayJuiceVictory, juiceSnapshot, STEP } from './helpers/juiceEpilogueHarness';

const readFrame = (game: JuiceLabHost) => game.epilogue.frame;

function land(game: JuiceLabHost) {
    for (let n = 0; n < 120 && !readFrame(game); n++) game.update(STEP);
    assert.equal(readFrame(game)?.beat, 'return');
    assert.equal(readFrame(game)?.timeMs, 0);
    assert.equal(game.player.data.isGrounded, true);
}

for (const reduced of [false, true]) test(`host preserves native victory and owns presentation after landing (reduced=${reduced})`, t => {
    const h = juiceEpilogueBrowser(t, reduced), baseline = h.create();
    const expected = replayJuiceVictory(h, baseline);
    const landing: string[] = [];
    do { baseline.update(STEP); landing.push(juiceSnapshot(baseline)); } while (!baseline.player.data.isGrounded);
    baseline.dispose();
    const game = new JuiceLabHost(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    t.after(() => game.dispose()); game.skipIntro();
    assert.deepEqual(replayJuiceVictory(h, game), expected);
    assert.equal(readFrame(game), null, 'final stomp still renders the native airborne result');
    const nativeRender = t.mock.method(JuiceMinibossLab.prototype, 'render');
    game.render(); assert.equal(nativeRender.mock.callCount(), 1);
    for (const snapshot of landing) { game.update(STEP); assert.equal(juiceSnapshot(game), snapshot); }
    assert.equal(readFrame(game)?.timeMs, 0, 'post-update observes this very landing');
    const snapshot = juiceSnapshot(game), frame = readFrame(game);
    const start = t.mock.method(game.renderer, 'startScene'), present = t.mock.method(game.renderer, 'present');
    game.render(); game.render();
    assert.equal(nativeRender.mock.callCount(), 1, 'no generic result panel over the epilogue');
    assert.deepEqual(start.mock.calls.map(call => call.arguments), [[1], [1]]);
    assert.equal(present.mock.callCount(), 2);
    assert.equal(juiceSnapshot(game), snapshot, 'render never moves the actual player');
    assert.deepEqual(readFrame(game), frame, 'render never advances the story');
    h.key(' '); game.update(STEP);
    assert.notEqual(readFrame(game)?.beat, 'complete', 'combat jump cannot skip the epilogue');
    for (const pause of [() => h.key('Escape'), () => h.window.dispatch('blur'), () => h.hidden(true)]) {
        pause(); game.update(STEP);
        assert.equal(game.state, 'paused');
        const paused = readFrame(game);
        game.update(100); game.render();
        assert.deepEqual(readFrame(game), paused);
        assert.match(h.status.textContent, /Pausado/);
        assert.equal(game.epilogue.skip(), false);
        h.hidden(false); game.toggleLabPause();
    }
    for (let n = 0; n < 64; n++) game.update(100);
    assert.equal(readFrame(game)?.beat, 'complete');
    game.render(); assert.match(h.status.textContent, /Tentar novamente/);
    const final = readFrame(game);
    game.update(100); assert.deepEqual(readFrame(game), final);
    game.load('juice-lab'); assert.equal(readFrame(game), null);
    game.render(); assert.equal(nativeRender.mock.callCount(), 2);
    assert.equal(game.epilogue.skip(), false);
    replayJuiceVictory(h, game); land(game);
    game.replayIntro(); assert.equal(readFrame(game), null);
    game.dispose(); game.update(100); game.render();
    assert.equal(readFrame(game), null); assert.equal(game.epilogue.skip(), false);
});

test('page exposes an active-only native skip, stable focus, immediate retry/replay and terminal cleanup', async t => {
    const h = juiceEpilogueBrowser(t);
    await import('../src/juice-lab');
    const game = h.window.worldGame;
    assert.ok(game instanceof JuiceLabHost);
    t.after(() => game.dispose());
    assert.equal(h.frames.size, 2, 'only the existing game and toolbar callbacks');
    h.skip.dispatch('click');
    assert.equal(h.skip.hidden, true);
    replayJuiceVictory(h, game); land(game); game.render(); h.frame();
    assert.equal(h.skip.hidden, false); assert.equal(h.skip.disabled, false);
    assert.equal(h.skip.getAttribute('aria-label'), 'Pular epílogo');
    assert.equal(h.skip.children[0].getAttribute('aria-hidden'), 'true');
    h.skip.focus(); const focused = h.canvas.focusCount;
    const bitmap = h.skip.children[0];
    h.frame(); h.frame();
    assert.equal(h.document.activeElement, h.skip);
    assert.equal(h.canvas.focusCount, focused, 'toolbar updates never steal focus');
    assert.equal(h.skip.children[0], bitmap, 'beat updates retain the native control and decoration');
    h.window.dispatch('pagehide', { persisted: true }); h.frame();
    assert.equal(game.isDisposed, false, 'bfcache retains the same playable document');
    assert.equal(game.state, 'paused', 'bfcache explicitly pauses even without blur');
    assert.equal(h.window.worldGame, game);
    assert.equal(h.skip.disabled, true);
    const paused = readFrame(game);
    game.update(100); h.window.dispatch('pageshow', { persisted: true });
    assert.deepEqual(readFrame(game), paused);
    assert.equal(game.state, 'paused', 'returning from history requires an explicit resume');
    h.skip.dispatch('click'); assert.deepEqual(readFrame(game), paused);
    h.pause.dispatch('click');
    assert.equal(h.skip.disabled, false);
    assert.equal(h.document.activeElement, h.canvas, 'resume restores game focus');
    h.skip.focus();
    for (let n = 0; n < 64; n++) game.update(100);
    h.frame();
    assert.equal(h.skip.hidden, true);
    assert.equal(h.document.activeElement, h.canvas, 'natural completion restores focus only when hiding the focused skip');
    h.retry.dispatch('click');
    assert.equal(readFrame(game), null); assert.equal(h.skip.hidden, true);
    replayJuiceVictory(h, game); land(game); h.frame();
    h.skip.dispatch('click');
    assert.equal(readFrame(game)?.beat, 'complete'); assert.equal(h.skip.hidden, true);
    h.replay.dispatch('click');
    assert.equal(readFrame(game), null); assert.equal(game.labMode, 'intro');
    assert.equal(h.skip.getAttribute('aria-label'), 'Pular introdução');
    assert.equal(h.skip.hidden, false);
    h.window.dispatch('pagehide');
    assert.equal(game.isDisposed, true); assert.equal(h.frames.size, 0);
    const focusCount = h.canvas.focusCount, boss = game.boss;
    h.retry.dispatch('click'); h.replay.dispatch('click'); h.skip.dispatch('click'); h.pause.dispatch('click');
    assert.equal(game.boss, boss); assert.equal(h.canvas.focusCount, focusCount);
    assert.equal(h.window.listenerCount, 0); assert.equal(h.document.listenerCount, 0);
    assert.equal(h.canvas.listenerCount, 0);
});
