import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { DELICIA_STAGES, type Box } from '../src/adventure/delicia/DeliciaContent';
import { DELICIA_SAVE_KEY, freshDeliciaSave, type DeliciaStore } from '../src/adventure/delicia/DeliciaProgress';
import { DeliciaSimulation, noDeliciaInput, steamPhase } from '../src/adventure/delicia/DeliciaSimulation';

type DrawCall = [string, ...unknown[]];
/** Browser boundaries only: the constructor, settings, loop and both renderers run unchanged. */
function fixture(t: TestContext, system: boolean | null = false, manual = false, legacy = false) {
    let activeElement: Element | null = null;
    class Element extends EventTarget {
        style: Record<string, string> = {};
        className = ''; dataset: Record<string, string> = {}; hidden = false; disabled = false; checked = false;
        id = ''; type = ''; clientWidth = 960; private text = ''; parent: Element | null = null; children: Element[] = [];
        attributes = new Map<string, string>(); calls: DrawCall[] = [];
        context = new Proxy({} as Record<string, unknown>, { get: (target, key: string) => {
            if (key in target) return target[key];
            return (...args: unknown[]) => { this.calls.push([key, ...args]);
                if (key.startsWith('create')) return { addColorStop() {} }; };
        } });
        constructor(readonly tagName: string) { super(); }
        get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
        set textContent(value: string) { this.text = value; this.replaceChildren(); }
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
        getContext() { return this.context; }
        all(): Element[] { return this.children.flatMap(child => [child, ...child.all()]); }
        querySelector() { return this.all().find(node => node.tagName === 'button') ?? null; }
        focus() { activeElement = this; }
        click() { this.dispatchEvent(new Event('click')); }
    }
    const listeners = new Set<EventListener>();
    const media = { matches: system ?? false,
        addEventListener: legacy ? undefined : (name: string, listener: EventListener) => { assert.equal(name, 'change'); listeners.add(listener); },
        removeEventListener: legacy ? undefined : (name: string, listener: EventListener) => { assert.equal(name, 'change'); listeners.delete(listener); },
        addListener: (listener: EventListener) => { listeners.add(listener); },
        removeListener: (listener: EventListener) => { listeners.delete(listener); } };
    const changeSystem = (matches: boolean) => { media.matches = matches; listeners.forEach(listener => listener(new Event('change'))); if (listeners.size) app.renderGame(); };
    const body = new Element('body'), window = Object.assign(new EventTarget(), { innerWidth: 960, innerHeight: 540, devicePixelRatio: 1 });
    const document = Object.assign(new EventTarget(), { body, hidden: false, title: '', getElementById: () => null, createElement: (tag: string) => new Element(tag) });
    Object.defineProperty(document, 'activeElement', { get: () => activeElement });
    let raw = JSON.stringify({ ...freshDeliciaSave(), reducedMotion: manual }), writes = 0, frameRequests = 0;
    const original = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({ window, document, location: { hash: '' }, navigator: { maxTouchPoints: 0 },
        matchMedia: system === null ? undefined : (query: string) => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return media; },
        localStorage: { getItem: () => raw, setItem(key: string, value: string) { assert.equal(key, DELICIA_SAVE_KEY); raw = value; writes++; } },
        requestAnimationFrame: () => ++frameRequests, cancelAnimationFrame() {}, fetch: async () => ({ ok: false }) })) {
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, value });
    }
    const url = new URL('../src/adventure/delicia/DeliciaApp.ts', import.meta.url), require = createRequire(url);
    const css = require.extensions['.css']; require.extensions['.css'] = () => {};
    // This is Vite's environment value; no app methods or handlers are replaced.
    const source = readFileSync(url, 'utf8').replace('import.meta', '({env:{DEV:false}})');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const module = { exports: {} as typeof import('../src/adventure/delicia/DeliciaApp') };
    runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: url.pathname })(require, module, module.exports);
    const { DeliciaApp } = module.exports;
    const { DeliciaArt } = require('./DeliciaArt') as typeof import('../src/adventure/delicia/DeliciaArt');
    t.mock.method(DeliciaArt.prototype, 'load', async () => {});
    const artDraw = t.mock.method(DeliciaArt.prototype, 'draw');
    const steamDraw = t.mock.method(DeliciaArt.prototype as unknown as {
        steam(context: CanvasRenderingContext2D, box: Box, phase: string, time: number): void
    }, 'steam');
    interface App {
        reducedMotion: boolean; presentation: { renderer: { worldCanvas: Element }; menus: { root: Element } }; canvas: Element; panel: Element; screen: string; sim: DeliciaSimulation; store: DeliciaStore;
        mapCanvas: Element; shake: number; hitStop: number; accumulator: number;
        showSettings(): void; renderGame(): void; paintMap(time: number): void; loop(time: number): void;
        loadStage(id: string, retry: boolean): boolean; dispose(): void;
    }
    const apps: App[] = [];
    const create = () => { const app = new DeliciaApp(body as unknown as HTMLElement) as unknown as App; apps.push(app); return app; };
    t.after(() => {
        apps.forEach(app => app.dispose());
        if (css) require.extensions['.css'] = css; else delete require.extensions['.css'];
        for (const [name, descriptor] of original) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
        }
    });
    const app = create();
    const render = () => { app.sim ??= new DeliciaSimulation(); app.sim.time = 1; app.shake = .1;
        app.presentation.renderer.worldCanvas.calls.length = 0; app.renderGame();
        return { reduced: artDraw.mock.calls.at(-1)!.arguments[2], shake: app.presentation.renderer.worldCanvas.calls.some(([name]) => name === 'translate') }; };
    const map = (time: number) => { app.mapCanvas ??= new Element('canvas'); app.mapCanvas.calls.length = 0;
        app.paintMap(time); return app.mapCanvas.calls.filter(([name]) => name === 'lineTo'); };
    const options = (target=app) => { target.showSettings();
        const input = target.presentation.menus.root.all().find(node => node.attributes.get('aria-label')?.startsWith('Sempre reduzir movimento')); assert.ok(input);
        return { input, hint: () => input.attributes.get('aria-label') ?? '', toggle: (checked: boolean) => {
            if (target.store.save.reducedMotion !== checked) input.click(); target.renderGame();
        } };
    };
    return { app, create, render, map, options, changeSystem, listeners, window, artDraw, steamDraw,
        get raw() { return raw; }, get writes() { return writes; }, get activeElement() { return activeElement; }, get frameRequests() { return frameRequests; } };
}

