import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { type TestContext } from 'node:test';
import { WorldMapHud, WORLD_MAP_TRAVEL_ACTIONS, WORLD_MAP_TRAVEL_ACTION_IDS, type WorldMapHudState, type WorldMapMotionState } from '../src/adventure/WorldMapHud';

type Listener = (event: any) => void;
/** The component owns semantics, not the renderer's layout or event routing. */
class Element {
    className = ''; textContent = ''; type = ''; id = ''; title = ''; hidden = false; disabled = false;
    tabIndex = 0; width = 0; height = 0;
    parent: Element | null = null;
    children: Element[] = [];
    style: Record<string, string> = {};
    attributes = new Map<string, string>();
    listeners = new Map<string, Listener[]>();
    focusCount = 0;
    draws: unknown[][] = [];
    readonly classList = { toggle: (name: string, on: boolean) => {
        const classes = new Set(this.className.split(' ').filter(Boolean));
        if (on) classes.add(name); else classes.delete(name);
        this.className = [...classes].join(' ');
    } };
    constructor(readonly tagName: string) {}
    append(...elements: Element[]) { for (const item of elements) { item.parent = this; this.children.push(item); } }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
    addEventListener(type: string, listener: Listener) { this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]); }
    removeEventListener(type: string, listener: Listener) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== listener)); }
    focus() { this.focusCount++; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this); }
    getContext() { return { setTransform() {}, fillRect() {}, drawImage: (...args: unknown[]) => this.draws.push(args), fillStyle: '', imageSmoothingEnabled: false }; }
    dispatch(type: string, data: Record<string, unknown> = {}) {
        const event = { key: '', defaultPrevented: false, propagationStopped: false,
            preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...data };
        for (const listener of this.listeners.get(type) ?? []) listener(event);
        return event;
    }
    click() { if (!this.disabled) this.dispatch('click'); }
}
function dom(t: TestContext) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: (tag: string) => new Element(tag) } });
    t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
}
function fixture(t: TestContext) {
    dom(t);
    const calls: Array<string | number> = [];
    const hud = new WorldMapHud({ selectStage: index => calls.push(index), selectWorld: world => calls.push(`world:${world}`),
        enter: () => calls.push('enter'), skip: () => calls.push('skip'), overview: () => calls.push('overview'), menu: () => calls.push('menu') });
    const state: WorldMapHudState = { world: 1, stage: 0, open: [true, true, false, false, false],
        completed: [true, false, false, false, false], seals: [3, 1, 0, 0, 0], globalProgress: { completed: 1, seals: 4 },
        motionState: 'idle', canEnter: true, hint: '', worldAvailability: [true, false, false, false, false, false] };
    hud.update(state); hud.setVisible(true);
    t.after(() => hud.dispose());
    return { hud, calls, state };
}
const asElement = (element: HTMLElement) => element as unknown as Element;
function find(root: Element, className: string): Element {
    if (root.className.split(' ').includes(className)) return root;
    for (const child of root.children) { const result = maybeFind(child, className); if (result) return result; }
    throw new Error(`Missing ${className}`);
}
function maybeFind(root: Element, className: string): Element | undefined {
    if (root.className.split(' ').includes(className)) return root;
    for (const child of root.children) { const result = maybeFind(child, className); if (result) return result; }
}

test('phase activation always selects; entering is a separate arrival-gated action', t => {
    const { hud, calls, state } = fixture(t);
    hud.stageButtons[0].click(); hud.stageButtons[0].click();
    assert.deepEqual(calls, [0, 0], 'Clicking the same sign twice must never launch gameplay.');
    hud.enterButton.click(); assert.deepEqual(calls, [0, 0, 'enter']);
    hud.update({ ...state, stage: 1, motionState: 'walking', canEnter: false });
    hud.enterButton.click(); assert.equal(calls.at(-1), 'enter');
    hud.stageButtons[3].click(); assert.equal(calls.at(-1), 3, 'Locked phases stay inspectable.');
    assert.match(hud.stageButtons[3].getAttribute('aria-label')!, /1-4.*bloqueada/);
    hud.setVisible(false); hud.stageButtons[1].click(); assert.equal(calls.at(-1), 3, 'Hidden maps cannot dispatch gameplay actions.');
});

