import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { GuairaChapterApp, type GuairaChapterAppDependencies, type GuairaChapterMapPort } from '../src/adventure/experimental/guaira/chapter/GuairaChapterApp';
import { GuairaChapterMapView, type GuairaChapterMapOptions } from '../src/adventure/experimental/guaira/chapter/GuairaChapterMapView';
import { loadGuairaChapterScene, type GuairaChapterSceneFactory, type GuairaChapterRuntime } from '../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import { type GuairaChapterSnapshot, type GuairaChapterSceneId } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { DisposalScope } from '../src/engine/DisposalScope';
import { sceneLifecycleBrowser, LifecycleElement } from './helpers/sceneLifecycleHarness';

function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };

/** Real host/session/controls/native adapters. Canvas/audio/DOM device boundaries are instrumented.
 * The map port is deliberately injected: this suite tests ownership/dispatch, not painted geography.
 * Injected result samples below exercise receipt policy and are NOT evidence of gameplay victory.
 */
function hostBrowser(t: TestContext) {
    const restore: Array<() => void> = [];
    const h = sceneLifecycleBrowser({ after: (callback: () => void) => restore.push(callback) } as Pick<TestContext, 'after'>);
    const apps: GuairaChapterApp[] = [];
    const all = (at: LifecycleElement = h.body): LifecycleElement[] => [at, ...at.children.flatMap(child => all(child))];
    const decorate = (node: LifecycleElement) => {
        Object.assign(node, { contains: (candidate: LifecycleElement) => all(node).includes(candidate),
            focus: () => { Object.assign(h.document, { activeElement: node }); },
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
    const mapPorts: Array<{ options: GuairaChapterMapOptions; port: GuairaChapterMapPort; button: LifecycleElement; snapshot: GuairaChapterSnapshot; closed: boolean }> = [];
    const createMap: NonNullable<GuairaChapterAppDependencies['createMap']> = (node, options) => {
        const button = h.document.createElement('button'), owner = new DisposalScope();
        button.id = 'map-enter'; (node as unknown as LifecycleElement).append(button);
        const entry = { options, button, snapshot: options.snapshot, closed: false, port: undefined as unknown as GuairaChapterMapPort };
        owner.listen(button, 'click', () => options.onEnter(entry.snapshot.selectedScene, entry.snapshot.generation));
        entry.port = {
            update(snapshot) { entry.snapshot = snapshot; },
            canEnter(scene, generation) { return !entry.closed && scene === entry.snapshot.selectedScene && generation === entry.snapshot.generation; },
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
    game.render(); h.frame();
    assert.match(h.byId('lab-status').textContent, /Abra a comporta e atravesse até o arrozal/);
    assert.doesNotMatch(h.byId('lab-status').textContent, /Guaíra fictícia/);
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
    h.frame(); assert.equal(oldPrimary.getAttribute('aria-label'), 'Retomar a tentativa');
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
        const runtime = [...resultAllowed.keys()].at(-1)!; resultAllowed.set(runtime, true);
        h.byId('chapter-primary').click();
        assert.equal(app.mode, 'map'); assert.equal(game.isDisposed, true); assert.equal(h.frames.size, 0);
        assert.equal(h.contexts.filter(context => context.state !== 'closed').length, 0);
    }
    assert.equal(app.snapshot.chapterComplete, true); assert.equal(app.snapshot.accepted.length, 5);
    const receipts = app.snapshot.accepted; const last = h.currentMap(); last.options.onSelect('guaira-prefeito', last.snapshot.generation);
    h.enter(); await flush(); assert.equal(app.snapshot.accepted.length, 5);
    h.byId('chapter-map-return').click(); assert.deepEqual(app.snapshot.accepted, receipts);
    app.dispose(); h.checkDisposed();
    const alternate = make(), map = h.currentMap(); map.options.onOpening('guaira-patio-comportas', map.snapshot.generation);
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
    const entry = () => new Function('require', 'exports', compiled)(() => ({ GuairaChapterApp: InjectedHost }), {});
    entry(); const first = h.apps.at(-1)!; h.enter(); await flush();
    const native = (first as unknown as { runtime: GuairaChapterRuntime }).runtime;
    native.sample = attempt => ({ attempt, alive: true, state: 'playing', result: { sceneId: 'guaira-travessia', kind: 'reached-finish' } });
    h.byId('chapter-primary').click(); assert.equal(first.snapshot.accepted.length, 1);
    h.enter(); assert.equal(first.mode, 'loading'); const firstSession = first.snapshot.generation.sessionId;
    h.window.dispatch('pagehide', { persisted: true }); assert.equal(first.isDisposed, true);
    h.window.dispatch('pageshow', { persisted: true }); const restored = h.apps.at(-1)!;
    assert.notEqual(restored.snapshot.generation.sessionId, firstSession); assert.equal(restored.snapshot.accepted.length, 0);
    assert.equal(restored.snapshot.activeAttempt, null); assert.equal(restored.mode, 'map');
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
