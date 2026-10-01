import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { type TestContext } from 'node:test';
import { WorldMapHud, WORLD_MAP_TRAVEL_ACTIONS, WORLD_MAP_TRAVEL_ACTION_IDS, type WorldMapHudPoint, type WorldMapHudState, type WorldMapMotionState } from '../src/adventure/WorldMapHud';

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
    focus() { this.focusCount++; (document as unknown as { activeElement: Element | null }).activeElement = this; }
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
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { activeElement: null, createElement: (tag: string) => new Element(tag) } });
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
/** Count setter calls, including assignments that leave the value unchanged. */
function positionWrites(buttons: readonly HTMLButtonElement[]) {
    const writes: Array<{ index: number; property: 'hidden' | 'transform'; value: boolean | string }> = [];
    buttons.forEach((button, index) => {
        let hidden = button.hidden, transform = button.style.transform;
        Object.defineProperty(button, 'hidden', { configurable: true, get: () => hidden, set(value: boolean) {
            writes.push({ index, property: 'hidden', value }); hidden = value;
        } });
        Object.defineProperty(button.style, 'transform', { configurable: true, get: () => transform, set(value: string) {
            writes.push({ index, property: 'transform', value }); transform = value;
        } });
    });
    return writes;
}
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
    const overview = asElement(hud.tools).children.find(button => button.className.includes('world-map-overview'))!;
    assert.equal(overview.focusCount, 1, 'The closing overview returns focus to its persistent toggle.');
    hud.regionButton.focus();
    asElement(hud.root).dispatch('keydown', { key: 'Escape', target: hud.regionButton });
    assert.equal(document.activeElement as unknown, hud.regionButton, 'A persistent header control keeps its own focus.');
    assert.equal(overview.focusCount, 1);
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

test('a blocked preview keeps its exact prerequisite in the primary line and announces the full phase once', t => {
    const { hud, state } = fixture(t);
    const root = asElement(hud.root), announcement = root.children.find(child => child.getAttribute('role') === 'status')!;
    const blocked: WorldMapHudState = { ...state, world: 2, stage: 5, open: Array(5).fill(false),
        preview: true, canEnter: false, prerequisiteStage: '1-5', hint: 'Conclua o caminho anterior para visitar esta fase.' };
    hud.update(blocked);
    const status = find(root, 'world-map-status');
    assert.equal(status.textContent, 'Prévia · Conclua 1-5', 'The primary line survives the short-screen layout that hides the hint.');
    assert.equal(status.hidden, false);
    assert.equal(find(root, 'world-map-hint').textContent, 'Conclua 1-5: Joãozão na Ponte para visitar esta fase.');
    assert.match(announcement.textContent, /2-1 Carga Chegando\. Prévia\. Conclua 1-5: Joãozão na Ponte/);
    assert.equal(announcement.textContent.match(/1-5/g)?.length, 1);
    assert.doesNotMatch(announcement.textContent, /Feka chegou|pode entrar/);
    assert.match(hud.enterButton.getAttribute('aria-label')!, /Prévia.*Conclua 1-5/);
    assert.equal(hud.enterButton.disabled, true);

    hud.update({ ...blocked, motionState: 'sailing' });
    assert.equal(status.textContent, 'Prévia · Navegando', 'Inspecting a lock preserves an existing trip’s motion copy.');
    assert.match(announcement.textContent, /Prévia · Navegando\. Conclua 1-5: Joãozão na Ponte/);
    assert.equal(announcement.textContent.match(/1-5/g)?.length, 1);
    assert.equal(hud.skipButton.hidden, false);
});

test('an open preview preserves route feedback without a progression prerequisite', t => {
    const { hud, state } = fixture(t), root = asElement(hud.root);
    for (const hint of ['Preparando o barco e os cais… Você pode escolher outra fase ou voltar ao menu.',
        'Esta ligação ainda não está disponível no mapa.']) {
        hud.update({ ...state, world: 2, stage: 5, preview: true, canEnter: false, hint });
        assert.equal(find(root, 'world-map-status').textContent, 'Prévia · Feka não chegou aqui');
        assert.equal(find(root, 'world-map-hint').textContent, hint);
        const announcement = root.children.find(child => child.getAttribute('role') === 'status')!.textContent;
        assert.doesNotMatch(announcement, /Conclua|1-5/);
        assert.equal(hud.enterButton.disabled, true);
    }
});

