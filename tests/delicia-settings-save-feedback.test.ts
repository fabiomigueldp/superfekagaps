import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { DELICIA_SAVE_KEY, DeliciaStore, freshDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';
import type { DeliciaSimulation } from '../src/adventure/delicia/DeliciaSimulation';
import { createDeliciaDom } from './helpers/deliciaDomHarness';
import { loadDeliciaApp } from './helpers/deliciaAppLoader';

/** Real app/settings handlers; only browser, art, audio and storage boundaries are controlled. */
interface App {
    store: DeliciaStore; sim: DeliciaSimulation | null; canvas: HTMLCanvasElement;
    status: HTMLElement & { readonly updates: number };
    loadStage(id: string, retry?: boolean): boolean;
    showSettings(): void; showControls(): void; announce(message: string): void;
    renderGame(): void; dispose(): void; readonly reducedMotion: boolean;
    menu: {choices: {label: string | (() => string); run(): void}[]};
}
function fixture(t: TestContext, mode: 'QuotaExceededError' | 'SecurityError' | 'read' | 'ok' = 'ok', saved = freshDeliciaSave()) {
    const dom = createDeliciaDom(), frames = new Map<number, FrameRequestCallback>(); let frameId = 0, closed = false;
    const cleanups: (() => void)[] = [];
    const close = async () => {
        if (closed) return; closed = true;
        try { cleanups.forEach(cleanup => cleanup()); }
        finally { await dom.dispose(); }
    };
    t.after(close);
    const original = JSON.stringify(saved); let raw = original, failure = mode, writes = 0;
    const storage = {
        getItem: () => { if (failure === 'read') throw new DOMException('Blocked', 'SecurityError'); return raw; },
        setItem: (key: string, value: string) => {
            assert.equal(key, DELICIA_SAVE_KEY);
            if (failure !== 'ok') throw new DOMException('Storage unavailable', failure);
            raw = value; writes++;
        }
    };
    // Install the shared DOM/media API before loading window-owned modules. The
    // failing campaign store stays separate from the real preference storage.
    dom.window.localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ keys: { jump: ['KeyK'] } }));
    dom.install({ navigator: { maxTouchPoints: 0, getGamepads: () => [] }, localStorage: dom.window.localStorage,
        requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame: (id: number) => { frames.delete(id); }, AudioContext: undefined,
        fetch: async () => ({ ok: false }) });
    const loaded = loadDeliciaApp(); cleanups.push(loaded.dispose);
    const controls = loaded.require('../../engine/ControlPreferences') as typeof import('../src/engine/ControlPreferences');
    const { DeliciaArt } = loaded.require('./DeliciaArt') as typeof import('../src/adventure/delicia/DeliciaArt');
    t.mock.method(DeliciaArt.prototype, 'load', async () => {});
    const app = new loaded.DeliciaApp(undefined, { store: new DeliciaStore(storage, false) }) as unknown as App;
    cleanups.unshift(() => app.dispose());
    // Count actual status writes without replacing DOM text semantics or announce().
    const text = Object.getOwnPropertyDescriptor(dom.window.Element.prototype, 'textContent');
    assert.ok(text?.get && text.set); let updates = 0;
    Object.defineProperties(app.status, {
        updates: { get: () => updates },
        textContent: { configurable: true, get: () => text.get!.call(app.status),
            set: (value: string) => { updates++; text.set!.call(app.status, value); } },
    });
    return { app, storage, dom, frames, close, controls, original, fail() { failure='QuotaExceededError'; },
        get raw() { return raw; }, get writes() { return writes; }, recover() { failure = 'ok'; } };
}

