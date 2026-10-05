import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { WorldGame } from '../src/adventure/WorldGame';
import { WorldControlsHelp } from '../src/adventure/WorldControlsHelp';
import { freshSave, SAVE_KEY } from '../src/adventure/progress';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

/** Real WorldGame/Input/listeners. Modal layout, focus and native click synthesis
 * are browser boundaries, not emulated as evidence of browser conformance. */
function setup(t: TestContext) {
    const h = sceneLifecycleBrowser(t);
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const decorate = (element: LifecycleElement) => {
        Object.defineProperty(element, 'isConnected', { get: () => element === h.body || element.parent !== null });
        element.focus = () => { doc.activeElement?.dispatch('blur'); doc.activeElement = element; element.dispatch('focus'); };
        Object.assign(element, {
            inert: false, open: false,
            showModal() { (element as unknown as HTMLDialogElement).open = true; },
            close() { (element as unknown as HTMLDialogElement).open = false; element.dispatch('close'); }
        });
        return element;
    };
    const create = doc.createElement; doc.createElement = tag => decorate(create(tag));
    decorate(h.canvas); decorate(h.body);
    const writes: unknown[] = [], stored = new Map([[SAVE_KEY, JSON.stringify(freshSave())]]);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => { writes.push({ key, value }); stored.set(key, value); }
    } });
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement);
    const help = (game as unknown as { controlsHelp: WorldControlsHelp }).controlsHelp;
    const descendants = (element: LifecycleElement): LifecycleElement[] => [element, ...element.children.flatMap(descendants)];
    const nodes = () => descendants(h.body);
    const button = (label: string) => nodes().find(element => element.tagName === 'BUTTON' && element.textContent === label)!;
    const key = (key: string, values: Record<string, unknown> = {}, type = 'keydown') => {
        const event = new Event(type, { cancelable: true }); let stopped = false;
        Object.defineProperties(event, {
            key: { value: key }, code: { value: key === ' ' ? 'Space' : key === 'Shift' ? 'ShiftLeft' : key.length === 1 ? `Key${key.toUpperCase()}` : key },
            target: { value: doc.activeElement }, repeat: { value: false, configurable: true },
            stopImmediatePropagation: { value: () => { stopped = true; } }
        });
        for (const [name, value] of Object.entries(values)) Object.defineProperty(event, name, { value });
        const listeners = h.window.listeners.filter(item => item.type === type).sort((a, b) => Number(b.capture) - Number(a.capture));
        for (const item of listeners) {
            if (typeof item.callback === 'function') item.callback(event); else item.callback.handleEvent(event);
            if (stopped) break;
        }
        return event;
    };
    function settings() { game.render(); button('OPÇÕES').focus(); button('OPÇÕES').click(); game.render(); }
    function open() { const entry = button('CONTROLES'); entry.focus(); entry.click(); return entry; }
    return { ...h, game, help, doc, writes, stored, nodes, button, key, settings, open };
}

test('controls are discoverable from title options, named, readable and do not change the save', t => {
    const h = setup(t); h.canvas.focus(); h.settings();
    const before = JSON.stringify(h.game.store.save), writes = h.writes.length;
    const entry = h.open();
    assert.equal(h.help.isOpen, true); assert.equal(h.game.state, 'settings');
    assert.equal(h.help.dialog.getAttribute('aria-labelledby'), 'world-controls-title');
    assert.equal(h.doc.activeElement?.id, 'world-controls-title');
    const text = h.nodes().map(node => node.textContent).join('\n');
    for (const label of ['A / D ou ← / →', 'Espaço, W, Z ou ↑', 'Segure Shift ou X enquanto anda.', 'No ar, aperte S ou ↓.', 'Ligar / desligar som', 'NA TELA DE TOQUE']) assert.ok(text.includes(label), label);
    h.game.update(1000); h.game.render();
    assert.equal(h.button('CONTROLES'), entry, 'The opener must stay mounted behind the modal');
    assert.equal(JSON.stringify(h.game.store.save), before); assert.equal(h.writes.length, writes);
    h.help.closeButton.click(); assert.equal(h.doc.activeElement, entry);
    assert.equal((h.canvas as unknown as HTMLElement).inert, false);
});

