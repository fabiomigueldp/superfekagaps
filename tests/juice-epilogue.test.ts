import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceEpilogue, JUICE_EPILOGUE_DURATION_MS } from '../src/adventure/experimental/JuiceEpilogue';
import { juiceEpilogueBrowser, replayJuiceVictory, juiceSnapshot, STEP } from './helpers/juiceEpilogueHarness';

const readFrame = (epilogue: JuiceEpilogue) => epilogue.frame;

test('six real native hits preserve the complete replay; only the grounded result starts the epilogue', t => {
    const h = juiceEpilogueBrowser(t);
    const baseline = h.create();
    const expected = replayJuiceVictory(h, baseline);
    baseline.dispose();
    const game = h.create(), epilogue = new JuiceEpilogue(game);
    assert.equal(epilogue.skip(), false);
    assert.equal(readFrame(epilogue), null);
    const actual = replayJuiceVictory(h, game, () => {
        const before = juiceSnapshot(game);
        epilogue.update(STEP);
        assert.equal(juiceSnapshot(game), before, 'observer cannot mutate native state');
        assert.equal(readFrame(epilogue), null, 'no story during combat or final-hit bounce');
    });
    assert.deepEqual(actual, expected, 'every native replay snapshot, including hits, stays identical');
    assert.equal(game.boss?.health, 0);
    assert.equal(game.player.data.isGrounded, false);
    for (let n = 0; n < 120 && !readFrame(epilogue); n++) {
        game.update(STEP); epilogue.update(STEP);
        if (!game.player.data.isGrounded) assert.equal(readFrame(epilogue), null);
    }
    assert.equal(game.labMode, 'result');
    assert.equal(readFrame(epilogue)?.beat, 'return');
    assert.equal(readFrame(epilogue)?.timeMs, 0);
    assert.equal(readFrame(epilogue)?.hasHelmet, game.player.data.hasHelmet);
    const before = juiceSnapshot(game);
    for (let n = 0; n < 64; n++) epilogue.update(100);
    assert.equal(readFrame(epilogue)?.beat, 'complete');
    assert.equal(readFrame(epilogue)?.timeMs, JUICE_EPILOGUE_DURATION_MS);
    assert.equal(juiceSnapshot(game), before);
    assert.deepEqual(game.store.save.completed, []);
    game.dispose();
    assert.equal(readFrame(epilogue), null, 'disposed lab cannot retain a visible result');
});

for (const reduced of [false, true]) test(`pause, skip, same-turn retry/replay and terminal disposal (reduced=${reduced})`, t => {
    const h = juiceEpilogueBrowser(t, reduced), game = h.create(), epilogue = new JuiceEpilogue(game);
    replayJuiceVictory(h, game);
    for (let n = 0; n < 120 && !readFrame(epilogue); n++) { game.update(STEP); epilogue.update(STEP); }
    assert.ok(readFrame(epilogue));
    epilogue.update(100);
    game.toggleLabPause();
    const paused = readFrame(epilogue);
    epilogue.update(1000);
    assert.deepEqual(readFrame(epilogue), paused);
    assert.equal(epilogue.skip(), false);
    game.toggleLabPause();
    const beforeInvalid = readFrame(epilogue);
    for (const dt of [NaN, Infinity, -1, 0]) epilogue.update(dt);
    assert.deepEqual(readFrame(epilogue), beforeInvalid);
    epilogue.update(60000);
    assert.equal(readFrame(epilogue)?.timeMs, 200, 'no hidden-tab catch-up');
    assert.equal(epilogue.skip(), true);
    const skipped = readFrame(epilogue);
    epilogue.update(100);
    assert.deepEqual(readFrame(epilogue), skipped);
    assert.equal(epilogue.skip(), false);
    game.load('juice-lab');
    assert.equal(readFrame(epilogue), null, 'retry clears stale frame before another update');
    assert.equal(epilogue.skip(), false, 'late button callback cannot act on old victory');
    replayJuiceVictory(h, game);
    for (let n = 0; n < 120 && !readFrame(epilogue); n++) { game.update(STEP); epilogue.update(STEP); }
    assert.equal(readFrame(epilogue)?.timeMs, 0, 'a second genuine victory starts a fresh epilogue');
    game.replayIntro();
    assert.equal(readFrame(epilogue), null);
    assert.equal(epilogue.skip(), false);
    epilogue.dispose(); epilogue.dispose();
    game.skipIntro(); epilogue.update(100);
    assert.equal(readFrame(epilogue), null);
    assert.equal(epilogue.skip(), false);
    game.dispose();
});

test('blur/hidden pause freezes the story; explicit resume continues it', t => {
    const h = juiceEpilogueBrowser(t), game = h.create(), epilogue = new JuiceEpilogue(game);
    replayJuiceVictory(h, game);
    for (let n = 0; n < 120 && !readFrame(epilogue); n++) { game.update(STEP); epilogue.update(STEP); }
    assert.ok(readFrame(epilogue));
    for (const hide of [() => h.window.dispatch('blur'), () => h.hidden(true)]) {
        hide();
        assert.equal(game.state, 'paused');
        const frame = readFrame(epilogue);
        game.update(100); epilogue.update(100);
        assert.deepEqual(readFrame(epilogue), frame);
        h.hidden(false);
        assert.equal(game.state, 'paused');
        game.toggleLabPause(); epilogue.update(100);
        assert.equal(readFrame(epilogue)!.timeMs, frame!.timeMs + 100);
    }
    game.dispose(); epilogue.dispose();
});
