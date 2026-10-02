import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { Input, type InputAction } from '../src/engine/Input';
import { GuairaTouchControls } from '../src/adventure/experimental/guaira/GuairaTouchControls';

type EventData = Record<string, unknown>;
type Listener = (event: EventData) => void;
class Surface {
    readonly listeners = new Map<string, Array<{ fn: Listener; capture: boolean }>>();
    addEventListener(type: string, fn: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), { fn, capture }]);
    }
    removeEventListener(type: string, fn: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        this.listeners.set(type, (this.listeners.get(type) ?? []).filter(entry => entry.fn !== fn || entry.capture !== capture));
    }
    dispatch(type: string, data: EventData = {}) {
        let prevented = false;
        const event = { target: this, currentTarget: this, repeat: false, button: 0,
            preventDefault() { prevented = true; }, ...data };
        for (const capture of [true, false]) for (const entry of [...(this.listeners.get(type) ?? [])]) if (entry.capture === capture) entry.fn(event);
        return prevented;
    }
    get listenerCount() { return [...this.listeners.values()].reduce((count, entries) => count + entries.length, 0); }
}
class Element extends Surface {
    id = ''; className = ''; title = ''; type = ''; width = 0; height = 0; hidden = false; disabled = false;
    children: Element[] = []; parent: Element | null = null; textContent = '';
    readonly attributes = new Map<string, string>();
    readonly captures = new Set<number>();
    draws = 0; failCapture = false;
    constructor(readonly tagName = 'DIV') { super(); }
    append(...children: Element[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    closest(selector: string): Element | null {
        if (this.tagName === 'BUTTON' && selector.includes('button')) return this;
        return this.parent?.closest(selector) ?? null;
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 180 }; }
    setPointerCapture(id: number) { if (this.failCapture) throw new Error('capture unavailable'); this.captures.add(id); }
    hasPointerCapture(id: number) { return this.captures.has(id); }
    releasePointerCapture(id: number) { this.captures.delete(id); this.dispatch('lostpointercapture', { pointerId: id }); }
    getContext() { return { setTransform() {}, clearRect() {}, fillRect: () => this.draws++, imageSmoothingEnabled: false }; }
}
class Media extends Surface { matches = false; }

/** DOM/event boundaries only; Input and the complete control helper are production classes. */
function fixture(t: TestContext, touch = 5, pointer = true) {
    const win = new Surface(), doc = Object.assign(new Surface(), { hidden: false });
    const media = new Media(), body = new Element(), canvas = new Element('CANVAS'); canvas.id = 'game-canvas';
    const globals: Record<string, unknown> = {
        window: Object.assign(win, { requestAnimationFrame() { assert.fail('The canvas already exists; no retry loop should start.'); } }),
        document: Object.assign(doc, { body, getElementById: () => canvas, createElement: (tag: string) => new Element(tag.toUpperCase()) }),
        HTMLElement: Element, PointerEvent: pointer ? class {} : undefined,
        navigator: { maxTouchPoints: touch }, matchMedia: () => media
    };
    const original = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries(globals)) { original.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, value }); }
    const input = new Input(); let playing = true, interactions = 0;
    const visibility: boolean[] = [];
    const beforeListeners = win.listenerCount + doc.listenerCount + media.listenerCount;
    const bar = new GuairaTouchControls({ input, isPlaying: () => playing, onInteract: () => interactions++, onVisibilityChange: value => visibility.push(value) });
    const root = bar.root as unknown as Element;
    const buttons = Object.fromEntries(root.children.map(button => [button.getAttribute('data-action')!, button])) as Record<InputAction, Element>;
    t.after(() => {
        bar.dispose();
        for (const [name, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
    });
    function down(action: InputAction, id = 1) { return buttons[action].dispatch('pointerdown', { pointerId: id }); }
    function up(id = 1, cancelled = false) { win.dispatch(cancelled ? 'pointercancel' : 'pointerup', { pointerId: id }); }
    function key(type: 'keydown' | 'keyup', key: string, target = canvas, repeat = false) {
        const code = key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key;
        const data = { key, code, target, repeat };
        const globalPrevented = win.dispatch(type, data); const localPrevented = target.dispatch(type, data);
        return globalPrevented || localPrevented;
    }
    function step() { input.update(); return input.getState(); }
    return { win, doc, media, body, canvas, input, bar, root, buttons, down, up, key, step, visibility, beforeListeners,
        setPlaying: (value: boolean) => { playing = value; }, interactions: () => interactions };
}

function finger(canvas: Element, identifier: number, x = .93, y = .9) { return { target: canvas, identifier, clientX: x * 320, clientY: y * 180 }; }

test('five semantic bitmap plates stay44×44 outside canvas scale and fit320CSSpx', t => {
    const h = fixture(t);
    assert.equal(h.bar.visible, true); assert.deepEqual(h.visibility, [true]);
    assert.equal(h.root.id, 'guaira-touch-controls'); assert.equal(h.root.getAttribute('role'), 'group');
    assert.equal(h.root.children.length, 5);
    assert.deepEqual(h.root.children.map(button => button.getAttribute('data-symbol')), ['←', '→', '↓', 'X', '↑']);
    for (const button of h.root.children) {
        assert.equal(button.tagName, 'BUTTON'); assert.equal(button.type, 'button'); assert.equal(button.disabled, false);
        assert.ok(button.getAttribute('aria-label')); assert.equal(button.children[0].getAttribute('aria-hidden'), 'true');
        assert.equal(button.children[0].width, 44); assert.equal(button.children[0].height, 44); assert.ok(button.children[0].draws > 0);
    }
    const css = readFileSync(new URL('../src/adventure/experimental/guaira/guaira-touch-controls.css', import.meta.url), 'utf8');
    for (const property of ['width', 'height', 'min-width', 'min-height']) assert.match(css, new RegExp(`\\b${property}: 44px`));
    assert.match(css, /flex: 0 0 44px/); assert.match(css, /position: fixed/);
    assert.match(css, /gap: 8px/); assert.match(css, /forced-colors: active/);
    assert.match(css, /content: attr\(data-symbol\)/, 'high contrast shows a short symbol while the full accessible name stays available');
    assert.equal(5 * 44 + 4 * 8 + 2 * 6, 264, 'The CSS dimensions require264px without safe-area insets, independent of canvas dimensions.');
});

test('fine-pointer desktop stays hidden; coarse capability enables and restores canvas controls', t => {
    const h = fixture(t, 0);
    assert.equal(h.bar.visible, false); h.down('jump'); assert.equal(h.step().jumpPressed, false);
    const f = finger(h.canvas, 1);
    h.canvas.dispatch('touchstart', { touches: [f] }); assert.equal(h.step().jumpPressed, true); h.input.reset();
    h.media.matches = true; h.media.dispatch('change'); assert.equal(h.bar.visible, true);
    h.canvas.dispatch('touchstart', { touches: [f] }); assert.equal(h.step().jumpPressed, false);
    h.down('jump'); h.media.matches = false; h.media.dispatch('change'); assert.equal(h.bar.visible, false);
    assert.equal(h.step().jumpPressed, false); assert.equal(h.buttons.jump.captures.size, 0);
    h.canvas.dispatch('touchstart', { touches: [f] }); assert.equal(h.step().jumpPressed, true);
});

test('legacy touch controls remain available when PointerEvent is unavailable', t => {
    const h = fixture(t, 5, false); assert.equal(h.bar.visible, false);
    h.canvas.dispatch('touchstart', { touches: [finger(h.canvas, 1)] }); assert.equal(h.step().jumpPressed, true);
});

test('multiple pointers hold move/run/jump and cancelling jump leaves other actions alone', t => {
    const h = fixture(t);
    assert.equal(h.down('right', 1), true); h.down('run', 2); h.down('jump', 3);
    const first = h.step(); assert.equal(first.right, true); assert.equal(first.run, true); assert.equal(first.jumpPressed, true);
    h.up(3, true); const cancelled = h.step(); assert.equal(cancelled.jump, false); assert.equal(cancelled.jumpReleased, false);
    assert.equal(cancelled.right, true); assert.equal(cancelled.run, true);
    h.up(1); h.up(2); const released = h.step(); assert.equal(released.right, false); assert.equal(released.run, false);
    assert.equal(h.root.children.some(button => button.getAttribute('data-held')), false);
});

test('same-action fingers own separate pending edges and ordinary release retains the survivor', t => {
    const h = fixture(t); h.down('jump', 1); h.down('jump', 2); h.up(1, true);
    assert.equal(h.buttons.jump.getAttribute('data-held'), 'true');
    let state = h.step(); assert.equal(state.jumpPressed, true); assert.equal(state.jump, true);
    h.up(2); state = h.step(); assert.equal(state.jumpReleased, true); assert.equal(state.jump, false);
});

test('cancel cannot erase keyboard or another source edge; keyboard still controls directions', t => {
    const h = fixture(t); h.down('jump', 1); h.down('down', 2); h.key('keydown', ' '); h.key('keydown', 'Escape'); h.key('keydown', 'ArrowLeft');
    h.up(1, true); const state = h.step();
    assert.equal(state.jumpPressed, true); assert.equal(state.jump, true); assert.equal(state.downPressed, true);
    assert.equal(state.left, true); assert.equal(h.input.consumePause(), true);
    h.down('right', 3); assert.equal(h.step().left, true); h.key('keyup', 'ArrowLeft'); assert.equal(h.step().right, true);
    h.key('keyup', ' '); h.up(2, true); h.up(3); assert.equal(h.step().jumpReleased, true);
});

for (const action of ['left', 'right', 'run', 'down', 'jump'] as const) test(`a ${action} tap shorter than a frame survives exactly once`, t => {
    const h = fixture(t); h.down(action); h.up();
    const state = h.step();
    if (action === 'jump') { assert.equal(state.jumpPressed, true); assert.equal(state.jumpReleased, true); }
    else if (action === 'down') assert.equal(state.downPressed, true);
    else assert.equal(state[action], true);
    const next = h.step(); assert.equal(next[action], false); assert.equal(next.jumpPressed, false); assert.equal(next.downPressed, false);
});

test('reusing a pointer then cancelling never erases its previous finished tap', t => {
    const h = fixture(t); h.down('jump'); h.up(); h.down('jump'); h.up(1, true);
    const state = h.step(); assert.equal(state.jumpPressed, true); assert.equal(state.jumpReleased, true); assert.equal(state.jump, false);
});

test('lost capture and failed capture both release reliably without a cancelled command', t => {
    const h = fixture(t); h.down('down', 1); h.buttons.down.releasePointerCapture(1);
    assert.equal(h.step().downPressed, false); assert.equal(h.step().down, false);
    h.buttons.jump.failCapture = true; h.down('jump', 2); h.up(2); assert.equal(h.step().jumpPressed, true);
    h.down('run', 3); h.up(3, true); assert.equal(h.step().run, false);
});

test('pause/retry reset invalidates captures so old move/up/click cannot re-arm the game', t => {
    const h = fixture(t); h.down('jump', 7); h.down('right', 8);
    h.input.reset(); assert.equal(h.buttons.jump.captures.size, 0); assert.equal(h.buttons.right.captures.size, 0);
    h.buttons.jump.dispatch('pointermove', { pointerId: 7 }); h.up(7); h.up(8);
    h.buttons.jump.dispatch('click', { detail: 1 });
    let state = h.step(); assert.equal(state.jumpPressed, false); assert.equal(state.right, false);
    h.down('jump', 9); h.setPlaying(false); h.up(9); state = h.step(); assert.equal(state.jumpPressed, false);
    h.bar.sync(); assert.ok(h.root.children.every(button => button.disabled));
    h.buttons.jump.dispatch('click', { detail: 0 }); h.down('right'); assert.equal(h.step().right, false);
    h.setPlaying(true); h.bar.sync(); h.down('jump', 10); assert.equal(h.step().jumpPressed, true);
});

test('blur and hidden cancel pending gestures and showing the page never resumes them', t => {
    const h = fixture(t); h.down('jump'); h.win.dispatch('blur'); assert.equal(h.step().jumpPressed, false);
    h.down('right'); h.doc.hidden = true; h.doc.dispatch('visibilitychange'); assert.equal(h.step().right, false);
    h.doc.hidden = false; h.doc.dispatch('visibilitychange'); h.up(); assert.equal(h.step().right, false);
});

test('native control activation uses its own action and toolbar Enter/Space never leak jump/start', t => {
    const h = fixture(t); const toolbar = new Element('BUTTON');
    for (const key of [' ', 'Enter']) { h.key('keydown', key, toolbar); h.key('keyup', key, toolbar); }
    let state = h.step(); assert.equal(state.jumpPressed, false); assert.equal(state.start, false);
    h.key('keydown', ' ', h.buttons.left); h.key('keyup', ' ', h.buttons.left);
    state = h.step(); assert.equal(state.left, true); assert.equal(state.jumpPressed, false); assert.equal(state.start, false);
    h.key('keydown', 'Enter', h.buttons.jump); h.key('keydown', 'Enter', h.buttons.jump, true); h.step();
    h.key('keyup', 'Enter', h.buttons.jump); state = h.step(); assert.equal(state.jumpPressed, false); assert.equal(state.jumpReleased, true);
    h.buttons.down.dispatch('click', { detail: 0 }); state = h.step(); assert.equal(state.downPressed, true); assert.equal(state.jumpPressed, false);
    assert.equal(h.interactions(), 3);
});

test('keyboard release after a live pause cancels before the next UI reflection', t => {
    const h = fixture(t); h.key('keydown', 'Enter', h.buttons.jump); h.setPlaying(false);
    h.key('keyup', 'Enter', h.buttons.jump);
    const state = h.step(); assert.equal(state.jumpPressed, false); assert.equal(state.jumpReleased, false);
    assert.equal(h.buttons.jump.getAttribute('data-held'), null);
});

test('interaction callbacks can reset or blur without leaving newly registered gestures alive', t => {
    const h = fixture(t); h.bar.dispose();
    let reset = true;
    const bar = new GuairaTouchControls({ input: h.input, isPlaying: () => true, onInteract: () => {
        if (reset) h.input.reset(); else button.dispatch('blur');
    } });
    t.after(() => bar.dispose());
    const button = (bar.root as unknown as Element).children[4];
    button.dispatch('pointerdown', { pointerId: 15, button: 0 });
    assert.equal(button.captures.size, 0); assert.equal(h.step().jumpPressed, false);
    button.dispatch('click', { detail: 0 });
    assert.equal(h.step().jumpPressed, false, 'An assistive click is owned before a callback resets the game.');
    reset = false; h.key('keydown', 'Enter', button);
    assert.equal(button.getAttribute('data-held'), null); assert.equal(h.step().jumpPressed, false);
    h.key('keyup', 'Enter', button); assert.equal(h.step().jumpReleased, false);
});

test('sources stay scoped to one Input and disposed sources cannot write again', t => {
    const h = fixture(t), other = new Input(); const source = h.input.createActionSource();
    source.press('jump'); source.press('jump'); other.update(); assert.equal(other.getState().jumpPressed, false);
    assert.equal(h.step().jumpPressed, true); source.press('jump'); assert.equal(h.step().jumpPressed, false);
    source.cancel(); source.dispose(); source.press('jump'); assert.equal(h.step().jumpPressed, false);
});

test('canvas suppression cancels even an active finger slid outside its region and restores by owner', t => {
    const h = fixture(t, 0), f = finger(h.canvas, 1);
    h.canvas.dispatch('touchstart', { touches: [f] });
    h.canvas.dispatch('touchmove', { touches: [{ ...f, clientY: 90 }] });
    const restoreA = h.input.suspendCanvasTouchControls(), restoreB = h.input.suspendCanvasTouchControls();
    assert.equal(h.step().jumpPressed, false); restoreA(); restoreA();
    h.canvas.dispatch('touchstart', { touches: [f] }); assert.equal(h.step().jumpPressed, false);
    restoreB(); h.canvas.dispatch('touchstart', { touches: [f] }); assert.equal(h.step().jumpPressed, true);
});

test('DOM input survives unrelated legacy touches and cancellation stays source-owned', t => {
    const h = fixture(t, 0), a = h.input.createActionSource(), b = h.input.createActionSource();
    a.press('jump'); b.press('jump');
    const f = finger(h.canvas, 1, .1); h.canvas.dispatch('touchstart', { touches: [f] });
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [f] }); a.cancel();
    const state = h.step(); assert.equal(state.jumpPressed, true); assert.equal(state.jump, true); assert.equal(state.left, false);
    a.dispose(); b.dispose();
});

test('dispose removes every owned listener/capture, restores legacy touch and is repeatable', t => {
    const h = fixture(t); h.down('jump'); h.down('run', 2);
    h.bar.dispose(); h.bar.dispose();
    assert.equal(h.bar.visible, false); assert.equal(h.body.children.length, 0);
    assert.equal(h.win.listenerCount + h.doc.listenerCount + h.media.listenerCount, h.beforeListeners);
    assert.ok(h.root.children.every(button => button.listenerCount === 0 && button.captures.size === 0));
    assert.equal(h.step().jumpPressed, false); assert.equal(h.step().run, false);
    h.down('jump'); h.buttons.jump.dispatch('click', { detail: 0 }); assert.equal(h.step().jumpPressed, false);
    h.canvas.dispatch('touchstart', { touches: [finger(h.canvas, 1)] }); assert.equal(h.step().jumpPressed, true);
});
