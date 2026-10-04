import { freshGuairaChapterProgress } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { ProgressStore, canContinueFromGuaira } from '../src/adventure/progress';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import type { WorldGame } from '../src/adventure/WorldGame';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { GuairaChapterApp, type GuairaChapterAppDependencies, type GuairaChapterMapPort } from '../src/adventure/experimental/guaira/chapter/GuairaChapterApp';
import { hasAcceptedPublicWater } from '../src/adventure/experimental/guaira/chapter/GuairaChapterWater';
import { GuairaChapterMapView, type GuairaChapterMapOptions } from '../src/adventure/experimental/guaira/chapter/GuairaChapterMapView';
import { loadGuairaChapterScene, type GuairaChapterSceneFactory, type GuairaChapterRuntime } from '../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import { type GuairaChapterSnapshot, type GuairaChapterSceneId } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { loadGuairaChapterExcursion, type GuairaChapterExcursionFactory } from '../src/adventure/experimental/guaira/chapter/GuairaChapterExcursions';
import { sameChapterMapTarget, type GuairaChapterNavigation } from '../src/adventure/experimental/guaira/chapter/GuairaChapterNavigation';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { DisposalScope } from '../src/engine/DisposalScope';
import { sceneLifecycleBrowser, LifecycleElement } from './helpers/sceneLifecycleHarness';

function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };

async function waitForGame(app: GuairaChapterApp) {
    const deadline = performance.now() + 5000;
    // Dynamic imports need event-loop progress, even when their modules were warmed.
    // The deadline bounds a broken load; readiness, not elapsed time, completes the wait.
    while (app.mode === 'loading' && performance.now() < deadline) await nextTurn();
    assert.equal(app.mode, 'game', 'The requested scene must finish loading before its controls are used');
    assert.ok(app.activeGame, 'The loaded scene must own a native runtime');
}

/** Real host/session/controls/native adapters. Canvas/audio/DOM device boundaries are instrumented.
 * The map port is deliberately injected: this suite tests ownership/dispatch, not painted geography.
 * Injected result samples below exercise receipt policy and are NOT evidence of gameplay victory.
 */
function hostBrowser(t: TestContext) {
    const restore: Array<() => void> = [];
    const h = sceneLifecycleBrowser({ after: (callback: () => void) => restore.push(callback) } as Pick<TestContext, 'after'>);
    const apps: GuairaChapterApp[] = [];
    const all = (at: LifecycleElement = h.body): LifecycleElement[] => [at, ...at.children.flatMap(child => all(child))];
    // Native removal releases a focused descendant to body without a focusin event.
    // A detached/disabled element cannot acquire focus; programmatic focus does bubble.
    let activeElement: LifecycleElement | null = null;
    Object.defineProperty(h.document, 'activeElement', { configurable: true, get: () => {
        if (activeElement && !all().includes(activeElement)) activeElement = null;
        return activeElement ?? h.body;
    } });
    const decorate = (node: LifecycleElement) => {
        Object.assign(node, { contains: (candidate: LifecycleElement) => all(node).includes(candidate),
            focus: () => {
                if (!all().includes(node) || node.disabled || node.hidden || activeElement === node) return;
                activeElement = node; h.document.dispatch('focusin', { target: node });
            },
            open: false, showModal() { Object.assign(node, { open: true }); }, close() { Object.assign(node, { open: false }); } });
        return node;
    };
    const originalCreate = h.document.createElement;
    h.document.createElement = tag => decorate(originalCreate(tag));
    const root = h.document.createElement('main'); root.id = 'guaira-chapter-root'; h.body.replaceChildren(root);
    h.document.getElementById = id => all().find(node => node.id === id) ?? null;
    Object.assign(h.document, { querySelector: (selector: string) => selector === 'nav' ? all().find(node => node.tagName === 'NAV') ?? null : null });
    const classes = new Set<string>();
    Object.defineProperty(h.body, 'classList', { configurable: true, value: {
        contains: (name: string) => classes.has(name),
        toggle: (name: string, force?: boolean) => { const add = force ?? !classes.has(name); if (add) classes.add(name); else classes.delete(name); return add; },
        remove: (...names: string[]) => names.forEach(name => classes.delete(name))
    } });
    for (const [name, value] of Object.entries({ innerWidth: 640, innerHeight: 440 })) {
        const old = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
        restore.push(() => { if (old) Object.defineProperty(globalThis, name, old); else Reflect.deleteProperty(globalThis, name); });
    }
    const mapPorts: Array<{ options: GuairaChapterMapOptions; port: GuairaChapterMapPort; button: LifecycleElement; snapshot: GuairaChapterSnapshot; navigation: GuairaChapterNavigation; physical: boolean; closed: boolean }> = [];
    const createMap: NonNullable<GuairaChapterAppDependencies['createMap']> = (node, options) => {
        const button = h.document.createElement('button'), owner = new DisposalScope();
        button.id = 'map-enter'; (node as unknown as LifecycleElement).append(button);
        const entry = { options, button, snapshot: options.snapshot, navigation: options.navigation, physical: true, closed: false, port: undefined as unknown as GuairaChapterMapPort };
        owner.listen(button, 'click', () => options.onEnter(entry.navigation.target, entry.snapshot.generation, entry.navigation.revision));
        entry.port = {
            update(snapshot, _walk, _opening, navigation = entry.navigation) { entry.snapshot = snapshot; entry.navigation = navigation; },
            canEnter(target, generation, revision) { return !entry.closed && entry.physical && sameChapterMapTarget(target, entry.navigation.target) && generation === entry.snapshot.generation && revision === entry.navigation.revision; },
            dispose() { entry.closed = true; owner.dispose(); }
        };
        mapPorts.push(entry); return entry.port;
    };
    const create = (dependencies: GuairaChapterAppDependencies = {}) => {
        const app = new GuairaChapterApp(root as unknown as HTMLElement, { createMap, ...dependencies }); apps.push(app); return app;
    };
    const currentMap = () => mapPorts.at(-1)!;
    const byId = (id: string) => { const node = h.document.getElementById(id); assert.ok(node, `Missing #${id}`); return node; };
    const enter = () => currentMap().button.click();
    const nativeKey = (key: string, target: LifecycleElement, repeat = false) => {
        // Real EventTarget dispatch plus the browser's native default-button click boundary.
        const event = h.window.dispatch('keydown', { key, code: key === ' ' ? 'Space' : key, target, repeat });
        if (key === 'Enter' && !event.defaultPrevented && !target.disabled) target.click();
        return event;
    };
    const checkDisposed = () => {
        assert.equal(h.frames.size, 0, 'No queued native or host RAF remains');
        assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 0, 'No owned audio context remains');
        assert.equal(h.listenerCount(), 0, 'All scene, touch, toolbar, map and host listeners are retired');
        assert.ok(h.observers.every(observer => observer.disconnected), 'Every acquired observer is disconnected');
        assert.equal(h.window.worldGame, undefined); assert.equal(h.window.renderer, undefined);
        assert.equal(all().filter(node => node.id === 'guaira-touch-controls').length, 0);
    };
    t.after(() => { apps.forEach(app => app.dispose()); restore.forEach(cleanup => cleanup()); });
    return { ...h, root, all, apps, create, createMap, currentMap, mapPorts, byId, enter, nativeKey, checkDisposed };
}
function invokeSaved(callback: EventListenerOrEventListenerObject, event = new Event('click')) {
    if (typeof callback === 'function') callback(event); else callback.handleEvent(event);
}

test('chapter guidance opens with the real objective and retains the native valve instruction', async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterScene('guaira-travessia');
    const app = h.create({ loadScene: async () => factory }); h.enter(); await flush();
    const game = app.activeGame!;
    assert.equal(game.stage.name, 'Travessia da Vala Seca');
    assert.doesNotMatch(game.stage.subtitle, /protótipo|experimental/i);
    game.render(); h.frame();
    assert.match(h.byId('lab-status').textContent, /Abra a comporta e atravesse até o arrozal/);
    assert.doesNotMatch(h.byId('lab-status').textContent, /Guaíra fictícia/);
    const hint = h.byId('chapter-keyboard-hint'), save = structuredClone(game.store.save);
    assert.match(hint.textContent, /←\/→ mover.*Espaço pular.*↓ no ar: sentada.*Shift correr.*Esc pausa/);
    h.byId('chapter-primary').click(); game.render(); h.frame();
    assert.equal(game.state, 'paused');
    assert.equal(h.byId('chapter-keyboard-hint'), hint, 'Pause keeps the visible key reference in place');
    assert.equal(hint.hidden, false);
    assert.match(h.byId('lab-status').textContent, /Pausado/);
    h.byId('chapter-primary').click();
    assert.equal(game.state, 'playing');
    assert.deepEqual(game.store.save, save);
    assert.equal(h.frames.size, 2, 'Guidance adds no animation loop');
    h.key('keydown', 'ArrowRight'); h.key('keydown', 'ShiftLeft');
    for (let frame = 0; frame < 92; frame++) game.update(1000 / 60);
    h.key('keyup', 'ArrowRight'); h.key('keyup', 'ShiftLeft');
    game.render(); h.frame();
    assert.match(h.byId('lab-status').textContent, /Pule primeiro\. No ar, aperte baixo sobre a placa/);
    assert.equal(app.snapshot.accepted.length, 0);
    app.dispose(); h.checkDisposed();
});

for (const exit of ['map', 'dispose'] as const) test(`late scene import after ${exit} never constructs a stale runtime`, async t => {
    const h = hostBrowser(t), pending = deferred<GuairaChapterSceneFactory>(); let constructed = 0;
    const app = h.create({ loadScene: () => pending.promise }); h.enter();
    assert.equal(app.mode, 'loading'); const attempt = app.snapshot.activeAttempt;
    if (exit === 'map') h.byId('chapter-map-return').click(); else app.dispose();
    const before = app.snapshot;
    pending.resolve(() => { constructed++; throw Error('Stale factory was called'); }); await flush();
    assert.equal(constructed, 0); assert.deepEqual(app.snapshot, before); assert.equal(app.snapshot.accepted.length, 0);
    assert.equal(attempt?.sceneId, 'guaira-travessia'); app.dispose(); h.checkDisposed();
});

