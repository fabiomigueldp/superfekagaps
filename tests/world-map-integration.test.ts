import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { type TestContext } from 'node:test';
import { STAGES } from '../src/adventure/campaign';
import { freshSave, ProgressStore, SAVE_KEY } from '../src/adventure/progress';
import { WorldGame } from '../src/adventure/WorldGame';
import { COSTA_ART_BOUNDS, FALLBACK_POINTS, fallbackMapMetadata, mapActorScale, parseMapMetadata } from '../src/adventure/WorldMapArt';
import { WorldMapView } from '../src/adventure/WorldMapView';
import { mapToScreen, type MapPoint } from '../src/adventure/WorldMapModel';
import { Input } from '../src/engine/Input';

type Listener = (event: any) => void;
/** Browser-order capture and bubbling, without device, network, timer or layout dependencies. */
class Surface {
    parent: Surface | null = null;
    readonly listeners = new Map<string, Array<{ listener: Listener; capture: boolean }>>();
    addEventListener(type: string, listener: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        const existing = this.listeners.get(type) ?? [];
        if (!existing.some(item => item.listener === listener && item.capture === capture))
            this.listeners.set(type, [...existing, { listener, capture }]);
    }
    removeEventListener(type: string, listener: Listener) {
        this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item.listener !== listener));
    }
    count(type: string) { return this.listeners.get(type)?.length ?? 0; }
    dispatch(type: string, detail: Record<string, unknown> = {}) {
        const event = { target: this, defaultPrevented: false, propagationStopped: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this.propagationStopped = true; }, ...detail };
        const path: Surface[] = [];
        for (let current: Surface | null = this; current; current = current.parent) path.push(current);
        for (const [surfaces, capture] of [[path.slice().reverse(), true], [path, false]] as const) {
            for (const surface of surfaces) {
                for (const entry of surface.listeners.get(type) ?? []) if (entry.capture === capture) entry.listener(event);
                if (event.propagationStopped) return event;
            }
        }
        return event;
    }
}

class Element extends Surface {
    children: Element[] = [];
    readonly attributes = new Map<string, string>();
    readonly style: Record<string, string> = {};
    className = '';
    private ownText = '';
    get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join(''); }
    set textContent(text: string) { this.ownText = text; this.children = []; }
    type = '';
    id = '';
    title = '';
    hidden = false;
    disabled = false;
    tabIndex = 0;
    width = 0;
    height = 0;
    isContentEditable = false;
    bounds = { x: 0, y: 0, left: 0, top: 0, width: 1200, height: 750 };
    focusCount = 0;
    readonly classList = {
        contains: (name: string) => this.className.split(/\s+/).includes(name),
        toggle: (name: string, enabled: boolean) => {
            const names = new Set(this.className.split(/\s+/).filter(Boolean));
            if (enabled) names.add(name); else names.delete(name);
            this.className = [...names].join(' '); return enabled;
        }
    };
    constructor(readonly tagName: string, private readonly focused: (element: Element) => void, readonly context?: any) { super(); }
    append(...elements: Element[]) { elements.forEach(element => { element.parent = this; this.children.push(element); }); }
    replaceChildren(...elements: Element[]) { this.children.forEach(child => child.parent = null); this.children = []; this.ownText = ''; this.append(...elements); }
    remove() {
        if (this.parent instanceof Element) this.parent.children = this.parent.children.filter(child => child !== this);
        this.parent = null;
    }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); if (key === 'class') this.className = value; }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
    removeAttribute(key: string) { this.attributes.delete(key); }
    getBoundingClientRect() { return { ...this.bounds, bottom: this.bounds.top + this.bounds.height, right: this.bounds.left + this.bounds.width }; }
    getContext() { return this.context; }
    focus() { this.focusCount++; this.focused(this); }
    click() { if (!this.disabled) this.dispatch('click'); }
    matches(selector: string) { return selector.split(',').some(item => item.trim().toUpperCase() === this.tagName); }
    closest(selector: string): Element | null {
        for (let current: Surface | null = this; current instanceof Element; current = current.parent)
            if (selector === '.world-map' ? current.classList.contains('world-map') : current.matches(selector)) return current;
        return null;
    }
}
class Button extends Element {}

function canvasContext() {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const target: Record<string, unknown> = { imageSmoothingEnabled: false };
    const context = new Proxy(target, {
        get(object, key: string) {
            if (key in object) return object[key];
            if (key === 'createLinearGradient' || key === 'createRadialGradient')
                return (...args: unknown[]) => { calls.push({ method: key, args }); return { addColorStop() {} }; };
            return (...args: unknown[]) => { calls.push({ method: key, args }); };
        }
    });
    return { context, calls };
}

function mapDOM(t: TestContext, reducedMotion = false) {
    const paint = canvasContext();
    let active: Element | null = null;
    const focused = (element: Element) => { active = element; };
    const body = new Element('BODY', focused);
    const gameCanvas = new Element('CANVAS', focused, paint.context);
    gameCanvas.id = 'game-canvas'; body.append(gameCanvas);
    const documentMock = Object.assign(new Surface(), { body, hidden: false,
        createElement: (tag: string) => tag === 'button' ? new Button('BUTTON', focused) : new Element(tag.toUpperCase(), focused, paint.context),
        createElementNS: (_namespace: string, tag: string) => new Element(tag.toUpperCase(), focused),
        getElementById: (id: string) => id === 'game-canvas' ? gameCanvas : null });
    const media = Object.assign(new Surface(), { matches: reducedMotion });
    const windowMock = Object.assign(new Surface(), { devicePixelRatio: 3, matchMedia: () => media });
    body.parent = documentMock; documentMock.parent = windowMock;
    const observers: Array<{ target: Element | null; targets: Element[]; disconnected: boolean; callback: () => void }> = [];
    class Observer {
        target: Element | null = null;
        targets: Element[] = [];
        disconnected = false;
        constructor(readonly callback: () => void) { observers.push(this); }
        observe(target: Element) { this.target = target; this.targets.push(target); }
        disconnect() { this.target = null; this.targets = []; this.disconnected = true; }
    }
    const images: MockImage[] = [];
    class MockImage {
        decoding = ''; src = ''; onload: (() => void) | null = null; onerror: (() => void) | null = null;
        constructor() { images.push(this); }
    }
    const fetches: Array<{ url: string; signal: AbortSignal; resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];
    const fetchMock = (url: string, options: { signal: AbortSignal }) => new Promise((resolve, reject) => {
        fetches.push({ url, signal: options.signal, resolve, reject });
    });
    const restore: Array<() => void> = [];
    for (const [name, value] of Object.entries({ document: documentMock, window: windowMock, Image: MockImage,
        ResizeObserver: Observer, HTMLElement: Element, HTMLButtonElement: Button, fetch: fetchMock,
        requestAnimationFrame: () => assert.fail('The map must use the existing game loop, never start its own RAF.') })) {
        const original = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
        restore.push(() => { if (original) Object.defineProperty(globalThis, name, original); else Reflect.deleteProperty(globalThis, name); });
    }
    const events = { selected: [] as number[], entered: 0, exited: 0, unlocked: 0 };
    const view = new WorldMapView(gameCanvas as unknown as HTMLCanvasElement, {
        select: index => { events.selected.push(index); }, enter: () => { events.entered++; },
        exit: () => { events.exited++; }, unlockAudio: () => { events.unlocked++; }
    });
    t.after(() => { view.dispose(); restore.forEach(action => action()); });
    const internal = view as any;
    const root = view.root as unknown as Element;
    const descendants = (element: Element): Element[] => [element, ...element.children.flatMap(descendants)];
    const get = (className: string) => descendants(root).find(element => element.classList.contains(className))!;
    get('world-map-header').bounds = { x: 24, y: 22, left: 24, top: 22, width: 350, height: 72 };
    get('world-map-tools').bounds = { x: 900, y: 25, left: 900, top: 25, width: 276, height: 44 };
    get('world-map-footer').bounds = { x: 170, y: 556, left: 170, top: 556, width: 860, height: 182 };
    return { view, internal, root, get, events, gameCanvas, body, documentMock, windowMock, media, observers, images, fetches, paint,
        get active() { return active; },
        async finishAssets(metadata: unknown = fixtureMapMetadata(), imageSuccess = true) {
            // Existing single-island cases explicitly visit Costa before resolving its lazy request.
            if (!fetches.length) view.render(0, freshSave(), 0, '');
            images.forEach(image => imageSuccess ? image.onload?.() : image.onerror?.());
            fetches.forEach(request => request.resolve({ ok: true, json: async () => metadata }));
            await new Promise<void>(resolve => setImmediate(resolve));
        }
    };
}

