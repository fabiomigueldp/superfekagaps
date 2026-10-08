import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { stageById } from '../src/adventure/campaign';
import { freshSave } from '../src/adventure/progress';
import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { FACTORY_SALON } from '../src/adventure/factory/FactorySalon';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

type Internals = {
    change(screen: string): void; clearSecret: boolean; recordEligible: boolean;
    menuAccessibility: { root: LifecycleElement };
    resultAccessibility?: { root: LifecycleElement; dispose(): void };
};
function setup(t: TestContext) {
    const h = sceneLifecycleBrowser(t);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => {} } });
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement);
    t.after(() => game.dispose());
    const internal = game as unknown as Internals;
    const create = h.document.createElement;
    h.document.createElement = tag => {
        const node = create(tag);
        node.focus = () => { (h.document as unknown as { activeElement: LifecycleElement }).activeElement = node; node.dispatch('focus'); };
        return node;
    };
    game.elapsed = 42.6; game.coins = 7;
    return { ...h, game, internal, receipt: () => {
        assert.ok(internal.resultAccessibility, 'World result receipts need native reading content');
        return internal.resultAccessibility.root;
    }, button: () => internal.menuAccessibility.root.children[0] };
}
function text(node: LifecycleElement): string { return [node.textContent, ...node.children.map(text)].filter(Boolean).join(' '); }

for (const [id, secret, eligible, action] of [
    ['1-1', false, true, 'SEGUIR VIAGEM'],
    ['1-3', true, true, 'SEGUIR VIAGEM'],
    ['1-3', true, false, 'SEGUIR VIAGEM'],
    ['6-5', false, true, 'O GRANDE FINAL'],
    ['6-5', false, false, 'O GRANDE FINAL'],
] as const) {
    test(`clear receipt ${id}, secret=${secret}, eligible=${eligible} matches the earned visible result`, t => {
        const h = setup(t);
        h.game.stage = stageById(id)!; h.internal.clearSecret = secret; h.internal.recordEligible = eligible;
        h.internal.change('clear'); h.game.render();
        const root = h.receipt();
        assert.equal(root.hidden, false);
        assert.equal(root.children[0].tagName, 'H2');
        assert.equal(root.children[0].textContent, secret ? 'CAMINHO SECRETO!' : 'FASE CONCLUÍDA!');
        assert.match(text(root), new RegExp(h.game.stage.name));
        assert.match(text(root), /43 segundos · 7 moedas/);
        assert.equal(text(root).includes('TEMPO PARCIAL · SEM RECORDE'), !eligible);
        assert.equal(h.button().textContent, action);
        assert.equal(h.button().getAttribute('aria-label'), action);
        assert.equal(h.button().getAttribute('aria-describedby'), root.id);
    });
}

for (const released of [false, true]) test(`ending receipt presents actual water outcome and totals (released=${released})`, t => {
    const h = setup(t), save = freshSave();
    save.completed = ['1-1', '6-5']; save.seals = ['1-1:s1', '1-1:s2'];
    if (released) save.guaira.completed = guairaChapterRoute(save.guaira.opening);
    save.guaira.optional.gallery = true; save.seen = [FACTORY_SALON.victory];
    h.game.store.save = save; h.internal.change('ending'); h.game.render();
    const root = h.receipt();
    assert.equal(root.children[0].textContent, 'UMA VITÓRIA E TANTO!');
    assert.match(text(root), /FEKA SALVOU YASMIN\?/);
    assert.match(text(root), new RegExp(`${released ? 7 : 2}/35 TRECHOS · 2/72 SELOS`));
    assert.ok(text(root).includes(released ? 'GUAÍRA: ÁGUA LIBERADA' : 'GUAÍRA: A ÁGUA AINDA ESPERA'));
    assert.match(text(root), /2\/3 DESVIOS OPCIONAIS CONCLUÍDOS/);
    assert.equal(h.button().getAttribute('aria-describedby'), root.id);
});

