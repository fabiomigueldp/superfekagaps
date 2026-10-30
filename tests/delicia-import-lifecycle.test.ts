import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { DeliciaSimulation } from '../src/adventure/delicia/DeliciaSimulation';
import { freshSave } from '../src/adventure/progress';
import { DeliciaStore, DELICIA_SAVE_KEY, freshDeliciaSave, parseDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';
import { Event, type HTMLElement as Element, type HTMLInputElement } from 'happy-dom';
import { createDeliciaDom, setInputFile, changeInputFile } from './helpers/deliciaDomHarness';
import { loadDeliciaApp } from './helpers/deliciaAppLoader';

/** Shared DOM and controlled picker/storage boundaries; real constructor, menus, import and store. */
function fixture(t: TestContext) {
    const dom = createDeliciaDom(), { window, document, body } = dom;
    const cleanups: (() => void)[] = [];
    t.after(async () => { try { cleanups.forEach(cleanup => cleanup()); } finally { await dom.dispose(); } });
    let raw = JSON.stringify(freshDeliciaSave()), storageFails = false; const writes: string[] = [];
    dom.install({
        navigator: { maxTouchPoints: 1, getGamepads: () => [] },
        localStorage: { getItem: () => raw, setItem(key: string, value: string) { assert.equal(key, DELICIA_SAVE_KEY); if (storageFails) throw Error('quota'); raw = value; writes.push(value); } },
        requestAnimationFrame: (): number => 1,
        cancelAnimationFrame() {}, fetch: async () => ({ ok: false }) });
    const loaded = loadDeliciaApp(), { DeliciaApp, require } = loaded;
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
    cleanups.push(() => apps.forEach(app => app.dispose()), loaded.dispose);
    const app = create(); app.pause(); app.showSettings(() => app.pauseMenu());
    return { app, body, window, document, writes, failPicker: dom.failPicker, get raw() { return raw; }, failStorage() { storageFails = true; },
        open() { app.importSave(); const input = app.root.querySelector<HTMLInputElement>('input[type="file"]'); assert.ok(input); return input; } };
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
    setInputFile(input, file); return changeInputFile(input);
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
    if (exit === 'cancel') input.dispatchEvent(new Event('cancel'));
    if (exit === 'back and resume') { h.app.goBack(); h.app.resume(); }
    if (exit === 'settings reentry') h.app.showSettings();
    if (exit === 'title') h.app.showTitle();
    if (exit === 'dispose') h.app.dispose();
    const before = structuredClone(h.app.store.save), raw = h.raw, writes = h.writes.length;
    const screen = h.app.screen, status = h.app.status.textContent, message = h.app.settingsMessage?.textContent, sim = h.app.sim;
    assert.equal(input.parentElement, null); assert.equal(input.onchange, null); assert.equal(input.oncancel, null);
    if (completion === 'success') file.resolve(JSON.stringify(save())); else file.reject(Error('Late read failure'));
    await pending;
    assert.deepEqual(h.app.store.save, before); assert.equal(h.raw, raw); assert.equal(h.writes.length, writes);
    assert.equal(h.app.screen, screen); assert.equal(h.app.sim, sim);
    assert.equal(h.app.status.textContent, status); assert.equal(h.app.settingsMessage?.textContent, message);
    if (newest) { assert.equal(newest.parentElement, h.app.root); newest.dispatchEvent(new Event('cancel')); }
});

test('chooser blur and temporary hidden page do not cancel the settings-owned read', async t => {
    const h = fixture(t), input = h.open(), file = deferredText(), pending = read(input, file), imported = save();
    h.window.dispatchEvent(new Event('blur')); h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(input.parentElement, h.app.root); assert.equal(h.app.screen, 'settings');
    h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange'));
    file.resolve(JSON.stringify(imported)); await pending;
    assert.deepEqual(h.app.store.save, imported); assert.deepEqual(parseDeliciaSave(h.raw), imported);
    assert.equal(h.app.screen, 'map'); assert.equal(h.app.status.textContent, 'Progresso importado.');
    assert.equal(input.parentElement, null); assert.equal(input.onchange, null); assert.equal(input.oncancel, null);
});

