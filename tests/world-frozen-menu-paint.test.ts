import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { WorldGame } from '../src/adventure/WorldGame';
import type { FactorySalonSession } from '../src/adventure/factory/FactorySalonSession';
import type { CanvasMenuAccessibility } from '../src/adventure/CanvasMenuAccessibility';
import type { WorldControlsHelp } from '../src/adventure/WorldControlsHelp';
import { FACTORY_SALON } from '../src/adventure/factory/FactorySalon';
import { freshSave } from '../src/adventure/progress';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const STEP = 1000 / 60;
interface Internals {
    pause(): void; resume(): void; settings(from: WorldGame['state']): void; closeSettings(): void;
    change(state: WorldGame['state']): void; invalidateFrozenMenuPaint(): void;
    menuAccessibility: CanvasMenuAccessibility; controlsHelp: WorldControlsHelp;
    toast: string; toastTimer: number; salon?: FactorySalonSession;
}
function loadFactory() {
    const require = createRequire(import.meta.url), css = require.extensions['.css'];
    require.extensions['.css'] = () => {};
    try { return (require('../src/adventure/factory/FactoryCampaign') as typeof import('../src/adventure/factory/FactoryCampaign')).FactoryCampaign; }
    finally { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; }
}

/** Real campaign/renderer/input. Only DOM, devices and offered RAF timestamps are simulated.
 * Canvas traces include method arguments, property writes and backing-surface identities.
 */
function fixture(t: TestContext) {
    const cleanups: Array<() => void> = [], games: WorldGame[] = [];
    const h = sceneLifecycleBrowser({ after: callback => { cleanups.push(callback as () => void); } });
    t.after(() => { games.reverse().forEach(game => game.dispose()); cleanups.reverse().forEach(cleanup => cleanup()); });
    let trace: unknown[][] = [], nextId = 0, canvases = 0, gradientId = 0;
    const canvasSurfaces: LifecycleElement[] = [];
    const ids = new WeakMap<object, number>(), gradients = new WeakMap<object, string>();
    const id = (object: object) => { if (!ids.has(object)) ids.set(object, ++nextId); return ids.get(object)!; };
    const arg = (value: unknown): unknown => value && typeof value === 'object' ? gradients.get(value) ?? `surface:${id(value)}` : value;
    const getContext = LifecycleElement.prototype.getContext;
    t.mock.method(LifecycleElement.prototype, 'getContext', function (this: LifecycleElement) {
        const context = getContext.call(this), surface = id(this);
        return new Proxy(context, {
            get(target, key) {
                const value: unknown = Reflect.get(target, key);
                if (typeof value !== 'function') return value;
                return (...args: unknown[]) => {
                    trace.push([surface, String(key), ...args.map(arg)]);
                    const result = value.apply(target, args);
                    if (String(key).startsWith('create') && String(key).endsWith('Gradient')) {
                        const name = `gradient:${++gradientId}`;
                        const gradient = new Proxy(result as CanvasGradient, { get(object, property) {
                            const fn: unknown = Reflect.get(object, property);
                            return typeof fn !== 'function' ? fn : (...values: unknown[]) => {
                                trace.push([name, String(property), ...values.map(arg)]); return fn.apply(object, values);
                            };
                        } });
                        gradients.set(gradient, name); return gradient;
                    }
                    return result;
                };
            },
            set(target, key, value) { trace.push([surface, `${String(key)}=`, arg(value)]); return Reflect.set(target, key, value); }
        });
    });
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const decorate = (element: LifecycleElement) => {
        Object.defineProperty(element, 'isConnected', { get: () => element === h.body || element.parent !== null });
        element.focus = () => { if (doc.activeElement === element) return; doc.activeElement?.dispatch('blur'); doc.activeElement = element; element.dispatch('focus'); };
        Object.assign(element, { inert: false, open: false,
            showModal() { (element as unknown as HTMLDialogElement).open = true; },
            close() { (element as unknown as HTMLDialogElement).open = false; element.dispatch('close'); } });
        const closest = element.closest.bind(element);
        element.closest = selector => {
            for (let node: LifecycleElement | null = element; node; node = node.parent) {
                if (selector.includes('dialog[open]') && node.tagName === 'DIALOG' && (node as unknown as HTMLDialogElement).open) return node;
                if (selector.split(',').some(part => part.trim().startsWith('.') && node.className.split(' ').includes(part.trim().slice(1)))) return node;
            }
            return closest(selector);
        };
        return element;
    };
    const create = doc.createElement;
    doc.createElement = tag => {
        const element = decorate(create(tag));
        if (tag === 'canvas') { canvases++; canvasSurfaces.push(element); }
        return element;
    };
    decorate(h.canvas); decorate(h.body);
    const writes: string[] = [];
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: (_key: string, value: string) => writes.push(value) } });
    let now = 1000, callbacks = 0;
    t.mock.method(performance, 'now', () => now);
    const make = <T extends WorldGame>(game: T): T => { games.push(game); return game; };
    const game = make(new (loadFactory())(h.canvas as unknown as HTMLCanvasElement)), internal = game as unknown as Internals;
    const present = t.mock.method(game.renderer, 'present'), input = t.mock.method(game.input, 'update'), audio = t.mock.method(game.audio, 'tick');
    const menus = t.mock.method(internal.menuAccessibility, 'sync');
    const capture = (run: () => void) => {
        trace = []; gradientId = 0; const before = h.drawCount(), beforeSurfaces = canvasSurfaces.length; run();
        return { hash: createHash('sha256').update(JSON.stringify(trace)).digest('hex'), commands: trace.length, draws: h.drawCount() - before,
            trace, newCanvases: canvasSurfaces.slice(beforeSurfaces).map(canvas => ({ surface: id(canvas), width: canvas.width, height: canvas.height })) };
    };
    const frame = (dt = STEP) => capture(() => { now += dt; callbacks += h.frames.size; h.frame(now); });
    const render = () => capture(() => game.render());
    const repaint = () => { internal.invalidateFrozenMenuPaint(); return render(); };
    const all = (node: LifecycleElement = h.body): LifecycleElement[] => [node, ...node.children.flatMap(child => all(child))];
    const button = (label: string) => {
        const buttons = all().filter(node => node.tagName === 'BUTTON');
        const found = buttons.find(node => node.textContent === label) ?? buttons.find(node => node.textContent.startsWith(label));
        assert.ok(found, label); return found;
    };
    const hidden = (value: boolean) => { h.document.hidden = value; h.document.dispatch('visibilitychange'); };
    const counts = () => ({ callbacks, presents: present.mock.callCount(), input: input.mock.callCount(), audio: audio.mock.callCount(), menus: menus.mock.callCount(), canvases });
    const pause = () => { game.load('1-1'); game.start(); frame(STEP + .001); internal.pause(); repaint(); return repaint(); };
    return { ...h, game, internal, make, frame, render, repaint, pause, counts, all, button, hidden, doc, writes };
}

