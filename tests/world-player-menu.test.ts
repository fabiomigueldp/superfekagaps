import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { freshSave, SAVE_KEY } from '../src/adventure/progress';
import { sceneLifecycleBrowser, LifecycleElement } from './helpers/sceneLifecycleHarness';

function browser(t: TestContext, continuing = false) {
    const h = sceneLifecycleBrowser(t);
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const decorate = (element: LifecycleElement) => {
        Object.defineProperty(element, 'isConnected', { get: () => element === h.body || element.parent !== null });
        element.focus = () => { doc.activeElement = element; };
        return element;
    };
    const create = doc.createElement;
    doc.createElement = tag => decorate(create(tag));
    decorate(h.body); decorate(h.canvas);
    const save = JSON.stringify({ ...freshSave(), completed: continuing ? ['1-1'] : [], selected: continuing ? '1-2' : '1-1' });
    const stored = new Map([[SAVE_KEY, save]]), writes: string[] = [];
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => { writes.push(value); stored.set(key, value); },
    } });
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement);
    h.canvas.focus(); game.render();
    const menu = h.body.children.find(element => element.className === 'canvas-menu-accessibility')!;
    const button = (label: string) => {
        const result = menu.children.find(element => element.textContent === label);
        assert.ok(result, `Missing menu action: ${label}`); return result;
    };
    const key = (key: string) => h.window.dispatch('keydown', { key, target: doc.activeElement, repeat: false });
    return { ...h, game, menu, button, key, stored, save, writes };
}

for (const continuing of [false, true]) test(`title has one coherent native menu (${continuing ? 'saved adventure' : 'new adventure'})`, t => {
    const h = browser(t, continuing);
    const labels = [continuing ? 'CONTINUAR' : 'JOGAR', 'OPÇÕES', 'GALERIA'];
    assert.equal(h.menu.hidden, false);
    assert.deepEqual(h.menu.children.map(button => button.textContent), labels);
    assert.equal(h.body.children.some(element => element.id === 'experimental-hub' || element.className === 'experimental-entry'), false);
    assert.equal(h.body.classList.contains('experimental-title'), false);
    for (const button of h.menu.children) {
        assert.equal(button.tagName, 'BUTTON'); assert.equal(button.disabled, false); assert.equal(button.tabIndex, 0);
        button.focus();
        for (const shiftKey of [false, true]) {
            assert.equal(h.menu.dispatch('keydown', { key: 'Tab', shiftKey, target: button }).defaultPrevented, false);
            assert.equal(h.key('Tab').defaultPrevented, false, 'Browser retains ordinary tab traversal');
        }
    }
    assert.equal(h.game.state, 'title');
    assert.deepEqual(h.writes, []); assert.equal(h.stored.get(SAVE_KEY), h.save);
    h.game.dispose(); assert.equal(h.listenerCount(), 0); assert.equal(h.frames.size, 0);
});

test('title arrows wrap through three actions and Enter still starts the adventure', t => {
    const h = browser(t);
    h.key('ArrowUp'); h.game.render(); h.key('Enter'); h.game.render();
    assert.equal(h.game.state, 'gallery', 'Up from Play reaches Gallery without a hidden fourth action');
    h.button('VOLTAR').click(); h.game.render();
    assert.equal(h.game.state, 'title');
    h.canvas.focus();
    for (let step = 0; step < 3; step++) { h.key('ArrowDown'); h.game.render(); }
    h.key('Enter');
    assert.equal(h.game.state, 'intro', 'Three downward steps return to Play');
});

test('gallery and options return to the same title and preserve campaign progress', t => {
    const h = browser(t, true), before = structuredClone(h.game.store.save);
    h.button('GALERIA').click(); h.game.render();
    assert.equal(h.game.state, 'gallery');
    h.button('GUAÍRA · 0/5 TRECHOS').click(); h.game.render();
    h.button('VOLTAR AO CADERNO').click(); h.game.render();
    h.button('VOLTAR').click(); h.game.render();
    h.button('OPÇÕES').click(); h.game.render();
    assert.equal(h.game.state, 'settings');
    assert.ok(h.button('CONTROLES'));
    h.button('VOLTAR').click(); h.game.render();
    assert.equal(h.game.state, 'title');
    assert.deepEqual(h.menu.children.map(button => button.textContent), ['CONTINUAR', 'OPÇÕES', 'GALERIA']);
    assert.deepEqual(h.game.store.save, before);
});
