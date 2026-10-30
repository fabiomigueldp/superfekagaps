import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { textWidth, wrapText } from '../src/graphics/BitmapFont';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DELICIA_SAVE_KEY, DeliciaStore, freshDeliciaSave, parseDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';
import { DeliciaSimulation, noDeliciaInput, type DeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';
import { createDeliciaDom } from './helpers/deliciaDomHarness';
import { loadDeliciaApp } from './helpers/deliciaAppLoader';

/** Private app probes for the real constructor/event paths; only browser/device/storage boundaries are controlled. */
interface App {
    store: DeliciaStore; sim: DeliciaSimulation; toast: string; toastTime: number; screen: string;
    panel: HTMLElement; status: HTMLElement; settingsMessage?: HTMLElement; menu: { id: string; choices: { label: string; run(): void }[] };
    step(dt: number, input: DeliciaInput): void; loadStage(id: string, retry?: boolean): boolean;
    clearStage(): void; pause(): void; showEnding(): void; showSettings(): void;
    dialogueDone(): void; dispose(): void; invalidatePausedPaint(): void; readonly reducedMotion: boolean;
}
function fixture(t: TestContext, mode: 'QuotaExceededError' | 'SecurityError' | 'read' | 'ok' = 'ok') {
    const dom = createDeliciaDom(), frames = new Map<number, FrameRequestCallback>(); let frameId = 0, closed = false;
    const cleanups: (() => void)[] = [];
    const close = async () => {
        if (closed) return; closed = true;
        try { cleanups.forEach(cleanup => cleanup()); }
        finally { await dom.dispose(); }
    };
    t.after(close);
    const original = JSON.stringify(freshDeliciaSave()); let raw = original, failure = mode, writes = 0;
    const storage = {
        getItem: () => { if (failure === 'read') throw new DOMException('Blocked', 'SecurityError'); return raw; },
        setItem: (key: string, value: string) => {
            assert.equal(key, DELICIA_SAVE_KEY);
            if (failure !== 'ok') throw new DOMException('Storage unavailable', failure);
            raw = value; writes++;
        }
    };
    // TouchMode and other window-owned modules evaluate only after the shared DOM/media API exists.
    // Preferences use a separate storage boundary from the failing campaign store under test.
    dom.install({ navigator: { maxTouchPoints: 0, getGamepads: () => [] }, localStorage: dom.window.localStorage,
        requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame: (id: number) => { frames.delete(id); }, AudioContext: undefined,
        fetch: async () => ({ ok: false }) });
    const loaded = loadDeliciaApp(); cleanups.push(loaded.dispose);
    const { DeliciaArt } = loaded.require('./DeliciaArt') as typeof import('../src/adventure/delicia/DeliciaArt');
    t.mock.method(DeliciaArt.prototype, 'load', async () => {});
    const app = new loaded.DeliciaApp(undefined, { store: new DeliciaStore(storage, false) }) as unknown as App;
    cleanups.unshift(() => app.dispose());
    assert.equal(app.loadStage('delicia-1', true), true);
    const button = (name: string) => {
        // Use the same native recovery callbacks as the visible menu.
        const review = app.menu.choices.find(choice => choice.label === 'REVER PROGRESSO');
        if (review) review.run();
        const label = name === 'Exportar cópia' ? 'EXPORTAR' : name.toUpperCase();
        const choice = app.menu.choices.find(choice => choice.label === label);
        assert.ok(choice, `Missing ${name} action`); return { click: () => choice.run() };
    };
    return { app, button, storage, original, dom, frames, close, get raw() { return raw; }, get writes() { return writes; },
        recover() { failure = 'ok'; }, warning: () => app.store.warning &&
            (app.menu.id.startsWith('recovery') || app.menu.choices.some(choice => choice.label === 'REVER PROGRESSO'))
            ? { textContent: app.store.warning } : undefined };

}

test('save feedback fixtures install live media queries before imports and release each visit', async t => {
    const globals = ['window', 'document', 'matchMedia', 'Event'] as const;
    const before = globals.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    const motion = '(prefers-reduced-motion: reduce)', pointer = '(pointer: coarse)';
    for (let visit = 0; visit < 2; visit++) {
        const h = fixture(t), list = matchMedia(motion);
        assert.equal(list.media, motion); assert.equal(list.matches, false);
        assert.equal(h.app.reducedMotion, false); assert.ok(h.dom.mediaQueries.listenerCount() > 0);
        const invalidate = t.mock.method(h.app, 'invalidatePausedPaint');
        h.dom.mediaQueries.set(motion, true);
        assert.equal(list.matches, true); assert.equal(h.app.reducedMotion, true);
        assert.equal(invalidate.mock.callCount(), 1);
        h.dom.mediaQueries.set(motion, true); assert.equal(invalidate.mock.callCount(), 1);
        assert.equal(matchMedia(pointer).matches, false);
        h.app.dispose();
        assert.equal(h.dom.mediaQueries.listenerCount(), 0); assert.equal(h.frames.size, 0);
        const calls = invalidate.mock.callCount(); h.dom.mediaQueries.set(motion, false);
        assert.equal(invalidate.mock.callCount(), calls, 'Disposed app receives no stale media callbacks.');
        await h.close();
        assert.deepEqual(globals.map(name => Object.getOwnPropertyDescriptor(globalThis, name)), before);
    }
});
function reachCheckpoint(app: App, index = 0) {
    const cp = app.sim.stage.checkpoints[index];
    Object.assign(app.sim.player, { x: cp.x, y: cp.y, vx: 0, vy: 0 });
    app.step(1 / 120, noDeliciaInput());
    assert.equal(app.store.save.checkpoint?.index, index);
}

for (const error of ['QuotaExceededError', 'SecurityError'] as const)
test(`checkpoint ${error} feedback stays truthful and a session retry retains progress`, t => {
    const h = fixture(t, error); reachCheckpoint(h.app);
    assert.equal(h.app.toast, 'Checkpoint só nesta sessão.'); assert.equal(h.app.toastTime, 5);
    assert.equal(h.app.status.textContent, h.app.toast); assert.match(h.app.store.warning, /apenas nesta sessão/);
    assert.equal(h.raw, h.original); assert.equal(h.writes, 0);
    assert.equal(h.app.loadStage('delicia-1', true), true);
    assert.equal(h.app.sim.checkpoint, 0); assert.equal(h.app.sim.player.x, DELICIA_STAGES[0].checkpoints[0].x);
    assert.equal(new DeliciaStore(h.storage).save.checkpoint, null, 'A reload only sees durable progress.');
    h.app.pause(); assert.match(h.warning()!.textContent, /apenas nesta sessão/);
    h.button('Tentar salvar').click(); assert.ok(h.warning()); assert.equal(h.raw, h.original);
    h.recover(); h.button('Tentar salvar').click();
    assert.equal(h.warning(), undefined); assert.equal(h.app.status.textContent, 'Progresso salvo.');
    assert.equal(new DeliciaStore(h.storage).save.checkpoint?.index, 0);
    assert.equal(h.app.store.warning, ''); assert.equal(h.writes, 1);
});

test('the next checkpoint automatically reports durable success after storage recovers', t => {
    const h = fixture(t, 'QuotaExceededError'); reachCheckpoint(h.app); h.recover(); reachCheckpoint(h.app, 1);
    assert.equal(h.app.toast, 'Checkpoint salvo.'); assert.equal(h.app.toastTime, 3);
    assert.equal(h.app.store.warning, ''); assert.equal(new DeliciaStore(h.storage).save.checkpoint?.index, 1);
});

function finish(app: App) {
    app.sim.elapsed = 48;
    app.clearStage();
    if (app.screen === 'dialogue') app.dialogueDone();
    assert.equal(app.screen, 'clear');
}
test('failed completion offers export and retry without changing earned progress', async t => {
    const h = fixture(t, 'QuotaExceededError'); finish(h.app);
    assert.match(h.warning()!.textContent, /apenas nesta sessão/); assert.equal(h.raw, h.original);
    const earned = structuredClone(h.app.store.save);
    assert.deepEqual(earned.completed, ['delicia-1']); assert.equal(earned.times['delicia-1'], 48);
    assert.ok(earned.medals['delicia-1'].length); assert.equal(earned.checkpoint, null);
    let exported: Blob | undefined;
    t.mock.method(URL, 'createObjectURL', (blob: Blob) => { exported = blob; return 'blob:test-copy'; });
    t.mock.method(URL, 'revokeObjectURL', () => {});
    h.button('Exportar cópia').click(); assert.ok(exported);
    assert.deepEqual(parseDeliciaSave(await exported.text()), earned); assert.equal(h.raw, h.original);
    h.button('Tentar salvar').click(); assert.deepEqual(h.app.store.save, earned); assert.ok(h.warning());
    h.recover(); h.button('Tentar salvar').click();
    assert.equal(h.warning(), undefined); assert.equal(h.app.status.textContent, 'Progresso salvo.');
    assert.deepEqual(new DeliciaStore(h.storage).save, earned); assert.equal(h.writes, 1);
});

test('successful completion has no failure controls and survives reload', t => {
    const h = fixture(t); finish(h.app);
    assert.equal(h.warning(), undefined); assert.equal(h.app.store.warning, '');
    assert.deepEqual(new DeliciaStore(h.storage).save, h.app.store.save);
});

test('read-protected storage remains untouched by retry, with its original warning visible', t => {
    const h = fixture(t, 'read'); reachCheckpoint(h.app);
    assert.equal(h.app.toast, 'Checkpoint só nesta sessão.');
    h.app.pause(); assert.match(h.warning()!.textContent, /não pôde ser lido/);
    h.recover(); h.button('Tentar salvar').click();
    assert.match(h.warning()!.textContent, /não pôde ser lido/); assert.equal(h.writes, 0); assert.equal(h.raw, h.original);
});

test('options and ending retain save recovery, and a successful retry clears the warning', t => {
    const h = fixture(t, 'SecurityError'); finish(h.app);
    h.app.showSettings(); assert.match(h.warning()!.textContent, /apenas nesta sessão/);
    h.app.showEnding(); h.app.dialogueDone(); assert.equal(h.app.screen, 'ending');
    assert.match(h.warning()!.textContent, /apenas nesta sessão/);
    h.recover(); h.button('Tentar salvar').click(); assert.equal(h.warning(), undefined);
    assert.equal(h.app.status.textContent, 'Progresso salvo.'); assert.deepEqual(new DeliciaStore(h.storage).save, h.app.store.save);
});

test('native recovery actions and the complete warning fit inside the World panel', () => {
    for (const [label, width] of [['EXPORTAR', 88], ['TENTAR SALVAR', 106], ['VOLTAR', 70]] as const)
        assert.ok(textWidth(label) <= width - 26, label);
    const store = new DeliciaStore({ getItem() { throw new Error('blocked'); }, setItem() {} });
    assert.ok(wrapText(store.warning, 272).length <= 8, 'The entire warning fits before the native buttons');
});
