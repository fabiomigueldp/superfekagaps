import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import type { DeliciaInput, DeliciaSimulation } from '../src/adventure/delicia/DeliciaSimulation';

/** DOM/event boundaries only. Constructor, registered handlers, loop and simulation are real. */
function fixture(t: TestContext) {
    let activeElement: Element | null = null;
    class Element extends EventTarget {
        className = ''; dataset: Record<string, string> = {}; hidden = false; disabled = false;
        textContent = ''; parent: Element | null = null; children: Element[] = [];
        attributes = new Map<string, string>(); captureFails = false;
        constructor(readonly tagName: string) { super(); }
        get classList() { return { add: (name: string) => { this.className += ' ' + name; },
            contains: (name: string) => this.className.split(' ').includes(name) }; }
        append(...children: Element[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
        replaceChildren(...children: Element[]) { this.children.forEach(child => child.parent = null); this.children = []; this.append(...children); }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
        setAttribute(name: string, value: string) { this.attributes.set(name, value); }
        removeAttribute(name: string) { this.attributes.delete(name); }
        getContext() { return null; }
        all(): Element[] { return this.children.flatMap(child => [child, ...child.all()]); }
        querySelector() { return this.all().find(node => node.tagName === 'button') ?? null; }
        querySelectorAll() { return this.all().filter(node => node.tagName === 'button'); }
        getClientRects() { return [1]; }
        closest(selector: string): Element | null {
            for (let node: Element | null = this; node; node = node.parent)
                if (selector.split(',').some(tag => tag.trim() === node!.tagName)) return node;
            return null;
        }
        focus() {
            if (activeElement === this) return;
            const old = activeElement; activeElement = this;
            old?.dispatchEvent(new Event('blur')); this.dispatchEvent(new Event('focus'));
        }
        click() { this.dispatchEvent(new Event('click')); }
        setPointerCapture() { if (this.captureFails) throw new DOMException('Capture unavailable'); }
    }
    const body = new Element('body'), window = new EventTarget();
    const document = Object.assign(new EventTarget(), { body, hidden: false, title: '',
        createElement: (tag: string) => new Element(tag) });
    Object.defineProperty(document, 'activeElement', { get: () => activeElement });
    let nextFrame: FrameRequestCallback = () => {}, now = 1000;
    let connected = true;
    const pad = { mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    const original = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({ window, document,
        navigator: { maxTouchPoints: 1, getGamepads: () => connected ? [pad] : [] },
        localStorage: { getItem: () => null, setItem() {} },
        requestAnimationFrame: (callback: FrameRequestCallback) => { nextFrame = callback; return 1; },
        cancelAnimationFrame() {}, fetch: async () => ({ ok: false }) })) {
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, value });
    }
    const url = new URL('../src/adventure/delicia/DeliciaApp.ts', import.meta.url), require = createRequire(url);
    const css = require.extensions['.css']; require.extensions['.css'] = () => {};
    // Vite normally injects this environment value. No handler/source behavior is replaced.
    const source = readFileSync(url, 'utf8').replace('import.meta', '({env:{DEV:false}})');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const module = { exports: {} as typeof import('../src/adventure/delicia/DeliciaApp') };
    runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: url.pathname })(require, module, module.exports);
    const { DeliciaApp } = module.exports;
    const { DeliciaArt } = require('./DeliciaArt') as typeof import('../src/adventure/delicia/DeliciaArt');
    t.mock.method(DeliciaArt.prototype, 'load', async () => {});
    // Rendering is outside the input boundary; all event/lifecycle paths execute unchanged.
    const prototype = DeliciaApp.prototype as unknown as { renderGame(): void; updateHud(): void };
    t.mock.method(prototype, 'renderGame', () => {}); t.mock.method(prototype, 'updateHud', () => {});
    interface App {
        canvas: Element; touch: Element; screen: string; sim: DeliciaSimulation;
        input(): DeliciaInput; loadStage(id: string, retry: boolean): boolean; pause(): void; resume(): void; dispose(): void;
        store: { save: unknown };
    }
    const apps: App[] = [];
    const create = () => { const app = new DeliciaApp(body as unknown as HTMLElement) as unknown as App; apps.push(app);
        assert.equal(app.loadStage('delicia-1', true), true); return app; };
    t.after(() => {
        apps.forEach(app => app.dispose());
        if (css) require.extensions['.css'] = css; else delete require.extensions['.css'];
        for (const [name, descriptor] of original) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
        }
    });
    const app = create();
    function dispatch(type: string, target: Element | EventTarget, values: Record<string, unknown> = {}) {
        const event = new Event(type, { cancelable: true, bubbles: true });
        for (const [name, value] of Object.entries({ target, ...values })) Object.defineProperty(event, name, { value });
        target.dispatchEvent(event);
        if (target instanceof Element) window.dispatchEvent(event);
        return event;
    }
    const key = (type: string, key: string, target: Element = activeElement!, repeat = false, code = '') =>
        dispatch(type, target, { key, code, repeat });
    const pointer = (type: string, target: Element | EventTarget, pointerId = 1) => dispatch(type, target, { pointerId, button: 0 });
    const button = (key: string) => { const b = app.touch.all().find(node => node.dataset.key === key); assert.ok(b); return b; };
    const frame = () => { now += 1000 / 60; nextFrame(now); };
    frame();
    return { app, create, window, document, body, key, pointer, button, frame, pad, disconnect: () => { connected = false; } };
}
function neutral(input: DeliciaInput) { assert.ok(Object.values(input).every(value => value === false), JSON.stringify(input)); }

