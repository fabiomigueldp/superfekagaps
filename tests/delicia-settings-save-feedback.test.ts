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
        updateHud() {}
    }) as App;
    const button = (name: string) => {
        const result = app.panel.all().find(node => node.tagName === 'button' && node.textContent === name);
        assert.ok(result, `Missing ${name} button`); return result;
    };
    return { app, button, storage, fail() { failure='QuotaExceededError'; }, original, get raw() { return raw; }, get writes() { return writes; },
        recover() { failure = 'ok'; }, warning: () => app.panel.all().find(node => node.className.includes('dl-save-warning')) };
}
function control(app:App,type:string,index=0) {
    const node=app.panel.all().filter(node=>node.tagName==='input'&&node.type===type)[index];
    assert.ok(node);node.focus();return node;
}
function slide(node:Element,value:string) {node.value=value;node.dispatchEvent(new Event('input'));}
function toggle(node:Element) {node.checked=!node.checked;node.dispatchEvent(new Event('change'));}

test('ordinary settings saves remain silent and retain slider focus and output',t=>{
    const h=fixture(t);h.app.showSettings();const range=control(h.app,'range'),updates=h.app.settingsMessage!.updates;
    slide(range,'.3');slide(range,'.5');
    assert.equal(h.app.store.save.music,.5);assert.equal(new DeliciaStore(h.storage).save.music,.5);
    assert.equal(h.app.settingsMessage!.textContent,'');assert.equal(h.app.settingsMessage!.updates,updates);
    assert.equal(document.activeElement,range);assert.equal(h.warning(),undefined);
    assert.equal((range.parent!.children.find(node=>node.tagName==='output')!).value,'50%');
});

test('quota failures are immediate, deduplicated, and cleared by the next successful slider save',t=>{
    const h=fixture(t);h.app.showSettings();h.fail();const range=control(h.app,'range');
    slide(range,'.2');const message=h.app.store.warning;assert.match(message,/apenas nesta sessão/);
    assert.equal(h.app.settingsMessage!.textContent,message);assert.equal(h.app.status.textContent,'');
    const updates=h.app.settingsMessage!.updates;slide(range,'.4');slide(range,'.6');
    assert.equal(h.app.settingsMessage!.updates,updates);assert.equal(document.activeElement,range);
    assert.equal(h.raw,h.original);assert.equal(h.app.store.save.music,.6);
    h.recover();slide(range,'.8');assert.equal(h.app.settingsMessage!.textContent,'');
    assert.equal(h.app.store.warning,'');assert.equal(new DeliciaStore(h.storage).save.music,.8);
    assert.equal(document.activeElement,range);
    h.fail();slide(range,'.9');assert.equal(h.app.settingsMessage!.textContent,message);
});

test('successful preference retry removes a pre-existing recovery warning without moving focus',t=>{
    const h=fixture(t,'QuotaExceededError');h.app.store.persist();h.app.showSettings();
    assert.ok(h.warning());h.button('Exportar cópia');h.button('Tentar salvar');
    const input=control(h.app,'checkbox',1);toggle(input);assert.equal(h.app.settingsMessage!.textContent,h.app.store.warning);
    h.recover();toggle(input);assert.equal(h.warning(),undefined);assert.equal(h.app.settingsMessage!.textContent,'');
    assert.equal(document.activeElement,input);h.button('Exportar');h.button('Importar');
    assert.equal(new DeliciaStore(h.storage).save.reducedMotion,false);
});

test('parallel-store conflict appears on the first preference edit and retains local values without overwriting',t=>{
    const h=fixture(t);h.app.showSettings();const other=new DeliciaStore(h.storage);
    other.save.completed=['delicia-1'];assert.equal(other.persist(),true);const durable=h.raw;
    const range=control(h.app,'range',1);slide(range,'.2');
    assert.match(h.app.settingsMessage!.textContent,/outra aba/);const updates=h.app.settingsMessage!.updates;
    slide(range,'.3');slide(range,'.4');assert.equal(h.app.settingsMessage!.updates,updates);
    assert.equal(document.activeElement,range);assert.equal(h.app.store.save.effects,.4);assert.equal(h.raw,durable);
    const input=control(h.app,'checkbox',2);toggle(input);assert.equal(h.app.store.save.assists,true);
    assert.equal(h.app.settingsMessage!.updates,updates);assert.equal(document.activeElement,input);
    assert.equal(h.raw,durable);assert.equal(new DeliciaStore(h.storage).save.assists,false);
});

test('a later conflict replaces an existing quota warning and retry cannot claim success',t=>{
    const h=fixture(t,'QuotaExceededError');h.app.store.persist();h.app.showSettings();h.recover();
    const other=new DeliciaStore(h.storage);other.save.music=.1;assert.equal(other.persist(),true);const durable=h.raw;
    const range=control(h.app,'range');slide(range,'.8');
    assert.match(h.warning()!.children[0].textContent,/outra aba/);
    assert.equal(h.app.settingsMessage!.textContent,h.app.store.warning);h.button('Tentar salvar').click();
    assert.equal(h.raw,durable);assert.match(h.app.settingsMessage!.textContent,/outra aba/);
});

test('preference success preserves unrelated status and a subsequent failure restores its warning',t=>{
    const h=fixture(t);h.app.showSettings();h.fail();const range=control(h.app,'range');slide(range,'.2');
    h.app.announce('Arquivo inválido. Progresso atual mantido.');h.recover();slide(range,'.3');
    assert.equal(h.app.settingsMessage!.textContent,'Arquivo inválido. Progresso atual mantido.');
    h.fail();slide(range,'.4');assert.equal(h.app.settingsMessage!.textContent,h.app.store.warning);
});