test('settled campaign pause keeps exact full-paint output with zero repeated paints or new canvases', t => {
    const h = fixture(t), painted = h.pause(), before = h.counts();
    const player = JSON.stringify(h.game.player.data), save = JSON.stringify(h.game.store.save), time = h.game.time;
    assert.ok(painted.draws > 2000, 'Reference uses the complete real campaign renderer');
    for (let i = 0; i < 120; i++) assert.equal(h.frame().commands, 0);
    const after = h.counts();
    assert.equal(after.callbacks - before.callbacks, 120);
    assert.equal(after.presents, before.presents); assert.equal(after.canvases, before.canvases);
    assert.equal(after.menus - before.menus, 120, 'Native menu layout/focus continues syncing');
    assert.ok(after.input - before.input >= 119); assert.equal(after.audio - before.audio, after.input - before.input);
    assert.equal(h.game.time, time); assert.equal(JSON.stringify(h.game.player.data), player); assert.equal(JSON.stringify(h.game.store.save), save);
    assert.equal(h.repaint().hash, painted.hash, 'A complete repaint issues the exact retained Canvas command sequence');
});

test('toast text changes and final expiry repaint once while frozen effects retain exact commands', t => {
    const h = fixture(t); h.pause(); h.game.camera.shakeTimer = 200;
    const cleared = h.repaint(); h.internal.toast = 'Checkpoint salvo.'; h.internal.toastTimer = 50;
    const shown = h.render(); assert.notEqual(shown.hash, cleared.hash);
    assert.equal(h.frame(20).commands, 0); assert.equal(h.frame(20).commands, 0);
    assert.equal(h.frame(20).hash, cleared.hash, 'The expiry frame removes the toast completely');
    for (let i = 0; i < 6; i++) assert.equal(h.frame().commands, 0);
    h.internal.toastTimer = 200; h.internal.toast = 'Outro aviso.'; const changed = h.render();
    assert.notEqual(changed.hash, shown.hash); assert.equal(h.repaint().hash, changed.hash);
    assert.equal(h.frame().commands, 0); assert.equal(h.game.camera.shakeTimer, 200);
});

