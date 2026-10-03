import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { CanvasMenuAccessibility } from '../src/adventure/CanvasMenuAccessibility';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

function setup(t: TestContext) {
    let menu: CanvasMenuAccessibility;
    t.after(() => menu?.dispose());
    const h = sceneLifecycleBrowser(t);
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const create = doc.createElement;
    doc.createElement = tag => {
        const element = create(tag);
        element.focus = () => { doc.activeElement?.dispatch('blur'); doc.activeElement = element; element.dispatch('focus'); };
        return element;
    };
    h.canvas.focus = () => { doc.activeElement = h.canvas; };
    let selected = -1, activations = 0, escapes = 0, resets = 0;
    menu = new CanvasMenuAccessibility(h.canvas as unknown as HTMLCanvasElement, {
        select: value => { selected = value; }, activate: () => { activations++; }, escape: () => { escapes++; }, resetInput: () => { resets++; }
    });
    const root = menu.root as unknown as LifecycleElement;
    const choices = [
        { label: 'CONTINUAR', x: 84, y: 68, width: 152, height: 17 },
        { label: 'MÚSICA: 75%', x: 84, y: 90, width: 152, height: 17 }
    ];
    return { ...h, doc, menu, root, choices, stats: () => ({ selected, activations, escapes, resets }) };
}

test('native controls preserve identity, state labels, coordinates and focus selection', t => {
    const h = setup(t);
    h.menu.sync('paused', 'Jogo pausado', h.choices, 0);
    const first = h.root.children[0], second = h.root.children[1];
    assert.equal(first.tagName, 'BUTTON'); assert.equal(first.type, 'button');
    assert.equal(h.root.getAttribute('aria-label'), 'Jogo pausado');
    assert.equal(first.textContent, 'CONTINUAR');
    assert.equal(first.style.left, '26.25%'); assert.equal(h.root.style.width, '640px');
    assert.equal(h.doc.activeElement, null, 'An animation frame must not steal focus');
    second.focus(); assert.equal(h.stats().selected, 1);
    h.menu.sync('paused', 'Jogo pausado', [h.choices[0], { ...h.choices[1], label: 'MÚSICA: 100%' }], 1);
    assert.equal(h.root.children[1], second); assert.equal(h.doc.activeElement, second);
    assert.equal(second.textContent, 'MÚSICA: 100%');
    second.click(); assert.equal(h.stats().activations, 1);
});

test('navigation owns arrows/Escape, leaves native activation, suppresses repeat and permits Tab', t => {
    const h = setup(t); h.menu.sync('settings', 'Opções', h.choices, 0); h.root.children[0].focus();
    const arrow = h.root.dispatch('keydown', { key: 'ArrowDown' });
    assert.equal(arrow.defaultPrevented, true); assert.equal(h.doc.activeElement, h.root.children[1]);
    const enter = h.root.dispatch('keydown', { key: 'Enter' });
    assert.equal(enter.defaultPrevented, false); assert.equal(h.stats().activations, 0, 'Browser owns native click synthesis');
    assert.equal(h.root.dispatch('keydown', { key: 'Enter', repeat: true }).defaultPrevented, true);
    assert.equal(h.root.dispatch('keydown', { key: 'Tab' }).defaultPrevented, false);
    assert.equal(h.root.dispatch('keydown', { key: 'ArrowDown', ctrlKey: true }).defaultPrevented, false);
    h.root.dispatch('keydown', { key: 'Escape' }); assert.equal(h.stats().escapes, 1);
    h.root.dispatch('keydown', { key: 'Escape', repeat: true }); assert.equal(h.stats().escapes, 1);
    h.root.dispatch('keyup', { key: ' ' }); assert.ok(h.stats().resets > 0);
});

test('transition removes stale actions, restores menu focus, and respects external interruptions', t => {
    const h = setup(t); h.menu.sync('paused', 'Pausa', h.choices, 0);
    const stale = h.root.children[1]; stale.focus(); h.menu.clear();
    assert.equal(h.root.hidden, true); assert.equal(h.root.children.length, 0); assert.equal(h.doc.activeElement, h.canvas);
    stale.click(); assert.equal(h.stats().activations, 0);
    h.menu.sync('settings', 'Opções', h.choices, 0);
    assert.equal(h.doc.activeElement, h.root.children[0]);
    h.menu.clear(); const outside = h.doc.createElement('input'); outside.focus();
    h.menu.sync('paused', 'Pausa', h.choices, 0); assert.equal(h.doc.activeElement, outside);
    h.menu.sync('playing', 'Jogo', [], 0); assert.equal(h.root.children.length, 0);
    h.menu.dispose(); h.menu.sync('paused', 'Pausa', h.choices, 0); assert.equal(h.root.children.length, 0);
    assert.equal(h.root.parent, null); assert.equal(h.root.listeners.length, 0);
});

test('geometry follows resized canvas and hidden document removes reachable controls', t => {
    const h = setup(t); h.menu.sync('title', 'Menu principal', h.choices, 0);
    h.canvas.getBoundingClientRect = () => ({ left: 12, top: 20, width: 320, height: 180, x: 12, y: 20, right: 332, bottom: 200 });
    h.window.dispatch('resize'); assert.equal(h.root.style.left, '12px'); assert.equal(h.root.style.width, '320px');
    h.document.hidden = true; h.document.dispatch('visibilitychange'); assert.equal(h.root.hidden, true);
    assert.equal(h.root.children.length, 0); h.menu.sync('title', 'Menu principal', h.choices, 0); assert.equal(h.root.hidden, true);
});