test('retry retires pending generations; delayed success and rejection cannot replace the newest scene', async t => {
    const h = hostBrowser(t), loads: Array<ReturnType<typeof deferred<GuairaChapterSceneFactory>>> = [];
    let staleConstructions = 0;
    const app = h.create({ loadScene: () => { const next = deferred<GuairaChapterSceneFactory>(); loads.push(next); return next.promise; } });
    h.enter(); const firstAttempt = app.snapshot.activeAttempt;
    const oldRetry = h.byId('chapter-retry'), oldCallback = oldRetry.listeners.find(item => item.type === 'click')!.callback;
    oldRetry.click(); const secondAttempt = app.snapshot.activeAttempt;
    oldRetry.click(); invokeSaved(oldCallback); assert.equal(loads.length, 2);
    h.byId('chapter-retry').click(); const thirdAttempt = app.snapshot.activeAttempt;
    assert.notEqual(firstAttempt, secondAttempt); assert.notEqual(secondAttempt, thirdAttempt);
    const factory = await loadGuairaChapterScene('guaira-travessia'); loads[2].resolve(factory); await flush();
    const newest = app.activeGame; assert.ok(newest); assert.equal(app.mode, 'game');
    loads[0].resolve(() => { staleConstructions++; throw Error('Old factory'); }); loads[1].reject(Error('Late failure')); await flush();
    assert.equal(staleConstructions, 0); assert.equal(app.activeGame, newest); assert.equal(app.snapshot.activeAttempt, thirdAttempt);
    assert.equal(h.frames.size, 2, 'One native loop plus one host reflection loop');
    assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 1);
    app.dispose(); h.checkDisposed();
});

test('scene import finishing in a hidden tab starts paused and never resumes solely on visibility', async t => {
    const h = hostBrowser(t), pending = deferred<GuairaChapterSceneFactory>();
    const factory = await loadGuairaChapterScene('guaira-travessia');
    const app = h.create({ loadScene: () => pending.promise }); h.enter();
    h.document.hidden = true; h.document.dispatch('visibilitychange');
    pending.resolve(factory); await flush();
    const game = app.activeGame!; assert.ok(game);
    assert.equal(game.state, 'paused'); assert.equal(h.frames.size, 1, 'Hidden tab has no host reflection frame');
    const elapsed = game.elapsed;
    h.document.hidden = false; h.document.dispatch('visibilitychange'); h.frame();
    assert.equal(game.state, 'paused'); assert.equal(game.elapsed, elapsed);
    assert.equal(h.byId('chapter-primary').getAttribute('aria-label'), 'Retomar a tentativa');
    h.byId('chapter-primary').click(); assert.equal(game.state, 'playing');
    app.dispose(); h.checkDisposed();
});

test('real scene pause, blur, hidden and retry release input/audio and keep old toolbar callbacks inert', async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterScene('guaira-travessia');
    const app = h.create({ loadScene: async () => factory }); h.enter(); await flush();
    const old = app.activeGame!; const oldMap = h.byId('chapter-map-return'), oldPrimary = h.byId('chapter-primary');
    const oldHandlers = [oldMap, oldPrimary, h.byId('chapter-retry')].map(node => node.listeners.find(item => item.type === 'click')!.callback);
    const count = h.listenerCount();
    h.key('keydown', 'ArrowRight'); old.input.update(); assert.equal(old.input.getState().right, true);
    h.window.dispatch('blur'); assert.equal(old.state, 'paused'); assert.equal(old.input.getState().right, false);
    assert.equal(h.frames.size, 1, 'Blur leaves only the native paused loop');
    h.window.dispatch('focus'); h.frame(); assert.equal(oldPrimary.getAttribute('aria-label'), 'Retomar a tentativa');
    oldPrimary.click(); assert.equal(old.state, 'playing');
    h.document.hidden = true; h.document.dispatch('visibilitychange'); assert.equal(old.state, 'paused');
    assert.equal(h.frames.size, 1, 'Only the native loop remains while hidden');
    h.document.hidden = false; h.document.dispatch('visibilitychange');
    h.byId('chapter-retry').click(); await flush(); const fresh = app.activeGame!;
    assert.notEqual(fresh, old); assert.equal(old.isDisposed, true); assert.equal(old.audio.isDisposed, true);
    assert.equal(old.input.isDisposed, true); assert.equal(old.renderer.isDisposed, true);
    assert.equal(fresh.state, 'playing'); assert.equal(h.listenerCount(), count, 'Retry replaces listeners without accumulation');
    oldMap.click(); oldPrimary.click(); oldHandlers.forEach(callback => invokeSaved(callback));
    assert.equal(app.activeGame, fresh); assert.equal(app.snapshot.accepted.length, 0);
    app.dispose(); h.checkDisposed();
});

test('held native Enter cannot activate newly focused map or retry buttons, while fresh Enter still works', async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterScene('guaira-travessia'); let loads = 0;
    const app = h.create({ loadScene: async () => { loads++; return factory; } });
    assert.equal(h.nativeKey('Enter', h.currentMap().button, true).defaultPrevented, true); assert.equal(loads, 0);
    h.nativeKey('Enter', h.currentMap().button); await flush(); assert.equal(loads, 1);
    h.nativeKey('Enter', h.byId('chapter-map-return')); assert.equal(app.mode, 'map');
    h.nativeKey('Enter', h.currentMap().button, true); assert.equal(loads, 1);
    h.nativeKey('Enter', h.currentMap().button); await flush(); assert.equal(loads, 2);
    h.nativeKey('Enter', h.byId('chapter-retry'), true); assert.equal(loads, 2);
    const canvas = h.byId('game-canvas'); const space = h.window.dispatch('keydown', { key: ' ', code: 'Space', target: canvas, repeat: true });
    assert.ok(space.defaultPrevented, 'Native Input continues to handle gameplay Space');
    app.dispose(); h.checkDisposed();
});

test('partial native adapter constructor failure becomes a retryable error and releases base resources', async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    class BrokenTraversal extends GuairaTraversal { override load(): void { throw Error('Injected native stage failure'); } }
    const good = await loadGuairaChapterScene('guaira-travessia'); let failed = true;
    const app = h.create({ loadScene: async () => failed ? (canvas, status) => { new BrokenTraversal(canvas, status); throw Error('Unreachable'); } : good });
    h.enter(); await flush(); assert.equal(app.mode, 'error'); assert.equal(app.activeGame, null);
    assert.equal(h.window.worldGame, undefined); assert.equal(h.window.renderer, undefined); assert.equal(h.frames.size, 0);
    assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 0);
    failed = false; h.byId('chapter-retry').click(); await flush(); assert.equal(app.mode, 'game');
    app.dispose(); h.checkDisposed();
});

test('all six real scene factories are owned once; host acceptance uses live samples and preserves original receipts', async t => {
    const h = hostBrowser(t), factories = new Map<GuairaChapterSceneId, GuairaChapterSceneFactory>();
    for (const id of ['guaira-travessia', 'guaira-patio-comportas', 'guaira-respiros', 'guaira-lab', 'guaira-subida', 'guaira-prefeito'] as const)
        factories.set(id, await loadGuairaChapterScene(id));
    const resultAllowed = new Map<GuairaChapterRuntime, boolean>();
    const make = () => h.create({ loadScene: async id => (canvas, status) => {
        const native = factories.get(id)!(canvas, status);
        const runtime: GuairaChapterRuntime = { ...native, sample: attempt => {
            const sample = native.sample(attempt);
            const result = id === 'guaira-lab' ? { sceneId: id, kind: 'defeated-bull' } as const
                : id === 'guaira-prefeito' ? { sceneId: id, kind: 'mayor-water-released' } as const
                : { sceneId: id, kind: 'reached-finish' } as const;
            return { ...sample, result: resultAllowed.get(runtime) ? result : null };
        } };
        resultAllowed.set(runtime, false); return runtime;
    } });
    const app = make();
    for (const id of app.snapshot.route) {
        assert.equal(app.snapshot.selectedScene, id); h.enter(); await flush(); const game = app.activeGame!;
        assert.equal(game.stage.id, id); assert.equal(h.frames.size, 2);
        assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 1);
        const runtime = [...resultAllowed.keys()].at(-1)!; resultAllowed.set(runtime, true); h.frame();
        h.byId('chapter-primary').click();
        assert.equal(app.mode, 'map'); assert.equal(game.isDisposed, true); assert.equal(h.frames.size, 0);
        assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 0);
    }
    assert.equal(app.snapshot.chapterComplete, true); assert.equal(app.snapshot.accepted.length, 5);
    assert.equal(hasAcceptedPublicWater(app.snapshot), true);
    const receipts = app.snapshot.accepted; const last = h.currentMap(); last.options.onSelect({ kind: 'chapter', sceneId: 'guaira-prefeito' }, last.snapshot.generation, last.navigation.revision);
    h.enter(); await flush(); assert.equal(app.snapshot.accepted.length, 5);
    h.byId('chapter-map-return').click(); assert.deepEqual(app.snapshot.accepted, receipts);
    app.dispose(); h.checkDisposed();
    const alternate = make(), map = h.currentMap(); map.options.onOpening('guaira-patio-comportas', map.snapshot.generation, map.navigation.revision);
    h.enter(); await flush(); assert.equal(alternate.activeGame?.stage.id, 'guaira-patio-comportas');
    alternate.dispose(); h.checkDisposed();
});

