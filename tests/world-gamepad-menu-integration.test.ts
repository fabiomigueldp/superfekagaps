import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { WorldControlsHelp } from '../src/adventure/WorldControlsHelp';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const STEP = 1000 / 60;
type Internals = { menuSelection: number; introPage: number; galleryWorld: number; toast: string; toastTimer: number;
    change(screen: string): void; settings(screen: string): void; controlsHelp: WorldControlsHelp;
    saveImportCleanup?: () => void; buttons: Array<{ run(): void }>; };
/** Actual menu/host/input code; focus, device API and monotonic time are browser boundaries. */
function setup(t: TestContext) {
    let game: WorldGame | undefined;
    const h = sceneLifecycleBrowser({ after: callback => t.after(() => { game?.dispose(); (callback as () => void)(); }) });
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const elements: LifecycleElement[] = [h.canvas, h.body];
    const decorate = (element: LifecycleElement) => {
        Object.defineProperty(element, 'isConnected', { get: () => element === h.body || element.parent !== null });
        element.focus = () => {
            if (doc.activeElement === element) return;
            doc.activeElement?.dispatch('blur'); doc.activeElement = element; element.dispatch('focus');
        };
        Object.assign(element, { inert: false, open: false,
            showModal() { (element as unknown as HTMLDialogElement).open = true; },
            close() { (element as unknown as HTMLDialogElement).open = false; element.dispatch('close'); } });
        return element;
    };
    const create = doc.createElement;
    doc.createElement = tag => { const element = decorate(create(tag)); elements.push(element); return element; };
    decorate(h.canvas); decorate(h.body);
    Object.assign(h.document, { hasFocus: () => true,
        querySelector: (query: string) => query === 'dialog[open]' ? elements.find(e => e.tagName === 'DIALOG' && (e as unknown as HTMLDialogElement).open) ?? null : null });
    const pad = { index: 0, id: 'standard menu fixture', connected: true, mapping: 'standard', axes: [0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    let polls = 0, now = 0;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => { polls++; return [pad]; } });
    const clock = Object.getOwnPropertyDescriptor(performance, 'now');
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
    t.after(() => { if (clock) Object.defineProperty(performance, 'now', clock); else Reflect.deleteProperty(performance, 'now'); });
    const writes: string[] = [];
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: (_key: string, value: string) => writes.push(value) } });
    game = new WorldGame(h.canvas as unknown as HTMLCanvasElement); const world = game;
    world.enableGamepadControls(); h.canvas.focus(); world.render();
    const internal = world as unknown as Internals;
    const step = (elapsed = STEP, render = true) => { now += elapsed; world.update(STEP); if (render) world.render(); };
    const neutral = () => { pad.axes.fill(0); pad.buttons.forEach(b => { b.pressed = false; b.value = 0; }); step(); };
    const button = (index: number, down = true) => { pad.buttons[index].pressed = down; pad.buttons[index].value = down ? 1 : 0; };
    const tap = (index: number) => { neutral(); button(index); step(); };
    return { ...h, doc, elements, world, internal, pad, writes, polls: () => polls, step, neutral, button, tap,
        nav: () => elements.find(e => e.className === 'canvas-menu-accessibility')! };
}

test('title and story pages need fresh confirms, and stale rendered gallery actions are never used', t => {
    const h = setup(t); h.neutral(); h.button(0); h.step();
    assert.equal(h.world.state, 'intro'); assert.equal(h.internal.introPage, 0);
    h.step(1000); assert.equal(h.internal.introPage, 0);
    h.tap(0); assert.equal(h.internal.introPage, 1); h.step(1000); assert.equal(h.internal.introPage, 1);
    // Returning to title through a real menu transition starts a fresh owner.
    h.internal.change('title'); h.world.render(); h.neutral(); h.tap(13); h.tap(0);
    assert.equal(h.world.state, 'gallery'); assert.equal(h.internal.galleryWorld, 0);
    h.neutral(); h.nav().children[6].focus(); h.neutral();
    const old = h.internal.buttons[6]; let staleCalls = 0; old.run = () => { staleCalls++; };
    h.internal.galleryWorld = 7; // A different native/keyboard actor changed page before the next paint.
    h.step(STEP, false); h.button(0); h.step(STEP, false);
    assert.equal(staleCalls, 0); assert.equal(h.internal.galleryWorld, 7);
    h.world.render(); h.tap(1); assert.equal(h.internal.galleryWorld, 0);
    h.step(1000); assert.equal(h.world.state, 'gallery', 'Held back cannot also leave the gallery');
    h.tap(1); assert.equal(h.world.state, 'title');
});

test('direction hold repeats through real native focus without resetting the adapter', t => {
    const h = setup(t), save = structuredClone(h.world.store.save), writes = h.writes.length;
    h.neutral(); h.button(13); h.step(); assert.equal(h.internal.menuSelection, 1);
    assert.equal(h.doc.activeElement, h.nav().children[1]);
    h.step(349); assert.equal(h.internal.menuSelection, 1);
    h.step(1); assert.equal(h.internal.menuSelection, 2); assert.equal(h.doc.activeElement, h.nav().children[2]);
    h.step(119); assert.equal(h.internal.menuSelection, 2); h.step(1); assert.equal(h.internal.menuSelection, 3);
    assert.deepEqual(h.world.store.save, save); assert.equal(h.writes.length, writes);
});