test('focused travel actions hand off only when hidden or disabled, including a non-enterable arrival', t => {
    const { hud, state, calls } = fixture(t);
    const active = () => document.activeElement as unknown as Element | null;
    for (const arrival of [state, { ...state, canEnter: false }, { ...state, preview: true }]) {
        hud.update({ ...state, motionState: 'sailing', canEnter: false }); hud.skipButton.focus();
        hud.update(arrival);
        assert.equal(active(), asElement(arrival.canEnter && !arrival.preview ? hud.enterButton : hud.root));
        assert.equal(hud.skipButton.hidden, true);
    }
    hud.update(state); hud.enterButton.focus();
    const enter = asElement(hud.enterButton); let disabled = enter.disabled;
    Object.defineProperty(enter, 'disabled', { configurable: true, get: () => disabled, set: value => {
        disabled = value;
        if (disabled && active() === enter) (document as unknown as { activeElement: Element | null }).activeElement = null;
    } });
    hud.update({ ...state, motionState: 'walking', canEnter: false });
    assert.equal(active(), asElement(hud.root), 'Focus is captured before the browser blurs a newly disabled Enter button.');
    hud.regionButton.focus(); const rootFocus = asElement(hud.root).focusCount;
    hud.update(state); hud.update(state);
    assert.equal(active(), asElement(hud.regionButton)); assert.equal(asElement(hud.root).focusCount, rootFocus);
    const external = document.createElement('button'); external.focus();
    hud.update({ ...state, motionState: 'walking', canEnter: false }); hud.update(state);
    assert.equal(document.activeElement, external); assert.deepEqual(calls, []);
});

