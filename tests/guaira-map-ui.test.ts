/** Entry/controller contract with native EventTarget semantics; this is not browser CSS QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUAIRA_WATER_CONTRACT } from '../src/adventure/experimental/guaira/GuairaWaterMotion';
const raw = JSON.parse(readFileSync(new URL('../public/assets/world/experimental/guaira/guaira-diorama.meta.json', import.meta.url), 'utf8'));
const noop = () => {};
let basePaints = 0, markerReads = 0, regionClips = 0, sceneWidth = 390, sceneHeight = 450;
const context = new Proxy({ createLinearGradient: () => ({ addColorStop: noop }),
    drawImage: (image: { src?: string }) => { if (image.src?.endsWith('guaira-diorama.webp')) basePaints++; },
    clip: () => { regionClips++; },
}, { get(target, key) { return key in target ? target[key as keyof typeof target] : noop; }, set() { return true; } });
class Element extends EventTarget {
    textContent = ''; private isHidden = false;
    get hidden() { return this.isHidden; }
    set hidden(value: boolean) {
        this.isHidden = value;
        if (value && typeof doc !== 'undefined' && doc.activeElement === this) doc.activeElement = doc.body;
    }
    disabled = false; title = ''; width = 1; height = 1;
    style: Record<string, string> = {}; attributes: Record<string, string> = {}; children: Element[] = [];
    dataset: Record<string, string> = {}; marker = false; focused = false;
    classList = { contains: (name: string) => name === 'guaira-marker' && this.marker };
    className = ''; open = false; lastClick?: EventListener;
    override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        super.addEventListener(type, listener, options);
        if (type === 'click' && typeof listener === 'function') this.lastClick = listener;
    }
    showModal() { this.open = true; }
    close() { if (!this.open) return; this.open = false; this.dispatchEvent(new Event('close')); }
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute(key: string, value: string) { this.attributes[key] = value; }
    getBoundingClientRect() { if (this.marker) markerReads++; return { width: this.marker ? this.hidden ? 0 : (this.children.at(-2)?.width ?? 116) : sceneWidth, height: this.marker ? 44 : sceneHeight }; }
    getContext() { return context; }
    focus() { this.focused = true; doc.activeElement = this; doc.dispatchEvent(Object.defineProperty(new Event('focusin'), 'target', { value: this })); }
    click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}
class Media extends EventTarget { matches = false; }
const ids = ['guaira-canvas', 'map-loading', 'map-loading-panel', 'map-status', 'map-enter', 'map-skip', 'map-return', 'map-overview', 'map-exit', 'map-chapter', 'map-title', 'map-description', 'map-error', 'map-detours', 'map-detour-patio', 'map-detour-bairro', 'map-detours-close'];
const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
const destinations = ['town', 'curral', 'subida', 'town', 'curral', 'bairro'].map((id, i) => { const e = new Element(); e.dataset.mapDestination = id; e.marker = i > 2; return e; });
const scene = new Element(), doc = new EventTarget() as EventTarget & Record<string, unknown>, win = new EventTarget();
let observerDisconnected = 0;
Object.assign(doc, { hidden: false, body: new Element(), documentElement: new Element(), getElementById: (id: string) => elements[id], querySelector: () => scene, querySelectorAll: () => destinations, createElement: () => new Element() });
const motion = new Media(), compactMarkers = new Media(), queue = new Map<number, FrameRequestCallback>(); let next = 1, clock = 0;
const navigations: string[] = [], replacements: string[] = [];
const locationMock = { href: 'https://example.test/guaira.html?at=rice', search: '?at=rice', assign: (href: string) => navigations.push(href) };
let fetchRaw: unknown = raw;
let imageReady: Promise<void> = Promise.resolve();
let waterReady: Promise<void> = Promise.resolve(), waterFailure = true;
Object.assign(globalThis, {
    document: doc, window: win, location: locationMock,
    history: { replaceState: (_a: unknown, _b: string, url: URL) => replacements.push(String(url)) },
    matchMedia: (query: string) => query.includes('prefers-reduced-motion') ? motion : compactMarkers, devicePixelRatio: 1,
    ResizeObserver: class { observe() {} disconnect() { observerDisconnected++; } },
    Image: class {
        src = '';
        get naturalWidth() { return this.src.endsWith('guaira-water-mask.png') ? GUAIRA_WATER_CONTRACT.atlasSize[0] : 1920; }
        get naturalHeight() { return this.src.endsWith('guaira-water-mask.png') ? GUAIRA_WATER_CONTRACT.atlasSize[1] : 1200; }
        async decode() {
            if (this.src.endsWith('guaira-water-mask.png')) { await waterReady; if (waterFailure) throw new Error('Optional mask unavailable'); }
            else await imageReady;
        }
    },
    fetch: async () => ({ ok: true, json: async () => fetchRaw }),
    requestAnimationFrame: (callback: FrameRequestCallback) => { const id = next++; queue.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => queue.delete(id),
});
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Map must never touch saves'); } });
const ready = () => new Promise(resolve => setTimeout(resolve, 0));
function frames(count: number) { for (let i = 0; i < count; i++) { clock += 1000 / 60; const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(callback => callback(clock)); } }
function key(name: string) { const event = new Event('keydown', { cancelable: true }); Object.assign(event, { key: name, repeat: false, altKey: false, ctrlKey: false, metaKey: false }); doc.dispatchEvent(event); return event; }

test('actual map entry handles pending loading, selection, arrival, reduced motion, error and lifecycle without saves', async () => {
    let finishImage!: () => void;
    imageReady = new Promise(resolve => { finishImage = resolve; });
    const module = await import('../src/guaira'); await ready();
    assert.equal(elements['map-loading-panel'].hidden, false);
    assert.ok(destinations.every(button => button.children[0]?.height === 44),
        'Loading plates must never expand to a default 300×150 canvas');
    assert.ok(destinations.every(button => button.disabled));
    assert.equal(elements['map-return'].hidden, true); assert.equal(elements['map-return'].disabled, true);
    finishImage(); await ready(); frames(2);
    assert.equal(elements['map-title'].textContent, 'Passarela dos Arrozais');
    assert.equal(elements['map-enter'].disabled, false); assert.equal(elements['map-loading-panel'].hidden, true);
    assert.equal(elements['map-return'].hidden, false);
    assert.equal(elements['map-return'].attributes['aria-label'], 'Passagem dos Respiros: explorar a irrigação, percurso opcional');
    assert.equal(navigations.length, 0); assert.equal(replacements.length, 0);
    assert.equal(elements['map-enter'].attributes['aria-label'], 'Caminhar até o Curral da Comporta');
    elements['map-enter'].click();
    assert.equal(elements['map-title'].textContent, 'Curral da Comporta');
    assert.equal(elements['map-enter'].disabled, true);
    assert.equal(navigations.length, 0, 'contextual continuation walks before entering');
    elements['map-return'].dispatchEvent(new Event('click'));
    assert.equal(navigations.length, 0, 'a stale optional entry cannot survive departure');
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
    motion.matches = false; locationMock.search = '?at=vazao'; locationMock.href = 'https://example.test/guaira.html?at=vazao';
    const beforeHouse = replacements.length;
    win.dispatchEvent(pageShow); await ready(); frames(2);
    assert.equal(elements['map-title'].textContent, 'Casa da Vazão');
    assert.equal(elements['map-enter'].disabled, false); assert.equal(elements['map-skip'].hidden, true);
    assert.equal(elements['map-enter'].attributes['aria-label'], 'Enfrentar o Prefeito: experimento opcional na Casa da Vazão');
    assert.equal(elements['map-return'].hidden, false); assert.equal(elements['map-return'].disabled, false);
    assert.equal(elements['map-return'].attributes['aria-label'], 'Voltar ao curral pela estrada');
    assert.equal(replacements.length, beforeHouse, 'contextual house arrival must not rewrite its location');
    assert.ok(destinations.every(button => button.attributes['aria-pressed'] === 'false'));
    assert.equal(navigations.length, 2, 'Casa never auto-enters, including cached loading');
    elements['map-return'].click();
    assert.equal(destinations[1].focused, true, 'focus moves off the contextual control when it disappears');
    assert.equal(elements['map-return'].hidden, true); assert.equal(elements['map-enter'].disabled, true);
    elements['map-enter'].dispatchEvent(new Event('click')); assert.equal(navigations.length, 2, 'departure closes entry before any animation frame');
    assert.equal(key('ArrowUp').defaultPrevented, true);
    elements['map-return'].dispatchEvent(new Event('click'));
    assert.equal(elements['map-enter'].attributes['aria-label'], 'Entrar: Subida à Casa', 'stale return cannot override a newer selection');
    frames(1);
    assert.equal(elements['map-title'].textContent, 'Subida à Casa');
    assert.equal(elements['map-enter'].disabled, true); assert.equal(elements['map-skip'].hidden, false);
    elements['map-enter'].dispatchEvent(new Event('click')); assert.equal(navigations.length, 2);
    elements['map-skip'].click(); frames(2);
    assert.equal(elements['map-enter'].disabled, false); assert.match(replacements.at(-1)!, /at=corral/);
    assert.equal(elements['map-enter'].attributes['aria-label'], 'Entrar: Subida à Casa');
    destinations[1].click(); frames(1);
    assert.equal(elements['map-enter'].disabled, false, 'arena shares the already reached curral node');
    assert.equal(elements['map-enter'].attributes['aria-label'], 'Entrar: Curral da Comporta');
    destinations[2].click(); frames(1);
    assert.equal(elements['map-enter'].disabled, false); assert.equal(elements['map-skip'].hidden, true);
    assert.equal(destinations[1].attributes['aria-pressed'], 'false');
    assert.equal(destinations[2].attributes['aria-pressed'], 'true');
    assert.equal(navigations.length, 2, 'switching experiences at the same node never enters automatically');
    elements['map-enter'].click(); assert.equal(navigations.at(-1), './guaira-subida.html');
    win.dispatchEvent(new Event('pagehide'));
    // A full reload and a bfcache return to Casa expose the same explicit action.
    const beforeMayor = navigations.length;
    const disposeReload = module.startGuairaMap(); await ready(); frames(2);
    assert.equal(elements['map-return'].hidden, false); assert.equal(navigations.length, beforeMayor);
    elements['map-enter'].click(); assert.equal(navigations.at(-1), './guaira-prefeito.html');
    elements['map-enter'].dispatchEvent(new Event('click')); elements['map-return'].dispatchEvent(new Event('click'));
    assert.equal(navigations.length, beforeMayor + 1, 'closing prevents repeated context navigation');
    assert.equal(elements['map-enter'].disabled, true); assert.equal(elements['map-return'].hidden, true);
    disposeReload();
    motion.matches = true; win.dispatchEvent(pageShow); await ready(); frames(2);
    assert.equal(elements['map-enter'].disabled, false);
    elements['map-return'].click(); frames(1);
    assert.equal(elements['map-skip'].hidden, true); assert.equal(elements['map-return'].hidden, true);
    assert.equal(elements['map-enter'].attributes['aria-label'], 'Entrar: Curral da Comporta');
    assert.equal(navigations.length, beforeMayor + 1, 'reduced-motion return never auto-enters the arena');
    win.dispatchEvent(new Event('pagehide')); motion.matches = false;
    fetchRaw = {}; const dispose = module.startGuairaMap(); await ready(); frames(1);
    assert.equal(elements['map-error'].hidden, false); assert.equal(elements['map-loading-panel'].hidden, true);
    assert.equal(elements['map-enter'].hidden, true); assert.equal(elements['map-overview'].disabled, true);
    assert.equal(elements['map-return'].hidden, true);
    assert.ok(destinations.every(button => button.hidden)); dispose();
});

test('loading and failure markup retain direct links to every isolated experiment', () => {
    const html = readFileSync(new URL('../guaira.html', import.meta.url), 'utf8');
    for (const href of ['./guaira-travessia.html', './guaira-lab.html', './guaira-subida.html', './guaira-prefeito.html', './guaira-patio.html', './guaira-respiros.html', './guaira-galeria.html']) {
        assert.equal(html.split(`href="${href}"`).length - 1, 2, `${href} is available during loading and failure`);
    }
    assert.match(html, /id="destination-subida"[^>]*data-map-destination="subida"/);
    assert.equal((html.match(/id="destination-/g) ?? []).length, 3, 'no fourth global destination');
    assert.match(html, /id="map-return"[^>]*hidden disabled/);
    assert.match(html, /id="map-enter"[^>]*aria-describedby="map-description map-status"/);
});

test('town keeps Patio in the Desvios menu, separate from the primary traversal, and validates live entry', async () => {
    const module = await import('../src/guaira');
    fetchRaw = raw; imageReady = Promise.resolve(); waterReady = Promise.resolve(); waterFailure = true;
    motion.matches = false; doc.hidden = false;
    locationMock.search = '?at=town'; locationMock.href = 'https://example.test/guaira.html?at=town';
    const dispose = module.startGuairaMap(); await ready(); frames(2);
    assert.equal(elements['map-enter'].attributes['aria-label'], 'Entrar: Estrada do Vento');
    assert.equal(elements['map-return'].hidden, false);
    assert.equal(elements['map-return'].attributes['aria-label'], 'Desvios: entrar no Pátio ou caminhar ao Bairro da Vala Seca');
    const before = navigations.length;
    destinations[1].click();
    assert.equal(elements['map-return'].hidden, true); assert.equal(elements['map-return'].disabled, true);
    elements['map-return'].dispatchEvent(new Event('click')); assert.equal(navigations.length, before);
    frames(2); destinations[0].click(); elements['map-skip'].click();
    assert.equal(elements['map-return'].disabled, false);
    elements['map-return'].click(); assert.equal(elements['map-detours'].open, true);
    assert.equal(navigations.length, before); elements['map-detour-patio'].click(); assert.equal(navigations.at(-1), './guaira-patio.html');
    elements['map-return'].dispatchEvent(new Event('click'));
    elements['map-enter'].dispatchEvent(new Event('click'));
    assert.equal(navigations.length, before + 1, 'closing guards both the primary and optional entries');
    dispose();
});

test('rice offers optional Respiros while Curral still walks, and checks late activations', async () => {
    const module = await import('../src/guaira');
    fetchRaw = raw; imageReady = Promise.resolve(); waterReady = Promise.resolve(); waterFailure = true;
    motion.matches = false; doc.hidden = false;
    locationMock.search = '?at=rice&visit=respiros-clear';
    locationMock.href = 'https://example.test/guaira.html?at=rice&visit=respiros-clear';
    const dispose = module.startGuairaMap(); await ready(); frames(2);
    assert.equal(elements['map-enter'].attributes['aria-label'], 'Caminhar até o Curral da Comporta');
    assert.equal(elements['map-return'].hidden, false);
    assert.match(elements['map-return'].attributes['aria-label'], /Respiros.*opcional/);
    assert.match(elements['map-status'].textContent, /Respiros concluída nesta visita/);
    const before = navigations.length;
    elements['map-return'].click(); assert.equal(navigations.at(-1), './guaira-respiros.html');
    assert.equal(elements['map-return'].hidden, true); assert.equal(elements['map-enter'].disabled, true);
    elements['map-return'].dispatchEvent(new Event('click')); elements['map-enter'].dispatchEvent(new Event('click'));
    assert.equal(navigations.length, before + 1, 'closed model rejects duplicate optional and primary actions');
    dispose();
    const retry = module.startGuairaMap(); await ready(); frames(2);
    elements['map-enter'].click();
    assert.equal(elements['map-return'].hidden, true); assert.equal(elements['map-return'].disabled, true);
    elements['map-return'].dispatchEvent(new Event('click'));
    assert.equal(navigations.length, before + 1, 'choosing Curral closes optional entry immediately');
    assert.equal(elements['map-title'].textContent, 'Curral da Comporta');
    assert.equal(elements['map-enter'].disabled, true);
    retry();
});

test('water repaints regions at30Hz without idle marker layout, freezes when hidden/reduced, and ignores late disposal', async () => {
    const module = await import('../src/guaira');
    fetchRaw = raw; imageReady = Promise.resolve(); waterReady = Promise.resolve(); waterFailure = false;
    locationMock.search = '?at=town'; locationMock.href = 'https://example.test/guaira.html?at=town';
    motion.matches = false; doc.hidden = false;
    const dispose = module.startGuairaMap(); await ready(); frames(2);
    assert.equal(elements['map-error'].hidden, true); assert.equal(queue.size, 1);
    const paintsBefore = basePaints, readsBefore = markerReads, clipsBefore = regionClips;
    frames(60);
    assert.ok(basePaints - paintsBefore >= 29 && basePaints - paintsBefore <= 31, 'stationary decoration is capped at30Hz');
    assert.equal(markerReads, readsBefore, 'idle water never triggers marker layout reads');
    assert.ok(regionClips > clipsBefore, 'stationary map restores the clipped water regions');
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    const hiddenPaints = basePaints; frames(600); assert.equal(basePaints, hiddenPaints); assert.equal(queue.size, 0);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); frames(1);
    assert.equal(basePaints, hiddenPaints, 'first visible frame keeps the same water phase');
    frames(3); assert.ok(basePaints > hiddenPaints);
    motion.matches = true; motion.dispatchEvent(new Event('change')); frames(2);
    const reducedPaints = basePaints; frames(60); assert.equal(basePaints, reducedPaints); assert.equal(queue.size, 0);
    motion.matches = false; motion.dispatchEvent(new Event('change')); frames(3); assert.equal(queue.size, 1);
    dispose(); assert.equal(queue.size, 0);
    let finishWater!: () => void; waterReady = new Promise(resolve => { finishWater = resolve; });
    const disposePending = module.startGuairaMap(); await ready(); frames(2);
    assert.equal(elements['map-error'].hidden, true, 'decoration does not delay the scene');
    disposePending(); finishWater(); await ready(); frames(2); assert.equal(queue.size, 0, 'late decoration cannot restart a disposed controller');
    waterFailure = true; waterReady = Promise.resolve();
    const disposeFailure = module.startGuairaMap(); await ready(); frames(2);
    assert.equal(elements['map-error'].hidden, true); assert.equal(elements['map-enter'].disabled, false);
    assert.equal(queue.size, 0, 'missing decoration retains the original static-map lifecycle'); disposeFailure();
});

test('return summaries survive reload but clear synchronously on a new choice without automatic entry', async () => {
    const module = await import('../src/guaira');
    fetchRaw = raw; imageReady = Promise.resolve(); waterReady = Promise.resolve(); waterFailure = true;
    motion.matches = false; doc.hidden = false;
    const originalReplace = history.replaceState;
    history.replaceState = (_state: unknown, _title: string, href?: string | URL | null) => {
        if (href) { const url = new URL(String(href)); locationMock.href = url.href; locationMock.search = url.search; replacements.push(url.href); }
    };
    const open = async (search: string) => {
        locationMock.search = search; locationMock.href = `https://example.test/guaira.html${search}`;
        const dispose = module.startGuairaMap(); await ready(); frames(2); return dispose;
    };
    try {
        let dispose = await open('?at=rice&visit=traversal-clear');
        assert.match(elements['map-status'].textContent, /Travessia concluída/);
        assert.equal(elements['map-enter'].attributes['aria-label'], 'Caminhar até o Curral da Comporta');
        const before = navigations.length;
        elements['map-enter'].click();
        assert.equal(navigations.length, before); assert.equal(elements['map-enter'].disabled, true);
        assert.equal(new URL(locationMock.href).searchParams.has('visit'), false);
        assert.doesNotMatch(elements['map-status'].textContent, /concluída/);
        elements['map-enter'].dispatchEvent(new Event('click')); assert.equal(navigations.length, before);
        dispose();

        dispose = await open('?at=corral&visit=bull-clear');
        assert.match(elements['map-status'].textContent, /Ossabravo descansou/);
        assert.equal(elements['map-title'].textContent, 'Subida à Casa');
        assert.equal(elements['map-enter'].disabled, false);
        assert.equal(navigations.length, before, 'a result suggests the next step without launching it');
        dispose();
        dispose = await open(locationMock.search);
        assert.match(elements['map-status'].textContent, /Ossabravo descansou/, 'reload keeps the current visit summary');
        destinations[1].click();
        assert.equal(elements['map-title'].textContent, 'Curral da Comporta');
        assert.equal(new URL(locationMock.href).searchParams.has('visit'), false);
        assert.doesNotMatch(elements['map-status'].textContent, /descansou/);
        dispose();

        dispose = await open('?at=vazao&visit=ascent-clear');
        assert.match(elements['map-status'].textContent, /Subida concluída/);
        assert.match(elements['map-status'].textContent, /Prefeito/); dispose();
        dispose = await open('?at=vazao&visit=mayor-clear');
        assert.match(elements['map-status'].textContent, /Vitória nesta visita/);
        assert.match(elements['map-enter'].attributes['aria-label'], /Repetir/);
        elements['map-return'].click();
        assert.equal(new URL(locationMock.href).searchParams.has('visit'), false);
        assert.doesNotMatch(elements['map-status'].textContent, /Vitória/);
        elements['map-enter'].dispatchEvent(new Event('click')); assert.equal(navigations.length, before);
        dispose();

        dispose = await open('?at=rice&visit=mayor-clear');
        assert.doesNotMatch(elements['map-status'].textContent, /Vitória|concluída/);
        motion.matches = true; motion.dispatchEvent(new Event('change'));
        elements['map-enter'].click();
        assert.equal(navigations.length, before, 'reduced motion arrives but does not enter on the walk action');
        assert.equal(elements['map-title'].textContent, 'Curral da Comporta');
        assert.equal(elements['map-enter'].disabled, false);
        elements['map-enter'].click(); assert.equal(navigations.at(-1), './guaira-lab.html');
        elements['map-enter'].dispatchEvent(new Event('click')); assert.equal(navigations.length, before + 1);
        dispose();

        dispose = await open('?at=corral&at=vazao&visit=bull-clear');
        assert.equal(elements['map-title'].textContent, 'Curral da Comporta');
        assert.equal(new URL(locationMock.href).searchParams.has('visit'), false,
            'canonicalizing duplicate arrivals cannot turn a rejected summary into an accepted one');
        dispose(); dispose = await open(locationMock.search);
        assert.equal(elements['map-title'].textContent, 'Curral da Comporta');
        assert.doesNotMatch(elements['map-status'].textContent, /descansou/); dispose();
    } finally { history.replaceState = originalReplace; motion.matches = false; win.dispatchEvent(new Event('pagehide')); }
});


test('native detours suspend the map, preserve arrows, dismiss with focus, and reject old sessions and presses', async () => {
    const module = await import('../src/guaira');
    fetchRaw = raw; imageReady = Promise.resolve(); waterReady = Promise.resolve(); waterFailure = false;
    motion.matches = false; doc.hidden = false;
    locationMock.search = '?at=town'; locationMock.href = 'https://example.test/guaira.html?at=town';
    const dispose = module.startGuairaMap(); await ready(); frames(2);
    const before = navigations.length, beforeTitle = elements['map-title'].textContent;
    const open = () => { elements['map-return'].click(); assert.equal(elements['map-detours'].open, true); };
    open();
    const oldPatio = elements['map-detour-patio'].lastClick!, oldBairro = elements['map-detour-bairro'].lastClick!;
    assert.equal(doc.activeElement, elements['map-detour-patio']);
    assert.equal(elements['map-return'].attributes['aria-expanded'], 'true');
    const frozen = basePaints;
    for (const arrow of ['ArrowLeft', 'ArrowRight', 'ArrowUp']) assert.equal(key(arrow).defaultPrevented, false);
    destinations[1].dispatchEvent(new Event('click')); elements['map-skip'].dispatchEvent(new Event('click'));
    elements['map-enter'].dispatchEvent(new Event('click')); elements['map-overview'].dispatchEvent(new Event('click'));
    frames(600);
    assert.equal(queue.size, 0); assert.equal(basePaints, frozen); assert.equal(elements['map-title'].textContent, beforeTitle);
    assert.equal(navigations.length, before);
    const cancel = new Event('cancel', { cancelable: true }); elements['map-detours'].dispatchEvent(cancel);
    assert.equal(cancel.defaultPrevented, true); assert.equal(elements['map-detours'].open, false);
    assert.equal(elements['map-return'].attributes['aria-expanded'], 'false');
    assert.equal(doc.activeElement, elements['map-return']);
    frames(1); assert.equal(basePaints, frozen, 'modal close resumes water at the same phase'); frames(3); assert.ok(basePaints > frozen);
    oldPatio(new Event('click')); oldBairro(new Event('click')); assert.equal(navigations.length, before);
    open();
    oldPatio(new Event('click')); oldBairro(new Event('click'));
    assert.equal(elements['map-detours'].open, true); assert.equal(navigations.length, before);
    const queuedBairro = elements['map-detour-bairro'].lastClick!;
    elements['map-detour-bairro'].dispatchEvent(new Event('pointerdown'));
    elements['map-detours-close'].click(); open();
    queuedBairro(new Event('click')); assert.equal(elements['map-detours'].open, true);
    // A late native click from the previous press must not activate the new menu binding.
    elements['map-detour-bairro'].click(); assert.equal(elements['map-detours'].open, true);
    compactMarkers.matches = true; compactMarkers.dispatchEvent(new Event('change'));
    const beforeCompactFrames = basePaints; frames(60);
    assert.equal(basePaints, beforeCompactFrames); assert.equal(queue.size, 0);
    elements['map-detours-close'].click(); assert.equal(elements['map-detours'].open, false, 'crossing the breakpoint preserves the modal close action');
    open(); compactMarkers.matches = false; compactMarkers.dispatchEvent(new Event('change'));
    const beforeExpandFrames = basePaints; frames(60);
    assert.equal(basePaints, beforeExpandFrames); assert.equal(queue.size, 0);
    elements['map-detour-bairro'].dispatchEvent(new Event('pointerdown'));
    elements['map-detour-bairro'].click();
    assert.equal(elements['map-detours'].open, false); assert.equal(elements['map-title'].textContent, 'Bairro da Vala Seca');
    assert.equal(elements['map-enter'].disabled, true); assert.equal(elements['map-skip'].hidden, false);
    assert.equal(navigations.length, before); assert.equal(doc.activeElement, elements['map-skip']);
    elements['map-enter'].dispatchEvent(new Event('click')); assert.equal(navigations.length, before);
    frames(240);
    assert.equal(elements['map-enter'].disabled, false);
    assert.match(elements['map-enter'].attributes['aria-label'], /Galeria/);
    assert.match(replacements.at(-1)!, /at=bairro/); assert.doesNotMatch(replacements.at(-1)!, /visit=/);
    assert.equal(navigations.length, before, 'real arrival still requires explicit entry');
    const repeatEnter = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Enter', repeat: true });
    elements['map-enter'].dispatchEvent(repeatEnter);
    assert.equal(repeatEnter.defaultPrevented, true, 'held Enter cannot activate a newly focused entry');
    elements['map-enter'].click(); elements['map-enter'].dispatchEvent(new Event('click'));
    assert.equal(navigations.length, before + 1); assert.equal(navigations.at(-1), './guaira-galeria.html');
    dispose(); waterFailure = true;
});

test('detour callbacks cannot survive hide, disposal, same-state reselection, or reduced-motion arrival', async () => {
    const module = await import('../src/guaira');
    fetchRaw = raw; imageReady = Promise.resolve(); waterReady = Promise.resolve(); waterFailure = true;
    motion.matches = false; doc.hidden = false;
    locationMock.search = '?at=town'; locationMock.href = 'https://example.test/guaira.html?at=town';
    let dispose = module.startGuairaMap(); await ready(); frames(2);
    const before = navigations.length, staleOpen = elements['map-return'].lastClick!;
    destinations[0].click(); staleOpen(new Event('click')); assert.equal(elements['map-detours'].open, false);
    elements['map-return'].click(); const stalePatio = elements['map-detour-patio'].lastClick!;
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(elements['map-detours'].open, false); assert.equal(queue.size, 0);
    stalePatio(new Event('click')); assert.equal(navigations.length, before);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); frames(2);
    assert.equal(doc.activeElement, elements['map-return'], 'showing a dismissed modal restores its live opener after re-enabling it');
    elements['map-return'].click(); stalePatio(new Event('click')); assert.equal(navigations.length, before);
    const disposedPatio = elements['map-detour-patio'].lastClick!; dispose();
    disposedPatio(new Event('click')); assert.equal(navigations.length, before); assert.equal(queue.size, 0);
    motion.matches = true; dispose = module.startGuairaMap(); await ready(); frames(2);
    elements['map-return'].click(); elements['map-detour-bairro'].click();
    assert.equal(elements['map-title'].textContent, 'Bairro da Vala Seca'); assert.equal(elements['map-enter'].disabled, false);
    assert.equal(elements['map-skip'].hidden, true); assert.equal(navigations.length, before);
    const oldGallery = elements['map-enter'].lastClick!;
    elements['map-enter'].dispatchEvent(new Event('pointerdown'));
    destinations[0].click(); destinations[5].hidden = false; destinations[5].click();
    oldGallery(new Event('click')); assert.equal(navigations.length, before, 'retained callback cannot enter after a round trip');
    elements['map-enter'].click(); assert.equal(navigations.length, before, 'late native press cannot enter a newer arrival');
    elements['map-enter'].click(); assert.equal(navigations.length, before + 1);
    dispose(); motion.matches = false;
});

test('the optional neighborhood marker keeps its authored anchor and hides instead of overlapping', async () => {
    const module = await import('../src/guaira');
    const { guairaCamera, guairaScreenPoint } = await import('../src/adventure/experimental/guaira/GuairaMapArt');
    const { parseGuairaMetadata } = await import('../src/adventure/experimental/guaira/GuairaMapModel');
    const fits = module.guairaBairroMarkerFits;
    const rect = { left: 100, top: 60, width: 82, height: 44 };
    assert.equal(fits(rect, 320, 200, []), true);
    for (const obstacle of [{ left: 95, top: 62, width: 44, height: 44 }, { left: 180, top: 100, width: 24, height: 38 }]) {
        assert.equal(fits(rect, 320, 200, [obstacle]), false, 'town/curral and actor bounds both protect their clearance');
    }
    assert.equal(fits({ ...rect, left: -1 }, 320, 200, []), false);
    assert.equal(fits({ ...rect, top: 160 }, 320, 200, []), false);
    assert.equal(fits({ ...rect, width: 43 }, 320, 200, []), false);
    sceneWidth = 1280; sceneHeight = 720; motion.matches = true; doc.hidden = false;
    fetchRaw = raw; imageReady = Promise.resolve(); waterFailure = true;
    locationMock.search = '?at=town'; locationMock.href = 'https://example.test/guaira.html?at=town';
    const originalOrder = [...destinations];
    destinations.splice(0, destinations.length, ...originalOrder.filter(button => button.marker), ...originalOrder.filter(button => !button.marker));
    const dispose = module.startGuairaMap(); await ready(); frames(2);
    const metadata = parseGuairaMetadata(raw)!, camera = guairaCamera(metadata, sceneWidth, sceneHeight, metadata.nodes['guaira-1'], false);
    const anchor = guairaScreenPoint(metadata.nodes['guaira-2'], camera), marker = destinations.find(button => button.dataset.mapDestination === 'bairro')!;
    assert.equal(marker.hidden, false); assert.equal(marker.style.left, `${anchor.x}px`); assert.equal(marker.style.top, `${anchor.y + 12}px`);
    assert.ok((marker.children.at(-2)?.width ?? 0) >= 44);
    const before = navigations.length; marker.click();
    assert.equal(elements['map-title'].textContent, 'Bairro da Vala Seca'); assert.equal(navigations.length, before);
    const town = destinations.find(button => button.dataset.mapDestination === 'town' && !button.marker)!;
    town.click(); frames(2); const staleMarker = marker.lastClick!;
    marker.focus(); sceneWidth = 180; sceneHeight = 100; win.dispatchEvent(new Event('resize')); frames(2);
    assert.equal(marker.hidden, true); assert.equal(doc.activeElement, town, 'clipping restores a persistent control even with marker-first DOM order');
    sceneWidth = 1280; sceneHeight = 720; win.dispatchEvent(new Event('resize')); frames(2);
    assert.equal(marker.hidden, false); staleMarker(new Event('click'));
    assert.equal(elements['map-title'].textContent, 'Estrada do Vento', 'a marker hidden and shown again rejects its old callback');
    // This scene still fits the plate, but the viewport's short-screen media rule hides the ancestor.
    sceneWidth = 700; sceneHeight = 280; win.dispatchEvent(new Event('resize')); frames(2);
    assert.equal(marker.hidden, false, 'the control is geometrically safe before the CSS breakpoint');
    marker.focus(); const beforeBreakpoint = marker.lastClick!;
    compactMarkers.matches = true; doc.activeElement = doc.body;
    compactMarkers.dispatchEvent(new Event('change'));
    assert.equal(marker.hidden, true, 'ancestor suppression is reflected synchronously');
    assert.equal(doc.activeElement, town, 'CSS suppression restores a persistent control before the next frame');
    beforeBreakpoint(new Event('click')); assert.equal(elements['map-title'].textContent, 'Estrada do Vento');
    frames(2); assert.equal(marker.hidden, true, 'rendering cannot revive a CSS-suppressed marker');
    compactMarkers.matches = false; compactMarkers.dispatchEvent(new Event('change')); frames(2);
    assert.equal(marker.hidden, false); beforeBreakpoint(new Event('click'));
    assert.equal(elements['map-title'].textContent, 'Estrada do Vento', 'expanding the viewport cannot revive the old callback');
    const curralMarker = destinations.find(button => button.dataset.mapDestination === 'curral' && button.marker)!;
    assert.equal(curralMarker.hidden, false); curralMarker.focus(); const staleCurral = curralMarker.lastClick!;
    compactMarkers.matches = true; doc.activeElement = doc.body;
    compactMarkers.dispatchEvent(new Event('change'));
    assert.equal(doc.activeElement, town, 'the same CSS-focus rescue covers the existing markers');
    compactMarkers.matches = false; compactMarkers.dispatchEvent(new Event('change')); frames(2);
    staleCurral(new Event('click')); assert.equal(elements['map-title'].textContent, 'Estrada do Vento');
    marker.focus(); elements['map-overview'].focus();
    compactMarkers.matches = true; compactMarkers.dispatchEvent(new Event('change'));
    assert.equal(doc.activeElement, elements['map-overview'], 'CSS rescue never steals focus after another control was chosen');
    compactMarkers.matches = false; compactMarkers.dispatchEvent(new Event('change')); frames(2);
    marker.focus(); doc.dispatchEvent(Object.defineProperty(new Event('pointerdown'), 'target', { value: doc.body }));
    doc.activeElement = doc.body; compactMarkers.matches = true; compactMarkers.dispatchEvent(new Event('change'));
    assert.equal(doc.activeElement, doc.body, 'an intentional pointer choice outside the plate releases focus ownership');
    compactMarkers.matches = false; compactMarkers.dispatchEvent(new Event('change'));
    dispose(); destinations.splice(0, destinations.length, ...originalOrder);
    sceneWidth = 390; sceneHeight = 450; motion.matches = false;
    const html = readFileSync(new URL('../guaira.html', import.meta.url), 'utf8');
    assert.match(html, /<dialog id="map-detours"[^>]*aria-labelledby="map-detours-title"/);
    assert.match(html, /id="map-detour-patio"[^>]*autofocus[^>]*>Entrar no Pátio/);
    assert.match(html, /id="map-detour-bairro"[^>]*>Caminhar ao Bairro da Vala Seca/);
    assert.equal((html.match(/data-map-destination="bairro"/g) ?? []).length, 1);
});


test('modified exit and chapter links retain the current map visit until pagehide', async () => {
    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    await ready(); frames(2);
    for (const id of ['map-exit', 'map-chapter']) {
        for (const flags of [{ ctrlKey: true, button: 0 }, { metaKey: true, button: 0 }, { button: 1 }]) {
            const event = Object.assign(new Event(flags.button === 1 ? 'auxclick' : 'click', { cancelable: true }), flags);
            elements[id].dispatchEvent(event);
            assert.equal(event.defaultPrevented, false);
        }
    }
    // Even a normal click can have navigation cancelled by the browser. Teardown
    // belongs to pagehide; a modified click must leave this map able to walk.
    elements['map-exit'].click(); destinations[1].click(); frames(1);
    assert.equal(elements['map-title'].textContent, 'Curral da Comporta');
    win.dispatchEvent(new Event('pagehide')); assert.equal(queue.size, 0);
});