test('pause/settings navigation preserves gameplay and resumes only after a neutral gesture', t => {
    const h = setup(t); h.world.load('1-1'); h.world.render(); h.neutral(); h.tap(9);
    assert.equal(h.world.state, 'paused'); h.tap(13); h.tap(13); h.tap(0);
    assert.equal(h.world.state, 'settings');
    const before = h.world.store.save.preferences.music; h.tap(0);
    assert.notEqual(h.world.store.save.preferences.music, before);
    const after = h.world.store.save.preferences.music; h.step(1000); assert.equal(h.world.store.save.preferences.music, after);
    h.tap(1); assert.equal(h.world.state, 'paused'); h.step(1000); assert.equal(h.world.state, 'paused');
    h.tap(9); assert.equal(h.world.state, 'playing');
    h.button(0); h.step(); assert.equal(h.world.input.getState().jumpPressed, false);
    h.neutral(); h.button(0); h.step(); assert.equal(h.world.input.getState().jumpPressed, true);
});

test('focus navigation and ignored commands do not skip menu audio/toast clocks', t => {
    const h = setup(t); h.internal.settings('title'); h.world.render(); h.neutral();
    h.internal.toast = 'clock fixture'; h.internal.toastTimer = 2000;
    const audio = h.world.audio.tick.bind(h.world.audio); let ticks = 0;
    h.world.audio.tick = dt => { ticks++; audio(dt); };
    const start = h.internal.toastTimer, clock = h.world.time;
    h.button(13); h.step(); h.step(350); h.step(120);
    h.neutral(); h.button(2); h.step(); h.neutral(); h.button(3); h.step(); h.neutral(); h.button(9); h.step();
    assert.equal(ticks, 9); assert.ok(Math.abs(h.internal.toastTimer - (start - 9 * STEP)) < 1e-6);
    assert.equal(h.world.time, clock, 'Settings keeps its existing frozen scene clock');
});

test('native save tools give an honest handoff and never open files or downloads from polling', t => {
    const h = setup(t); h.internal.settings('title'); h.world.render();
    const original = structuredClone(h.world.store.save), writes = h.writes.length;
    for (const index of [3, 4]) {
        h.nav().children[index].focus(); h.neutral(); h.button(0); h.step();
        assert.match(h.internal.toast, /Enter ou toque/);
        assert.equal(h.elements.some(e => e.id === 'world-save-import'), false);
        assert.equal(h.internal.saveImportCleanup, undefined);
    }
    assert.deepEqual(h.world.store.save, original); assert.equal(h.writes.length, writes);
});

test('external focus, native dialogs and pending imports suspend polling and require neutral on return', t => {
    const h = setup(t); h.neutral();
    const outside = h.doc.createElement('input'); h.body.append(outside); outside.focus();
    const baseline = h.polls(); h.button(0); h.button(13); h.step(); assert.equal(h.polls(), baseline);
    assert.equal(h.doc.activeElement, outside); assert.equal(h.world.state, 'title');
    h.canvas.focus(); h.step(); assert.equal(h.world.state, 'title'); h.neutral();
    const dialog = h.doc.createElement('dialog'); h.body.append(dialog);
    (dialog as unknown as HTMLDialogElement).showModal();
    const before = h.polls(); h.button(0); h.step(); assert.equal(h.polls(), before);
    (dialog as unknown as HTMLDialogElement).close(); h.step(); assert.equal(h.world.state, 'title');
    h.neutral(); h.internal.saveImportCleanup = () => {};
    const during = h.polls(); h.button(0); h.step(); assert.equal(h.polls(), during);
    h.internal.saveImportCleanup = undefined; h.step(); assert.equal(h.world.state, 'title');
    h.neutral(); h.button(0); h.step(); assert.equal(h.world.state, 'intro');
});

test('controls-help owns focus and cannot be closed or navigate the underlying settings by controller', t => {
    const h = setup(t); h.internal.settings('title'); h.world.render();
    h.nav().children[6].focus(); h.tap(0); assert.equal(h.internal.controlsHelp.isOpen, true);
    const before = h.polls(), focus = h.doc.activeElement; h.neutral(); h.button(1); h.button(9); h.step();
    assert.equal(h.polls(), before); assert.equal(h.doc.activeElement, focus); assert.equal(h.internal.controlsHelp.isOpen, true);
    h.internal.controlsHelp.close(); h.step(); assert.equal(h.world.state, 'settings');
    h.neutral(); h.tap(1); assert.equal(h.world.state, 'title');
});

test('fresh confirms take the real main path from title through story/map into gameplay', t => {
    const h = setup(t);
    h.tap(0); assert.equal(h.world.state, 'intro'); h.tap(0); assert.equal(h.internal.introPage, 1);
    h.tap(0); assert.equal(h.world.state, 'map');
    h.step(1000); assert.equal(h.world.state, 'map', 'Held story confirm cannot enter the map destination');
    h.tap(0); assert.equal(h.world.state, 'playing');
    h.step(); assert.equal(h.world.input.getState().jumpPressed, false, 'Map confirmation is never a gameplay jump');
    h.neutral(); h.button(0); h.step(); assert.equal(h.world.input.getState().jumpPressed, true);
});

for (const screen of ['clear', 'ending']) {
    test(`${screen} confirms once without spilling the same press into map entry`, t => {
        const h = setup(t); h.internal.change(screen); h.world.render(); h.tap(0);
        assert.equal(h.world.state, 'map'); h.step(1000); h.step(1000);
        assert.equal(h.world.state, 'map'); h.tap(0); assert.equal(h.world.state, 'playing');
    });
}

test('native menu Escape still unlocks audio and invokes its existing return action', t => {
    const h = setup(t); h.internal.settings('title'); h.world.render();
    let unlocks = 0; const unlock = h.world.audio.unlock.bind(h.world.audio);
    h.world.audio.unlock = () => { unlocks++; unlock(); };
    h.nav().children[0].focus(); h.nav().dispatch('keydown', { key: 'Escape' });
    assert.equal(unlocks, 1); assert.equal(h.world.state, 'title');
});