const point = (value: { x: number; y: number }) => ({ x: value.x, y: value.y });
/** Complete authored export fixture; runtime fallback metadata deliberately has no routes. */
function fixtureMapMetadata(world = 1, overrides: Record<string, MapPoint> = {}) {
    const data = fallbackMapMetadata(world);
    Object.assign(data.nodes, overrides);
    for (let from = 0; from < 4; from++) data.routes[`${from}:${from + 1}`] = [data.nodes[`${world}-${from + 1}`], data.nodes[`${world}-${from + 2}`]];
    data.secretRoute = [data.nodes[`${world}-3`], data.nodes[`${world}-5`]];
    return data;
}
const flushAssets = () => new Promise<void>(resolve => setImmediate(resolve));
const dioramaName = (world: number) => ['costa-diorama', 'porto-diorama', 'fabrica-diorama'][world - 1];
async function finishWorld(h: ReturnType<typeof mapDOM>, world: number, metadata: unknown = fixtureMapMetadata(world), imageSuccess = true) {
    const image = h.images.find(image => image.src.endsWith(`${dioramaName(world)}.webp`));
    const request = h.fetches.find(request => request.url.endsWith(`${dioramaName(world)}.meta.json`));
    assert.ok(image && request, `World ${world} must already have been visited before its assets can settle.`);
    imageSuccess ? image.onload?.() : image.onerror?.();
    request.resolve({ ok: true, json: async () => metadata });
    await flushAssets();
}

for (const world of [1, 2, 3]) test(`island ${world} camera export retains all five authored nodes, adjacent routes and secret endpoints`, () => {
    const raw = JSON.parse(readFileSync(new URL(`../public/assets/world/map/${dioramaName(world)}.meta.json`, import.meta.url), 'utf8'));
    const data = parseMapMetadata(raw, world);
    assert.ok(data, 'The terrain camera export must be accepted by the runtime.');
    assert.deepEqual(Object.keys(data.routes).sort(), ['0:1', '1:2', '2:3', '3:4']);
    for (let n = 1; n <= 5; n++) {
        const node: MapPoint = data.nodes[`${world}-${n}`];
        assert.ok(node.x > 0 && node.x < 1 && node.y > 0 && node.y < 1);
        if (n < 5) {
            const route: MapPoint[] = data.routes[`${n - 1}:${n}`];
            assert.ok(route.length > 2, 'A path must follow the actual terrain, not only a straight node-to-node segment.');
            assert.deepEqual(point(route[0]), point(node));
            assert.deepEqual(point(route[route.length - 1]), point(data.nodes[`${world}-${n + 1}`]));
        }
    }
    assert.deepEqual(point(data.secretRoute[0]), point(data.nodes[`${world}-3`]));
    assert.deepEqual(point(data.secretRoute[data.secretRoute.length - 1]), point(data.nodes[`${world}-5`]));
});

test('metadata rejects incomplete or nonfinite node exports and malformed required paths', () => {
    for (const value of [null, undefined, 42, {}, { nodes: {} }]) assert.equal(parseMapMetadata(value), null);
    for (const value of [NaN, Infinity, -.01, 1.01, '0.5']) {
        const data = structuredClone(fixtureMapMetadata());
        (data.nodes['1-3'] as any).x = value;
        assert.equal(parseMapMetadata(data), null);
    }
    const data = fixtureMapMetadata();
    data.routes = { '0:1': [FALLBACK_POINTS[0], FALLBACK_POINTS[1]], '1:2': [FALLBACK_POINTS[1]],
        '3:4': [{ x: Infinity, y: .5 }, FALLBACK_POINTS[4]], '20:21': [FALLBACK_POINTS[0], FALLBACK_POINTS[1]] };
    data.secretRoute = [{ x: .5, y: NaN }];
    assert.equal(parseMapMetadata(data), null);
    assert.equal(parseMapMetadata(fallbackMapMetadata()), null, 'Runtime fallback is deliberately not an authored export.');
});

test('authored metadata requires every adjacent edge and aligned main and secret endpoints', () => {
    for (const world of [1, 2, 3]) {
        for (let from = 0; from < 4; from++) {
            const key = `${from}:${from + 1}`;
            const missing = fixtureMapMetadata(world); delete missing.routes[key];
            assert.equal(parseMapMetadata(missing, world), null, `${world}: missing ${key}`);
            for (const points of [[], [missing.nodes[`${world}-${from + 1}`]],
                [...fixtureMapMetadata(world).routes[key]].reverse(),
                [{ x: .01, y: .01 }, missing.nodes[`${world}-${from + 2}`]],
                [missing.nodes[`${world}-${from + 1}`], { x: .99, y: .99 }],
                [missing.nodes[`${world}-${from + 1}`], { x: NaN, y: .5 }, missing.nodes[`${world}-${from + 2}`]]]) {
                const invalid = fixtureMapMetadata(world); invalid.routes[key] = points;
                assert.equal(parseMapMetadata(invalid, world), null, `${world}: invalid ${key}`);
            }
        }
        for (const secretRoute of [undefined, [], [FALLBACK_POINTS[2]], [...fixtureMapMetadata(world).secretRoute].reverse(),
            [{ x: .01, y: .01 }, FALLBACK_POINTS[4]], [FALLBACK_POINTS[2], { x: Infinity, y: .9 }]])
            assert.equal(parseMapMetadata({ ...fixtureMapMetadata(world), secretRoute }, world), null);
        const rounded = fixtureMapMetadata(world);
        rounded.routes['0:1'] = rounded.routes['0:1'].map(p => ({ x: p.x + 1e-6, y: p.y - 1e-6 }));
        assert.ok(parseMapMetadata(rounded, world), 'Small export rounding is allowed without introducing visible connectors.');
        const extras = fixtureMapMetadata(world);
        extras.routes['20:21'] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
        assert.deepEqual(Object.keys(parseMapMetadata(extras, world)!.routes), ['0:1', '1:2', '2:3', '3:4']);
    }
});

test('metadata is world-specific and accepts only finite normalized silhouette bounds', () => {
    const data = fixtureMapMetadata(2);
    data.artBounds = { top: .1, bottom: .92 };
    assert.equal(parseMapMetadata(data), null, 'Porto metadata cannot pair with the Costa image.');
    assert.equal(parseMapMetadata(fixtureMapMetadata(), 2), null);
    assert.deepEqual(parseMapMetadata(data, 2), data);
    const legacy = structuredClone(data) as any;
    delete legacy.world;
    assert.equal(parseMapMetadata(legacy, 2)?.world, 2, 'Node IDs also identify older exports without an explicit world field.');
    for (const artBounds of [null, {}, { top: NaN, bottom: .9 }, { top: 0, bottom: Infinity },
        { top: -.1, bottom: .9 }, { top: .1, bottom: 1.1 }, { top: .8, bottom: .1 }, { top: .5, bottom: .5 }])
        assert.equal(parseMapMetadata({ ...data, artBounds }, 2), null);
    assert.equal(parseMapMetadata({ ...data, world: 1 }, 2), null);
    assert.equal(parseMapMetadata(data, NaN), null);
});

test('map show/hide remounts nothing, restores focus/tabindex and retains exactly one listener set', t => {
    const h = mapDOM(t);
    h.gameCanvas.setAttribute('tabindex', '7');
    const originalChildren = h.body.children.length;
    assert.equal(h.root.hidden, true);
    assert.equal(h.fetches.length, 0);
    assert.equal(h.images.length, 0);
    for (let iteration = 0; iteration < 3; iteration++) {
        h.view.show(iteration * 1000); h.view.show(iteration * 1000 + 1);
        h.view.render(0, freshSave(), iteration * 1000 + 2, '');
        assert.equal(h.root.hidden, false);
        assert.equal(h.active, h.root);
        assert.equal(h.gameCanvas.getAttribute('tabindex'), '-1');
        assert.equal(h.gameCanvas.getAttribute('aria-hidden'), 'true');
        assert.equal(h.gameCanvas.style.visibility, 'hidden');
        assert.equal(h.body.children.length, originalChildren);
        assert.equal(h.root.count('keydown'), 1);
        assert.equal(h.windowMock.count('resize'), 1);
        assert.equal(h.media.count('change'), 1);
        h.view.hide(); h.view.hide();
        assert.equal(h.root.hidden, true);
        assert.equal(h.active, h.gameCanvas);
        assert.equal(h.gameCanvas.getAttribute('tabindex'), '7');
        assert.equal(h.gameCanvas.getAttribute('aria-hidden'), null);
        assert.equal(h.gameCanvas.style.visibility, '');
    }
    assert.equal(h.root.focusCount, 3);
    assert.equal(h.gameCanvas.focusCount, 3);
    assert.equal(h.observers.length, 1);
    h.view.dispose();
    assert.equal(h.body.children.length, originalChildren - 1);
    assert.equal(h.windowMock.count('resize'), 0);
    assert.equal(h.media.count('change'), 0);
    assert.equal(h.root.count('keydown'), 0);
    assert.ok(h.observers[0].disconnected);
    assert.ok(h.fetches[0].signal.aborted);
});

