import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import type { DeliciaSimulation } from '../src/adventure/delicia/DeliciaSimulation';
import { freshSave } from '../src/adventure/progress';
import { DeliciaStore, DELICIA_SAVE_KEY, freshDeliciaSave, parseDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';

/** Native Node EventTarget plus a minimal DOM boundary; real constructor, menus, import and store. */
function fixture(t: TestContext) {
    let pickerFails = false;
    let activeElement: Element | null = null;
    class Element extends EventTarget {
        style: Record<string, string> = {};
        className = ''; dataset: Record<string, string> = {}; hidden = false; disabled = false;
        type = ''; size = 0; style = {}; files: { size: number; text(): Promise<string> }[] = [];
        onchange: (() => Promise<void>) | null = null; oncancel: (() => void) | null = null;
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
        getContext() { return new Proxy({}, { get: () => () => {}, set: () => true }); }
        getAttribute(name: string) { return this.attributes.get(name) ?? null; }
        getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
        all(): Element[] { return this.children.flatMap(child => [child, ...child.all()]); }
        querySelector(selector: string) { return selector.startsWith('#') || selector.startsWith('.') ? null : this.all().find(node => node.tagName === 'button') ?? null; }
        querySelectorAll() { return this.all().filter(node => node.tagName === 'button'); }
        getClientRects() { return [1]; }
        closest(selector: string): Element | null {
            for (let node: Element | null = this; node; node = node.parent)
                if (selector.split(',').some(tag => tag.trim() === node!.tagName)) return node;
            return null;
        }
        focus() {
            if (activeElement === this) return;
            const old = activeElement; activeElement = this;
            old?.dispatchEvent(new Event('blur')); this.dispatchEvent(new Event('focus'));
        }
        click() { if (this.type === 'file') { assert.ok(this.parent, 'Chooser must remain attached'); if (pickerFails) throw Error('Picker unavailable'); } this.dispatchEvent(new Event('click')); }
        setPointerCapture() { if (this.captureFails) throw new DOMException('Capture unavailable'); }
    }
    const body = new Element('body'), window = Object.assign(new EventTarget(), { innerWidth: 960, innerHeight: 540, devicePixelRatio: 1 });
    const document = Object.assign(new EventTarget(), { body, hidden: false, title: '',
        getElementById: () => null, createElement: (tag: string) => new Element(tag), createElementNS: (_namespace: string, tag: string) => new Element(tag) });
    Object.defineProperty(document, 'activeElement', { get: () => activeElement });
    let raw = JSON.stringify(freshDeliciaSave()), storageFails = false; const writes: string[] = [];
    const original = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({ window, document, location: { hash: '' },
        navigator: { maxTouchPoints: 1, getGamepads: () => [] },
        localStorage: { getItem: () => raw, setItem(key: string, value: string) { assert.equal(key, DELICIA_SAVE_KEY); if (storageFails) throw Error('quota'); raw = value; writes.push(value); } },
        requestAnimationFrame: (): number => 1,
        cancelAnimationFrame() {}, fetch: async () => ({ ok: false }) })) {
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
    t.mock.method(DeliciaArt.prototype, 'load', async () => {});
    // Rendering is outside the input boundary; all event/lifecycle paths execute unchanged.
    const prototype = DeliciaApp.prototype as unknown as { renderGame(): void; updateHud(): void; paintMap(): void };
    t.mock.method(prototype, 'renderGame', () => {}); t.mock.method(prototype, 'updateHud', () => {});
    t.mock.method(prototype, 'paintMap', () => {});
    interface App {
        canvas: Element; touch: Element; screen: string; sim: DeliciaSimulation;
        root: Element; panel: Element; status: Element; settingsMessage?: Element; audio: { setVolume(music: number, effects: number): void; pause(paused: boolean): void; music(name: string): void };
        showSettings(back?: () => void): void; showTitle(): void; showMap(): void; goBack(): void; importSave(): void; loadStage(id: string, retry: boolean): boolean; pause(): void; pauseMenu(): void; resume(): void; dispose(): void;
        store: DeliciaStore;
        menu: { choices: {label: string | (() => string); run(): void}[] };
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
    const app = create(); app.pause(); app.showSettings(() => app.pauseMenu());
    return { app, body, window, document, writes, failPicker(value = true) { pickerFails = value; }, get raw() { return raw; }, failStorage() { storageFails = true; },
        open() { app.importSave(); const input = app.root.children.find(node => node.type === 'file'); assert.ok(input); return input; } };
}
function deferredText() {
    let resolve!: (text: string) => void, reject!: (error: Error) => void;
    const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
    return { size: 100, text: () => promise, resolve, reject };
}
function save(completed = ['delicia-1']) {
    return { ...freshDeliciaSave(), completed, music: .2, effects: .3, reducedMotion: true, assists: true,
        times: { 'delicia-1': 48 }, medals: { 'delicia-1': ['clean'] }, checkpoint: { stage: 'delicia-1', index: 0, valves: [] } };
}
function read(input: ReturnType<ReturnType<typeof fixture>['open']>, file: { size: number; text(): Promise<string> }) {
    input.files = [file]; return input.onchange!();
}
test('newer import wins in memory and storage; stale completion cannot yank a playing run to the map', async t => {
    const h = fixture(t), first = h.open(), older = deferredText(), pending = read(first, older);
    const second = h.open(), newer = save(['delicia-1', 'delicia-2', 'delicia-3']);
    await read(second, { size: 100, text: async () => JSON.stringify(newer) });
    assert.deepEqual(h.app.store.save, newer); assert.equal(h.app.screen, 'map');
    h.app.loadStage('delicia-1', true); assert.equal(h.app.screen, 'playing');
    const before = structuredClone(h.app.store.save), raw = h.raw, writes = h.writes.length, sim = h.app.sim;
    older.resolve(JSON.stringify(save())); await pending;
    assert.deepEqual(h.app.store.save, before); assert.equal(h.raw, raw); assert.equal(h.writes.length, writes);
    assert.equal(h.app.screen, 'playing'); assert.equal(h.app.sim, sim);
});

for (const completion of ['success', 'error'] as const)
for (const exit of ['newer chooser', 'cancel', 'back and resume', 'settings reentry', 'title', 'dispose'] as const)
test(`${exit} invalidates pending ${completion} without changing save, screen or feedback`, async t => {
    const h = fixture(t), input = h.open(), file = deferredText(), pending = read(input, file);
    let newest: typeof input | undefined;
    if (exit === 'newer chooser') newest = h.open();
    if (exit === 'cancel') input.oncancel!();
    if (exit === 'back and resume') { h.app.goBack(); h.app.resume(); }
    if (exit === 'settings reentry') h.app.showSettings();
    if (exit === 'title') h.app.showTitle();
    if (exit === 'dispose') h.app.dispose();
    const before = structuredClone(h.app.store.save), raw = h.raw, writes = h.writes.length;
    const screen = h.app.screen, status = h.app.status.textContent, message = h.app.settingsMessage?.textContent, sim = h.app.sim;
    assert.equal(input.parent, null); assert.equal(input.onchange, null); assert.equal(input.oncancel, null);
    if (completion === 'success') file.resolve(JSON.stringify(save())); else file.reject(Error('Late read failure'));
    await pending;
    assert.deepEqual(h.app.store.save, before); assert.equal(h.raw, raw); assert.equal(h.writes.length, writes);
    assert.equal(h.app.screen, screen); assert.equal(h.app.sim, sim);
    assert.equal(h.app.status.textContent, status); assert.equal(h.app.settingsMessage?.textContent, message);
    if (newest) { assert.equal(newest.parent, h.app.root); newest.oncancel!(); }
});

test('chooser blur and temporary hidden page do not cancel the settings-owned read', async t => {
    const h = fixture(t), input = h.open(), file = deferredText(), pending = read(input, file), imported = save();
    h.window.dispatchEvent(new Event('blur')); h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(input.parent, h.app.root); assert.equal(h.app.screen, 'settings');
    h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange'));
    file.resolve(JSON.stringify(imported)); await pending;
    assert.deepEqual(h.app.store.save, imported); assert.deepEqual(parseDeliciaSave(h.raw), imported);
    assert.equal(h.app.screen, 'map'); assert.equal(h.app.status.textContent, 'Progresso importado.');
    assert.equal(input.parent, null); assert.equal(input.onchange, null); assert.equal(input.oncancel, null);
});

for (const kind of ['invalid JSON', 'wrong campaign', 'wrong version', 'read error', 'storage error', 'oversized', 'empty', 'cancel'] as const)
test(`${kind} preserves the current paused run, stored save and settings return`, async t => {
    const h = fixture(t), input = h.open(), before = structuredClone(h.app.store.save), raw = h.raw, writes = h.writes.length, sim = h.app.sim;
    h.app.settingsMessage!.textContent = 'Existing feedback';
    if (kind === 'storage error') h.failStorage();
    if (kind === 'empty') await input.onchange!();
    else if (kind === 'cancel') input.oncancel!();
    else await read(input, { size: kind === 'oversized' ? 1_000_000 : 100, text: async () => {
        assert.notEqual(kind, 'oversized', 'Oversized files must not be read');
        if (kind === 'read error') throw Error('Unreadable');
        return kind === 'invalid JSON' ? '{' : kind === 'wrong campaign' ? JSON.stringify(freshSave()) : kind === 'wrong version' ? JSON.stringify({ version: 99 }) : JSON.stringify(save());
    } });
    assert.deepEqual(h.app.store.save, before); assert.equal(h.raw, raw); assert.equal(h.writes.length, writes);
    assert.equal(h.app.screen, 'settings'); assert.equal(input.parent, null);
    assert.equal(h.app.settingsMessage!.textContent,
        kind === 'empty' || kind === 'cancel' ? 'Existing feedback' :
        kind === 'oversized' ? 'Escolha um arquivo de progresso válido.' :
        kind === 'storage error' ? 'Importação não foi salva. Progresso anterior mantido.' : 'Arquivo inválido. Progresso atual mantido.');
    h.app.goBack(); assert.equal(h.app.screen, 'pause'); h.app.resume(); assert.equal(h.app.screen, 'playing'); assert.equal(h.app.sim, sim);
});

for (const method of ['setVolume', 'pause', 'music'] as const)
test(`post-commit audio ${method} failure still reports imported progress and reaches the map`, async t => {
    const h = fixture(t), input = h.open(), imported = save();
    t.mock.method(h.app.audio, method, () => { throw Error('Audio unavailable'); });
    await read(input, { size: 999_999, text: async () => JSON.stringify(imported) });
    assert.deepEqual(h.app.store.save, imported); assert.deepEqual(parseDeliciaSave(h.raw), imported);
    assert.equal(h.app.screen, 'map'); assert.equal(h.app.status.textContent, 'Progresso importado.');
    assert.equal(input.parent, null);
});

test('picker failure cleans up, preserves progress, and allows another import', async t => {
    const h = fixture(t), before = structuredClone(h.app.store.save), raw = h.raw, writes = h.writes.length;
    h.failPicker(); h.app.importSave();
    assert.equal(h.app.root.children.some(node => node.type === 'file'), false);
    assert.deepEqual(h.app.store.save, before); assert.equal(h.raw, raw); assert.equal(h.writes.length, writes);
    assert.equal(h.app.screen, 'settings'); assert.match(h.app.settingsMessage!.textContent, /Não foi possível abrir/);
    h.failPicker(false); const input = h.open(); await read(input, { size: 100, text: async () => JSON.stringify(save()) });
    assert.equal(h.app.screen, 'map'); assert.equal(h.app.status.textContent, 'Progresso importado.');
});

test('duplicate change callbacks read and commit only once', async t => {
    const h = fixture(t), input = h.open(), file = deferredText(); let reads = 0;
    const handler = input.onchange!, pending = read(input, { size: 100, text: () => { reads++; return file.text(); } });
    await handler(); assert.equal(reads, 1);
    file.resolve(JSON.stringify(save())); await pending;
    const raw = h.raw, writes = h.writes.length; await handler();
    assert.equal(h.raw, raw); assert.equal(h.writes.length, writes); assert.equal(reads, 1);
});

for (const destination of ['title', 'disposed'] as const)
test(`captured Importar button cannot reopen a chooser after ${destination}`, t => {
    const h = fixture(t), button = h.app.menu.choices.find(choice => choice.label === 'IMPORTAR');
    assert.ok(button);
    if (destination === 'title') h.app.showTitle(); else h.app.dispose();
    const raw = h.raw, writes = h.writes.length, screen = h.app.screen;
    button.run();
    assert.equal(h.app.root.children.some(node => node.type === 'file'), false);
    assert.equal(h.raw, raw); assert.equal(h.writes.length, writes); assert.equal(h.app.screen, screen);
});

test('unrelated post-commit navigation errors are not mislabeled as invalid files', async t => {
    const h = fixture(t), input = h.open(), imported = save();
    t.mock.method(h.app, 'showMap', () => { throw Error('Rendering failed'); });
    await assert.rejects(read(input, { size: 100, text: async () => JSON.stringify(imported) }), /Rendering failed/);
    assert.deepEqual(h.app.store.save, imported); assert.deepEqual(parseDeliciaSave(h.raw), imported);
    assert.doesNotMatch(h.app.settingsMessage!.textContent, /inválido|mantido/); assert.equal(input.parent, null);
});
