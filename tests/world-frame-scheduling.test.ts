import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { WorldGame } from '../src/adventure/WorldGame';
import { FACTORY_SALON } from '../src/adventure/factory/FactorySalon';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const STEP = 1000 / 60;
type Screen = WorldGame['state'];
type Internals = { change(screen: Screen): void; pause(): void; resume(): void; accumulator: number; toastTimer: number };

/** Real WorldGame/Input/renderers with a manually offered RAF clock, not browser FPS evidence. */
function fixture(t: TestContext, initiallyHidden = false) {
    const cleanups: Array<() => void> = [];
    const h = sceneLifecycleBrowser({ after: callback => { cleanups.push(callback as () => void); } });
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const decorate = (element: LifecycleElement) => {
        Object.defineProperty(element, 'isConnected', { get: () => element === h.body || element.parent !== null });
        element.focus = () => { doc.activeElement?.dispatch('blur'); doc.activeElement = element; element.dispatch('focus'); };
        Object.assign(element, { inert: false, open: false,
            showModal() { (element as unknown as HTMLDialogElement).open = true; },
            close() { (element as unknown as HTMLDialogElement).open = false; element.dispatch('close'); } });
        return element;
    };
    const create = doc.createElement; doc.createElement = tag => decorate(create(tag));
    decorate(h.canvas); decorate(h.body);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem() {} } });
    h.document.hidden = initiallyHidden;
    const games: WorldGame[] = [];
    t.after(() => { games.reverse().forEach(game => game.dispose()); cleanups.reverse().forEach(cleanup => cleanup()); });
    let now = 1000, callbacks = 0;
    t.mock.method(performance, 'now', () => now);
    function make(): WorldGame;
    function make<T extends WorldGame>(Scene: new (canvas: HTMLCanvasElement) => T): T;
    function make(Scene: new (canvas: HTMLCanvasElement) => WorldGame = WorldGame) {
        const game = new Scene(h.canvas as unknown as HTMLCanvasElement); games.push(game); return game;
    }
    const game = make(), internal = game as unknown as Internals;
    const present = t.mock.method(game.renderer, 'present'), update = t.mock.method(game, 'update');
    const frame = (dt = STEP) => { now += dt; callbacks += h.frames.size; h.frame(now); };
    const hidden = (value: boolean) => { h.document.hidden = value; h.document.dispatch('visibilitychange'); };
    const counts = () => ({ callbacks, updates: update.mock.callCount(), presents: present.mock.callCount(), draws: h.drawCount() });
    const descendants = (element: LifecycleElement): LifecycleElement[] => [element, ...element.children.flatMap(descendants)];
    const button = (label: string) => {
        const result = descendants(h.body).find(node => node.tagName === 'BUTTON' && node.textContent === label);
        assert.ok(result, `Missing real canvas menu button: ${label}`); return result;
    };
    return { ...h, game, internal, make, frame, hidden, counts, button, doc, now: () => now };
}

test('hidden WorldGame owns no RAF or paint work across 120 manually offered frames', t => {
    const h = fixture(t); h.game.load('1-1'); h.game.start(); h.frame();
    h.internal.toastTimer = 1700;
    const save = structuredClone(h.game.store.save);
    h.hidden(true);
    assert.equal(h.game.state, 'paused'); assert.equal(h.frames.size, 0);
    const before = h.counts(), time = h.game.time, elapsed = h.game.elapsed, toast = h.internal.toastTimer;
    const player = structuredClone(h.game.player.data);
    for (let i = 0; i < 120; i++) h.frame();
    assert.deepEqual(h.counts(), before);
    assert.equal(h.game.time, time); assert.equal(h.game.elapsed, elapsed); assert.equal(h.internal.toastTimer, toast);
    assert.deepEqual(h.game.player.data, player); assert.deepEqual(h.game.store.save, save);
});

