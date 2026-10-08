import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import type { DeliciaInput, DeliciaSimulation } from '../src/adventure/delicia/DeliciaSimulation';
import { DeliciaStore } from '../src/adventure/delicia/DeliciaProgress';
import { ProgressStore } from '../src/adventure/progress';
import type { DeliciaAppOptions } from '../src/adventure/delicia/DeliciaApp';

/** DOM/event boundaries only. Constructor, registered handlers, loop and simulation are real. */
function fixture(t: TestContext, initiallyFocused = true) {
    let focused = initiallyFocused;
    let activeElement: Element | null = null;
    class Element extends EventTarget {
        style: Record<string, string> = {};
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
        getAttribute(name: string) { return this.attributes.get(name) ?? null; }
        getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
        blur() { if (activeElement === this) { activeElement = null; this.dispatchEvent(new Event('blur')); } }
        getContext() { return new Proxy({}, { get: () => () => {}, set: () => true }); }
        all(): Element[] { return this.children.flatMap(child => [child, ...child.all()]); }
        querySelector() { return this.all().find(node => node.tagName === 'button') ?? null; }
        querySelectorAll() { return this.all().filter(node => node.tagName === 'button'); }
        getClientRects() { return [1]; }
        closest(selector: string): Element | null {
            for (let node: Element | null = this; node; node = node.parent)
                if (selector.split(',').some(tag => tag.trim() === node!.tagName || tag.trim().startsWith('.') && node!.className.split(' ').includes(tag.trim().slice(1)))) return node;
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
    const body = new Element('body'), window = Object.assign(new EventTarget(), { innerWidth: 960, innerHeight: 540, devicePixelRatio: 1 });
    const document = Object.assign(new EventTarget(), { body, hidden: false, title: '',
        hasFocus: () => focused, getElementById: () => null, createElement: (tag: string) => new Element(tag) });

    Object.defineProperty(document, 'activeElement', { get: () => activeElement });
    let nextFrame: FrameRequestCallback = () => {}, now = 1000;
    let connected = true;
    const pad = { index: 0, id: 'test-pad', connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    const original = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({ window, document, location: { hash: '' },
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
        canvas: Element; touch: Element; panel: Element; screen: string; sim: DeliciaSimulation;
        input(): DeliciaInput; loadStage(id: string, retry: boolean): boolean; pause(): void; resume(): void; dispose(): void;
        store: { save: unknown }; dialogueTime: number; menu: { text: string; choices: { label: string; run(): void }[] };
    }
    const apps: App[] = [], nativeCleanups: (() => void)[] = [];
    const create = (options?: DeliciaAppOptions) => { const app = new DeliciaApp(body as unknown as HTMLElement, options) as unknown as App; apps.push(app);
        if (!options?.initialStage) assert.equal(app.loadStage('delicia-1', true), true); return app; };
    t.after(() => {
        nativeCleanups.forEach(cleanup => cleanup());
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
    /** Execute the actual outer owner method and native host, with only module delivery delayed. */
    function nativeEntry(completed: boolean, delay: 'outer' | 'inner' = 'inner') {
        app.dispose();
        const store = new DeliciaStore(null), progress = new ProgressStore(null);
        if (completed) store.save.completed.push('delicia-1');
        let mounted: App | undefined;
        class ObservedApp extends DeliciaApp {
            constructor(...args: ConstructorParameters<typeof DeliciaApp>) {
                super(...args); mounted = this as unknown as App; apps.push(mounted);
            }
        }
        let release!: () => void, reject!: (error: Error) => void;
        const gate = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
        let importing!: () => void;
        const importStarted = new Promise<void>(resolve => { importing = resolve; });
        const tracked = new Map<EventTarget, Set<EventListenerOrEventListenerObject>>();
        for (const target of [window, document]) {
            const listeners = new Set<EventListenerOrEventListenerObject>(); tracked.set(target, listeners);
            const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
            t.mock.method(target, 'addEventListener', (type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) => {
                if (listener && (type === 'blur' || type === 'visibilitychange')) listeners.add(listener);
                add(type, listener, options);
            });
            t.mock.method(target, 'removeEventListener', (type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) => {
                if (listener && (type === 'blur' || type === 'visibilitychange')) listeners.delete(listener);
                remove(type, listener, options);
            });
        }
        function compile(source: string, path: URL, load: (name: string) => unknown) {
            const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
            const result = { exports: {} as Record<string, any> };
            runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: path.pathname })(load, result, result.exports);
            return result.exports;
        }
        const hostUrl = new URL('../src/adventure/WorldChapterHost.ts', import.meta.url);
        const host = compile(readFileSync(hostUrl, 'utf8'), hostUrl, name => {
            if (name.endsWith('.css')) return {};
            if (delay === 'inner') { importing(); return gate.then(() => ({ DeliciaApp: ObservedApp })); }
            return { DeliciaApp: ObservedApp };
        });
        const ownerUrl = new URL('../src/adventure/WorldGame.ts', import.meta.url);
        const source = ts.createSourceFile(ownerUrl.pathname, readFileSync(ownerUrl, 'utf8'), ts.ScriptTarget.Latest, true);
        const ownerClass = source.statements.find(ts.isClassDeclaration)!;
        const method = ownerClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(source) === 'mountChapter')!;
        const ownerType = compile(`export class NativeOwner { ${method.getText(source)} }`, ownerUrl,
            () => { if (delay === 'outer') { importing(); return gate.then(() => host); } return host; }).NativeOwner;
        const mapRoot = new Element('section'), mapCanvas = new Element('canvas'); body.append(mapRoot, mapCanvas);
        let returned = 0, disposed = false;
        const owner = Object.assign(new ownerType(), {
            chapterActive: false, running: true, input: { reset() {} }, audio: { enabled: true, pause() {}, volume() {} },
            store: progress, mapCanvas, renderer: {}, cancelFrame() {}, requestFrame() {},
            mapView: { root: mapRoot, deliciaStore: store, openChapter() { returned++; }, hud: { focusEnter() {} } },
        });
        Object.defineProperty(owner, 'isDisposed', { get: () => disposed });
        const pending: Promise<void> = owner.mountChapter('delicia', 'delicia-1');
        nativeCleanups.push(() => owner.chapterCleanup?.());
        return { pending, importStarted, release, reject, mounted: () => mounted, returned: () => returned, owner,
            activityListeners: () => [...tracked.values()].reduce((sum, listeners) => sum + listeners.size, 0),
            mountAgain: () => owner.mountChapter('delicia', 'delicia-1') as Promise<void>,
            close: () => owner.chapterCleanup?.(), dispose: () => { disposed = true; owner.chapterCleanup?.(); } };
    }
    return { app, create, nativeEntry, window, document, body, key, pointer, button, frame, pad,
        focus: (value: boolean, notify = true) => { focused = value; if (notify) window.dispatchEvent(new Event(value ? 'focus' : 'blur')); },
        disconnect: () => { connected = false; }, connect: () => { connected = true; } };
}
function neutral(input: DeliciaInput) { assert.ok(Object.values(input).every(value => value === false), JSON.stringify(input)); }

test('shared world entry bypasses the title, waits for a released gamepad and returns through the shared map', t => {
    const h = fixture(t); h.app.dispose(); h.pad.buttons[0].pressed = true;
    let returned = 0;
    const app = h.create({ initialStage: 'delicia-1', returnToWorldMap: () => { returned++; app.dispose(); } });
    assert.equal(app.screen, 'dialogue');
    const text = () => app.menu.text, introduction = text();
    h.frame(); h.frame(); assert.equal(text(), introduction, 'The map confirm cannot consume the introduction');
    h.pad.buttons[0].pressed = false; h.frame(); h.pad.buttons[0].pressed = true; h.frame();
    assert.equal(app.dialogueTime, Infinity, 'A fresh confirm reveals the current sentence, just like World');
    h.pad.buttons[0].pressed = false; h.frame(); h.pad.buttons[0].pressed = true; h.frame();
    assert.notEqual(text(), introduction, 'The next confirm advances the sentence');
    h.pad.buttons[0].pressed = false; app.loadStage('delicia-1', true); app.pause();
    const back = app.menu.choices.find(choice => choice.label === 'VOLTAR AO MAPA');
    assert.ok(back); back.run(); assert.equal(returned, 1);
    assert.deepEqual((app.store.save as { completed: string[] }).completed, []);
});

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

for (const index of [0, 1, 9]) test(`unfocused controller button ${index} cannot resume and requires neutral after return`, t => {
    const h = fixture(t); h.focus(false); const position = h.app.sim.player.x;
    h.pad.buttons[index].pressed = true; h.frame(); h.frame();
    assert.equal(h.app.screen, 'pause'); assert.equal(h.app.sim.player.x, position); neutral(h.app.input());
    h.focus(true); h.frame(); assert.equal(h.app.screen, 'pause'); neutral(h.app.input());
    h.pad.buttons[index].pressed = false; h.frame();
    h.pad.buttons[index].pressed = true; h.frame(); assert.equal(h.app.screen, 'playing');
});

for (const index of [0, 1, 9]) test(`button ${index} held while hidden cannot activate on visibility return`, t => {
    const h = fixture(t); h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange'));
    h.pad.buttons[index].pressed = true; h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange')); h.frame();
    assert.equal(h.app.screen, 'pause'); neutral(h.app.input());
    h.pad.buttons[index].pressed = false; h.frame(); h.pad.buttons[index].pressed = true; h.frame();
    assert.equal(h.app.screen, 'playing');
});

for (const held of ['dpad', 'stick-x', 'stick-y', 'opposed']) test(`interruption requires raw ${held} neutral before accepting another controller action`, t => {
    const h = fixture(t); h.focus(false);
    if (held === 'dpad' || held === 'opposed') h.pad.buttons[15].pressed = true;
    if (held === 'opposed') h.pad.buttons[14].pressed = true;
    if (held === 'stick-x') h.pad.axes[0] = .6;
    if (held === 'stick-y') h.pad.axes[1] = -.6;
    h.focus(true); h.frame(); h.pad.buttons[9].pressed = true; h.frame();
    assert.equal(h.app.screen, 'pause'); neutral(h.app.input());
    h.pad.buttons.forEach(button => button.pressed = false); h.pad.axes.fill(0); h.frame();
    h.pad.buttons[9].pressed = true; h.frame(); assert.equal(h.app.screen, 'playing');
});

for (const index of [0, 1, 9]) test(`reconnected controller button ${index} requires neutral and preserves keyboard ownership`, t => {
    const h = fixture(t); h.disconnect(); h.frame(); h.app.pause(); h.pad.buttons[index].pressed = true; h.connect(); h.frame();
    assert.equal(h.app.screen, 'pause'); neutral(h.app.input());
    h.pad.buttons[index].pressed = false; h.frame(); h.pad.buttons[index].pressed = true; h.frame();
    assert.equal(h.app.screen, 'playing');
    h.key('keydown', 'd'); h.disconnect(); h.frame(); assert.equal(h.app.input().right, true);
    h.key('keyup', 'd');
});

test('a newly constructed unfocused app ignores controller actions until focus and neutral', t => {
    const h = fixture(t, false); h.app.pause(); h.pad.buttons[9].pressed = true; h.frame();
    assert.equal(h.app.screen, 'pause'); h.focus(true); h.frame(); assert.equal(h.app.screen, 'pause');
    h.pad.buttons[9].pressed = false; h.frame(); h.pad.buttons[9].pressed = true; h.frame();
    assert.equal(h.app.screen, 'playing');
});

for (const index of [0, 1, 9]) test(`ordinary focused pause button ${index} retains its behavior`, t => {
    const h = fixture(t); h.app.pause(); h.pad.buttons[index].pressed = true; h.frame();
    assert.equal(h.app.screen, 'playing');
});

test('disposed app stays inert through focus and connection events', t => {
    const h = fixture(t); h.focus(false); h.app.dispose(); const screen = h.app.screen;
    h.pad.buttons[9].pressed = true; h.focus(true); h.window.dispatchEvent(new Event('gamepadconnected')); h.frame();
    assert.equal(h.app.screen, screen); neutral(h.app.input());
});

test('connection events disarm held controls even when disconnect and reconnect occur between frames', t => {
    const h = fixture(t); h.app.pause();
    h.pad.buttons[9].pressed = true; h.window.dispatchEvent(new Event('gamepaddisconnected')); h.window.dispatchEvent(new Event('gamepadconnected')); h.frame();
    assert.equal(h.app.screen, 'pause');
    h.pad.buttons[9].pressed = false; h.frame(); h.pad.buttons[9].pressed = true; h.frame();
    assert.equal(h.app.screen, 'playing');
});

test('controller rearming does not suppress fresh keyboard or touch gameplay after manual resume', t => {
    const h = fixture(t); h.focus(false); h.pad.buttons[0].pressed = true; h.focus(true); h.app.resume();
    h.key('keydown', 'd'); h.pointer('pointerdown', h.button(' ')); h.frame();
    assert.equal(h.app.input().right, true); assert.equal(h.app.input().jump, true);
    h.key('keyup', 'd'); h.pointer('pointerup', h.button(' ')); h.frame(); neutral(h.app.input());
    h.pad.buttons[0].pressed = false; h.frame(); h.pad.buttons[0].pressed = true; h.frame();
    assert.equal(h.app.input().jump, true);
});

test('current document focus blocks controller activation even without a blur notification', t => {
    const h = fixture(t); h.app.pause(); h.focus(false, false); h.pad.buttons[9].pressed = true; h.frame();
    assert.equal(h.app.screen, 'pause'); h.focus(true, false); h.frame(); assert.equal(h.app.screen, 'pause');
    h.pad.buttons[9].pressed = false; h.frame(); h.pad.buttons[9].pressed = true; h.frame();
    assert.equal(h.app.screen, 'playing');
});

for (const delay of ['outer', 'inner'] as const) for (const interrupt of ['blur', 'hidden', 'blur-return'] as const)
test(`native completed entry pauses after ${interrupt} during ${delay} import`, async t => {
    const h = fixture(t), entry = h.nativeEntry(true, delay);
    await entry.importStarted; h.pad.buttons[9].pressed = true;
    if (interrupt === 'hidden') { h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange')); }
    else { h.focus(false); if (interrupt === 'blur-return') h.focus(true); }
    entry.release(); await entry.pending;
    const app = entry.mounted()!; assert.ok(app); assert.equal(app.screen, 'pause');
    assert.equal(entry.activityListeners(), 3, 'Only the app and its accessible menus keep their activity listeners');
    const elapsed = app.sim.elapsed;
    for (let i = 0; i < 8; i++) h.frame();
    assert.equal(app.sim.elapsed, elapsed);
    h.pad.buttons[9].pressed = true;
    if (interrupt === 'hidden') { h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange')); }
    if (interrupt !== 'blur-return') h.focus(true);
    h.frame(); h.frame(); assert.equal(app.screen, 'pause');
    h.pad.buttons[9].pressed = false; h.frame(); h.pad.buttons[9].pressed = true; h.frame();
    assert.equal(app.screen, 'playing', 'Only a released controller followed by fresh intent resumes');
    for (let i = 0; i < 8; i++) h.frame(); assert.ok(app.sim.elapsed > elapsed);
});
for (const completed of [false, true]) test(`focused native entry preserves ${completed ? 'replay' : 'introduction'}`, async t => {
    const h = fixture(t), entry = h.nativeEntry(completed); entry.release(); await entry.pending;
    assert.equal(entry.mounted()?.screen, completed ? 'playing' : 'dialogue');
});
test('interrupted new stage keeps its introduction and needs fresh confirmation', async t => {
    const h = fixture(t), entry = h.nativeEntry(false); h.focus(false); entry.release(); await entry.pending;
    const app = entry.mounted()!; assert.equal(app.screen, 'dialogue'); const text = app.menu.text;
    h.pad.buttons[0].pressed = true; h.focus(true); h.frame(); h.frame();
    assert.equal(app.menu.text, text); assert.equal(app.sim.elapsed, 0);
    h.pad.buttons[0].pressed = false; h.frame(); h.pad.buttons[0].pressed = true; h.frame();
    assert.equal(app.dialogueTime, Infinity);
});
for (const delay of ['outer', 'inner'] as const) for (const cancel of ['close', 'dispose'] as const)
test(`${cancel} during ${delay} chapter import prevents late construction`, async t => {
    const h = fixture(t), entry = h.nativeEntry(true, delay);
    await entry.importStarted; entry[cancel]();
    h.focus(false); h.focus(true); entry.release(); await entry.pending;
    assert.equal(entry.mounted(), undefined); assert.equal(entry.owner.chapterActive, false); assert.equal(entry.returned(), 1);
    assert.equal(entry.activityListeners(), 0);
});

for (const delay of ['outer', 'inner'] as const) test(`failed ${delay} import releases the entry activity lease`, async t => {
    const h = fixture(t), entry = h.nativeEntry(true, delay);
    t.mock.method(console, 'error', () => {});
    entry.reject(new Error('Test module delivery failure')); await entry.pending;
    assert.equal(entry.mounted(), undefined); assert.equal(entry.activityListeners(), 0);
    assert.ok(h.body.all().some(node => node.textContent === 'Tentar novamente'));
    entry.close(); assert.equal(entry.activityListeners(), 0);
});
test('an interrupted entry does not pause the next focused visit', async t => {
    const h = fixture(t), entry = h.nativeEntry(true); h.focus(false); h.focus(true);
    entry.release(); await entry.pending; assert.equal(entry.mounted()?.screen, 'pause');
    entry.close(); assert.equal(entry.activityListeners(), 0);
    await entry.mountAgain(); assert.equal(entry.mounted()?.screen, 'playing');
    assert.equal(entry.activityListeners(), 3); entry.close(); assert.equal(entry.activityListeners(), 0);
});
for (const state of ['unfocused', 'hidden'] as const) test(`native replay constructor detects already ${state} document`, t => {
    const h = fixture(t); h.app.dispose();
    if (state === 'hidden') h.document.hidden = true; else h.focus(false, false);
    const store = new DeliciaStore(null); store.save.completed.push('delicia-1');
    const app = h.create({store, initialStage: 'delicia-1', returnToWorldMap: () => {}});
    assert.equal(app.screen, 'pause');
});