test('actual entrypoint pagehide/bfcache remount and reload reset the session and retire a pending import', async t => {
    const h = hostBrowser(t), pending = deferred<GuairaChapterSceneFactory>();
    const factory = await loadGuairaChapterScene('guaira-travessia'); let loadCount = 0;
    class InjectedHost extends GuairaChapterApp {
        constructor(root: HTMLElement) { super(root, { createMap: h.createMap, loadScene: () => ++loadCount === 1 ? Promise.resolve(factory) : pending.promise }); h.apps.push(this); }
    }
    const source = readFileSync(new URL('../src/guaira-capitulo.ts', import.meta.url), 'utf8');
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    const entry = () => new Function('require', 'exports', compiled)((id: string) => id.endsWith('/progress') ? { ProgressStore, canContinueFromGuaira } : ({ GuairaChapterApp: InjectedHost }), {});
    entry(); const first = h.apps.at(-1)!; h.enter(); await flush();
    const native = (first as unknown as { mounted: { runtime: GuairaChapterRuntime } }).mounted.runtime;
    native.sample = attempt => ({ attempt, alive: true, state: 'playing', result: { sceneId: 'guaira-travessia', kind: 'reached-finish' } });
    h.frame();
    h.byId('chapter-primary').click(); assert.equal(first.snapshot.accepted.length, 1);
    h.enter(); assert.equal(first.mode, 'loading'); const firstSession = first.snapshot.generation.sessionId;
    h.window.dispatch('pagehide', { persisted: true }); assert.equal(first.isDisposed, true);
    h.window.dispatch('pageshow', { persisted: true }); const restored = h.apps.at(-1)!;
    assert.notEqual(restored.snapshot.generation.sessionId, firstSession); assert.equal(restored.snapshot.accepted.length, 0);
    assert.equal(restored.snapshot.activeAttempt, null); assert.equal(restored.mode, 'map');
    assert.equal(hasAcceptedPublicWater(first.snapshot), false); assert.equal(hasAcceptedPublicWater(restored.snapshot), false);
    h.window.dispatch('pageshow', { persisted: true }); const twiceRestored = h.apps.at(-1)!;
    assert.equal(restored.isDisposed, true, 'Even duplicate restoration retires the previous owner');
    assert.notEqual(twiceRestored, restored); assert.equal(twiceRestored.snapshot.accepted.length, 0);
    let stale = 0; pending.resolve(() => { stale++; throw Error('Disposed import'); }); await flush(); assert.equal(stale, 0);
    h.window.dispatch('pagehide', { persisted: false }); assert.equal(twiceRestored.isDisposed, true);
    h.window.dispatch('pageshow', { persisted: false }); assert.equal(h.apps.at(-1), twiceRestored);
    const beforeReload = twiceRestored.snapshot.generation.sessionId;
    // A real reload recreates the JS realm; replay entry source with its prior lifecycle listeners removed.
    for (const item of [...h.window.listeners]) if (['pagehide', 'pageshow'].includes(item.type)) h.window.removeEventListener(item.type, item.callback, item.capture);
    entry(); const reloaded = h.apps.at(-1)!; assert.notEqual(reloaded.snapshot.generation.sessionId, beforeReload);
    assert.equal(reloaded.snapshot.accepted.length, 0); assert.equal(reloaded.snapshot.opening, 'guaira-travessia');
    assert.equal(hasAcceptedPublicWater(reloaded.snapshot), false);
    reloaded.dispose();
    for (const item of [...h.window.listeners]) if (['pagehide', 'pageshow'].includes(item.type)) h.window.removeEventListener(item.type, item.callback, item.capture);
    h.checkDisposed();
});

test('partial controls construction retires every listener/observer before showing the error view', async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterScene('guaira-travessia'); t.mock.method(console, 'error', () => {});
    const observe = ResizeObserver.prototype.observe;
    t.mock.method(ResizeObserver.prototype, 'observe', function (this: ResizeObserver, target: Element) {
        observe.call(this, target); if ((target as unknown as LifecycleElement).id === 'guaira-touch-controls') throw Error('Observer failed while installing controls');
    });
    const app = h.create({ loadScene: async () => factory }); h.enter(); await flush();
    assert.equal(app.mode, 'error'); app.dispose(); h.checkDisposed();
});

test('partial real map construction retires captured document/media listeners', t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const observe = ResizeObserver.prototype.observe;
    t.mock.method(ResizeObserver.prototype, 'observe', function (this: ResizeObserver, target: Element) {
        observe.call(this, target); throw Error('Observer failed while installing map');
    });
    const app = h.create({ createMap: (root, options) => new GuairaChapterMapView(root, options) });
    app.dispose(); h.checkDisposed();
});

test('toolbar observer failure is caught before asynchronous scene load and leaves working plain recovery actions', async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const observe = ResizeObserver.prototype.observe;
    const observer = t.mock.method(ResizeObserver.prototype, 'observe', function (this: ResizeObserver, target: Element) {
        observe.call(this, target); if ((target as unknown as LifecycleElement).tagName === 'NAV') throw Error('Toolbar observer failed');
    });
    let loads = 0; const factory = await loadGuairaChapterScene('guaira-travessia');
    const app = h.create({ loadScene: async () => { loads++; return factory; } });
    // Catch the actual private async boundary to detect a rejected promise without creating an unhandled rejection.
    const host = app as unknown as { session: { enterScene: (scene: GuairaChapterSceneId, generation: GuairaChapterSnapshot['generation']) => NonNullable<GuairaChapterSnapshot['activeAttempt']> }; showScene: (attempt: NonNullable<GuairaChapterSnapshot['activeAttempt']>) => Promise<void> };
    const attempt = host.session.enterScene(app.snapshot.selectedScene, app.snapshot.generation);
    await assert.doesNotReject(host.showScene(attempt));
    assert.equal(app.mode, 'error'); assert.equal(loads, 0); assert.equal(h.frames.size, 0);
    observer.mock.restore(); h.byId('chapter-retry').click(); await flush(); assert.equal(app.mode, 'game');
    h.byId('chapter-map-return').click(); assert.equal(app.mode, 'map');
    app.dispose(); h.checkDisposed();
});

test('touch constructor callback failure rolls back before installer receives the controls instance', async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const warning = t.mock.method(console, 'warn', () => {});
    const factory = await loadGuairaChapterScene('guaira-travessia');
    const app = h.create({ loadScene: async () => (canvas, status) => {
        const runtime = factory(canvas, status);
        t.mock.method(runtime.game.renderer, 'setTouchControlsVisible', () => { throw Error('Control visibility failed'); });
        return runtime;
    } });
    h.enter(); await flush(); assert.equal(app.mode, 'error');
    assert.equal(warning.mock.callCount(), 1, 'Cleanup errors are isolated while preserving the original mount error');
    app.dispose(); h.checkDisposed();
});

test('bitmap toolbar failure leaves recovery actions usable without asking for another canvas context', async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const context = t.mock.method(LifecycleElement.prototype, 'getContext', () => { throw Error('Canvas device failed'); });
    let loads = 0; const app = h.create({ loadScene: async () => { loads++; throw Error('Must not import yet'); } });
    const host = app as unknown as { session: { enterScene: (scene: GuairaChapterSceneId, generation: GuairaChapterSnapshot['generation']) => NonNullable<GuairaChapterSnapshot['activeAttempt']> }; showScene: (attempt: NonNullable<GuairaChapterSnapshot['activeAttempt']>) => Promise<void> };
    const attempt = host.session.enterScene(app.snapshot.selectedScene, app.snapshot.generation);
    await assert.doesNotReject(host.showScene(attempt));
    assert.equal(app.mode, 'error'); assert.equal(loads, 0); assert.equal(context.mock.callCount(), 1);
    h.byId('chapter-map-return').click(); assert.equal(app.mode, 'map'); assert.equal(context.mock.callCount(), 1);
    app.dispose(); h.checkDisposed();
});

function chooseGallery(h: ReturnType<typeof hostBrowser>) {
    const map = h.currentMap();
    map.options.onSelect({ kind: 'optional', stop: 'bairro' }, map.snapshot.generation, map.navigation.revision);
}
function chooseRequired(h: ReturnType<typeof hostBrowser>, sceneId = h.currentMap().snapshot.selectedScene) {
    const map = h.currentMap();
    map.options.onSelect({ kind: 'chapter', sceneId }, map.snapshot.generation, map.navigation.revision);
}