for (const system of [false, true, null]) for (const manual of [false, true])
test(`startup applies system=${system} OR saved=${manual} to art, shake and sea`, t => {
    const h = fixture(t, system, manual), reduced = !!system || manual, save = structuredClone(h.app.store.save);
    assert.deepEqual(h.render(), { reduced, shake: !reduced });
    if (reduced) assert.deepEqual(h.map(1), h.map(2)); else assert.notDeepEqual(h.map(1), h.map(2));
    assert.deepEqual(h.app.store.save, save); assert.equal(h.writes, 0);
});

test('live system changes update the shared native option without changing opt-in or focus', t => {
    const h = fixture(t), { input, hint } = h.options(); input.focus();
    assert.equal(input.textContent, 'TREMOR: SIM');
    assert.match(hint(), /seguem o sistema/);
    h.changeSystem(true);
    assert.match(hint(), /ativa pelo sistema/); assert.equal(h.app.reducedMotion, true);
    assert.equal(h.app.store.save.reducedMotion, false); assert.equal(h.activeElement, input);
    h.changeSystem(false);
    assert.match(hint(), /seguem o sistema/); assert.equal(h.app.reducedMotion, false);
    assert.equal(h.activeElement, input); assert.equal(h.writes, 0);
});

test('manual opt-in persists independently and cannot override system reduction', t => {
    const h = fixture(t, true), { input, hint, toggle } = h.options(), original = structuredClone(h.app.store.save);
    toggle(true); assert.equal(h.writes, 1); assert.equal(input.textContent, 'TREMOR: NÃO');
    assert.deepEqual(JSON.parse(h.raw), { ...original, reducedMotion: true });
    h.changeSystem(false); assert.equal(h.app.reducedMotion, true);
    assert.equal(h.create().store.save.reducedMotion, true);
    toggle(false); assert.equal(h.app.reducedMotion, false);
    h.changeSystem(true); toggle(true); toggle(false);
    assert.equal(h.app.reducedMotion, true); assert.match(hint(), /ativa pelo sistema/);
    assert.deepEqual(JSON.parse(h.raw), original); assert.equal(h.writes, 4);
});

