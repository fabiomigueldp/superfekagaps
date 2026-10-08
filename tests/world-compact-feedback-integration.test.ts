import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { CanvasMenuAccessibility } from '../src/adventure/CanvasMenuAccessibility';
import { ProgressStore, freshSave } from '../src/adventure/progress';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

/** Real WorldGame render/update/import/menu actions; only browser and device boundaries are stubbed. */
function setup(t: TestContext) {
    let cleanup = () => {};
    t.after(() => cleanup());
    const h = sceneLifecycleBrowser(t);
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const create = doc.createElement;
    doc.createElement = tag => {
        const element = create(tag);
        element.focus = () => { doc.activeElement?.dispatch('blur'); doc.activeElement = element; element.dispatch('focus'); };
        return element;
    };
    h.canvas.focus = () => { doc.activeElement = h.canvas; };
    h.window.innerWidth = 360; h.window.innerHeight = 240;
    h.canvas.getBoundingClientRect = () => ({ left: 20, top: 30, width: 320, height: 180, x: 20, y: 30, right: 340, bottom: 210 });
    const writes: string[] = [];
    const store = new ProgressStore({ getItem: () => null, setItem: (_key, value) => { writes.push(value); } });
    const game = Object.create(WorldGame.prototype) as any;
    Object.assign(game, {
        store, state: 'settings', settingReturn: 'title', galleryWorld: 0, menuSelection: 0, selection: 0,
        toast: '', toastTimer: 0, time: 0, buttons: [], mapCanvas: h.canvas,
        renderer: { startScene() {}, getContext: () => h.canvas.getContext(), present() {}, advanceClock() {} },
        audio: { preferences: store.save.preferences, volume() {}, tick() {} },
        input: { reset() {}, setMenuMode() {}, update() {}, consumeMute: () => false },
        art: { background() {}, atlas: { draw() {} } },
    });
    const menu = new CanvasMenuAccessibility(h.canvas as unknown as HTMLCanvasElement, {
        select: index => { game.menuSelection = index; }, activate: index => game.buttons[index]?.run(),
        escape: () => game.backMenu(), resetInput: () => game.input.reset(),
    });
    game.menuAccessibility = menu;
    cleanup = () => { game.saveImportCleanup?.(); menu.dispose(); };
    const root = menu.root as unknown as LifecycleElement;
    const status = () => {
        const statuses = root.children.filter(child => child.getAttribute('role') === 'status');
        assert.equal(statuses.length, 1, 'An active menu keeps exactly one accessible live region mounted.');
        const status = statuses[0];
        assert.equal(status.hidden, false); assert.equal(status.parent, root);
        assert.equal(status.getAttribute('aria-live'), 'polite');
        assert.equal(status.getAttribute('aria-atomic'), 'true');
        return status;
    };
    return { ...h, game, doc, store, writes, root, status };
}

test('WorldGame imports report full outcomes through compact native Settings, retain focus, and expire via update', async t => {
    for (const kind of ['invalid', 'read failure', 'storage failure', 'success'] as const) await t.test(kind, async child => {
        const h = setup(child); h.game.render();
        assert.equal(h.root.getAttribute('data-compact'), 'true');
        const initialStatus = h.status(); assert.equal(initialStatus.textContent, '');
        const controls = h.root.children.filter(element => element.tagName === 'BUTTON');
        const importButton = controls.find(button => button.getAttribute('aria-label') === 'IMPORTAR PROGRESSO')!;
        importButton.focus(); importButton.click();
        const input = h.body.children.find(element => element.id === 'world-save-import') as unknown as HTMLInputElement;
        assert.ok(input, 'The actual rendered native import action opens an attached chooser.');
        if (kind === 'storage failure') h.store.import = () => false;
        const imported = freshSave(); imported.preferences.music = .25;
        Object.assign(input, { files: [{ text: async () => {
            if (kind === 'read failure') throw Error('Unreadable file');
            return kind === 'invalid' ? '{' : JSON.stringify(imported);
        } }] });
        await (input.onchange as unknown as () => Promise<void>)();
        h.game.render();
        const expected = { invalid: 'Save inválido ou incompatível.', 'read failure': 'Falha ao ler. Selecione de novo.',
            'storage failure': 'Falha ao salvar. Progresso mantido.', success: 'Progresso importado.' }[kind];
        const feedback = h.status()!;
        assert.equal(feedback, initialStatus); assert.equal(feedback.textContent, expected);
        assert.equal(feedback.getAttribute('aria-live'), 'polite'); assert.equal(feedback.getAttribute('aria-atomic'), 'true');
        assert.equal(h.doc.activeElement, importButton, 'Status updates must not steal the triggering control focus.');
        assert.deepEqual(h.root.children.filter(element => element.tagName === 'BUTTON'), controls);
        assert.equal(h.root.children.at(-1), feedback, 'Feedback is a separate flow item, not a replacement for controls.');
        assert.equal(h.writes.length, kind === 'success' ? 1 : 0);
        h.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 360, x: 0, y: 0, right: 640, bottom: 360 });
        h.window.dispatch('resize');
        assert.equal(h.root.getAttribute('data-compact'), 'false');
        assert.equal(h.status(), feedback); assert.equal(feedback.textContent, expected);
        assert.equal(h.doc.activeElement, importButton);
        assert.deepEqual(h.root.children.filter(element => element.tagName === 'BUTTON'), controls);
        h.game.update(h.game.toastTimer - 1); h.game.render();
        assert.equal(h.status(), feedback, 'Active feedback survives until its real timer expires.');
        h.game.update(1); h.game.render();
        assert.equal(h.game.toastTimer, 0); assert.equal(h.status(), feedback); assert.equal(feedback.textContent, '');
        assert.deepEqual(h.root.children.filter(element => element.tagName === 'BUTTON'), controls);
        h.canvas.getBoundingClientRect = () => ({ left: 20, top: 30, width: 320, height: 180, x: 20, y: 30, right: 340, bottom: 210 });
        h.window.dispatch('resize');
        assert.equal(h.root.getAttribute('data-compact'), 'true');
        assert.equal(h.status(), feedback); assert.equal(feedback.textContent, '');
        assert.deepEqual(h.root.children.filter(element => element.tagName === 'BUTTON'), controls);
        assert.equal(h.doc.activeElement, importButton);
    });
});

test('WorldGame locked gallery action exposes its explanation, while detail keeps its artwork unobstructed', t => {
    const h = setup(t); h.game.state = 'gallery'; h.game.render();
    const island = h.root.children[0]; island.focus(); island.click(); h.game.render();
    assert.equal(h.game.galleryWorld, 0); assert.equal(h.status()?.textContent, 'Encontre os 12 selos desta ilha.');
    assert.equal(h.doc.activeElement, island);
    const feedback = h.status();
    h.game.update(1800); h.game.render(); assert.equal(h.status(), feedback); assert.equal(feedback.textContent, '');
    assert.equal(h.root.children[0], island); assert.equal(h.doc.activeElement, island);
    h.game.galleryWorld = 1; h.game.render();
    assert.equal(h.root.getAttribute('data-compact'), 'false');
    assert.equal(h.root.children.filter(element => element.tagName === 'BUTTON').length, 1);
    assert.equal(h.status(), feedback); assert.equal(feedback.textContent, '');
    assert.equal(h.root.children[0].textContent, 'OUTRAS ILHAS');
    assert.equal(h.root.children[0].style.background, 'transparent');
    assert.equal(h.root.style.height, '180px');
    assert.equal(h.doc.activeElement, h.root.children[0]);
});