for (const opening of ['guaira-travessia', 'guaira-patio-comportas'] as const)
for (const completed of [0, 1, 5]) test(`optional ownership preserves ${completed}/5 receipts and exact retained target after ${opening}`, async t => {
    const h = hostBrowser(t), galleryFactory = await loadGuairaChapterExcursion(), reliefFactory = await loadGuairaChapterExcursion('relief');
    const app = h.create({ loadExcursion: async id => { await nextTurn(); return id === 'relief' ? reliefFactory : galleryFactory; }, loadScene: async id => {
        // A cached dynamic import may still need an event-loop turn on another Node runtime.
        await nextTurn();
        const factory = await loadGuairaChapterScene(id);
        // This suite proves host ownership with explicit result fixtures. Native victory replay is tested separately.
        return (canvas, status) => {
            const runtime = factory(canvas, status);
            return { ...runtime, sample: attempt => ({ ...runtime.sample(attempt), result: id === 'guaira-lab'
                ? { sceneId: id, kind: 'defeated-bull' } : id === 'guaira-prefeito' ? { sceneId: id, kind: 'mayor-water-released' }
                    : { sceneId: id, kind: 'reached-finish' } }) };
        };
    } });
    if (opening !== app.snapshot.opening) {
        const map = h.currentMap(); map.options.onOpening(opening, map.snapshot.generation, map.navigation.revision);
    }
    for (let step = 0; step < completed; step++) {
        h.enter(); await waitForGame(app); h.byId('chapter-primary').click();
        assert.equal(app.mode, 'map');
        assert.equal(app.snapshot.accepted.length, step + 1, 'Each required scene earns its receipt before the optional visit');
    }
    if (completed) chooseRequired(h, opening); // Retain an earned replay, which differs from recommendation.
    const before = app.snapshot, openingAvailable = h.currentMap().options.openingAvailable;
    chooseGallery(h); assert.deepEqual(app.snapshot, before);
    const optionalMap = h.currentMap();
    optionalMap.options.onOpening('guaira-patio-comportas', before.generation, optionalMap.navigation.revision);
    assert.deepEqual(app.snapshot, before, 'Even current optional callbacks cannot change the opening');
    h.enter(); await waitForGame(app);
    const first = app.activeGame as GuairaGallery;
    assert.equal(first.stage.id, 'guaira-galeria'); assert.deepEqual(app.snapshot, before);
    assert.equal(h.byId('chapter-map-return').getAttribute('aria-label'), 'Voltar ao Bairro da Vala Seca no capítulo');
    first.finished = true; h.frame(); // Live local finish fixture cannot create a sixth result.
    assert.match(h.byId('lab-status').textContent, /Acesso de inspeção aberto/);
    assert.equal(h.byId('chapter-primary').getAttribute('aria-label'), 'Seguir para a Câmara de Alívio, continuação opcional');
    first.toggleGalleryPause(); h.frame(); assert.equal(first.state, 'paused'); assert.deepEqual(app.snapshot, before);
    h.byId('chapter-retry').click(); await waitForGame(app);
    const fresh = app.activeGame as GuairaGallery;
    assert.notEqual(fresh, first); assert.equal(first.isDisposed, true); assert.equal(fresh.finished, false);
    assert.deepEqual(fresh.openings, { first: false, second: false }); assert.deepEqual(app.snapshot, before);
    fresh.finished = true; h.frame(); h.byId('chapter-primary').click(); await waitForGame(app);
    const relief = app.activeGame as GuairaRelief;
    assert.equal(relief.stage.id, 'guaira-camara-alivio'); assert.equal(fresh.isDisposed, true);
    assert.equal(relief.player.data.hasHelmet, true); assert.deepEqual(app.snapshot, before);
    h.byId('chapter-retry').click(); await waitForGame(app);
    const freshRelief = app.activeGame as GuairaRelief;
    assert.notEqual(freshRelief, relief); assert.equal(relief.isDisposed, true);
    assert.equal(freshRelief.stage.id, 'guaira-camara-alivio'); assert.equal(freshRelief.finished, false);
    h.byId('chapter-map-return').click(); assert.equal(freshRelief.isDisposed, true); assert.deepEqual(app.snapshot, before);
    assert.equal(h.currentMap().options.arrival, 'bairro'); assert.equal(h.currentMap().options.focusAction, true);
    assert.deepEqual(h.currentMap().navigation.target, { kind: 'optional', stop: 'bairro' });
    assert.equal(h.currentMap().options.openingAvailable, openingAvailable);
    before.accepted.forEach((receipt, index) => assert.equal(app.snapshot.accepted[index], receipt));
    chooseRequired(h); assert.deepEqual(app.snapshot, before);
    assert.deepEqual(h.currentMap().navigation.target, { kind: 'chapter', sceneId: before.selectedScene });
    assert.equal(app.snapshot.nextRecommendedScene, before.nextRecommendedScene);
    if (!completed) {
        const resumed = h.currentMap(), alternative = opening === 'guaira-travessia' ? 'guaira-patio-comportas' : 'guaira-travessia';
        resumed.options.onOpening(alternative, resumed.snapshot.generation, resumed.navigation.revision);
        assert.equal(app.snapshot.opening, alternative, 'Returning from the optional rooms did not lock the opening');
        assert.equal(app.snapshot.accepted.length, 0);
    }
    app.dispose(); h.checkDisposed();
});

test('host rejects stale required and optional actions, reselection, physical gate failure and held Enter', async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterExcursion(); let loads = 0;
    const app = h.create({ loadExcursion: async () => { loads++; return factory; } });
    const map = h.currentMap(), initial = map.navigation, generation = map.snapshot.generation;
    chooseGallery(h); const firstOptional = map.navigation;
    map.options.onEnter(initial.target, generation, initial.revision);
    map.options.onSelect(initial.target, generation, initial.revision);
    map.options.onRestart(generation, initial.revision);
    map.options.onOpening('guaira-patio-comportas', generation, initial.revision);
    map.options.onExit(generation, initial.revision);
    assert.equal(app.mode, 'map'); assert.equal(app.isDisposed, false); assert.equal(map.navigation, firstOptional);
    chooseGallery(h); assert.ok(map.navigation.revision > firstOptional.revision); assert.equal(app.snapshot.generation, generation);
    map.options.onEnter(firstOptional.target, generation, firstOptional.revision); assert.equal(loads, 0);
    map.physical = false; h.enter(); assert.equal(loads, 0); map.physical = true;
    h.nativeKey('Enter', map.button, true); assert.equal(loads, 0);
    h.enter(); h.enter(); await flush(); assert.equal(loads, 1);
    const oldReturn = h.byId('chapter-map-return'), oldCallback = oldReturn.listeners.find(item => item.type === 'click')!.callback;
    h.nativeKey('Enter', oldReturn); const returned = h.currentMap(); assert.equal(app.mode, 'map');
    h.nativeKey('Enter', returned.button, true); assert.equal(loads, 1);
    const staleOptional = returned.navigation, staleGeneration = returned.snapshot.generation;
    chooseRequired(h);
    returned.options.onEnter(staleOptional.target, staleGeneration, staleOptional.revision);
    oldReturn.click(); invokeSaved(oldCallback); assert.equal(app.mode, 'map'); assert.equal(loads, 1);
    assert.equal(returned.navigation.target.kind, 'chapter');
    app.dispose(); h.checkDisposed();
});

for (const exit of ['bairro', 'restart', 'dispose'] as const) test(`late optional import after ${exit} never constructs or replaces the current view`, async t => {
    const h = hostBrowser(t), pending = deferred<GuairaChapterExcursionFactory>(); let constructed = 0;
    const app = h.create({ loadExcursion: () => pending.promise }); chooseGallery(h); const before = app.snapshot; h.enter();
    assert.equal(app.mode, 'loading'); assert.deepEqual(app.snapshot, before);
    if (exit === 'dispose') app.dispose();
    else {
        h.byId('chapter-map-return').click();
        if (exit === 'restart') { const map = h.currentMap(); map.options.onRestart(map.snapshot.generation, map.navigation.revision); }
    }
    const after = app.snapshot;
    pending.resolve(() => { constructed++; throw Error('Retired optional factory'); }); await flush();
    assert.equal(constructed, 0); assert.deepEqual(app.snapshot, after);
    if (exit === 'restart') { assert.notEqual(after.generation.sessionId, before.generation.sessionId); assert.equal(h.currentMap().navigation.target.kind, 'chapter'); }
    app.dispose(); h.checkDisposed();
});

test('optional retry retires pending attempts and saved buttons before late successes and rejections', async t => {
    const h = hostBrowser(t), loads: Array<ReturnType<typeof deferred<GuairaChapterExcursionFactory>>> = [];
    const factory = await loadGuairaChapterExcursion(); let stale = 0;
    const app = h.create({ loadExcursion: () => { const next = deferred<GuairaChapterExcursionFactory>(); loads.push(next); return next.promise; } });
    chooseGallery(h); const before = app.snapshot; h.enter();
    const oldRetry = h.byId('chapter-retry'), oldReturn = h.byId('chapter-map-return');
    const callbacks = [oldRetry, oldReturn].map(node => node.listeners.find(item => item.type === 'click')!.callback);
    oldRetry.click(); oldRetry.click(); oldReturn.click(); callbacks.forEach(callback => invokeSaved(callback));
    assert.equal(loads.length, 2); assert.equal(app.mode, 'loading');
    h.byId('chapter-retry').click(); loads[2].resolve(factory); await flush(); const newest = app.activeGame;
    loads[0].resolve(() => { stale++; throw Error('Stale Gallery'); }); loads[1].reject(Error('Retired import rejected')); await flush();
    assert.equal(stale, 0); assert.equal(app.activeGame, newest); assert.deepEqual(app.snapshot, before);
    assert.equal(h.frames.size, 2); assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 1);
    app.dispose(); h.checkDisposed();
});

test('hidden optional load stays paused on return to visibility; blur releases input and audio preference survives', async t => {
    const h = hostBrowser(t), pending = deferred<GuairaChapterExcursionFactory>(), factory = await loadGuairaChapterExcursion();
    const required = await loadGuairaChapterScene('guaira-travessia'); let loads = 0;
    const app = h.create({ loadScene: async () => required, loadExcursion: () => ++loads === 1 ? pending.promise : Promise.resolve(factory) });
    h.enter(); await flush(); app.activeGame!.audio.enabled = false; h.byId('chapter-map-return').click();
    chooseGallery(h); const before = app.snapshot; h.enter(); h.document.hidden = true; h.document.dispatch('visibilitychange');
    pending.resolve(factory); await flush(); const first = app.activeGame!;
    assert.equal(first.state, 'paused'); assert.equal(first.audio.enabled, false); assert.equal(h.frames.size, 1);
    const elapsed = first.elapsed; h.document.hidden = false; h.document.dispatch('visibilitychange'); h.frame();
    assert.equal(first.state, 'paused'); assert.equal(first.elapsed, elapsed); h.byId('chapter-primary').click();
    h.key('keydown', 'ArrowRight'); first.input.update(); assert.equal(first.input.getState().right, true);
    h.window.dispatch('blur'); assert.equal(first.state, 'paused'); assert.equal(first.input.getState().right, false);
    first.audio.enabled = true; h.byId('chapter-retry').click(); await flush(); const second = app.activeGame!;
    assert.equal(first.isDisposed, true); assert.equal(second.audio.enabled, true); assert.deepEqual(app.snapshot, before);
    assert.equal(second.state, 'paused', 'Retry in an unfocused window stays paused'); h.window.dispatch('focus');
    h.byId('chapter-map-return').click(); chooseRequired(h); h.enter(); await flush(); assert.equal(app.activeGame!.audio.enabled, true);
    app.dispose(); h.checkDisposed();
});

