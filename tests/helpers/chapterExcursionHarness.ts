import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { setMaxListeners } from 'node:events';
import { GuairaChapterApp, type GuairaChapterAppDependencies } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterApp';
import type { WorldGame } from '../../src/adventure/WorldGame';
import { LifecycleElement, sceneLifecycleBrowser } from './sceneLifecycleHarness';

const metadata = JSON.parse(readFileSync(new URL('../../public/assets/world/experimental/guaira/guaira-diorama.meta.json', import.meta.url), 'utf8'));
export const flushChapter = async () => { for (let n = 0; n < 40; n++) await Promise.resolve(); };
export interface ExcursionRecording {
    stepMs?: number;
    initialSettleFrames?: number;
    runs: Array<[number, string[]]>;
}
export function chapterRecording(name: string): ExcursionRecording {
    return JSON.parse(readFileSync(new URL(`./${name}.json`, import.meta.url), 'utf8'));
}

/** Actual host, map/travel and native games. Only DOM, canvas, audio and asset
 * transport boundaries are replaced. No receipt, tile or actor state is set. */
export function chapterExcursionBrowser(t: TestContext) {
    const restoreBase: Array<() => void> = [], restoreOverrides: Array<() => void> = [];
    const h = sceneLifecycleBrowser({ after: (fn: () => void) => restoreBase.push(fn) } as Pick<TestContext, 'after'>);
    const apps: GuairaChapterApp[] = [];
    const all = (node: LifecycleElement = h.body): LifecycleElement[] => [node, ...node.children.flatMap(all)];
    const createElement = h.document.createElement;
    h.document.createElement = tag => {
        const node = createElement(tag);
        Object.assign(node, {
            contains: (candidate: LifecycleElement) => all(node).includes(candidate),
            focus: () => Object.assign(h.document, { activeElement: node }),
            open: false,
            showModal() { Object.assign(node, { open: true }); },
            close() { Object.assign(node, { open: false }); },
            click() {
                if (node.disabled || node.hidden) return;
                node.dispatch('click', { detail: 0 });
                (node as LifecycleElement & { onclick?: () => void }).onclick?.();
            }
        });
        return node;
    };
    const root = h.document.createElement('main'); root.id = 'guaira-chapter-root'; h.body.replaceChildren(root);
    h.document.getElementById = id => all().find(node => node.id === id) ?? null;
    Object.assign(h.document, { querySelector: (selector: string) => selector === 'nav' ? all().find(node => node.tagName === 'NAV') ?? null : null });
    const classes = new Set<string>();
    Object.defineProperty(h.body, 'classList', { configurable: true, value: {
        contains: (name: string) => classes.has(name),
        toggle: (name: string, force?: boolean) => {
            const add = force ?? !classes.has(name); if (add) classes.add(name); else classes.delete(name); return add;
        },
        remove: (...names: string[]) => names.forEach(name => classes.delete(name))
    } });
    const replaceGlobal = (name: string, value: unknown) => {
        const before = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
        restoreOverrides.push(() => { if (before) Object.defineProperty(globalThis, name, before); else Reflect.deleteProperty(globalThis, name); });
    };
    const originalFetch = fetch, RealAbortController = AbortController;
    class MapImage {
        src = ''; onload: (() => void) | null = null; onerror: (() => void) | null = null;
        naturalWidth = 1920; naturalHeight = 1200;
        decode() { return this.src.endsWith('guaira-diorama.webp') ? Promise.resolve() : Promise.reject(Error('Optional decoration omitted in ownership test')); }
    }
    replaceGlobal('Image', MapImage);
    replaceGlobal('fetch', (url: string, options?: RequestInit) => String(url).endsWith('guaira-diorama.meta.json')
        ? Promise.resolve({ ok: true, json: async () => metadata }) : originalFetch(url, options));
    replaceGlobal('AbortController', class extends RealAbortController { constructor() { super(); setMaxListeners(0, this.signal); } });
    replaceGlobal('innerWidth', 640); replaceGlobal('innerHeight', 440);
    for (const name of ['history', 'sessionStorage']) {
        const before = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, get() { assert.fail(`An internal excursion must not access ${name}`); } });
        restoreOverrides.push(() => { if (before) Object.defineProperty(globalThis, name, before); else Reflect.deleteProperty(globalThis, name); });
    }
    const create = (dependencies: GuairaChapterAppDependencies = {}) => {
        const app = new GuairaChapterApp(root as unknown as HTMLElement, dependencies); apps.push(app); return app;
    };
    const button = (name: string | RegExp) => {
        const found = all().find(node => node.tagName === 'BUTTON' && (typeof name === 'string'
            ? node.getAttribute('aria-label') === name : name.test(node.getAttribute('aria-label') ?? '')));
        assert.ok(found, `Missing button ${String(name)}`); return found;
    };
    const byId = (id: string) => { const node = h.document.getElementById(id); assert.ok(node, id); return node; };
    let clock = performance.now();
    const frames = (count = 1) => { for (let n = 0; n < count; n++) h.frame(clock += 1000 / 60); };
    function play(game: WorldGame, recording: ExcursionRecording, touch = false) {
        const canvas = byId('game-canvas'); let held = new Set<string>(), count = 0;
        const controls = (keys: string[]) => {
            const next = new Set(keys);
            if (touch) {
                // The owned host installs external touch buttons and suspends
                // canvas regions, so drive those real PointerEvent handlers.
                const actions: Record<string, string> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ShiftLeft: 'run', Space: 'jump' };
                const pointerId = (key: string) => Object.keys(actions).indexOf(key) + 1;
                for (const key of held) if (!next.has(key)) h.window.dispatch('pointerup', { pointerId: pointerId(key), pointerType: 'touch' });
                for (const key of next) if (!held.has(key)) {
                    const control = all().find(node => node.getAttribute('data-action') === actions[key]);
                    assert.ok(control, `Owned touch button for ${key}`);
                    control.dispatch('pointerdown', { pointerId: pointerId(key), pointerType: 'touch', button: 0 });
                }
            } else {
                for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: canvas });
                for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: canvas });
            }
            held = next;
        };
        for (const [n, keys] of [[recording.initialSettleFrames ?? 0, []], ...recording.runs] as Array<[number, string[]]>) {
            controls(keys);
            for (let frame = 0; frame < n; frame++) {
                game.update(recording.stepMs ?? 1000 / 60); count++;
                assert.equal(game.player.data.isDead, false, `${game.stage.id} alive at ${count}`);
                assert.equal(game.player.data.hasHelmet, true, `${game.stage.id} helmet at ${count}`);
            }
        }
        controls([]); return count;
    }
    const checkDisposed = () => {
        assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0);
        assert.ok(h.contexts.every(context => context.state === 'closed'));
        assert.ok(h.observers.every(observer => observer.disconnected));
        assert.equal(all().filter(node => node.id === 'guaira-touch-controls').length, 0);
        assert.equal(h.window.worldGame, undefined); assert.equal(h.window.renderer, undefined);
    };
    t.after(() => { apps.forEach(app => app.dispose()); checkDisposed(); restoreOverrides.reverse().forEach(restore => restore()); restoreBase.forEach(restore => restore()); });
    return { ...h, root, all, create, button, byId, frames, play, checkDisposed };
}
