import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeliciaDom } from './helpers/deliciaDomHarness';
import { loadDeliciaApp } from './helpers/deliciaAppLoader';

for (const coarse of [null, false, true]) {
    test(`touch ownership with ${coarse === null ? 'no matchMedia' : `coarse=${coarse}`} preserves keyboard, touch and gamepad priority`, async () => {
        const dom = createDeliciaDom();
        let loaded: ReturnType<typeof loadDeliciaApp> | undefined, connected = false, writes = 0;
        const pad = { index: 0, id: 'Touch ownership fixture', mapping: 'standard', connected: true, timestamp: 0,
            axes: [0, 0], buttons: [], vibrationActuator: { playEffect: async () => 'complete', reset: async () => 'complete' } } satisfies Gamepad;
        const navigator = { maxTouchPoints: 1, getGamepads: () => connected ? [pad] : [] };
        dom.mediaQueries.set('(pointer: coarse)', !!coarse);
        const matchMedia = coarse === null ? undefined : dom.mediaQueries.matchMedia;
        Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: matchMedia });
        dom.install({ navigator, matchMedia, localStorage: { getItem: () => null, setItem() { writes++; } } });
        try {
            loaded = loadDeliciaApp();
            const { touchControlsEnabled } = loaded.require('../../engine/TouchMode') as typeof import('../src/engine/TouchMode');
            const pointer = (pointerType: string) => dom.window.dispatchEvent(new dom.window.PointerEvent('pointerdown', { pointerType }));
            assert.equal(touchControlsEnabled(), !!coarse);
            pointer('touch'); assert.equal(touchControlsEnabled(), true);
            dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'd', code: 'KeyD' }));
            assert.equal(touchControlsEnabled(), false);
            pointer('touch'); assert.equal(touchControlsEnabled(), true);
            connected = true; assert.equal(touchControlsEnabled(), false, 'A connected controller keeps touch overlays hidden.');
            connected = false; assert.equal(touchControlsEnabled(), true);
            pointer('mouse'); assert.equal(touchControlsEnabled(), false);
            pointer('touch'); navigator.maxTouchPoints = 0; assert.equal(touchControlsEnabled(), false);
            assert.equal(writes, 0, 'Device ownership does not persist preferences or campaign state.');
        } finally { loaded?.dispose(); await dom.dispose(); }
    });
}
