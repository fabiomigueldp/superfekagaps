import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Input } from '../src/engine/Input';
import { freshSave, SAVE_KEY } from '../src/adventure/progress';
import { WorldGame } from '../src/adventure/WorldGame';
import { JuiceMinibossLab } from '../src/adventure/experimental/JuiceMinibossLab';

const STEP = 1000 / 60;
type Listener = (event: Record<string, unknown>) => void;

/** Browser boundaries only: the lab, renderer, input, player and encounter are real. */
class EventSurface {
    private listeners = new Map<string, Array<{ listener: Listener; capture: boolean }>>();
    addEventListener(type: string, listener: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), { listener, capture }]);
    }
    dispatch(type: string, data: Record<string, unknown> = {}) {
        let prevented = false;
        const event = { target: this, currentTarget: this, repeat: false,
            preventDefault() { prevented = true; }, ...data };
        const listeners = this.listeners.get(type) ?? [];
        for (const capture of [true, false])
            for (const entry of listeners) if (entry.capture === capture) entry.listener(event);
        return prevented;
    }
}

class Element extends EventSurface {
    id = '';
    tagName = 'DIV';
    className = '';
    title = '';
    children: Element[] = [];
    readonly attributes = new Map<string, string>();
    private ownText = '';
    get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join(''); }
    set textContent(value: string) { this.ownText = value; this.children = []; }
    hidden = false;
    contentEditable = 'false';
    spellcheck = true;
    style: Record<string, string> = {};
    focused = false;
    closest(selector: string): Element | null {
        return this.tagName === 'BUTTON' && selector.includes('button') || this.tagName === 'A' && selector.includes('a[href]') ? this : null;
    }
    matches() { return false; }
    get isContentEditable() { return this.contentEditable === 'true'; }
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
    focus() { this.focused = true; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 360 }; }
}

class Canvas extends Element {
    width = 640;
    height = 360;
    drawCalls = 0;
    private context = Object.assign(Object.fromEntries([
        'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'fill', 'stroke',
        'fillRect', 'strokeRect', 'clearRect', 'save', 'restore', 'setTransform', 'translate',
        'scale', 'rotate', 'rect', 'clip', 'drawImage'
    ].map(name => [name, () => { this.drawCalls++; }])), {
        globalAlpha: 1, imageSmoothingEnabled: false,
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} })
    }) as unknown as CanvasRenderingContext2D;
    getContext() { return this.context; }
}