test('native scrolling, Tab and activation retain defaults while every gameplay key stays isolated', t => {
    const h = setup(t); h.canvas.focus(); h.settings();
    const source = h.game.input.createActionSource(); source.press('run');
    h.open(); const selected = (h.game as unknown as { menuSelection: number }).menuSelection;
    const content = h.nodes().find(node => node.className === 'world-controls-content')!; content.focus();
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'z', 'x', 's', 'a', 'd', 'Shift', 'm', 'Tab', 'PageDown']) {
        assert.equal(h.key(key).defaultPrevented, false, `${key} keeps its native default`);
        h.game.input.update();
        assert.ok(Object.values(h.game.input.getState()).every(value => value === false), `${key} never reaches Input`);
        h.key(key, {}, 'keyup');
    }
    assert.equal((h.game as unknown as { menuSelection: number }).menuSelection, selected);
    assert.equal(h.key('ArrowDown', { repeat: true }).defaultPrevented, false, 'Repeated arrows can scroll');
    h.help.closeButton.focus();
    assert.equal(h.key('Enter').defaultPrevented, false, 'Browser synthesizes the button click');
    assert.equal(h.key('Enter', { repeat: true }).defaultPrevented, true);
    assert.equal(h.key(' ', { repeat: true }).defaultPrevented, true);
    assert.equal(h.key('Escape', { repeat: true }).defaultPrevented, true); assert.equal(h.help.isOpen, true);
    assert.equal(h.key('Escape').defaultPrevented, true); assert.equal(h.help.isOpen, false);
    assert.equal(h.game.state, 'settings', 'The closing Escape must not also leave Options');
    h.game.input.update(); assert.equal(h.game.input.consumePause(), false); assert.equal(h.game.input.consumeMute(), false);
});

test('every documented gameplay alias still works after help closes', t => {
    const h = setup(t); h.settings(); h.open(); h.help.close(); h.game.load('1-1'); h.canvas.focus();
    for (const [key, action] of [
        ['a', 'left'], ['ArrowLeft', 'left'], ['d', 'right'], ['ArrowRight', 'right'],
        [' ', 'jump'], ['w', 'jump'], ['z', 'jump'], ['ArrowUp', 'jump'],
        ['Shift', 'run'], ['x', 'run'], ['s', 'down'], ['ArrowDown', 'down'],
    ] as const) {
        h.game.input.reset(); h.key(key); h.game.input.update();
        assert.equal(h.game.input.getState()[action], true, `${key} still performs ${action}`);
        h.key(key, {}, 'keyup'); h.game.input.update(); assert.equal(h.game.input.getState()[action], false);
    }
    h.key('m'); h.game.input.update(); assert.equal(h.game.input.consumeMute(), true); h.key('m', {}, 'keyup');
    h.key('Escape'); h.game.input.update(); assert.equal(h.game.input.consumePause(), true);
});

test('pause → options → controls → options → pause never resumes or changes the attempt', t => {
    const h = setup(t); h.game.load('1-1'); h.canvas.focus();
    h.key('Escape'); h.game.update(16); h.key('Escape', {}, 'keyup'); assert.equal(h.game.state, 'paused');
    h.settings(); const position = { ...h.game.player.data.position }, elapsed = h.game.elapsed;
    const entry = h.open(); h.game.update(2000); h.game.render(); h.key('Escape');
    assert.equal(h.doc.activeElement, entry); assert.equal(h.game.state, 'settings');
    assert.deepEqual(h.game.player.data.position, position); assert.equal(h.game.elapsed, elapsed);
    h.button('VOLTAR').click(); h.game.render(); assert.equal(h.game.state, 'paused');
});

