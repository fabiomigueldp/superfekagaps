import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

function browser(t: TestContext) {
    const h = sceneLifecycleBrowser(t);
    const require = createRequire(import.meta.url), css = require.extensions['.css'];
    require.extensions['.css'] = () => {};
    t.after(() => { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; });
    const { WorldGame } = require('../src/adventure/WorldGame.ts') as typeof import('../src/adventure/WorldGame');
    // Capture application listeners before constructing any scene, not a count
    // from an already mounted game that could hide a per-instance leak.
    const baseline = { window: [...h.window.listeners], document: [...h.document.listeners], count: h.listenerCount() };
    const assertReleased = () => {
        assert.deepEqual(h.window.listeners, baseline.window);
        assert.deepEqual(h.document.listeners, baseline.document);
        assert.equal(h.listenerCount(), baseline.count);
        assert.equal(h.frames.size, 0);
    };
    return { ...h, WorldGame, assertReleased };
}

for (const ephemeral of [false, true]) test(`World menu listeners belong to the scene with ephemeral=${ephemeral}`, t => {
    const h = browser(t);
    for (const enabled of [false, true, false]) {
        const game = new h.WorldGame(h.canvas as unknown as HTMLCanvasElement, ephemeral);
        if (enabled) {
            game.enableGamepadControls();
            const count = h.listenerCount();
            game.enableGamepadControls(); assert.equal(h.listenerCount(), count);
        }
        game.dispose(); game.dispose(); game.enableGamepadControls(); game.start();
        h.assertReleased();
        h.document.dispatch('pointerdown'); h.document.dispatch('keydown', { key: 'Enter' });
        h.assertReleased();
    }
});

test('World releases its DOM menu when renderer construction fails before gamepad opt-in', t => {
    const h = browser(t);
    t.mock.method(h.canvas, 'getContext', () => { throw Error('Canvas context unavailable'); });
    assert.throws(() => new h.WorldGame(h.canvas as unknown as HTMLCanvasElement, true), /Canvas context unavailable/);
    h.assertReleased();
});
