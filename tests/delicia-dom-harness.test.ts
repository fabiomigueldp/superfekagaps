import assert from 'node:assert/strict';
import test from 'node:test';
import { Window } from 'happy-dom';
import { createDeliciaDom } from './helpers/deliciaDomHarness';
import { deliciaDomContract } from './helpers/deliciaDomContract';
import { loadDeliciaApp } from './helpers/deliciaAppLoader';

test('shared Delicia DOM preserves text, selectors, event propagation, focus and form controls', async () => {
    const dom = createDeliciaDom();
    try {
        const snapshots = await deliciaDomContract(dom.document);
        assert.deepEqual(snapshots, [
            { phase: 'text', text: ' <b>Ajuda</b> & Continuar', nodes: [1, 3, 1], elements: ['INPUT', 'BUTTON'], parent: true },
            { phase: 'move', text: 'ContinuarMovido', labelNodes: 2, parent: true },
            { phase: 'queries', capture: true, matches: true, closest: true, className: 'base touch', controls: ['INPUT', 'BUTTON'] },
            { phase: 'events', events: ['window:capture', 'label:capture', 'button', 'label:bubble', 'window:bubble'], accepted: false, prevented: true, target: true },
            { phase: 'focus', focus: ['blur-to-input', 'focus-from-button'], active: true },
            { phase: 'form', checked: true, value: 'controller', selected: 'controller' },
            { phase: 'details', closed: true, open: true, hiddenByDetails: false },
            { phase: 'dialog', open: true, containsFocus: true },
            { phase: 'close', open: false, restored: true },
            { phase: 'detach', empty: true, labelConnected: false, textParent: null, captureConnected: true },
        ]);
    } finally { await dom.dispose(); }
});

test('device/layout adapters are isolated per document and leave ordinary DOM windows unchanged', async () => {
    const first = createDeliciaDom(), second = createDeliciaDom(), ordinary = new Window();
    try {
        const a = first.document.createElement('input'), b = second.document.createElement('input');
        a.type = b.type = 'file'; first.body.append(a); second.body.append(b);
        first.failPicker(); assert.throws(() => a.click(), /Picker unavailable/); assert.doesNotThrow(() => b.click());
        first.failPointerCapture(a); assert.throws(() => a.setPointerCapture(2), /Capture unavailable/);
        b.setPointerCapture(2); assert.equal(b.hasPointerCapture(2), true); b.releasePointerCapture(2); assert.equal(b.hasPointerCapture(2), false);
        assert.equal(first.body.getBoundingClientRect().width, 960); assert.equal(second.body.getBoundingClientRect().width, 960);
        assert.equal(ordinary.document.body.getBoundingClientRect().width, 0);
        b.hidden = true; assert.equal(b.getClientRects().length, 0); b.hidden = false; assert.equal(b.getClientRects().length, 1);
        await first.dispose(); assert.doesNotThrow(() => b.click()); assert.equal(second.body.getBoundingClientRect().width, 960);
    } finally { await first.dispose(); await second.dispose(); await ordinary.happyDOM.close(); }
});

test('app modules attach to each fresh window and globals/media subscriptions are released', async () => {
    const before = Object.getOwnPropertyDescriptor(globalThis, 'window');
    for (let visit = 0; visit < 2; visit++) {
        const dom = createDeliciaDom();
        dom.install({ navigator: { maxTouchPoints: 1, getGamepads: () => [] }, localStorage: { getItem: () => null, setItem() {} } });
        const loaded = loadDeliciaApp();
        try {
            const touch: typeof import('../src/engine/TouchMode') = loaded.require('../../engine/TouchMode');
            assert.equal(touch.touchControlsEnabled(), false);
            dom.window.dispatchEvent(new dom.window.PointerEvent('pointerdown', { pointerType: 'touch' }));
            assert.equal(touch.touchControlsEnabled(), true);
            dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'a', code: 'KeyA' }));
            assert.equal(touch.touchControlsEnabled(), false);
            const list = dom.mediaQueries.matchMedia('(prefers-reduced-motion: reduce)'); list.addEventListener('change', () => {});
            assert.equal(dom.mediaQueries.listenerCount(), 1);
        } finally { loaded.dispose(); await dom.dispose(); }
        assert.equal(dom.mediaQueries.listenerCount(), 0);
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'window'), before);
    }
});

test('real Delicia initializes its settings/help DOM and disposes it without replacing app handlers', async t => {
    const dom = createDeliciaDom(), frames = new Map<number, FrameRequestCallback>(); let id = 0;
    dom.install({ navigator: { maxTouchPoints: 0, getGamepads: () => [] }, localStorage: { getItem: () => null, setItem() {} },
        requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; },
        cancelAnimationFrame: (frame: number) => { frames.delete(frame); }, fetch: async () => ({ ok: false }) });
    const loaded = loadDeliciaApp(), art: typeof import('../src/adventure/delicia/DeliciaArt') = loaded.require('./DeliciaArt');
    t.mock.method(art.DeliciaArt.prototype, 'load', async () => {});
    let app: InstanceType<typeof loaded.DeliciaApp> | undefined;
    try {
        app = new loaded.DeliciaApp();
        app['showSettings'](); app['showControls']();
        const dialog = dom.document.querySelector('dialog')!;
        assert.equal(dialog.open, true); assert.equal(dialog.contains(dom.document.activeElement), true);
        assert.match(dialog.textContent, /Mais vida e avisos longos/);
        assert.equal(dialog.querySelectorAll('select').length, 2);
        const action = dialog.querySelectorAll('select')[1]; assert.equal(action.value, 'left');
        const label = dialog.querySelector('label input[type="checkbox"]')?.parentElement;
        assert.ok(label); assert.equal(Array.from(label.childNodes).some(node => node.nodeType === 3), true);
        app['controlsHelp'].close(); assert.equal(dialog.open, false);
        app.dispose(); assert.equal(dom.document.querySelector('dialog'), null); assert.equal(dom.body.children.length, 0);
        assert.equal(frames.size, 0); assert.equal(dom.mediaQueries.listenerCount(), 0);
    } finally { app?.dispose(); loaded.dispose(); await dom.dispose(); }
});
