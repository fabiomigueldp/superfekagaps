import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { DisposalScope } from '../../src/engine/DisposalScope';
import type { WorldGame } from '../../src/adventure/WorldGame';
import { INSPECTION_ROOMS, loadGuairaInspectionRoom, type GuairaInspectionRoomSceneId, type GuairaInspectionRoomFactory } from '../../src/adventure/experimental/guaira/GuairaInspectionRooms';
import { LabToolbarAction } from '../../src/adventure/experimental/JuiceLabToolbar';
import { fitGuairaLabCanvas } from '../../src/guaira-lab-layout';
import { installGuairaLabControls } from '../../src/guaira-lab-controls';
import { sceneLifecycleBrowser, LifecycleElement } from './sceneLifecycleHarness';

export const flushGalleryPage = async () => { for (let n = 0; n < 40; n++) await Promise.resolve(); };
export const savedClick = (node: LifecycleElement) => node.listeners.find(item => item.type === 'click')!.callback;
export const invokeSaved = (callback: EventListenerOrEventListenerObject) => {
    if (typeof callback === 'function') callback(new Event('click')); else callback.handleEvent(new Event('click'));
};
export function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(yes => { resolve = yes; });
    return { promise, resolve };
}

/** Actual page bootstrap, native scenes and installed DOM touch handlers. Only
 * browser/device boundaries and the lazy-import transport are replaced. */
export async function galleryPageBrowser(t: TestContext) {
    const factories = { gallery: await loadGuairaInspectionRoom(), relief: await loadGuairaInspectionRoom('relief') };
    const restore: Array<() => void> = [];
    const h = sceneLifecycleBrowser({ after: (fn: () => void) => restore.push(fn) } as Pick<TestContext, 'after'>);
    const all = (node: LifecycleElement = h.body): LifecycleElement[] => [node, ...node.children.flatMap(all)];
    h.document.getElementById = id => all().find(n => n.id === id) ?? null;
    Object.assign(h.document, { querySelector: (selector: string) => selector === 'nav' ? nav : null });
    const nav = h.document.createElement('nav');
    const primary = h.document.createElement('button'), retry = h.document.createElement('button'), map = h.document.createElement('a');
    h.status.id = 'lab-status'; primary.id = 'lab-pause'; retry.id = 'lab-retry'; map.id = 'lab-exit';
    const html = readFileSync(new URL('../../guaira-galeria.html', import.meta.url), 'utf8');
    const fallbackHref = html.match(/id="lab-exit" href="([^"]+)"/)?.[1];
    assert.ok(fallbackHref, 'The static exit remains available before JavaScript loads');
    Object.assign(map, { href: fallbackHref });
    h.body.replaceChildren(nav, h.canvas); nav.append(h.status, primary, retry, map);
    for (const [name, value] of Object.entries({ innerWidth: 640, innerHeight: 440 })) {
        const old = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
        restore.push(() => { if (old) Object.defineProperty(globalThis, name, old); else Reflect.deleteProperty(globalThis, name); });
    }
    for (const name of ['history', 'sessionStorage']) {
        const old = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, get() { assert.fail(`A free visit must not access ${name}`); } });
        restore.push(() => { if (old) Object.defineProperty(globalThis, name, old); else Reflect.deleteProperty(globalThis, name); });
    }
    const games: WorldGame[] = [], loads: GuairaInspectionRoomSceneId[] = [];
    let loader = async (id: GuairaInspectionRoomSceneId): Promise<GuairaInspectionRoomFactory> => factories[id];
    const imports: Record<string, unknown> = {
        './engine/DisposalScope': { DisposalScope }, './guaira-lab-layout': { fitGuairaLabCanvas },
        './guaira-lab-controls': { installGuairaLabControls }, './adventure/experimental/JuiceLabToolbar': { LabToolbarAction },
        './adventure/experimental/guaira/GuairaInspectionRooms': { INSPECTION_ROOMS,
            loadGuairaInspectionRoom: async (id: GuairaInspectionRoomSceneId) => {
                loads.push(id); const factory = await loader(id);
                return (canvas: HTMLCanvasElement, status: HTMLElement) => { const runtime = factory(canvas, status); games.push(runtime.game); return runtime; };
            } }
    };
    const source = readFileSync(new URL('../../src/guaira-galeria.ts', import.meta.url), 'utf8');
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    const boot = async (load?: typeof loader) => {
        if (load) loader = load;
        new Function('require', 'exports', compiled)((path: string) => { assert.ok(path in imports, path); return imports[path]; }, {});
        await flushGalleryPage();
    };
    const checkDisposed = () => {
        assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 2, 'Only document bootstrap pagehide/pageshow remain');
        assert.ok(h.contexts.every(context => context.state === 'closed'));
        assert.ok(h.observers.every(observer => observer.disconnected));
        assert.equal(all().filter(node => node.id === 'guaira-touch-controls').length, 0);
        assert.equal(h.window.worldGame, undefined);
    };
    let clock = performance.now();
    const reflect = () => h.frame(clock += 1000 / 60);
    function nativeKey(key: string, target = primary, repeat = false) {
        const event = h.window.dispatch('keydown', { code: key === ' ' ? 'Space' : key, key, target, repeat });
        if (!event.defaultPrevented && !target.disabled) target.click();
        return event;
    }
    function play(game: WorldGame, recording: { runs: Array<[number, string[]]> }, touch = false) {
        let held = new Set<string>(), frames = 0;
        const controls = (keys: string[]) => {
            const next = new Set(keys);
            if (touch) {
                const actions: Record<string, string> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ShiftLeft: 'run', Space: 'jump' };
                const pointerId = (key: string) => Object.keys(actions).indexOf(key) + 1;
                for (const key of held) if (!next.has(key)) h.window.dispatch('pointerup', { pointerId: pointerId(key), pointerType: 'touch' });
                for (const key of next) if (!held.has(key)) {
                    const control = all().find(node => node.getAttribute('data-action') === actions[key]);
                    assert.ok(control, `Owned touch button for ${key}`);
                    control.dispatch('pointerdown', { pointerId: pointerId(key), pointerType: 'touch', button: 0 });
                }
            } else {
                for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
                for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            }
            held = next;
        };
        for (const [count, keys] of recording.runs) {
            controls(keys);
            for (let n = 0; n < count; n++) {
                game.update(1000 / 60); frames++;
                assert.equal(game.player.data.isDead, false, `${game.stage.id} alive at ${frames}`);
                assert.equal(game.player.data.hasHelmet, true, `${game.stage.id} helmet at ${frames}`);
            }
        }
        controls([]); return frames;
    }
    t.after(() => { h.window.dispatch('pagehide'); games.forEach(game => game.dispose()); checkDisposed(); restore.forEach(fn => fn()); });
    return { ...h, all, primary, retry, map, nav, games, loads, factories, boot, reflect, play, nativeKey, checkDisposed,
        activeGame: () => h.window.worldGame, mapHref: () => (map as unknown as HTMLAnchorElement).href };
}