for (const kind of ['invalid JSON', 'wrong campaign', 'wrong version', 'read error', 'storage error', 'oversized', 'empty', 'cancel'] as const)
test(`${kind} preserves the current paused run, stored save and settings return`, async t => {
    const h = fixture(t), input = h.open(), before = structuredClone(h.app.store.save), raw = h.raw, writes = h.writes.length, sim = h.app.sim;
    h.app.settingsMessage!.textContent = 'Existing feedback';
    if (kind === 'storage error') h.failStorage();
    if (kind === 'empty') await changeInputFile(input);
    else if (kind === 'cancel') input.dispatchEvent(new Event('cancel'));
    else await read(input, { size: kind === 'oversized' ? 1_000_000 : 100, text: async () => {
        assert.notEqual(kind, 'oversized', 'Oversized files must not be read');
        if (kind === 'read error') throw Error('Unreadable');
        return kind === 'invalid JSON' ? '{' : kind === 'wrong campaign' ? JSON.stringify(freshSave()) : kind === 'wrong version' ? JSON.stringify({ version: 99 }) : JSON.stringify(save());
    } });
    assert.deepEqual(h.app.store.save, before); assert.equal(h.raw, raw); assert.equal(h.writes.length, writes);
    assert.equal(h.app.screen, 'settings'); assert.equal(input.parentElement, null);
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
    assert.equal(input.parentElement, null);
});

test('picker failure cleans up, preserves progress, and allows another import', async t => {
    const h = fixture(t), before = structuredClone(h.app.store.save), raw = h.raw, writes = h.writes.length;
    h.failPicker(); h.app.importSave();
    assert.equal(h.app.root.querySelector('input[type="file"]') !== null, false);
    assert.deepEqual(h.app.store.save, before); assert.equal(h.raw, raw); assert.equal(h.writes.length, writes);
    assert.equal(h.app.screen, 'settings'); assert.match(h.app.settingsMessage!.textContent, /Não foi possível abrir/);
    h.failPicker(false); const input = h.open(); await read(input, { size: 100, text: async () => JSON.stringify(save()) });
    assert.equal(h.app.screen, 'map'); assert.equal(h.app.status.textContent, 'Progresso importado.');
});

test('duplicate change callbacks read and commit only once', async t => {
    const h = fixture(t), input = h.open(), file = deferredText(); let reads = 0;
    const handler = input.onchange!, pending = read(input, { size: 100, text: () => { reads++; return file.text(); } });
    await changeInputFile(input, handler); assert.equal(reads, 1);
    file.resolve(JSON.stringify(save())); await pending;
    const raw = h.raw, writes = h.writes.length; await changeInputFile(input, handler);
    assert.equal(h.raw, raw); assert.equal(h.writes.length, writes); assert.equal(reads, 1);
});

for (const destination of ['title', 'disposed'] as const)
test(`captured Importar button cannot reopen a chooser after ${destination}`, t => {
    const h = fixture(t), button = h.app.menu.choices.find(choice => choice.label === 'IMPORTAR');
    assert.ok(button);
    if (destination === 'title') h.app.showTitle(); else h.app.dispose();
    const raw = h.raw, writes = h.writes.length, screen = h.app.screen;
    button.run();
    assert.equal(h.app.root.querySelector('input[type="file"]') !== null, false);
    assert.equal(h.raw, raw); assert.equal(h.writes.length, writes); assert.equal(h.app.screen, screen);
});

test('unrelated post-commit navigation errors are not mislabeled as invalid files', async t => {
    const h = fixture(t), input = h.open(), imported = save();
    t.mock.method(h.app, 'showMap', () => { throw Error('Rendering failed'); });
    await assert.rejects(read(input, { size: 100, text: async () => JSON.stringify(imported) }), /Rendering failed/);
    assert.deepEqual(h.app.store.save, imported); assert.deepEqual(parseDeliciaSave(h.raw), imported);
    assert.doesNotMatch(h.app.settingsMessage!.textContent, /inválido|mantido/); assert.equal(input.parentElement, null);
});