test('panorama buttons own six full region names and keep locked islands inspectable', t => {
    const { hud, calls, state } = fixture(t);
    hud.update({ ...state, overview: true });
    hud.positionOverviewWorlds(Array.from({ length: 6 }, (_, n) => ({ x: 80 + n * 140, y: 160 })));
    const names = ['Costa dos Gaps', 'Porto do Bielzão', 'Fábrica de Suco', 'Serra Suspensa', 'Reserva Gelada', 'Domínio Pizzarino'];
    hud.overviewButtons.forEach((button, index) => {
        assert.equal(button.hidden, false); assert.equal(button.getAttribute('data-island-world'), String(index + 1));
        assert.ok(button.getAttribute('aria-label')!.includes(`Ilha ${index + 1}: ${names[index]}.`));
        assert.match(button.getAttribute('aria-label')!, index ? /Bloqueada.*prévia de perto/ : /Disponível.*de perto/);
        button.click();
    });
    assert.deepEqual(calls, names.map((_, index) => `world:${index + 1}`));
    assert.equal(calls.includes('enter'), false);
    hud.update(state); assert.ok(hud.overviewButtons.every(button => button.hidden));
    hud.setVisible(false); hud.overviewButtons[0].click(); assert.equal(calls.length, 6);
});

test('island decoration is lazy and shared, and disposal prevents a late overview repaint', async t => {
    const resources = signResources(t), { hud, state } = fixture(t);
    await resources.metadata(); resources.images[0].onload!(); await resources.settle();
    assert.equal(resources.requests.length, 1);
    hud.update({ ...state, overview: true });
    assert.equal(resources.requests.length, 2); assert.match(resources.requests[1].url, /island-signs.meta.json$/);
    resources.requests[1].resolve({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../public/assets/world/map/island-signs.meta.json', import.meta.url), 'utf8')) });
    await resources.settle();
    const image = resources.images[1], late = image.onload!;
    const board = asElement(hud.overviewButtons[0]).children[0], draws = board.draws.length;
    hud.setVisible(false); hud.setVisible(true); assert.equal(resources.requests.length, 2);
    hud.dispose(); image.naturalWidth = 768; image.naturalHeight = 88; late(); await resources.settle();
    assert.equal(board.draws.length, draws); assert.equal(hud.root.hidden, true);
    assert.equal(image.onload, null); assert.equal(image.onerror, null);
});

test('overview arrow keys focus island choices without travelling and Escape closes only the overview', t => {
    const { hud, calls, state } = fixture(t); hud.update({ ...state, overview: true });
    let prevented = false;
    asElement(hud.root).dispatch('keydown', { key: 'ArrowRight', target: hud.overviewButtons[0],
        preventDefault() { prevented = true; }, stopPropagation() {} });
    assert.ok(prevented); assert.equal(asElement(hud.overviewButtons[1]).focusCount, 1); assert.deepEqual(calls, []);
    asElement(hud.root).dispatch('keydown', { key: 'Escape', target: hud.overviewButtons[1], preventDefault() {}, stopPropagation() {} });
    assert.deepEqual(calls, ['overview']);
});

test('a journey heading names its destination without claiming arrival or relabeling a locked preview', t => {
    const { hud, state } = fixture(t);
    const title = () => find(find(asElement(hud.root), 'world-map-title'), 'world-map-sr').textContent;
    hud.update({ ...state, world: 2, stage: 5, arrivedWorld: 1, motionState: 'sailing', canEnter: false });
    assert.match(title(), /Rumo a Porto do Bielzão/);
    hud.update({ ...state, world: 2, stage: 6, arrivedWorld: 2, motionState: 'walking', canEnter: false });
    assert.equal(title(), 'Porto do Bielzão');
    hud.update({ ...state, world: 6, stage: 25, arrivedWorld: 1, preview: true, motionState: 'sailing', canEnter: false });
    assert.equal(title(), 'Domínio Pizzarino');
    assert.match(find(asElement(hud.root), 'world-map-status').textContent, /Prévia/);
});

test('every in-flight state exposes skip and an honest motion status, with explicit entry after arrival', t => {
    const { hud, calls, state } = fixture(t);
    for (const [motionState, copy] of [['walking', 'a caminho'], ['boarding', 'Embarcando'], ['sailing', 'Navegando'], ['riding', 'Na cabine'], ['arriving', 'Desembarcando']] as const) {
        hud.update({ ...state, motionState: motionState as WorldMapMotionState, canEnter: false });
        assert.equal(hud.skipButton.hidden, false); assert.equal(hud.enterButton.hidden, true);
        assert.match(find(asElement(hud.root), 'world-map-status').textContent, new RegExp(copy));
        hud.skipButton.click(); assert.equal(calls.at(-1), 'skip');
    }
    assert.equal(calls.filter(value => value === 'skip').length, 5);
    assert.equal(calls.includes('enter'), false);
    hud.update(state);
    assert.equal(hud.skipButton.hidden, true); assert.equal(hud.enterButton.hidden, false);
    assert.match(find(asElement(hud.root), 'world-map-status').textContent, /pode entrar/);
});

test('a preview never claims Feka arrived and keeps all six regions accessible', t => {
    const { hud, state } = fixture(t);
    hud.update({ ...state, world: 6, stage: 29, open: Array(5).fill(false), completed: Array(5).fill(false), preview: true, canEnter: false });
    assert.match(find(asElement(hud.root), 'world-map-status').textContent, /Prévia.*não chegou/);
    assert.equal(hud.enterButton.disabled, true);
    assert.match(hud.stageButtons[4].getAttribute('aria-label')!, /6-5.*O Grande Gap/);
    const regions = asElement(hud.regionMenu).children.filter(child => child.className.split(' ').includes('world-map-region'));
    assert.equal(regions.length, 6);
    assert.match(regions[5].getAttribute('aria-label')!, /Domínio Pizzarino.*Bloqueada/);
});

test('projection can hide all stage signs while preserving independently positioned world docks', t => {
    const { hud, calls } = fixture(t);
    hud.positionNodes(Array.from({ length: 5 }, (_, n) => ({ x: 100 + n * 70, y: 250 })), [{ x: 20, y: 150 }, { x: 240, y: 150 }]);
    assert.equal(hud.stageButtons.every(button => !button.hidden), true);
    hud.positionNodes([], [{ x: 20, y: 150 }, { x: 240, y: 150, available: false }]);
    assert.equal(hud.stageButtons.every(button => button.hidden), true);
    assert.equal(hud.dockButtons.every(button => !button.hidden), true);
    assert.match(hud.dockButtons[1].getAttribute('aria-label')!, /Travessia bloqueada/);
    hud.dockButtons[1].click(); assert.deepEqual(calls, ['world:2']);
    hud.positionNodes([{ x: NaN, y: 0 }], [{ x: 20, y: 150, visible: false }]);
    assert.equal(hud.stageButtons[0].hidden, true); assert.equal(hud.dockButtons[0].hidden, true);
});

test('Escape closes only the region drawer, restores focus and cannot escape to the game', t => {
    const { hud, calls } = fixture(t);
    hud.regionButton.click(); assert.equal(hud.regionMenu.hidden, false);
    assert.equal(hud.regionButton.getAttribute('aria-expanded'), 'true');
    const root = asElement(hud.root), button = asElement(hud.regionButton);
    const event = root.dispatch('keydown', { key: 'Escape' });
    assert.equal(hud.regionMenu.hidden, true); assert.equal(button.focusCount, 1);
    assert.equal(event.defaultPrevented, true); assert.equal(event.propagationStopped, true);
    assert.deepEqual(calls, []);
    const closed = root.dispatch('keydown', { key: 'Escape' });
    assert.equal(closed.defaultPrevented, false, 'Closed drawers leave scene keyboard routing to their owner.');
    hud.regionButton.click(); hud.closeRegionMenu(true); assert.equal(button.focusCount, 2);
});

function signResources(t: TestContext) {
    const requests: Array<{ url: string; signal: AbortSignal; resolve: (value: unknown) => void }> = [];
    const images: ImageMock[] = [];
    class ImageMock {
        decoding = ''; src = ''; naturalWidth = 560; naturalHeight = 232;
        onload: (() => void) | null = null; onerror: (() => void) | null = null;
        constructor() { images.push(this); }
    }
    for (const [key, value] of Object.entries({ Image: ImageMock,
        fetch: (url: string, options: { signal: AbortSignal }) => new Promise(resolve => requests.push({ url, signal: options.signal, resolve })),
        requestAnimationFrame: () => assert.fail('Sign decoration must not create an animation loop.') })) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else Reflect.deleteProperty(globalThis, key); });
    }
    const settle = () => new Promise<void>(resolve => setImmediate(resolve));
    return { requests, images, settle, async metadata() {
        requests[0].resolve({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../public/assets/world/map/signs-atlas.meta.json', import.meta.url), 'utf8')) });
        await settle();
    } };
}

test('one optional atlas paints all seven existing sign canvases and survives hide/show without extra requests', async t => {
    const resources = signResources(t), { hud, calls, state } = fixture(t);
    const stage = asElement(hud.stageButtons[0]).children[0], dock = asElement(hud.dockButtons[0]).children[0];
    const stageLabel = hud.stageButtons[0].getAttribute('aria-label');
    assert.equal(stage.width, 56, 'The procedural sign is ready immediately.');
    hud.setVisible(false); hud.setVisible(true); hud.update(state); assert.equal(resources.requests.length, 1);
    await resources.metadata(); assert.equal(resources.images.length, 1);
    resources.images[0].onload!(); await resources.settle();
    assert.equal(stage.width, 112); assert.equal(dock.width, 208);
    assert.equal(stage.style.transform, 'translate(0px, 11px)'); assert.equal(dock.style.transform, 'translate(0px, 10px)');
    assert.equal(hud.stageButtons[0].getAttribute('aria-label'), stageLabel);
    for (const button of [...hud.stageButtons, ...hud.dockButtons]) assert.equal(asElement(button).children[0].draws.length, 1);
    hud.setVisible(false); hud.setVisible(true); hud.update(state);
    assert.equal(resources.requests.length, 1); assert.equal(resources.images.length, 1); assert.deepEqual(calls, []);
    assert.equal(hud.enterButton.disabled, false); hud.stageButtons[0].click(); assert.deepEqual(calls, [0]);
});

test('missing atlas image keeps every procedural sign usable and never retries per frame', async t => {
    const resources = signResources(t), { hud, state } = fixture(t);
    await resources.metadata(); resources.images[0].onerror!(); await resources.settle();
    for (let frame = 0; frame < 10; frame++) hud.update({ ...state, stage: frame % 2 });
    const stage = asElement(hud.stageButtons[0]).children[0];
    assert.equal(stage.width, 56); assert.equal(stage.style.transform, ''); assert.equal(stage.draws.length, 0);
    assert.equal(resources.requests.length, 1); assert.equal(resources.images.length, 1);
});

test('disposing during atlas load removes handlers and cannot repaint or resurrect the HUD', async t => {
    const resources = signResources(t), { hud } = fixture(t);
    await resources.metadata(); const image = resources.images[0], lateLoad = image.onload!;
    const stage = asElement(hud.stageButtons[0]).children[0];
    hud.dispose(); assert.equal(resources.requests[0].signal.aborted, true);
    assert.equal(image.onload, null); assert.equal(image.onerror, null);
    lateLoad(); await resources.settle(); hud.setVisible(true);
    assert.equal(stage.draws.length, 0); assert.equal(stage.width, 56);
});

test('physical props consistently cover all six campaign regions', async t => {
    const resources = signResources(t), { hud, state } = fixture(t);
    await resources.metadata(); resources.images[0].onload!(); await resources.settle();
    const stage = asElement(hud.stageButtons[0]).children[0], dock = asElement(hud.dockButtons[1]).children[0];
    assert.equal(stage.style.transform, 'translate(0px, 11px)');
    for (const world of [6, 2, 3, 4, 5, 1]) {
        hud.update({ ...state, world, stage: (world - 1) * 5 });
        assert.equal(stage.width, 112);
        assert.equal(stage.style.transform, 'translate(0px, 11px)');
        assert.equal(dock.style.transform, 'translate(0px, 10px)');
        assert.match(hud.stageButtons[0].getAttribute('aria-label')!, new RegExp(`Fase ${world}-1:`));
    }
    assert.equal(resources.requests.length, 3); assert.equal(resources.images.length, 1);
});


test('route IDs keep same-name signs and independent transport actions distinct', t => {
    dom(t);
    const calls: string[] = [];
    const hud = new WorldMapHud({ selectTravel: id => calls.push(id), selectWorld: world => calls.push(`world:${world}`),
        selectStage() {}, enter() {}, skip() {}, overview() {}, menu() {} });
    t.after(() => hud.dispose()); hud.setVisible(true);
    assert.equal(hud.dockButtons.length, 2);
    assert.equal(hud.dockButtons[0], hud.travelButtons['ferry-porto-costa']);
    assert.equal(hud.dockButtons[1], hud.travelButtons['ferry-costa-porto']);
    for (const id of WORLD_MAP_TRAVEL_ACTION_IDS) {
        const button = hud.travelButtons[id], sign = WORLD_MAP_TRAVEL_ACTIONS[id];
        assert.equal(button.getAttribute('data-travel-action'), id);
        assert.ok(sign.width >= 44 && sign.height >= 44);
        button.click(); button.click();
        assert.equal(asElement(button).listeners.get('click')?.length, 1);
    }
    assert.deepEqual(calls, WORLD_MAP_TRAVEL_ACTION_IDS.flatMap(id => [id, id]));
    const ferry = WORLD_MAP_TRAVEL_ACTIONS['ferry-costa-porto'], bridge = WORLD_MAP_TRAVEL_ACTIONS['bridge-factory-porto'];
    assert.equal(ferry.label, 'PORTO'); assert.equal(bridge.label, 'PORTO');
    assert.equal(ferry.direction, 'right'); assert.equal(bridge.direction, 'left');
    assert.equal(ferry.mode, 'ferry'); assert.equal(bridge.mode, 'bridge');
    hud.dispose(); hud.travelButtons['bridge-porto-factory'].click();
    assert.equal(calls.length, WORLD_MAP_TRAVEL_ACTION_IDS.length * 2, 'Disposed route buttons never dispatch.');
});

test('bridge signs use their own availability, hide missing anchors and retain the legacy fallback callback', t => {
    const { hud, state, calls } = fixture(t);
    hud.update({ ...state, world: 2, stage: 5, worldAvailability: [true, true, false, false, false, false] });
    hud.positionNodes([{ x: 60, y: 80 }]);
    hud.positionTravelActions({
        'ferry-porto-costa': { x: 50, y: 120, available: false },
        'bridge-porto-factory': { x: 200, y: 200, available: true },
    });
    assert.equal(hud.travelButtons['ferry-costa-porto'].hidden, true);
    assert.equal(hud.travelButtons['bridge-factory-porto'].hidden, true);
    const bridge = hud.travelButtons['bridge-porto-factory'];
    assert.equal(bridge.hidden, false);
    assert.match(bridge.getAttribute('aria-label')!, /Ponte de carga.*Fábrica.*Caminhar/);
    assert.doesNotMatch(bridge.getAttribute('aria-label')!, /barco|Cais|Embarcar/);
    assert.match(hud.travelButtons['ferry-porto-costa'].getAttribute('aria-label')!, /Travessia bloqueada/);
    bridge.click(); assert.deepEqual(calls, ['world:3']);
    for (let n = 0; n < 5; n++) {
        hud.positionNodes([]);
        hud.positionTravelActions({ 'bridge-factory-porto': { x: 80, y: 160, available: true } });
    }
    assert.equal(bridge.hidden, true);
    hud.travelButtons['bridge-factory-porto'].click(); assert.deepEqual(calls, ['world:3', 'world:2']);
    assert.equal(asElement(hud.travelButtons['bridge-factory-porto']).listeners.get('click')?.length, 1);
    hud.positionTravelActions({ 'bridge-factory-porto': { x: NaN, y: 20 } });
    assert.ok(Object.values(hud.travelButtons).every(button => button.hidden));
});

test('Factory supplement loads lazily once and paints its accented sign without reloading the released atlas', async t => {
    const resources = signResources(t), { hud, state } = fixture(t);
    await resources.metadata(); resources.images[0].onload!(); await resources.settle();
    assert.equal(resources.requests.length, 1);
    const bridge = asElement(hud.travelButtons['bridge-porto-factory']).children[0];
    hud.positionTravelActions({ 'bridge-porto-factory': { x: 190, y: 180, available: true } });
    assert.equal(resources.requests.length, 2);
    resources.requests[1].resolve({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../public/assets/world/map/signs-factory.meta.json', import.meta.url), 'utf8')) });
    await resources.settle();
    const image = resources.images[1]; image.naturalWidth = 256; image.naturalHeight = 112;
    image.onload!(); await resources.settle();
    assert.equal(bridge.width, 256); assert.equal(bridge.height, 112);
    assert.equal(bridge.style.transform, 'translate(0px, 10px)');
    const draw = bridge.draws.at(-1)!; assert.equal(draw[0], image);
    hud.update({ ...state, world: 3, stage: 10 });
    hud.setVisible(false); hud.setVisible(true);
    hud.positionTravelActions({ 'bridge-porto-factory': { x: 190, y: 180, available: false } });
    assert.equal(resources.requests.length, 2); assert.equal(resources.images.length, 2);
    assert.equal(asElement(hud.stageButtons[4]).children[0].width, 112);
    assert.match(hud.travelButtons['bridge-porto-factory'].getAttribute('aria-label')!, /Ponte bloqueada/);
});

test('failed Factory decoration preserves its readable fallback and leaves all existing art available', async t => {
    const resources = signResources(t), { hud, state } = fixture(t);
    await resources.metadata(); resources.images[0].onload!(); await resources.settle();
    hud.update({ ...state, world: 3, stage: 10 });
    resources.requests[1].resolve({ ok: false }); await resources.settle();
    for (let n = 0; n < 10; n++) hud.update({ ...state, world: 3, stage: 10 + n % 5 });
    const factory = asElement(hud.travelButtons['bridge-porto-factory']).children[0];
    assert.equal(factory.width, 128); assert.equal(factory.style.transform, '');
    assert.equal(asElement(hud.stageButtons[0]).children[0].width, 112);
    assert.equal(asElement(hud.travelButtons['bridge-factory-porto']).children[0].width, 208);
    assert.equal(resources.requests.length, 2);
});

test('Serra walking signs preserve directional route availability and destination fallback without boat copy', t => {
    const { hud, state, calls } = fixture(t);
    hud.update({ ...state, world: 3, stage: 10, worldAvailability: [true, true, true, false, false, false] });
    assert.equal(hud.travelButtons['walk-factory-serra'].hidden, true);
    assert.equal(hud.travelButtons['walk-serra-factory'].hidden, true);
    hud.positionTravelActions({ 'walk-factory-serra': { x: 180, y: 210, available: false } });
    const outward = hud.travelButtons['walk-factory-serra'], inward = hud.travelButtons['walk-serra-factory'];
    assert.match(outward.getAttribute('aria-label')!, /Caminho.*Serra.*Passagem bloqueada/);
    assert.doesNotMatch(outward.getAttribute('aria-label')!, /barco|Cais|Ponte/);
    assert.match(outward.title, /SERRA →.*caminho/);
    assert.equal(inward.hidden, true);
    outward.click(); assert.deepEqual(calls, ['world:4']);
    hud.update({ ...state, world: 4, stage: 15 });
    hud.positionTravelActions({ 'walk-serra-factory': { x: 90, y: 190, available: true } });
    assert.equal(outward.hidden, true); assert.equal(inward.hidden, false);
    assert.match(inward.getAttribute('aria-label')!, /Caminho.*Fábrica.*Caminhar pela passagem/);
    assert.doesNotMatch(inward.getAttribute('aria-label')!, /barco|Cais|Ponte/);
    assert.match(inward.title, /FÁBRICA ←.*caminho/);
    inward.click(); assert.deepEqual(calls, ['world:4', 'world:3']);
    hud.positionTravelActions({}); assert.equal(inward.hidden, true);
});

test('the left Factory supplement stays out of initial Costa and Factory requests and paints only its own arrow', async t => {
    const resources = signResources(t), { hud, state } = fixture(t);
    await resources.metadata(); resources.images[0].onload!(); await resources.settle();
    hud.update({ ...state, world: 3, stage: 10 });
    hud.positionTravelActions({ 'walk-factory-serra': { x: 180, y: 210, available: true } });
    assert.equal(resources.requests.length, 2);
    assert.ok(resources.requests.every(request => !request.url.includes('factory-left')));
    const outward = asElement(hud.travelButtons['walk-factory-serra']).children[0];
    assert.equal(outward.width, 208); assert.equal(outward.draws.at(-1)![0], resources.images[0]);
    hud.update({ ...state, world: 4, stage: 15 });
    assert.equal(resources.requests.length, 3); assert.match(resources.requests[2].url, /signs-factory-left.meta.json$/);
    resources.requests[2].resolve({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../public/assets/world/map/signs-factory-left.meta.json', import.meta.url), 'utf8')) });
    await resources.settle();
    const image = resources.images[1]; image.naturalWidth = 256; image.naturalHeight = 112;
    image.onload!(); await resources.settle();
    const inward = asElement(hud.travelButtons['walk-serra-factory']).children[0];
    assert.equal(inward.width, 256); assert.equal(inward.height, 112);
    assert.equal(inward.style.transform, 'translate(0px, 10px)'); assert.equal(inward.draws.at(-1)![0], image);
    hud.setVisible(false); hud.setVisible(true);
    hud.positionTravelActions({ 'walk-serra-factory': { x: 90, y: 190, available: false } });
    hud.update({ ...state, world: 4, stage: 16 });
    assert.equal(resources.requests.length, 3); assert.equal(resources.images.length, 2);
    assert.equal(asElement(hud.stageButtons[4]).children[0].width, 112);
});

test('hidden Serra waits for visibility and disposal aborts its independently loaded left image', async t => {
    const resources = signResources(t), { hud, state } = fixture(t);
    hud.setVisible(false); hud.update({ ...state, world: 4, stage: 15 });
    assert.equal(resources.requests.length, 1);
    hud.setVisible(true); assert.equal(resources.requests.length, 2);
    resources.requests[1].resolve({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../public/assets/world/map/signs-factory-left.meta.json', import.meta.url), 'utf8')) });
    await resources.settle();
    const image = resources.images[0], lateLoad = image.onload!;
    const inward = asElement(hud.travelButtons['walk-serra-factory']).children[0];
    hud.dispose(); assert.equal(resources.requests[1].signal.aborted, true);
    assert.equal(image.onload, null); assert.equal(image.onerror, null);
    image.naturalWidth = 256; image.naturalHeight = 112; lateLoad(); await resources.settle();
    assert.equal(inward.width, 128); assert.equal(inward.draws.length, 0);
});

test('failed left-supplement decoration keeps Serra phases and both walking actions readable without retries', async t => {
    const resources = signResources(t), { hud, state, calls } = fixture(t);
    await resources.metadata(); resources.images[0].onload!(); await resources.settle();
    hud.positionTravelActions({ 'walk-serra-factory': { x: 90, y: 190, available: true } });
    assert.equal(resources.requests.length, 2); assert.match(resources.requests[1].url, /signs-factory-left.meta.json$/);
    resources.requests[1].resolve({ ok: false }); await resources.settle();
    for (let n = 0; n < 10; n++) hud.update({ ...state, world: 4, stage: 15 + n % 5 });
    const inward = asElement(hud.travelButtons['walk-serra-factory']).children[0];
    assert.equal(inward.width, 128); assert.equal(inward.style.transform, '');
    assert.equal(asElement(hud.travelButtons['walk-factory-serra']).children[0].width, 208);
    assert.equal(asElement(hud.stageButtons[0]).children[0].width, 112);
    hud.travelButtons['walk-serra-factory'].click(); assert.deepEqual(calls, ['world:3']);
    assert.equal(resources.requests.length, 2);
});

test('passenger directions announce their gate and reuse the authored wide sign without another atlas', async t => {
    const resources = signResources(t), { hud, state } = fixture(t);
    await resources.metadata(); resources.images[0].onload!(); await resources.settle();
    hud.update({ ...state, world: 4, stage: 19, worldAvailability: [true, true, true, true, false, false] });
    hud.positionTravelActions({ 'cable-serra-reserva': { x: 160, y: 210, available: false } });
    const outgoing = hud.travelButtons['cable-serra-reserva'];
    assert.match(outgoing.getAttribute('aria-label')!, /Teleférico.*Reserva.*Linha de passageiros bloqueada/);
    assert.doesNotMatch(outgoing.getAttribute('aria-label')!, /barco|Cais|Ponte/);
    assert.match(outgoing.title, /RESERVA ←.*teleférico/);
    assert.equal(resources.requests.length, 2);
    assert.match(resources.requests[1].url, /signs-factory-left.meta.json$/);
    resources.requests[1].resolve({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../public/assets/world/map/signs-factory-left.meta.json', import.meta.url), 'utf8')) });
    await resources.settle();
    const image = resources.images[1]; image.naturalWidth = 256; image.naturalHeight = 112;
    image.onload!(); await resources.settle();
    assert.equal(asElement(outgoing).children[0].draws.at(-1)![0], image);
    hud.update({ ...state, world: 5, stage: 20, worldAvailability: [true, true, true, true, true, false] });
    hud.positionTravelActions({ 'cable-reserva-serra': { x: 180, y: 220, available: true } });
    const incoming = hud.travelButtons['cable-reserva-serra'];
    assert.match(incoming.getAttribute('aria-label')!, /Teleférico.*Serra.*Viajar pela linha de passageiros/);
    assert.match(incoming.title, /SERRA →.*teleférico/);
    assert.equal(asElement(hud.stageButtons[0]).children[0].width, 112);
    assert.equal(resources.requests.length, 2, 'The new labels reuse existing blank wooden faces.');
});

test('heated ferry signs load the correct wide faces and preserve their actual terminal destinations', async t => {
    const resources = signResources(t), { hud, state } = fixture(t);
    await resources.metadata(); resources.images[0].onload!(); await resources.settle();
    hud.update({ ...state, world: 5, stage: 24 });
    hud.positionTravelActions({ 'ferry-reserva-dominio': { x: 170, y: 220, available: false } });
    assert.match(hud.travelButtons['ferry-reserva-dominio'].getAttribute('aria-label')!, /Cais.*Domínio Pizzarino.*Travessia bloqueada/);
    assert.match(resources.requests[1].url, /signs-factory-left.meta.json$/);
    hud.update({ ...state, world: 6, stage: 25 });
    hud.positionTravelActions({ 'ferry-dominio-reserva': { x: 180, y: 220, available: true } });
    assert.match(hud.travelButtons['ferry-dominio-reserva'].getAttribute('aria-label')!, /Cais.*Reserva Gelada.*travessia de barco/);
    assert.match(resources.requests[2].url, /signs-factory.meta.json$/);
    assert.equal(hud.travelButtons['ferry-reserva-dominio'].hidden, true);
    assert.equal(WORLD_MAP_TRAVEL_ACTIONS['ferry-dominio-reserva'].toStage, '5-5');
    hud.positionTravelActions({ 'ferry-reserva-dominio': { x: 170, y: 220, available: true } });
    assert.equal(resources.requests.length, 3, 'Returning to the same face never requests it again.');
});
