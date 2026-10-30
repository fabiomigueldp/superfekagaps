import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createDeliciaDom } from './helpers/deliciaDomHarness';
import { createMediaQueryHarness } from './helpers/mediaQueryHarness';
import { loadDeliciaApp } from './helpers/deliciaAppLoader';
import { DELICIA_STAGES, type Box } from '../src/adventure/delicia/DeliciaContent';
import { DELICIA_SAVE_KEY, freshDeliciaSave, type DeliciaStore } from '../src/adventure/delicia/DeliciaProgress';
import { DeliciaSimulation, noDeliciaInput, steamPhase } from '../src/adventure/delicia/DeliciaSimulation';

type DrawCall = [string, ...unknown[]];
/** Browser boundaries only: the constructor, settings, loop and both renderers run unchanged. */
function fixture(t: TestContext, system: boolean | null = false, manual = false, legacy = false) {
    const dom = createDeliciaDom(), motion = '(prefers-reduced-motion: reduce)';
    const mediaQueries = createMediaQueryHarness({ [motion]: system ?? false }, legacy);
    const cleanups: (() => void)[] = [];
    t.after(async () => {
        try { cleanups.forEach(cleanup => cleanup()); }
        finally { mediaQueries.dispose(); await dom.dispose(); }
    });
    const match = system === null ? undefined : mediaQueries.matchMedia;
    Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: match });
    let raw = JSON.stringify({ ...freshDeliciaSave(), reducedMotion: manual }), writes = 0, frameRequests = 0;
    const frames = new Map<number, FrameRequestCallback>();
    dom.install({ navigator: { maxTouchPoints: 0, getGamepads: () => [] }, matchMedia: match,
        localStorage: dom.window.localStorage, AudioContext: undefined,
        requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameRequests, callback); return frameRequests; },
        cancelAnimationFrame: (id: number) => { frames.delete(id); }, fetch: async () => ({ ok: false }) });
    const loaded = loadDeliciaApp(); cleanups.push(loaded.dispose);
    const { DeliciaApp, require } = loaded;
    const { DeliciaStore } = require('./DeliciaProgress') as typeof import('../src/adventure/delicia/DeliciaProgress');
    const storage = { getItem: () => raw, setItem(key: string, value: string) {
        assert.equal(key, DELICIA_SAVE_KEY); raw = value; writes++;
    } };
    const { DeliciaArt } = require('./DeliciaArt') as typeof import('../src/adventure/delicia/DeliciaArt');
    t.mock.method(DeliciaArt.prototype, 'load', async () => {});
    const artDraw = t.mock.method(DeliciaArt.prototype, 'draw');
    const steamDraw = t.mock.method(DeliciaArt.prototype as unknown as {
        steam(context: CanvasRenderingContext2D, box: Box, phase: string, time: number): void
    }, 'steam');
    interface App {
        reducedMotion: boolean; disposed: boolean;
        presentation: { renderer: { worldCanvas: HTMLCanvasElement }; menus: { root: HTMLElement } };
        canvas: HTMLCanvasElement; panel: HTMLElement; screen: string; sim: DeliciaSimulation; store: DeliciaStore;
        mapCanvas?: HTMLCanvasElement; shake: number; hitStop: number; accumulator: number;
        showSettings(): void; renderGame(): void; paintMap(time: number): void; loop(time: number): void;
        loadStage(id: string, retry: boolean): boolean; dispose(): void;
    }
    const recorded = new WeakMap<HTMLCanvasElement, DrawCall[]>();
    const calls = (canvas: HTMLCanvasElement) => {
        if (!recorded.has(canvas)) {
            const trace: DrawCall[] = [], context = canvas.getContext('2d')!;
            // The shared DOM controls painting; record the operations asserted below.
            for (const method of ['translate', 'lineTo'] as const) {
                const draw = context[method].bind(context);
                Object.defineProperty(context, method, { configurable: true, value: (...args: [number, number]) => {
                    trace.push([method, ...args]); draw(...args);
                } });
            }
            recorded.set(canvas, trace);
        }
        return recorded.get(canvas)!;
    };
    const apps: App[] = [];
    const create = () => {
        const app = new DeliciaApp(undefined, { store: new DeliciaStore(storage, false) }) as unknown as App;
        apps.push(app);
        // Paint a real playable scene, not the title menu which deliberately hides stage art.
        assert.equal(app.loadStage('delicia-1', true), true);
        return app;
    };
    cleanups.unshift(() => apps.forEach(app => app.dispose()));
    const app = create();
    const listeners = () => new Set(mediaQueries.control(motion).listeners.map(({ callback }) => {
        assert.equal(typeof callback, 'function'); return callback as EventListener;
    }));
    const changeSystem = (matches: boolean) => {
        mediaQueries.set(motion, matches);
        // Deliver a paint without advancing simulation time, as in the original fixture.
        for (const target of apps) if (!target.disposed) target.renderGame();
    };
    const render = () => { app.sim.time = 1; app.shake = .1;
        const trace = calls(app.presentation.renderer.worldCanvas); trace.length = 0; app.renderGame();
        return { reduced: artDraw.mock.calls.at(-1)!.arguments[2], shake: trace.some(([name]) => name === 'translate') }; };
    const map = (time: number) => {
        app.mapCanvas ??= dom.document.createElement('canvas') as unknown as HTMLCanvasElement;
        const trace = calls(app.mapCanvas); trace.length = 0;
        app.paintMap(time); return trace.filter(([name]) => name === 'lineTo');
    };
    const options = (target = app) => { target.showSettings();
        const input = target.presentation.menus.root.querySelector<HTMLButtonElement>('[aria-label^="Sempre reduzir movimento"]'); assert.ok(input);
        return { input, hint: () => input.getAttribute('aria-label') ?? '', toggle: (checked: boolean) => {
            if (target.store.save.reducedMotion !== checked) input.click(); target.renderGame();
        } };
    };
    return { app, create, render, map, options, changeSystem, get listeners() { return listeners(); }, window: dom.window, artDraw, steamDraw, calls,
        get raw() { return raw; }, get writes() { return writes; }, get activeElement() { return dom.document.activeElement; }, get frameRequests() { return frameRequests; } };
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
    h.window.dispatchEvent(new h.window.Event('pagehide')); h.app.dispose(); assert.equal(h.listeners.size, 0);
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
        h.calls(h.app.canvas).length = 0; h.app.renderGame();
        assert.equal(h.artDraw.mock.calls.at(-1)!.arguments[2], true);
        const cue = h.steamDraw.mock.calls.filter(call => call.arguments[1] === steam).at(-1)!;
        assert.equal(cue.arguments[2], steamPhase(h.app.sim.time, steam.period, steam.phase));
        assert.equal(cue.arguments[3], 0, 'Only decorative motion uses the stopped clock.');
        assert.deepEqual(structuredClone(h.app.sim), before, 'Rendering never rewrites gameplay state or clock.');
    }
});
