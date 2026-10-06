import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { textWidth } from '../src/graphics/BitmapFont';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DELICIA_SAVE_KEY, DeliciaStore, freshDeliciaSave, parseDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';
import { DeliciaSimulation, noDeliciaInput, type DeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

/** Only the DOM/audio boundary is fake; app event handling and persistence are real. */
class Element extends EventTarget {
    className = ''; dataset = {}; hidden = false; disabled = false; private text = '';
    children: Element[] = []; parent: Element | null = null; attributes = new Map<string, string>();
    constructor(readonly tagName: string) { super(); }
    get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
    set textContent(value: string) { this.text = value; this.replaceChildren(); }
    get classList() { return { add: (name: string) => { this.className += ' ' + name; } }; }
    append(...children: Element[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children: Element[]) { this.children.forEach(child => child.parent = null); this.children = []; this.append(...children); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    getContext() { return null; }
    querySelector() { return this.all().find(node => node.tagName === 'button') ?? null; }
    focus() {}
    click() { this.dispatchEvent(new Event('click')); }
    all(): Element[] { return this.children.flatMap(child => [child, ...child.all()]); }
}
interface App {
    store: DeliciaStore; sim: DeliciaSimulation; toast: string; toastTime: number; screen: string;
    panel: Element; status: Element; settingsMessage?: Element;
    step(dt: number, input: DeliciaInput): void; loadStage(id: string, retry?: boolean): boolean;
    clearStage(): void; pause(): void; showEnding(): void; showSettings(): void;
    dialogueDone(): void;
}
function fixture(t: TestContext, mode: 'QuotaExceededError' | 'SecurityError' | 'read' | 'ok' = 'ok') {
    const require = createRequire(import.meta.url), css = require.extensions['.css'];
    require.extensions['.css'] = () => {};
    t.after(() => { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; });
    const { DeliciaApp } = require('../src/adventure/delicia/DeliciaApp.ts') as typeof import('../src/adventure/delicia/DeliciaApp');
    const original = JSON.stringify(freshDeliciaSave()); let raw = original, failure = mode, writes = 0;
    const storage = {
        getItem: () => { if (failure === 'read') throw new DOMException('Blocked', 'SecurityError'); return raw; },
        setItem: (key: string, value: string) => {
            assert.equal(key, DELICIA_SAVE_KEY);
            if (failure !== 'ok') throw new DOMException('Storage unavailable', failure);
            raw = value; writes++;
        }
    };
    const before = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        createElement: (tag: string) => new Element(tag), activeElement: null
    } });
    t.after(() => before ? Object.defineProperty(globalThis, 'document', before) : Reflect.deleteProperty(globalThis, 'document'));
    const app = Object.assign(Object.create(DeliciaApp.prototype), {
        store: new DeliciaStore(storage), sim: new DeliciaSimulation(), screen: 'playing',
        root: new Element('main'), panel: new Element('section'), status: new Element('p'),
        hud: new Element('div'), canvas: new Element('canvas'), playfield: new Element('div'), touch: new Element('div'),
        held: new Set(), pressed: new Set(), released: new Set(), sources: new Map(), buttonKeys: new Map(),
        audio: { effect() {}, pause() {}, unlock: async () => {}, music() {}, voice() {}, muted: false },
        // HUD painting is independent of save feedback; actual notify/announce/menu rendering execute.
        updateHud() {}
    }) as App;
    const button = (name: string) => {
        const result = app.panel.all().find(node => node.tagName === 'button' && node.textContent === name);
        assert.ok(result, `Missing ${name} button`); return result;
    };
    return { app, button, storage, original, get raw() { return raw; }, get writes() { return writes; },
        recover() { failure = 'ok'; }, warning: () => app.panel.all().find(node => node.className.includes('dl-save-warning')) };
}
function reachCheckpoint(app: App, index = 0) {
    const cp = app.sim.stage.checkpoints[index];
    Object.assign(app.sim.player, { x: cp.x, y: cp.y, vx: 0, vy: 0 });
    app.step(1 / 120, noDeliciaInput());
    assert.equal(app.store.save.checkpoint?.index, index);
}

for (const error of ['QuotaExceededError', 'SecurityError'] as const)
test(`checkpoint ${error} feedback stays truthful and a session retry retains progress`, t => {
    const h = fixture(t, error); reachCheckpoint(h.app);
    assert.equal(h.app.toast, 'Checkpoint só nesta sessão.'); assert.equal(h.app.toastTime, 5);
    assert.equal(h.app.status.textContent, h.app.toast); assert.match(h.app.store.warning, /apenas nesta sessão/);
    assert.equal(h.raw, h.original); assert.equal(h.writes, 0);
    assert.equal(h.app.loadStage('delicia-1', true), true);
    assert.equal(h.app.sim.checkpoint, 0); assert.equal(h.app.sim.player.x, DELICIA_STAGES[0].checkpoints[0].x);
    assert.equal(new DeliciaStore(h.storage).save.checkpoint, null, 'A reload only sees durable progress.');
    h.app.pause(); assert.match(h.warning()!.textContent, /apenas nesta sessão/);
    h.button('Tentar salvar').click(); assert.ok(h.warning()); assert.equal(h.raw, h.original);
    h.recover(); h.button('Tentar salvar').click();
    assert.equal(h.warning(), undefined); assert.equal(h.app.status.textContent, 'Progresso salvo.');
    assert.equal(new DeliciaStore(h.storage).save.checkpoint?.index, 0);
    assert.equal(h.app.store.warning, ''); assert.equal(h.writes, 1);
});