test('disposing during asset fetch cannot resurrect the map or apply late assets', async t => {
    const h = mapDOM(t);
    h.view.render(0, freshSave(), 0, ''); h.view.dispose();
    await h.finishAssets();
    assert.equal(h.root.parent, null);
    assert.equal(h.root.hidden, true);
    assert.equal(h.internal.assets.island, null);
    assert.equal(h.gameCanvas.getAttribute('tabindex'), null);
    assert.equal(h.gameCanvas.style.visibility, '');
    h.root.dispatch('keydown', { key: 'ArrowRight' });
    assert.deepEqual(h.events.selected, []);
});

test('art requires matching valid metadata and failures keep all stage selections usable', async t => {
    const h = mapDOM(t);
    await h.finishAssets({ nodes: {} });
    assert.equal(h.internal.assets.island, null, 'Actual terrain must never use guessed node coordinates.');
    for (let index = 0; index < STAGES.length; index++) {
        h.view.render(index, freshSave(), index * 16, '');
        assert.equal(h.get('world-map-stage-title').textContent, STAGES[index].name);
        assert.equal(h.get('world-map-play').disabled, index !== 0);
    }
});

test('the map uses capped device-resolution canvas, responds to resize and updates accessible state', t => {
    const h = mapDOM(t, true), save = freshSave();
    h.view.render(0, save, 0, 'Storage warning');
    const canvas = h.get('world-map-art');
    assert.equal(canvas.width, 2400); assert.equal(canvas.height, 1500);
    assert.equal(h.paint.context.imageSmoothingEnabled, true);
    assert.equal(h.get('world-map-warning').textContent, 'Storage warning');
    assert.equal(h.get('world-map-warning').hidden, false);
    assert.equal(h.get('world-map-play').disabled, false);
    assert.match(h.get('world-map-sr').textContent, /Disponível/);
    h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 390, height: 620 };
    h.windowMock.devicePixelRatio = 1.5; h.observers[0].callback();
    save.completed.push('1-1'); save.seals.push('1-1:s1');
    h.view.render(0, save, 16, 'Storage warning', 'Conclua o caminho anterior.');
    assert.equal(canvas.width, 585); assert.equal(canvas.height, 930);
    assert.match(h.get('world-map-play').textContent, /de novo/);
    assert.match(h.get('world-map-seals').textContent, /1\/3/);
    assert.match(h.get('world-map-sr').textContent, /Concluída/);
    assert.equal(h.get('world-map-warning').textContent, 'Conclua o caminho anterior.');
    h.view.render(2, save, 32, '');
    assert.equal(h.get('world-map-play').disabled, true);
    assert.equal(h.get('world-map-warning').hidden, true);
    assert.match(h.get('world-map-sr').textContent, /Bloqueada/);
});

test('reduced motion snaps authored travel and freezes time-driven decorative painting', async t => {
    const h = mapDOM(t, true), data = fixtureMapMetadata();
    data.routes['0:1'] = [data.nodes['1-1'], { x: .2, y: .5 }, data.nodes['1-2']];
    await h.finishAssets(data);
    h.view.render(0, freshSave(), 0, '');
    h.view.render(1, freshSave(), 16, '');
    assert.ok(Math.abs(h.internal.marker.x - data.nodes['1-2'].x) < 1e-12);
    assert.ok(Math.abs(h.internal.marker.y - data.nodes['1-2'].y) < 1e-12);
    const camera = structuredClone(h.internal.camera);
    h.paint.calls.length = 0; h.view.render(1, freshSave(), 32, '');
    const painting = [...h.paint.calls];
    h.paint.calls.length = 0; h.view.render(1, freshSave(), 4000, '');
    assert.deepEqual(h.internal.camera, camera);
    assert.deepEqual(h.paint.calls, painting, 'Waves, gulls, character and camera must not animate under reduced motion.');
});

test('changing the reduced-motion preference stops an in-flight journey on its destination', async t => {
    const h = mapDOM(t), data = fixtureMapMetadata();
    data.routes['0:1'] = [data.nodes['1-1'], { x: .2, y: .5 }, data.nodes['1-2']];
    await h.finishAssets(data);
    h.view.render(0, freshSave(), 0, '');
    h.view.render(1, freshSave(), 100, '');
    assert.notDeepEqual(h.internal.marker, data.nodes['1-2']);
    h.media.matches = true; h.media.dispatch('change');
    h.view.render(1, freshSave(), 101, '');
    assert.ok(Math.abs(h.internal.marker.x - data.nodes['1-2'].x) < 1e-12);
    assert.ok(Math.abs(h.internal.marker.y - data.nodes['1-2'].y) < 1e-12);
    assert.equal(h.internal.travelDuration, 0);
});

test('keyboard navigation focuses the destination and hidden/modifier/repeat events stay inert', t => {
    const h = mapDOM(t);
    h.view.render(0, freshSave(), 0, '');
    const event = h.root.dispatch('keydown', { key: 'ArrowRight' });
    assert.deepEqual(h.events.selected, [1]);
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);
    assert.equal(h.active, h.internal.nodes[1]);
    h.root.dispatch('keydown', { key: 'ArrowRight', repeat: true });
    h.root.dispatch('keydown', { key: 'ArrowRight', ctrlKey: true });
    h.root.dispatch('keydown', { key: 'Enter' });
    assert.equal(h.events.entered, 1);
    h.root.dispatch('keydown', { key: 'Escape' });
    assert.equal(h.events.exited, 1);
    h.view.hide();
    h.root.dispatch('keydown', { key: 'ArrowRight' });
    h.get('world-map-play').click();
    assert.deepEqual(h.events.selected, [1]);
    assert.equal(h.events.entered, 1);
});

function worldHarness(ephemeral = false) {
    const values = new Map<string, string>(), writes: string[] = [], calls: string[] = [];
    const store = new ProgressStore({ getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); writes.push(value); } });
    const game = Object.create(WorldGame.prototype) as any;
    const mapRenders: unknown[][] = [];
    Object.assign(game, { store, ephemeral, state: 'map', selection: 0, time: 1234, toast: '', toastTimer: 0,
        buttons: [{ run() {} }], menuSelection: 0,
        input: { reset() { calls.push('reset'); }, setMenuMode(value: boolean) { calls.push(`menu:${value}`); } },
        audio: { cancelSpeech() {}, setDying() {}, pause() {}, select() {}, unlock() { calls.push('unlock'); },
            sfx(name: string) { calls.push(`sfx:${name}`); } },
        renderer: { startScene() { calls.push('startScene'); }, getContext: () => ({}), present() { calls.push('present'); } },
        mapView: { render(...args: unknown[]) { mapRenders.push(args); }, show() { calls.push('map:show'); }, hide() { calls.push('map:hide'); } },
        renderTitle() { calls.push('title'); }, renderMap() { calls.push('legacyMap'); } });
    return { game, store, values, writes, calls, mapRenders };
}

test('WorldGame map render bypasses the entire pixel renderer and sends current warnings/toasts to the high-resolution view', () => {
    const h = worldHarness();
    h.game.selection = 8; h.store.warning = 'Storage warning'; h.game.toast = 'Locked'; h.game.toastTimer = 100;
    h.game.render();
    assert.equal(h.mapRenders.length, 1);
    assert.deepEqual(h.mapRenders[0], [8, h.store.save, 1234, 'Storage warning', 'Locked']);
    assert.equal(h.calls.includes('startScene'), false);
    assert.equal(h.calls.includes('present'), false);
    assert.equal(h.calls.includes('legacyMap'), false);
    assert.deepEqual(h.game.buttons, []);
    h.game.toastTimer = 0; h.game.render();
    assert.equal(h.mapRenders[1][4], '');
    h.game.change('title'); h.game.render();
    assert.ok(h.calls.includes('map:hide'));
    assert.ok(h.calls.includes('startScene'));
    assert.ok(h.calls.includes('title'));
    assert.ok(h.calls.includes('present'));
});

test('intentional ephemeral editor maps suppress storage warnings while normal failures and all toasts stay visible', () => {
    for (const ephemeral of [true, false]) {
        const h = worldHarness(ephemeral), store = new ProgressStore(null);
        h.game.store = store;
        assert.equal(store.persist(), false);
        assert.match(store.warning, /Armazenamento indisponível/);
        h.game.toast = 'Conclua o caminho anterior.'; h.game.toastTimer = 100;
        h.game.render();
        assert.equal(h.mapRenders[0][3], ephemeral ? '' : store.warning);
        assert.equal(h.mapRenders[0][4], 'Conclua o caminho anterior.');
        assert.match(store.warning, /Armazenamento indisponível/, 'Presentation does not alter the store or save behavior.');
    }
    const normal = worldHarness();
    const failedRead = new ProgressStore({ getItem() { throw Error('Storage denied'); }, setItem() { assert.fail('Protected progress must not be overwritten.'); } });
    normal.game.store = failedRead; normal.game.render();
    assert.match(String(normal.mapRenders[0][3]), /Não foi possível abrir o progresso/);
    assert.equal(failedRead.persist(), false);
});