test('cancel, native close, repeated opening and state changes clean up without stale actions', t => {
    const h = setup(t); h.settings(); const entry = h.open();
    assert.equal((h.help.dialog as unknown as LifecycleElement).dispatch('cancel').defaultPrevented, true);
    assert.equal(h.help.isOpen, false); assert.equal(h.doc.activeElement, entry);
    entry.click(); h.help.dialog.close(); assert.equal(h.help.isOpen, false);
    entry.click(); h.help.open();
    assert.equal((h.game.input as unknown as { canvasTouchSuspensions: Set<symbol> }).canvasTouchSuspensions.size, 1);
    (h.help.dialog as unknown as LifecycleElement).dispatch('close'); assert.equal(h.help.isOpen, true, 'Delayed close cannot dismiss a reopened dialog');
    (h.game as unknown as { change(screen: string): void }).change('title');
    assert.equal(h.help.isOpen, false); assert.equal((h.canvas as unknown as HTMLElement).inert, false);
    assert.equal((h.game.input as unknown as { canvasTouchSuspensions: Set<symbol> }).canvasTouchSuspensions.size, 0);
    entry.click(); h.help.open(); assert.equal(h.help.isOpen, false);
    h.game.dispose(); assert.equal(h.help.dialog.isConnected, false); assert.equal(h.listenerCount(), 0);
    h.help.open(); assert.equal(h.help.isOpen, false);
});

test('failed modal acquisition restores input/focus and hidden/page exit never steals focus', t => {
    const h = setup(t); h.settings(); const entry = h.button('CONTROLES'); entry.focus();
    const show = h.help.dialog.showModal;
    h.help.dialog.showModal = () => { throw new Error('modal unavailable'); };
    assert.throws(() => h.help.open(), /modal unavailable/);
    assert.equal(h.help.isOpen, false); assert.equal(h.doc.activeElement, entry);
    assert.equal((h.canvas as unknown as HTMLElement).inert, false);
    assert.equal((h.game.input as unknown as { canvasTouchSuspensions: Set<symbol> }).canvasTouchSuspensions.size, 0);
    h.help.dialog.showModal = show; h.help.open();
    h.document.hidden = true; h.help.close(); assert.notEqual(h.doc.activeElement, entry);
    h.help.open(); assert.equal(h.help.isOpen, false);
    h.document.hidden = false; h.help.open(); h.window.dispatch('pagehide'); assert.equal(h.help.isOpen, false);
    h.game.dispose(); assert.equal(h.listenerCount(), 0);
});

test('return from a hidden document tolerates a removed menu opener', t => {
    const h = setup(t); h.settings(); const entry = h.open();
    h.document.hidden = true; h.document.dispatch('visibilitychange');
    assert.equal((entry as unknown as HTMLElement).isConnected, false);
    h.document.hidden = false; h.document.dispatch('visibilitychange'); h.key('Escape');
    assert.equal(h.doc.activeElement, h.canvas, 'Removed controls cannot receive restored focus');
    h.game.render(); assert.notEqual(h.button('CONTROLES'), entry); assert.equal(h.game.state, 'settings');
});

test('ephemeral scenes do not gain campaign help and the stylesheet keeps a scrollable body and visible exit', t => {
    const h = sceneLifecycleBrowser(t); const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    assert.equal((game as unknown as { controlsHelp?: WorldControlsHelp }).controlsHelp, undefined);
    game.dispose(); assert.equal(h.listenerCount(), 0);
    const css = readFileSync(new URL('../src/adventure/world-controls-help.css', import.meta.url), 'utf8');
    assert.match(css, /100dvh/); assert.match(css, /overflow: auto/); assert.match(css, /min-height: 44px/);
    assert.match(css, /forced-colors/); assert.match(css, /safe-area-inset-bottom/);
});
