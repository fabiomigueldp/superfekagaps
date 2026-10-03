import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { JournalAccessibility } from '../src/adventure/JournalAccessibility';
import { WorldGame } from '../src/adventure/WorldGame';
import { freshSave } from '../src/adventure/progress';
import { ISLANDS } from '../src/adventure/campaign';
import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { recordSalonVictory } from '../src/adventure/factory/FactorySalon';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

function setup(t: TestContext) {
    const h = sceneLifecycleBrowser(t);
    const journal = new JournalAccessibility(h.canvas as unknown as HTMLCanvasElement);
    t.after(() => journal.dispose());
    return { ...h, journal, root: journal.root as unknown as LifecycleElement, save: freshSave() };
}
function text(element: LifecycleElement): string {
    return [element.textContent, ...element.children.map(text)].join(' ');
}

test('Guaíra reading content exposes five receipts, water and three independent optionals', t => {
    const h = setup(t); h.journal.sync(7, h.save);
    assert.equal(h.root.hidden, false);
    assert.equal(h.root.children[0].tagName, 'H2');
    assert.equal(h.root.children[1].children.length, 5);
    assert.equal(h.root.children[3].children.length, 3);
    assert.match(text(h.root), /Travessia/);
    assert.match(text(h.root), /Água: conclua o Prefeito da Vazão/);
    assert.match(text(h.root), /Galeria dos Remendos \(opcional\): pendente/);
    assert.equal(h.root.getAttribute('aria-live'), null);
    assert.equal(h.root.getAttribute('tabindex'), null);
    assert.equal(h.document.activeElement, null);
    const heading = h.root.children[0], receipts = h.root.children[1];
    h.journal.sync(7, h.save);
    assert.equal(h.root.children[0], heading);
    assert.equal(h.root.children[1], receipts, 'unchanged frames do not rebuild reading content');
    h.save.guaira.completed = guairaChapterRoute(h.save.guaira.opening);
    h.save.guaira.optional = { gallery: true, relief: true }; recordSalonVictory(h.save);
    h.journal.sync(7, h.save);
    assert.match(text(h.root), /Água liberada · Serra aberta/);
    assert.equal((text(h.root).match(/concluído/g) ?? []).length, 8);
    assert.doesNotMatch(text(h.root), /pendente/);
});

test('page transitions remove stale content and expose every existing region description', t => {
    const h = setup(t); h.journal.sync(7, h.save);
    for (let page = 1; page <= 6; page++) {
        h.journal.sync(page, h.save);
        assert.equal(h.root.children.length, 2);
        assert.equal(h.root.children[0].textContent, ISLANDS[page - 1].name);
        assert.equal(h.root.children[1].textContent, ISLANDS[page - 1].description);
        assert.doesNotMatch(text(h.root), /Prefeito da Vazão/);
    }
    h.journal.sync(0, h.save);
    assert.equal(h.root.children.length, 1);
    h.journal.sync(null, h.save);
    assert.equal(h.root.hidden, true); assert.equal(h.root.children.length, 0);
    h.save.guaira.opening = 'guaira-patio-comportas'; h.journal.sync(7, h.save);
    assert.match(text(h.root), /Pátio das Comportas/);
    assert.doesNotMatch(text(h.root), /Travessia/);
});

test('hidden document, inert canvas and disposal remove journal without moving focus', t => {
    const h = setup(t); const outside = new LifecycleElement('INPUT');
    (h.document as { activeElement: LifecycleElement | null }).activeElement = outside;
    h.journal.sync(7, h.save); assert.equal(h.document.activeElement, outside);
    h.document.hidden = true; h.document.dispatch('visibilitychange');
    assert.equal(h.root.hidden, true); assert.equal(h.root.children.length, 0);
    h.journal.sync(7, h.save); assert.equal(h.root.hidden, true);
    h.document.hidden = false;
    (h.canvas as unknown as HTMLCanvasElement).inert = true;
    h.journal.sync(7, h.save); assert.equal(h.root.hidden, true);
    (h.canvas as unknown as HTMLCanvasElement).inert = false;
    h.journal.sync(7, h.save); assert.equal(h.root.hidden, false);
    h.journal.dispose(); h.journal.sync(7, h.save);
    assert.equal(h.root.parent, null); assert.equal(h.root.children.length, 0);
    assert.equal(h.document.activeElement, outside);
});

test('WorldGame mounts journal before native buttons and clears it immediately on exit', t => {
    const h = sceneLifecycleBrowser(t);
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement);
    t.after(() => game.dispose());
    const internal = game as unknown as { galleryWorld: number; render(): void; change(screen: string): void; journalAccessibility: JournalAccessibility };
    game.state = 'gallery'; internal.galleryWorld = 7; internal.render();
    const root = internal.journalAccessibility.root as unknown as LifecycleElement;
    assert.equal(root.hidden, false); assert.match(text(root), /Caderno dos Caminhos/);
    const body = h.document.body;
    assert.ok(body.children.indexOf(root) < body.children.findIndex(node => node.className === 'canvas-menu-accessibility'));
    internal.change('playing');
    assert.equal(root.hidden, true); assert.equal(root.children.length, 0);
    internal.change('gallery'); internal.render(); assert.equal(root.hidden, false);
    internal.change('map'); assert.equal(root.children.length, 0);
    internal.change('title'); internal.render(); assert.equal(root.hidden, true);
});