test('native focus, keyboard selection and settings changes refresh retained actions without stale controls', t => {
    const h = fixture(t), initial = h.pause();
    h.button('OPÇÕES').focus(); const selected = h.render(); assert.notEqual(selected.hash, initial.hash);
    assert.equal(h.render().commands, 0); const staleContinue = h.button('CONTINUAR');
    h.button('OPÇÕES').click(); h.frame(); assert.equal(h.game.state, 'settings');
    staleContinue.click(); assert.equal(h.game.state, 'settings', 'Removed native pause controls cannot resume');
    const settings = h.repaint(), before = h.counts();
    for (let i = 0; i < 120; i++) assert.equal(h.frame().commands, 0);
    assert.equal(h.counts().presents, before.presents); assert.equal(h.counts().menus - before.menus, 120);
    assert.equal(h.repaint().hash, settings.hash);
    for (const [label, field] of [['MÚSICA:', 'music'], ['EFEITOS:', 'effects'], ['VOZES:', 'voice'], ['TREMOR:', 'shake']] as const) {
        const previous = h.game.store.save.preferences[field]; h.button(label).click(); const changed = h.render();
        assert.notEqual(h.game.store.save.preferences[field], previous); assert.ok(changed.commands > 0);
        assert.equal(h.repaint().hash, changed.hash); assert.equal(h.render().commands, 0);
    }
    h.button('VOLTAR').click(); h.frame(); assert.equal(h.game.state, 'paused');
    h.canvas.focus(); h.key('keydown', 'ArrowDown'); h.key('keyup', 'ArrowDown'); assert.ok(h.render().commands > 0);
    h.button('CONTINUAR').click(); h.frame(); assert.equal(h.game.state, 'playing');
    h.internal.pause(); assert.ok(h.frame().commands > 0); assert.equal(h.frame().commands, 0);
});

