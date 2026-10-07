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

function propertyWrites<T extends object, K extends keyof T>(target: T, keys: readonly K[]): K[] {
    const writes: K[] = [];
    for (const key of keys) {
        let value = target[key];
        Object.defineProperty(target, key, {
            configurable: true, enumerable: true,
            get: () => value,
            set: next => { value = next; writes.push(key); }
        });
    }
    return writes;
}

test('unchanged native menu frames avoid geometry and visibility writes without losing focused controls', t => {
    const h = setup(t); h.menu.sync('paused', 'Pausa', h.choices, 0);
    const controls = [...h.root.children]; controls[1].focus();
    const before = h.stats();
    const geometry = controls.map(button => propertyWrites(button.style, ['left', 'top', 'width', 'height']));
    const visibility = propertyWrites(h.root, ['hidden']);
    for (let frame = 0; frame < 600; frame++)
        h.menu.sync('paused', 'Pausa', h.choices.map(choice => ({ ...choice })), 1);
    const counts = { geometry: geometry.reduce((sum, writes) => sum + writes.length, 0), visibility: visibility.length };
    t.diagnostic(`600 unchanged menu frames: ${JSON.stringify(counts)}`);
    assert.deepEqual(counts, { geometry: 0, visibility: 0 });
    assert.deepEqual(h.root.children, controls);
    assert.equal(h.doc.activeElement, controls[1]);
    assert.deepEqual(h.stats(), before, 'Unchanged sync must not refocus or reset native input');
});

test('menu geometry mutations and labels apply immediately while canvas relocation still follows every sync', t => {
    const h = setup(t); h.menu.sync('settings', 'Opções', h.choices, 0);
    const [first, second] = h.root.children; second.focus();
    const firstGeometry = propertyWrites(first.style, ['left', 'top', 'width', 'height']);
    const secondGeometry = propertyWrites(second.style, ['left', 'top', 'width', 'height']);
    // The caller can reuse and mutate its choices instead of replacing them.
    h.choices[1].x = 80; h.choices[1].y = 100;
    h.choices[1].width = 160; h.choices[1].height = 18;
    h.choices[1].label = 'MÚSICA: 100%';
    h.canvas.getBoundingClientRect = () => ({ left: 18, top: 24, width: 800, height: 450, x: 18, y: 24, right: 818, bottom: 474 });
    h.menu.sync('settings', 'Opções de som', h.choices, 1);
    assert.deepEqual(firstGeometry, []);
    assert.deepEqual(secondGeometry, ['left', 'top', 'width', 'height']);
    assert.equal(second.style.left, '25%'); assert.equal(second.style.top, `${100 / 180 * 100}%`);
    assert.equal(second.style.width, '50%'); assert.equal(second.style.height, '10%');
    assert.equal(second.textContent, 'MÚSICA: 100%'); assert.equal(h.root.getAttribute('aria-label'), 'Opções de som');
    assert.equal(h.root.style.left, '18px'); assert.equal(h.root.style.top, '24px');
    assert.equal(h.root.style.width, '800px'); assert.equal(h.root.style.height, '450px');
    assert.equal(h.doc.activeElement, second);
    h.menu.sync('settings', 'Opções de som', h.choices, 1);
    assert.equal(secondGeometry.length, 4, 'The mutation is applied only once');
    // Clearing recreates native controls; every new button still gets its full geometry.
    h.menu.clear(); h.menu.sync('settings', 'Opções de som', h.choices, 1);
    const replacement = h.root.children[1];
    assert.notEqual(replacement, second); assert.equal(replacement.style.left, '25%');
    assert.equal(replacement.style.top, second.style.top); assert.equal(replacement.style.width, '50%');
    assert.equal(replacement.style.height, '10%'); assert.equal(h.doc.activeElement, replacement);
});

test('normalized CSS geometry stays quiet and external inline changes are repaired', t => {
    const h = setup(t); h.menu.sync('paused', 'Pausa', h.choices, 0);
    const [first, second] = h.root.children; second.focus();
    let normalizedTop = '0%', writes = 0;
    // A browser may serialize a fractional percentage with fewer decimal digits.
    Object.defineProperty(first.style, 'top', {
        configurable: true, enumerable: true,
        get: () => normalizedTop,
        set: value => { writes++; normalizedTop = `${Number.parseFloat(value).toFixed(4)}%`; }
    });
    h.menu.sync('paused', 'Pausa', h.choices, 1);
    assert.equal(normalizedTop, '37.7778%'); assert.equal(writes, 1);
    for (let frame = 0; frame < 600; frame++) h.menu.sync('paused', 'Pausa', h.choices, 1);
    assert.equal(writes, 1, 'Serialized percentages must not cause continuous rewrites');
    first.style.left = '0%'; h.root.hidden = true;
    h.menu.sync('paused', 'Pausa', h.choices, 1);
    assert.equal(first.style.left, '26.25%'); assert.equal(writes, 2);
    assert.equal(h.root.hidden, false); assert.equal(h.doc.activeElement, second);
    (h.canvas as unknown as HTMLCanvasElement).inert = true;
    h.menu.sync('paused', 'Pausa', h.choices, 1);
    assert.equal(h.root.hidden, true); assert.equal(h.root.children.length, 0);
    (h.canvas as unknown as HTMLCanvasElement).inert = false;
    h.menu.sync('paused', 'Pausa', h.choices, 1);
    assert.notEqual(h.root.children[0], first);
    assert.equal(h.root.children[0].style.left, '26.25%');
    assert.equal(h.root.children[0].style.top, `${68 / 180 * 100}%`);
    assert.equal(h.root.hidden, false);
});

test('controller focus is visible and selects without cancelling its own repeat, but native focus still resets', t => {
    const h = setup(t); h.menu.sync('title:0', 'Menu principal', h.choices, 0); h.canvas.focus();
    const before = h.stats().resets;
    assert.equal(h.menu.canControl(), true); assert.equal(h.menu.focusFromController(1), true);
    assert.equal(h.stats().selected, 1); assert.equal(h.stats().resets, before);
    assert.equal(h.root.children[1].style.outline, '2px solid #fff3be');
    assert.equal(h.menu.focusFromController(0), true); assert.equal(h.stats().resets, before);
    h.root.children[1].focus(); assert.equal(h.stats().resets, before + 1);
    const external = h.doc.createElement('input'); external.focus();
    assert.equal(h.menu.canControl(), false); assert.equal(h.menu.focusFromController(0), false);
    assert.equal(h.doc.activeElement, external);
    h.canvas.focus(); h.menu.clear(); assert.equal(h.menu.focusFromController(0), false);
    h.menu.dispose(); assert.equal(h.menu.canControl(), false);
});