test('the next checkpoint automatically reports durable success after storage recovers', t => {
    const h = fixture(t, 'QuotaExceededError'); reachCheckpoint(h.app); h.recover(); reachCheckpoint(h.app, 1);
    assert.equal(h.app.toast, 'Checkpoint salvo.'); assert.equal(h.app.toastTime, 3);
    assert.equal(h.app.store.warning, ''); assert.equal(new DeliciaStore(h.storage).save.checkpoint?.index, 1);
});

function finish(app: App) {
    app.sim.elapsed = 48;
    app.clearStage();
    if (app.screen === 'dialogue') app.dialogueDone();
    assert.equal(app.screen, 'clear');
}
test('failed completion offers export and retry without changing earned progress', async t => {
    const h = fixture(t, 'QuotaExceededError'); finish(h.app);
    assert.match(h.warning()!.textContent, /apenas nesta sessão/); assert.equal(h.raw, h.original);
    const earned = structuredClone(h.app.store.save);
    assert.deepEqual(earned.completed, ['delicia-1']); assert.equal(earned.times['delicia-1'], 48);
    assert.ok(earned.medals['delicia-1'].length); assert.equal(earned.checkpoint, null);
    let exported: Blob | undefined;
    t.mock.method(URL, 'createObjectURL', (blob: Blob) => { exported = blob; return 'blob:test-copy'; });
    t.mock.method(URL, 'revokeObjectURL', () => {});
    h.button('Exportar cópia').click(); assert.ok(exported);
    assert.deepEqual(parseDeliciaSave(await exported.text()), earned); assert.equal(h.raw, h.original);
    h.button('Tentar salvar').click(); assert.deepEqual(h.app.store.save, earned); assert.ok(h.warning());
    h.recover(); h.button('Tentar salvar').click();
    assert.equal(h.warning(), undefined); assert.equal(h.app.status.textContent, 'Progresso salvo.');
    assert.deepEqual(new DeliciaStore(h.storage).save, earned); assert.equal(h.writes, 1);
});

test('successful completion has no failure controls and survives reload', t => {
    const h = fixture(t); finish(h.app);
    assert.equal(h.warning(), undefined); assert.equal(h.app.store.warning, '');
    assert.deepEqual(new DeliciaStore(h.storage).save, h.app.store.save);
});

test('read-protected storage remains untouched by retry, with its original warning visible', t => {
    const h = fixture(t, 'read'); reachCheckpoint(h.app);
    assert.equal(h.app.toast, 'Checkpoint só nesta sessão.');
    h.app.pause(); assert.match(h.warning()!.textContent, /não pôde ser lido/);
    h.recover(); h.button('Tentar salvar').click();
    assert.match(h.warning()!.textContent, /não pôde ser lido/); assert.equal(h.writes, 0); assert.equal(h.raw, h.original);
});

test('options and ending retain save recovery, and a successful retry clears the warning', t => {
    const h = fixture(t, 'SecurityError'); finish(h.app);
    h.app.showSettings(); assert.match(h.warning()!.textContent, /apenas nesta sessão/);
    h.app.showEnding(); h.app.dialogueDone(); assert.equal(h.app.screen, 'ending');
    assert.match(h.warning()!.textContent, /apenas nesta sessão/);
    h.recover(); h.button('Tentar salvar').click(); assert.equal(h.warning(), undefined);
    assert.equal(h.app.status.textContent, 'Progresso salvo.'); assert.deepEqual(new DeliciaStore(h.storage).save, h.app.store.save);
});

// Source/metric coverage only; real compact layout is verified on the release preview.
test('recovery controls wrap in normal document flow and each bitmap label fits a 320px overlay', () => {
    const css = readFileSync(new URL('../src/adventure/delicia/delicia.css', import.meta.url), 'utf8');
    assert.match(css, /\.dl-save-recovery \{ position: static; max-width: 100%; \}/);
    assert.match(css, /\.dl-save-recovery \.dl-save-actions \{ flex-wrap: wrap;/);
    const available = 320 - 32 - 2 * (26 + 2) - 2 * (10 + 2);
    for (const label of ['Exportar cópia', 'Tentar salvar'])
        assert.ok(textWidth(label) * 2 + 2 * (16 + 2) <= available, label);
});