for (const failure of ['constructor', 'controls', 'toolbar', 'bitmap'] as const)
test(`optional ${failure} failure cleans partial ownership and leaves plain retry and Bairro actions`, async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterExcursion(); t.mock.method(console, 'error', () => {});
    const app = h.create({ loadExcursion: async () => factory }); chooseGallery(h); const before = app.snapshot;
    let restore = () => {};
    if (failure === 'constructor') {
        const patch = t.mock.method(GuairaGallery.prototype, 'load', () => { throw Error('Gallery native stage failed'); }); restore = () => patch.mock.restore();
    } else if (failure === 'bitmap') {
        const patch = t.mock.method(LifecycleElement.prototype, 'getContext', () => { throw Error('Canvas device failed'); }); restore = () => patch.mock.restore();
    } else {
        const observe = ResizeObserver.prototype.observe;
        const patch = t.mock.method(ResizeObserver.prototype, 'observe', function (this: ResizeObserver, target: Element) {
            observe.call(this, target);
            const node = target as unknown as LifecycleElement;
            if (failure === 'controls' ? node.id === 'guaira-touch-controls' : node.tagName === 'NAV') throw Error('Optional observer failed');
        }); restore = () => patch.mock.restore();
    }
    h.enter(); await flush(); assert.equal(app.mode, 'error'); assert.equal(app.activeGame, null); assert.deepEqual(app.snapshot, before);
    assert.equal(h.frames.size, 0); assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 0);
    assert.ok(h.observers.every(observer => observer.disconnected)); assert.equal(h.window.worldGame, undefined);
    restore(); h.byId('chapter-retry').click(); await flush(); assert.equal(app.mode, 'game'); assert.deepEqual(app.snapshot, before);
    h.byId('chapter-map-return').click(); assert.deepEqual(app.snapshot, before); assert.equal(h.currentMap().options.arrival, 'bairro');
    app.dispose(); h.checkDisposed();
});

test('optional load rejection can return through Bairro; map-constructor retries retain session, target and arrival', async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {}); let failMap = false, constructions = 0;
    const app = h.create({ loadExcursion: async () => { throw Error('Gallery import failed'); }, createMap: (root, options) => {
        constructions++; if (failMap) throw Error('Map setup failed'); return h.createMap(root, options);
    } });
    chooseGallery(h); const before = app.snapshot; h.enter(); await flush(); assert.equal(app.mode, 'error');
    failMap = true; h.byId('chapter-map-return').click(); assert.equal(app.mode, 'error'); assert.deepEqual(app.snapshot, before);
    const oldRetry = h.byId('chapter-map-retry'), oldCallback = oldRetry.listeners.find(item => item.type === 'click')!.callback;
    oldRetry.click(); assert.equal(constructions, 3, 'Only one local construction per explicit retry');
    oldRetry.click(); invokeSaved(oldCallback); assert.equal(constructions, 3);
    failMap = false; h.byId('chapter-map-retry').click(); assert.equal(constructions, 4); assert.equal(app.mode, 'map');
    assert.deepEqual(app.snapshot, before); assert.equal(h.currentMap().options.arrival, 'bairro');
    assert.equal(h.currentMap().options.walkToSelection, false); assert.equal(h.currentMap().options.focusAction, true);
    assert.deepEqual(h.currentMap().navigation.target, { kind: 'optional', stop: 'bairro' });
    app.dispose(); h.checkDisposed();
});

test('a reentrant optional factory cannot overwrite Bairro after its mount was retired', async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterExcursion(); let retired: GuairaGallery | null = null;
    const app = h.create({ loadExcursion: async () => (canvas, status) => {
        const runtime = factory(canvas, status); retired = runtime.game as GuairaGallery;
        h.byId('chapter-map-return').click(); return runtime;
    } });
    chooseGallery(h); const before = app.snapshot; h.enter(); await flush();
    assert.equal(app.mode, 'map'); assert.equal(app.activeGame, null); assert.equal(retired!.isDisposed, true);
    assert.deepEqual(app.snapshot, before); app.dispose(); h.checkDisposed();
});

test('required and optional pending mounts cannot cross over into one another through old actions or factories', async t => {
    const h = hostBrowser(t), requiredPending = deferred<GuairaChapterSceneFactory>(), optionalPending = deferred<GuairaChapterExcursionFactory>();
    const required = await loadGuairaChapterScene('guaira-travessia'); let requiredLoads = 0, stale = 0;
    const app = h.create({ loadScene: () => ++requiredLoads === 1 ? requiredPending.promise : Promise.resolve(required),
        loadExcursion: () => optionalPending.promise });
    h.enter(); const requiredButtons = ['chapter-retry', 'chapter-map-return'].map(id => h.byId(id));
    const requiredCallbacks = requiredButtons.map(node => node.listeners.find(item => item.type === 'click')!.callback);
    h.byId('chapter-map-return').click(); chooseGallery(h); const before = app.snapshot; h.enter();
    requiredCallbacks.forEach(callback => invokeSaved(callback)); requiredButtons.forEach(button => button.click());
    requiredPending.resolve(() => { stale++; throw Error('Old required factory'); }); await flush();
    assert.equal(stale, 0); assert.equal(app.mode, 'loading'); assert.deepEqual(app.snapshot, before);
    const optionalButtons = ['chapter-retry', 'chapter-map-return'].map(id => h.byId(id));
    const optionalCallbacks = optionalButtons.map(node => node.listeners.find(item => item.type === 'click')!.callback);
    h.byId('chapter-map-return').click(); chooseRequired(h); assert.deepEqual(app.snapshot, before); h.enter(); await flush();
    const newest = app.activeGame; optionalCallbacks.forEach(callback => invokeSaved(callback)); optionalButtons.forEach(button => button.click());
    optionalPending.reject(Error('Old optional import')); await flush();
    assert.equal(app.activeGame, newest); assert.equal(app.mode, 'game'); assert.equal(requiredLoads, 2);
    app.dispose(); h.checkDisposed();
});

for (const kind of ['chapter', 'optional'] as const)
for (const restoreBeforeResolve of [false, true])
test(`${kind} blur during pending import stays paused, including focus ${restoreBeforeResolve ? 'before' : 'after'} factory resolution`, async t => {
    const h = hostBrowser(t), required = await loadGuairaChapterScene('guaira-travessia'), optional = await loadGuairaChapterExcursion();
    const sceneLoad = deferred<GuairaChapterSceneFactory>(), excursionLoad = deferred<GuairaChapterExcursionFactory>();
    const app = h.create({ loadScene: () => sceneLoad.promise, loadExcursion: () => excursionLoad.promise });
    if (kind === 'optional') chooseGallery(h);
    h.enter(); const before = app.snapshot;
    h.window.dispatch('blur'); assert.equal(h.document.hidden, false, 'Blur alone is enough to suspend the owner');
    if (restoreBeforeResolve) h.window.dispatch('focus');
    sceneLoad.resolve(required); excursionLoad.resolve(optional); await flush();
    const game = app.activeGame!; assert.ok(game); assert.equal(game.state, 'paused');
    assert.equal(h.frames.size, restoreBeforeResolve ? 2 : 1, 'Host reflection runs only in a focused visible page');
    const elapsed = game.elapsed; h.frame(); assert.equal(game.elapsed, elapsed); assert.deepEqual(app.snapshot, before);
    h.window.dispatch('focus'); h.window.dispatch('focus'); h.document.dispatch('visibilitychange');
    assert.equal(h.frames.size, 2, 'Repeated focus notifications never duplicate host reflection');
    assert.equal(game.state, 'paused'); h.byId('chapter-primary').click(); assert.equal(game.state, 'playing');
    h.key('keydown', 'ArrowRight'); game.input.update(); h.window.dispatch('blur');
    assert.equal(game.state, 'paused'); assert.equal(game.input.getState().right, false); assert.equal(h.frames.size, 1);
    h.window.dispatch('focus'); assert.equal(game.state, 'paused'); assert.equal(h.frames.size, 2);
    app.dispose(); h.checkDisposed();
});

for (const kind of ['chapter', 'optional'] as const)
test(`${kind} hidden and restored during pending import still mounts paused`, async t => {
    const h = hostBrowser(t), required = await loadGuairaChapterScene('guaira-travessia'), optional = await loadGuairaChapterExcursion();
    const sceneLoad = deferred<GuairaChapterSceneFactory>(), excursionLoad = deferred<GuairaChapterExcursionFactory>();
    const app = h.create({ loadScene: () => sceneLoad.promise, loadExcursion: () => excursionLoad.promise });
    if (kind === 'optional') chooseGallery(h);
    h.enter(); h.document.hidden = true; h.document.dispatch('visibilitychange');
    h.document.hidden = false; h.document.dispatch('visibilitychange');
    sceneLoad.resolve(required); excursionLoad.resolve(optional); await flush();
    assert.equal(app.activeGame!.state, 'paused'); assert.equal(h.frames.size, 2);
    app.dispose(); h.checkDisposed();
});

const reliefName = 'Seguir para a Câmara de Alívio, continuação opcional';
function finishGalleryFixture(h: ReturnType<typeof hostBrowser>, app: GuairaChapterApp) {
    assert.ok((app.activeGame as WorldGame | null) instanceof GuairaGallery);
    // Ownership-only fixture. Native end-to-end movement is covered separately.
    (app.activeGame as GuairaGallery).finished = true; h.frame();
    assert.equal(h.byId('chapter-primary').getAttribute('aria-label'), reliefName);
}
const savedClick = (node: LifecycleElement) => node.listeners.find(item => item.type === 'click')!.callback;

for (const interrupt of ['blur', 'hidden'] as const)
test(`Gallery ALÍVIO action is retired by ${interrupt}; resumed completion needs a fresh explicit action`, async t => {
    const h = hostBrowser(t), gallery = await loadGuairaChapterExcursion(), relief = await loadGuairaChapterExcursion('relief');
    const loads: string[] = [];
    const app = h.create({ loadExcursion: async id => { loads.push(id); return id === 'gallery' ? gallery : relief; } });
    chooseGallery(h); h.enter(); await flush(); const game = app.activeGame!;
    finishGalleryFixture(h, app); const primary = h.byId('chapter-primary'), oldAction = savedClick(primary);
    game.audio.enabled = false;
    if (interrupt === 'blur') h.window.dispatch('blur');
    else { h.document.hidden = true; h.document.dispatch('visibilitychange'); }
    invokeSaved(oldAction); primary.click(); assert.deepEqual(loads, ['gallery']); assert.equal(game.state, 'paused');
    if (interrupt === 'blur') h.window.dispatch('focus');
    else { h.document.hidden = false; h.document.dispatch('visibilitychange'); }
    h.frame(); invokeSaved(oldAction); assert.equal(game.state, 'paused');
    assert.equal(primary.getAttribute('aria-label'), 'Retomar a tentativa opcional');
    primary.click(); assert.equal(game.state, 'playing'); assert.deepEqual(loads, ['gallery']);
    invokeSaved(oldAction); assert.deepEqual(loads, ['gallery'], 'The old completion callback stays inert after Resume');
    primary.click(); await flush(); assert.deepEqual(loads, ['gallery', 'relief']);
    assert.ok((app.activeGame as WorldGame | null) instanceof GuairaRelief); assert.equal(app.activeGame!.audio.enabled, false);
    assert.equal(game.isDisposed, true); assert.equal(game.input.isDisposed, true); assert.equal(game.audio.isDisposed, true);
    app.dispose(); h.checkDisposed();
});