test('locked selection stays on the map, while an unlocked selection resumes that exact stage', () => {
    const h = worldHarness(), loads: unknown[][] = [];
    h.game.load = (...args: unknown[]) => { loads.push(args); };
    h.game.selection = 1; h.game.enterSelected();
    assert.equal(h.game.state, 'map');
    assert.deepEqual(loads, []);
    assert.match(h.game.toast, /Conclua/);
    assert.ok(h.game.toastTimer > 0);
    h.store.save.completed.push('1-1'); h.game.enterSelected();
    assert.deepEqual(loads, [['1-2', true]]);
});

test('returning to map restores the selected save destination and persists it without disturbing progression', () => {
    const h = worldHarness();
    h.store.save.selected = '3-4'; h.store.save.completed = ['1-1', '1-2']; h.store.save.seals = ['1-1:s1'];
    h.store.save.checkpoint = { stage: '3-4', index: 1, helmet: true };
    const expected = structuredClone(h.store.save);
    h.game.state = 'paused'; h.game.selection = 0; h.game.toMap();
    assert.equal(h.game.state, 'map'); assert.equal(h.game.selection, 13);
    assert.deepEqual(h.store.save, expected);
    assert.deepEqual(JSON.parse(h.values.get(SAVE_KEY)!), expected);
    assert.ok(h.calls.includes('menu:true'));
});

test('map selection clamps and persists every navigation target without changing campaign unlocks', () => {
    const h = worldHarness(), before = structuredClone(h.store.save);
    for (const [index, selection] of [[NaN, 0], [-50, 0], [4.9, 4], [29, 29], [100, 29], [13, 13]]) {
        h.game.selectMap(index);
        assert.equal(h.game.selection, selection);
        assert.equal(h.store.save.selected, STAGES[selection].id);
        assert.equal(JSON.parse(h.values.get(SAVE_KEY)!).selected, STAGES[selection].id);
        assert.deepEqual(h.store.save.completed, before.completed);
        assert.deepEqual(h.store.save.seals, before.seals);
        assert.deepEqual(h.store.save.secrets, before.secrets);
    }
    assert.equal(h.writes.length, 6);
    assert.equal(h.calls.filter(call => call === 'sfx:coin').length, 6);
});

test('capture-phase gameplay Input and global WorldGame menus leave native map buttons to the map', t => {
    const h = mapDOM(t), input = new Input(), game = worldHarness().game;
    input.setMenuMode(true);
    h.windowMock.addEventListener('keydown', event => game.menuKey(event));
    let strayEntries = 0;
    game.enterSelected = () => { strayEntries++; };
    h.view.render(0, freshSave(), 0, '');
    const play = h.get('world-map-play');
    for (const key of ['Enter', ' ']) {
        const event = play.dispatch('keydown', { key, code: key === ' ' ? 'Space' : 'Enter' });
        assert.equal(event.defaultPrevented, false, 'Native button activation must survive Input capture and the global menu listener.');
        // Default browser button activation occurs after keydown (Enter) or keyup (Space).
        play.click();
        play.dispatch('keyup', { key, code: key === ' ' ? 'Space' : 'Enter' });
    }
    input.update();
    assert.equal(h.events.entered, 2);
    assert.equal(strayEntries, 0);
    assert.equal(input.getState().start, false);
    assert.equal(input.getState().jump, false);
    assert.equal(input.getState().jumpPressed, false);
    h.root.dispatch('keydown', { key: 'ArrowRight', code: 'ArrowRight' });
    input.update();
    assert.deepEqual(h.events.selected, [1]);
    assert.equal(input.getState().right, false, 'Map arrows must not prime the character movement state.');
    assert.equal(game.selection, 0, 'The root handles the navigation once; the window handler must not repeat it.');
    h.view.hide(); input.setMenuMode(false);
    const gameplay = h.gameCanvas.dispatch('keydown', { key: 'ArrowRight', code: 'ArrowRight' });
    assert.equal(gameplay.defaultPrevented, true);
    input.update();
    assert.equal(input.getState().right, true, 'Normal canvas gameplay controls must still work.');
});

test('native node clicks select once, selected nodes enter, and world rail navigation remains available when locked', t => {
    const h = mapDOM(t);
    h.view.render(0, freshSave(), 0, '');
    h.internal.nodes[1].click();
    assert.deepEqual(h.events.selected, [1]); assert.equal(h.events.entered, 0);
    h.view.render(1, freshSave(), 16, '');
    h.internal.nodes[1].click();
    assert.equal(h.events.entered, 1, 'The game owns the lock check for a selected-node activation.');
    assert.equal(h.get('world-map-play').disabled, true);
    h.internal.worlds[5].click();
    assert.deepEqual(h.events.selected, [1, 25]);
    assert.equal(h.events.unlocked, 3);
});

test('WorldGame lazy map creation is reused across repeated renders and menu round trips', t => {
    const h = mapDOM(t), g = worldHarness();
    h.view.dispose();
    g.game.mapView = null; g.game.mapCanvas = h.gameCanvas;
    g.game.render();
    const view = g.game.mapView as WorldMapView;
    try {
        assert.ok(view instanceof WorldMapView);
        const children = h.body.children.length, observers = h.observers.length, requests = h.fetches.length;
        g.game.render(); g.game.change('title'); g.game.render();
        assert.equal(view.root.hidden, true);
        g.game.toMap(); g.game.render();
        assert.equal(view.root.hidden, false);
        assert.equal(g.game.mapView, view);
        assert.equal(h.body.children.length, children);
        assert.equal(h.observers.length, observers);
        assert.equal(h.fetches.length, requests);
        assert.equal(h.windowMock.count('resize'), 1);
        assert.equal(h.media.count('change'), 1);
    } finally { view.dispose(); }
});

test('late successful art uses the currently selected stage and matching exported geometry', async t => {
    const h = mapDOM(t, true), metadata = fixtureMapMetadata(1, { '1-4': { x: .71, y: .61 } });
    h.view.render(3, freshSave(), 0, '');
    assert.deepEqual(h.internal.marker, FALLBACK_POINTS[3]);
    await h.finishAssets(metadata);
    h.view.render(3, freshSave(), 100, '');
    assert.equal(h.internal.assets.island, h.images[0]);
    assert.deepEqual(h.internal.marker, metadata.nodes['1-4']);
    assert.equal(h.get('world-map-stage-title').textContent, STAGES[3].name);
});

test('a failed terrain image never applies its metadata over fallback art', async t => {
    const h = mapDOM(t, true), metadata = fixtureMapMetadata(1, { '1-1': { x: .7, y: .2 } });
    await h.finishAssets(metadata, false);
    h.view.render(0, freshSave(), 0, '');
    assert.equal(h.internal.assets.island, null);
    assert.deepEqual(h.internal.marker, FALLBACK_POINTS[0]);
});

test('uppercase navigation at campaign boundaries is consumed without another selection', t => {
    const h = mapDOM(t);
    h.view.render(0, freshSave(), 0, '');
    for (const key of ['A', 'W']) {
        const event = h.root.dispatch('keydown', { key });
        assert.equal(event.defaultPrevented, true);
        assert.equal(event.propagationStopped, true);
    }
    h.view.render(29, freshSave(), 16, '');
    for (const key of ['D', 'S']) assert.equal(h.root.dispatch('keydown', { key }).defaultPrevented, true);
    assert.deepEqual(h.events.selected, []);
});

test('later islands keep their wider camera framing and DPR changes do not need a resize event', t => {
    const h = mapDOM(t, true);
    h.view.render(0, freshSave(), 0, '');
    const costaZoom = h.internal.camera.zoom;
    h.view.render(5, freshSave(), 16, '');
    assert.ok(h.internal.camera.zoom < costaZoom);
    assert.equal(h.internal.camera.zoom, .82);
    h.windowMock.devicePixelRatio = 1;
    h.view.render(5, freshSave(), 32, '');
    assert.equal(h.get('world-map-art').width, 1200);
    assert.equal(h.get('world-map-art').height, 750);
});

test('ultrawide rendering stays within the 4 MP rounding budget and does not resize its backing canvas every frame', t => {
    const h = mapDOM(t, true), canvas = h.get('world-map-art');
    h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 5120, height: 1440 };
    let width = 0, height = 0, writes = 0;
    Object.defineProperties(canvas, {
        width: { get: () => width, set: (value: number) => { width = value; writes++; } },
        height: { get: () => height, set: (value: number) => { height = value; writes++; } }
    });
    h.view.render(0, freshSave(), 0, '');
    assert.ok(width * height <= 4_000_000 + width + height, 'Allow only integer dimension rounding beyond four million backing pixels.');
    assert.ok(width * height > 3_990_000, 'A large display should use the available resolution budget.');
    assert.ok(h.internal.dpr < 1);
    assert.equal(h.internal.screenDpr, 3);
    assert.equal(writes, 2);
    for (const time of [16, 32, 48, 64]) h.view.render(0, freshSave(), time, '');
    assert.equal(writes, 2, 'A budget-limited DPR must not be mistaken for a changed device DPR each frame.');
    h.windowMock.devicePixelRatio = 4;
    h.view.render(0, freshSave(), 80, '');
    h.view.render(0, freshSave(), 96, '');
    assert.equal(writes, 4, 'An actual display DPR change updates the backing dimensions exactly once.');
});