/** The native settings callbacks execute unchanged; pixel painting is a separate browser check. */
function choose(app:App,label:string) {
    const choice=app.menu.choices.find(item=>(typeof item.label==='function'?item.label():item.label).startsWith(label));
    assert.ok(choice,label);choice.run();
}
function assistance() {
    const label = Array.from(document.querySelectorAll('dialog[open] label'))
        .find(node => node.textContent?.includes('Mais vida e avisos longos'));
    const input = label?.querySelector('input');
    assert.ok(input instanceof HTMLInputElement); assert.equal(input.type, 'checkbox');
    return input;
}
test('ordinary native settings saves remain silent and keep canvas focus',t=>{
    const h=fixture(t);h.app.showSettings();const focus=document.activeElement,updates=h.app.status.updates;
    choose(h.app,'MÚSICA');choose(h.app,'MÚSICA');
    assert.equal(new DeliciaStore(h.storage).save.music,h.app.store.save.music);
    assert.equal(h.app.status.textContent,'');assert.equal(h.app.status.updates,updates);
    assert.equal(document.activeElement,focus);
});
test('quota failures are immediate and deduplicated; successful preference save clears its warning',t=>{
    const h=fixture(t);h.app.showSettings();h.fail();choose(h.app,'MÚSICA');
    const message=h.app.store.warning;assert.match(message,/apenas nesta sessão/);
    assert.equal(h.app.status.textContent,message);const updates=h.app.status.updates;
    choose(h.app,'MÚSICA');choose(h.app,'MÚSICA');assert.equal(h.app.status.updates,updates);
    assert.equal(h.raw,h.original);assert.ok(h.app.menu.choices.some(c=>c.label==='REVER PROGRESSO'));
    h.recover();choose(h.app,'MÚSICA');assert.equal(h.app.status.textContent,'');
    assert.equal(h.app.store.warning,'');assert.equal(new DeliciaStore(h.storage).save.music,h.app.store.save.music);
});
test('successful native preference retry clears a pre-existing warning without moving focus',t=>{
    const h=fixture(t,'QuotaExceededError');h.app.store.persist();h.app.showSettings();const focus=document.activeElement;
    choose(h.app,'TREMOR');assert.equal(h.app.status.textContent,h.app.store.warning);
    h.recover();choose(h.app,'TREMOR');assert.equal(h.app.status.textContent,'');
    assert.equal(document.activeElement,focus);assert.equal(new DeliciaStore(h.storage).save.reducedMotion,false);
});
test('parallel-store conflict retains local preferences and assistance without overwriting the durable save',t=>{
    const h=fixture(t);h.app.showSettings();const other=new DeliciaStore(h.storage);
    other.save.completed=['delicia-1'];assert.equal(other.persist(),true);const durable=h.raw;
    choose(h.app,'EFEITOS');assert.match(h.app.status.textContent,/outra aba/);const updates=h.app.status.updates;
    choose(h.app,'EFEITOS');choose(h.app,'EFEITOS');assert.equal(h.app.status.updates,updates);
    h.app.showControls();const input=assistance();assert.equal(input.checked,false);input.click();
    assert.equal(input.checked,true);assert.equal(h.app.store.save.assists,true);
    assert.equal(h.raw,durable);assert.equal(new DeliciaStore(h.storage).save.assists,false);
});
test('a later conflict replaces quota feedback and native recovery cannot claim success',t=>{
    const h=fixture(t,'QuotaExceededError');h.app.store.persist();h.app.showSettings();h.recover();
    const other=new DeliciaStore(h.storage);other.save.music=.1;assert.equal(other.persist(),true);const durable=h.raw;
    choose(h.app,'MÚSICA');assert.match(h.app.status.textContent,/outra aba/);
    choose(h.app,'REVER PROGRESSO');choose(h.app,'TENTAR SALVAR');
    assert.equal(h.raw,durable);assert.match(h.app.status.textContent,/outra aba/);
});
test('successful native preference save preserves unrelated feedback; a new failure restores its warning',t=>{
    const h=fixture(t);h.app.showSettings();h.fail();choose(h.app,'MÚSICA');
    h.app.announce('Arquivo inválido. Progresso atual mantido.');h.recover();choose(h.app,'MÚSICA');
    assert.equal(h.app.status.textContent,'Arquivo inválido. Progresso atual mantido.');
    h.fail();choose(h.app,'MÚSICA');assert.equal(h.app.status.textContent,h.app.store.warning);
});