test('replacement saves rebuild cached paint and leaving Settings cancels delayed imports', async t => {
    const h = fixture(t); h.pause(); h.internal.settings('paused'); h.repaint();
    const previousPreferences = h.game.store.save.preferences, value = previousPreferences.music;
    assert.equal(h.game.store.import(JSON.stringify(h.game.store.save)), true);
    assert.ok(h.render().commands > 0, 'Save identity changes even when displayed values match');
    h.button('MÚSICA:').click(); h.render(); assert.equal(previousPreferences.music, value);
    assert.notEqual(h.game.store.save.preferences.music, value, 'Retained native control now acts on the imported save');
    const importedPreferences = h.game.store.save.preferences, effects = importedPreferences.effects;
    h.game.store.save.preferences = { ...importedPreferences }; assert.ok(h.render().commands > 0);
    h.button('EFEITOS:').click(); h.render(); assert.equal(importedPreferences.effects, effects);
    assert.notEqual(h.game.store.save.preferences.effects, effects);
    const audioPreferences = h.game.audio.preferences;
    h.button('IMPORTAR').click();
    const chooser = h.all().find(node => node.id === 'world-save-import') as unknown as { files: Array<{ text(): Promise<string> }>; onchange(): Promise<void> };
    assert.ok(chooser); let resolve!: (text: string) => void;
    chooser.files = [{ text: () => new Promise<string>(yes => { resolve = yes; }) }]; const pending = chooser.onchange();
    h.button('VOLTAR').click(); h.frame(); assert.equal(h.game.state, 'paused'); const player = JSON.stringify(h.game.player.data);
    const seal = h.game.stage.pickups.find(item => item.id === '1-1:s1')!;
    assert.ok(!h.game.store.save.seals.includes(seal.id));
    h.game.camera.x = seal.x - 40; h.game.camera.y = seal.y - 88;
    h.repaint(); // Show the unearned seal in-viewport before importing its new palette.
    const next = freshSave(); next.preferences.shake = false; next.seals = [seal.id]; resolve(JSON.stringify(next)); await pending;
    assert.equal(h.game.store.save.seals.includes(seal.id), false, 'A cancelled chooser cannot replace the paused run');
    assert.equal(h.frame().commands, 0, 'A cancelled read cannot invalidate unchanged pause paint');
    // Independently exercise external store replacement and the earned-seal cache.
    assert.equal(h.game.store.import(JSON.stringify(next)), true);
    const changed = h.frame(); assert.ok(changed.commands > 0, 'The first post-import frame must repaint');
    const forced = h.repaint();
    // Import first introduces the earned-seal palette. Its cached bitmap is built
    // synchronously before drawing; a later repaint reuses that same bitmap.
    // Keep all other tests' raw trace hashes, and validate this cold-cache work
    // before comparing every main/offscreen composition command without it.
    assert.equal(changed.newCanvases.length, 1);
    const earned = changed.newCanvases[0];
    assert.deepEqual([earned.width, earned.height], [16, 18]);
    assert.deepEqual(forced.newCanvases, [], 'Forced repaint must reuse the earned-seal surface');
    const raster = changed.trace.filter(command => command[0] === earned.surface);
    assert.ok(raster.length > 0); assert.equal(raster.length % 2, 0);
    for (let i = 0; i < raster.length; i += 2) {
        const style = raster[i], pixel = raster[i + 1];
        assert.deepEqual(style.slice(0, 2), [earned.surface, 'fillStyle=']);
        assert.equal(style.length, 3); assert.equal(typeof style[2], 'string');
        assert.equal(pixel.length, 6);
        assert.deepEqual([pixel[0], pixel[1], pixel[4], pixel[5]], [earned.surface, 'fillRect', 1, 1]);
        const x = pixel[2], y = pixel[3];
        assert.ok(typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < earned.width);
        assert.ok(typeof y === 'number' && Number.isInteger(y) && y >= 0 && y < earned.height);
    }
    const firstDraw = changed.trace.findIndex(command => command[1] === 'drawImage' && command[2] === `surface:${earned.surface}`);
    assert.ok(firstDraw >= 0, 'The first import repaint actually uses the newly rasterized seal');
    assert.deepEqual(changed.trace[firstDraw].slice(3), [40, 88, 16, 18], 'The earned seal is visible outside the opaque pause panel');
    assert.ok(changed.trace.every((command, index) => command[0] !== earned.surface || index < firstDraw),
        'The complete bitmap exists before its first draw and stays unchanged');
    assert.ok(forced.trace.every(command => command[0] !== earned.surface), 'The forced repaint never changes the cached pixels');
    assert.deepEqual(changed.trace.filter(command => command[0] !== earned.surface), forced.trace,
        'First import and forced repaint issue identical composition commands with the same complete bitmap');
    assert.equal(h.frame().commands, 0); assert.equal(JSON.stringify(h.game.player.data), player);
    assert.equal(h.internal.toast, '', 'A cancelled import cannot report success'); assert.equal(h.game.audio.preferences, audioPreferences, 'A cancelled read cannot replace audio preferences');
});

test('same-size resize, context restoration, motion and visibility invalidate without changing pause ownership', t => {
    const h = fixture(t); h.pause();
    const refresh = (change: () => void) => {
        const before = h.counts().presents; change(); const paint = h.frame();
        assert.equal(h.counts().presents, before + 1); assert.ok(paint.commands > 0);
        assert.equal(h.repaint().hash, paint.hash); assert.equal(h.frame().commands, 0); return paint;
    };
    refresh(() => h.window.dispatch('resize'));
    refresh(() => { h.window.innerWidth = 960; h.window.dispatch('resize'); });
    refresh(() => h.canvas.dispatch('contextrestored'));
    h.game.player.data.invincibleTimer = 150;
    h.media.matches = true; h.repaint(); h.media.matches = false; h.repaint();
    refresh(() => { h.media.matches = true; h.media.dispatch('change'); });
    const time = h.game.time; h.hidden(true); assert.equal(h.frames.size, 0); h.frame(90_000);
    refresh(() => h.hidden(false)); assert.equal(h.game.state, 'paused'); assert.equal(h.game.time, time); assert.equal(h.frames.size, 1);
});