test('WorldGame skips hidden-document map painting and resumes exactly when visible', t => {
    const h = mapDOM(t), g = worldHarness();
    h.documentMock.hidden = true;
    g.game.render(); g.game.render();
    assert.equal(g.mapRenders.length, 0);
    assert.equal(g.calls.includes('startScene'), false);
    h.documentMock.hidden = false;
    g.game.render();
    assert.equal(g.mapRenders.length, 1);
    assert.equal(g.calls.includes('startScene'), false);
});

test('settling assets preserves the input selection before the next rendered frame', async t => {
    const h = mapDOM(t);
    h.view.render(3, freshSave(), 0, '');
    await h.finishAssets();
    // Asset promises can settle between a RAF and the next physical key/click event.
    h.internal.nodes[3].click();
    assert.equal(h.events.entered, 1, 'The selected node must remain selected before any subsequent render.');
    h.root.dispatch('keydown', { key: 'ArrowRight' });
    assert.deepEqual(h.events.selected, [4], 'Navigation must continue from 1-4, never the geometry invalidation sentinel.');
});


test('the global mute shortcut is still available while semantic map controls own focus', t => {
    const h = mapDOM(t), input = new Input();
    input.setMenuMode(true); h.view.render(0, freshSave(), 0, '');
    const event = h.root.dispatch('keydown', { key: 'm', code: 'KeyM' });
    input.update();
    assert.equal(event.defaultPrevented, true);
    assert.equal(input.consumeMute(), true);
    assert.equal(input.consumeMute(), false);
    h.root.dispatch('keyup', { key: 'm', code: 'KeyM' });
});


test('a secret from a later island never reuses Costa terrain coordinates for travel', async t => {
    const h = mapDOM(t, true), metadata = fixtureMapMetadata();
    metadata.secretRoute = [metadata.nodes['1-3'], { x: .1, y: .1 }, metadata.nodes['1-5']];
    await h.finishAssets(metadata);
    const save = freshSave(); save.secrets.push('2-3');
    h.view.render(7, save, 0, ''); h.view.render(9, save, 100, '');
    assert.equal(h.internal.travel.length, 1);
    assert.deepEqual(h.internal.marker, FALLBACK_POINTS[4]);
});


test('two distinct directional presses before the next frame advance two stages without stale input', t => {
    const h = mapDOM(t); h.view.render(0, freshSave(), 0, '');
    h.root.dispatch('keydown', { key: 'ArrowRight' });
    h.root.dispatch('keyup', { key: 'ArrowRight' });
    h.root.dispatch('keydown', { key: 'ArrowRight' });
    assert.deepEqual(h.events.selected, [1, 2]);
});

test('reduced-motion idle frames avoid all canvas work but selection, panorama, progress and resize repaint', t => {
    const h = mapDOM(t, true), save = freshSave();
    h.view.render(0, save, 0, ''); h.paint.calls.length = 0;
    for (let frame = 1; frame <= 120; frame++) h.view.render(0, save, frame * 16, '');
    assert.equal(h.paint.calls.length, 0, 'A static reduced-motion map should not copy its backing store 60 times per second.');
    h.internal.overviewButton.click(); h.view.render(0, save, 2000, '');
    assert.ok(h.paint.calls.some(call => call.method === 'clearRect'));
    h.paint.calls.length = 0; save.seals.push('1-1:s1'); h.view.render(0, save, 2016, '');
    assert.ok(h.paint.calls.some(call => call.method === 'clearRect'));
    h.paint.calls.length = 0; h.internal.scene.bounds.width = 800; h.observers[0].callback(); h.view.render(0, save, 2032, '');
    assert.ok(h.paint.calls.some(call => call.method === 'clearRect'));
    h.paint.calls.length = 0; h.view.render(1, save, 2048, '');
    assert.ok(h.paint.calls.some(call => call.method === 'clearRect'));
});

test('retargeting mid-walk preserves the eased foot position and visits the remaining authored bend', async t => {
    const h = mapDOM(t), data = fixtureMapMetadata();
    const bend = { x: .18, y: .42 };
    data.routes['0:1'] = [data.nodes['1-1'], bend, data.nodes['1-2']];
    data.routes['1:2'] = [data.nodes['1-2'], { x: .45, y: .50 }, data.nodes['1-3']];
    await h.finishAssets(data);
    h.view.render(0, freshSave(), 0, ''); h.view.render(1, freshSave(), 100, '');
    h.view.render(1, freshSave(), 300, ''); const feet = { ...h.internal.marker };
    h.view.render(2, freshSave(), 300, '');
    assert.deepEqual(h.internal.marker, feet);
    assert.ok(h.internal.travel.some((point: MapPoint) => point.x === bend.x && point.y === bend.y));
    const firstArrival = h.internal.travel.findIndex((point: MapPoint) => point.x === data.nodes['1-2'].x && point.y === data.nodes['1-2'].y);
    assert.ok(firstArrival > 0, 'Feka reaches the old edge endpoint before departing on the next edge.');
});

test('all selected node hitboxes and focus rings stay inside short-landscape map scenes', async t => {
    const { mapToScreen } = await import('../src/adventure/WorldMapModel');
    const { mapActorScale } = await import('../src/adventure/WorldMapArt');
    const h = mapDOM(t, true);
    const data = JSON.parse(readFileSync(new URL('../public/assets/world/map/costa-diorama.meta.json', import.meta.url), 'utf8'));
    await h.finishAssets(data);
    for (const [width, height] of [[844, 225], [667, 210], [896, 249], [390, 341], [390, 585]]) {
        h.internal.scene.bounds = { ...h.internal.scene.bounds, width, height }; h.observers[0].callback();
        for (let selected = 0; selected < 5; selected++) {
            h.view.render(selected, freshSave(), 4000 + selected * 32, '');
            const camera = h.internal.camera;
            for (let node = 0; node < 5; node++) {
                const p = mapToScreen(data.nodes[`1-${node + 1}`], camera);
                const top = p.y - (width < 600 ? 54 : 58) - (node === selected ? mapActorScale(camera) * 26 + 4 : 0) - 8;
                assert.ok(top >= 0, `${width}×${height} selected ${selected + 1}, node ${node + 1}: top ${top}`);
                assert.ok(p.y + 8 <= height, `${width}×${height} node ${node + 1} bottom exceeds scene`);
            }
        }
    }
});

test('map assets honor relative and subdirectory deployment bases', async () => {
    const { mapAssetPrefix } = await import('../src/adventure/WorldMapArt');
    for (const [base, expected] of [['/', '/assets/world/map/'], ['./', './assets/world/map/'], ['/game/', '/game/assets/world/map/'], ['/game', '/game/assets/world/map/']]) {
        assert.equal(mapAssetPrefix(base), expected);
        assert.equal(new URL(mapAssetPrefix(base) + 'costa-diorama.webp', 'https://example.com/game/index.html').pathname,
            base === '/' ? '/assets/world/map/costa-diorama.webp' : '/game/assets/world/map/costa-diorama.webp');
    }
});

for (const world of [2, 3]) test(`first visiting island ${world} requests only its main pair and revisits never duplicate requests`, t => {
    const h = mapDOM(t, true);
    const offset = (world - 1) * 5;
    assert.equal(h.images.length, 0);
    assert.equal(h.fetches.length, 0);
    h.view.render(offset + 2, freshSave(), 0, '');
    assert.deepEqual(h.images.map(image => image.src), [`/assets/world/map/${dioramaName(world)}.webp`]);
    assert.deepEqual(h.fetches.map(request => request.url), [`/assets/world/map/${dioramaName(world)}.meta.json`]);
    assert.equal(h.internal.metadata.world, world);
    for (const selection of [offset + 3, 15, 29, offset + 2]) h.view.render(selection, freshSave(), 16, '');
    assert.equal(h.images.length, 1, 'Unconverted islands make no speculative image requests.');
    assert.equal(h.fetches.length, 1, 'A pending request is cached on repeated visits too.');
    assert.equal(h.get('world-map-stage-number').textContent, `${world}-3`);
    assert.equal(h.get('world-map-stage-title').textContent, STAGES[offset + 2].name);
    assert.equal(h.get('world-map-chapter').textContent, 'Caminho bloqueado');
});

