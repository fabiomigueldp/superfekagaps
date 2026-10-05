import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave } from '../src/adventure/progress';
import { campaignMapDirection, guairaTravelDirections } from '../src/adventure/CampaignWayfinding';
import { showGuairaRegion } from '../src/adventure/WorldGuairaRegion';

test('Factory completion gives a physical route before a failed Serra selection', () => {
    const save = freshSave();
    assert.equal(campaignMapDirection(save, '3-5', '3-5', false), '');
    assert.equal(guairaTravelDirections(save, '3-5').available, false);
    save.completed = ['3-5'];
    assert.match(campaignMapDirection(save, '3-5', '3-5', false), /voe até Guaíra e libere a água com o Prefeito/);
    assert.equal(campaignMapDirection(save, '3-5', '4-1', false), '');
    assert.equal(campaignMapDirection(save, '3-5', '3-5', true), '');
    save.guaira.completed = ['guaira-prefeito'];
    assert.match(campaignMapDirection(save, '3-5', '3-5', false), /embarque de lá para a Serra/);
});

test('legacy access keeps its route and never claims water was released', () => {
    const save = freshSave(); save.completed = ['3-5']; save.legacySerraAccess = true;
    const before = JSON.stringify(save);
    assert.match(guairaTravelDirections(save, '3-5').route, /acesso antigo/);
    assert.equal(guairaTravelDirections(save, '5-1').approach, '4-1');
    assert.equal(JSON.stringify(save), before);
    save.completed.push('4-1', '4-2');
    assert.equal(guairaTravelDirections(save, '5-1').approach, '4-3');
    assert.match(campaignMapDirection(save, '4-2', '4-2', false), /Revisitar Guaíra/);
    assert.equal(campaignMapDirection(save, '4-3', '4-3', false), '');
});

class Element extends EventTarget {
    children: Element[] = []; disabled = false; isConnected = true; open = false; type = '';
    className = ''; id = ''; src = ''; alt = ''; dataset: Record<string, string> = {};
    attributes = new Map<string, string>(); focusCount = 0; closeCount = 0; width = 0; height = 0;
    private ownText = '';
    get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join(''); }
    set textContent(value: string) { this.ownText = value; this.children = []; }
    get firstElementChild() { return this.children[0] ?? null; }
    constructor(readonly tagName = 'div') { super(); }
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    getContext() { return null; }
    showModal() { this.open = true; }
    close() { this.open = false; this.closeCount++; }
    focus() { this.focusCount++; }
    remove() { this.isConnected = false; }
    click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}
