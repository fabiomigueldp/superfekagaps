import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import type { DeliciaInput, DeliciaSimulation } from '../src/adventure/delicia/DeliciaSimulation';
import { DeliciaStore } from '../src/adventure/delicia/DeliciaProgress';
import { ProgressStore } from '../src/adventure/progress';
import type { DeliciaAppOptions } from '../src/adventure/delicia/DeliciaApp';
import { Event, type HTMLElement as Element, type EventTarget, type TEventListener } from 'happy-dom';
import { createDeliciaDom } from './helpers/deliciaDomHarness';
import { loadDeliciaApp } from './helpers/deliciaAppLoader';

/** DOM/event boundaries only. Constructor, registered handlers, loop and simulation are real. */
function fixture(t: TestContext, initiallyFocused = true) {
    const dom = createDeliciaDom(initiallyFocused), { window, document, body } = dom;
    const cleanups: (() => void)[] = [];
    t.after(async () => { try { cleanups.forEach(cleanup => cleanup()); } finally { await dom.dispose(); } });
    const frames = new Map<number, FrameRequestCallback>(); let frameId = 0, now = 1000;
    let connected = true;
    const pad = { index: 0, id: 'test-pad', get connected() { return connected; }, mapping: 'standard', timestamp: 0, axes: [0, 0],
        buttons: Array.from({ length: 16 }, (): { pressed: boolean; touched: boolean; value: number } =>
            ({ pressed: false, get touched() { return this.pressed; }, get value() { return Number(this.pressed); } })),
        vibrationActuator: { playEffect: async () => 'complete', reset: async () => 'complete' } } satisfies Gamepad;
    dom.install({
        navigator: { maxTouchPoints: 1, getGamepads: () => connected ? [pad] : [] },
        localStorage: { getItem: () => null, setItem() {} },
        requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame: (id: number) => { frames.delete(id); }, fetch: async () => ({ ok: false }) });
    const loaded = loadDeliciaApp(), { DeliciaApp, require } = loaded;
    // Ownership scenarios begin with an already selected, neutral controller.
    // Device selection has its own baseline; a first held button must not stand in for a fresh press.
    const { selectGamepad } = require('../../engine/GamepadDevice') as typeof import('../src/engine/GamepadDevice');
    const { heldKeyboardMovement } = require('../../engine/KeyboardMovement') as typeof import('../src/engine/KeyboardMovement');
    selectGamepad(pad);
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
    cleanups.push(() => { nativeCleanups.forEach(cleanup => cleanup()); apps.forEach(app => app.dispose()); }, loaded.dispose);
    const app = create();
    function dispatch(type: string, target: Element | EventTarget, values: Record<string, unknown> = {}) {
        const event = new Event(type, { cancelable: true, bubbles: true });
        for (const [name, value] of Object.entries(values)) Object.defineProperty(event, name, { value });
        target.dispatchEvent(event);
        return event;
    }
    const key = (type: string, key: string, target: Element = document.activeElement instanceof window.HTMLElement ? document.activeElement : body, repeat = false, code = '') =>
        dispatch(type, target, { key, code, repeat });
    const pointer = (type: string, target: Element | EventTarget, pointerId = 1) => dispatch(type, target, { pointerId, button: 0 });
    const button = (key: string) => { const b = Array.from(app.touch.querySelectorAll('button')).find(node => node.dataset.key === key); assert.ok(b); return b; };
    const frame = () => {
        now += 1000 / 60; const pending = [...frames.values()]; frames.clear();
        for (const callback of pending) callback(now);
    };
    frame();
    /** Execute the actual outer owner method and native host, with only module delivery delayed. */
    function nativeEntry(completed: boolean, delay: 'outer' | 'inner' = 'inner') {
        app.dispose();
        const store = new DeliciaStore(null), progress = new ProgressStore(null);
        if (completed) store.save.completed.push('delicia-1');
        type ActivityOwner = 'entry' | 'loading-gamepad' | 'chapter';
        let activityOwner: ActivityOwner = 'entry', visit = 0;
        const withOwner = <T>(owner: ActivityOwner, run: () => T): T => {
            const previous = activityOwner; activityOwner = owner;
            try { return run(); } finally { activityOwner = previous; }
        };
        let mounted: App | undefined;
        class ObservedApp extends DeliciaApp {
            constructor(...args: ConstructorParameters<typeof DeliciaApp>) {
                const previous = activityOwner; activityOwner = 'chapter';
                try { super(...args); } finally { activityOwner = previous; }
                mounted = this as unknown as App; apps.push(mounted);
            }
        }
        let release!: () => void, reject!: (error: Error) => void;
        const gate = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
        let importing!: () => void;
        const importStarted = new Promise<void>(resolve => { importing = resolve; });
        // Preserve the DOM's identity tuple, not just a count of callbacks.
        // Module-owned listeners predate this tracker; every new entry/scene must release its own.
        const callbackIds = new WeakMap<TEventListener, number>(); let nextId = 0;
        type Activity = { key: string; owner: ActivityOwner; visit: number };
        const tracked = new Map<string, Activity>(), registered: Activity[] = [];
        for (const [name, target] of [['window', window], ['document', document]] as const) {
            const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
            const identity = (type: string, listener: TEventListener, options?: boolean | { capture?: boolean }) => {
                if (!callbackIds.has(listener)) callbackIds.set(listener, ++nextId);
                const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
                return `${name}:${type}:${capture}:${callbackIds.get(listener)}`;
            };
            t.mock.method(target, 'addEventListener', (...args: Parameters<typeof add>) => {
                add(...args);
                const [type, listener, options] = args;
                if (listener && (type === 'blur' || type === 'visibilitychange')) {
                    const key = identity(type, listener, options);
                    if (!tracked.has(key)) {
                        const entry = { key, owner: activityOwner, visit };
                        tracked.set(key, entry); registered.push(entry);
                    }
                }
            });
            // Happy DOM declares two arguments; callers still pass the DOM capture argument.
            t.mock.method(target, 'removeEventListener', (...args: [string, TEventListener, (boolean | { capture?: boolean })?]) => {
                Reflect.apply(remove, target, args);
                const [type, listener, options] = args;
                if (listener && (type === 'blur' || type === 'visibilitychange')) tracked.delete(identity(type, listener, options));
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
        const ownerType = compile(`import { installDomGamepad } from '../engine/DomGamepadMenu';
            export class NativeOwner { ${method.getText(source)} }`, ownerUrl,
            name => {
                if (name === '../engine/DomGamepadMenu') {
                    const { installDomGamepad } = require('../../engine/DomGamepadMenu') as typeof import('../src/engine/DomGamepadMenu');
                    return { installDomGamepad: (...args: Parameters<typeof installDomGamepad>) =>
                        withOwner('loading-gamepad', () => installDomGamepad(...args)) };
                }
                if (delay === 'outer') { importing(); return gate.then(() => host); } return host;
            }).NativeOwner;
        const mapRoot = document.createElement('section'), mapCanvas = document.createElement('canvas'); body.append(mapRoot, mapCanvas);
        let returned = 0, disposed = false;
        const owner = Object.assign(new ownerType(), {
            chapterActive: false, running: true, input: { reset() {} }, audio: { enabled: true, pause() {}, volume() {} },
            store: progress, mapCanvas, renderer: {}, cancelFrame() {}, requestFrame() {},
            mapView: { root: mapRoot, deliciaStore: store, openChapter() { returned++; }, hud: { focusEnter() {} } },
        });
        Object.defineProperty(owner, 'isDisposed', { get: () => disposed });
        const mount = (): Promise<void> => { visit++; mounted = undefined; return owner.mountChapter('delicia', 'delicia-1'); };
        const pending = mount();
        nativeCleanups.push(() => owner.chapterCleanup?.());
        return { pending, importStarted, release, reject, mounted: () => mounted, returned: () => returned, owner,
            activityListeners: () => [...tracked.values()],
            assertActivityOwner: (expectedOwner: ActivityOwner) => {
                const expected = registered.filter(entry => entry.owner === expectedOwner && entry.visit === visit);
                assert.ok(expected.length > 0, `The ${expectedOwner} must register its own activity callbacks`);
                assert.deepEqual([...tracked.keys()].sort(), expected.map(entry => entry.key).sort(),
                    'Only the current owner may retain its exact registered callbacks');
            },
            mountAgain: mount,
            close: () => owner.chapterCleanup?.(), dispose: () => { disposed = true; owner.chapterCleanup?.(); } };
    }
    return { app, create, nativeEntry, window, document, body, key, pointer, button, frame, pad, heldKeyboardMovement,
        gamepadEvent: (type: string) => dispatch(type, window, { gamepad: pad }),
        focus: dom.focus, failPointerCapture: dom.failPointerCapture,
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

for (const [key, code, action] of [['a', 'KeyA', 'left'], ['d', 'KeyD', 'right'], ['Shift', 'ShiftLeft', 'run']] as const)
test(`held keyboard ${action} survives element blur until its physical keyup`, t => {
    const h = fixture(t);
    h.key('keydown', key, h.app.canvas, false, code); h.frame(); assert.equal(h.app.input()[action], true);
    h.button('arrowright').focus(); h.app.canvas.focus(); h.frame();
    assert.equal(h.app.screen, 'playing'); assert.equal(h.app.input()[action], true);
    h.key('keyup', key, h.app.canvas, false, code); h.frame(); assert.equal(h.app.input()[action], false);
});

for (const boundary of ['window blur', 'hidden document']) test(`${boundary} still clears keyboard movement across resume`, t => {
    const h = fixture(t); h.key('keydown', 'd', h.app.canvas, false, 'KeyD'); h.frame();
    assert.equal(h.app.input().right, true);
    if (boundary === 'window blur') h.focus(false);
    else { h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange')); }
    assert.equal(h.app.screen, 'pause'); neutral(h.app.input());
    if (boundary === 'window blur') h.focus(true);
    else { h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange')); }
    h.app.resume(); h.frame(); assert.equal(h.app.input().right, false);
});

test('a keyup consumed by a native control still releases held movement', t => {
    const h = fixture(t), right = h.button('arrowright');
    h.key('keydown', 'd', h.app.canvas, false, 'KeyD'); h.frame(); assert.equal(h.app.input().right, true);
    right.focus(); right.addEventListener('keyup', event => event.stopImmediatePropagation(), { once: true });
    h.key('keyup', 'd', right, false, 'KeyD'); h.app.canvas.focus(); h.frame();
    assert.equal(h.app.input().right, false);
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
    const h = fixture(t), right = h.button('arrowright'); h.failPointerCapture(right);
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

for (const delivery of ['poll', 'event']) for (const index of [0, 1, 9])
test(`reconnected controller button ${index} via ${delivery} requires release and preserves keyboard through pause`, t => {
    const h = fixture(t), sim = h.app.sim, save = JSON.stringify(h.app.store.save);
    const disconnect = () => { h.disconnect(); if (delivery === 'event') h.gamepadEvent('gamepaddisconnected'); };
    disconnect(); h.frame();
    assert.equal(h.app.screen, 'pause'); neutral(h.app.input());
    const elapsed = sim.elapsed;
    h.pad.buttons[index].pressed = true; h.connect();
    if (delivery === 'event') h.gamepadEvent('gamepadconnected');
    h.frame(); h.frame();
    assert.equal(h.app.screen, 'pause'); neutral(h.app.input()); assert.equal(sim.elapsed, elapsed);
    h.pad.buttons[index].pressed = false; h.frame(); assert.equal(h.app.screen, 'pause');
    h.pad.buttons[index].pressed = true; h.frame();
    assert.equal(h.app.screen, 'playing');
    h.key('keydown', 'd', h.app.canvas, false, 'KeyD');
    const beforeDisconnect = { x: sim.player.x, elapsed: sim.elapsed };
    disconnect(); h.frame();
    assert.equal(h.app.screen, 'pause'); neutral(h.app.input());
    assert.deepEqual([...h.heldKeyboardMovement()], [['KeyD', 'right']]);
    h.frame(); h.frame();
    assert.deepEqual({ x: sim.player.x, elapsed: sim.elapsed }, beforeDisconnect);
    neutral(h.app.input());
    // The Node fixture omits painting; activate the same CONTINUAR action that the browser clicks.
    const resume = h.app.menu.choices.find(choice => choice.label === 'CONTINUAR'); assert.ok(resume); resume.run();
    h.frame(); assert.equal(h.app.screen, 'playing'); assert.equal(h.app.input().right, true);
    assert.deepEqual([...h.heldKeyboardMovement()], [['KeyD', 'right']]);
    assert.ok(sim.player.x > beforeDisconnect.x); assert.equal(h.pad.connected, false);
    h.key('keyup', 'd', h.app.canvas, false, 'KeyD'); h.frame();
    assert.equal(h.app.input().right, false); assert.deepEqual([...h.heldKeyboardMovement()], []);
    assert.equal(h.app.sim, sim); assert.equal(JSON.stringify(h.app.store.save), save);
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

for (const index of [0, 1, 9]) test(`button ${index} already held when pause opens needs release before resuming`, t => {
    const h = fixture(t); h.pad.buttons[index].pressed = true; h.app.pause();
    const elapsed = h.app.sim.elapsed;
    h.frame(); h.frame(); assert.equal(h.app.screen, 'pause'); neutral(h.app.input());
    assert.equal(h.app.sim.elapsed, elapsed);
    h.pad.buttons[index].pressed = false; h.frame(); assert.equal(h.app.screen, 'pause');
    h.pad.buttons[index].pressed = true; h.frame(); assert.equal(h.app.screen, 'playing');
});

test('the controller gesture that opens pause cannot immediately close it', t => {
    const h = fixture(t); h.pad.buttons[9].pressed = true; h.frame();
    assert.equal(h.app.screen, 'pause'); h.frame(); h.frame(); assert.equal(h.app.screen, 'pause');
    neutral(h.app.input());
    h.pad.buttons[9].pressed = false; h.frame(); assert.equal(h.app.screen, 'pause');
    h.pad.buttons[9].pressed = true; h.frame(); assert.equal(h.app.screen, 'playing');
});

test('disposed app stays inert through focus and connection events', t => {
    const h = fixture(t); h.focus(false); h.app.dispose(); const screen = h.app.screen;
    h.pad.buttons[9].pressed = true; h.focus(true); h.gamepadEvent('gamepadconnected'); h.frame();
    assert.equal(h.app.screen, screen); neutral(h.app.input());
});

test('connection events disarm held controls even when disconnect and reconnect occur between frames', t => {
    const h = fixture(t); h.app.pause();
    h.pad.buttons[9].pressed = true; h.gamepadEvent('gamepaddisconnected'); h.gamepadEvent('gamepadconnected'); h.frame();
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
    entry.assertActivityOwner('chapter');
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
    entry.close(); assert.deepEqual(entry.activityListeners(), []);
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
    assert.deepEqual(entry.activityListeners(), []);
});

for (const delay of ['outer', 'inner'] as const) test(`failed ${delay} import releases the entry activity lease`, async t => {
    const h = fixture(t), entry = h.nativeEntry(true, delay);
    const loading = entry.activityListeners().filter(listener => listener.owner === 'loading-gamepad');
    assert.ok(loading.length > 0);
    entry.reject(new Error('Test module delivery failure')); await entry.pending;
    assert.equal(entry.mounted(), undefined); entry.assertActivityOwner('loading-gamepad');
    assert.deepEqual(entry.activityListeners(), loading, 'Entry callbacks end; the still-open error menu keeps its own gamepad');
    assert.ok(Array.from(h.body.querySelectorAll('*')).some(node => node.textContent === 'Tentar novamente'));
    entry.close(); assert.deepEqual(entry.activityListeners(), []);
    assert.equal(entry.returned(), 1); entry.close(); assert.equal(entry.returned(), 1);
});
test('an interrupted entry does not pause the next focused visit', async t => {
    const h = fixture(t), entry = h.nativeEntry(true); h.focus(false); h.focus(true);
    entry.release(); await entry.pending; assert.equal(entry.mounted()?.screen, 'pause');
    entry.assertActivityOwner('chapter');
    const seen = new Set(entry.activityListeners().map(listener => listener.key));
    entry.close(); assert.deepEqual(entry.activityListeners(), []);
    for (let visit = 0; visit < 3; visit++) {
        await entry.mountAgain(); const app = entry.mounted()!; assert.equal(app.screen, 'playing');
        entry.assertActivityOwner('chapter');
        for (const listener of entry.activityListeners()) {
            assert.equal(seen.has(listener.key), false, 'A new scene must not retain a previous scene callback'); seen.add(listener.key);
        }
        const pause = t.mock.method(app, 'pause'); h.key('keydown', 'Escape', app.canvas);
        assert.equal(app.screen, 'pause'); assert.equal(pause.mock.callCount(), 1, 'One command reaches only the current scene');
        const back = app.menu.choices.find(choice => choice.label === 'VOLTAR AO MAPA'); assert.ok(back); back.run();
        assert.deepEqual(entry.activityListeners(), []); assert.equal(entry.returned(), visit + 2);
        entry.close(); assert.equal(entry.returned(), visit + 2);
        h.key('keydown', 'Escape', app.canvas); assert.equal(pause.mock.callCount(), 1, 'Disposed handlers remain inert');
    }
});
for (const state of ['unfocused', 'hidden'] as const) test(`native replay constructor detects already ${state} document`, t => {
    const h = fixture(t); h.app.dispose();
    if (state === 'hidden') h.document.hidden = true; else h.focus(false, false);
    const store = new DeliciaStore(null); store.save.completed.push('delicia-1');
    const app = h.create({store, initialStage: 'delicia-1', returnToWorldMap: () => {}});
    assert.equal(app.screen, 'pause');
});