test('manual settings still toggle immediately without matchMedia', t => {
    const h = fixture(t, null), { toggle } = h.options();
    toggle(true); assert.equal(h.app.reducedMotion, true);
    toggle(false); assert.equal(h.app.reducedMotion, false); assert.equal(h.listeners.size, 0);
});

for (const legacy of [false, true]) test(`${legacy ? 'legacy' : 'modern'} media listeners dispose without stale menu updates`, t => {
    const h = fixture(t, false, false, legacy), { hint } = h.options(); assert.equal(h.listeners.size, 1);
    h.changeSystem(true); const text = hint(), queued = [...h.listeners][0]; assert.match(text, /ativa pelo sistema/);
    h.window.dispatchEvent(new Event('pagehide')); h.app.dispose(); assert.equal(h.listeners.size, 0);
    const requests = h.frameRequests; h.app.loop(1000); assert.equal(h.frameRequests, requests);
    h.changeSystem(false); queued(new Event('change')); assert.equal(hint(), text);
    const next = h.create(); assert.equal(h.listeners.size, 1); const nextHint = h.options(next).hint;
    assert.match(nextHint(), /seguem o sistema/); h.changeSystem(true); next.renderGame();
    assert.match(nextHint(), /ativa pelo sistema/); assert.equal(hint(), text);
    next.dispose(); assert.equal(h.listeners.size, 0);
});

test('system changes during play preserve simulation steps, hit-stop and progress', t => {
    const h = fixture(t); assert.equal(h.app.loadStage('delicia-1', true), true);
    const expected = new DeliciaSimulation(), save = structuredClone(h.app.store.save);
    h.app.loop(1000); h.app.accumulator = .004; h.app.hitStop = .025;
    h.changeSystem(true); assert.equal(h.app.accumulator, .004); assert.equal(h.app.hitStop, .025);
    h.app.loop(1010); assert.equal(h.app.sim.time, 0); assert.ok(Math.abs(h.app.hitStop - .015) < 1e-9);
    h.app.hitStop = 0;
    for (let i = 1; i <= 20; i++) {
        if (i === 10) h.changeSystem(false);
        h.app.loop(1010 + i * 10);
        while (expected.time + 1 / 60 <= h.app.sim.time + 1e-8) expected.update(1 / 60, noDeliciaInput());
    }
    assert.ok(h.app.sim.time > .19); assert.equal(h.app.sim.time, expected.time);
    assert.deepEqual(h.app.sim.player, expected.player); assert.deepEqual(h.app.sim.enemies, expected.enemies);
    assert.deepEqual(h.app.store.save, save);
});

test('reduced art keeps steam hazard cues on simulation time', t => {
    const h = fixture(t, true), stage = DELICIA_STAGES.find(stage => stage.hazards.some(hazard => hazard.kind === 'steam'))!;
    h.app.sim = new DeliciaSimulation(stage);
    const steam = stage.hazards.find(hazard => hazard.kind === 'steam')!;
    h.app.sim.cameraX = steam.x;
    for (const fraction of [.2, .65, .9]) {
        h.app.sim.time = (steam.period ?? 4) * fraction - (steam.phase ?? 0);
        const before = structuredClone(h.app.sim);
        h.app.canvas.calls.length = 0; h.app.renderGame();
        assert.equal(h.artDraw.mock.calls.at(-1)!.arguments[2], true);
        const cue = h.steamDraw.mock.calls.filter(call => call.arguments[1] === steam).at(-1)!;
        assert.equal(cue.arguments[2], steamPhase(h.app.sim.time, steam.period, steam.phase));
        assert.equal(cue.arguments[3], 0, 'Only decorative motion uses the stopped clock.');
        assert.deepEqual(structuredClone(h.app.sim), before, 'Rendering never rewrites gameplay state or clock.');
    }
});