for (const activation of ['Enter', ' ']) test(`button ${JSON.stringify(activation)} releases when canvas steals focus before keyup`, t => {
    const h = fixture(t), right = h.button('arrowright'); right.focus();
    h.key('keydown', activation); assert.equal(h.app.input().right, true);
    h.pointer('pointerdown', h.app.canvas); assert.equal(h.app.input().right, false);
    h.key('keyup', activation); h.frame(); neutral(h.app.input());
    const stopped = h.app.sim.player.x; h.frame(); assert.equal(h.app.sim.player.x, stopped);
});

test('canceling a sole button jump discards its pending press, while an ordinary quick tap still jumps', t => {
    const h = fixture(t), jump = h.button(' '); jump.focus(); h.key('keydown', 'Enter');
    assert.equal(h.app.input().jumpPressed, true); h.pointer('pointerdown', h.app.canvas);
    assert.equal(h.app.input().jumpPressed, false); h.key('keyup', 'Enter'); h.frame(); neutral(h.app.input());
    h.key('keydown', ' '); h.key('keyup', ' ');
    assert.equal(h.app.input().jumpPressed, true); assert.equal(h.app.input().jumpReleased, true);
    h.frame(); neutral(h.app.input());
});

test('unidentified physical codes keep distinct valid keyboard actions and releases', t => {
    const h = fixture(t);
    h.key('keydown', 'ArrowRight', h.app.canvas, false, 'Unidentified');
    h.key('keydown', 'w', h.app.canvas, false, 'Unidentified');
    assert.equal(h.app.input().right, true); assert.equal(h.app.input().jump, true);
    h.key('keyup', 'ArrowRight', h.app.canvas, false, 'Unidentified');
    assert.equal(h.app.input().right, false); assert.equal(h.app.input().jump, true);
    assert.equal(h.app.input().jumpReleased, false);
    h.key('keyup', 'w', h.app.canvas, false, 'Unidentified');
    assert.equal(h.app.input().jump, false); assert.equal(h.app.input().jumpReleased, true);
    h.frame(); neutral(h.app.input());
});

test('window keyup releases the translated button owner even without a focus event', t => {
    const h = fixture(t); h.button('arrowright').focus();
    h.key('keydown', 'Enter', undefined, false, 'Enter');
    h.key('keyup', 'Enter', h.app.canvas, false, 'Enter');
    assert.equal(h.app.input().right, false);
});

test('focus cancellation and one pointer release preserve the remaining keyboard and pointer owners', t => {
    const h = fixture(t), right = h.button('arrowright');
    h.key('keydown', 'ArrowRight', h.app.canvas); h.pointer('pointerdown', right, 1); h.pointer('pointerdown', right, 2);
    right.focus(); h.key('keydown', 'Enter'); h.app.canvas.focus();
    h.key('keyup', 'Enter'); assert.equal(h.app.input().right, true);
    h.pointer('pointerup', right, 1); assert.equal(h.app.input().right, true);
    h.key('keyup', 'ArrowRight'); assert.equal(h.app.input().right, true);
    h.pointer('pointercancel', right, 2); assert.equal(h.app.input().right, false);
    h.key('keydown', 'd'); h.pointer('pointerdown', right); h.pointer('lostpointercapture', right);
    assert.equal(h.app.input().right, true); h.key('keyup', 'd'); assert.equal(h.app.input().right, false);
});