test('optional primary requires living native Gallery finish, rejects a held press and retires Gallery before Relief factory mounts', async t => {
    const h = hostBrowser(t), gallery = await loadGuairaChapterExcursion(), relief = await loadGuairaChapterExcursion('relief');
    let old: WorldGame | null = null, loads = 0;
    const app = h.create({ loadExcursion: async id => {
        loads++;
        if (id === 'gallery') return gallery;
        assert.equal(old!.isDisposed, true); assert.equal(old!.input.isDisposed, true);
        assert.equal(old!.audio.isDisposed, true); assert.equal(h.frames.size, 0);
        assert.ok(h.observers.slice(0, -1).every(observer => observer.disconnected));
        assert.equal(h.all().filter(node => node.id === 'guaira-touch-controls').length, 0);
        return relief;
    } });
    chooseGallery(h); h.enter(); await flush(); old = app.activeGame!;
    const before = app.snapshot, primary = h.byId('chapter-primary');
    primary.click(); assert.equal(old.state, 'paused'); primary.click(); assert.equal(loads, 1, 'Unfinished Gallery only pauses/resumes');
    primary.dispatch('pointerdown', { pointerId: 99 });
    finishGalleryFixture(h, app); primary.dispatch('click', { detail: 1 }); assert.equal(loads, 1, 'Press begun before ALÍVIO cannot enter');
    const oldAction = savedClick(primary);
    old.player.data.isDead = true; invokeSaved(oldAction); assert.equal(loads, 1);
    old.player.data.isDead = false;
    h.nativeKey('Enter', primary, true); assert.equal(loads, 1);
    h.nativeKey('Enter', primary); await flush(); assert.ok((app.activeGame as WorldGame | null) instanceof GuairaRelief);
    const newest = app.activeGame!; invokeSaved(oldAction); primary.click(); assert.equal(app.activeGame, newest); assert.equal(loads, 2);
    h.nativeKey('Enter', h.byId('chapter-primary'), true); assert.equal(newest.state, 'playing');
    assert.deepEqual(app.snapshot, before); app.dispose(); h.checkDisposed();
});

for (const exit of ['retry', 'bairro', 'restart', 'dispose'] as const)
test(`late Relief import and saved ALÍVIO cannot replace the current view after ${exit}`, async t => {
    const h = hostBrowser(t), gallery = await loadGuairaChapterExcursion(), relief = await loadGuairaChapterExcursion('relief');
    const pending = deferred<GuairaChapterExcursionFactory>(); let reliefLoads = 0, staleConstructions = 0;
    const app = h.create({ loadExcursion: async id => id === 'gallery' ? gallery : ++reliefLoads === 1 ? pending.promise : relief });
    chooseGallery(h); h.enter(); await flush(); finishGalleryFixture(h, app);
    const oldPrimary = h.byId('chapter-primary'), oldAction = savedClick(oldPrimary);
    oldPrimary.click(); assert.equal(app.mode, 'loading'); assert.equal(app.activeGame, null);
    const oldRetry = h.byId('chapter-retry'), retryAction = savedClick(oldRetry);
    if (exit === 'retry') { oldRetry.click(); await flush(); assert.ok((app.activeGame as WorldGame | null) instanceof GuairaRelief); }
    else if (exit === 'dispose') app.dispose();
    else {
        h.byId('chapter-map-return').click();
        if (exit === 'restart') { const map = h.currentMap(); map.options.onRestart(map.snapshot.generation, map.navigation.revision); }
        else { h.enter(); await flush(); assert.ok((app.activeGame as WorldGame | null) instanceof GuairaGallery, 'Fresh map entry always starts Gallery'); }
    }
    const view = app.activeGame, before = app.snapshot;
    invokeSaved(oldAction); invokeSaved(retryAction); oldPrimary.click(); oldRetry.click();
    pending.resolve(() => { staleConstructions++; throw Error('Retired Relief factory'); }); await flush();
    assert.equal(staleConstructions, 0); assert.equal(app.activeGame, view); assert.deepEqual(app.snapshot, before);
    assert.equal(reliefLoads, exit === 'retry' ? 2 : 1); app.dispose(); h.checkDisposed();
});

for (const interruption of ['blur', 'hidden'] as const)
test(`Relief loading remembers ${interruption}, mounts paused and requires explicit resume`, async t => {
    const h = hostBrowser(t), gallery = await loadGuairaChapterExcursion(), relief = await loadGuairaChapterExcursion('relief');
    const pending = deferred<GuairaChapterExcursionFactory>();
    const app = h.create({ loadExcursion: id => id === 'gallery' ? Promise.resolve(gallery) : pending.promise });
    chooseGallery(h); h.enter(); await flush(); finishGalleryFixture(h, app); h.byId('chapter-primary').click();
    if (interruption === 'blur') { h.window.dispatch('blur'); h.window.dispatch('focus'); }
    else { h.document.hidden = true; h.document.dispatch('visibilitychange'); h.document.hidden = false; h.document.dispatch('visibilitychange'); }
    pending.resolve(relief); await flush(); const game = app.activeGame!;
    assert.ok(game instanceof GuairaRelief); assert.equal(game.state, 'paused');
    const elapsed = game.elapsed; h.frame(); assert.equal(game.elapsed, elapsed);
    h.byId('chapter-primary').click(); assert.equal(game.state, 'playing');
    assert.match(h.byId('lab-status').textContent, /intervalo seco.*tampa de alívio.*baixo no ar.*restaura tampa e jato/);
    app.dispose(); h.checkDisposed();
});

for (const failure of ['import', 'constructor', 'controls', 'toolbar', 'bitmap', 'wrong-room'] as const)
test(`Relief ${failure} failure disposes partial ownership; TENTAR retries Relief and Bairro exits internally`, async t => {
    const h = hostBrowser(t), gallery = await loadGuairaChapterExcursion(), relief = await loadGuairaChapterExcursion('relief');
    t.mock.method(console, 'error', () => {}); let fail = true; const loads: string[] = [];
    const app = h.create({ loadExcursion: async id => {
        loads.push(id); if (id === 'gallery') return gallery;
        if (failure === 'import' && fail) throw Error('Relief import failed');
        return failure === 'wrong-room' && fail ? gallery : relief;
    } });
    chooseGallery(h); h.enter(); await flush(); finishGalleryFixture(h, app); const before = app.snapshot;
    let restore = () => {};
    if (failure === 'constructor') {
        const patch = t.mock.method(GuairaRelief.prototype, 'load', () => { throw Error('Relief stage failed'); }); restore = () => patch.mock.restore();
    } else if (failure === 'bitmap') {
        const patch = t.mock.method(LifecycleElement.prototype, 'getContext', () => { throw Error('Canvas failed'); }); restore = () => patch.mock.restore();
    } else if (failure === 'controls' || failure === 'toolbar') {
        const observe = ResizeObserver.prototype.observe;
        const patch = t.mock.method(ResizeObserver.prototype, 'observe', function (this: ResizeObserver, target: Element) {
            observe.call(this, target); const node = target as unknown as LifecycleElement;
            if (failure === 'controls' ? node.id === 'guaira-touch-controls' : node.tagName === 'NAV') throw Error('Relief observer failed');
        }); restore = () => patch.mock.restore();
    }
    h.byId('chapter-primary').click(); await flush();
    assert.equal(app.mode, 'error'); assert.equal(app.activeGame, null); assert.deepEqual(app.snapshot, before);
    assert.match(h.byId('lab-status').textContent, /Câmara de Alívio/); assert.equal(h.frames.size, 0);
    assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 0);
    assert.ok(h.observers.every(observer => observer.disconnected));
    restore(); fail = false; h.byId('chapter-retry').click(); await flush();
    assert.ok((app.activeGame as WorldGame | null) instanceof GuairaRelief); assert.equal(loads.at(-1), 'relief'); assert.deepEqual(app.snapshot, before);
    h.byId('chapter-map-return').click(); assert.equal(h.currentMap().options.arrival, 'bairro'); assert.deepEqual(app.snapshot, before);
    h.enter(); await flush(); assert.ok((app.activeGame as WorldGame | null) instanceof GuairaGallery); assert.equal(loads.at(-1), 'gallery');
    app.dispose(); h.checkDisposed();
});

for (const action of ['retry', 'bairro'] as const)
test(`reentrant Relief factory cannot replace the newer ${action === 'retry' ? 'Relief' : 'Gallery'} attempt`, async t => {
    const h = hostBrowser(t), gallery = await loadGuairaChapterExcursion(), relief = await loadGuairaChapterExcursion('relief');
    let retired: WorldGame | null = null, reliefLoads = 0;
    const app = h.create({ loadExcursion: async id => id === 'gallery' ? gallery : ++reliefLoads > 1 ? relief : (canvas, status) => {
        const runtime = relief(canvas, status); retired = runtime.game;
        if (action === 'retry') h.byId('chapter-retry').click();
        else { h.byId('chapter-map-return').click(); h.enter(); }
        return runtime;
    } });
    chooseGallery(h); h.enter(); await flush(); const before = app.snapshot;
    finishGalleryFixture(h, app); h.byId('chapter-primary').click(); await flush();
    assert.equal(app.activeGame?.stage.id, action === 'retry' ? 'guaira-camara-alivio' : 'guaira-galeria'); assert.equal(retired!.isDisposed, true);
    assert.deepEqual(app.snapshot, before); assert.equal(h.frames.size, 2);
    app.dispose(); h.checkDisposed();
});