test('initially hidden starts wait for visibility, preserve one chain, and do not auto-resume gameplay', t => {
    const h = fixture(t, true); h.game.load('1-1'); h.game.start(); h.game.start();
    assert.equal(h.game.state, 'paused'); assert.equal(h.frames.size, 0);
    const before = h.counts(); h.frame(90_000); assert.deepEqual(h.counts(), before);
    h.hidden(false); h.hidden(false); assert.equal(h.frames.size, 1);
    h.frame(); assert.equal(h.game.state, 'paused'); assert.equal(h.game.elapsed, 0);
    assert.equal(h.counts().updates, 0, 'The first returned frame establishes the clock');
    h.key('keydown', 'Escape'); h.key('keyup', 'Escape'); assert.equal(h.game.state, 'playing');
    h.frame(); assert.ok(h.game.elapsed > 0 && h.game.elapsed <= STEP / 1000 + 1e-9);
    assert.equal(h.frames.size, 1);
});

test('rapid visibility returns and stale canceled callbacks cannot paint, update, or fork a new chain', t => {
    const h = fixture(t); h.game.start(); h.frame();
    const old = [...h.frames.values()][0]; h.hidden(true); h.frame(30_000);
    old(h.now()); assert.equal(h.frames.size, 0);
    h.hidden(false); const superseded = [...h.frames.values()][0];
    h.hidden(true); h.hidden(false); h.hidden(false);
    const owner = [...h.frames.keys()][0], before = h.counts();
    old(h.now()); superseded(h.now());
    assert.deepEqual(h.counts(), before); assert.deepEqual([...h.frames.keys()], [owner]);
    h.frame(); assert.equal(h.counts().updates, before.updates); assert.equal(h.frames.size, 1);
    h.frame(); assert.ok(h.counts().updates > before.updates && h.counts().updates <= before.updates + 2, 'Only the new timestep plus its retained fractional remainder advances');
});

test('a visibility race before its event stops work and preserves the fixed-step remainder on return', t => {
    const h = fixture(t); h.game.start(); h.frame(STEP / 2);
    const remainder = h.internal.accumulator, before = h.counts();
    h.document.hidden = true; h.frame(45_000);
    assert.equal(h.frames.size, 0); assert.equal(h.counts().presents, before.presents);
    assert.equal(h.counts().updates, before.updates); assert.equal(h.internal.accumulator, remainder);
    h.document.dispatch('visibilitychange'); h.hidden(false); h.frame();
    assert.equal(h.internal.accumulator, remainder); assert.equal(h.counts().updates, before.updates);
    h.frame(STEP / 2 + .00001);
    assert.equal(h.counts().updates, before.updates + 1);
});

test('visible paused and animated screens retain the existing update and full-paint cadence', t => {
    const h = fixture(t); h.game.start(); h.frame();
    for (const state of ['title', 'playing', 'paused', 'settings', 'dialogue', 'clear', 'intro', 'ending', 'gallery'] as const) {
        if (state === 'playing') h.game.load('1-1'); else h.internal.change(state);
        h.frame(); const before = h.counts(), time = h.game.time;
        for (let i = 0; i < 120; i++) h.frame();
        const after = h.counts();
        assert.equal(after.callbacks - before.callbacks, 120, `${state}: one visible callback per offered frame`);
        assert.equal(after.presents - before.presents, 120, `${state}: visible painting is unchanged`);
        assert.ok(after.draws > before.draws);
        assert.ok(Math.abs(after.updates - before.updates - 120) <= 1, `${state}: original fixed-step input/audio cadence`);
        if (state === 'paused' || state === 'settings') assert.equal(h.game.time, time);
        else assert.ok(h.game.time > time);
        assert.equal(h.frames.size, 1);
    }
});