function browser(t: TestContext) {
    const canvas = new Canvas(); canvas.id = 'game-canvas';
    const status = new Element(); status.id = 'lab-status';
    const retry = new Element(); retry.id = 'lab-retry';
    const pause = new Element(); pause.id = 'lab-pause';
    const skip = new Element(); skip.id = 'lab-skip';
    const replay = new Element(); replay.id = 'lab-replay';
    const present = new Element(); present.id = 'lab-present';
    const exit = new Element(); exit.id = 'lab-exit'; exit.tagName = 'A';
    for (const button of [retry, pause, skip, replay, present]) button.tagName = 'BUTTON';
    const elements = new Map<string, Element>([canvas, status, retry, pause, skip, replay, present, exit].map(element => [element.id, element]));
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; };
    const document = Object.assign(new EventSurface(), {
        title: '', hidden: false, body: { style: {} }, querySelector: () => null,
        getElementById: (id: string) => elements.get(id) ?? null,
        createElement: (tag: string) => tag === 'canvas' ? new Canvas() : new Element()
    });
    const window = Object.assign(new EventSurface(), {
        innerWidth: 640, innerHeight: 440, devicePixelRatio: 1, requestAnimationFrame: requestFrame,
        worldGame: undefined as WorldGame | undefined
    });
    const savedCampaign = JSON.stringify({ ...freshSave(), completed: ['1-1'], selected: '1-2' });
    const storageCalls: string[] = [];
    const storage = {
        getItem(key: string) { storageCalls.push(`get:${key}`); return key === SAVE_KEY ? savedCampaign : null; },
        setItem(key: string) { storageCalls.push(`set:${key}`); },
        removeItem(key: string) { storageCalls.push(`remove:${key}`); },
        clear() { storageCalls.push('clear'); }
    };
    const original = new Map<string, PropertyDescriptor | undefined>();
    function global(name: string, descriptor: PropertyDescriptor) {
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
    }
    t.after(() => {
        for (const [name, descriptor] of original) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
        assert.deepEqual(storageCalls, [], 'The ephemeral lab must not even look up localStorage.');
    });
    for (const [name, value] of Object.entries({ document, window, HTMLElement: Element,
        navigator: { maxTouchPoints: 0 }, location: { hash: '' },
        innerWidth: window.innerWidth, innerHeight: window.innerHeight, requestAnimationFrame: requestFrame }))
        global(name, { writable: true, value });
    const storageDescriptor = { get() { storageCalls.push('localStorage'); return storage; } };
    global('localStorage', storageDescriptor);
    Object.defineProperty(window, 'localStorage', storageDescriptor);

    function key(key: string, repeat = false) {
        const code = key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key;
        window.dispatch('keydown', { key, code, repeat, target: canvas });
        if (!repeat) window.dispatch('keyup', { key, code, target: canvas });
    }
    function pointer(x: number, y: number) { canvas.dispatch('pointerdown', { clientX: x * 2, clientY: y * 2 }); }
    function hidden(value: boolean) { document.hidden = value; document.dispatch('visibilitychange'); }
    function create(withIntro = false) { const game = new JuiceMinibossLab(canvas as unknown as HTMLCanvasElement, status as unknown as HTMLElement); if (!withIntro) game.skipIntro(); return game; }
    function frame() {
        const pending = [...frames]; frames.clear();
        for (const [, callback] of pending) callback(performance.now());
    }
    return { canvas, status, retry, pause, skip, replay, present, exit, document, window, frames, storageCalls, create, key, pointer, hidden, frame };
}

function finger(canvas: Canvas, identifier: number, x: number, y = 324) {
    return { target: canvas, identifier, clientX: x, clientY: y };
}

test('intro exposes only the controls required by its current beat and keeps combat controls hidden', t => {
    const h = browser(t);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { maxTouchPoints: 5 } });
    const game = h.create(true);
    const calls: string[] = [];
    game.renderer.drawIntroTouchControls = beat => { calls.push(beat); };
    game.renderer.drawTouchControls = () => { assert.fail('combat controls must not cover the intro'); };
    game.render(); assert.deepEqual(calls, []);
    for (let i = 0; i < 240; i++) game.update(STEP);
    assert.equal(game.intro?.beat, 'walk'); game.render(); assert.deepEqual(calls, ['walk']);
    h.canvas.dispatch('touchstart', { touches: [finger(h.canvas, 8, 128)] });
    for (let i = 0; i < 80; i++) game.update(STEP);
    h.canvas.dispatch('touchend', { touches: [] });
    for (let i = 0; i < 100; i++) game.update(STEP);
    assert.equal(game.intro?.beat, 'prepare');
    game.render(); assert.deepEqual(calls, ['walk', 'prepare']);
    h.canvas.dispatch('touchstart', { touches: [finger(h.canvas, 9, 576)] });
    game.update(STEP);
    assert.notEqual(game.intro?.beat, 'prepare');
    calls.length = 0; game.render(); assert.deepEqual(calls, []);
});

test('campaign blur pauses active play and focus or visibility cannot resume it', t => {
    const h = browser(t); const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    game.load('1-1'); const before = game.elapsed;
    h.window.dispatch('blur'); assert.equal(game.state, 'paused'); assert.equal(h.document.hidden, false);
    for (let i = 0; i < 60; i++) game.update(STEP);
    assert.equal(game.elapsed, before);
    h.window.dispatch('blur'); h.window.dispatch('focus'); h.hidden(false);
    assert.equal(game.state, 'paused');
    h.key('Escape'); assert.equal(game.state, 'playing');
    game.update(STEP); assert.ok(game.elapsed > before);
    game.state = 'map'; h.window.dispatch('blur'); assert.equal(game.state, 'map');
});