test('help keeps its native modal and zero paints; close repaints once after changes behind it', t => {
    const h = fixture(t); h.pause(); h.internal.settings('paused'); h.frame();
    const opener = h.button('CONTROLES'); opener.focus(); opener.click(); const before = h.counts().presents;
    assert.equal(h.internal.controlsHelp.isOpen, true);
    for (let i = 0; i < 12; i++) assert.equal(h.frame().commands, 0);
    assert.equal(h.counts().presents, before); h.window.dispatch('resize'); assert.equal(h.frame().commands, 0);
    h.internal.controlsHelp.close(); assert.equal(h.doc.activeElement, opener);
    assert.ok(h.frame().commands > 0); assert.equal(h.counts().presents, before + 1); assert.equal(h.frame().commands, 0);
    opener.click(); h.hidden(true); h.hidden(false); h.frame(); h.internal.controlsHelp.close();
    assert.equal(h.doc.activeElement, h.canvas, 'A removed opener cannot acquire focus');
    assert.ok(h.frame().commands > 0); assert.equal(h.frame().commands, 0); assert.equal(h.game.state, 'settings');
});

test('live salon updates and paints remain dynamic even though its owning campaign is paused', t => {
    const h = fixture(t); h.pause(); h.internal.resume(); h.game.load(FACTORY_SALON.stage);
    h.game.player.data.position = { x: FACTORY_SALON.door.x, y: FACTORY_SALON.support.y - h.game.player.data.height };
    h.game.player.data.isGrounded = true; h.game.enterSalon(); const salon = h.internal.salon!;
    assert.ok(salon); salon.skipIntro(); assert.equal(h.game.state, 'paused'); assert.equal(salon.state, 'playing');
    const present = t.mock.method(salon.renderer, 'present'), reflect = t.mock.method(salon, 'reflectCampaignStatus');
    h.frame(); const time = salon.time, paints = present.mock.callCount(), reflections = reflect.mock.callCount();
    const hashes = new Set<string>(); for (let i = 0; i < 30; i++) { const frame = h.frame(); assert.ok(frame.draws > 0); hashes.add(frame.hash); }
    assert.ok(hashes.size > 1); assert.ok(salon.time > time); assert.ok(present.mock.callCount() - paints >= 30);
    assert.ok(reflect.mock.callCount() - reflections >= 30); assert.equal(h.frames.size, 1);
    h.game.leaveSalon(); assert.equal(salon.isDisposed, true); assert.equal(h.doc.activeElement, h.canvas);
    h.internal.pause(); assert.ok(h.frame().commands > 0); assert.equal(h.frame().commands, 0);
    const elapsed = h.game.elapsed; h.button('CONTINUAR').click(); h.frame(20); assert.ok(h.game.elapsed > elapsed);
});

test('base/editor opt out, animated campaign screens keep painting, and disposal cannot retain stale menus', t => {
    const h = fixture(t); h.pause(); h.game.dispose(); assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0);
    for (const ephemeral of [false, true]) {
        const game = h.make(new WorldGame(h.canvas as unknown as HTMLCanvasElement, ephemeral));
        game.load('1-1'); (game as unknown as Internals).pause(); game.start();
        const paints = t.mock.method(game.renderer, 'present');
        for (let i = 0; i < 4; i++) assert.ok(h.frame().commands > 0);
        assert.equal(paints.mock.callCount(), 4); game.dispose();
    }
    class CustomCampaign extends (loadFactory()) {}
    const custom = h.make(new CustomCampaign(h.canvas as unknown as HTMLCanvasElement));
    custom.load('1-1'); (custom as unknown as Internals).pause(); custom.start();
    for (let i = 0; i < 4; i++) assert.ok(h.frame().commands > 0, 'An additional host subclass must explicitly own its paint contract');
    custom.dispose();
    const game = h.make(new (loadFactory())(h.canvas as unknown as HTMLCanvasElement)), internal = game as unknown as Internals;
    game.start();
    for (const state of ['title', 'playing', 'dialogue', 'clear', 'intro', 'ending', 'gallery'] as const) {
        if (state === 'playing') game.load('1-1'); else internal.change(state);
        for (let i = 0; i < 3; i++) assert.ok(h.frame().commands > 0, state);
    }
    internal.pause(); h.frame(); const old = h.button('CONTINUAR'), stale = [...h.frames.values()][0];
    game.dispose(); const before = h.drawCount(); old.click(); stale(performance.now() + 100);
    h.window.dispatch('resize'); h.canvas.dispatch('contextrestored'); h.hidden(true); h.hidden(false);
    assert.equal(h.drawCount(), before); assert.equal(h.frames.size, 0); assert.equal(h.listenerCount(), 0);
});