test('Porto and Fábrica describe their own landmarks, mechanisms and encounters', t => {
    const h = mapDOM(t, true), save = freshSave();
    h.view.render(7, save, 0, '');
    assert.equal(h.get('world-map-stage-title').textContent, 'Entre os Contêineres');
    assert.match(h.get('world-map-description').textContent, /passarelas de manutenção/);
    save.completed.push('1-5', '2-2');
    h.view.render(7, save, 32, '');
    assert.equal(h.get('world-map-chapter').textContent, 'O pátio de contêineres');
    save.completed.push('2-5');
    const landmarks = ['O recebimento', 'A linha de envase', 'Os tanques de mistura', 'Sob pressão', 'O controle de qualidade'];
    const mechanisms = [/Barris.*esteira/, /esteira.*linha de envase/, /tanques.*jatos.*manutenção/, /esteiras e jatos/, /Calabrezzo.*barril/];
    for (let stage = 0; stage < 5; stage++) {
        if (stage > 0) save.completed.push(`3-${stage}`);
        h.view.render(10 + stage, save, 64 + stage * 16, '');
        assert.equal(h.get('world-map-title').textContent, 'Fábrica de Suco');
        assert.equal(h.get('world-map-stage-title').textContent, STAGES[10 + stage].name);
        assert.equal(h.get('world-map-chapter').textContent, landmarks[stage]);
        assert.match(h.get('world-map-description').textContent, mechanisms[stage]);
        assert.equal(h.get('world-map-encounter').hidden, stage !== 4);
        assert.equal(h.get('world-map-seals').hidden, stage === 4);
        assert.equal(h.get('world-map-play').disabled, false);
    }
});

test('the main Costa pair becomes visible while optional scenery remains pending', async t => {
    const h = mapDOM(t, true), data = fixtureMapMetadata(1, { '1-3': { x: .43, y: .69 } });
    h.view.render(2, freshSave(), 0, '');
    h.images[0].onload?.(); await flushAssets();
    assert.equal(h.internal.assets.island, null, 'An image alone must not use guessed coordinates.');
    h.fetches[0].resolve({ ok: true, json: async () => data }); await flushAssets();
    assert.equal(h.internal.assets.island, h.images[0]);
    assert.equal(h.internal.assets.shadow, null);
    assert.equal(h.internal.assets.port, null);
    h.paint.calls.length = 0;
    h.view.render(2, freshSave(), 16, '');
    assert.deepEqual(h.internal.marker, data.nodes['1-3']);
    assert.ok(h.paint.calls.some(call => call.method === 'drawImage' && call.args[0] === h.images[0]));
    const painted = h.paint.calls.length;
    h.view.render(2, freshSave(), 32, '');
    assert.equal(h.paint.calls.length, painted, 'Reduced-motion rendering becomes idle after the ready pair is painted.');
    const shadow = h.images.find(image => image.src.endsWith('costa-shadow.webp'))!;
    shadow.onload?.(); await flushAssets();
    assert.equal(h.internal.geometryDirty, false, 'A late shadow must not restart the actor path.');
    h.view.render(2, freshSave(), 48, '');
    assert.ok(h.paint.calls.length > painted, 'A newly available optional layer invalidates reduced-motion paint.');
    assert.deepEqual(h.internal.marker, data.nodes['1-3']);
});

test('metadata settling before the main image keeps fallback until the matching image arrives', async t => {
    const h = mapDOM(t, true), data = fixtureMapMetadata(2, { '2-5': { x: .6, y: .42 } });
    h.view.render(9, freshSave(), 0, '');
    h.fetches[0].resolve({ ok: true, json: async () => data }); await flushAssets();
    assert.equal(h.internal.assets.island, null);
    assert.deepEqual(h.internal.marker, FALLBACK_POINTS[4]);
    h.images[0].onload?.(); await flushAssets();
    h.view.render(9, freshSave(), 16, '');
    assert.equal(h.internal.assets.island, h.images[0]);
    assert.deepEqual(h.internal.marker, data.nodes['2-5']);
});

for (const currentWorld of [2, 3]) test(`three-island rapid switches isolate late completions while island ${currentWorld} is visible`, async t => {
    const h = mapDOM(t, true), costa = fixtureMapMetadata(1, { '1-1': { x: .24, y: .66 } }),
        porto = fixtureMapMetadata(2, { '2-3': { x: .47, y: .68 } }),
        fabrica = fixtureMapMetadata(3, { '3-4': { x: .64, y: .43 } });
    const current = currentWorld === 2 ? porto : fabrica, stale = currentWorld === 2 ? fabrica : porto;
    const selection = currentWorld === 2 ? 7 : 13;
    h.view.render(0, freshSave(), 0, '');
    for (const [frame, selected] of [7, 10, 7, 13, selection].entries()) h.view.render(selected, freshSave(), 16 + frame * 16, '');
    await finishWorld(h, stale.world, stale);
    assert.equal(h.internal.assets.island, null, 'A late completion cannot replace another island’s visible fallback.');
    assert.equal(h.internal.metadata.world, currentWorld);
    assert.equal(h.internal.geometryDirty, false);
    await finishWorld(h, currentWorld, current);
    h.internal.nodes[selection % 5].click();
    assert.equal(h.events.entered, 1, 'Settling geometry retains the selected stage before the next frame.');
    h.view.render(selection, freshSave(), 96, '');
    const currentImage = h.internal.assets.island;
    assert.deepEqual(h.internal.marker, current.nodes[STAGES[selection].id]);
    const counts = [h.images.length, h.fetches.length], painted = h.paint.calls.length;
    await finishWorld(h, 1, costa);
    h.images.find(image => image.src.endsWith('costa-shadow.webp'))!.onload?.(); await flushAssets();
    h.view.render(selection, freshSave(), 112, '');
    assert.equal(h.paint.calls.length, painted, 'Old-island main and optional art do not wake an idle current scene.');
    assert.equal(h.internal.assets.island, currentImage);
    assert.equal(h.internal.metadata.world, currentWorld);
    for (const [frame, [selection, data]] of ([[0, costa], [7, porto], [13, fabrica], [0, costa], [13, fabrica]] as const).entries()) {
        h.view.render(selection, freshSave(), 128 + frame * 16, '');
        assert.equal(h.internal.metadata.world, data.world);
        assert.deepEqual(h.internal.marker, data.nodes[STAGES[selection].id]);
        assert.match(h.internal.assets.island.src, new RegExp(`${dioramaName(data.world)}\\.webp$`));
        if (data.world === 1) assert.ok(h.internal.assets.shadow);
    }
    assert.deepEqual([h.images.length, h.fetches.length], counts, 'All three ready pairs are reusable without new network requests.');
    assert.equal(h.fetches.length, 3);
});

for (const world of [2, 3]) test(`failed island ${world} pairs keep its fallback and do not poison a ready Costa cache`, async t => {
    const offset = (world - 1) * 5;
    const incomplete = fixtureMapMetadata(world); delete incomplete.nodes[`${world}-4`];
    for (const [label, metadata, imageSuccess] of [
        ['Costa metadata', fixtureMapMetadata(), true], ['other island metadata', fixtureMapMetadata(world === 2 ? 3 : 2), true],
        ['incomplete metadata', incomplete, true],
        ['invalid silhouette bounds', { ...fixtureMapMetadata(world), artBounds: { top: .9, bottom: .1 } }, true],
        ['missing image', fixtureMapMetadata(world), false], ['missing metadata', 'http', true], ['network failure', 'network', true],
    ] as const) await t.test(label, async child => {
        const h = mapDOM(child, true);
        h.view.render(0, freshSave(), 0, ''); await finishWorld(h, 1);
        h.view.render(0, freshSave(), 16, ''); const costaImage = h.internal.assets.island;
        h.view.render(offset, freshSave(), 32, '');
        if (typeof metadata === 'string') {
            h.images.find(image => image.src.endsWith(`${dioramaName(world)}.webp`))!.onload?.();
            const request = h.fetches.find(request => request.url.endsWith(`${dioramaName(world)}.meta.json`))!;
            if (metadata === 'http') request.resolve({ ok: false }); else request.reject(new Error('Network unavailable'));
            await flushAssets();
        } else await finishWorld(h, world, metadata, imageSuccess);
        h.view.render(offset, freshSave(), 48, '');
        assert.equal(h.internal.assets.island, null);
        assert.equal(h.internal.metadata.world, world);
        assert.deepEqual(h.internal.marker, FALLBACK_POINTS[0]);
        for (let stage = 0; stage < 5; stage++) {
            h.view.render(offset + stage, freshSave(), 49 + stage, '');
            assert.deepEqual(h.internal.marker, FALLBACK_POINTS[stage]);
            assert.equal(h.get('world-map-stage-number').textContent, `${world}-${stage + 1}`);
        }
        h.view.render(0, freshSave(), 64, '');
        assert.equal(h.internal.assets.island, costaImage);
        h.view.render(offset, freshSave(), 80, '');
        assert.equal(h.fetches.length, 2, 'A failed optional island is not retried every frame or visit.');
    });
});