test('saved ALÍVIO is not a pause/resume callback and stays retired after an explicit pause cycle', async t => {
    const h = hostBrowser(t), gallery = await loadGuairaChapterExcursion(), relief = await loadGuairaChapterExcursion('relief');
    const app = h.create({ loadExcursion: async id => id === 'gallery' ? gallery : relief });
    chooseGallery(h); h.enter(); await flush(); finishGalleryFixture(h, app);
    const game = app.activeGame as GuairaGallery, primary = h.byId('chapter-primary'), oldAction = savedClick(primary);
    game.toggleGalleryPause(); h.frame(); invokeSaved(oldAction); assert.equal(game.state, 'paused');
    primary.click(); assert.equal(game.state, 'playing'); invokeSaved(oldAction); assert.equal(app.activeGame, game);
    primary.click(); await flush(); assert.ok(app.activeGame instanceof GuairaRelief);
    app.dispose(); h.checkDisposed();
});


for (const failure of ['wrong-room', 'reentrant'] as const) test(`optional muted preference survives unadopted ${failure} factory`, async t => {
    const h = hostBrowser(t), gallery = await loadGuairaChapterExcursion(), relief = await loadGuairaChapterExcursion('relief');
    let loads = 0;
    t.mock.method(console, 'error', () => {});
    const app = h.create({ loadExcursion: async () => ++loads === 2 ? failure === 'wrong-room' ? relief
        : (canvas, status) => { const runtime = gallery(canvas, status); h.byId('chapter-retry').click(); return runtime; } : gallery });
    const map = h.currentMap();
    map.options.onSelect({ kind: 'optional', stop: 'bairro' }, map.snapshot.generation, map.navigation.revision);
    h.enter(); await flush();
    const before = app.snapshot;
    app.activeGame!.audio.enabled = false;
    h.byId('chapter-retry').click(); await flush();
    if (failure === 'wrong-room') { assert.equal(app.mode, 'error'); h.byId('chapter-retry').click(); await flush(); }
    assert.deepEqual(app.snapshot, before);
    assert.equal(app.activeGame!.audio.enabled, false, 'A retired candidate never owns the preference of the adopted scene');
    app.dispose(); h.checkDisposed();
});

test('required muted preference survives an unadopted reentrant factory', async t => {
    const h = hostBrowser(t), traversal = await loadGuairaChapterScene('guaira-travessia');
    let loads = 0;
    const app = h.create({ loadScene: async () => ++loads === 2
        ? (canvas, status) => { const runtime = traversal(canvas, status); h.byId('chapter-retry').click(); return runtime; } : traversal });
    h.enter(); await flush(); app.activeGame!.audio.enabled = false;
    h.byId('chapter-retry').click(); await flush();
    assert.equal(app.mode, 'game'); assert.equal(app.activeGame!.stage.id, 'guaira-travessia');
    assert.equal(app.activeGame!.audio.enabled, false);
    app.dispose(); h.checkDisposed();
});

test('durable chapter awards live completion before navigation, survives reload, and preserves rewards on restart', async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterScene('guaira-travessia');
    let raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const make = () => h.create({ progressStore: new ProgressStore(storage), loadScene: async () => factory });
    const first = make(); h.enter(); await flush();
    const runtime = (first as unknown as { mounted: { runtime: GuairaChapterRuntime } }).mounted.runtime;
    runtime.sample = attempt => ({ attempt, alive: true, state: 'playing', result: { sceneId: 'guaira-travessia', kind: 'reached-finish' } });
    first.activeGame!.audio.enabled = false; first.activeGame!.coins = 7; h.frame();
    assert.match(h.byId('lab-status').textContent, /7 moedas coletadas nesta tentativa/);
    assert.deepEqual(new ProgressStore(storage).save.guaira.completed, ['guaira-travessia'], 'No Continue or map click required');
    assert.equal(new ProgressStore(storage).save.guaira.audioEnabled, false);
    const oldAttempt = first.snapshot.activeAttempt; first.dispose();
    const restored = make(); assert.equal(restored.mode, 'map'); assert.equal(restored.snapshot.accepted.length, 1);
    assert.equal(restored.snapshot.activeAttempt, null); assert.notEqual(restored.snapshot.generation.sessionId, oldAttempt?.sessionId);
    const map = h.currentMap(); map.options.onRestart(map.snapshot.generation, map.navigation.revision);
    assert.equal(restored.snapshot.accepted.length, 1); assert.equal(new ProgressStore(storage).save.guaira.completed.length, 1);
    restored.dispose(); h.checkDisposed();
});

test('interrupted persisted chapter restarts the selected native scene without restoring tokens or runtime position', async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterScene('guaira-travessia');
    let raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const make = () => h.create({ progressStore: new ProgressStore(storage), loadScene: async () => factory });
    const first = make(); h.enter(); await flush();
    const startX = first.activeGame!.player.data.position.x, oldAttempt = first.snapshot.activeAttempt!;
    first.activeGame!.player.data.position.x += 200; first.dispose();
    const restored = make(); await flush();
    assert.equal(restored.mode, 'game'); assert.equal(restored.activeGame!.player.data.position.x, startX);
    assert.equal(restored.snapshot.accepted.length, 0); assert.notEqual(restored.snapshot.activeAttempt!.sessionId, oldAttempt.sessionId);
    restored.dispose(); h.checkDisposed();
});


test('campaign map recovery returns to the journey without leaving through extras', t => {
    const h = hostBrowser(t); let exits = 0;
    const app = h.create({ campaign: true, createMap: () => { throw Error('Injected map failure'); }, exit: () => { exits++; } });
    assert.equal(app.mode, 'error');
    const back = h.all().find(node => node.getAttribute('aria-label') === 'Voltar à Fábrica e continuar a viagem');
    assert.ok(back); assert.equal(back.textContent, 'FÁBRICA');
    back.click(); assert.equal(exits, 1);
    assert.equal(app.isDisposed, false, 'The campaign owns travel/cancel and disposal');
});

for (const optional of [false, true]) test(`sound control works during ${optional ? 'optional' : 'required'} play and pause, persists, and retires with its view`, async t => {
    const h = hostBrowser(t);
    let raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const app = h.create({ progressStore: new ProgressStore(storage) });
    if (optional) chooseGallery(h);
    h.enter(); await waitForGame(app);
    const game = app.activeGame!, sound = h.byId('chapter-sound');
    assert.equal(sound.disabled, false);
    assert.equal(sound.getAttribute('aria-pressed'), 'true');
    assert.match(h.byId('chapter-keyboard-hint').textContent, /M som/);
    sound.click();
    assert.equal(game.audio.enabled, false);
    assert.equal(sound.getAttribute('aria-pressed'), 'false');
    assert.equal(new ProgressStore(storage).save.guaira.audioEnabled, false);
    assert.equal(game.state, 'playing');
    h.key('keydown', 'KeyM'); game.update(1000 / 60); h.key('keyup', 'KeyM'); h.frame();
    assert.equal(game.audio.enabled, true); assert.equal(sound.getAttribute('aria-pressed'), 'true');
    sound.click(); assert.equal(game.audio.enabled, false);
    h.byId('chapter-primary').click(); h.frame();
    assert.equal(game.state, 'paused');
    assert.match(h.byId('lab-status').textContent, /Continuar retoma daqui.*recarregar reinicia o trecho/);
    sound.click();
    assert.equal(game.audio.enabled, true); assert.equal(game.state, 'paused');
    assert.equal(new ProgressStore(storage).save.guaira.audioEnabled, true);
    const oldAction = sound.listeners.find(item => item.type === 'click')!.callback;
    h.byId('chapter-map-return').click(); invokeSaved(oldAction);
    assert.equal(new ProgressStore(storage).save.guaira.audioEnabled, true);
    app.dispose(); h.checkDisposed();
});

test('sound control is disabled until a runtime exists and failed loads retain recovery', async t => {
    const h = hostBrowser(t), pending = deferred<GuairaChapterSceneFactory>();
    const app = h.create({ loadScene: () => pending.promise }); h.enter();
    assert.equal(h.byId('chapter-sound').disabled, true);
    pending.reject(Error('Injected sound loading failure')); await flush();
    assert.equal(app.mode, 'error');
    h.byId('chapter-map-return').click(); assert.equal(app.mode, 'map');
    app.dispose(); h.checkDisposed();
});

for (const [sceneId, prerequisiteCount, recordingName, story] of [
    ['guaira-lab', 2, 'guairaLabReplay', /Ossabravo descansou\. A água ainda falta no bairro\. Suba à Casa da Vazão\./],
    ['guaira-prefeito', 4, 'guairaMayorReplay', /Ramal público aberto\. Os moradores têm água na bica outra vez\. Os gaps continuam\./]
] as const) test(`${sceneId}: story follows the real native result and does not block pause, retry or map`, async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterScene(sceneId), store = new ProgressStore(null);
    const route: GuairaChapterSceneId[] = ['guaira-travessia', 'guaira-respiros', 'guaira-lab', 'guaira-subida', 'guaira-prefeito'];
    store.updateGuaira({ ...store.save.guaira, completed: route.slice(0, prerequisiteCount), selectedScene: sceneId });
    const app = h.create({ progressStore: store, loadScene: async () => factory }); h.enter(); await flush();
    const game = app.activeGame!, record = JSON.parse(readFileSync(new URL(`./helpers/${recordingName}.json`, import.meta.url), 'utf8'));
    assert.doesNotMatch(h.byId('lab-status').textContent, story);
    let held = new Set<string>();
    for (const [count, keys] of [[record.initialSettleFrames ?? 0, []], ...record.runs] as Array<[number, string[]]>) {
        const next = new Set(keys);
        for (const code of held) if (!next.has(code)) h.key('keyup', code === 'Space' ? ' ' : code);
        for (const code of next) if (!held.has(code)) h.key('keydown', code === 'Space' ? ' ' : code);
        held = next;
        for (let frame = 0; frame < count; frame++) game.update(record.stepMs);
    }
    for (const code of held) h.key('keyup', code === 'Space' ? ' ' : code);
    game.render(); h.frame();
    assert.match(h.byId('lab-status').textContent, story);
    assert.equal(app.snapshot.accepted.length, prerequisiteCount + 1);
    const receipts = app.snapshot.accepted, rendered = h.byId('lab-status').textContent;
    h.frame(); assert.equal(h.byId('lab-status').textContent, rendered);
    assert.deepEqual(app.snapshot.accepted, receipts);
    assert.equal(h.frames.size, 2, 'Context adds no third RAF or cutscene');
    (game as WorldGame & { toggleLabPause(): void }).toggleLabPause(); game.render(); h.frame();
    assert.match(h.byId('lab-status').textContent, /Pausado/); assert.doesNotMatch(h.byId('lab-status').textContent, story);
    h.byId('chapter-primary').click(); game.render(); h.frame();
    assert.match(h.byId('lab-status').textContent, story);
    h.byId('chapter-retry').click(); await flush();
    assert.doesNotMatch(h.byId('lab-status').textContent, story, 'Fresh replay cannot show a current-attempt victory');
    assert.deepEqual(app.snapshot.accepted, receipts, 'Retry preserves durable receipts');
    h.byId('chapter-map-return').click(); assert.equal(app.mode, 'map');
    assert.deepEqual(app.snapshot.accepted, receipts); app.dispose(); h.checkDisposed();
});

