/** Geometry and real entrypoint events; font wrapping and CSS require separate browser QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { guairaLabCanvasSize } from '../src/guaira-lab-layout';
import { labActionSize } from '../src/adventure/experimental/JuiceLabToolbar';
import { Canvas, guairaBrowser } from './helpers/guairaLabHarness';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';
import { guairaMayorBrowser } from './helpers/guairaMayorHarness';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} differs from ${b}`);
test('small canvases keep their aspect and fit all remaining space without a 0.5× floor', () => {
    for (const width of [120, 320, 472, 640, 1180]) for (const height of [60, 240, 303, 480, 757])
        for (const nav of [44, 78, 94, 110, 112, 142, 220]) for (const controls of [0, 56]) {
            const size = guairaLabCanvasSize(width, height, nav, controls);
            assert.ok(size.width >= 0 && size.height >= 0);
            assert.ok(size.width <= width + 1e-8);
            assert.ok(size.height <= Math.max(0, height - nav - controls - 12) + 1e-8);
            close(size.width * 9, size.height * 16);
            if (size.scale >= 1) assert.equal(size.scale, Math.floor(size.scale));
        }
    assert.deepEqual(guairaLabCanvasSize(320, 480, 110), { width: 320, height: 180, scale: 1 });
    assert.deepEqual(guairaLabCanvasSize(472, 303, 94), { width: 320, height: 180, scale: 1 });
    close(guairaLabCanvasSize(472, 303, 112).height, 179);
    close(guairaLabCanvasSize(472, 303, 142).height, 149);
    close(guairaLabCanvasSize(472, 180, 142).height, 26);
});

test('all four real pages remeasure the toolbar after resize, status wrapping, pause and retry', async t => {
    for (const [name, setup] of [['lab', guairaBrowser], ['travessia', guairaTraversalBrowser],
        ['subida', guairaAscentBrowser], ['prefeito', guairaMayorBrowser]] as const) await t.test(name, async t => {
        const h = setup(t); let navHeight = 110;
        const nav = { style: { maxHeight: '' }, getBoundingClientRect: () => ({ height: navHeight }) };
        Object.assign(h.document, { querySelector: () => nav });
        let resize: (() => void) | undefined;
        const prior = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
        Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class {
            constructor(callback: () => void) { resize = callback; }
            observe(target: unknown) { assert.equal(target, nav); }
        } });
        t.after(() => { if (prior) Object.defineProperty(globalThis, 'ResizeObserver', prior); else Reflect.deleteProperty(globalThis, 'ResizeObserver'); });
        Object.assign(globalThis, { innerWidth: 320, innerHeight: 480 });
        await import(`../src/guaira-${name}`);
        const game = h.window.worldGame!;
        assert.equal(h.canvas.style.width, '320px'); assert.equal(h.canvas.style.height, '180px');
        // Measured 472×303 statuses stay at 94px; do not claim the old cliff occurs here.
        Object.assign(globalThis, { innerWidth: 472, innerHeight: 303 }); navHeight = 94;
        h.window.dispatch('resize'); assert.equal(h.canvas.style.height, '180px');
        // Font/user settings may wrap more. Simulate the actual ResizeObserver boundary,
        // not CSS layout: a 142px observed bar has exactly 149px left for the canvas.
        h.status.textContent = 'Status longo que passou a ocupar mais linhas'; navHeight = 142; resize!();
        close(parseFloat(h.canvas.style.height), 149); close(parseFloat(h.canvas.style.width), 149 * 16 / 9);
        assert.equal((h.document.body.style as Record<string, string>).paddingTop, '142px');
        h.pause.dispatch('click'); assert.equal(game.state, 'paused');
        navHeight = 78; resize!(); assert.equal(h.canvas.style.height, '180px');
        assert.equal((h.pause.children[0] as Canvas).height, 44);
        h.retry.dispatch('click'); assert.equal(game.state, 'playing');
        navHeight = 94; resize!(); assert.equal(h.canvas.style.height, '180px');
        for (const control of [h.pause, h.retry, h.exit]) assert.equal((control.children[0] as Canvas).height, 44);
        const getElement = h.document.getElementById;
        Object.assign(h.document, { getElementById: (id: string) => id === 'guaira-touch-controls'
            ? { getBoundingClientRect: () => ({ height: 56 }) } : getElement(id) });
        resize!(); close(parseFloat(h.canvas.style.height), 141);
        assert.equal(nav.style.maxHeight, '247px', 'toolbar scrolling reserves the independent control bar');
        assert.equal((h.document.body.style as Record<string, string>).paddingBottom, '56px');
        assert.deepEqual(h.storageCalls, []);
    });
});

test('toolbar plate geometry fits 320px without shrinking its 44px targets', () => {
    for (const labels of [['PAUSA', 'TENTAR', 'MAPA'], ['CONTINUAR', 'TENTAR', 'CASA'],
        ['SUBIR', 'TENTAR', 'MAPA'], ['TENTAR', 'CURRAL', 'MAPA']]) {
        const sizes = labels.map(labActionSize);
        assert.ok(sizes.every(size => size.width * 2 >= 44 && size.height * 2 === 44));
        assert.ok(sizes.reduce((sum, size) => sum + size.width * 2, 0) + 2 * 4 + 12 <= 320);
    }
    const destinations = ['TRAVESSIA', 'ARENA', 'SUBIDA'].map(labActionSize);
    assert.ok(destinations.reduce((sum, size) => sum + size.width * 2, 0) + 2 * 8 <= 304);
});