for (const world of [2, 3]) test(`island ${world} offsets every local route and never borrows another island’s progress`, async t => {
    const h = mapDOM(t, true), data = fixtureMapMetadata(world), save = freshSave(), offset = (world - 1) * 5;
    for (let n = 1; n <= 5; n++) data.nodes[`${world}-${n}`] = { x: .2 + n * .1, y: n % 2 ? .66 : .46 };
    for (let n = 0; n < 4; n++) data.routes[`${n}:${n + 1}`] = [data.nodes[`${world}-${n + 1}`], { x: .31 + n * .1, y: .55 }, data.nodes[`${world}-${n + 2}`]];
    data.secretRoute = [data.nodes[`${world}-3`], { x: .63, y: .73 }, data.nodes[`${world}-5`]];
    h.view.render(offset, save, 0, ''); await finishWorld(h, world, data);
    h.view.render(offset, save, 16, '');
    for (let n = 1; n <= 4; n++) {
        h.view.render(offset + n, save, 16 + n * 2000, '');
        assert.deepEqual(h.internal.travel, data.routes[`${n - 1}:${n}`]);
        assert.deepEqual(h.internal.marker, data.nodes[`${world}-${n + 1}`]);
    }
    for (const otherWorld of [1, 2, 3].filter(other => other !== world)) {
        save.secrets.push(`${otherWorld}-3`);
        save.completed.push(`${otherWorld}-1`);
    }
    const strokes: unknown[] = [];
    Object.defineProperty(h.paint.context, 'strokeStyle', { configurable: true, set: value => strokes.push(value) });
    h.view.render(offset + 2, save, 10000, ''); h.view.render(offset + 4, save, 12000, '');
    assert.deepEqual(h.internal.travel, [...data.routes['2:3'], ...data.routes['3:4'].slice(1)]);
    assert.equal(h.get('world-map-route-hint').classList.contains('is-secret'), false);
    assert.equal(h.internal.nodes[0].classList.contains('is-completed'), false);
    assert.equal(strokes.includes('#fff4b6c4'), false, 'Other islands cannot complete this island’s trail.');
    assert.equal(strokes.includes('#e9b5ff'), false, 'Other islands cannot reveal this island’s shortcut.');
    save.secrets.push(`${world}-3`);
    h.view.render(offset + 2, save, 14000, ''); h.view.render(offset + 4, save, 16000, '');
    assert.deepEqual(h.internal.travel, data.secretRoute);
    assert.deepEqual(h.internal.marker, data.nodes[`${world}-5`]);
    assert.match(h.get('world-map-route-hint').textContent, /Atalho 3 → 5 descoberto/);
    assert.ok(strokes.includes('#e9b5ff'));
    save.completed.push(`${world}-1`);
    h.view.render(offset + 4, save, 16016, '');
    assert.equal(h.internal.nodes[0].classList.contains('is-completed'), true);
    assert.ok(strokes.includes('#fff4b6c4'), 'Trail completion reads the current island’s stage ID.');
    assert.ok(h.paint.calls.some(call => call.method === 'drawImage' && call.args[0] === h.images[0]), 'The painter draws the selected island’s main art.');
});

test('late optional Costa art preserves the current walk rather than relocating or restarting it', async t => {
    const h = mapDOM(t), data = fixtureMapMetadata();
    data.routes['0:1'] = [data.nodes['1-1'], { x: .19, y: .5 }, data.nodes['1-2']];
    h.view.render(0, freshSave(), 0, ''); await finishWorld(h, 1, data);
    h.view.render(0, freshSave(), 100, ''); h.view.render(1, freshSave(), 116, '');
    const started = h.internal.travelStarted, travel = structuredClone(h.internal.travel);
    h.images.find(image => image.src.endsWith('porto-distant.webp'))!.onload?.(); await flushAssets();
    h.view.render(1, freshSave(), 132, '');
    assert.equal(h.internal.travelStarted, started);
    assert.deepEqual(h.internal.travel, travel);
    assert.notDeepEqual(h.internal.marker, data.nodes['1-2'], 'Feka continues its authored walk.');
});

for (const world of [2, 3]) test(`island ${world} reserves the full vertical art canvas unless exported bounds override it`, async t => {
    const { mapToScreen } = await import('../src/adventure/WorldMapModel');
    for (const bounds of [undefined, { top: .12, bottom: .91 }]) await t.test(bounds ? 'exported bounds' : 'conservative bounds', async child => {
        const h = mapDOM(child, true), data = fixtureMapMetadata(world), selection = (world - 1) * 5;
        data.artBounds = bounds;
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 1180, height: 555 };
        h.view.render(selection, freshSave(), 0, ''); await finishWorld(h, world, data);
        h.view.render(selection, freshSave(), 16, '');
        const camera = h.internal.camera, silhouette = bounds ?? { top: 0, bottom: 1 };
        assert.ok(mapToScreen({ x: .5, y: silhouette.top }, camera).y >= 80 - 1e-6);
        assert.ok(mapToScreen({ x: .5, y: silhouette.bottom }, camera).y <= 543 + 1e-6);
        if (!bounds) assert.ok(camera.zoom < .835, 'Do not silently substitute Costa’s narrower silhouette.');
    });
});

test('panorama visibly zooms out after close framing in short landscape and compact portrait', async t => {
    const { mapToScreen } = await import('../src/adventure/WorldMapModel');
    const { mapActorScale } = await import('../src/adventure/WorldMapArt');
    const h = mapDOM(t, true), save = freshSave();
    const data = JSON.parse(readFileSync(new URL('../public/assets/world/map/costa-diorama.meta.json', import.meta.url), 'utf8'));
    await h.finishAssets(data);
    let time = 4000;
    // Actual 846 × 392 and 400 × 606 viewport sizes, excluding their CSS footers.
    for (const [width, height] of [[846, 227], [400, 347]]) {
        h.internal.scene.bounds = { ...h.internal.scene.bounds, width, height }; h.observers[0].callback();
        for (const selected of [0, 1, 4]) {
            const assertPinsSafe = () => {
                const camera = h.internal.camera;
                for (let node = 0; node < 5; node++) {
                    const p = mapToScreen(data.nodes[`1-${node + 1}`], camera);
                    const top = p.y - (width < 600 ? 54 : 58) - (node === selected ? mapActorScale(camera) * 26 + 4 : 0) - 8;
                    assert.ok(top >= -1e-6, `${width}×${height}, selected ${selected + 1}: node ${node + 1} clips above scene`);
                    assert.ok(p.y + 8 <= height + 1e-6, `${width}×${height}: node ${node + 1} clips below scene`);
                    assert.ok(p.x - 31 >= 0 && p.x + 31 <= width, 'Node and focus ring stay inside horizontal bounds.');
                }
            };
            h.view.render(selected, save, time += 16, '');
            const closeZoom = h.internal.camera.zoom;
            assertPinsSafe();
            h.internal.overviewButton.click();
            h.view.render(selected, save, time += 16, '');
            assert.equal(h.internal.overviewButton.getAttribute('aria-pressed'), 'true');
            assert.ok(h.internal.camera.zoom < closeZoom * .9,
                `${width}×${height}, selected ${selected + 1}: panorama ${h.internal.camera.zoom} must visibly shrink close zoom ${closeZoom}`);
            assertPinsSafe();
            h.internal.overviewButton.click();
            h.view.render(selected, save, time += 16, '');
            assert.equal(h.internal.overviewButton.getAttribute('aria-pressed'), 'false');
            assert.ok(Math.abs(h.internal.camera.zoom - closeZoom) < 1e-6, 'Returning from panorama restores the fitted close zoom.');
            assertPinsSafe();
        }
    }
});

test('the illustrated HUD exposes meaningful labels and preserves collected, locked, and encounter states', t => {
    const h = mapDOM(t, true), save = freshSave();
    h.view.render(0, save, 100, '');
    assert.equal(h.get('world-map-overview').getAttribute('aria-label'), 'Ver panorama');
    assert.equal(h.get('world-map-menu').getAttribute('aria-label'), 'Menu');
    assert.match(h.get('world-map-play').getAttribute('aria-label')!, /1-1: Pé na Estrada/);
    assert.equal(h.get('world-map-total').getAttribute('aria-label'), '0 de 30 fases concluídas, 0 de 72 selos');
    assert.equal(h.get('world-map-icon-coast').getAttribute('aria-hidden'), 'true');
    assert.equal(h.get('world-map-icon-coast').getAttribute('focusable'), 'false');
    assert.equal(h.get('world-map-route-hint').hidden, true);
    save.completed.push('1-1'); save.seals.push('1-1:s1', '1-1:s3');
    h.view.render(0, save, 200, '');
    assert.equal(h.internal.sealSlots.filter((slot: Element) => slot.classList.contains('is-collected')).length, 2);
    assert.equal(h.get('world-map-seals').getAttribute('aria-label'), '2 de 3 selos encontrados');
    assert.equal(h.get('world-map-footer').classList.contains('is-completed'), true);
    h.view.render(4, save, 300, '');
    assert.equal(h.get('world-map-seals').hidden, true);
    assert.equal(h.get('world-map-encounter').hidden, false);
    assert.equal(h.get('world-map-footer').classList.contains('is-locked'), true);
    assert.equal(h.get('world-map-route-hint').hidden, false);
    assert.equal(h.get('world-map-play').disabled, true);
    h.get('world-map-overview').click();
    assert.equal(h.get('world-map-overview').getAttribute('aria-label'), 'Aproximar ilha');
    assert.equal(h.get('world-map-overview').getAttribute('aria-pressed'), 'true');
    for (let i = 0; i < 6; i++) {
        h.view.render(i * 5, save, 400 + i, '');
        assert.equal(h.internal.worlds[i].getAttribute('aria-current'), 'location');
        assert.match(h.internal.worlds[i].getAttribute('aria-label'), new RegExp(`Ilha ${i + 1}:`));
        assert.equal(h.get('world-map-island-emblem').children.length, 1, 'The island emblem replaces rather than accumulates SVGs.');
    }
});