test('unchanged result renders keep nodes, descriptions and focus stable without a duplicate live region', t => {
    const h = setup(t); h.internal.change('clear'); h.game.render();
    const root = h.receipt(), children = [...root.children], button = h.button(); button.focus();
    const focus = h.document.activeElement;
    let rebuilds = 0, attributes = 0;
    const replace = root.replaceChildren.bind(root), set = button.setAttribute.bind(button);
    root.replaceChildren = (...nodes) => { rebuilds++; replace(...nodes); };
    button.setAttribute = (name, value) => { attributes++; set(name, value); };
    for (let frame = 0; frame < 10; frame++) h.game.render();
    assert.equal(rebuilds, 0); assert.equal(attributes, 0);
    assert.deepEqual(root.children, children); assert.equal(h.button(), button);
    assert.equal(h.document.activeElement, focus);
    assert.equal(root.getAttribute('aria-live'), null); assert.notEqual(root.getAttribute('role'), 'status');
    h.game.coins = 8; h.game.render();
    assert.equal(rebuilds, 1); assert.match(text(root), /8 moedas/);
    h.game.render(); assert.equal(rebuilds, 1); assert.equal(h.document.activeElement, focus);
});

test('clear to ending description exists before continuation focus and old receipts disappear immediately', t => {
    const h = setup(t); h.game.stage = stageById('6-5')!; h.internal.change('clear'); h.game.render();
    const oldButton = h.button(); oldButton.focus();
    // Menu transitions hand focus through the canvas, just as the real browser does.
    h.canvas.focus = () => { (h.document as unknown as { activeElement: LifecycleElement }).activeElement = h.canvas; };
    const create = h.document.createElement;
    let describedAtFocus = '';
    h.document.createElement = tag => {
        const node = create(tag), focus = node.focus.bind(node);
        node.focus = () => { if (tag === 'button') describedAtFocus = node.getAttribute('aria-describedby') ?? ''; focus(); };
        return node;
    };
    h.internal.change('ending'); assert.equal(oldButton.getAttribute('aria-describedby'), null); assert.equal(h.receipt().hidden, true); assert.equal(h.receipt().children.length, 0);
    h.game.render();
    assert.equal(describedAtFocus, h.receipt().id);
    assert.match(text(h.receipt()), /UMA VITÓRIA E TANTO/); assert.doesNotMatch(text(h.receipt()), /43 segundos/);
    h.internal.change('map'); assert.equal(h.receipt().hidden, true); assert.equal(h.receipt().children.length, 0);
    h.internal.change('title'); h.game.render();
    assert.equal(h.button().getAttribute('aria-describedby'), null);
});

test('hidden/inert pages and disposal remove result reading content without taking external focus', t => {
    const h = setup(t); h.internal.change('clear'); h.game.render();
    const root = h.receipt(), outside = h.document.createElement('button'); outside.focus();
    h.document.hidden = true; h.document.dispatch('visibilitychange');
    assert.equal(root.hidden, true); assert.equal(root.children.length, 0);
    assert.equal(h.document.activeElement, outside);
    h.document.hidden = false; h.game.render(); assert.equal(root.hidden, false);
    (h.canvas as unknown as { inert: boolean }).inert = true; h.game.render();
    assert.equal(root.hidden, true); assert.equal(root.children.length, 0);
    assert.equal(h.document.activeElement, outside);
    (h.canvas as unknown as { inert: boolean }).inert = false; h.game.render();
    h.game.dispose(); assert.equal(root.parent, null); assert.equal(root.children.length, 0);
    assert.equal(h.document.activeElement, outside);
});

for (const final of [false, true]) test(`native continuation clears the receipt through the real ${final ? 'final and ending' : 'normal'} result flow`, t => {
    const h = setup(t); h.game.stage = stageById(final ? '6-5' : '1-1')!;
    h.internal.change('clear'); h.game.render();
    const clearButton = h.button(), root = h.receipt();
    clearButton.dispatch('click');
    assert.equal(h.game.state, final ? 'ending' : 'map');
    assert.equal(root.hidden, true); assert.equal(root.children.length, 0);
    assert.equal(clearButton.getAttribute('aria-describedby'), null);
    if (final) {
        h.game.render(); assert.equal(root.hidden, false); assert.match(text(root), /UMA VITÓRIA E TANTO/);
        const endingButton = h.button(); endingButton.dispatch('click');
        assert.equal(h.game.state, 'map'); assert.equal(root.hidden, true); assert.equal(root.children.length, 0);
        assert.equal(endingButton.getAttribute('aria-describedby'), null);
    }
});