test('pause menu selection, focus and native activation remain available after visibility return', t => {
    const h = fixture(t); h.game.load('1-1'); h.game.start(); h.frame();
    h.key('keydown', 'Escape'); h.frame(); h.key('keyup', 'Escape'); assert.equal(h.game.state, 'paused');
    const elapsed = h.game.elapsed;
    h.button('OPÇÕES').focus(); h.button('OPÇÕES').click(); h.frame();
    assert.equal(h.game.state, 'settings');
    h.button('VOLTAR').focus(); const old = h.button('VOLTAR');
    h.hidden(true); h.frame(5000); h.hidden(false); h.frame();
    const back = h.button('VOLTAR'); assert.notEqual(back, old, 'Hidden menu controls are rebuilt');
    back.focus(); assert.equal(h.doc.activeElement, back); back.click(); h.frame();
    assert.equal(h.game.state, 'paused'); assert.equal(h.game.elapsed, elapsed);
    h.button('CONTINUAR').focus(); h.button('CONTINUAR').click(); h.frame();
    assert.equal(h.game.state, 'playing'); assert.equal(h.doc.activeElement, h.canvas);
});

test('a paused FactoryCampaign still owns live gameplay inside its real salon dialog', t => {
    const h = fixture(t); h.game.dispose();
    const require = createRequire(import.meta.url), css = require.extensions['.css'];
    require.extensions['.css'] = () => {};
    let FactoryCampaign: typeof import('../src/adventure/factory/FactoryCampaign').FactoryCampaign;
    try { ({ FactoryCampaign } = require('../src/adventure/factory/FactoryCampaign')); }
    finally { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; }
    const campaign = h.make(FactoryCampaign); campaign.load(FACTORY_SALON.stage);
    campaign.player.data.position = { x: FACTORY_SALON.door.x, y: FACTORY_SALON.support.y - campaign.player.data.height };
    campaign.player.data.isGrounded = true; campaign.enterSalon();
    const salon = (campaign as unknown as { salon: import('../src/adventure/factory/FactorySalonSession').FactorySalonSession }).salon;
    assert.ok(salon); assert.equal(campaign.state, 'paused'); assert.equal(salon.state, 'playing');
    const present = t.mock.method(salon.renderer, 'present'), update = t.mock.method(salon, 'update');
    campaign.start(); h.frame(); const updates = update.mock.callCount(), paints = present.mock.callCount();
    for (let i = 0; i < 12; i++) h.frame();
    assert.ok(update.mock.callCount() > updates); assert.equal(present.mock.callCount() - paints, 12);
    assert.equal(h.frames.size, 1, 'Only the campaign owns the salon frame chain');
    h.hidden(true); assert.equal(salon.state, 'paused'); assert.equal(h.frames.size, 0);
    const time = salon.time; h.frame(60_000); h.hidden(false); h.frame();
    assert.equal(salon.state, 'paused'); assert.equal(campaign.state, 'paused'); assert.equal(salon.time, time);
    salon.toggleLabPause(); h.frame(STEP + .001);
    assert.ok(salon.time > time && salon.time - time <= 2 * STEP + 1e-9, 'Only the new timestep plus the retained remainder advances');
    campaign.leaveSalon(); assert.equal(campaign.state, 'playing'); assert.equal(salon.isDisposed, true);
    assert.equal(h.doc.activeElement, h.canvas); h.frame(); assert.equal(h.frames.size, 1);
});

test('disposal while hidden or inside an update is terminal; a fresh visit owns its own chain', t => {
    const h = fixture(t); h.game.start(); const old = [...h.frames.values()][0];
    h.hidden(true); h.game.dispose(); h.game.dispose(); h.hidden(false);
    old(h.now()); assert.equal(h.frames.size, 0);
    const next = h.make(); next.start(); next.start(); assert.equal(h.frames.size, 1);
    const before = h.drawCount(); old(h.now()); assert.equal(h.drawCount(), before); assert.equal(h.frames.size, 1);
    h.frame(); assert.ok(h.drawCount() > before);
    const stale = [...h.frames.values()][0]; next.dispose(); stale(h.now());
    h.hidden(true); h.hidden(false); assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0);
    class SelfDisposing extends WorldGame { override update() { this.dispose(); } }
    const inside = h.make(SelfDisposing); inside.start(); const draws = h.drawCount(); h.frame(100);
    assert.equal(h.frames.size, 0); assert.equal(h.drawCount(), draws); assert.equal(h.listenerCount(), 0);
});
