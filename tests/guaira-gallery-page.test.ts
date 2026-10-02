import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { DisposalScope } from '../src/engine/DisposalScope';
import { GuairaGallery, GUAIRA_GALLERY } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { LabToolbarAction } from '../src/adventure/experimental/JuiceLabToolbar';
import { fitGuairaLabCanvas } from '../src/guaira-lab-layout';
import { installGuairaLabControls } from '../src/guaira-lab-controls';
import { sceneLifecycleBrowser, LifecycleElement } from './helpers/sceneLifecycleHarness';

/** Page ownership proof using the real native Gallery. Gameplay has its own
 * replay gates; the supplied result below is not evidence of victory. */
function page(t: TestContext) {
    const restore: Array<() => void> = [];
    const h = sceneLifecycleBrowser({ after: (fn: () => void) => restore.push(fn) } as Pick<TestContext, 'after'>);
    const all = (node: LifecycleElement = h.body): LifecycleElement[] => [node, ...node.children.flatMap(all)];
    h.document.getElementById = id => all().find(n => n.id === id) ?? null;
    Object.assign(h.document, { querySelector: (selector: string) => selector === 'nav' ? nav : null });
    const nav = h.document.createElement('nav');
    const pause = h.document.createElement('button'), retry = h.document.createElement('button'), map = h.document.createElement('a');
    h.status.id = 'lab-status'; pause.id = 'lab-pause'; retry.id = 'lab-retry'; map.id = 'lab-exit';
    Object.assign(map, { href: './guaira.html?at=town' });
    h.body.replaceChildren(nav, h.canvas); nav.append(h.status, pause, retry, map);
    for (const [name, value] of Object.entries({ innerWidth: 640, innerHeight: 440 })) {
        const old = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
        restore.push(() => { if (old) Object.defineProperty(globalThis, name, old); else Reflect.deleteProperty(globalThis, name); });
    }
    const games: GalleryBoundary[] = [];
    class GalleryBoundary extends GuairaGallery {
        constructor(canvas: HTMLCanvasElement, status: HTMLElement) { super(canvas, status); games.push(this); }
    }
    const imports: Record<string, unknown> = {
        './engine/DisposalScope': { DisposalScope }, './guaira-lab-layout': { fitGuairaLabCanvas },
        './guaira-lab-controls': { installGuairaLabControls },
        './adventure/experimental/JuiceLabToolbar': { LabToolbarAction },
        './adventure/experimental/guaira/gallery/GuairaGallery': { GuairaGallery: GalleryBoundary, GUAIRA_GALLERY }
    };
    const source = readFileSync(new URL('../src/guaira-galeria.ts', import.meta.url), 'utf8');
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    const boot = () => new Function('require', 'exports', compiled)((path: string) => { assert.ok(path in imports, path); return imports[path]; }, {});
    t.after(() => { h.window.dispatch('pagehide'); games.forEach(game => game.dispose()); restore.forEach(fn => fn()); });
    return { ...h, all, pause, retry, map, nav, games, boot };
}

test('gallery page owns one scene, preserves native pause/retry and always exits to Estrada without a result URL', t => {
    const h = page(t); h.boot(); const game = h.games[0];
    assert.ok(game); assert.equal(h.frames.size, 2);
    const listeners = h.listenerCount();
    h.pause.click(); assert.equal(game.state, 'paused'); assert.equal(h.pause.getAttribute('aria-label'), 'Continuar a tentativa');
    h.pause.click(); assert.equal(game.state, 'playing');
    h.key('keydown', 'ArrowRight'); game.input.update(); assert.equal(game.input.getState().right, true);
    game.finished = true; h.retry.click();
    assert.equal(game.finished, false); assert.equal(game.input.getState().right, false);
    h.retry.click(); assert.equal(h.games.length, 1); assert.equal(h.listenerCount(), listeners); assert.equal(h.frames.size, 2);
    game.finished = true; h.map.click();
    assert.equal((h.map as unknown as HTMLAnchorElement).href, './guaira.html?at=town');
    assert.equal(game.store.save.completed.length, 0);
});

test('gallery pagehide retires every scene resource; bfcache and repeated restoration create fresh attempts', t => {
    const h = page(t); h.boot(); const first = h.games[0], oldRetry = h.retry.listeners.find(n => n.type === 'click')!.callback;
    const frames = [...h.frames.values()]; first.finished = true;
    h.window.dispatch('pagehide', { persisted: true });
    assert.equal(first.isDisposed, true); assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 2, 'Only document bootstrap pagehide/pageshow remain');
    assert.equal(h.all().filter(n => n.id === 'guaira-touch-controls').length, 0);
    for (const frame of frames) frame(performance.now() + 1000);
    if (typeof oldRetry === 'function') oldRetry(new Event('click')); else oldRetry.handleEvent(new Event('click'));
    assert.equal(h.frames.size, 0); assert.equal(first.finished, false, 'Disposed attempts discard their result');
    h.window.dispatch('pageshow', { persisted: true }); const second = h.games[1];
    assert.equal(second.finished, false); assert.equal(second.state, 'playing'); assert.equal(h.frames.size, 2);
    h.window.dispatch('pageshow', { persisted: true }); const third = h.games[2];
    assert.equal(second.isDisposed, true); assert.equal(third.finished, false); assert.equal(h.frames.size, 2);
    h.window.dispatch('pagehide'); assert.equal(h.listenerCount(), 2); assert.equal(h.frames.size, 0);
    assert.ok(h.contexts.every(context => context.state === 'closed'));
});

test('gallery toolbar setup failure leaves plain retry/exit and cleans the partial native scene', t => {
    const h = page(t); t.mock.method(console, 'error', () => {});
    const observe = ResizeObserver.prototype.observe; let fail = true;
    t.mock.method(ResizeObserver.prototype, 'observe', function (this: ResizeObserver, target: Element) {
        observe.call(this, target);
        if (fail && (target as unknown) === h.nav) throw Error('Toolbar observation failed');
    });
    h.boot(); assert.equal(h.games[0].isDisposed, true); assert.equal(h.frames.size, 0);
    assert.equal(h.status.getAttribute('role'), 'alert'); assert.equal(h.retry.textContent, 'TENTAR'); assert.equal(h.map.textContent, 'MAPA');
    assert.equal(h.all().filter(n => n.id === 'guaira-touch-controls').length, 0);
    assert.equal(h.listenerCount(), 3, 'Only the retry and document bootstrap callbacks survive');
    fail = false; h.retry.click(); assert.equal(h.games.length, 2); assert.equal(h.games[1].isDisposed, false);
    assert.equal(h.status.getAttribute('role'), 'status'); assert.equal(h.frames.size, 2);
    h.window.dispatch('pagehide'); assert.equal(h.listenerCount(), 2);
});
