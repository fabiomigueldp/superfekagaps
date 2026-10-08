import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { DELICIA_SAVE_KEY, DeliciaStore, freshDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';
import { DeliciaSimulation, type DeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

/** Only the DOM/audio boundary is fake; app event handling and persistence are real. */
class Element extends EventTarget {
    className = ''; dataset = {}; hidden = false; disabled = false; private text = '';
    children: Element[] = []; parent: Element | null = null; attributes = new Map<string, string>();
    constructor(readonly tagName: string) { super(); }
    get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
    set textContent(value: string) { this.updates++; this.text = value; this.replaceChildren(); }
    get classList() { return { add: (name: string) => { this.className += ' ' + name; } }; }
    append(...children: Element[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children: Element[]) { this.children.forEach(child => child.parent = null); this.children = []; this.append(...children); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    getContext() { return null; }
    querySelector(selector:string) {
        const warning=this.all().find(node=>node.className.includes('dl-save-warning'));
        if(selector==='.dl-save-warning')return warning??null;
        if(selector==='.dl-save-warning p')return warning?.children[0]??null;
        return this.all().find(node => node.tagName === 'button') ?? null;
    }
    type=''; value=''; checked=false; updates=0;
    focus() { (document as unknown as {activeElement:Element}).activeElement=this; }
    click() { this.dispatchEvent(new Event('click')); }
    all(): Element[] { return this.children.flatMap(child => [child, ...child.all()]); }
}
interface App {
    store: DeliciaStore; sim: DeliciaSimulation; toast: string; toastTime: number; screen: string;
    panel: Element; status: Element; settingsMessage?: Element;
    step(dt: number, input: DeliciaInput): void; loadStage(id: string, retry?: boolean): boolean;
    clearStage(): void; pause(): void; showEnding(): void; showSettings(): void;
    dialogueDone(): void; announce(message:string):void;
    menu: {choices: {label: string | (() => string); run(): void}[]};
    showControls(): void;
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
        audio: { effect() {}, pause() {}, unlock: async () => {}, music() {}, voice() {}, setVolume() {}, muted: false },
        // HUD painting is independent of save feedback; actual notify/announce/menu rendering execute.
        options: {}, menuEpoch: 0, presentation: {hide() {},menus:{requestFocusFromCanvas() {}}},
        renderGame() {}, updateHud() {}
    }) as App;
    const button = (name: string) => {
        const result = app.panel.all().find(node => node.tagName === 'button' && node.textContent === name);
        assert.ok(result, `Missing ${name} button`); return result;
    };
    return { app, button, storage, fail() { failure='QuotaExceededError'; }, original, get raw() { return raw; }, get writes() { return writes; },
        recover() { failure = 'ok'; }, warning: () => app.panel.all().find(node => node.className.includes('dl-save-warning')) };
}

/** The native settings callbacks execute unchanged; pixel painting is a separate browser check. */
function choose(app:App,label:string) {
    const choice=app.menu.choices.find(item=>(typeof item.label==='function'?item.label():item.label).startsWith(label));
    assert.ok(choice,label);choice.run();
}
test('ordinary native settings saves remain silent and keep canvas focus',t=>{
    const h=fixture(t);h.app.showSettings();const focus=document.activeElement,updates=h.app.status.updates;
    choose(h.app,'MÚSICA');choose(h.app,'MÚSICA');
    assert.equal(new DeliciaStore(h.storage).save.music,h.app.store.save.music);
    assert.equal(h.app.status.textContent,'');assert.equal(h.app.status.updates,updates);
    assert.equal(document.activeElement,focus);
});
test('quota failures are immediate and deduplicated; successful preference save clears its warning',t=>{
    const h=fixture(t);h.app.showSettings();h.fail();choose(h.app,'MÚSICA');
    const message=h.app.store.warning;assert.match(message,/apenas nesta sessão/);
    assert.equal(h.app.status.textContent,message);const updates=h.app.status.updates;
    choose(h.app,'MÚSICA');choose(h.app,'MÚSICA');assert.equal(h.app.status.updates,updates);
    assert.equal(h.raw,h.original);assert.ok(h.app.menu.choices.some(c=>c.label==='REVER PROGRESSO'));
    h.recover();choose(h.app,'MÚSICA');assert.equal(h.app.status.textContent,'');
    assert.equal(h.app.store.warning,'');assert.equal(new DeliciaStore(h.storage).save.music,h.app.store.save.music);
});
test('successful native preference retry clears a pre-existing warning without moving focus',t=>{
    const h=fixture(t,'QuotaExceededError');h.app.store.persist();h.app.showSettings();const focus=document.activeElement;
    choose(h.app,'TREMOR');assert.equal(h.app.status.textContent,h.app.store.warning);
    h.recover();choose(h.app,'TREMOR');assert.equal(h.app.status.textContent,'');
    assert.equal(document.activeElement,focus);assert.equal(new DeliciaStore(h.storage).save.reducedMotion,false);
});
test('parallel-store conflict retains local preferences and assistance without overwriting the durable save',t=>{
    const h=fixture(t);h.app.showSettings();const other=new DeliciaStore(h.storage);
    other.save.completed=['delicia-1'];assert.equal(other.persist(),true);const durable=h.raw;
    choose(h.app,'EFEITOS');assert.match(h.app.status.textContent,/outra aba/);const updates=h.app.status.updates;
    choose(h.app,'EFEITOS');choose(h.app,'EFEITOS');assert.equal(h.app.status.updates,updates);
    h.app.showControls();choose(h.app,'AJUDA');assert.equal(h.app.store.save.assists,true);
    assert.equal(h.raw,durable);assert.equal(new DeliciaStore(h.storage).save.assists,false);
});
test('a later conflict replaces quota feedback and native recovery cannot claim success',t=>{
    const h=fixture(t,'QuotaExceededError');h.app.store.persist();h.app.showSettings();h.recover();
    const other=new DeliciaStore(h.storage);other.save.music=.1;assert.equal(other.persist(),true);const durable=h.raw;
    choose(h.app,'MÚSICA');assert.match(h.app.status.textContent,/outra aba/);
    choose(h.app,'REVER PROGRESSO');choose(h.app,'TENTAR SALVAR');
    assert.equal(h.raw,durable);assert.match(h.app.status.textContent,/outra aba/);
});
test('successful native preference save preserves unrelated feedback; a new failure restores its warning',t=>{
    const h=fixture(t);h.app.showSettings();h.fail();choose(h.app,'MÚSICA');
    h.app.announce('Arquivo inválido. Progresso atual mantido.');h.recover();choose(h.app,'MÚSICA');
    assert.equal(h.app.status.textContent,'Arquivo inválido. Progresso atual mantido.');
    h.fail();choose(h.app,'MÚSICA');assert.equal(h.app.status.textContent,h.app.store.warning);
});