test('lab blur clears a queued presentation and preserves paused intro across focus', t => {
    const h = browser(t); const game = h.create(true);
    for (let i = 0; i < 240; i++) game.update(STEP);
    h.window.dispatch('keydown', { key: 'd', code: 'KeyD', target: h.canvas });
    for (let i = 0; i < 100; i++) game.update(STEP);
    h.window.dispatch('keyup', { key: 'd', code: 'KeyD', target: h.canvas });
    for (let i = 0; i < 100; i++) game.update(STEP);
    assert.equal(game.intro?.beat, 'prepare');
    game.presentIntro(); h.window.dispatch('blur'); h.window.dispatch('focus');
    game.update(STEP); assert.equal(game.state, 'paused'); assert.equal(game.intro?.beat, 'prepare');
    game.toggleLabPause(); game.update(STEP); assert.equal(game.intro?.beat, 'prepare');
});

test('cancelled touch edges disappear without affecting keyboard or other fingers', t => {
    const h = browser(t); const input = new Input();
    for (const x of [576, 320]) {
        input.reset(); const f = finger(h.canvas, 41, x);
        h.canvas.dispatch('touchstart', { touches: [f] });
        h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [f] });
        input.update(); assert.equal(input.getState().jumpPressed, false);
        assert.equal(input.getState().jumpReleased, false); assert.equal(input.getState().downPressed, false);
    }
    const menu = finger(h.canvas, 42, 320, 20);
    h.canvas.dispatch('touchstart', { touches: [menu] });
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [menu] });
    input.update(); assert.equal(input.consumePause(), false);
    const jump = finger(h.canvas, 70, 576), down = finger(h.canvas, 71, 320), left = finger(h.canvas, 72, 30);
    h.canvas.dispatch('touchstart', { touches: [jump, down, left] });
    h.window.dispatch('keydown', { key: ' ', code: 'Space', target: h.canvas });
    h.window.dispatch('keydown', { key: 'Escape', code: 'Escape', target: h.canvas });
    h.canvas.dispatch('touchcancel', { touches: [down, left], changedTouches: [jump] });
    input.update(); const state = input.getState();
    assert.equal(state.jumpPressed, true); assert.equal(state.jump, true);
    assert.equal(state.downPressed, true); assert.equal(state.down, true); assert.equal(state.left, true);
    assert.equal(input.consumePause(), true);
});

test('same-action surviving finger retains pending press, and ordinary short taps remain valid', t => {
    const h = browser(t); const input = new Input();
    const a = finger(h.canvas, 1, 576), b = finger(h.canvas, 2, 600);
    h.canvas.dispatch('touchstart', { touches: [a, b] });
    h.canvas.dispatch('touchcancel', { touches: [b], changedTouches: [a] });
    input.update(); assert.equal(input.getState().jumpPressed, true); assert.equal(input.getState().jump, true);
    input.reset();
    h.canvas.dispatch('touchstart', { touches: [a] });
    h.canvas.dispatch('touchend', { touches: [], changedTouches: [a] });
    h.canvas.dispatch('touchstart', { touches: [a] });
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [a] });
    input.update(); assert.equal(input.getState().jumpPressed, true); assert.equal(input.getState().jumpReleased, true);
    input.update(); assert.equal(input.getState().jumpPressed, false);
});

test('cancelling movement does not create edges from untouched remaining fingers', t => {
    const h = browser(t); const input = new Input();
    const jump = finger(h.canvas, 10, 576), left = finger(h.canvas, 11, 30);
    h.canvas.dispatch('touchstart', { touches: [jump, left] }); input.update();
    h.canvas.dispatch('touchcancel', { touches: [jump], changedTouches: [left] }); input.update();
    assert.equal(input.getState().jump, true); assert.equal(input.getState().jumpPressed, false);
    assert.equal(input.getState().left, false);
    h.window.dispatch('blur'); input.update();
    assert.equal(input.getState().jump, false); assert.equal(input.getState().jumpReleased, false);
});