test('measured HUD bounds reserve the lighthouse and dock on full-canvas desktop, mobile, landscape and editor layouts', async t => {
    const h = mapDOM(t, true);
    const data = JSON.parse(readFileSync(new URL('../public/assets/world/map/costa-diorama.meta.json', import.meta.url), 'utf8'));
    await h.finishAssets(data);
    for (const [width, height, headerBottom, footerTop] of [[1180, 757, 94, 563], [400, 606, 92, 425],
        [844, 392, 68, 307], [840, 757, 94, 563], [506, 392, 59, 270], [320, 568, 92, 377]]) {
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width, height };
        h.get('world-map-header').bounds = { x: 12, y: 12, left: 12, top: 12, width: 230, height: headerBottom - 12 };
        h.get('world-map-tools').bounds = { x: width - 110, y: 14, left: width - 110, top: 14, width: 96, height: headerBottom - 14 };
        h.get('world-map-footer').bounds = { x: 10, y: footerTop, left: 10, top: footerTop, width: width - 20, height: height - footerTop - 9 };
        h.observers[0].callback();
        for (let stage = 0; stage < 5; stage++) {
            h.view.render(stage, freshSave(), 2000 + stage * 100, '');
            const camera = h.internal.camera;
            const roof = mapToScreen({ x: .5, y: COSTA_ART_BOUNDS.top }, camera).y;
            const dock = mapToScreen({ x: .5, y: COSTA_ART_BOUNDS.bottom }, camera).y;
            assert.ok(roof >= headerBottom + 14 - .001, `The lighthouse clears the ${width} × ${height} pennant.`);
            assert.ok(dock <= footerTop - 12 + .001, `The dock clears the ${width} × ${height} boarding ticket.`);
        }
    }
    const before = h.internal.camera.zoom;
    h.get('world-map-footer').bounds.top -= 32;
    h.observers[0].callback();
    h.view.render(4, freshSave(), 3000, '');
    assert.ok(h.internal.camera.zoom < before, 'A wrapping title or larger text reflows the measured scene even in reduced motion.');
});

test('all three authored dioramas retain measured HUD clearance after cached island switches and Fábrica font reflow', async t => {
    const h = mapDOM(t, true);
    const metadata = [1, 2, 3].map(world => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${dioramaName(world)}.meta.json`, import.meta.url), 'utf8')));
    const silhouetteFor = (world: number) => metadata[world - 1].artBounds ?? (world === 1 ? COSTA_ART_BOUNDS : { top: 0, bottom: 1 });
    for (const world of [1, 2, 3]) {
        h.view.render((world - 1) * 5, freshSave(), world * 16, ''); await finishWorld(h, world, metadata[world - 1]);
    }
    assert.deepEqual(h.observers[0].targets.map(target => target.className.split(' ')[0]), ['world-map-scene', 'world-map-header', 'world-map-tools', 'world-map-footer']);
    for (const [width, height, headerBottom, footerTop] of [[1180, 757, 94, 563], [400, 606, 92, 425],
        [844, 392, 68, 307], [506, 392, 59, 270], [640, 606, 92, 425], [641, 606, 92, 425], [320, 568, 92, 377]]) {
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width, height };
        h.get('world-map-header').bounds = { x: 12, y: 12, left: 12, top: 12, width: 230, height: headerBottom - 12 };
        h.get('world-map-tools').bounds = { x: width - 110, y: 14, left: width - 110, top: 14, width: 96, height: headerBottom - 14 };
        h.get('world-map-footer').bounds = { x: 10, y: footerTop, left: 10, top: footerTop, width: width - 20, height: height - footerTop - 9 };
        h.observers[0].callback();
        for (const world of [1, 2, 3]) for (let stage = 0; stage < 5; stage++) {
            let closeZoom = 0;
            for (const overview of [false, true]) {
                if (h.internal.overview !== overview) h.internal.overviewButton.click();
                h.paint.calls.length = 0;
                h.view.render((world - 1) * 5 + stage, freshSave(), 2000 + stage * 100, '');
                const camera = h.internal.camera, silhouette = silhouetteFor(world);
                if (overview) assert.ok(camera.zoom < closeZoom * .9, `Island ${world} panorama remains distinct at ${width} × ${height}.`);
                else closeZoom = camera.zoom;
                assert.ok(mapToScreen({ x: .5, y: silhouette.top }, camera).y >= headerBottom + 14 - .001);
                assert.ok(mapToScreen({ x: .5, y: silhouette.bottom }, camera).y <= footerTop - 12 + .001);
                for (let node = 0; node < 5; node++) {
                    const p = mapToScreen(metadata[world - 1].nodes[`${world}-${node + 1}`], camera);
                    const top = p.y - (width <= 640 ? 54 : 58) - (node === stage ? mapActorScale(camera) * 26 + 4 : 0) - 8;
                    assert.ok(top >= (width <= 640 ? headerBottom + 14 : 12) - .001, `${world}-${node + 1} retains its focus ring at ${width} × ${height}.`);
                    assert.ok(p.y + 8 <= footerTop - 12 + .001, `${world}-${node + 1} clears the measured footer.`);
                    assert.ok(p.x - 31 >= 0 && p.x + 31 <= width, `${world}-${node + 1} remains inside the horizontal frame.`);
                }
                assert.equal(h.internal.metadata.world, world);
                assert.match(h.internal.assets.island.src, new RegExp(`${dioramaName(world)}\\.webp$`));
                assert.ok(h.paint.calls.some(call => call.method === 'drawImage' && call.args[0] === h.internal.assets.island));
            }
        }
    }
    const before = h.internal.camera.zoom, bottomInset = h.internal.frameInsets.bottom;
    h.paint.calls.length = 0;
    h.get('world-map-footer').bounds.top -= 24;
    h.observers[0].callback(); h.view.render(14, freshSave(), 4000, '');
    assert.equal(h.internal.frameInsets.bottom, bottomInset + 24, 'Fábrica remeasures a larger boarding ticket in reduced motion.');
    assert.ok(h.paint.calls.length > 0);
    assert.ok(h.internal.camera.zoom <= before, 'Use existing spare space before shrinking the diorama further.');
    assert.ok(mapToScreen({ x: .5, y: silhouetteFor(3).bottom }, h.internal.camera).y <= h.get('world-map-footer').bounds.top - 12 + .001);
    assert.equal(h.fetches.length, 3, 'HUD layout changes and island switches retain all three cached pairs.');
});

test('the runtime uses compact framing through 640px and desktop framing from 641px', async t => {
    const { frameMapPins } = await import('../src/adventure/WorldMapArt');
    const h = mapDOM(t, true), selected = 14, points = Object.fromEntries(FALLBACK_POINTS.map((p, i) => [10 + i, p]));
    for (const width of [620, 640, 641]) {
        const height = 392, compact = width <= 640, fitHeight = Math.min(width / 1.6, height), focus = FALLBACK_POINTS[4];
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width, height };
        h.get('world-map-header').bounds = { x: 12, y: 12, left: 12, top: 12, width: 230, height: 47 };
        h.get('world-map-tools').bounds = { x: width - 110, y: 14, left: width - 110, top: 14, width: 96, height: 44 };
        h.get('world-map-footer').bounds = { x: 10, y: 270, left: 10, top: 270, width: width - 20, height: 113 };
        h.observers[0].callback(); h.view.render(selected, freshSave(), 4000, '');
        const zoom = Math.min(.82, compact ? Math.min(1.25, Math.max(.45, (height - 140) / (fitHeight * .93))) : 1.04);
        const expected = frameMapPins({ width, height, zoom, center: { x: .5 + (focus.x - .5) * .12,
            y: .52 + (focus.y - .52) * .035 - (compact ? 60 / (fitHeight * zoom) : 0) } },
        points, selected, compact, undefined, { top: 73, bottom: 134 });
        assert.ok(Math.abs(h.internal.camera.zoom - expected.zoom) < 1e-8);
        assert.ok(Math.abs(h.internal.camera.center.y - expected.center.y) < 1e-8);
    }
});
