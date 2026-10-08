import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import type { DeliciaInput, DeliciaSimulation } from '../src/adventure/delicia/DeliciaSimulation';

/** Deterministic browser clock; app handlers, simulation and canvas painting remain real. */
function fixture(t: TestContext) {
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
        readonly draws: string[] = [];
        private readonly context = new Proxy({} as CanvasRenderingContext2D, {
            get: (_target, key) => {
                if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
                if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
                return (...args: unknown[]) => { this.draws.push(`${String(key)}:${args.map(value => typeof value === 'object' ? '[object]' : String(value)).join(',')}`); };
            },
            set: (_target, key, value) => { this.draws.push(`${String(key)}=${typeof value === 'object' ? '[object]' : String(value)}`); return true; },
        });
        clientWidth = 960;
        getContext() { return this.context; }
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
    const document = Object.assign(new EventTarget(), { body, hidden: false, title: '', activeElement: null as Element | null,
        getElementById: () => null, createElement: (tag: string) => new Element(tag) });
    // Define the live focus getter after assigning the document's typed shape.
    Object.defineProperty(document, 'activeElement', { get: () => activeElement });
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0, now = 1000, polls = 0;
    const motion = Object.assign(new EventTarget(), { matches: false });
    const finishArt: Array<() => void> = [];
    let connected = true;
    const pad = { mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    const original = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({ window, document, location: { hash: '' },
        navigator: { maxTouchPoints: 1, getGamepads: () => { polls++; return connected ? [pad] : []; } },
        matchMedia: () => motion,
        localStorage: { getItem: () => null, setItem() {} },
        requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame(id: number) { frames.delete(id); }, fetch: async () => ({ ok: false }) })) {
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
    t.mock.method(DeliciaArt.prototype, 'load', () => new Promise<void>(resolve => { finishArt.push(resolve); }));
    const prototype = DeliciaApp.prototype as unknown as { renderGame(): void };
    const painting = t.mock.method(prototype, 'renderGame');
    interface App {
        presentation: { renderer: { worldCanvas: Element }; menus: { root: Element } }; canvas: Element; touch: Element; screen: string; sim: DeliciaSimulation;
        input(): DeliciaInput; loadStage(id: string, retry: boolean): boolean; pause(): void; resume(): void; dispose(): void;
        store: { save: { reducedMotion: boolean } };
        audio: { pause(paused: boolean): void };
        art: { images: Map<string, HTMLImageElement> };
        toast: string; toastTime: number; shake: number; zoneBanner: string; zoneBannerTime: number;
        setScreen(screen: string): void; showTitle(): void; renderGame(): void;
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
    const frame = (dt = 1000 / 60) => {
        now += dt; const pending = [...frames.values()]; frames.clear();
        for (const callback of pending) callback(now);
    };
    const hidden = (value: boolean) => { document.hidden = value; document.dispatchEvent(new Event('visibilitychange')); };
    frame();
    return { app, scene: app.presentation.renderer.worldCanvas, create, window, document, body, key, pointer, button, frame, pad, frames, hidden, motion, finishArt,
        painting, polls: () => polls, now: () => now, disconnect: () => { connected = false; } };
}

test('a settled pause retains identical canvas output without repeated paints or lost controller polling', t => {
    const h = fixture(t); h.app.pause();
    h.app.toastTime = 0; h.app.shake = 0; h.app.zoneBannerTime = 0;
    h.scene.draws.length = 0; h.frame();
    const painted = [...h.scene.draws], simulation = JSON.stringify(h.app.sim), save = structuredClone(h.app.store.save);
    const count = h.painting.mock.callCount(), polls = h.polls();
    for (let i = 0; i < 120; i++) h.frame();
    assert.ok(painted.length > 100, 'The initial pause runs the real complete canvas renderer');
    assert.equal(h.painting.mock.callCount(), count);
    assert.equal(h.polls() - polls, 120, 'Visible pause controls remain responsive');
    assert.equal(h.frames.size, 1);
    assert.equal(JSON.stringify(h.app.sim), simulation); assert.deepEqual(h.app.store.save, save);
    assert.deepEqual(h.scene.draws, painted, 'Settled pause leaves the existing canvas untouched');
    h.scene.draws.length = 0; h.app.renderGame();
    assert.deepEqual(h.scene.draws, painted, 'A full repaint would produce exactly the retained commands');
    h.pad.buttons[9].pressed = true; h.frame(); assert.equal(h.app.screen, 'playing');
    h.pad.buttons[9].pressed = false; h.frame();
    h.pad.buttons[9].pressed = true; h.frame(); assert.equal(h.app.screen, 'pause');
});

test('pause paints transient feedback through expiry, including the final cleared image', t => {
    const h = fixture(t); h.app.pause();
    h.app.toast = 'Checkpoint salvo.'; h.app.toastTime = .025;
    h.app.zoneBanner = 'Uma nova região'; h.app.zoneBannerTime = .08; h.app.shake = .04;
    const simulation = JSON.stringify(h.app.sim);
    h.frame(); const first = h.painting.mock.callCount(); h.frame();
    assert.equal(h.painting.mock.callCount(), first + 1);
    for (let i = 0; i < 10; i++) h.frame();
    assert.equal(h.app.toastTime, 0); assert.equal(h.app.shake, 0); assert.equal(h.app.zoneBannerTime, 0);
    h.scene.draws.length = 0; h.app.renderGame(); const cleared = [...h.scene.draws];
    h.scene.draws.length = 0; h.window.dispatchEvent(new Event('resize')); h.frame();
    assert.deepEqual(h.scene.draws, cleared);
    const settled = h.painting.mock.callCount(); h.frame(); h.frame();
    assert.equal(h.painting.mock.callCount(), settled);
    assert.equal(JSON.stringify(h.app.sim), simulation);
});

test('paused gamepad navigation can open settings, change manual motion and return without resuming audio', t => {
    const h = fixture(t), audio = t.mock.method(h.app.audio, 'pause'); h.app.pause(); h.frame();
    const initialFocus = h.document.activeElement, before = h.painting.mock.callCount();
    h.pad.axes[1] = 1; h.frame(); assert.notEqual(h.document.activeElement, initialFocus);
    h.pad.axes[1] = 0; h.frame(); h.pad.buttons[0].pressed = true; h.frame();
    assert.equal(h.app.screen, 'settings'); assert.equal(h.app.canvas.hidden, false);
    assert.ok(h.painting.mock.callCount() > before, 'Native settings are painted on the same World canvas');
    const motion = h.app.presentation.menus.root.all().find(node => node.attributes.get('aria-label')?.startsWith('Sempre reduzir movimento'));
    assert.ok(motion); motion.click();
    assert.equal(h.app.store.save.reducedMotion, true);
    h.pad.buttons[0].pressed = false; h.frame(); h.pad.buttons[1].pressed = true; h.frame();
    assert.equal(h.app.screen, 'pause'); assert.equal(h.app.canvas.hidden, false);
    assert.ok(h.painting.mock.callCount() > before);
    assert.ok(audio.mock.calls.every(call => call.arguments[0] === true));
});

test('resize, effective motion, incremental art and load completion invalidate a paused image', async t => {
    const h = fixture(t); h.app.pause(); h.frame();
    const refresh = (change: () => void) => {
        const before = h.painting.mock.callCount(); change(); h.frame();
        assert.equal(h.painting.mock.callCount(), before + 1); h.frame();
        assert.equal(h.painting.mock.callCount(), before + 1);
    };
    refresh(() => { h.app.canvas.clientWidth = 480; h.window.dispatchEvent(new Event('resize')); });
    refresh(() => { h.motion.matches = true; h.motion.dispatchEvent(new Event('change')); });
    refresh(() => { h.app.store.save.reducedMotion = true; h.motion.matches = false; h.motion.dispatchEvent(new Event('change')); });
    refresh(() => { h.app.art.images.set('backdrop', { naturalWidth: 960, naturalHeight: 540 } as HTMLImageElement); });
    const before = h.painting.mock.callCount(); h.finishArt[0](); await Promise.resolve(); h.frame();
    assert.equal(h.painting.mock.callCount(), before + 1); h.frame(); assert.equal(h.painting.mock.callCount(), before + 1);
    h.app.resume(); h.frame(); h.app.pause();
    h.app.toastTime = 0; h.app.shake = 0; h.app.zoneBannerTime = 0;
    refresh(() => {});
});

test('hidden ownership cancels frames; rapid returns and late callbacks cannot fork or advance time', t => {
    const h = fixture(t), old = [...h.frames.values()][0];
    h.hidden(true); assert.equal(h.app.screen, 'pause'); assert.equal(h.frames.size, 0);
    const paints = h.painting.mock.callCount(), polls = h.polls(), simulation = JSON.stringify(h.app.sim);
    h.pad.buttons[9].pressed = true;
    old(h.now() + 30_000); h.frame(30_000);
    assert.equal(h.painting.mock.callCount(), paints); assert.equal(h.polls(), polls);
    assert.equal(h.frames.size, 0); assert.equal(h.app.screen, 'pause');
    assert.equal(JSON.stringify(h.app.sim), simulation); h.pad.buttons[9].pressed = false;
    h.hidden(false); assert.equal(h.frames.size, 1); const superseded = [...h.frames.values()][0];
    h.hidden(true); h.hidden(false); h.hidden(false);
    assert.equal(h.frames.size, 1); old(h.now()); superseded(h.now()); assert.equal(h.frames.size, 1);
    h.frame(); assert.equal(h.frames.size, 1); assert.equal(h.app.screen, 'pause');
    assert.equal(JSON.stringify(h.app.sim), simulation);
    const before = h.app.sim.elapsed; h.app.resume(); h.frame();
    assert.ok(h.app.sim.elapsed - before > 0 && h.app.sim.elapsed - before < .03, 'Only the new active timestep advances');
});

test('hidden time cannot consume pause feedback and visibility return starts with a fresh clock', t => {
    const h = fixture(t); h.app.pause(); h.app.toastTime = 3; h.app.shake = .1; h.app.zoneBannerTime = 2;
    h.frame(); h.hidden(true);
    const timers = [h.app.toastTime, h.app.shake, h.app.zoneBannerTime];
    h.frame(90_000); h.hidden(false); h.frame();
    assert.deepEqual([h.app.toastTime, h.app.shake, h.app.zoneBannerTime], timers);
    assert.equal(h.app.screen, 'pause'); h.frame(); assert.ok(h.app.toastTime < timers[0]);
});

test('visible dialogue and gameplay keep painting; title and other hidden canvases do not', t => {
    const h = fixture(t); let before = h.painting.mock.callCount();
    for (let i = 0; i < 4; i++) h.frame(); assert.equal(h.painting.mock.callCount(), before + 4);
    h.app.setScreen('dialogue'); before = h.painting.mock.callCount();
    for (let i = 0; i < 4; i++) h.frame(); assert.equal(h.painting.mock.callCount(), before + 4);
    h.app.showTitle(); before = h.painting.mock.callCount(); const polls = h.polls();
    for (let i = 0; i < 4; i++) h.frame(); assert.equal(h.painting.mock.callCount(), before); assert.equal(h.polls() - polls, 4);
});

test('disposal while hidden rejects delayed work and a new visit owns exactly one frame chain', async t => {
    const h = fixture(t), old = [...h.frames.values()][0]; h.hidden(true); h.app.dispose(); h.app.dispose();
    h.hidden(false); h.finishArt[0](); await Promise.resolve();
    old(h.now()); assert.equal(h.frames.size, 0);
    const next = h.create(); assert.equal(h.frames.size, 1);
    old(h.now()); assert.equal(h.frames.size, 1); h.frame(); assert.equal(next.screen, 'playing');
    const pending = [...h.frames.values()][0]; next.dispose();
    const paints = h.painting.mock.callCount(), polls = h.polls(); pending(h.now());
    h.hidden(true); h.hidden(false); h.window.dispatchEvent(new Event('resize'));
    assert.equal(h.frames.size, 0); assert.equal(h.painting.mock.callCount(), paints); assert.equal(h.polls(), polls);
});