test('settings fixtures reload preferences, preserve progress and remapped controls, and release their DOM', async t => {
    const globals = ['window', 'document', 'matchMedia', 'Event', 'localStorage'] as const;
    const before = globals.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    let saved = { ...freshDeliciaSave(), completed: ['delicia-1'], selected: 'delicia-2',
        collected: ['delicia-1:seal-1'], times: { 'delicia-1': 48 }, medals: { 'delicia-1': ['clean'] },
        checkpoint: { stage: 'delicia-2', index: 0, valves: [] }, music: .2, effects: .6 };
    for (let visit = 0; visit < 2; visit++) {
        const h = fixture(t, 'ok', saved), controlsRaw = localStorage.getItem('super_feka_gaps_controls_v1');
        assert.deepEqual(h.app.store.save, saved); assert.equal(h.writes, 0);
        assert.equal(h.controls.keyAction('KeyK'), 'jump'); assert.equal(h.controls.keyAction('Space'), undefined);
        assert.equal(h.app.loadStage('delicia-2', true), true);
        const sim = h.app.sim, simulation = JSON.stringify(sim);
        h.app.showSettings();
        const button = (prefix: string) => {
            const result = Array.from(document.querySelectorAll<HTMLButtonElement>('.canvas-menu-accessibility button'))
                .find(node => node.textContent?.startsWith(prefix));
            assert.ok(result, prefix); return result;
        };
        assert.equal(button('MÚSICA').textContent, `MÚSICA: ${Math.round(saved.music * 100)}%`);
        assert.equal(button('EFEITOS').textContent, `EFEITOS: ${Math.round(saved.effects * 100)}%`);
        assert.equal(button('TREMOR').textContent, `TREMOR: ${saved.reducedMotion ? 'NÃO' : 'SIM'}`);
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        assert.equal(motion.matches, false); assert.ok(h.dom.mediaQueries.listenerCount() > 0);
        h.dom.mediaQueries.set(motion.media, true); assert.equal(h.app.reducedMotion, true);
        h.dom.mediaQueries.set(motion.media, false); assert.equal(h.app.reducedMotion, saved.reducedMotion);
        assert.equal(h.raw, h.original); assert.equal(h.writes, 0);
        if (visit === 0) {
            for (const label of ['MÚSICA', 'EFEITOS', 'TREMOR']) { button(label).click(); h.app.renderGame(); }
            const focus = document.activeElement;
            button('CONTROLES').click(); assistance().click();
            const close = document.querySelector<HTMLButtonElement>('#delicia-controls-close'); assert.ok(close); close.click();
            assert.equal(document.activeElement, focus);
            saved = { ...saved, music: .45, effects: .85, reducedMotion: true, assists: true };
            assert.deepEqual(h.app.store.save, saved); assert.deepEqual(JSON.parse(h.raw), saved);
            assert.equal(h.writes, 4, 'Each preference action persists exactly once.');
        }
        assert.equal(h.app.sim, sim); assert.equal(JSON.stringify(sim), simulation);
        assert.equal(localStorage.getItem('super_feka_gaps_controls_v1'), controlsRaw);
        assert.equal(h.controls.keyAction('KeyK'), 'jump'); assert.equal(h.controls.keyAction('Space'), undefined);
        h.app.dispose();
        assert.equal(h.dom.mediaQueries.listenerCount(), 0); assert.equal(h.frames.size, 0);
        assert.equal(h.dom.body.children.length, 0);
        await h.close();
        assert.deepEqual(globals.map(name => Object.getOwnPropertyDescriptor(globalThis, name)), before);
    }
});
