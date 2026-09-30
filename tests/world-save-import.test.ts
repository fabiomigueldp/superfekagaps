import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { ProgressStore, freshSave, SAVE_KEY } from '../src/adventure/progress';

class SaveInput {
    type = ''; accept = ''; id = ''; hidden = false;
    files: { text(): Promise<string> }[] = [];
    onchange: (() => Promise<void>) | null = null;
    oncancel: (() => void) | null = null;
    attached = false;
    clicked = false;
    clickError = false;
    constructor(private readonly children: SaveInput[]) {}
    click() {
        assert.equal(this.attached, true, 'The browser chooser must receive a live DOM input.');
        this.clicked = true;
        if (this.clickError) throw Error('File picker unavailable');
    }
    remove() { this.attached = false; const index = this.children.indexOf(this); if (index >= 0) this.children.splice(index, 1); }
}
function harness(t: TestContext, failClick = false) {
    const children: SaveInput[] = [], inputs: SaveInput[] = [], writes: string[] = [];
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        createElement(tag: string) { assert.equal(tag, 'input'); const input = new SaveInput(children); input.clickError = failClick; inputs.push(input); return input; },
        body: { append(input: SaveInput) { children.push(input); input.attached = true; } },
    } });
    const store = new ProgressStore({ getItem: () => null, setItem(key, value) { assert.equal(key, SAVE_KEY); writes.push(value); } });
    const game = Object.create(WorldGame.prototype) as any;
    let imports = 0, volumeUpdates = 0;
    const importSave = store.import.bind(store);
    store.import = (raw: string) => { imports++; importSave(raw); };
    Object.assign(game, { store, selection: 17, state: 'settings', toast: 'Existing message', toastTimer: 123,
        audio: { preferences: store.save.preferences, volume() { volumeUpdates++; } } });
    t.after(() => {
        game.saveImportCleanup?.();
        if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document');
    });
    return { game, store, children, inputs, writes, get imports() { return imports; }, get volumeUpdates() { return volumeUpdates; },
        open() { game.importSave(); return inputs[inputs.length - 1]; } };
}
function deferredText() {
    let resolve!: (text: string) => void, reject!: (reason: Error) => void;
    const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
    return { text: () => promise, resolve, reject };
}

test('save chooser stays attached through a delayed handoff and read, then imports preferences and cleans up', async t => {
    const h = harness(t), input = h.open();
    assert.equal(input.id, 'world-save-import'); assert.equal(input.type, 'file'); assert.equal(input.accept, '.json'); assert.equal(input.hidden, true);
    assert.equal(input.clicked, true); assert.deepEqual(h.children, [input]);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(input.attached, true, 'Waiting for authorization or the chooser must not remove the node.');
    const file = deferredText(); input.files = [file]; const importing = input.onchange!();
    assert.equal(input.attached, true); assert.equal(h.imports, 0);
    const save = freshSave(); save.selected = '1-5'; save.completed = ['1-1', '1-2', '1-3', '1-4']; save.preferences.music = .25;
    file.resolve(JSON.stringify(save)); await importing;
    assert.deepEqual(h.store.save, save); assert.deepEqual(JSON.parse(h.writes[0]), save); assert.equal(h.imports, 1);
    assert.equal(h.game.audio.preferences, h.store.save.preferences); assert.equal(h.volumeUpdates, 1);
    assert.equal(h.game.selection, 17, 'Import retains normal selection handling until the existing screen navigation resumes.');
    assert.equal(h.game.state, 'settings'); assert.equal(h.game.toast, 'Progresso importado.'); assert.equal(h.game.toastTimer, 2500);
    assert.equal(h.children.length, 0); assert.equal(input.onchange, null); assert.equal(input.oncancel, null); assert.equal(h.game.saveImportCleanup, undefined);
});

test('invalid content is parsed before store import and read errors clean up without changing progress', async t => {
    for (const kind of ['invalid JSON', 'invalid version', 'read failure']) await t.test(kind, async child => {
        const h = harness(child), before = structuredClone(h.store.save), preferences = h.game.audio.preferences, input = h.open();
        input.files = [{ text: async () => { if (kind === 'read failure') throw Error('Unreadable file'); return kind === 'invalid JSON' ? '{' : '{"version":99}'; } }];
        await input.onchange!();
        assert.deepEqual(h.store.save, before); assert.equal(h.game.audio.preferences, preferences); assert.equal(h.imports, 0); assert.equal(h.volumeUpdates, 0);
        assert.equal(h.writes.length, 0); assert.equal(h.children.length, 0); assert.equal(h.game.toast, 'Arquivo de progresso inválido.');
    });
});

test('cancel and empty selection remove the input without changing progress, preferences or messages', async t => {
    const h = harness(t), before = structuredClone(h.store.save), preferences = h.game.audio.preferences;
    const canceled = h.open(); canceled.oncancel!();
    assert.equal(canceled.attached, false); assert.equal(h.game.saveImportCleanup, undefined);
    const empty = h.open(); await empty.onchange!();
    assert.equal(h.children.length, 0); assert.equal(h.inputs.every(input => !input.onchange && !input.oncancel), true);
    assert.deepEqual(h.store.save, before); assert.equal(h.game.audio.preferences, preferences); assert.equal(h.game.selection, 17);
    assert.equal(h.imports, 0); assert.equal(h.volumeUpdates, 0); assert.equal(h.writes.length, 0);
    assert.equal(h.game.toast, 'Existing message'); assert.equal(h.game.toastTimer, 123);
});

test('repeated openings retain only the newest input and a stale read cannot replace its result', async t => {
    const h = harness(t), first = h.open(), file = deferredText(); first.files = [file]; const pending = first.onchange!();
    const second = h.open(); assert.equal(first.attached, false); assert.equal(first.oncancel, null); assert.deepEqual(h.children, [second]);
    const current = freshSave(); current.selected = '2-1'; current.preferences.effects = .25;
    second.files = [{ text: async () => JSON.stringify(current) }]; await second.onchange!();
    const stale = freshSave(); stale.selected = '6-5'; file.resolve(JSON.stringify(stale)); await pending;
    assert.deepEqual(h.store.save, current); assert.equal(h.imports, 1); assert.equal(h.volumeUpdates, 1); assert.equal(h.writes.length, 1);
    assert.equal(h.children.length, 0); assert.equal(h.game.toast, 'Progresso importado.');
});

test('canceling an in-progress read ignores its eventual failure and leaves no input behind', async t => {
    const h = harness(t), input = h.open(), file = deferredText(), before = structuredClone(h.store.save);
    input.files = [file]; const pending = input.onchange!(); input.oncancel!(); file.reject(Error('Late read failure')); await pending;
    assert.deepEqual(h.store.save, before); assert.equal(h.imports, 0); assert.equal(h.writes.length, 0); assert.equal(h.volumeUpdates, 0);
    assert.equal(h.children.length, 0); assert.equal(h.game.toast, 'Existing message');
});

test('a chooser-opening error cleans the attached input and preserves the save', t => {
    const h = harness(t, true), before = structuredClone(h.store.save), input = h.open();
    assert.equal(input.attached, false); assert.equal(h.children.length, 0); assert.equal(h.game.saveImportCleanup, undefined);
    assert.deepEqual(h.store.save, before); assert.equal(h.imports, 0); assert.equal(h.writes.length, 0);
    assert.match(h.game.toast, /Não foi possível abrir/);
});
