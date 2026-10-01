/** Entry/controller contract with native EventTarget semantics; this is not browser CSS QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync(new URL('../public/assets/world/experimental/guaira/guaira-diorama.meta.json', import.meta.url), 'utf8'));
const noop = () => {};
const context = new Proxy({ createLinearGradient: () => ({ addColorStop: noop }) }, { get(target, key) { return key in target ? target[key as keyof typeof target] : noop; }, set() { return true; } });
class Element extends EventTarget {
    textContent = ''; hidden = false; disabled = false; title = ''; width = 1; height = 1;
    style: Record<string, string> = {}; attributes: Record<string, string> = {}; children: Element[] = [];
    dataset: Record<string, string> = {}; marker = false; focused = false;
    classList = { contains: (name: string) => name === 'guaira-marker' && this.marker };
    className = '';
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute(key: string, value: string) { this.attributes[key] = value; }
    getBoundingClientRect() { return { width: this.marker ? 116 : 390, height: this.marker ? 44 : 450 }; }
    getContext() { return context; }
    focus() { this.focused = true; }
    click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}
class Media extends EventTarget { matches = false; }
const ids = ['guaira-canvas', 'map-loading', 'map-loading-panel', 'map-status', 'map-enter', 'map-skip', 'map-overview', 'map-exit', 'map-title', 'map-description', 'map-error'];
const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
const destinations = ['town', 'curral', 'town', 'curral'].map((id, i) => { const e = new Element(); e.dataset.mapDestination = id; e.marker = i > 1; return e; });
const scene = new Element(), doc = new EventTarget() as EventTarget & Record<string, unknown>, win = new EventTarget();
let observerDisconnected = 0;
Object.assign(doc, { hidden: false, getElementById: (id: string) => elements[id], querySelector: () => scene, querySelectorAll: () => destinations, createElement: () => new Element() });
const motion = new Media(), queue = new Map<number, FrameRequestCallback>(); let next = 1, clock = 0;
const navigations: string[] = [], replacements: string[] = [];
const locationMock = { href: 'https://example.test/guaira.html?at=rice', search: '?at=rice', assign: (href: string) => navigations.push(href) };
let fetchRaw: unknown = raw;
Object.assign(globalThis, {
    document: doc, window: win, location: locationMock,
    history: { replaceState: (_a: unknown, _b: string, url: URL) => replacements.push(String(url)) },
    matchMedia: () => motion, devicePixelRatio: 1,
    ResizeObserver: class { observe() {} disconnect() { observerDisconnected++; } },
    Image: class { src = ''; naturalWidth = 1920; naturalHeight = 1200; async decode() {} },
    fetch: async () => ({ ok: true, json: async () => fetchRaw }),
    requestAnimationFrame: (callback: FrameRequestCallback) => { const id = next++; queue.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => queue.delete(id),
});
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Map must never touch saves'); } });
const ready = () => new Promise(resolve => setTimeout(resolve, 0));
function frames(count: number) { for (let i = 0; i < count; i++) { clock += 1000 / 60; const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(callback => callback(clock)); } }
function key(name: string) { const event = new Event('keydown', { cancelable: true }); Object.assign(event, { key: name, repeat: false, altKey: false, ctrlKey: false, metaKey: false }); doc.dispatchEvent(event); return event; }

test('actual map entry handles pointer/keyboard selection, arrival, reduced motion, error and lifecycle without saves', async () => {
    const module = await import('../src/guaira'); await ready(); frames(2);
    assert.equal(elements['map-title'].textContent, 'Passarela dos Arrozais');
    assert.equal(elements['map-enter'].disabled, true); assert.equal(elements['map-loading-panel'].hidden, true);
    assert.equal(navigations.length, 0); assert.equal(replacements.length, 0);
    assert.equal(key('ArrowRight').defaultPrevented, true); frames(2);
    assert.equal(elements['map-title'].textContent, 'Curral da Comporta'); assert.equal(elements['map-enter'].disabled, true);
    elements['map-enter'].dispatchEvent(new Event('click')); assert.equal(navigations.length, 0, 'even synthetic early Enter cannot navigate');
    destinations[0].click(); frames(1); destinations[1].click(); frames(1);
    elements['map-skip'].click(); frames(2); assert.equal(elements['map-enter'].disabled, false);
    assert.equal(elements['map-enter'].focused, true); assert.match(replacements.at(-1)!, /at=corral/);
    elements['map-enter'].click(); assert.deepEqual(navigations, ['./guaira-lab.html']);
    win.dispatchEvent(new Event('pagehide')); assert.equal(queue.size, 0); assert.equal(observerDisconnected, 1);
    const before = replacements.length; destinations[0].click(); frames(2); assert.equal(replacements.length, before);
    // A bfcache restoration creates a fresh controller and listeners, not a closed actor.
    motion.matches = true;
    const pageShow = new Event('pageshow'); Object.assign(pageShow, { persisted: true }); win.dispatchEvent(pageShow);
    await ready(); frames(2); destinations[0].click(); frames(1);
    assert.equal(elements['map-enter'].disabled, false); assert.equal(elements['map-skip'].hidden, true);
    elements['map-enter'].click(); assert.deepEqual(navigations, ['./guaira-lab.html', './guaira-travessia.html']);
    win.dispatchEvent(new Event('pagehide'));
    fetchRaw = {}; const dispose = module.startGuairaMap(); await ready(); frames(1);
    assert.equal(elements['map-error'].hidden, false); assert.equal(elements['map-loading-panel'].hidden, true);
    assert.equal(elements['map-enter'].hidden, true); assert.equal(elements['map-overview'].disabled, true);
    assert.ok(destinations.every(button => button.hidden)); dispose();
});