test('button Enter and Space are independent owners, and auto-repeat cannot restart a canceled press', t => {
    const h = fixture(t), right = h.button('arrowright'); right.focus();
    h.key('keydown', 'Enter'); h.key('keydown', ' '); h.key('keyup', 'Enter'); assert.equal(h.app.input().right, true);
    h.key('keyup', ' '); assert.equal(h.app.input().right, false);
    h.key('keydown', 'Enter'); h.app.canvas.focus(); right.focus(); h.key('keydown', 'Enter', right, true);
    assert.equal(h.app.input().right, false); h.key('keyup', 'Enter'); h.key('keydown', 'Enter');
    assert.equal(h.app.input().right, true);
});

test('keyboard aliases, button, pointers and gamepad share one jump edge until the last owner releases', t => {
    const h = fixture(t), jump = h.button(' ');
    h.key('keydown', ' ', h.app.canvas); h.frame(); assert.equal(h.app.input().jumpPressed, false);
    h.key('keydown', 'w'); h.pointer('pointerdown', jump); jump.focus(); h.key('keydown', 'Enter');
    assert.equal(h.app.input().jumpPressed, false, 'Additional owners cannot synthesize another jump');
    h.pad.buttons[0].pressed = true; h.frame(); h.app.canvas.focus();
    h.key('keyup', ' '); h.key('keyup', 'w'); h.pointer('pointerup', jump);
    assert.equal(h.app.input().jump, true); assert.equal(h.app.input().jumpReleased, false);
    h.disconnect(); h.frame(); neutral(h.app.input());
});

test('releasing gamepad jump preserves a keyboard owner without a phantom release edge', t => {
    const h = fixture(t); h.pad.buttons[0].pressed = true; h.frame();
    h.key('keydown', 'w'); h.pad.buttons[0].pressed = false; h.frame();
    assert.equal(h.app.input().jump, true); assert.equal(h.app.input().jumpReleased, false);
    h.key('keyup', 'w'); assert.equal(h.app.input().jumpReleased, true);
    h.key('keyup', ' '); assert.equal(h.app.input().jumpReleased, true); h.frame(); neutral(h.app.input());
    h.key('keyup', ' '); neutral(h.app.input());
});

test('pointer capture failure still releases outside the button via the window', t => {
    const h = fixture(t), right = h.button('arrowright'); right.captureFails = true;
    h.pointer('pointerdown', right); assert.equal(h.app.input().right, true);
    h.pointer('pointerup', h.window); assert.equal(h.app.input().right, false);
    h.pointer('pointerdown', right); h.pointer('pointercancel', h.window); assert.equal(h.app.input().right, false);
});

for (const interrupt of ['pause', 'blur', 'hidden']) test(`${interrupt} clears held controls, pending edges and late terminal events`, t => {
    const h = fixture(t), jump = h.button(' '); const save = structuredClone(h.app.store.save);
    h.key('keydown', 'd'); h.pointer('pointerdown', jump); jump.focus(); h.key('keydown', 'Enter');
    if (interrupt === 'pause') h.app.pause();
    else if (interrupt === 'blur') h.window.dispatchEvent(new Event('blur'));
    else { h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange')); }
    assert.equal(h.app.screen, 'pause'); neutral(h.app.input());
    h.pointer('pointerdown', jump, 2); h.key('keydown', ' ', jump); neutral(h.app.input());
    h.app.resume(); h.key('keyup', 'd'); h.key('keyup', 'Enter'); h.pointer('pointerup', jump); h.pointer('lostpointercapture', jump);
    neutral(h.app.input()); h.frame(); neutral(h.app.input());
    assert.deepEqual(h.app.store.save, save);
    h.key('keydown', 'w'); assert.equal(h.app.input().jumpPressed, true);
});

test('pause and immediate resume latch a still-held gamepad without needing an intervening frame', t => {
    const h = fixture(t); h.pad.buttons[0].pressed = true; h.frame();
    h.app.pause(); h.app.resume(); h.frame(); neutral(h.app.input());
    h.pad.buttons[0].pressed = false; h.frame(); neutral(h.app.input());
    h.pad.buttons[0].pressed = true; h.frame(); assert.equal(h.app.input().jump, true);
});

test('disposal removes retained button handlers and a new visit starts without stale jump edges', t => {
    const h = fixture(t), oldJump = h.button(' '); oldJump.focus(); h.key('keydown', 'Enter'); h.pointer('pointerdown', oldJump);
    h.window.dispatchEvent(new Event('pagehide')); neutral(h.app.input());
    h.key('keydown', 'Enter', oldJump); h.pointer('pointerdown', oldJump); h.key('keyup', ' '); neutral(h.app.input());
    const next = h.create(); h.key('keyup', 'Enter'); h.pointer('pointerup', oldJump); h.frame(); neutral(next.input());
    h.key('keydown', 'w', next.canvas); assert.equal(next.input().jumpPressed, true); neutral(h.app.input());
});