function find(root: Element, className: string): Element {
    if (root.className.split(' ').includes(className)) return root;
    for (const child of root.children) { const match = maybeFind(child, className); if (match) return match; }
    throw new Error(`Missing ${className}`);
}
function maybeFind(root: Element, className: string): Element | undefined {
    if (root.className.split(' ').includes(className)) return root;
    for (const child of root.children) { const match = maybeFind(child, className); if (match) return match; }
}
function fixture(t: import('node:test').TestContext) {
    const body = new Element(), previous = new Element('button');
    const originals = new Map(['document', 'HTMLElement'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    Object.assign(globalThis, { document: { body, activeElement: previous, createElement: (tag: string) => new Element(tag) }, HTMLElement: Element });
    t.after(() => { for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    } });
    const save = freshSave(), calls: string[] = [];
    const callbacks = { fly: (from: string) => calls.push(from), goToFactory: () => calls.push('approach-factory'), goToSerra: () => calls.push('approach-serra') };
    const dialog = () => body.children.at(-1)!;
    const primary = () => find(dialog(), 'guaira-region-primary');
    const open = (arrived: string) => showGuairaRegion(save, arrived, callbacks);
    return { body, previous, save, calls, dialog, primary, open };
}

test('locked chapter shows one reason and a usable map action instead of a dead travel button', t => {
    const h = fixture(t), before = JSON.stringify(h.save), close = h.open('3-5');
    assert.equal(find(h.dialog(), 'guaira-region-title').textContent, 'GUAÍRA');
    assert.equal(find(h.dialog(), 'guaira-region-status').textContent, 'BLOQUEADO');
    assert.equal(find(h.dialog(), 'guaira-region-hint').textContent, 'Conclua 3-5 · Controle de Qualidade, na Fábrica.');
    assert.equal(h.dialog().textContent.match(/Controle de Qualidade/g)?.length, 1);
    const controls = find(h.dialog(), 'guaira-region-controls');
    assert.equal(controls.children.length, 1);
    assert.equal(h.primary().textContent, 'VOLTAR AO MAPA');
    assert.equal(h.primary().disabled, false); assert.equal(h.primary().focusCount, 1);
    h.primary().click(); assert.deepEqual(h.calls, []);
    close(); assert.equal(h.dialog().closeCount, 1); assert.equal(h.previous.focusCount, 1);
    assert.equal(JSON.stringify(h.save), before);
});

test('region control distinguishes approach, flight and Serra revisits without changing saves', t => {
    const h = fixture(t); h.save.completed = ['3-5']; const before = JSON.stringify(h.save);
    h.open('2-5');
    assert.equal(h.primary().textContent, 'IR À FÁBRICA');
    assert.equal(h.primary().getAttribute('aria-label'), 'Ir à Fábrica para embarcar');
    h.primary().click(); h.primary().click(); assert.deepEqual(h.calls, ['approach-factory']);
    h.open('3-5');
    assert.equal(h.primary().textContent, 'VOAR PARA GUAÍRA');
    assert.equal(h.primary().getAttribute('aria-label'), 'Voar para Guaíra, saindo da Fábrica');
    h.primary().click(); assert.deepEqual(h.calls, ['approach-factory', 'factory']);
    h.open('4-1');
    assert.equal(h.primary().getAttribute('aria-label'), 'Voar para Guaíra, saindo da Serra');
    h.primary().click(); assert.deepEqual(h.calls, ['approach-factory', 'factory', 'serra']);
    h.open('5-1'); assert.equal(h.primary().textContent, 'IR À SERRA'); h.primary().click();
    assert.equal(h.calls.at(-1), 'approach-serra'); assert.equal(JSON.stringify(h.save), before);
});

test('chapter details start collapsed and retain earned and optional progress, with one current objective', t => {
    const h = fixture(t); h.save.completed = ['3-5']; h.save.guaira.completed = ['guaira-travessia'];
    h.save.guaira.optional.gallery = true; h.save.legacySerraAccess = true;
    const before = JSON.stringify(h.save); h.open('3-5');
    const details = find(h.dialog(), 'guaira-region-details');
    assert.equal(details.tagName, 'details'); assert.equal(details.open, false);
    assert.equal(find(details, 'guaira-region-summary').tagName, 'summary');
    assert.equal(find(details, 'guaira-region-summary').textContent, 'ETAPAS 1/5');
    assert.equal(find(h.dialog(), 'guaira-region-hint').textContent, 'Passagem dos Respiros');
    assert.equal(find(h.dialog(), 'guaira-region-objective').textContent, 'Observe a pressão e atravesse nas janelas secas.');
    const entries = find(details, 'guaira-receipts').children;
    assert.equal(entries.length, 5); assert.equal(entries[0].dataset.complete, 'true');
    assert.equal(entries[0].children[1].textContent, 'Concluída'); assert.equal(entries[1].children[1].textContent, 'Próxima');
    assert.match(details.textContent, /Opcionais: Galeria \(concluída\) e Câmara\./);
    assert.match(details.textContent, /Seu acesso à Serra continua aberto/);
    assert.equal(JSON.stringify(h.save), before);
});

test('completed chapter keeps revisit flight and restored water art without inventing optional wins', t => {
    const h = fixture(t); h.save.completed = ['3-5'];
    h.save.guaira.completed = ['guaira-travessia', 'guaira-respiros', 'guaira-lab', 'guaira-subida', 'guaira-prefeito'];
    h.open('4-1');
    assert.equal(find(h.dialog(), 'guaira-region-status').textContent, 'CONCLUÍDO');
    assert.equal(find(h.dialog(), 'guaira-region-summary').textContent, 'ETAPAS 5/5');
    assert.ok(find(h.dialog(), 'guaira-region-water').src);
    assert.equal(find(h.dialog(), 'guaira-optional-note').textContent, 'Opcionais: Galeria e Câmara.');
    assert.equal(maybeFind(h.dialog(), 'guaira-region-objective'), undefined);
    h.primary().click(); assert.deepEqual(h.calls, ['serra']);
});

test('native cancellation and repeated cleanup restore focus once and cannot trigger a stale flight', t => {
    const h = fixture(t); h.save.completed = ['3-5']; const close = h.open('3-5');
    const cancel = new Event('cancel', { cancelable: true });
    h.dialog().dispatchEvent(cancel); assert.equal(cancel.defaultPrevented, true);
    assert.equal(h.dialog().isConnected, false); assert.equal(h.previous.focusCount, 1);
    close(); h.primary().click(); assert.equal(h.dialog().closeCount, 1); assert.deepEqual(h.calls, []);
    assert.equal(h.dialog().getAttribute('aria-labelledby'), 'guaira-region-title');
    assert.equal(h.dialog().getAttribute('aria-describedby'), 'guaira-region-hint');
});


test('held activation cannot spill from the map into a newly focused dialog action', t => {
    const h = fixture(t); h.save.completed = ['3-5']; h.open('3-5');
    for (const key of ['Enter', ' ', 'Spacebar']) {
        const repeat = new Event('keydown', { cancelable: true }); Object.assign(repeat, { key, repeat: true });
        h.dialog().dispatchEvent(repeat); assert.equal(repeat.defaultPrevented, true);
        const fresh = new Event('keydown', { cancelable: true }); Object.assign(fresh, { key, repeat: false });
        h.dialog().dispatchEvent(fresh); assert.equal(fresh.defaultPrevented, false, 'Fresh native button and summary activation remains available');
    }
    h.primary().click(); assert.deepEqual(h.calls, ['factory']);
});