for (const kind of ['map', 'chapter', 'gallery', 'relief'] as const)
test(`${kind} failure gives the mounted plain retry keyboard focus`, async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const pending = deferred<never>();
    const store = new ProgressStore(null);
    if (kind === 'relief') store.updateGuaira({ ...freshGuairaChapterProgress(), resumeScene: 'relief' });
    const app = h.create({ progressStore: store,
        createMap: kind === 'map' ? () => { throw Error('Map failed'); } : h.createMap,
        loadScene: () => pending.promise, loadExcursion: () => pending.promise });
    if (kind !== 'map') {
        if (kind !== 'relief') {
            if (kind === 'gallery') chooseGallery(h);
            h.currentMap().button.focus(); h.enter();
            assert.equal(h.document.activeElement, h.body, 'Removed map control must not retain synthetic focus');
        }
        const canvas = h.byId('game-canvas'); canvas.focus();
        pending.reject(Error('Load failed')); await flush();
        assert.ok(!h.all().includes(canvas));
    }
    assert.equal(app.mode, 'error');
    assert.equal(h.document.activeElement, h.byId(kind === 'map' ? 'chapter-map-retry' : 'chapter-retry'));
    app.dispose(); h.checkDisposed();
});

function pendingRecovery(h: ReturnType<typeof hostBrowser>, kind: 'chapter' | 'gallery' | 'relief') {
    const loads: Array<ReturnType<typeof deferred<never>>> = [], store = new ProgressStore(null);
    if (kind === 'relief') store.updateGuaira({ ...freshGuairaChapterProgress(), resumeScene: 'relief' });
    const load = () => { const next = deferred<never>(); loads.push(next); return next.promise; };
    const app = h.create({ progressStore: store, loadScene: load, loadExcursion: load });
    if (kind !== 'relief') { if (kind === 'gallery') chooseGallery(h); h.enter(); }
    return { app, loads };
}

for (const kind of ['chapter', 'gallery', 'relief'] as const)
for (const interruption of ['external', 'removed-external', 'outside-pointer', 'blur', 'hidden', 'blur-return', 'hidden-return'] as const)
test(`${kind} recovery focus never steals after ${interruption}`, async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const { app, loads } = pendingRecovery(h, kind), before = app.snapshot;
    h.byId('game-canvas').focus();
    const external = h.document.createElement('button'); h.body.append(external);
    if (interruption.includes('external')) { external.focus(); if (interruption === 'removed-external') external.remove(); }
    else if (interruption === 'outside-pointer') h.document.dispatch('pointerdown', { target: h.body });
    else if (interruption.startsWith('blur')) { h.window.dispatch('blur'); if (interruption.endsWith('return')) h.window.dispatch('focus'); }
    else { h.document.hidden = true; h.document.dispatch('visibilitychange');
        if (interruption.endsWith('return')) { h.document.hidden = false; h.document.dispatch('visibilitychange'); } }
    loads[0].reject(Error('Load failed after interruption')); await flush();
    assert.equal(app.mode, 'error'); assert.deepEqual(app.snapshot, before);
    const expected = interruption === 'external' ? external : h.body;
    assert.equal(h.document.activeElement, expected);
    h.document.hidden = false; h.document.dispatch('visibilitychange'); h.window.dispatch('focus'); h.frame();
    assert.equal(h.document.activeElement, expected, 'Returning must not run deferred recovery focus');
    const map = h.byId('chapter-map-return'); map.focus(); h.window.dispatch('focus'); h.document.dispatch('visibilitychange');
    assert.equal(h.document.activeElement, map, 'A later recovery choice remains the user’s');
    assert.equal(app.activeGame, null); assert.equal(h.frames.size, 0);
    app.dispose(); h.checkDisposed();
});

for (const kind of ['map', 'chapter', 'gallery', 'relief'] as const)
test(`${kind} recovery focus preserves a meaningful external control present at entry`, async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const external = h.document.createElement('button'); h.body.append(external); external.focus();
    let app: GuairaChapterApp;
    if (kind === 'map') app = h.create({ createMap: () => { throw Error('Map failed'); } });
    else { const pending = pendingRecovery(h, kind); app = pending.app; pending.loads[0].reject(Error('Load failed')); await flush(); }
    assert.equal(app.mode, 'error'); assert.equal(h.document.activeElement, external);
    app.dispose(); h.checkDisposed();
});

for (const kind of ['chapter', 'gallery', 'relief'] as const)
test(`${kind} recovery focus follows each fresh retry but ignores a retired rejection and held Enter`, async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const { app, loads } = pendingRecovery(h, kind);
    h.byId('chapter-retry').focus(); h.byId('chapter-retry').click();
    const canvas = h.byId('game-canvas'); canvas.focus();
    loads[0].reject(Error('Retired load failed')); await flush();
    assert.equal(app.mode, 'loading'); assert.equal(h.document.activeElement, canvas);
    loads[1].reject(Error('Current load failed')); await flush();
    const retry = h.byId('chapter-retry'), saved = savedClick(retry);
    assert.equal(h.document.activeElement, retry);
    assert.equal(h.nativeKey('Enter', retry, true).defaultPrevented, true); assert.equal(loads.length, 2);
    h.nativeKey('Enter', retry); assert.equal(loads.length, 3);
    assert.equal(h.document.activeElement, h.body, 'Replacing focused recovery action resets native focus');
    retry.click(); invokeSaved(saved); assert.equal(loads.length, 3);
    loads[2].reject(Error('Fresh retry failed')); await flush();
    assert.equal(h.document.activeElement, h.byId('chapter-retry'));
    assert.notEqual(h.document.activeElement, retry); assert.equal(app.snapshot.accepted.length, 0);
    app.dispose(); h.checkDisposed();
});

for (const kind of ['chapter', 'gallery', 'relief'] as const)
for (const navigation of ['map', 'dispose'] as const)
test(`${kind} recovery focus cannot survive ${navigation} before late rejection`, async t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const { app, loads } = pendingRecovery(h, kind);
    h.byId('game-canvas').focus();
    if (navigation === 'map') { h.byId('chapter-map-return').click(); h.currentMap().button.focus(); }
    else app.dispose();
    const active = h.document.activeElement, before = app.snapshot;
    loads[0].reject(Error('Retired load failed')); await flush();
    h.window.dispatch('focus'); h.document.dispatch('visibilitychange');
    assert.equal(h.document.activeElement, active); assert.deepEqual(app.snapshot, before);
    assert.equal(app.mode, navigation === 'map' ? 'map' : 'disposed');
    app.dispose(); h.checkDisposed();
});

test('map recovery focus follows repeated failures and keeps retired retry actions inert', t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {}); let constructions = 0;
    const app = h.create({ createMap: (root) => {
        constructions++; const transient = h.document.createElement('button');
        (root as unknown as LifecycleElement).append(transient); transient.focus(); throw Error('Map failed');
    } });
    const retry = h.byId('chapter-map-retry'), saved = savedClick(retry);
    assert.equal(h.document.activeElement, retry);
    h.nativeKey('Enter', retry, true); assert.equal(constructions, 1);
    h.nativeKey('Enter', retry); assert.equal(constructions, 2);
    const next = h.byId('chapter-map-retry'); assert.notEqual(next, retry); assert.equal(h.document.activeElement, next);
    retry.click(); invokeSaved(saved); assert.equal(constructions, 2); assert.equal(h.document.activeElement, next);
    h.nativeKey('Enter', next); assert.equal(constructions, 3); assert.equal(h.document.activeElement, h.byId('chapter-map-retry'));
    app.dispose(); h.checkDisposed();
});

for (const interruption of ['blur', 'hidden'] as const)
test(`map recovery focus does not run on ${interruption} or subsequent return`, t => {
    const h = hostBrowser(t); t.mock.method(console, 'error', () => {});
    const app = h.create({ createMap: () => {
        if (interruption === 'blur') h.window.dispatch('blur');
        else { h.document.hidden = true; h.document.dispatch('visibilitychange'); }
        throw Error('Map failed during interruption');
    } });
    assert.equal(app.mode, 'error'); assert.equal(h.document.activeElement, h.body);
    h.document.hidden = false; h.document.dispatch('visibilitychange'); h.window.dispatch('focus');
    assert.equal(h.document.activeElement, h.body);
    app.dispose(); h.checkDisposed();
});

test('chapter recovery focus preserves a control chosen during partial-runtime cleanup', async t => {
    const h = hostBrowser(t), factory = await loadGuairaChapterScene('guaira-travessia');
    t.mock.method(console, 'error', () => {});
    const external = h.document.createElement('button'); h.body.append(external);
    const app = h.create({ loadScene: async () => (canvas, status) => {
        const runtime = factory(canvas, status), dispose = runtime.game.dispose.bind(runtime.game);
        t.mock.method(runtime.game, 'start', () => { throw Error('Start failed after ownership'); });
        t.mock.method(runtime.game, 'dispose', () => { dispose(); external.focus(); });
        return runtime;
    } });
    h.enter(); h.byId('game-canvas').focus(); await flush();
    assert.equal(app.mode, 'error'); assert.equal(app.activeGame, null);
    assert.equal(h.document.activeElement, external, 'Cleanup focus is checked again after the error view is appended');
    app.dispose(); h.checkDisposed();
});