test('hiding a focused phase, departure or island name retains map focus without idle focus churn', t => {
    const { hud, state } = fixture(t); hud.update({ ...state, overview: true });
    const cases = [
        { button: hud.stageButtons[0], position: (point: WorldMapHudPoint | null) => hud.positionNodes([point]) },
        { button: hud.travelButtons['ferry-costa-porto'], position: (point: WorldMapHudPoint | null) => hud.positionTravelActions({ 'ferry-costa-porto': point }) },
        { button: hud.overviewButtons[0], position: (point: WorldMapHudPoint | null) => hud.positionOverviewWorlds([point]) },
    ];
    for (const { button, position } of cases) {
        position({ x: 120, y: 200 }); button.focus(); position(null);
        assert.equal(button.hidden, true); assert.equal(document.activeElement as unknown, hud.root);
        const count = asElement(hud.root).focusCount; position(null); position(null);
        assert.equal(asElement(hud.root).focusCount, count);
    }
    hud.positionOverviewWorlds([{ x: 120, y: 200 }]); hud.overviewButtons[0].focus();
    hud.update(state);
    assert.equal(document.activeElement as unknown, hud.root, 'Closing panorama also hides its name controls during the state update.');
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

test('stationary stage and travel passes make no hidden or transform assignments', t => {
    const { hud } = fixture(t);
    const stages = Array.from({ length: 5 }, (_, n) => ({ x: 100 + n * 60, y: 200 }));
    const travel = { 'ferry-costa-porto': { x: 100, y: 300, available: false } };
    const writes = positionWrites([...hud.stageButtons, ...WORLD_MAP_TRAVEL_ACTION_IDS.map(id => hud.travelButtons[id])]);
    const position = () => { hud.positionNodes(stages); hud.positionTravelActions(travel); };
    position();
    assert.equal(writes.filter(write => write.property === 'hidden').length, 6);
    assert.equal(writes.filter(write => write.property === 'transform').length, 6);
    writes.length = 0;
    for (let n = 0; n < 120; n++) position();
    assert.deepEqual(writes, [], 'Stable frames must neither hide/show the ferry nor rewrite any control.');
    travel['ferry-costa-porto'].available = true;
    position();
    assert.deepEqual(writes, [], 'Availability changes need no position or visibility assignment.');
    assert.match(hud.travelButtons['ferry-costa-porto'].getAttribute('aria-label')!, /Marcar destino da travessia/);
    travel['ferry-costa-porto'].available = false;
    position();
    assert.deepEqual(writes, []);
    assert.match(hud.travelButtons['ferry-costa-porto'].getAttribute('aria-label')!, /Travessia bloqueada/);
});

test('position setters follow rounded movement and visibility changes for every control kind', t => {
    const { hud, state } = fixture(t);
    hud.update({ ...state, overview: true });
    const buttons = [hud.stageButtons[0], hud.travelButtons['ferry-costa-porto'], hud.overviewButtons[0]];
    const writes = positionWrites(buttons);
    const position = (point: WorldMapHudPoint | null) => {
        hud.positionNodes([point]);
        hud.positionTravelActions({ 'ferry-costa-porto': point });
        hud.positionOverviewWorlds([point]);
    };
    position({ x: 10.1, y: 20.1 }); writes.length = 0;
    position({ x: 10.49, y: 20.49 });
    assert.deepEqual(writes, [], 'Subpixel settling within the same pixel does not change the transform.');
    position({ x: 10.51, y: 20.51 });
    assert.deepEqual(writes, buttons.map((_, index) => ({ index, property: 'transform', value: 'translate(11px, 21px) translate(-50%, -100%)' })));
    writes.length = 0;
    position({ x: 11, y: 21, visible: false });
    assert.deepEqual(writes, buttons.map((_, index) => ({ index, property: 'hidden', value: true })));
    writes.length = 0;
    for (const point of [null, { x: NaN, y: 21 }, { x: 11, y: Infinity }, { x: 80, y: 90, visible: false }]) position(point);
    assert.deepEqual(writes, [], 'Hidden and invalid anchors never rewrite visibility or position.');
    position({ x: 11, y: 21 });
    assert.deepEqual(writes, buttons.map((_, index) => ({ index, property: 'hidden', value: false })));
    writes.length = 0;
    position(null);
    assert.deepEqual(writes, buttons.map((_, index) => ({ index, property: 'hidden', value: true })));
    writes.length = 0;
    position({ x: 30, y: 40 });
    assert.deepEqual(writes, buttons.flatMap((_, index) => [
        { index, property: 'hidden', value: false },
        { index, property: 'transform', value: 'translate(30px, 40px) translate(-50%, -100%)' },
    ]));
});

test('explicit legacy dock arrays still own visibility, availability and route overrides', t => {
    const { hud } = fixture(t);
    const docks = [{ x: 20, y: 150, available: true }, { x: 240, y: 150, available: false }];
    hud.positionNodes([], docks);
    const writes = positionWrites(hud.dockButtons);
    hud.positionNodes([], docks);
    assert.deepEqual(writes, []);
    hud.positionNodes([]);
    assert.deepEqual(writes, [], 'Omitting legacy docks leaves their positioning to the route pass.');
    assert.ok(hud.dockButtons.every(button => !button.hidden));
    hud.positionNodes([], []);
    assert.deepEqual(writes, hud.dockButtons.map((_, index) => ({ index, property: 'hidden', value: true })));
    writes.length = 0;
    hud.positionNodes([], []);
    assert.deepEqual(writes, [], 'An explicit empty legacy array still hides both docks.');
    hud.positionNodes([], docks);
    assert.match(hud.dockButtons[1].getAttribute('aria-label')!, /Travessia bloqueada/);
    hud.positionTravelActions({ 'ferry-costa-porto': { x: 300, y: 200, available: true } });
    assert.equal(hud.dockButtons[0].hidden, true);
    assert.equal(hud.dockButtons[1].hidden, false);
    assert.equal(hud.dockButtons[1].style.transform, 'translate(300px, 200px) translate(-50%, -100%)');
    assert.match(hud.dockButtons[1].getAttribute('aria-label')!, /Marcar destino da travessia/);
});

test('stationary panorama positioning preserves keyboard activation and disposal', t => {
    const { hud, state, calls } = fixture(t);
    hud.update({ ...state, overview: true });
    const points = Array.from({ length: 6 }, (_, n) => ({ x: 80 + n * 140, y: 160 }));
    hud.positionOverviewWorlds(points, true);
    const writes = positionWrites(hud.overviewButtons);
    for (let n = 0; n < 120; n++) hud.positionOverviewWorlds(points, true);
    assert.deepEqual(writes, []);
    const root = asElement(hud.root);
    root.dispatch('keydown', { key: 'ArrowRight', target: hud.overviewButtons[0] });
    assert.equal(asElement(hud.overviewButtons[1]).focusCount, 1);
    root.dispatch('keydown', { key: 'Enter', target: hud.root });
    assert.deepEqual(calls, ['world:1']);
    hud.setVisible(false); hud.setVisible(true);
    hud.positionOverviewWorlds(points, false);
    assert.deepEqual(writes, [], 'Changing name size or map visibility does not require new button anchors.');
    assert.equal(root.className.split(' ').includes('has-compact-island-names'), false);
    hud.dispose();
    assert.equal(root.listeners.get('keydown')?.length, 0);
    root.dispatch('keydown', { key: 'ArrowRight', target: hud.overviewButtons[0] });
    hud.overviewButtons[1].click();
    assert.equal(asElement(hud.overviewButtons[1]).focusCount, 1);
    assert.deepEqual(calls, ['world:1']);
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
