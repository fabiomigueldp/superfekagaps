import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { type TestContext } from 'node:test';
import { STAGES } from '../src/adventure/campaign';
import { freshSave as freshCampaignSave, ProgressStore, SAVE_KEY } from '../src/adventure/progress';
import { WorldGame } from '../src/adventure/WorldGame';
import { COSTA_ART_BOUNDS, FALLBACK_POINTS, fallbackMapMetadata, parseMapMetadata, paintMapActor } from '../src/adventure/WorldMapArt';
import { WorldMapView } from '../src/adventure/WorldMapView';
import { GUAIRA_CAMPAIGN_ART } from '../src/adventure/GuairaCampaignArt';
import { WORLD_MAP_TRAVEL_ACTIONS } from '../src/adventure/WorldMapHud';
import { mapToScreen, type MapPoint } from '../src/adventure/WorldMapModel';
import { atlasIslandBounds, WORLD_ATLAS_PLACEMENTS } from '../src/adventure/WorldAtlasModel';
import { atlasActorBounds, atlasActorScale, atlasBoatBounds } from '../src/adventure/WorldAtlasArt';
import { Input } from '../src/engine/Input';
import { StandardGamepad } from '../src/engine/StandardGamepad';

// This matrix verifies already-earned six-region transport. Guaíra's new gate is
// covered separately in guaira-campaign-progression.test.ts.
const freshSave = () => ({ ...freshCampaignSave(), legacySerraAccess: true });

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
    dataset: Record<string, string> = {};
    get firstElementChild() { return this.children[0] ?? null; }
    title = '';
    href = '';
    hidden = false;
    disabled = false;
    tabIndex = 0;
    width = 0;
    height = 0;
    isContentEditable = false;
    bounds = { x: 0, y: 0, left: 0, top: 0, width: 1200, height: 750 };
    focusCount = 0;
    readonly classList = {
        add: (...names: string[]) => names.forEach(name => this.classList.toggle(name, true)),
        remove: (...names: string[]) => names.forEach(name => this.classList.toggle(name, false)),
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
    matches(selector: string) { return selector.split(',').some(item => item.trim() === 'a[href]'
        ? this.tagName === 'A' && !!this.href : item.trim().toUpperCase() === this.tagName); }
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

function mapDOM(t: TestContext, reducedMotion = false, withGuaira = false, withChapters = false) {
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
    Object.defineProperty(documentMock, 'activeElement', { get: () => active });
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
    const fetches: Array<{ url: string; signal: AbortSignal; resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = [];
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
    const events = { chapters: [] as string[], selected: [] as number[], arrived: [] as number[], entered: 0, exited: 0, unlocked: 0 };
    const view = new WorldMapView(gameCanvas as unknown as HTMLCanvasElement, {
        ...(withGuaira ? { guaira() {} } : {}),
        ...(withChapters ? { enterChapter(chapter: string, stage: string) { events.chapters.push(`${chapter}:${stage}`); } } : {}),
        select: index => { events.selected.push(index); }, enter: () => { events.entered++; },
        arrive: index => { events.arrived.push(index); }, exit: () => { events.exited++; }, unlockAudio: () => { events.unlocked++; }
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
const dioramaName = (world: number) => ({ 1: 'costa-diorama', 2: 'porto-diorama', 3: 'fabrica-diorama', 4: 'serra-diorama', 5: 'reserva-diorama', 6: 'dominio-diorama' }[world]);
async function finishWorld(h: ReturnType<typeof mapDOM>, world: number, metadata: unknown = fixtureMapMetadata(world), imageSuccess = true) {
    const image = h.images.find(image => image.src.endsWith(`${dioramaName(world)}.webp`));
    const request = h.fetches.find(request => request.url.endsWith(`${dioramaName(world)}.meta.json`));
    assert.ok(image && request, `World ${world} must already have been visited before its assets can settle.`);
    if (world >= 3) Object.assign(image, { naturalWidth: 1920, naturalHeight: 1200 });
    imageSuccess ? image.onload?.() : image.onerror?.();
    request.resolve({ ok: true, json: async () => metadata });
    await flushAssets();
}

test('real camera export retains all five authored nodes, adjacent routes and secret endpoints', () => {
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/costa-diorama.meta.json', import.meta.url), 'utf8'));
    const data = parseMapMetadata(raw);
    assert.ok(data, 'The shipped terrain camera export must load in production.');
    assert.deepEqual(Object.keys(data.routes).sort(), ['0:1', '1:2', '2:3', '3:4']);
    for (let n = 1; n <= 5; n++) {
        const node: MapPoint = data.nodes[`1-${n}`];
        assert.ok(node.x > 0 && node.x < 1 && node.y > 0 && node.y < 1);
        if (n < 5) {
            const route: MapPoint[] = data.routes[`${n - 1}:${n}`];
            assert.ok(route.length > 2, 'A path must follow the actual terrain, not only a straight node-to-node segment.');
            assert.deepEqual(point(route[0]), point(node));
            assert.deepEqual(point(route[route.length - 1]), point(data.nodes[`1-${n + 1}`]));
        }
    }
    assert.deepEqual(point(data.secretRoute[0]), point(data.nodes['1-3']));
    assert.deepEqual(point(data.secretRoute[data.secretRoute.length - 1]), point(data.nodes['1-5']));
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
    for (const world of [1, 2]) {
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

const openSave = (selected = '1-1') => ({ ...freshSave(), selected, completed: STAGES.map(stage => stage.id) });
const currentArt = (h: ReturnType<typeof mapDOM>, world: number) => h.internal.activeArt.get(world);
function nativeControlEntries(h: ReturnType<typeof mapDOM>): Array<{ button: Button; width: number; height: number }> {
    if (h.internal.overview) {
        assert.ok(h.internal.hud.stageButtons.every((button: Button) => button.hidden));
        assert.ok(Object.values(h.internal.hud.travelButtons).every((button: any) => button.hidden));
        assert.equal(h.internal.hud.overviewButtons.filter((button: Button) => !button.hidden).length,
            h.root.classList.contains('has-island-selector-fallback') ? 0 : 6);
        const compact = h.internal.width < 640 || h.internal.height < 480;
        assert.equal(h.root.classList.contains('has-compact-island-names'), compact);
        return h.internal.hud.overviewButtons.map((button: Button) => ({ button, width: compact ? 44 : 128, height: 44 }));
    }
    return [...h.internal.hud.stageButtons.map((button: Button) => ({ button, width: 56, height: 58 })),
        ...Object.entries(h.internal.hud.travelButtons).map(([id, button]) => ({ button: button as Button,
            width: WORLD_MAP_TRAVEL_ACTIONS[id as keyof typeof WORLD_MAP_TRAVEL_ACTIONS].width, height: 56 }))];
}
function tick(h: ReturnType<typeof mapDOM>, selected: number, save: ReturnType<typeof freshSave>, from: number, duration: number) {
    for (let time = from + 50; time <= from + duration; time += 50) h.view.render(selected, save, time, '');
}
function assertPaintedPassengerOnDeck(h: ReturnType<typeof mapDOM>, id = 'coast-port-sail') {
    const boat = h.internal.currentBoat(id), frame = boat.frame, calls = h.paint.calls;
    const layer = (crop: any) => calls.map(call => call.method === 'drawImage' && call.args[0] === boat.assets.rear &&
        call.args[1] === crop.x && call.args[2] === crop.y).lastIndexOf(true);
    const rear = layer(frame.rear), foreground = layer(frame.foreground);
    assert.ok(rear >= 0 && foreground > rear);
    const expected = canvasContext();
    paintMapActor(expected.context as unknown as CanvasRenderingContext2D, { camera: h.internal.camera, marker: boat.foot,
        time: h.internal.lastTime, reducedMotion: h.media.matches, walking: false, facingLeft: h.internal.facingLeft,
        scale: atlasActorScale(h.internal.camera, frame), shadow: false });
    assert.deepEqual(calls.slice(rear + 1, foreground).filter(call => call.method === 'fillRect'), expected.calls);
}
async function readyLand(h: ReturnType<typeof mapDOM>, save = openSave(), selection = 0, metadata = fixtureMapMetadata(1)) {
    h.view.render(selection, save, 0, ''); await finishWorld(h, 1, metadata); await finishWorld(h, 2);
    h.view.render(selection, save, 16, '');
}

test('map show/hide retains one mount and fixed listener sets, and restores canvas focus', t => {
    const h = mapDOM(t); h.gameCanvas.setAttribute('tabindex', '7'); const children = h.body.children.length;
    for (let i = 0; i < 3; i++) {
        h.view.show(i * 100); h.view.show(i * 100 + 1); h.view.render(0, freshSave(), i * 100 + 2, '');
        assert.equal(h.root.hidden, false); assert.equal(h.active, h.root); assert.equal(h.gameCanvas.style.visibility, 'hidden');
        assert.equal(h.gameCanvas.getAttribute('tabindex'), '-1'); assert.equal(h.body.children.length, children);
        assert.equal(h.root.count('keydown'), 2, 'The HUD drawer and controller each own one stable key listener.');
        assert.equal(h.windowMock.count('resize'), 1); assert.equal(h.media.count('change'), 1);
        h.view.hide(); h.view.hide(); assert.equal(h.active, h.gameCanvas); assert.equal(h.gameCanvas.getAttribute('tabindex'), '7');
        assert.equal(h.gameCanvas.getAttribute('aria-hidden'), null); assert.equal(h.gameCanvas.style.visibility, '');
    }
    assert.equal(h.observers.length, 1); assert.equal(h.root.focusCount, 3); assert.equal(h.gameCanvas.focusCount, 3);
    h.view.dispose(); h.view.dispose(); h.view.show(999);
    assert.equal(h.body.children.length, children - 1); assert.equal(h.root.count('keydown'), 0);
    assert.equal(h.windowMock.count('resize'), 0); assert.equal(h.media.count('change'), 0);
    assert.ok(h.observers[0].disconnected); assert.ok(h.fetches.every(request => request.signal.aborted));
});

test('disposing during fetch cannot resurrect the map or publish late art', async t => {
    const h = mapDOM(t); h.view.render(0, freshSave(), 0, ''); h.view.dispose();
    await finishWorld(h, 1); await finishWorld(h, 2);
    assert.equal(h.root.parent, null); assert.equal(h.root.hidden, true); assert.equal(currentArt(h, 1).assets.island, null);
    h.view.render(0, freshSave(), 100, ''); h.root.dispatch('keydown', { key: 'ArrowRight' });
    assert.deepEqual(h.events.selected, []); assert.equal(h.gameCanvas.style.visibility, '');
});

test('the ferry pair loads first; an explicit Factory preview loads its own content once', t => {
    const h = mapDOM(t, true), save = openSave('2-1');
    save.completed = STAGES.filter(stage => stage.world === 1).map(stage => stage.id);
    assert.equal(h.images.length, 0); h.view.render(5, save, 0, '');
    assert.ok(h.images.some(image => image.src.endsWith('porto-diorama.webp')));
    assert.ok(h.images.some(image => image.src.endsWith('costa-diorama.webp')));
    assert.ok(h.images.every(image => !image.src.endsWith('porto-distant.webp')));
    const count = [h.images.length, h.fetches.length];
    for (const selected of [0, 5, 0, 5]) h.view.render(selected, save, selected + 20, '');
    assert.deepEqual([h.images.length, h.fetches.length], count);
    assert.ok(!h.fetches.some(request => /fabrica|factory/.test(request.url)));
    h.view.render(10, save, 100, '');
    assert.equal(h.fetches.filter(request => request.url.endsWith('fabrica-diorama.meta.json')).length, 1);
    assert.equal(h.fetches.filter(request => request.url.endsWith('port-factory-bridge.meta.json')).length, 1);
    h.view.render(15, save, 116, ''); // First Serra inspection may request its passenger sign art.
    assert.ok(!h.fetches.some(request => /reserva/.test(request.url)));
    h.view.render(20, save, 120, ''); // A locked Reserva preview still lazily loads its own authored scene.
    assert.equal(h.fetches.filter(request => request.url.endsWith('reserva-diorama.meta.json')).length, 1);
    assert.equal(h.fetches.filter(request => request.url.endsWith('serra-reserva-link.meta.json')).length, 1);
    assert.ok(!h.fetches.some(request => /dominio/.test(request.url)));
    h.view.render(25, save, 124, '');
    assert.equal(h.fetches.filter(request => request.url.endsWith('dominio-diorama.meta.json')).length, 1);
    assert.equal(h.fetches.filter(request => request.url.endsWith('reserva-dominio-journey.meta.json')).length, 1);
    const expanded = [h.images.length, h.fetches.length];
    for (const selected of [15, 20, 25, 0, 5, 10]) h.view.render(selected, save, selected + 120, '');
    assert.deepEqual([h.images.length, h.fetches.length], expanded);
});

test('paired art waits for matching metadata in either completion order and never applies invalid coordinates', async t => {
    for (const metadataFirst of [false, true]) await t.test(String(metadataFirst), async child => {
        const h = mapDOM(child, true), data = fixtureMapMetadata(1, { '1-1': { x: .25, y: .62 } });
        h.view.render(0, freshSave(), 0, '');
        const image = h.images.find(image => image.src.endsWith('costa-diorama.webp'))!, request = h.fetches.find(request => request.url.endsWith('costa-diorama.meta.json'))!;
        if (metadataFirst) request.resolve({ ok: true, json: async () => data }); else image.onload?.();
        await flushAssets(); h.view.render(0, freshSave(), 16, ''); assert.equal(currentArt(h, 1).assets.island, null);
        assert.equal(h.internal.artCache.get(1).status, 'loading');
        assert.equal(request.signal.aborted, false, 'A pending required asset is not a failure.');
        if (metadataFirst) image.onload?.(); else request.resolve({ ok: true, json: async () => data });
        await flushAssets(); h.view.render(0, freshSave(), 32, '');
        assert.equal(currentArt(h, 1).assets.island, image); assert.deepEqual(h.internal.marker, data.nodes['1-1']);
    });
});

test('a failed required asset settles its island pair while the other asset stays pending', async t => {
    for (const failure of ['image', 'metadata HTTP', 'metadata invalid', 'metadata fetch rejection', 'metadata JSON rejection'] as const)
        await t.test(failure, async child => {
            const h = mapDOM(child, true), save = { ...freshSave(), selected: '1-5', completed: STAGES.filter(stage => stage.world === 1).map(stage => stage.id) };
            const before = structuredClone(save);
            h.view.render(4, save, 0, ''); await finishWorld(h, 1);
            const coast = h.internal.artCache.get(1), image = h.images.find(image => image.src.endsWith('porto-diorama.webp'))!;
            const request = h.fetches.find(request => request.url.endsWith('porto-diorama.meta.json'))!;
            const lateImageSuccess = image.onload!;
            let settled = false; void h.internal.pairLoads.get(2).then(() => { settled = true; });
            h.view.render(5, save, 16, '');
            assert.equal(h.internal.journey.blocked, 'no-route'); assert.equal(h.internal.hud.state.canEnter, false);
            assert.equal(h.view.enterSelected(5), false); assert.equal(request.signal.aborted, false);
            if (failure === 'image') image.onerror!();
            else if (failure === 'metadata fetch rejection') request.reject(new Error('Network failed'));
            else if (failure === 'metadata JSON rejection') request.resolve({ ok: true, json: async () => { throw new Error('Invalid JSON'); } });
            else request.resolve({ ok: failure !== 'metadata HTTP', json: async () => ({}) });
            await flushAssets();
            assert.equal(h.internal.artCache.get(2).status, 'failed', 'An explicit failure must not wait for its pending partner.');
            assert.equal(settled, true, 'Dependent loads can observe the terminal failed pair.');
            assert.equal(request.signal.aborted, true, 'The failed pair cancels its own remaining work.');
            assert.equal(image.onload, null); assert.equal(image.onerror, null);
            assert.equal(h.fetches.find(request => request.url.endsWith('costa-diorama.meta.json'))!.signal.aborted, false);
            h.view.render(5, save, 32, '');
            const failed = h.internal.artCache.get(2), requests = [h.images.length, h.fetches.length];
            assert.equal(currentArt(h, 2).assets.island, null); assert.deepEqual(currentArt(h, 2).metadata, fallbackMapMetadata(2));
            assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.internal.journey.blocked, null);
            assert.equal(h.internal.hud.enterButton.disabled, false); assert.equal(h.events.entered, 0);
            assert.match(h.get('world-map-warning').textContent, /travessia visual não carregou/);
            assert.ok(h.internal.network.edges.every((edge: { mode: string }) => edge.mode !== 'sail'));
            // Simulate work that completes despite cancellation, including an already queued image callback.
            request.resolve({ ok: true, json: async () => fixtureMapMetadata(2, { '2-1': { x: .3, y: .4 } }) });
            lateImageSuccess(); await flushAssets(); h.view.render(5, save, 48, '');
            assert.equal(h.internal.artCache.get(2), failed); assert.equal(failed.status, 'failed');
            assert.equal(failed.assets.island, null); assert.deepEqual(failed.metadata, fallbackMapMetadata(2));
            assert.equal(h.internal.artCache.get(1), coast); assert.equal(currentArt(h, 1).assets.island, coast.assets.island);
            h.view.hide(); h.view.render(5, save, 64, '');
            assert.deepEqual([h.images.length, h.fetches.length], requests, 'Reentry reuses the terminal pair without retrying.');
            assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.view.enterSelected(5), true);
            assert.equal(h.events.entered, 1); assert.deepEqual(save, before);
        });
});

test('a stalled island image settles its pair even when metadata has not responded', async t => {
    for (const metadataReady of [false, true]) await t.test(metadataReady ? 'metadata ready' : 'metadata pending', async child => {
        child.mock.timers.enable({ apis: ['setTimeout'] });
        const h = mapDOM(child, true), save = { ...freshSave(), selected: '1-5', completed: STAGES.filter(stage => stage.world === 1).map(stage => stage.id) };
        h.view.render(4, save, 0, ''); await finishWorld(h, 1);
        const image = h.images.find(image => image.src.endsWith('porto-diorama.webp'))!;
        const request = h.fetches.find(request => request.url.endsWith('porto-diorama.meta.json'))!;
        const lateSuccess = image.onload!;
        if (metadataReady) request.resolve({ ok: true, json: async () => fixtureMapMetadata(2) });
        await flushAssets(); h.view.render(5, save, 16, '');
        assert.equal(h.view.enterSelected(5), false);
        child.mock.timers.tick(12_000); await flushAssets();
        assert.equal(h.internal.artCache.get(2).status, 'failed'); assert.equal(request.signal.aborted, true);
        assert.equal(image.onload, null); assert.equal(image.onerror, null);
        h.view.render(5, save, 12_016, '');
        assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.internal.hud.enterButton.disabled, false);
        assert.equal(currentArt(h, 1).status, 'ready'); assert.equal(currentArt(h, 2).assets.island, null);
        request.resolve({ ok: true, json: async () => fixtureMapMetadata(2) }); lateSuccess(); await flushAssets();
        assert.equal(h.internal.artCache.get(2).status, 'failed'); assert.equal(h.internal.artCache.get(2).assets.island, null);
    });
});

test('image completion, failure and disposal each clear their deadline and listeners once', async t => {
    for (const outcome of ['load', 'error', 'abort', 'dispose'] as const) await t.test(outcome, async child => {
        child.mock.timers.enable({ apis: ['setTimeout'] });
        const h = mapDOM(child), controller = new AbortController();
        const signal: AbortSignal = outcome === 'dispose' ? h.internal.abort.signal : controller.signal;
        const scheduled = child.mock.method(globalThis, 'setTimeout'), cleared = child.mock.method(globalThis, 'clearTimeout');
        const removed = child.mock.method(signal, 'removeEventListener');
        const loading: Promise<HTMLImageElement | null> = h.internal.loadImage('/test-map-image.webp', signal);
        const image = h.images.at(-1)!, lateSuccess = image.onload!, lateError = image.onerror!;
        const timer = scheduled.mock.calls.at(-1)!.result;
        assert.equal(scheduled.mock.calls.at(-1)!.arguments[1], 12_000);
        if (outcome === 'load') image.onload!();
        else if (outcome === 'error') image.onerror!();
        else if (outcome === 'dispose') h.view.dispose();
        else controller.abort();
        assert.equal(await loading, outcome === 'load' ? image : null);
        assert.equal(image.onload, null); assert.equal(image.onerror, null);
        assert.equal(cleared.mock.calls.length, 1); assert.equal(cleared.mock.calls[0].arguments[0], timer);
        assert.equal(removed.mock.calls.length, 1); assert.equal(removed.mock.calls[0].arguments[0], 'abort');
        lateSuccess(); lateError(); child.mock.timers.tick(24_000); await flushAssets();
        assert.equal(cleared.mock.calls.length, 1); assert.equal(removed.mock.calls.length, 1);
        assert.equal(await loading, outcome === 'load' ? image : null);
    });
});

test('pending island pairs survive reentry but disposal prevents late art from reaching a replacement view', async t => {
    for (const first of ['neither', 'image', 'metadata'] as const) await t.test(first, async child => {
        const h = mapDOM(child, true), save = freshSave(); h.view.render(0, save, 0, '');
        const image = h.images.find(image => image.src.endsWith('costa-diorama.webp'))!;
        const request = h.fetches.find(request => request.url.endsWith('costa-diorama.meta.json'))!;
        const lateImageSuccess = image.onload!, data = fixtureMapMetadata(1, { '1-1': { x: .2, y: .6 } });
        if (first === 'image') image.onload!();
        if (first === 'metadata') request.resolve({ ok: true, json: async () => data });
        await flushAssets();
        const requests = [h.images.length, h.fetches.length];
        h.view.hide(); h.view.render(0, save, 16, '');
        assert.deepEqual([h.images.length, h.fetches.length], requests);
        assert.equal(h.internal.artCache.get(1).status, 'loading'); assert.equal(request.signal.aborted, false);
        h.view.dispose();
        assert.ok(h.fetches.every(request => request.signal.aborted));
        assert.ok(h.images.every(image => image.onload === null && image.onerror === null));
        const replacement = new WorldMapView(h.gameCanvas as unknown as HTMLCanvasElement, {
            select() {}, enter() {}, exit() {}, unlockAudio() {}
        });
        try {
            replacement.render(0, save, 32, '');
            const nextImage = h.images.slice(requests[0]).find(image => image.src.endsWith('costa-diorama.webp'))!;
            const nextRequest = h.fetches.slice(requests[1]).find(request => request.url.endsWith('costa-diorama.meta.json'))!;
            const nextData = fixtureMapMetadata(1, { '1-1': { x: .4, y: .5 } });
            nextImage.onload!(); nextRequest.resolve({ ok: true, json: async () => nextData });
            await flushAssets(); replacement.render(0, save, 48, '');
            lateImageSuccess(); request.resolve({ ok: true, json: async () => data });
            await flushAssets(); replacement.render(0, save, 64, '');
            const art = (replacement as any).activeArt.get(1);
            assert.equal(art.status, 'ready'); assert.equal(art.assets.island, nextImage); assert.deepEqual(art.metadata, nextData);
            assert.equal(nextRequest.signal.aborted, false);
            assert.equal(h.internal.artCache.get(1).assets.island, null); assert.equal(h.root.parent, null);
            assert.deepEqual(h.events.arrived, []); assert.equal(h.events.entered, 0);
        } finally { replacement.dispose(); }
    });
});

test('connected atlas loads and renders Costa or its usable fallback without requesting a legacy shadow', async t => {
    for (const outcome of ['ready', 'missing image', 'invalid metadata'] as const) await t.test(outcome, async child => {
        const h = mapDOM(child, true), save = freshSave(); save.completed.push('1-1');
        const before = structuredClone(save), ready = outcome === 'ready';
        h.view.render(0, save, 0, '');
        const sources = h.images.map(image => image.src);
        assert.deepEqual(sources, ['/assets/world/map/costa-diorama.webp', '/assets/world/map/porto-diorama.webp'],
            'The initial terrain load must not allocate an Image or request for a legacy shadow.');
        await finishWorld(h, 1, outcome === 'invalid metadata' ? {} : fixtureMapMetadata(1), outcome !== 'missing image');
        await finishWorld(h, 2);
        h.paint.calls.length = 0; h.view.render(0, save, 16, '');
        const art = currentArt(h, 1), terrain = h.images[0];
        assert.equal(art.status, ready ? 'ready' : 'failed');
        assert.equal(art.assets.island, ready ? terrain : null);
        assert.equal(art.assets.shadow, null);
        assert.equal(h.internal.artCache.get(1).assets.shadow, null);
        assert.equal(h.paint.calls.some(call => call.method === 'drawImage' && call.args[0] === terrain), ready);
        if (!ready) assert.deepEqual(art.metadata, fallbackMapMetadata(1));
        h.view.render(1, save, 32, '');
        assert.equal(h.internal.journey.arrived, '1-2', 'Authored and fallback routes both retain local travel.');
        assert.equal(h.view.enterSelected(1), true); assert.equal(h.events.entered, 1);
        assert.deepEqual(save, before, 'Loading and local travel never rewrite progress.');
        h.view.hide(); h.view.render(0, save, 48, '');
        assert.deepEqual(h.images.map(image => image.src), sources, 'Reopening reuses the pair without extra shadow requests.');
    });
});

test('failed island pairs retain usable fallback, preserve the other cache, and do not retry per frame', async t => {
    for (const [metadata, imageSuccess] of [[fixtureMapMetadata(1), true], [{}, true], [fixtureMapMetadata(2), false]] as const) await t.test(JSON.stringify(metadata).slice(0, 30), async child => {
        const save = openSave(), j = mapDOM(child, true);
        save.completed = STAGES.filter(stage => stage.world === 1).map(stage => stage.id);
        j.view.render(0, save, 0, ''); await finishWorld(j, 1);
        await finishWorld(j, 2, metadata, imageSuccess); j.view.render(0, save, 16, '');
        assert.ok(currentArt(j, 1).assets.island); assert.equal(currentArt(j, 2).assets.island, null);
        const requests = j.fetches.length; j.view.render(5, save, 32, ''); j.view.render(0, save, 48, '');
        assert.equal(j.fetches.length, requests); assert.ok(j.internal.network.nodes['2-1']);
    });
});

test('late geometry is activated only after safe arrival without restarting a walk', async t => {
    const h = mapDOM(t), save = openSave(); h.view.render(0, save, 0, ''); h.view.render(1, save, 50, '');
    const active = structuredClone(h.internal.journey.legs[0]), data = fixtureMapMetadata(1, { '1-2': { x: .43, y: .37 } });
    await finishWorld(h, 1, data); h.view.render(1, save, 100, '');
    assert.equal(currentArt(h, 1).assets.island, null); assert.deepEqual(h.internal.journey.legs[0].points, active.points);
    const progress = h.internal.journey.legs[0].progress; h.view.render(1, save, 150, ''); assert.ok(h.internal.journey.legs[0].progress > progress);
    tick(h, 1, save, 150, 1000); h.view.render(1, save, 1200, '');
    assert.ok(currentArt(h, 1).assets.island); assert.deepEqual(h.internal.marker, data.nodes['1-2']); assert.equal(h.internal.journey.arrived, '1-2');
});

test('phase selection walks, arrival saves once, and only explicit Enter starts exactly one stage', async t => {
    const h = mapDOM(t), save = openSave(); await readyLand(h, save);
    h.internal.hud.stageButtons[1].click(); h.internal.hud.stageButtons[1].click();
    assert.deepEqual(h.events.selected, [1, 1]); assert.equal(h.events.entered, 0);
    assert.equal(h.internal.journey.selected, '1-2'); assert.equal(h.internal.journey.arrived, '1-1');
    assert.equal(h.view.enterSelected(1), false); assert.equal(h.view.enterSelected(0), false); assert.deepEqual(h.events.arrived, []);
    tick(h, 1, save, 16, 1000); assert.equal(h.internal.journey.arrived, '1-2'); assert.deepEqual(h.events.arrived, [1]);
    assert.equal(h.events.entered, 0); assert.equal(h.internal.hud.enterButton.disabled, false);
    h.internal.hud.enterButton.click(); h.internal.hud.enterButton.click(); h.root.dispatch('keydown', { key: 'Enter' });
    assert.equal(h.events.entered, 1); assert.equal(h.internal.journey.entered, '1-2');
});

test('retargeting mid-walk preserves position, authored bends, and reverses continuously', async t => {
    const h = mapDOM(t), save = openSave(), data = fixtureMapMetadata(1), bend = { x: .18, y: .42 };
    data.routes['0:1'] = [data.nodes['1-1'], bend, data.nodes['1-2']]; await readyLand(h, save, 0, data);
    h.view.render(1, save, 100, ''); h.view.render(1, save, 200, ''); const foot = { ...h.internal.marker };
    h.view.render(2, save, 200, ''); assert.deepEqual(h.internal.marker, foot);
    assert.ok(h.internal.journey.legs[0].points.some((point: MapPoint) => point.x === bend.x && point.y === bend.y));
    h.view.render(0, save, 200, ''); assert.deepEqual(h.internal.marker, foot); assert.equal(h.internal.journey.legs[0].direction, -1);
    tick(h, 0, save, 200, 1000); assert.equal(h.internal.journey.arrived, '1-1');
});

test('locked phase and region previews never move Feka, persist the target, or permit entry', t => {
    const h = mapDOM(t, true), save = freshSave(); h.view.render(0, save, 0, ''); const foot = { ...h.internal.marker };
    for (const [selected, prerequisite] of [[1, '1-1'], [4, '1-4'], [5, '1-5'], [9, '1-5'], [25, '5-5']] as const) {
        h.view.render(selected, save, selected + 20, ''); assert.deepEqual(h.internal.marker, foot);
        assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.view.enterSelected(selected), false);
        assert.equal(h.internal.hud.enterButton.disabled, false);
        assert.match(h.internal.hud.enterButton.getAttribute('aria-label'), /Voltar ao Feka/);
        assert.equal(h.get('world-map-status').textContent, `Prévia · Conclua ${prerequisite}`);
        const phase = STAGES.find(stage => stage.id === prerequisite)!;
        assert.equal(h.get('world-map-hint').textContent, `Conclua ${phase.id}: ${phase.name} para visitar esta fase.`);
    }
    assert.deepEqual(h.events.arrived, []); assert.equal(save.selected, '1-1');
});

test('clearing the previous island boss changes preview guidance to the selected local prerequisite', t => {
    const h = mapDOM(t, true), save = freshSave();
    h.view.render(6, save, 0, '');
    assert.equal(h.get('world-map-status').textContent, 'Prévia · Conclua 1-5');
    save.completed.push('1-5'); h.view.render(6, save, 50, '');
    assert.equal(h.get('world-map-status').textContent, 'Prévia · Conclua 2-1');
    assert.equal(h.get('world-map-hint').textContent, 'Conclua 2-1: Carga Chegando para visitar esta fase.');
    assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.view.enterSelected(6), false);
    assert.deepEqual(h.events.arrived, []); assert.equal(save.seals.length, 0);
});

test('an unlocked stage with a missing route retains route failure feedback instead of a completion gate', async t => {
    const h = mapDOM(t), save = freshSave(); save.completed.push('1-1'); await readyLand(h, save);
    h.internal.network.edges = []; h.view.render(1, save, 100, '');
    assert.equal(h.internal.journey.blocked, 'no-route');
    assert.equal(h.get('world-map-status').textContent, 'Prévia · Feka não chegou aqui');
    assert.equal(h.get('world-map-hint').textContent, 'Esta ligação ainda não está disponível no mapa.');
    assert.equal(h.internal.hud.state.prerequisiteStage, null);
    assert.equal(h.view.enterSelected(1), false); assert.deepEqual(h.events.arrived, []);
});

test('menu round trips cancel the hidden destination and reload only the last arrival', async t => {
    const h = mapDOM(t), save = openSave(); await readyLand(h, save); h.view.render(4, save, 100, '');
    assert.equal(h.internal.journey.destination, '1-5'); h.view.hide();
    h.view.render(0, save, 5000, ''); assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.internal.journey.destination, null);
    assert.deepEqual(h.internal.marker, fixtureMapMetadata().nodes['1-1']);
});

test('return from gameplay starts at played stage, replay stays there, and clear requests a fresh trip', async t => {
    const h = mapDOM(t), save = openSave('1-2'); await readyLand(h, save, 1);
    h.view.enterSelected(1); h.view.hide(); h.view.render(1, save, 1000, '', '', { playedStage: '1-2', nextSelected: '1-2' });
    assert.equal(h.internal.journey.arrived, '1-2'); assert.equal(h.internal.journey.destination, null); assert.equal(h.internal.hud.enterButton.disabled, false);
    h.view.hide(); h.view.render(2, save, 2000, '', '', { playedStage: '1-2', nextSelected: '1-3' });
    assert.equal(h.internal.journey.arrived, '1-2'); assert.equal(h.internal.journey.destination, '1-3'); assert.equal(h.events.entered, 1);
});

test('skip and reduced motion finish travel without entering; changing motion preference completes the existing trip', async t => {
    const h = mapDOM(t), save = openSave(); await readyLand(h, save); h.view.render(4, save, 100, '');
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.events.entered, 0);
    h.view.render(0, save, 200, ''); h.media.matches = true; h.media.dispatch('change'); h.view.render(0, save, 201, '');
    assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.internal.journey.destination, null); assert.equal(h.events.entered, 0);
    const camera = structuredClone(h.internal.camera); h.paint.calls.length = 0; h.view.render(0, save, 220, ''); h.view.render(0, save, 9000, '');
    assert.deepEqual(h.internal.camera, camera); assert.equal(h.paint.calls.length, 0);
});

test('reduced-motion idle frames do no canvas work, but progress, panorama, selection, late art and resize repaint', async t => {
    const h = mapDOM(t, true), save = openSave(); h.view.render(0, save, 0, ''); h.paint.calls.length = 0;
    for (let frame = 1; frame <= 120; frame++) h.view.render(0, save, frame * 16, ''); assert.equal(h.paint.calls.length, 0);
    for (const mutate of [() => h.get('world-map-overview').click(), () => save.seals.push('1-1:s1'),
        () => { h.get('world-map-scene').bounds.width = 800; h.observers[0].callback(); }]) {
        mutate(); h.paint.calls.length = 0; h.view.render(0, save, 2100, ''); assert.ok(h.paint.calls.some(call => call.method === 'clearRect'));
    }
    await finishWorld(h, 1); h.paint.calls.length = 0; h.view.render(0, save, 2200, ''); assert.ok(h.paint.calls.length);
});

test('keyboard selection is synchronous, consumes boundaries, and ignores modifiers, repeats and hidden state', t => {
    const h = mapDOM(t); h.view.render(0, freshSave(), 0, '');
    const boundary = h.root.dispatch('keydown', { key: 'A' }); assert.equal(boundary.defaultPrevented, true);
    const event = h.root.dispatch('keydown', { key: 'ArrowRight' }); assert.equal(event.defaultPrevented, true); assert.equal(event.propagationStopped, true);
    assert.equal(h.active, h.internal.hud.stageButtons[1]); h.root.dispatch('keydown', { key: 'ArrowRight' });
    assert.deepEqual(h.events.selected, [1, 2]);
    h.root.dispatch('keydown', { key: 'ArrowRight', repeat: true }); h.root.dispatch('keydown', { key: 'ArrowRight', ctrlKey: true });
    h.root.dispatch('keydown', { key: 'Enter' }); assert.equal(h.events.entered, 0);
    h.root.dispatch('keydown', { key: 'Escape' }); assert.equal(h.events.exited, 1); h.view.hide();
    h.root.dispatch('keydown', { key: 'ArrowRight' }); h.internal.hud.stageButtons[3].click(); assert.deepEqual(h.events.selected, [1, 2]);
});

test('the region drawer owns Escape and arrow events without leaking to map navigation', t => {
    const h = mapDOM(t); h.view.render(0, freshSave(), 0, ''); h.internal.hud.regionButton.click();
    assert.equal(h.internal.hud.regionMenu.hidden, false); h.root.dispatch('keydown', { key: 'ArrowRight' });
    assert.deepEqual(h.events.selected, []); h.root.dispatch('keydown', { key: 'Escape' });
    assert.equal(h.internal.hud.regionMenu.hidden, true); assert.equal(h.events.exited, 0);
});

test('capture-phase gameplay Input and global menus preserve native map activation without double entry', t => {
    const h = mapDOM(t), input = new Input(), game = worldHarness().game; input.setMenuMode(true);
    h.windowMock.addEventListener('keydown', event => game.menuKey(event)); let stray = 0; game.enterSelected = () => { stray++; };
    h.view.render(0, freshSave(), 0, ''); const button = h.get('world-map-enter');
    for (const key of ['Enter', ' ']) {
        const event = button.dispatch('keydown', { key, code: key === ' ' ? 'Space' : 'Enter' }); assert.equal(event.defaultPrevented, false);
        button.click(); button.dispatch('keyup', { key, code: key === ' ' ? 'Space' : 'Enter' });
    }
    input.update(); assert.equal(h.events.entered, 1); assert.equal(stray, 0); assert.equal(input.getState().jumpPressed, false);
    h.root.dispatch('keydown', { key: 'm', code: 'KeyM' }); input.update(); assert.equal(input.consumeMute(), true);
    h.view.hide(); input.setMenuMode(false); h.gameCanvas.dispatch('keydown', { key: 'ArrowRight', code: 'ArrowRight' }); input.update();
    assert.equal(input.getState().right, true);
});

test('chapters are explored in the existing map and only an explicit available-stage action enters gameplay', async t => {
    const h = mapDOM(t, true, true, true), save = openSave(); await readyLand(h, save);
    const before = structuredClone(save), journey = structuredClone(h.internal.journey);
    assert.equal(h.get('world-map-delicia'), undefined, 'There is no duplicate expansion link in the footer.');
    h.get('world-map-overview').click(); h.view.render(0, save, 32, '');
    h.get('world-map-delicia-island').click();
    assert.equal(h.internal.chapter, 'delicia');
    assert.deepEqual(save, before); assert.deepEqual(h.internal.journey, journey);
    assert.equal(h.internal.hud.chapterButtons.length, 14);
    h.internal.hud.chapterButtons[1].click();
    assert.equal(h.internal.hud.enterButton.disabled, true, 'A locked stage remains inspectable.');
    h.internal.hud.enterButton.click(); assert.deepEqual(h.events.chapters, []);
    h.internal.hud.chapterButtons[0].click(); h.internal.hud.enterButton.click();
    assert.deepEqual(h.events.chapters, ['delicia:delicia-1']); assert.equal(h.events.entered, 0);
    h.root.dispatch('keydown', { key: 'Escape' });
    assert.equal(h.internal.chapter, null); assert.equal(h.internal.overview, true);
    assert.deepEqual(save, before); assert.equal(h.events.exited, 0);
});

test('controller can open the chapter from either island control and activate its focused world control', async t => {
    const h = mapDOM(t, true, true, true), save = openSave(); await readyLand(h, save);
    h.get('world-map-overview').click(); h.view.render(0, save, 32, '');
    h.get('world-map-delicia-island').focus(); h.view.control('confirm');
    assert.equal(h.internal.chapter, 'delicia'); assert.equal(h.view.controllerOwner(), 'delicia:idle');
    h.get('world-map-overview').focus(); h.view.control('confirm');
    assert.equal(h.internal.chapter, null); assert.equal(h.internal.overview, true);
    assert.deepEqual(h.events.chapters, [], 'Confirming Mundo cannot enter the selected stage');
    h.root.focus(); h.view.control('regions'); h.internal.hud.deliciaRegion.focus(); h.view.control('confirm');
    assert.equal(h.internal.chapter, 'delicia'); assert.equal(h.internal.hud.regionMenu.hidden, true);
    h.root.focus(); h.view.control('confirm'); assert.deepEqual(h.events.chapters, ['delicia:delicia-1']);
});

test('capped backing resolution responds to DPR and resize without resizing each idle frame', t => {
    const h = mapDOM(t, true), canvas = h.get('world-map-art'); h.view.render(0, freshSave(), 0, 'Storage warning');
    assert.equal(canvas.width, 2400); assert.equal(canvas.height, 1500); assert.equal(h.get('world-map-warning').textContent, 'Storage warning');
    h.get('world-map-scene').bounds.width = 5120; h.get('world-map-scene').bounds.height = 1440; h.observers[0].callback();
    let width = 0, height = 0, writes = 0; Object.defineProperties(canvas, {
        width: { get: () => width, set: (value: number) => { width = value; writes++; } },
        height: { get: () => height, set: (value: number) => { height = value; writes++; } } });
    h.view.render(0, freshSave(), 16, ''); assert.ok(width * height <= 4_000_000 + width + height); assert.ok(width * height > 3_990_000);
    for (const time of [32, 48, 64]) h.view.render(0, freshSave(), time, ''); assert.equal(writes, 2);
    h.windowMock.devicePixelRatio = 1; h.view.render(0, freshSave(), 80, ''); h.view.render(0, freshSave(), 96, ''); assert.equal(writes, 4);
});

test('measured HUD bounds and both fixed island geometries remain valid through viewport and font reflow', async t => {
    const h = mapDOM(t, true), save = openSave(), costa = JSON.parse(readFileSync(new URL('../public/assets/world/map/costa-diorama.meta.json', import.meta.url), 'utf8'));
    await readyLand(h, save, 0, costa);
    for (const [width, height, top, bottom] of [[1180, 757, 94, 650], [400, 606, 92, 490], [844, 392, 68, 307], [320, 568, 92, 440]]) {
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width, height };
        h.get('world-map-header').bounds.height = top - h.get('world-map-header').bounds.top;
        h.get('world-map-tools').bounds.height = top - h.get('world-map-tools').bounds.top;
        h.get('world-map-footer').bounds.top = bottom; h.observers[0].callback(); h.view.render(0, save, height, '');
        const camera = h.internal.camera;
        assert.ok(mapToScreen({ x: .5, y: COSTA_ART_BOUNDS.top }, camera).y >= top + 14 - .001);
        assert.ok(mapToScreen({ x: .5, y: COSTA_ART_BOUNDS.bottom }, camera).y <= bottom - 12 + .001);
        assert.ok(Number.isFinite(camera.zoom) && camera.zoom > 0);
    }
    const before = h.internal.camera.zoom; h.get('world-map-footer').bounds.top -= 24; h.observers[0].callback(); h.view.render(0, save, 3000, '');
    assert.ok(h.internal.camera.zoom <= before);
    assert.ok(mapToScreen({ x: .5, y: COSTA_ART_BOUNDS.bottom }, h.internal.camera).y <= h.get('world-map-footer').bounds.top - 12 + .001);
    assert.deepEqual(h.observers[0].targets.map(target => target.className.split(' ')[0]), ['world-map-scene', 'world-map-header', 'world-map-tools', 'world-map-footer']);
});

test('each island secret uses only its own authored geometry and progress', async t => {
    const h = mapDOM(t), save = openSave('2-3'), porto = fixtureMapMetadata(2); porto.secretRoute = [porto.nodes['2-3'], { x: .63, y: .73 }, porto.nodes['2-5']];
    h.view.render(7, save, 0, ''); await finishWorld(h, 1); await finishWorld(h, 2, porto); h.view.render(7, save, 16, '');
    save.secrets.push('1-3'); h.view.render(9, save, 32, ''); assert.equal(h.internal.journey.legs.length, 2);
    h.internal.hud.skipButton.click(); save.secrets.push('2-3'); h.view.render(7, save, 100, '');
    assert.equal(h.internal.journey.legs.length, 1); assert.match(h.internal.journey.legs[0].id, /secret/);
});

test('failed Domínio terrain retains local navigation and explicit entry without inventing a sea edge', async t => {
    const h = mapDOM(t, true), save = openSave('6-1'); h.view.render(25, save, 0, '');
    await finishWorld(h, 6, actualMetadata(6), false); h.view.render(29, save, 16, '');
    assert.equal(h.internal.journey.arrived, '6-5'); assert.equal(h.events.entered, 0); assert.equal(h.internal.hud.enterButton.disabled, false);
    h.view.render(25, save, 32, ''); assert.equal(h.internal.journey.arrived, '6-1');
    assert.ok(h.internal.network.edges.every((edge: { from: string; to: string; mode: string }) => edge.mode !== 'sail'));
});

test('hidden documents skip direct map painting and the Game wrapper resumes when visible', t => {
    const h = mapDOM(t), g = worldHarness(); h.view.render(0, freshSave(), 0, ''); h.paint.calls.length = 0; h.documentMock.hidden = true;
    h.view.render(0, freshSave(), 100, ''); g.game.render(); assert.equal(h.paint.calls.length, 0); assert.equal(g.mapRenders.length, 0);
    h.documentMock.hidden = false; g.game.render(); assert.equal(g.mapRenders.length, 1);
});

test('asset prefixes preserve relative and subdirectory deployments', async () => {
    const { mapAssetPrefix } = await import('../src/adventure/WorldMapArt');
    for (const [base, expected] of [['/', '/assets/world/map/'], ['./', './assets/world/map/'], ['/game/', '/game/assets/world/map/'], ['/game', '/game/assets/world/map/']]) assert.equal(mapAssetPrefix(base), expected);
});

function worldHarness(ephemeral = false) {
    const values = new Map<string, string>(), writes: string[] = [], calls: string[] = [];
    const store = new ProgressStore({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); writes.push(value); } });
    const game = Object.create(WorldGame.prototype) as any, mapRenders: unknown[][] = [];
    Object.assign(game, { store, ephemeral, state: 'map', stage: STAGES[0], selection: 0, time: 1234, toast: '', toastTimer: 0, elapsed: 9,
        buttons: [{ run() {} }], menuSelection: 0, camera: { shakeTimer: 0 },
        input: { reset() { calls.push('reset'); }, setMenuMode(value: boolean) { calls.push(`menu:${value}`); } },
        audio: { cancelSpeech() {}, setDying() {}, pause() {}, select() {}, unlock() { calls.push('unlock'); }, sfx(name: string) { calls.push(`sfx:${name}`); } },
        renderer: { startScene() { calls.push('startScene'); }, getContext: () => canvasContext().context, present() { calls.push('present'); } },
        mapView: { render(...args: unknown[]) { mapRenders.push(args); }, hide() { calls.push('map:hide'); },
            selectDestination(index: number) { calls.push(`select:${index}`); }, enterSelected(index: number) { calls.push(`enter:${index}`); return false; } },
        renderTitle() { calls.push('title'); }, renderMap() { calls.push('legacyMap'); } });
    return { game, store, values, writes, calls, mapRenders };
}

test('WorldGame map rendering bypasses pixel UI, forwards warnings and consumes return context once', () => {
    const h = worldHarness(); h.game.selection = 8; h.store.warning = 'Storage warning'; h.game.toast = 'Locked'; h.game.toastTimer = 100;
    const returned = { playedStage: '2-3', nextSelected: '2-4' }; h.game.mapReturn = returned; h.game.render();
    assert.deepEqual(h.mapRenders[0], [8, h.store.save, 1234, 'Storage warning', 'Locked', returned]); assert.equal(h.game.mapReturn, undefined);
    assert.equal(h.calls.includes('startScene'), false); assert.equal(h.calls.includes('present'), false); assert.deepEqual(h.game.buttons, []);
    h.game.change('title'); h.game.render(); assert.ok(h.calls.includes('map:hide')); assert.ok(h.calls.includes('title')); assert.ok(h.calls.includes('present'));
});

test('ephemeral editor maps suppress storage warnings but preserve toasts and protected saves', () => {
    for (const ephemeral of [true, false]) {
        const h = worldHarness(ephemeral); h.game.store = new ProgressStore(null); h.game.store.persist(); h.game.toast = 'Conclua'; h.game.toastTimer = 10; h.game.render();
        assert.equal(h.mapRenders[0][3], ephemeral ? '' : h.game.store.warning); assert.equal(h.mapRenders[0][4], 'Conclua');
    }
    const h = worldHarness(); h.game.store = new ProgressStore({ getItem() { throw Error('Denied'); }, setItem() { assert.fail('Protected progress cannot be overwritten.'); } });
    h.game.render(); assert.match(String(h.mapRenders[0][3]), /Não foi possível abrir/); assert.equal(h.game.store.persist(), false);
});

test('WorldGame global shortcuts consult the journey gate and cannot bypass arrival or load a locked target', () => {
    const h = worldHarness(), loads: unknown[][] = []; h.game.load = (...args: unknown[]) => loads.push(args);
    h.game.selection = 1; h.game.enterSelected(); assert.equal(h.calls.length, 0); assert.match(h.game.toast, /Conclua/);
    h.store.save.completed.push('1-1'); h.game.enterSelected(); assert.ok(h.calls.includes('enter:1')); assert.deepEqual(loads, []);
    h.game.mapView = undefined; h.game.enterSelected(); assert.deepEqual(loads, [], 'Even the frame before lazy map mount cannot bypass the gate.');
});

test('WorldGame navigation changes only session selection, never persisted arrival or campaign progress', () => {
    const h = worldHarness(), before = structuredClone(h.store.save);
    for (const [index, selected] of [[NaN, 0], [-50, 0], [4.9, 4], [29, 29], [100, 29], [13, 13]]) { h.game.selectMap(index); assert.equal(h.game.selection, selected); }
    assert.deepEqual(h.store.save, before); assert.equal(h.writes.length, 0); assert.equal(h.calls.filter(call => call === 'sfx:coin').length, 6);
});

test('completion preserves the played arrival in storage while keeping the unlocked next target session-only', () => {
    const h = worldHarness(); h.game.stage = STAGES[4]; h.game.state = 'playing'; h.store.save.completed = STAGES.slice(0, 4).map(stage => stage.id);
    h.game.camera.shakeTimer = 130;
    h.game.complete(false); assert.equal(h.game.state, 'clear'); assert.equal(h.game.nextMapSelection, '2-1');
    assert.equal(h.game.camera.shakeTimer, 0);
    assert.equal(h.store.save.selected, '1-5'); assert.equal(JSON.parse(h.values.get(SAVE_KEY)!).selected, '1-5'); assert.ok(h.store.save.completed.includes('1-5'));
    h.game.toMap(); assert.equal(h.game.selection, 5); assert.deepEqual(h.game.mapReturn, { playedStage: '1-5', nextSelected: '2-1' });
    assert.equal(h.store.save.selected, '1-5');
});

test('return without clear restores played stage; menu visits restore last saved arrival', () => {
    const h = worldHarness(); h.game.state = 'paused'; h.game.stage = STAGES[13]; h.store.save.selected = '1-1';
    h.game.toMap(); assert.equal(h.game.selection, 13); assert.deepEqual(h.game.mapReturn, { playedStage: '3-4', nextSelected: '3-4' });
    assert.equal(h.store.save.selected, '3-4'); h.game.mapReturn = undefined; h.game.state = 'title'; h.game.selection = 25; h.game.toMap();
    assert.equal(h.game.selection, 13); assert.equal(h.game.mapReturn, undefined);
});

test('WorldGame lazy map creation is reused and arrival callback persists exactly the reached phase', t => {
    const h = mapDOM(t), g = worldHarness(); h.view.dispose(); g.game.mapView = undefined; g.game.mapCanvas = h.gameCanvas;
    g.game.store.save.completed.push('1-1'); g.game.render(); const view = g.game.mapView as WorldMapView;
    try {
        assert.ok(view instanceof WorldMapView); const children = h.body.children.length, requests = h.fetches.length;
        g.game.selectMap(1); g.game.time += 16; g.game.render(); assert.equal(g.store.save.selected, '1-1');
        const controller = view as any; controller.hud.skipButton.click(); assert.equal(g.store.save.selected, '1-2'); assert.equal(JSON.parse(g.values.get(SAVE_KEY)!).selected, '1-2');
        g.game.change('title'); g.game.toMap(); g.game.render(); assert.equal(g.game.mapView, view); assert.equal(h.body.children.length, children); assert.equal(h.fetches.length, requests);
        assert.equal(h.windowMock.count('resize'), 1); assert.equal(h.media.count('change'), 1);
    } finally { view.dispose(); }
});

const actualMetadata = (world: number) => JSON.parse(readFileSync(new URL(`../public/assets/world/map/${dioramaName(world)}.meta.json`, import.meta.url), 'utf8'));
const actualBoatMetadata = () => JSON.parse(readFileSync(new URL('../public/assets/world/map/journey-boat.meta.json', import.meta.url), 'utf8'));
async function readyConnection(h: ReturnType<typeof mapDOM>, save = openSave('1-5'), failAsset = '', holdAsset = '') {
    const selection = STAGES.findIndex(stage => stage.id === save.selected);
    h.view.render(selection, save, 0, ''); await finishWorld(h, 1, actualMetadata(1)); await finishWorld(h, 2, actualMetadata(2));
    for (const name of ['coast-port-journey', 'journey-boat']) {
        const data = JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}.meta.json`, import.meta.url), 'utf8'));
        h.fetches.find(request => request.url.endsWith(`${name}.meta.json`))!.resolve({ ok: true, json: async () => data });
    }
    await flushAssets();
    const connection = JSON.parse(readFileSync(new URL('../public/assets/world/map/coast-port-journey.meta.json', import.meta.url), 'utf8'));
    const boat = actualBoatMetadata();
    for (const size of [connection.islands.costa.overlay, connection.islands.porto.overlay, boat.atlas]) {
        const image = h.images.find(image => image.src.endsWith(size.path.split('/').pop()))!;
        assert.ok(image, `Expected validated journey image ${size.path}`);
        Object.assign(image, { naturalWidth: size.width, naturalHeight: size.height });
        if (holdAsset && size.path.includes(holdAsset)) continue;
        if (size.path.includes(failAsset) && failAsset) image.onerror?.(); else image.onload?.();
    }
    await flushAssets(); h.view.render(selection, save, 16, '');
}

async function finishFactory(h: ReturnType<typeof mapDOM>, failAsset = '') {
    await finishWorld(h, 3, actualMetadata(3), failAsset !== 'fabrica-diorama.webp');
    const data = JSON.parse(readFileSync(new URL('../public/assets/world/map/port-factory-bridge.meta.json', import.meta.url), 'utf8'));
    h.fetches.find(request => request.url.endsWith('port-factory-bridge.meta.json'))!.resolve({ ok: true, json: async () => data });
    await flushAssets();
    for (const state of ['open', 'closed']) {
        const size = data.overlays[state], image = h.images.find(image => image.src.endsWith(size.path.split('/').pop()));
        if (failAsset === 'fabrica-diorama.webp') { assert.equal(image, undefined); continue; }
        assert.ok(image, `Expected bridge layer ${state}`);
        Object.assign(image, { naturalWidth: size.width, naturalHeight: size.height });
        if (failAsset && size.path.includes(failAsset)) image.onerror?.(); else image.onload?.();
    }
    await flushAssets();
}

async function readyConnectedFactory(h: ReturnType<typeof mapDOM>, save = openSave('2-5')) {
    await readyConnection(h, save);
    const selection = STAGES.findIndex(stage => stage.id === save.selected);
    // Panorama is an explicit request for all authored neighboring regions.
    h.get('world-map-overview').click(); h.view.render(selection, save, 32, '');
    await finishFactory(h); h.view.render(selection, save, 48, '');
    h.get('world-map-overview').click(); h.view.render(selection, save, 64, '');
    assert.equal(h.internal.bridgeStatus, 'ready'); assert.equal(h.internal.bridgeActive, true);
}

async function finishSerra(h: ReturnType<typeof mapDOM>, failAsset = '') {
    await finishWorld(h, 4, actualMetadata(4), failAsset !== 'serra-diorama.webp');
    const cable = JSON.parse(readFileSync(new URL('../public/assets/world/map/serra-maintenance-cable.meta.json', import.meta.url), 'utf8'));
    h.fetches.find(request => request.url.endsWith('serra-maintenance-cable.meta.json'))!.resolve({ ok: true, json: async () => cable });
    assert.ok(h.fetches.every(request => !request.url.includes('factory-serra-link')), 'Removed bridge metadata must never be requested.');
    assert.ok(h.images.every(image => !image.src.includes('factory-serra-link')), 'Removed bridge overlays must never be requested.');
    await flushAssets();
    for (const size of [cable.atlas]) {
        const image = h.images.find(image => image.src.endsWith(size.path.split('/').pop()));
        if (failAsset === 'serra-diorama.webp') { assert.equal(image, undefined); continue; }
        assert.ok(image, `Expected Serra visual ${size.path}`);
        Object.assign(image, { naturalWidth: size.width, naturalHeight: size.height });
        if (failAsset && size.path.includes(failAsset)) image.onerror?.(); else image.onload?.();
    }
    await flushAssets();
}

async function readySerra(h: ReturnType<typeof mapDOM>, save = { ...openSave('4-3'), secrets: ['4-3'] }, failAsset = '', coastFail = '', factoryFail = '') {
    await readyConnection(h, save, coastFail);
    const selection = STAGES.findIndex(stage => stage.id === save.selected);
    h.get('world-map-overview').click(); h.view.render(selection, save, 32, '');
    await finishFactory(h, factoryFail); await finishSerra(h, failAsset); h.view.render(selection, save, 48, '');
    h.get('world-map-overview').click(); h.view.render(selection, save, 64, '');
}

async function finishPassenger(h: ReturnType<typeof mapDOM>, failAsset = '') {
    await finishWorld(h, 5, actualMetadata(5), failAsset !== 'reserva-diorama.webp');
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/serra-reserva-link.meta.json', import.meta.url), 'utf8'));
    h.fetches.find(request => request.url.endsWith('serra-reserva-link.meta.json'))!.resolve({ ok: true, json: async () => raw });
    await flushAssets();
    for (const size of [raw.atlas, ...raw.overlays]) {
        const image = h.images.find(image => image.src.endsWith(size.path.split('/').pop()));
        if (failAsset === 'reserva-diorama.webp') { assert.equal(image, undefined); continue; }
        assert.ok(image, `Expected passenger layer ${size.path}`);
        Object.assign(image, { naturalWidth: size.width, naturalHeight: size.height });
        if (failAsset && size.path.includes(failAsset)) image.onerror?.(); else image.onload?.();
    }
    await flushAssets();
}

async function readyReserva(h: ReturnType<typeof mapDOM>, save = openSave('4-5'), failAsset = '', coastFail = '') {
    await readySerra(h, save, '', coastFail); await finishPassenger(h, failAsset);
    h.view.render(STAGES.findIndex(stage => stage.id === save.selected), save, 80, '');
}

async function finishDominio(h: ReturnType<typeof mapDOM>, failAsset = '') {
    await finishWorld(h, 6, actualMetadata(6), failAsset !== 'dominio-diorama.webp');
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/reserva-dominio-journey.meta.json', import.meta.url), 'utf8'));
    h.fetches.find(request => request.url.endsWith('reserva-dominio-journey.meta.json'))!.resolve({ ok: true, json: async () => raw });
    await flushAssets();
    for (const size of raw.overlays) {
        const image = h.images.find(image => image.src.endsWith(size.path.split('/').pop()));
        if (failAsset === 'dominio-diorama.webp') { assert.equal(image, undefined); continue; }
        assert.ok(image, `Expected heated dock layer ${size.path}`);
        Object.assign(image, { naturalWidth: size.width, naturalHeight: size.height });
        if (failAsset && size.path.includes(failAsset)) image.onerror?.(); else image.onload?.();
    }
    await flushAssets();
}

async function readyDominio(h: ReturnType<typeof mapDOM>, save = openSave('5-5'), failAsset = '', coastFail = '') {
    await readyReserva(h, save, '', coastFail); await finishDominio(h, failAsset);
    h.view.render(STAGES.findIndex(stage => stage.id === save.selected), save, 96, '');
}

const buoyMetadata = () => JSON.parse(readFileSync(new URL('../public/assets/world/map/maritime-buoys.meta.json', import.meta.url), 'utf8'));
async function finishBuoyMetadata(h: ReturnType<typeof mapDOM>, value: unknown = buoyMetadata(), ok = true) {
    h.fetches.find(request => request.url.endsWith('maritime-buoys.meta.json'))!.resolve({ ok, json: async () => value });
    await flushAssets();
}
function buoyDraws(h: ReturnType<typeof mapDOM>) {
    return h.paint.calls.filter(call => call.method === 'drawImage' && String((call.args[0] as any)?.src).includes('maritime-buoy-'));
}
async function finishBuoyImages(h: ReturnType<typeof mapDOM>, outcome: 'ready' | 'failed' | 'wrong-size' = 'ready') {
    for (const sprite of Object.values(buoyMetadata().sprites) as any[]) {
        const image = h.images.find(image => image.src.endsWith(sprite.path.split('/').pop()))!;
        assert.ok(image);
        Object.assign(image, { naturalWidth: outcome === 'wrong-size' ? 1 : sprite.width, naturalHeight: sprite.height });
        if (outcome === 'failed') image.onerror?.(); else image.onload?.();
    }
    await flushAssets();
}

test('late optional buoy art repaints once without changing locked compact camera, controls, journey or save', async t => {
    const h = mapDOM(t, true), save = freshSave(); await readyDominio(h, save);
    h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 472, height: 303 };
    h.get('world-map-header').bounds = { x: 12, y: 6, left: 12, top: 6, width: 448, height: 44 };
    h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
    h.get('world-map-footer').bounds = { x: 12, y: 202.8, left: 12, top: 202.8, width: 448, height: 94 };
    h.observers[0].callback(); h.get('world-map-overview').click(); h.view.render(0, save, 100, '');
    const network = h.internal.network, camera = structuredClone(h.internal.camera), journey = structuredClone(h.internal.journey);
    const saved = structuredClone(save), positions = h.internal.compactOverviewPositions;
    const controls = nativeControlEntries(h).map(({ button }) => [button, button.style.transform, button.hidden, button.getAttribute('aria-label')]);
    assert.equal(buoyDraws(h).length, 0); assert.equal(h.internal.geometryDirty, false);
    await finishBuoyMetadata(h); await finishBuoyImages(h);
    assert.equal(h.internal.geometryDirty, false); assert.equal(h.internal.paintDirty, true);
    h.paint.calls.length = 0; h.view.render(0, save, 116, '');
    assert.equal(buoyDraws(h).length, 4, 'Ready route art shows all four props even while progression gates are locked.');
    assert.equal(h.internal.network, network); assert.deepEqual(h.internal.camera, camera);
    assert.deepEqual(h.internal.journey, journey); assert.deepEqual(save, saved);
    assert.equal(h.internal.compactOverviewPositions, positions);
    assert.deepEqual(nativeControlEntries(h).map(({ button }) => [button, button.style.transform, button.hidden, button.getAttribute('aria-label')]), controls);
    assert.equal(h.events.entered, 0); assert.equal(h.internal.assetWarning, '');
    h.paint.calls.length = 0; h.view.render(0, save, 132, '');
    assert.equal(h.paint.calls.length, 0, 'Stationary reduced-motion frames remain a no-op after optional art settles.');
    assert.equal(h.fetches.filter(request => request.url.endsWith('maritime-buoys.meta.json')).length, 1);
    assert.equal(h.images.filter(image => image.src.includes('maritime-buoy-')).length, 2);
});

test('buoys wait for each corresponding route art independently of progression and never become controls', async t => {
    const h = mapDOM(t, true), save = freshSave(); h.view.render(0, save, 0, '');
    await finishBuoyMetadata(h); await finishBuoyImages(h);
    h.paint.calls.length = 0; h.view.render(0, save, 16, ''); assert.equal(buoyDraws(h).length, 0);
    await readyConnection(h, save); h.get('world-map-overview').click(); h.paint.calls.length = 0; h.view.render(0, save, 32, '');
    assert.equal(h.internal.connectionActive, true); assert.equal(h.internal.dominioActive, false);
    assert.equal(buoyDraws(h).length, 2, 'Only the ready Coast/Porto route can display its two sprites.');
    assert.equal(h.root.textContent.includes('buoy'), false);
    assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.events.entered, 0);
});

test('optional buoy metadata or image failures stay silent and leave normal ferry navigation available', async t => {
    for (const failure of ['metadata', 'malformed', 'failed', 'wrong-size'] as const) await t.test(failure, async child => {
        const h = mapDOM(child, true), save = openSave('1-5'); await readyConnection(h, save);
        const network = h.internal.network;
        await finishBuoyMetadata(h, failure === 'malformed' ? {} : buoyMetadata(), failure !== 'metadata');
        if (failure === 'failed' || failure === 'wrong-size') await finishBuoyImages(h, failure);
        h.paint.calls.length = 0; h.view.render(4, save, 32, '');
        assert.equal(buoyDraws(h).length, 0); assert.equal(h.internal.assetWarning, ''); assert.equal(h.internal.network, network);
        h.view.selectDestination(5); h.view.render(5, save, 48, ''); h.internal.hud.skipButton.click(); h.view.render(5, save, 64, '');
        assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.events.entered, 0);
    });
});

test('disposing aborts pending buoy metadata and image callbacks without publishing late decoration', async t => {
    for (const pending of ['metadata', 'images']) await t.test(pending, async child => {
        const h = mapDOM(child, true); h.view.render(0, freshSave(), 0, '');
        if (pending === 'images') await finishBuoyMetadata(h);
        const callbacks = h.images.filter(image => image.src.includes('maritime-buoy-')).map(image => image.onload!);
        const count = h.images.length; h.view.dispose();
        if (pending === 'metadata') await finishBuoyMetadata(h);
        else { callbacks.forEach(callback => callback()); await flushAssets(); }
        assert.equal(h.images.length, count); assert.equal(h.internal.buoyImages.size, 0);
        assert.ok(h.fetches.find(request => request.url.endsWith('maritime-buoys.meta.json'))!.signal.aborted);
        assert.ok(h.images.filter(image => image.src.includes('maritime-buoy-')).every(image => image.onload === null && image.onerror === null));
        assert.equal(h.root.parent, null);
    });
});

test('all six owned overview labels select their own region and open its close view without entering', async t => {
    const h = mapDOM(t, true), save = openSave('4-3'); await readyDominio(h, save);
    let time = 100;
    h.get('world-map-overview').click(); h.view.render(17, save, time, '');
    h.internal.hud.overviewButtons[3].click();
    assert.equal(h.internal.overview, false); assert.equal(h.internal.controlSelection, 17);
    assert.equal(h.internal.journey.arrived, '4-3', 'Opening the focused island preserves its selected phase.');
    const names = ['Costa dos Gaps', 'Porto do Bielzão', 'Fábrica de Suco', 'Serra Suspensa', 'Reserva Gelada', 'Domínio Pizzarino'];
    for (let world = 1; world <= 6; world++) {
        h.get('world-map-overview').click(); h.view.render(h.internal.controlSelection, save, time += 100, '');
        nativeControlEntries(h);
        h.internal.hud.overviewButtons.forEach((button: Button, index: number) => {
            assert.equal(button.getAttribute('data-island-world'), String(index + 1));
            assert.ok(button.getAttribute('aria-label')!.includes(`Ilha ${index + 1}: ${names[index]}.`));
        });
        h.internal.hud.overviewButtons[world - 1].click();
        assert.equal(h.internal.overview, false); assert.equal(h.internal.controlSelection, world === 4 ? 17 : (world - 1) * 5);
        assert.equal(h.internal.journey.arrived, world <= 4 ? '4-3' : `${world}-1`);
        if (world <= 3) assert.equal(h.internal.journey.blocked, 'no-route');
        assert.equal(h.events.entered, 0);
    }
});

test('472px panorama with its real 94px footer keeps each numbered badge attached to its own shore', async t => {
    const h = mapDOM(t, true), save = { ...openSave('6-1'), secrets: ['1-3', '4-3', '5-3', '6-3'] }; await readyDominio(h, save);
    h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 472, height: 303 };
    h.get('world-map-header').bounds = { x: 12, y: 6, left: 12, top: 6, width: 448, height: 44 };
    h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
    h.get('world-map-footer').bounds = { x: 12, y: 203, left: 12, top: 203, width: 448, height: 94 };
    h.observers[0].callback(); h.get('world-map-overview').click(); h.view.render(25, save, 100, '');
    assert.equal(h.internal.frameInsets.bottom, 112);
    assert.equal(h.root.classList.contains('has-island-selector-fallback'), false, 'The real short overview can fit all six attached 44px targets.');
    const boxes = h.internal.hud.overviewButtons.map((button: Button, index: number) => {
        assert.equal(button.hidden, false); assert.match(button.getAttribute('aria-label')!, new RegExp(`Ilha ${index + 1}:`));
        const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(button.style.transform)!;
        const x = Number(match[1]), y = Number(match[2]);
        const b = atlasIslandBounds({ world: index + 1, metadata: currentArt(h, index + 1).metadata, placement: WORLD_ATLAS_PLACEMENTS[index + 1] });
        const left = mapToScreen({ x: b.left, y: b.bottom }, h.internal.camera), right = mapToScreen({ x: b.right, y: b.bottom }, h.internal.camera);
        assert.ok(x >= left.x && x <= right.x, 'A number stays within its own island silhouette, never its neighbor.');
        assert.ok(Math.abs(x - (left.x + right.x) / 2) <= 12 && Math.abs(y - (left.y + 8)) <= 12, 'Local adjustment stays bounded.');
        assert.ok(Math.abs(y - left.y) <= 12.5, 'The visible plank foot remains beside its own shore.');
        return { left: x - 22, right: x + 22, top: y - 44, bottom: y };
    });
    boxes.forEach((a: any, index: number) => {
        assert.ok(a.left >= 8 && a.right <= 464 && a.top >= 66 && a.bottom <= 189);
        for (const b of boxes.slice(index + 1)) assert.ok(a.right + 8 <= b.left || b.right + 8 <= a.left || a.bottom + 8 <= b.top || b.bottom + 8 <= a.top);
    });
    const positions = h.internal.compactOverviewPositions; h.view.render(25, save, 200, '');
    assert.equal(h.internal.compactOverviewPositions, positions);
});

test('compact overview fits the actual actor and all attached badges at fresh Costa, Factory and Domínio', async t => {
    for (const stage of ['1-1', '3-3', '6-1']) await t.test(stage, async child => {
        const h = mapDOM(child, true), save = stage === '1-1' ? freshSave() : openSave(stage); await readyDominio(h, save);
        const selection = STAGES.findIndex(entry => entry.id === stage);
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 472, height: 303 };
        h.get('world-map-header').bounds = { x: 12, y: 6, left: 12, top: 6, width: 448, height: 44 };
        h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
        h.get('world-map-footer').bounds = { x: 12, y: 202.8, left: 12, top: 202.8, width: 448, height: 94 };
        h.observers[0].callback(); h.get('world-map-overview').click(); h.view.render(selection, save, 100, '');
        const { camera, marker, frameInsets } = h.internal;
        assert.ok(camera.zoom > .12, 'A tiny overview actor does not reserve the close-view 44px margin.');
        const actor = atlasActorBounds(marker), a = mapToScreen({ x: actor.left, y: actor.top }, camera), b = mapToScreen({ x: actor.right, y: actor.bottom }, camera);
        assert.ok(a.x >= 16 && b.x <= 456 && a.y >= frameInsets.top && b.y <= 303 - frameInsets.bottom);
        for (let world = 1; world <= 6; world++) {
            const island = atlasIslandBounds({ world, metadata: currentArt(h, world).metadata, placement: WORLD_ATLAS_PLACEMENTS[world] });
            const top = mapToScreen({ x: island.left, y: island.top }, camera), bottom = mapToScreen({ x: island.right, y: island.bottom }, camera);
            assert.ok(top.x >= 16 && bottom.x <= 456 && top.y >= frameInsets.top && bottom.y <= 303 - frameInsets.bottom);
        }
        assert.equal(h.root.classList.contains('has-island-selector-fallback'), false, 'Fresh 1-1 also fits through a bounded retry, without relying on unlocks.');
        const feet = h.internal.hud.overviewButtons.map((button: Button, index: number) => {
            assert.equal(button.hidden, false);
            const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(button.style.transform)!;
            const x = Number(match[1]), y = Number(match[2]);
            const b = atlasIslandBounds({ world: index + 1, metadata: currentArt(h, index + 1).metadata, placement: WORLD_ATLAS_PLACEMENTS[index + 1] });
            const left = mapToScreen({ x: b.left, y: b.bottom }, camera), right = mapToScreen({ x: b.right, y: b.bottom }, camera);
            assert.ok(x >= left.x && x <= right.x && Math.abs(y - left.y) <= 12);
            assert.ok(Math.abs(x - (left.x + right.x) / 2) <= 12 && Math.abs(y - left.y - 8) <= 12, 'Retries must satisfy the original, unnudged anchor limits.');
            assert.ok(x - 22 >= 8 && x + 22 <= 464 && y - 44 >= frameInsets.top + 2 && y <= 303 - frameInsets.bottom - 2);
            return { x, y };
        });
        feet.forEach((point: MapPoint, index: number) => {
            for (const other of feet.slice(index + 1)) assert.ok(Math.abs(point.x - other.x) >= 52 || Math.abs(point.y - other.y) >= 52);
        });
        h.get('world-map-overview').click(); h.view.render(selection, save, 200, '');
        const close = mapToScreen(h.internal.marker, h.internal.camera);
        assert.ok(close.x >= 60 - 1e-8 && close.x <= 412 + 1e-8);
        assert.ok(close.y >= frameInsets.top + 44 - 1e-8 && close.y <= 303 - frameInsets.bottom - 44 + 1e-8);
        assert.equal(h.internal.journey.arrived, stage); assert.equal(h.events.entered, 0);
    });
});

test('normal-motion travel and overview settling retain actor framing within both disconnected regional chains', async t => {
    const h = mapDOM(t), save = openSave('1-1'); await readyDominio(h, save);
    h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 472, height: 303 };
    h.get('world-map-header').bounds = { x: 12, y: 6, left: 12, top: 6, width: 448, height: 44 };
    h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
    h.get('world-map-footer').bounds = { x: 12, y: 202.8, left: 12, top: 202.8, width: 448, height: 94 };
    h.observers[0].callback(); let time = 100, selection = 0;
    h.view.render(selection, save, time, '');
    const assertSubjects = () => {
        const v = h.internal, ferry = v.activeFerry(), parked = !v.journey.destination
            ? v.ferryLines().find((line: any) => line.definition.worlds.includes(STAGES[selection].world)) : undefined;
        const boat = v.currentBoats().find((entry: any) => entry.id === (ferry ?? parked)?.definition.id);
        const occupied = v.activeFerry(true);
        const boxes = [atlasActorBounds(v.marker, occupied ? boat?.frame : undefined, !occupied),
            ...(boat ? [atlasBoatBounds(boat.foot, boat.frame)] : [])];
        for (const bounds of boxes) {
            const a = mapToScreen({ x: bounds.left, y: bounds.top }, v.camera), b = mapToScreen({ x: bounds.right, y: bounds.bottom }, v.camera);
            assert.ok(a.x >= 16 && b.x <= 456 && a.y >= v.frameInsets.top && b.y <= 303 - v.frameInsets.bottom,
                `Actor/boat escaped during overview interpolation at ${STAGES[selection].id}: ${JSON.stringify({ a, b })}`);
        }
    };
    for (const destination of [0, 12, 25]) {
        if (destination === 25) {
            // The Serra–Domínio chain is entered through its saved arrival, never the removed bridge.
            h.view.hide(); save.selected = '5-5'; h.view.render(24, save, time += 100, '');
            assert.equal(h.internal.journey.arrived, '5-5');
        }
        selection = destination;
        if (selection) {
            h.internal.hud.regionButton.click();
            const regions = h.internal.hud.regionMenu.children.filter((entry: Element) => entry.classList.contains('world-map-region'));
            regions[STAGES[selection].world - 1].click();
            h.internal.hud.stageButtons[selection % 5].click(); h.view.render(selection, save, time += 100, '');
            assert.ok(h.internal.journey.destination);
            if (selection === 12) {
                const deadline = time + 30000;
                while (!h.internal.activeFerry(true) && time < deadline) h.view.render(selection, save, time += 100, '');
                assert.ok(h.internal.activeFerry(true), 'Exercise an occupied ferry before Skip.');
                h.get('world-map-overview').click();
                for (let frame = 0; frame < 5; frame++) { h.view.render(selection, save, time += 50, ''); assertSubjects(); }
            }
            h.internal.hud.skipButton.click(); h.view.render(selection, save, time += 50, '');
            assert.equal(h.internal.journey.arrived, STAGES[selection].id);
        }
        if (!h.internal.overview) h.get('world-map-overview').click();
        for (let frame = 0; frame < 60; frame++) { h.view.render(selection, save, time += 50, ''); assertSubjects(); }
        assert.equal(h.root.classList.contains('has-island-selector-fallback'), false, `Settled ${STAGES[selection].id} keeps its six badges.`);
        assert.equal(h.internal.hud.overviewButtons.filter((button: Button) => !button.hidden).length, 6);
        assert.ok(h.internal.camera.zoom > .12);
        h.get('world-map-overview').click();
        for (let frame = 0; frame < 40; frame++) h.view.render(selection, save, time += 50, '');
    }
    assert.equal(h.media.matches, false); assert.equal(h.events.entered, 0);
});

test('panorama primary action opens the selected island and a double click cannot also enter gameplay', async t => {
    const h = mapDOM(t), save = openSave('4-3'); await readyDominio(h, save);
    h.get('world-map-overview').click(); h.view.render(17, save, 100, '');
    const primary = h.internal.hud.enterButton as Button;
    assert.equal(h.get('world-map-stage-title').textContent, 'Ilha 4: Serra');
    assert.equal(h.get('world-map-location').textContent, 'Feka em 4-3 · Serra');
    assert.match(primary.getAttribute('aria-label')!, /Ver fases da ilha 4/);
    primary.dispatch('click', { detail: 1 });
    assert.equal(h.internal.overview, false); assert.equal(h.internal.controlSelection, 17);
    assert.equal(h.internal.journey.arrived, '4-3'); assert.equal(h.internal.journey.destination, null);
    assert.equal(h.events.entered, 0);
    primary.dispatch('click', { detail: 2 }); assert.equal(h.events.entered, 0);
    primary.dispatch('click', { detail: 1 }); assert.equal(h.events.entered, 1);
});

test('a locked panorama primary action preserves actual arrival and close-view prerequisites', async t => {
    const h = mapDOM(t), save = { ...freshSave(), selected: '1-5', completed: ['1-1', '1-2', '1-3', '1-4'] };
    await readyDominio(h, save); h.view.render(25, save, 100, '');
    h.get('world-map-overview').click(); h.view.render(25, save, 200, '');
    assert.equal(h.get('world-map-location').textContent, 'Feka em 1-5 · Costa');
    assert.match(h.get('world-map-status').textContent, /Escolha uma ilha para explorar/);
    const primary = h.internal.hud.enterButton as Button;
    assert.equal(primary.disabled, false); primary.click();
    assert.equal(h.internal.overview, false); assert.equal(h.internal.controlSelection, 25);
    assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.events.entered, 0);
    assert.equal(primary.disabled, false);
    assert.match(primary.getAttribute('aria-label')!, /Voltar ao Feka/);
    assert.match(h.get('world-map-status').textContent, /Prévia · Conclua 5-5/);
    assert.equal(h.get('world-map-location').textContent, 'Feka em 1-5 · Costa');
});

test('panorama keeps an in-flight journey intact through keyboard navigation and Skip arrival', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save);
    h.internal.hud.travelButtons['ferry-costa-porto'].click(); h.view.render(5, save, 100, '');
    h.get('world-map-overview').click(); h.view.render(5, save, 200, '');
    const journey = structuredClone(h.internal.journey);
    assert.ok(h.internal.hud.overviewButtons.every((button: Button) => button.hidden));
    h.root.focus();
    for (const key of ['ArrowRight', 'w', 'Enter', ' ']) {
        const event = h.root.dispatch('keydown', { key });
        assert.equal(event.defaultPrevented, true); assert.equal(h.active, h.root);
    }
    assert.deepEqual(h.internal.journey, journey); assert.equal(h.internal.controlSelection, 5);
    assert.equal(h.get('world-map-location').textContent, 'Última chegada: 1-5 · Costa');
    const skip = h.internal.hud.skipButton as Button; assert.equal(skip.hidden, false); skip.focus();
    assert.equal(skip.dispatch('keydown', { key: 'Enter' }).defaultPrevented, false); skip.click();
    assert.equal(h.internal.overview, true); assert.equal(h.internal.journey.arrived, '2-1');
    assert.equal(h.get('world-map-location').textContent, 'Feka em 2-1 · Porto');
    assert.equal(h.active, h.internal.hud.enterButton); assert.equal(h.events.entered, 0);
    h.internal.hud.enterButton.click();
    assert.equal(h.internal.overview, false); assert.equal(h.events.entered, 0);
});

test('owned island previews preserve Feka and restore the actual arrival when returning to its island', async t => {
    const h = mapDOM(t), save = { ...freshSave(), selected: '1-5', completed: ['1-1', '1-2', '1-3', '1-4'] };
    await readyDominio(h, save); const origin = { ...h.internal.marker };
    h.get('world-map-overview').click(); h.view.render(4, save, 100, '');
    h.internal.hud.overviewButtons[5].click();
    assert.equal(h.internal.overview, false); assert.equal(h.internal.journey.selected, '6-1');
    assert.equal(h.internal.journey.arrived, '1-5'); assert.deepEqual(h.internal.marker, origin);
    assert.deepEqual(h.events.arrived, []); assert.equal(h.view.enterSelected(25), false);
    h.get('world-map-overview').click(); h.view.render(25, save, 200, '');
    h.internal.hud.overviewButtons[0].click();
    assert.equal(h.internal.controlSelection, 4); assert.equal(h.internal.journey.destination, null);
    assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.events.entered, 0);
    h.internal.hud.enterButton.click(); assert.equal(h.events.entered, 1);
});

test('overview keyboard focus and native activation cannot leak into phase navigation or gameplay', async t => {
    const h = mapDOM(t), save = openSave('4-3'); await readyDominio(h, save);
    h.get('world-map-overview').click(); h.view.render(17, save, 100, '');
    const event = h.root.dispatch('keydown', { key: 'ArrowRight' });
    assert.equal(event.defaultPrevented, true); assert.equal(h.active, h.internal.hud.overviewButtons[4]);
    assert.equal(h.internal.controlSelection, 17); assert.equal(h.internal.journey.destination, null);
    const target = h.internal.hud.overviewButtons[4] as Button;
    const activation = target.dispatch('keydown', { key: 'Enter' });
    assert.equal(activation.defaultPrevented, false, 'Native button activation owns Enter.');
    target.click();
    assert.equal(h.internal.overview, false); assert.equal(h.internal.controlSelection, 20);
    assert.equal(h.internal.journey.arrived, '4-3'); assert.equal(h.internal.journey.destination, '5-1');
    assert.equal(h.events.entered, 0); h.internal.hud.skipButton.click(); h.view.render(20, save, 200, '');
    h.get('world-map-overview').click(); h.view.render(20, save, 300, '');
    h.root.dispatch('keydown', { key: 'Escape' });
    assert.equal(h.internal.overview, false); assert.equal(h.events.exited, 0);
    h.root.dispatch('keydown', { key: 'Escape' }); assert.equal(h.events.exited, 1);
});

test('Escape from a focused island after portrait resize restores the overview toggle without travelling or entering', async t => {
    const h = mapDOM(t, true), save = openSave('4-3'); await readyDominio(h, save);
    h.get('world-map-overview').click(); h.view.render(17, save, 100, '');
    h.root.dispatch('keydown', { key: 'ArrowRight' });
    const island = h.internal.hud.overviewButtons[4] as Button;
    assert.equal(h.active, island);
    h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 320, height: 568 };
    h.get('world-map-header').bounds = { x: 9, y: 10, left: 9, top: 10, width: 302, height: 84 };
    h.get('world-map-tools').bounds = { ...h.get('world-map-header').bounds };
    h.get('world-map-footer').bounds = { x: 9, y: 432, left: 9, top: 432, width: 302, height: 126 };
    h.observers[0].callback(); h.view.render(17, save, 200, '');
    assert.equal(h.active, island); assert.equal(island.hidden, false);
    const event = island.dispatch('keydown', { key: 'Escape' });
    h.view.render(17, save, 300, '');
    const toggle = h.get('world-map-overview');
    assert.equal(event.defaultPrevented, true); assert.equal(event.propagationStopped, true);
    assert.equal(h.internal.overview, false); assert.equal(island.hidden, true);
    assert.equal(h.active, toggle); assert.equal(toggle.hidden, false);
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    assert.equal(h.internal.controlSelection, 17); assert.equal(h.internal.journey.arrived, '4-3');
    assert.equal(h.internal.journey.destination, null); assert.deepEqual(h.events.selected, []);
    assert.deepEqual(h.events.arrived, []); assert.equal(h.events.entered, 0); assert.equal(h.events.exited, 0);
    toggle.dispatch('keydown', { key: 'Escape' }); assert.equal(h.events.exited, 1);
});

test('activating a focused departure retains map focus and focused skip arrival exposes Enter without starting gameplay', async t => {
    for (const mode of ['skip', 'natural'] as const) await t.test(mode, async child => {
        const h = mapDOM(child), save = openSave('1-5'); await readyConnection(h, save);
        const departure = h.internal.hud.travelButtons['ferry-costa-porto'] as Button;
        assert.equal(departure.hidden, false); departure.focus();
        assert.equal(departure.dispatch('keydown', { key: 'Enter' }).defaultPrevented, false);
        departure.click(); h.view.render(5, save, 100, '');
        assert.equal(departure.hidden, true); assert.equal(h.active, h.root);
        assert.equal(h.internal.journey.destination, '2-1'); assert.equal(h.internal.journey.arrived, '1-5');
        const skip = h.internal.hud.skipButton as Button; skip.focus();
        if (mode === 'skip') {
            assert.equal(skip.dispatch('keydown', { key: 'Enter' }).defaultPrevented, false); skip.click();
        } else tick(h, 5, save, 100, 12000);
        assert.equal(skip.hidden, true); assert.equal(h.internal.journey.arrived, '2-1');
        assert.equal(h.active, h.internal.hud.enterButton); assert.equal(h.internal.hud.enterButton.disabled, false);
        assert.equal(h.events.entered, 0); assert.equal(h.events.exited, 0); assert.deepEqual(h.events.arrived, [5]);
    });
});

test('heated ferry is gated by C2 and its return sign targets the real 5-5 terminal', async t => {
    const h = mapDOM(t), save = { ...openSave('5-5'), completed: STAGES.filter(stage => stage.world < 5 ||
        (stage.world === 5 && stage.id !== '5-5')).map(stage => stage.id) };
    await readyDominio(h, save);
    assert.equal(h.internal.dominioActive, true);
    assert.ok(!h.internal.network.edges.some((edge: any) => edge.id === 'reserva-dominio-sail'));
    h.internal.hud.travelButtons['ferry-reserva-dominio'].click();
    assert.equal(h.internal.journey.selected, '6-1'); assert.equal(h.internal.journey.arrived, '5-5');
    assert.equal(h.internal.journey.blocked, 'unavailable'); assert.equal(h.view.enterSelected(25), false);
    save.completed.push('5-5'); h.view.hide();
    h.view.render(25, save, 150, '', '', { playedStage: '5-5', nextSelected: '6-1' });
    assert.equal(h.internal.journey.arrived, '5-5');
    assert.ok(h.internal.journey.legs.some((edge: any) => edge.id === 'reserva-dominio-sail'));
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '6-1');
    h.view.render(25, save, 200, ''); h.internal.hud.travelButtons['ferry-dominio-reserva'].click();
    assert.equal(h.internal.journey.selected, '5-5'); assert.equal(h.internal.journey.destination, '5-5');
    assert.equal(h.events.entered, 0);
});

test('a natural heated-dock crossing moves only its own hull and preserves explicit arrival and entry', async t => {
    const h = mapDOM(t), save = openSave('5-5'); await readyDominio(h, save);
    const coast = h.internal.currentBoat(), oldFoot = { ...coast.foot }, oldFrame = coast.frame.index;
    const progress = structuredClone({ completed: save.completed, seals: save.seals });
    h.view.render(25, save, 100, ''); let time = 100, sawSail = false, sawBoard = false;
    while (h.internal.journey.destination && time < 30000) {
        h.paint.calls.length = 0; h.view.render(25, save, time += 100, '');
        const active = h.internal.journey.legs[0];
        if (active?.mode === 'board') sawBoard = true;
        if (active?.id === 'reserva-dominio-sail') {
            sawSail = true;
            assertPaintedPassengerOnDeck(h, 'reserva-dominio-sail');
            assert.equal(h.internal.activeFerry(true).definition.id, 'reserva-dominio-sail');
            assert.equal(h.view.enterSelected(25), false);
        }
        assert.deepEqual(h.internal.currentBoat().foot, oldFoot);
        assert.equal(h.internal.currentBoat().frame.index, oldFrame);
        if (h.internal.journey.destination) {
            assert.equal(h.internal.journey.arrived, '5-5'); assert.deepEqual(h.events.arrived, []);
            assert.ok(Object.values(h.internal.hud.travelButtons).every((button: any) => button.hidden));
        }
    }
    assert.ok(sawSail && sawBoard); assert.equal(h.internal.journey.arrived, '6-1');
    assert.equal(h.internal.dominioFerry.mooredWorld, 6); assert.deepEqual(h.events.arrived, [25]);
    assert.deepEqual({ completed: save.completed, seals: save.seals }, progress); assert.equal(h.events.entered, 0);
    assert.equal(h.view.enterSelected(25), true); assert.equal(h.events.entered, 1);
    h.view.hide(); h.view.render(25, save, time + 100, '', '', { playedStage: '6-1', nextSelected: '6-1' });
    assert.equal(h.internal.journey.arrived, '6-1'); assert.equal(h.internal.dominioFerry.mooredWorld, 6);
});

test('the Serra–Domínio ferry and cable pairs survive regional skips, reversals and reload at the saved arrival', async t => {
    const h = mapDOM(t), save = { ...openSave('4-3'), secrets: ['1-3', '4-3', '5-3', '6-3'] }; await readyDominio(h, save);
    h.view.render(25, save, 100, '');
    for (const edge of ['serra-maintenance-cable-a', 'serra-reserva-passenger-a', 'reserva-dominio-sail'])
        assert.ok(h.internal.journey.legs.some((leg: any) => leg.id === edge));
    h.internal.hud.skipButton.click();
    assert.equal(h.internal.journey.arrived, '6-1'); assert.equal(h.internal.coastFerry.mooredWorld, 2);
    assert.equal(h.internal.dominioFerry.mooredWorld, 6); assert.equal(h.events.entered, 0);
    save.selected = '6-1'; h.view.render(17, save, 200, '');
    let time = 200;
    while (h.internal.journey.legs[0]?.id !== 'reserva-dominio-sail' && time < 10000) {
        h.paint.calls.length = 0; h.view.render(17, save, time += 100, '');
    }
    assert.equal(h.internal.journey.legs[0]?.id, 'reserva-dominio-sail');
    const foot = { ...h.internal.marker }; h.view.selectDestination(26);
    assert.deepEqual(h.internal.marker, foot); assert.equal(h.internal.journey.legs[0].direction, 1);
    h.view.selectDestination(17); assert.deepEqual(h.internal.marker, foot);
    h.view.hide(); h.view.render(25, save, time += 100, '');
    assert.equal(h.internal.journey.arrived, '6-1'); assert.equal(h.internal.dominioFerry.mooredWorld, 6);
    h.media.matches = true; h.view.render(17, save, time += 100, '');
    assert.equal(h.internal.journey.arrived, '4-3'); assert.equal(h.internal.coastFerry.mooredWorld, 2);
    assert.equal(h.internal.dominioFerry.mooredWorld, 5); assert.equal(h.events.entered, 0);
});

test('a failed Costa dock cannot suppress the shared hull on the independent heated ferry', async t => {
    const h = mapDOM(t, true), save = openSave('5-5'); await readyDominio(h, save, '', 'costa-journey-dock.webp');
    assert.equal(h.internal.connectionActive, false); assert.equal(h.internal.dominioActive, true);
    assert.ok(h.internal.boatImage); assert.equal(h.internal.currentBoat(), undefined);
    assert.ok(h.internal.currentBoat('reserva-dominio-sail'));
    assert.equal(h.fetches.filter(request => request.url.endsWith('journey-boat.meta.json')).length, 1);
    assert.equal(h.images.filter(image => image.src.endsWith(actualBoatMetadata().atlas.path.split('/').pop())).length, 1);
    h.view.render(25, save, 100, ''); assert.equal(h.internal.journey.arrived, '6-1');
    assert.equal(h.internal.dominioFerry.mooredWorld, 6);
});

test('failed heated dock layers preserve both cable lines and the original ferry', async t => {
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/reserva-dominio-journey.meta.json', import.meta.url), 'utf8'));
    for (const failAsset of ['dominio-diorama.webp', raw.overlays[0].path.split('/').pop()]) await t.test(failAsset, async child => {
        const h = mapDOM(child), save = openSave('5-5'); await readyDominio(h, save, failAsset);
        assert.equal(h.internal.dominioStatus, 'failed'); assert.equal(h.internal.dominioActive, false);
        assert.equal(h.internal.connectionActive, true); assert.equal(h.internal.maintenanceActive, true);
        assert.equal(h.internal.passengerActive, true);
        const oldBoat = structuredClone(h.internal.currentBoat().foot);
        h.view.render(25, save, 100, ''); assert.equal(h.internal.journey.arrived, '6-1');
        assert.equal(h.internal.dominioFerry.mooredWorld, 5);
        assert.deepEqual(h.internal.currentBoat().foot, oldBoat); assert.equal(h.events.entered, 0);
    });
});

test('late heated dock readiness waits for a safe arrival without resetting the other vehicles', async t => {
    const h = mapDOM(t), save = { ...openSave('5-1'), secrets: ['5-3'] }; await readyReserva(h, save);
    const oldBoat = structuredClone(h.internal.currentBoat().foot);
    h.view.render(24, save, 100, ''); const pointBefore = { ...h.internal.marker };
    await finishDominio(h);
    assert.equal(h.internal.dominioStatus, 'ready'); assert.equal(h.internal.dominioActive, false);
    h.view.render(24, save, 116, ''); assert.notDeepEqual(h.internal.marker, pointBefore);
    assert.equal(h.internal.dominioActive, false); assert.equal(h.internal.journey.arrived, '5-1');
    h.internal.hud.skipButton.click(); h.view.render(24, save, 200, '');
    assert.equal(h.internal.dominioActive, true); assert.equal(h.internal.journey.arrived, '5-5');
    assert.deepEqual(h.internal.currentBoat().foot, oldBoat);
    assert.equal(h.fetches.filter(request => request.url.endsWith('journey-boat.meta.json')).length, 1);
});

test('the Serra–Reserva–Domínio route frames every occupied vehicle and keeps overview targets separate', async t => {
    const { atlasCableBounds } = await import('../src/adventure/WorldCableArt');
    const { atlasBoatBounds } = await import('../src/adventure/WorldAtlasArt');
    for (const [width, height] of [[320, 568], [472, 303], [590, 378], [740, 320]]) await t.test(`${width}x${height}`, async child => {
        const h = mapDOM(child), save = { ...openSave('4-3'), secrets: ['1-3', '4-3', '5-3', '6-3'] }; await readyDominio(h, save);
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width, height };
        h.get('world-map-header').bounds = { x: 8, y: 6, left: 8, top: 6, width: width - 16, height: 44 };
        h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
        h.get('world-map-footer').bounds = { x: 8, y: height - 76, left: 8, top: height - 76, width: width - 16, height: 68 };
        h.observers[0].callback(); let time = 100; const vehicles = new Set<string>();
        h.view.render(29, save, time, '');
        while (h.internal.journey.destination && time < 150000) {
            h.paint.calls.length = 0; h.view.render(29, save, time += 100, '');
            const active = h.internal.journey.legs[0]; if (!active) continue;
            assert.equal(h.internal.journey.arrived, '4-3');
            const actor = mapToScreen(h.internal.marker, h.internal.camera);
            assert.ok(actor.x >= 0 && actor.x <= width && actor.y >= h.internal.frameInsets.top && actor.y <= height - h.internal.frameInsets.bottom,
                `${active.id}: actor outside ${width}x${height}: ${JSON.stringify(actor)}`);
            const cable = h.internal.activeCableCar(), ferry = h.internal.activeFerry();
            if (!cable && !ferry) continue;
            const bounds = cable ? atlasCableBounds(h.internal.currentCableCars().find((car: any) => car.id === cable)) : (() => {
                const boat = h.internal.currentBoat(ferry.definition.id); return atlasBoatBounds(boat.foot, boat.frame);
            })();
            vehicles.add(cable ? cable.startsWith('serra-reserva') ? 'passenger' : 'maintenance' : ferry.definition.id);
            const a = mapToScreen({ x: bounds.left, y: bounds.top }, h.internal.camera), b = mapToScreen({ x: bounds.right, y: bounds.bottom }, h.internal.camera);
            assert.ok(a.x >= 16 && b.x <= width - 16 && a.y >= h.internal.frameInsets.top && b.y <= height - h.internal.frameInsets.bottom,
                `${active.id}: carrier outside ${width}x${height}: ${JSON.stringify({ a, b })}`);
        }
        assert.equal(h.internal.journey.arrived, '6-5'); assert.equal(h.events.entered, 0);
        assert.deepEqual([...vehicles].sort(), ['maintenance', 'passenger', 'reserva-dominio-sail']);
        h.get('world-map-overview').click(); tick(h, 29, save, time, 3000);
        const entries = nativeControlEntries(h);
        const boxes = entries.flatMap(({ button, width: wide, height: tall }) => {
            if (button.hidden) return [];
            const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(button.style.transform)!;
            const x = Number(match[1]), y = Number(match[2]);
            return [{ left: x - wide / 2, right: x + wide / 2, top: y - tall, bottom: y }];
        });
        boxes.forEach((a, i) => {
            assert.ok(a.left >= 8 && a.right <= width - 8 && a.top >= h.internal.frameInsets.top && a.bottom <= height - h.internal.frameInsets.bottom,
                `Overview target outside ${width}x${height}: ${JSON.stringify(a)}`);
            for (const b of boxes.slice(i + 1)) assert.ok(a.right + 8 <= b.left || b.right + 8 <= a.left || a.bottom + 8 <= b.top || b.bottom + 8 <= a.top);
        });
    });
});

test('Costa to Porto travels through connected docks with Feka aboard, saves only final arrival and waits for Enter', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save);
    assert.equal(h.internal.connectionStatus, 'ready'); assert.equal(h.internal.connectionActive, true);
    assert.ok(h.internal.network.nodes['1-junction']); assert.ok(h.internal.network.edges.some((edge: { id: string }) => edge.id === 'coast-port-sail'));
    h.view.render(5, save, 100, ''); const modes = new Set<string>();
    for (let time = 150; time <= 12000; time += 50) {
        h.view.render(5, save, time, ''); const mode = h.internal.motionState(); modes.add(mode);
        if (mode === 'sailing') {
            assert.equal(h.internal.journey.arrived, '1-5'); assertPaintedPassengerOnDeck(h);
            assert.equal(h.view.enterSelected(5), false); assert.equal(h.internal.hud.stageButtons.every((button: Button) => button.hidden), true);
        }
    }
    assert.ok(modes.has('walking')); assert.ok(modes.has('boarding')); assert.ok(modes.has('sailing')); assert.ok(modes.has('arriving')); assert.ok(modes.has('idle'));
    assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.events.entered, 0); assert.deepEqual(h.events.arrived, [5]);
    assert.equal(h.internal.hud.enterButton.disabled, false); h.internal.hud.enterButton.click(); assert.equal(h.events.entered, 1);
});

test('boat retargets continuously in both directions and never changes last arrival mid-crossing', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save); h.view.render(5, save, 100, '');
    let time = 100;
    while (h.internal.motionState() !== 'sailing' && time < 5000) { time += 50; h.view.render(5, save, time, ''); }
    for (let i = 0; i < 8; i++) { time += 50; h.view.render(5, save, time, ''); }
    const feet = { ...h.internal.marker }; h.view.render(4, save, time, '');
    assert.deepEqual(h.internal.marker, feet); assert.equal(h.internal.journey.legs[0].mode, 'sail'); assert.equal(h.internal.journey.legs[0].direction, -1);
    assert.equal(h.internal.journey.arrived, '1-5'); assert.deepEqual(h.events.arrived, []);
    h.view.render(5, save, time, ''); assert.deepEqual(h.internal.marker, feet); assert.equal(h.internal.journey.legs[0].direction, 1);
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.events.entered, 0);
    h.view.render(0, save, time + 50, ''); assert.ok(h.internal.journey.legs.some((leg: { mode: string; direction: number }) => leg.mode === 'sail' && leg.direction === -1));
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.events.entered, 0);
});

test('loading a crossing keeps entry gated and cancelling or inspecting locked destinations remains safe', async t => {
    const h = mapDOM(t), save = openSave('1-5'); h.view.render(4, save, 0, ''); h.view.render(5, save, 50, '');
    assert.equal(h.internal.journey.blocked, 'no-route'); assert.equal(h.view.enterSelected(5), false); assert.match(h.get('world-map-hint').textContent, /Preparando/);
    assert.equal(h.get('world-map-status').textContent, 'Prévia · Feka não chegou aqui');
    assert.equal(h.internal.hud.state.prerequisiteStage, null);
    assert.doesNotMatch(h.get('world-map-hint').textContent, /Conclua/);
    h.view.render(3, save, 100, ''); assert.equal(h.internal.journey.destination, '1-4'); assert.equal(h.internal.journey.blocked, null);
    h.view.hide(); h.view.render(4, save, 5000, ''); assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.internal.journey.destination, null);
    const locked = freshSave(); h.view.hide(); h.view.render(0, locked, 5100, ''); h.view.render(5, locked, 5150, '');
    assert.equal(h.internal.journey.blocked, 'unavailable'); assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.view.enterSelected(5), false);
});

test('failed crossing art exposes a clear usable region fallback without inventing any water route', async t => {
    const h = mapDOM(t, true), save = openSave('1-5'); await readyConnection(h, save, actualBoatMetadata().atlas.path.split('/').pop());
    assert.equal(h.internal.connectionStatus, 'failed'); h.view.render(5, save, 100, '');
    assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.internal.journey.destination, null); assert.equal(h.events.entered, 0);
    assert.ok(h.internal.network.edges.every((edge: { mode: string }) => edge.mode !== 'sail'));
    assert.match(h.get('world-map-warning').textContent, /travessia visual não carregou/); assert.equal(h.internal.hud.enterButton.disabled, false);
});

test('a stalled ferry image releases the loading gate without retrying or accepting late art', async t => {
    const connection = JSON.parse(readFileSync(new URL('../public/assets/world/map/coast-port-journey.meta.json', import.meta.url), 'utf8'));
    const paths: string[] = [connection.islands.costa.overlay.path, connection.islands.porto.overlay.path, actualBoatMetadata().atlas.path];
    for (const path of paths) await t.test(path, async child => {
        child.mock.timers.enable({ apis: ['setTimeout'] });
        const h = mapDOM(child, true), save = { ...freshSave(), selected: '1-5', completed: STAGES.filter(stage => stage.world === 1).map(stage => stage.id) };
        const before = structuredClone(save);
        await readyConnection(h, save, '', path.split('/').pop()!);
        const image = h.images.find(image => image.src.endsWith(path.split('/').pop()!))!;
        const lateSuccess = image.onload!, requests = [h.images.length, h.fetches.length];
        h.view.render(5, save, 50, '');
        assert.equal(h.internal.connectionStatus, 'loading');
        assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.view.enterSelected(5), false);
        assert.match(h.get('world-map-hint').textContent, /Preparando/);
        child.mock.timers.tick(11_999); await flushAssets();
        assert.equal(h.internal.connectionStatus, 'loading', 'Slow images retain their full loading window.');
        child.mock.timers.tick(1); await flushAssets();
        assert.equal(h.internal.connectionStatus, 'failed', 'A silent image request must not gate an unlocked stage forever.');
        assert.equal(image.onload, null); assert.equal(image.onerror, null);
        h.view.render(5, save, 12_050, '');
        assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.internal.journey.destination, null);
        assert.equal(h.internal.hud.enterButton.disabled, false); assert.equal(h.events.entered, 0);
        assert.match(h.get('world-map-warning').textContent, /travessia visual não carregou/);
        assert.ok(h.internal.network.edges.every((edge: { mode: string }) => edge.mode !== 'sail'));
        assert.equal(h.internal.artCache.get(1).status, 'ready'); assert.equal(h.internal.artCache.get(2).status, 'ready');
        lateSuccess(); await flushAssets();
        h.view.hide(); h.view.render(5, save, 12_100, '');
        assert.equal(h.internal.connectionStatus, 'failed'); assert.equal(h.internal.connectionActive, false);
        assert.deepEqual([h.images.length, h.fetches.length], requests, 'Rendering and reopening do not retry expired images.');
        assert.equal(h.view.enterSelected(5), true); assert.equal(h.events.entered, 1); assert.deepEqual(save, before);
    });
});

test('a phase clear crossing and reloading mid-sail both begin at the played Costa arrival', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save); h.view.hide();
    h.view.render(5, save, 1000, '', '', { playedStage: '1-5', nextSelected: '2-1' });
    assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.internal.journey.destination, '2-1'); assert.equal(h.internal.motionState(), 'walking');
    let time = 1000; while (h.internal.motionState() !== 'sailing' && time < 6000) { time += 50; h.view.render(5, save, time, ''); }
    assert.equal(h.internal.motionState(), 'sailing'); h.view.hide(); h.view.render(4, save, 9000, '');
    assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.internal.journey.destination, null); assert.deepEqual(h.internal.marker, point(actualMetadata(1).nodes['1-5']));
});

test('recovering a locked saved region seeds the ferry at Feka’s actual arrival', async t => {
    const h = mapDOM(t), save = { ...freshSave(), selected: '2-4' };
    await readyConnection(h, save);
    assert.equal(h.internal.journey.arrived, '1-1');
    assert.equal(h.internal.journey.blocked, 'unavailable');
    assert.equal(h.internal.coastFerry.mooredWorld, 1);
    const waiting = structuredClone(h.internal.currentBoat().foot);
    h.view.render(0, save, 100, '');
    save.completed = STAGES.filter(stage => stage.world === 1).map(stage => stage.id);
    h.view.render(5, save, 150, '');
    assert.equal(h.internal.journey.arrived, '1-1');
    assert.equal(h.internal.journey.destination, '2-1');
    assert.deepEqual(h.internal.currentBoat().foot, waiting);
});

test('vertical keyboard region selection matches docks and drawer rather than retaining a locked phase number', t => {
    mapDOM(t); const h = worldHarness(); h.game.selection = 2; h.game.menuKey({ key: 'ArrowDown', repeat: false, target: null, preventDefault() {} });
    assert.equal(h.game.selection, 5); h.game.menuKey({ key: 'ArrowUp', repeat: false, target: null, preventDefault() {} }); assert.equal(h.game.selection, 0);
});

test('the View forwards continuous ferry headings and attached deck poses without rewriting the authored route', async t => {
    const { journeyLegPoint } = await import('../src/adventure/WorldJourneyModel');
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save);
    const route: MapPoint[] = h.internal.connection.sailRoute;
    const snapshot = structuredClone(route), edge = h.internal.network.edges.find((edge: { mode: string }) => edge.mode === 'sail');
    let previous: number | undefined;
    for (let frame = 0; frame <= 360; frame++) {
        const leg = { ...edge, direction: 1 as const, progress: frame / 360 };
        h.internal.journey.legs = [leg]; h.internal.marker = journeyLegPoint(leg); h.internal.lastTime = frame * 1000 / 60;
        const boat = h.internal.currentBoat(), angle = boat.motion.screenHeading;
        if (previous !== undefined) assert.ok(Math.abs(Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous))) < .15);
        previous = angle;
        assert.deepEqual(h.internal.currentBoat(), boat, 'Resampling the same timestamp cannot advance the turn.');
    }
    assert.deepEqual(route, snapshot);
});

test('atlas camera eases overview and channel transitions while keeping boat bounds inside the measured scene', async t => {
    const { atlasBoatBounds } = await import('../src/adventure/WorldAtlasArt');
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save); tick(h, 4, save, 16, 1000);
    const before = structuredClone(h.internal.camera); h.get('world-map-overview').click(); h.view.render(4, save, 1032, '');
    const middle = structuredClone(h.internal.camera); tick(h, 4, save, 1032, 2000); const after = structuredClone(h.internal.camera);
    assert.ok(middle.zoom < before.zoom && middle.zoom > after.zoom, 'Overview zoom must move through an intermediate frame.');
    assert.ok(Math.hypot(middle.center.x - after.center.x, middle.center.y - after.center.y) > .0001);
    h.get('world-map-overview').click(); tick(h, 4, save, 3032, 2000);
    h.view.render(5, save, 5050, ''); let sawChannel = false;
    for (let time = 5100; time <= 15000; time += 50) {
        h.view.render(5, save, time, ''); const mode = h.internal.motionState();
        if (mode === 'sailing' || mode === 'boarding' || mode === 'arriving') {
            sawChannel = true; const boat = h.internal.currentBoat(), bounds = atlasBoatBounds(boat.foot, boat.frame);
            const top = mapToScreen({ x: bounds.left, y: bounds.top }, h.internal.camera), bottom = mapToScreen({ x: bounds.right, y: bounds.bottom }, h.internal.camera);
            assert.ok(top.x >= 16 - .001 && bottom.x <= h.internal.width - 16 + .001);
            assert.ok(top.y >= h.internal.frameInsets.top - .001 && bottom.y <= h.internal.height - h.internal.frameInsets.bottom + .001);
        }
    }
    assert.ok(sawChannel);
});

test('camera framing snaps after resize and for reduced motion without moving either island', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save); tick(h, 4, save, 16, 1000);
    h.get('world-map-scene').bounds.width = 400; h.get('world-map-scene').bounds.height = 606; h.observers[0].callback(); h.view.render(4, save, 1100, '');
    const resized = structuredClone(h.internal.camera); h.media.matches = true; h.media.dispatch('change'); h.view.render(4, save, 1116, '');
    assert.deepEqual(h.internal.camera, resized, 'Resize already frames the target immediately.');
    const node = { ...h.internal.network.nodes['2-1'] }; h.get('world-map-overview').click(); h.view.render(4, save, 1132, ''); const overview = structuredClone(h.internal.camera);
    h.view.render(4, save, 1148, ''); assert.deepEqual(h.internal.camera, overview); assert.deepEqual(h.internal.network.nodes['2-1'], node);
});

test('arrow selection keeps keyboard focus and Enter on that sign obeys arrival without changing mouse or Space selection', async t => {
    const h = mapDOM(t), save = openSave(); await readyLand(h, save); h.root.dispatch('keydown', { key: 'ArrowRight' });
    const sign = h.internal.hud.stageButtons[1] as Button; assert.equal(h.active, sign);
    const traveling = sign.dispatch('keydown', { key: 'Enter' }); assert.equal(traveling.defaultPrevented, true); assert.equal(h.events.entered, 0);
    tick(h, 1, save, 16, 1000); assert.equal(h.active, sign); assert.equal(h.internal.journey.arrived, '1-2');
    const space = sign.dispatch('keydown', { key: ' ' }); assert.equal(space.defaultPrevented, false, 'Space keeps native sign selection.');
    sign.click(); sign.click(); assert.equal(h.events.entered, 0, 'Repeated mouse/touch selection never starts gameplay.');
    const tab = sign.dispatch('keydown', { key: 'Tab' }); assert.equal(tab.defaultPrevented, false);
    const entered = sign.dispatch('keydown', { key: 'Enter' }); assert.equal(entered.defaultPrevented, true); assert.equal(entered.propagationStopped, true);
    assert.equal(h.events.entered, 1); sign.dispatch('keydown', { key: 'Enter' }); assert.equal(h.events.entered, 1);
});

test('each dock sign names and selects the opposite destination, with that destination’s availability', async t => {
    const { localToAtlas, COAST_PORT_PLACEMENTS } = await import('../src/adventure/WorldAtlasModel');
    const h = mapDOM(t, true), save = openSave('1-5'); await readyConnection(h, save);
    const assertDockPosition = (destination: 1 | 2) => {
        const departure = destination === 1 ? 2 : 1;
        const projected = mapToScreen(localToAtlas(h.internal.connection.docks[departure].dock, COAST_PORT_PLACEMENTS[departure]), h.internal.camera);
        const button = h.internal.hud.dockButtons[destination - 1] as Button;
        const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(button.style.transform)!;
        const actual = { x: Number(match[1]), y: Number(match[2]) };
        assert.ok(Math.hypot(actual.x - projected.x, actual.y - projected.y) < 48, 'Dock labels remain close to their actual departure dock.');
        if (Math.hypot(actual.x - projected.x, actual.y - projected.y) > 2) {
            assert.ok(h.paint.calls.some(call => call.method === 'lineTo' && call.args[0] === Math.round(projected.x) && call.args[1] === Math.round(projected.y)),
                'A displaced dock label has a visible leader back to its actual dock.');
            assert.ok(h.paint.calls.some(call => call.method === 'clip' && call.args[0] === 'evenodd'), 'Leader drawing excludes actor/boat sprite bounds.');
        }
        return button;
    };
    const toPort = assertDockPosition(2); assert.equal(toPort.hidden, false); assert.match(toPort.getAttribute('aria-label')!, /Porto/);
    toPort.click(); assert.deepEqual(h.events.selected, [5]); assert.equal(h.internal.journey.selected, '2-1');
    h.view.render(5, save, 100, '');
    const toCoast = assertDockPosition(1); assert.equal(toCoast.hidden, false); assert.match(toCoast.getAttribute('aria-label')!, /Costa/);
    toCoast.click(); assert.deepEqual(h.events.selected, [5, 0]); assert.equal(h.internal.journey.selected, '1-1');
    h.view.hide(); const locked = freshSave(); h.view.render(0, locked, 200, '');
    const closedPort = assertDockPosition(2); assert.equal(closedPort.classList.contains('is-locked'), true);
    assert.match(closedPort.getAttribute('aria-label')!, /bloqueada/); closedPort.click();
    assert.equal(h.internal.journey.selected, '2-1'); assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.internal.journey.blocked, 'unavailable');
    assert.equal(h.get('world-map-status').textContent, 'Prévia · Conclua 1-5');
    assert.equal(h.get('world-map-hint').textContent, 'Conclua 1-5: Joãozão na Ponte para visitar esta fase.');
    const announcement = h.root.children.find(child => child.getAttribute('role') === 'status')!.textContent;
    assert.match(announcement, /Prévia\. Conclua 1-5: Joãozão na Ponte/);
    assert.equal(announcement.match(/1-5/g)?.length, 1);
});

test('locked Porto preview frames all five signs without dragging the camera toward Costa, and return/overview preserve arrival', async t => {
    const h = mapDOM(t), save = freshSave(); await readyConnection(h, save); tick(h, 0, save, 16, 1500);
    const originalPoint = { ...h.internal.marker }, portNodes = structuredClone(h.internal.network.nodes);
    const assertVisibleRegion = (world: number) => {
        for (let n = 0; n < 5; n++) {
            const node = mapToScreen(h.internal.network.nodes[`${world}-${n + 1}`], h.internal.camera);
            const sign = h.internal.hud.stageButtons[n] as Button;
            assert.equal(sign.hidden, false, `${world}-${n + 1} sign remains available for inspection`);
            assert.ok(node.x >= 0 && node.x <= h.internal.width && node.y >= 0 && node.y <= h.internal.height);
            assert.ok(node.x + 36 - 28 >= 0 && node.x + 36 + 28 <= h.internal.width,
                `${world}-${n + 1} full sign is inside horizontal frame`);
            assert.ok(node.y - 58 >= 0 && node.y <= h.internal.height, `${world}-${n + 1} full sign is inside vertical frame`);
        }
    };
    h.internal.hud.dockButtons[1].click(); h.view.render(5, save, 1600, ''); tick(h, 5, save, 1600, 3000);
    assertVisibleRegion(2); assert.equal(h.internal.journey.arrived, '1-1'); assert.deepEqual(h.internal.marker, originalPoint);
    const origin = mapToScreen(originalPoint, h.internal.camera); assert.ok(origin.x < 0, 'Origin Feka may be offscreen while inspecting locked Porto.');
    h.get('world-map-overview').click(); tick(h, 5, save, 4600, 3000); nativeControlEntries(h);
    for (const world of [1, 2]) for (let n = 1; n <= 5; n++) {
        const node = mapToScreen(h.internal.network.nodes[`${world}-${n}`], h.internal.camera);
        assert.ok(node.x >= 0 && node.x <= h.internal.width && node.y >= 0 && node.y <= h.internal.height, 'Overview shows both unchanged regions.');
    }
    h.get('world-map-overview').click(); tick(h, 5, save, 7600, 3000); assertVisibleRegion(2);
    h.view.render(0, save, 10700, ''); tick(h, 0, save, 10700, 3000); assertVisibleRegion(1);
    assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.internal.journey.destination, null); assert.deepEqual(h.events.arrived, []);
    assert.deepEqual(h.internal.network.nodes, portNodes, 'Preview camera changes never move either island.');
});

test('real DOM controls keep separate native targets at zoom200%, portrait and short landscape', async t => {
    const h = mapDOM(t, true), save = freshSave(); await readyConnection(h, save);
    let time = 100;
    for (const [width, height, top, footerTop] of [[590, 378, 6, 314], [320, 568, 10, 432], [400, 606, 10, 476], [846, 392, 6, 322]]) {
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width, height };
        h.get('world-map-header').bounds = { x: 12, y: top, left: 12, top, width: width - 24, height: width < 520 ? 84 : 44 };
        h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
        h.get('world-map-footer').bounds = { x: 12, y: footerTop, left: 12, top: footerTop, width: Math.min(470, width - 24), height: height - footerTop - 8 };
        for (const world of [1, 2]) for (const overview of [false, true]) {
            h.internal.overview = overview; h.observers[0].callback(); h.view.render((world - 1) * 5, save, time += 100, '');
            assert.equal(h.internal.hud.stageButtons.every((button: Button) => !button.hidden), !overview, 'Close views show phases; overview shows owned island names.');
            const rectangles = nativeControlEntries(h).flatMap(({ button, width: w, height: tall }) => {
                if (button.hidden) return [];
                const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(button.style.transform)!;
                const x = Number(match[1]), y = Number(match[2]);
                return [{ left: x - w / 2, right: x + w / 2, top: y - tall, bottom: y }];
            });
            rectangles.forEach((a, index) => {
                assert.ok(a.left >= 8 && a.right <= width - 8 && a.top >= h.internal.frameInsets.top && a.bottom <= height - h.internal.frameInsets.bottom);
                for (const b of rectangles.slice(index + 1))
                    assert.ok(a.right + 8 <= b.left || b.right + 8 <= a.left || a.bottom + 8 <= b.top || b.bottom + 8 <= a.top,
                        `Control overlap at ${width}×${height}, world${world}, overview${overview}`);
            });
        }
    }
    assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.events.entered, 0);
});

test('narrow channel travel hides dock signs while drawer, keyboard and skip remain usable', async t => {
    const h = mapDOM(t), save = openSave('2-1'), progress = structuredClone({ completed: save.completed, seals: save.seals });
    h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 590, height: 378 };
    h.get('world-map-header').bounds = { x: 12, y: 6, left: 12, top: 6, width: 566, height: 44 };
    h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
    h.get('world-map-footer').bounds = { x: 12, y: 314, left: 12, top: 314, width: 470, height: 56 };
    await readyConnection(h, save);
    assert.equal(h.internal.hud.dockButtons[0].hidden, false, 'Idle Porto keeps its normal Costa dock action.');
    h.view.render(0, save, 100, '');
    const modes = new Set<string>(); let time = 100;
    while (time < 6000) {
        h.view.render(0, save, time += 50, '');
        const mode = h.internal.motionState(); modes.add(mode);
        if (mode === 'boarding' || mode === 'sailing') {
            assert.ok(h.internal.hud.stageButtons.every((button: Button) => button.hidden));
            assert.ok(h.internal.hud.dockButtons.every((button: Button) => button.hidden), 'Dock labels must not cover Feka aboard.');
            assert.equal(h.internal.hud.skipButton.hidden, false);
            assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.view.enterSelected(0), false);
        }
        if (mode === 'sailing') break;
    }
    assert.ok(modes.has('boarding') && modes.has('sailing'));
    const aboard = { ...h.internal.marker };
    h.internal.hud.regionButton.click(); assert.equal(h.internal.hud.regionMenu.hidden, false);
    const toPort = (Array.from(h.internal.hud.regionMenu.children) as Element[]).find(button => button.getAttribute('aria-label')?.startsWith('Ilha 2:'))!;
    toPort.click(); assert.equal(h.internal.hud.regionMenu.hidden, true);
    assert.equal(h.internal.journey.selected, '2-1'); assert.deepEqual(h.internal.marker, aboard);
    h.root.dispatch('keydown', { key: 'ArrowUp' });
    assert.equal(h.internal.journey.selected, '1-1'); assert.deepEqual(h.internal.marker, aboard);
    assert.deepEqual(h.events.arrived, [], 'Retargeting never changes the saved arrival.');
    h.internal.hud.skipButton.click();
    assert.equal(h.internal.journey.arrived, '1-1'); assert.deepEqual(h.events.arrived, [0]); assert.equal(h.events.entered, 0);
    tick(h, 0, save, time + 50, 1600);
    assert.equal(h.internal.motionState(), 'idle'); assert.equal(h.internal.hud.dockButtons[1].hidden, false, 'The idle Coast dock action returns.');
    assert.deepEqual({ completed: save.completed, seals: save.seals }, progress, 'Hiding travel labels cannot change unlocks or collectibles.');
});

test('dock signs stay hidden through disembarkation and the final walk, returning only at confirmed arrival', async t => {
    const h = mapDOM(t), save = openSave('2-1'), progress = structuredClone({ completed: save.completed, seals: save.seals });
    await readyConnection(h, save); h.view.render(0, save, 100, '');
    let time = 100, disembarked = false, finalWalk = false;
    while (time < 12000) {
        h.view.render(0, save, time += 50, '');
        const mode = h.internal.motionState();
        if (mode === 'arriving') disembarked = true;
        if (h.internal.journey.destination)
            assert.ok(h.internal.hud.dockButtons.every((button: Button) => button.hidden), 'No dock label may cover Feka during any part of a trip.');
        if (disembarked && mode === 'walking') {
            finalWalk = true;
            assert.ok(h.internal.hud.stageButtons.some((button: Button) => !button.hidden), 'Phase navigation returns normally on land.');
            assert.equal(h.internal.hud.skipButton.hidden, false);
            assert.equal(h.internal.journey.arrived, '2-1'); assert.deepEqual(h.events.arrived, []);
            break;
        }
    }
    assert.ok(disembarked && finalWalk, 'Exercise the actual boarding-edge-to-land transition that exposed the sign.');
    const feet = { ...h.internal.marker };
    h.root.dispatch('keydown', { key: 'ArrowRight' });
    assert.equal(h.internal.journey.selected, '1-2'); assert.deepEqual(h.internal.marker, feet);
    assert.equal(h.view.enterSelected(1), false); assert.deepEqual(h.events.arrived, []);
    while (h.internal.journey.destination && time < 16000) {
        h.view.render(1, save, time += 50, '');
        if (h.internal.journey.destination) assert.ok(h.internal.hud.dockButtons.every((button: Button) => button.hidden));
    }
    assert.equal(h.internal.journey.arrived, '1-2'); assert.equal(h.internal.motionState(), 'idle');
    assert.deepEqual(h.events.arrived, [1]); assert.equal(h.events.entered, 0);
    assert.equal(h.internal.hud.dockButtons[1].hidden, false, 'The normal Porto action returns only after Feka reaches the selected phase.');
    assert.deepEqual({ completed: save.completed, seals: save.seals }, progress);
});

test('unlocked Factory loads on a real Porto visit, without adding requests to an initial Costa visit', t => {
    const h = mapDOM(t), save = openSave('1-1'); h.view.render(0, save, 0, '');
    assert.ok(!h.fetches.some(request => /fabrica|factory/.test(request.url)));
    h.view.render(5, save, 16, '');
    assert.equal(h.fetches.filter(request => request.url.endsWith('fabrica-diorama.meta.json')).length, 1);
    assert.equal(h.fetches.filter(request => request.url.endsWith('port-factory-bridge.meta.json')).length, 1);
    for (let time = 32; time < 160; time += 16) h.view.render(5, save, time, '');
    assert.equal(h.fetches.filter(request => request.url.endsWith('port-factory-bridge.meta.json')).length, 1);
});

test('Porto clear walks the real cargo bridge, keeps its ferry moored, and requires explicit entry after Factory arrival', async t => {
    const h = mapDOM(t), save = openSave('2-5'); await readyConnectedFactory(h, save);
    const moored = structuredClone(h.internal.currentBoat().foot), progress = structuredClone({ completed: save.completed, seals: save.seals });
    h.view.render(10, save, 100, '');
    assert.equal(h.internal.journey.destination, '3-1');
    assert.ok(h.internal.journey.legs.some((leg: { id: string }) => leg.id === 'port-factory-bridge'));
    assert.ok(h.internal.journey.legs.every((leg: { mode: string }) => leg.mode === 'walk'));
    let crossed = false;
    for (let time = 150; time <= 8500; time += 50) {
        h.view.render(10, save, time, '');
        assert.deepEqual(h.internal.currentBoat().foot, moored);
        if (h.internal.journey.destination) {
            assert.equal(h.internal.journey.arrived, '2-5'); assert.deepEqual(h.events.arrived, []);
            assert.equal(h.view.enterSelected(10), false);
            assert.ok(Object.values(h.internal.hud.travelButtons).every((button: any) => button.hidden));
        }
        if (h.internal.journey.legs[0]?.id === 'port-factory-bridge') {
            crossed = true;
            const feet = mapToScreen(h.internal.marker, h.internal.camera);
            assert.ok(feet.x > 10 && feet.x < h.internal.width - 10);
        }
    }
    assert.ok(crossed); assert.equal(h.internal.journey.arrived, '3-1'); assert.deepEqual(h.events.arrived, [10]);
    assert.equal(h.events.entered, 0); assert.equal(h.internal.hud.enterButton.disabled, false);
    assert.equal(h.view.enterSelected(10), true); assert.equal(h.view.enterSelected(10), false); assert.equal(h.events.entered, 1);
    assert.deepEqual({ completed: save.completed, seals: save.seals }, progress);
});

test('Costa to Factory disembarks at Porto without saving an intermediate stage and can reverse on the bridge', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnectedFactory(h, save);
    h.view.render(10, save, 100, '');
    const modes = new Set<string>(); let time = 100;
    while (h.internal.journey.legs[0]?.id !== 'port-factory-bridge' && time < 18000) {
        h.view.render(10, save, time += 50, ''); modes.add(h.internal.motionState());
        assert.equal(h.internal.journey.arrived, '1-5'); assert.deepEqual(h.events.arrived, []);
    }
    assert.ok(modes.has('boarding') && modes.has('sailing') && modes.has('arriving'));
    assert.equal(h.internal.journey.legs[0]?.id, 'port-factory-bridge');
    for (let n = 0; n < 16; n++) h.view.render(10, save, time += 50, '');
    const feet = { ...h.internal.marker }, boat = { ...h.internal.currentBoat().foot };
    h.view.render(9, save, time, ''); assert.deepEqual(h.internal.marker, feet);
    assert.equal(h.internal.journey.legs[0].direction, -1); assert.equal(h.internal.journey.arrived, '1-5');
    h.view.render(10, save, time, ''); assert.deepEqual(h.internal.marker, feet); assert.deepEqual(h.internal.currentBoat().foot, boat);
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '3-1'); assert.deepEqual(h.events.arrived, [10]);
    assert.equal(h.events.entered, 0);
    h.view.render(0, save, time + 50, '');
    const legs = h.internal.journey.legs as Array<{ id: string; direction: number }>;
    assert.ok(legs.some(leg => leg.id === 'port-factory-bridge' && leg.direction === -1));
    assert.ok(legs.some(leg => leg.id === 'coast-port-sail' && leg.direction === -1));
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.events.entered, 0);
});

test('the raised bridge follows existing unlock progression without moving a locked preview or inventing a crossing', async t => {
    const h = mapDOM(t, true), save = openSave('2-1');
    save.completed = STAGES.filter(stage => stage.world === 1).map(stage => stage.id);
    await readyConnectedFactory(h, save);
    const feet = { ...h.internal.marker }, boat = { ...h.internal.currentBoat().foot };
    h.view.render(10, save, 100, '');
    assert.equal(h.internal.journey.blocked, 'unavailable'); assert.equal(h.internal.journey.arrived, '2-1');
    assert.deepEqual(h.internal.marker, feet); assert.deepEqual(h.internal.currentBoat().foot, boat);
    assert.ok(!h.internal.network.edges.some((edge: { id: string }) => edge.id === 'port-factory-bridge'));
    assert.ok(h.paint.calls.some(call => call.method === 'drawImage' && (call.args[0] as any)?.src?.endsWith('port-factory-bridge-closed.webp')));
    assert.equal(h.view.enterSelected(10), false); assert.deepEqual(h.events.arrived, []);
    save.completed.push(...STAGES.filter(stage => stage.world === 2).map(stage => stage.id));
    h.view.render(10, save, 116, '');
    assert.ok(h.internal.network.edges.some((edge: { id: string }) => edge.id === 'port-factory-bridge'));
    assert.equal(h.internal.journey.arrived, '3-1'); assert.equal(h.events.entered, 0);
    assert.ok(h.paint.calls.some(call => call.method === 'drawImage' && (call.args[0] as any)?.src?.endsWith('port-factory-bridge-open.webp')));
});

test('Factory assets resolving during a ferry trip preserve the active edge, then activate at a safe arrival', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save);
    h.view.render(5, save, 100, ''); let time = 100;
    while (h.internal.motionState() !== 'sailing' && time < 5000) h.view.render(5, save, time += 50, '');
    const active = structuredClone(h.internal.journey.legs[0]), feet = { ...h.internal.marker };
    h.view.render(10, save, time, ''); assert.deepEqual(h.internal.marker, feet);
    assert.equal(h.internal.journey.blocked, 'no-route'); assert.equal(h.internal.journey.destination, '2-1');
    await finishFactory(h); h.view.render(10, save, time, '');
    assert.equal(h.internal.bridgeActive, false); assert.deepEqual(h.internal.journey.legs[0], active);
    assert.equal(h.internal.journey.arrived, '1-5');
    while (!h.internal.bridgeActive && time < 16000) h.view.render(10, save, time += 50, '');
    assert.equal(h.internal.bridgeActive, true); assert.equal(h.internal.journey.destination, '3-1');
    assert.deepEqual(h.events.arrived, [5], 'The already requested Porto destination settles before the late new geometry activates.');
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '3-1'); assert.equal(h.events.entered, 0);
});

test('a failed bridge never removes the working ferry or teleports Feka off an active crossing', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save);
    const ferry = structuredClone(h.internal.network.edges.filter((edge: { id: string }) => /board|dock|coast-port/.test(edge.id)));
    h.view.render(5, save, 100, ''); let time = 100;
    while (h.internal.motionState() !== 'sailing' && time < 5000) h.view.render(5, save, time += 50, '');
    const feet = { ...h.internal.marker }; h.view.render(10, save, time, '');
    await finishFactory(h, 'bridge-open.webp'); h.view.render(10, save, time, '');
    assert.equal(h.internal.bridgeStatus, 'failed'); assert.equal(h.internal.connectionStatus, 'ready');
    assert.deepEqual(h.internal.marker, feet); assert.equal(h.internal.motionState(), 'sailing'); assert.deepEqual(h.events.arrived, []);
    assert.deepEqual(h.internal.network.edges.filter((edge: { id: string }) => /board|dock|coast-port/.test(edge.id)), ferry);
    while (h.internal.journey.arrived !== '3-1' && time < 18000) h.view.render(10, save, time += 50, '');
    assert.equal(h.internal.journey.arrived, '3-1'); assert.deepEqual(h.events.arrived, [5, 10]);
    assert.equal(h.events.entered, 0); assert.equal(h.internal.connectionActive, true);
    assert.match(h.get('world-map-warning').textContent, /ponte de carga não carregou/);
    const count = [h.images.length, h.fetches.length];
    for (let n = 0; n < 5; n++) h.view.render(10, save, time += 50, '');
    assert.deepEqual([h.images.length, h.fetches.length], count);
});

test('Factory and bridge views keep every native target separate in portrait and short landscape', async t => {
    const h = mapDOM(t, true), save = openSave('3-1'); await readyConnectedFactory(h, save);
    for (const [width, height] of [[320, 568], [400, 606], [590, 378], [740, 320]]) {
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width, height };
        h.get('world-map-header').bounds = { x: 8, y: 6, left: 8, top: 6, width: width - 16, height: 44 };
        h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
        h.get('world-map-footer').bounds = { x: 8, y: height - 76, left: 8, top: height - 76, width: width - 16, height: 68 };
        h.observers[0].callback();
        for (const world of [2, 3]) for (const overview of [false, true]) {
            h.internal.overview = overview; h.view.render((world - 1) * 5, save, 100, '');
            const entries = nativeControlEntries(h);
            const rectangles = entries.flatMap(({ button, width: wide, height: tall }) => {
                if (button.hidden) return [];
                const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(button.style.transform)!;
                const x = Number(match[1]), y = Number(match[2]);
                return [{ left: x - wide / 2, right: x + wide / 2, top: y - tall, bottom: y }];
            });
            rectangles.forEach((a, index) => {
                assert.ok(a.left >= 8 && a.right <= width - 8 && a.top >= h.internal.frameInsets.top && a.bottom <= height - h.internal.frameInsets.bottom,
                    `Out of bounds ${width}×${height} world${world} overview${overview}`);
                for (const b of rectangles.slice(index + 1)) assert.ok(a.right + 8 <= b.left || b.right + 8 <= a.left ||
                    a.bottom + 8 <= b.top || b.bottom + 8 <= a.top, `Overlap ${width}×${height} world${world} overview${overview}`);
            });
        }
    }
});

test('direct Costa to Factory keeps the complete sailing boat inside a short phone viewport', async t => {
    const { atlasBoatBounds } = await import('../src/adventure/WorldAtlasArt');
    const h = mapDOM(t), save = openSave('1-5'); await readyConnectedFactory(h, save);
    h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 590, height: 378 };
    h.get('world-map-header').bounds = { x: 12, y: 6, left: 12, top: 6, width: 566, height: 44 };
    h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
    h.get('world-map-footer').bounds = { x: 12, y: 314, left: 12, top: 314, width: 470, height: 56 };
    h.observers[0].callback(); h.view.render(10, save, 100, ''); let frames = 0;
    for (let time = 150; time < 14000; time += 50) {
        h.view.render(10, save, time, '');
        if (h.internal.motionState() !== 'sailing') continue;
        frames++;
        const boat = h.internal.currentBoat(), box = atlasBoatBounds(boat.foot, boat.frame);
        const a = mapToScreen({ x: box.left, y: box.top }, h.internal.camera), b = mapToScreen({ x: box.right, y: box.bottom }, h.internal.camera);
        assert.ok(a.x >= 16 && b.x <= 574 && a.y >= h.internal.frameInsets.top && b.y <= 378 - h.internal.frameInsets.bottom);
        assert.equal(h.internal.journey.arrived, '1-5');
    }
    assert.ok(frames > 20);
});

test('a locked Factory preview from a later sparse save still frames its atlas signs without moving the save', async t => {
    const h = mapDOM(t, true), save = { ...freshSave(), selected: '4-1', completed: ['3-5'] };
    h.view.render(15, save, 0, ''); h.view.render(10, save, 16, '');
    await finishWorld(h, 1, actualMetadata(1)); await finishWorld(h, 2, actualMetadata(2)); await finishFactory(h);
    h.view.render(10, save, 32, '');
    assert.equal(h.internal.journey.arrived, '4-1'); assert.equal(h.internal.journey.blocked, 'unavailable');
    assert.ok(h.internal.hud.stageButtons.every((button: Button) => !button.hidden));
    for (let n = 1; n <= 5; n++) {
        const point = mapToScreen(h.internal.network.nodes[`3-${n}`], h.internal.camera);
        assert.ok(point.x > 0 && point.x < h.internal.width && point.y > h.internal.frameInsets.top && point.y < h.internal.height - h.internal.frameInsets.bottom);
    }
    assert.deepEqual(h.events.arrived, []); assert.equal(h.view.enterSelected(10), false);
});

test('idle Factory failure preserves the healthy ferry berth and never boards it from the opposite island', async t => {
    const h = mapDOM(t, true), save = openSave('1-5'); await readyConnection(h, save);
    const boat = { ...h.internal.currentBoat().foot };
    h.view.render(10, save, 32, ''); await finishFactory(h, 'bridge-open.webp'); h.view.render(10, save, 48, '');
    assert.equal(h.internal.journey.arrived, '3-1'); assert.deepEqual(h.internal.currentBoat().foot, boat);
    h.view.render(5, save, 64, ''); assert.equal(h.internal.journey.arrived, '2-1'); assert.deepEqual(h.internal.currentBoat().foot, boat);
    h.media.matches = false; h.view.render(0, save, 80, '');
    assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.internal.journey.destination, null);
    assert.deepEqual(h.internal.currentBoat().foot, boat);
    h.view.render(5, save, 96, '');
    assert.equal(h.internal.journey.destination, '2-1'); assert.ok(h.internal.journey.legs.some((leg: { mode: string }) => leg.mode === 'sail'));
});

test('a wrongly sized Factory bitmap is rejected independently and pending image callbacks release on disposal', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save); h.view.render(10, save, 32, '');
    const image = h.images.find(image => image.src.endsWith('fabrica-diorama.webp'))!;
    Object.assign(image, { naturalWidth: 960, naturalHeight: 600 }); image.onload?.();
    const request = h.fetches.find(request => request.url.endsWith('fabrica-diorama.meta.json'))!;
    request.resolve({ ok: true, json: async () => actualMetadata(3) }); await flushAssets();
    assert.equal(h.internal.artCache.get(3).status, 'failed'); assert.equal(h.internal.artCache.get(3).assets.island, null);
    assert.equal(h.internal.connectionStatus, 'ready');
    const pending = h.images.filter(image => image.onload);
    assert.ok(pending.length > 0); h.view.dispose();
    assert.ok(pending.every(image => image.onload === null && image.onerror === null));
});

test('close views own their departure signs while panorama names the islands themselves', async t => {
    const h = mapDOM(t, true), save = openSave('3-1'); await readyConnectedFactory(h, save);
    const travel = h.internal.hud.travelButtons;
    assert.equal(travel['bridge-factory-porto'].hidden, false);
    assert.equal(travel['bridge-porto-factory'].hidden, true, 'An arrival view must not offer its own destination from the neighboring island.');
    h.view.render(5, save, 100, '');
    assert.equal(travel['bridge-porto-factory'].hidden, false); assert.equal(travel['ferry-porto-costa'].hidden, false);
    assert.equal(travel['bridge-factory-porto'].hidden, true);
    h.get('world-map-overview').click(); h.view.render(5, save, 116, '');
    assert.ok(Object.values(travel).every((button: any) => button.hidden));
    assert.equal(h.internal.hud.overviewButtons.filter((button: Button) => !button.hidden).length, 6);
});

test('the full Serra campaign replacement paints once and preserves its base fallback until ready', async t => {
    const h = mapDOM(t, true), save = openSave('4-3'); await readySerra(h, save);
    const base = h.internal.activeArt.get(4).assets.island;
    assert.ok(base); assert.equal(h.internal.campaignImages.has('serra'), false);
    h.paint.calls.length = 0; h.internal.paintDirty = true; h.view.render(17, save, 100, '');
    assert.equal(h.paint.calls.filter(call => call.method === 'drawImage' && call.args[0] === base).length, 1,
        'Pending or unavailable campaign art must retain the ready canonical Serra bitmap.');

    assert.equal(GUAIRA_CAMPAIGN_ART.serra.replacesBase, true);
    const replacement = Object.assign(new Image(), { src: GUAIRA_CAMPAIGN_ART.serra.path, naturalWidth: 1920, naturalHeight: 1200 });
    h.internal.campaignImages.set('serra', replacement);
    h.paint.calls.length = 0; h.internal.paintDirty = true; h.view.render(17, save, 200, '');
    assert.equal(h.paint.calls.filter(call => call.method === 'drawImage' && call.args[0] === replacement).length, 1,
        'The complete scene is the island layer, never a second connection overlay.');
    assert.equal(h.paint.calls.filter(call => call.method === 'drawImage' && call.args[0] === base).length, 0,
        'The canonical Serra scene must not remain underneath the complete replacement.');
    assert.equal(h.internal.activeArt.get(4).assets.island, base, 'Replacing the render layer preserves the cached fallback.');
});

test('Factory–Serra selections stay previews without loading, rendering or traversing the removed bridge', async t => {
    for (const [from, selection] of [['3-5', 15], ['4-1', 14]] as const) await t.test(`${from} toward ${STAGES[selection].id}`, async child => {
        const h = mapDOM(child), save = { ...openSave(from), secrets: [] as string[] }; await readySerra(h, save);
        assert.equal(h.internal.maintenanceActive, true);
        const origin = { ...h.internal.marker }, boat = { ...h.internal.currentBoat().foot };
        for (const time of [100, 200, 1000, 13000]) {
            h.paint.calls.length = 0; h.view.render(selection, save, time, '');
            assert.equal(h.internal.journey.arrived, from); assert.equal(h.internal.journey.destination, null);
            assert.equal(h.internal.journey.blocked, 'no-route'); assert.deepEqual(h.internal.journey.legs, []);
            assert.match(h.get('world-map-hint').textContent, /Guaíra/);
            assert.deepEqual(h.internal.marker, origin); assert.deepEqual(h.internal.currentBoat().foot, boat);
            assert.equal(h.view.enterSelected(selection), false); assert.deepEqual(h.events.arrived, []);
            assert.ok(h.paint.calls.every(call => call.method !== 'drawImage' || !(call.args[0] as any)?.src?.includes('factory-serra-link')));
        }
        assert.ok(h.internal.network.edges.every((edge: { id: string }) => edge.id !== 'factory-serra-link'));
        assert.equal(Object.prototype.hasOwnProperty.call(h.internal.hud.travelButtons, 'walk-factory-serra'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(h.internal.hud.travelButtons, 'walk-serra-factory'), false);
        assert.equal(h.events.entered, 0);
    });
});

test('the actual cabin trip uses its measured doorway, carries Feka and moves its empty countercar', async t => {
    const h = mapDOM(t), save = { ...openSave('4-3'), secrets: ['4-3'] }; await readySerra(h, save);
    const boat = { ...h.internal.currentBoat().foot };
    assert.equal(h.internal.maintenanceActive, true); assert.deepEqual(h.internal.cablePair, { aAt: 'lower' });
    h.view.render(19, save, 100, '');
    assert.ok(h.internal.journey.legs.some((leg: { id: string }) => leg.id === 'serra-maintenance-cable-a'));
    let ride = false, outsideDoor = false, insideDoor = false, phaseChangedBeforeArrival = false;
    for (let time = 200; time < 10000; time += 100) {
        h.paint.calls.length = 0; h.view.render(19, save, time, '');
        const active = h.internal.journey.legs[0];
        assert.deepEqual(h.internal.currentBoat().foot, boat);
        if (active?.id === '4-cable-a-lower-board') {
            const threshold = h.internal.maintenanceCable.lanes.a.lower.aboardProgress;
            if (active.progress < threshold) { outsideDoor = true; assert.equal(h.internal.activeCableCar(true), undefined); }
            else { insideDoor = true; assert.equal(h.internal.activeCableCar(true), 'serra-maintenance-cable-a'); }
        }
        if (active?.mode === 'cable') {
            ride = true; assert.equal(h.internal.motionState(), 'riding'); assert.equal(h.internal.activeCableCar(true), 'serra-maintenance-cable-a');
            const cars = h.internal.currentCableCars();
            assert.deepEqual(cars.find((car: any) => car.id === 'serra-maintenance-cable-a').foot, h.internal.marker);
            assert.notDeepEqual(cars[0].foot, cars[1].foot);
            assert.equal(h.view.enterSelected(19), false); assert.deepEqual(h.events.arrived, []);
            assert.ok(h.internal.hud.stageButtons.every((button: Button) => button.hidden));
        }
        if (h.internal.cablePair.aAt === 'upper' && h.internal.journey.destination) {
            phaseChangedBeforeArrival = true; assert.equal(h.internal.journey.arrived, '4-3');
        }
    }
    assert.ok(ride && outsideDoor && insideDoor && phaseChangedBeforeArrival);
    assert.equal(h.internal.journey.arrived, '4-5'); assert.deepEqual(h.events.arrived, [19]); assert.equal(h.events.entered, 0);
});

test('walking back leaves the other cabin waiting, and rapid selections use the current pair permissions', async t => {
    const h = mapDOM(t), save = { ...openSave('4-3'), secrets: ['4-3'] }; await readySerra(h, save);
    h.view.render(19, save, 100, ''); h.internal.hud.skipButton.click();
    assert.equal(h.internal.journey.arrived, '4-5'); assert.equal(h.internal.cablePair.aAt, 'upper');
    for (const selection of [18, 17]) {
        h.view.render(selection, save, 150, '');
        assert.ok(h.internal.journey.legs.every((leg: { mode: string }) => leg.mode === 'walk'));
        h.internal.hud.skipButton.click();
    }
    assert.equal(h.internal.journey.arrived, '4-3'); assert.equal(h.internal.cablePair.aAt, 'upper');
    h.view.render(19, save, 200, '');
    assert.ok(h.internal.journey.legs.some((leg: { id: string }) => leg.id === 'serra-maintenance-cable-b'));
    let time = 200;
    while (h.internal.journey.legs[0]?.mode !== 'cable' && time < 7000) { h.paint.calls.length = 0; h.view.render(19, save, time += 100, ''); }
    const point = { ...h.internal.journey.point };
    h.view.selectDestination(17); assert.deepEqual(h.internal.journey.point, point);
    assert.equal(h.internal.capabilities.edgeDirections['serra-maintenance-cable-a'], 'none');
    h.view.selectDestination(19); assert.deepEqual(h.internal.journey.point, point);
    assert.equal(h.internal.capabilities.edgeDirections['serra-maintenance-cable-a'], 'none');
    h.internal.hud.skipButton.click(); assert.equal(h.internal.cablePair.aAt, 'lower'); assert.equal(h.internal.journey.arrived, '4-5');
    assert.equal(h.events.entered, 0);
    save.selected = '4-5'; h.view.hide(); h.view.render(19, save, time + 100, '');
    assert.deepEqual(h.internal.cablePair, { aAt: 'lower' }); assert.equal(h.internal.journey.arrived, '4-5');
    h.view.render(17, save, time + 200, '');
    assert.ok(h.internal.journey.legs.some((leg: { id: string; direction: number }) => leg.id === 'serra-maintenance-cable-b' && leg.direction === -1));
    h.media.matches = true; h.view.render(17, save, time + 300, '');
    assert.equal(h.internal.journey.arrived, '4-3'); assert.equal(h.internal.cablePair.aAt, 'upper'); assert.equal(h.events.entered, 0);
});

test('cabin failure or an undiscovered shortcut leaves supported Serra walks and all older links usable', async t => {
    for (const failed of [false, true]) await t.test(failed ? 'missing cabin art' : 'not discovered', async child => {
        const h = mapDOM(child), save = { ...openSave('4-3'), secrets: failed ? ['4-3'] : [] };
        await readySerra(h, save, failed ? 'serra-maintenance-cabin.webp' : '');
        assert.equal(h.internal.connectionActive, true); assert.equal(h.internal.bridgeActive, true); assert.ok(h.internal.network.edges.every((edge: { id: string }) => edge.id !== 'factory-serra-link'));
        assert.ok(h.internal.network.edges.every((edge: { mode: string }) => edge.mode !== 'cable' && edge.mode !== 'cable-board'));
        h.view.render(19, save, 100, ''); assert.ok(h.internal.journey.legs.every((leg: { mode: string }) => leg.mode === 'walk'));
        h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '4-5'); assert.equal(h.events.entered, 0);
        if (failed) { assert.equal(h.internal.currentCableCars().length, 0); assert.match(h.get('world-map-warning').textContent, /cabine não carregou/); }
        else assert.equal(h.internal.currentCableCars().length, 2);
    });
});

test('failed Factory bridge art cannot bypass Guaíra or disable the local maintenance ride', async t => {
    const h = mapDOM(t), save = { ...openSave('4-3'), secrets: ['4-3'] }; await readySerra(h, save, '', '', 'bridge-open.webp');
    assert.equal(h.internal.bridgeStatus, 'failed');
    assert.equal(h.internal.maintenanceActive, true);
    const boat = { ...h.internal.currentBoat().foot };
    h.view.render(19, save, 100, ''); assert.ok(h.internal.journey.legs.some((leg: { mode: string }) => leg.mode === 'cable'));
    h.internal.hud.skipButton.click();
    h.view.render(10, save, 200, '');
    assert.equal(h.internal.journey.arrived, '4-5'); assert.equal(h.internal.journey.destination, null);
    assert.equal(h.internal.journey.blocked, 'no-route'); assert.deepEqual(h.internal.currentBoat().foot, boat);
    assert.deepEqual(h.events.arrived, [19]); assert.equal(h.events.entered, 0);
    assert.equal(h.view.enterSelected(10), false);
});

test('late cabin imagery activates only after the already supported walk reaches its selected stage', async t => {
    const h = mapDOM(t), save = { ...openSave('4-3'), secrets: ['4-3'] };
    await readyConnection(h, save); await finishFactory(h); await finishWorld(h, 4, actualMetadata(4));
    h.view.render(17, save, 64, ''); h.view.render(19, save, 100, '');
    const firstLeg = structuredClone(h.internal.journey.legs[0]); assert.equal(firstLeg.mode, 'walk');
    // Resolve the same already-requested world pair and delayed carrier assets.
    await finishSerra(h); h.view.render(19, save, 100, '');
    assert.equal(h.internal.maintenanceActive, false); assert.deepEqual(h.internal.journey.legs[0], firstLeg);
    let time = 100;
    while (!h.internal.maintenanceActive && time < 11000) { h.paint.calls.length = 0; h.view.render(19, save, time += 100, ''); }
    assert.equal(h.internal.maintenanceActive, true); assert.equal(h.internal.journey.arrived, '4-5');
    assert.deepEqual(h.events.arrived, [19]); assert.equal(h.events.entered, 0);
    h.view.render(17, save, time + 100, '');
    assert.ok(h.internal.journey.legs.some((leg: { mode: string }) => leg.mode === 'cable'));
});

test('cabin framing and remaining travel signs remain usable in narrow, portrait and short map layouts', async t => {
    const { atlasCableBounds } = await import('../src/adventure/WorldCableArt');
    const h = mapDOM(t, true), save = { ...openSave('4-3'), secrets: ['4-3'] }; await readySerra(h, save);
    for (const [width, height] of [[320, 568], [400, 606], [590, 378], [740, 320]]) {
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width, height };
        h.get('world-map-header').bounds = { x: 8, y: 6, left: 8, top: 6, width: width - 16, height: 44 };
        h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
        h.get('world-map-footer').bounds = { x: 8, y: height - 76, left: 8, top: height - 76, width: width - 16, height: 68 };
        h.observers[0].callback();
        for (const world of [3, 4]) for (const overview of [false, true]) {
            h.internal.overview = overview; h.view.render((world - 1) * 5, save, 100, '');
            const entries = nativeControlEntries(h);
            const boxes = entries.flatMap(({ button, width: wide, height: tall }) => {
                if (button.hidden) return [];
                const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(button.style.transform)!;
                const x = Number(match[1]), y = Number(match[2]);
                return [{ left: x - wide / 2, right: x + wide / 2, top: y - tall, bottom: y }];
            });
            boxes.forEach((a, index) => {
                assert.ok(a.left >= 8 && a.right <= width - 8 && a.top >= h.internal.frameInsets.top && a.bottom <= height - h.internal.frameInsets.bottom);
                for (const b of boxes.slice(index + 1)) assert.ok(a.right + 8 <= b.left || b.right + 8 <= a.left || a.bottom + 8 <= b.top || b.bottom + 8 <= a.top);
            });
        }
    }
    h.internal.overview = false; h.view.render(17, save, 100, ''); h.media.matches = false; h.view.render(19, save, 200, '');
    let riding = 0;
    for (let time = 300; time < 9000; time += 100) {
        h.paint.calls.length = 0; h.view.render(19, save, time, '');
        if (h.internal.motionState() !== 'riding') continue;
        riding++;
        const car = h.internal.currentCableCars().find((car: any) => car.id === h.internal.activeCableCar()), bounds = atlasCableBounds(car);
        const a = mapToScreen({ x: bounds.left, y: bounds.top }, h.internal.camera), b = mapToScreen({ x: bounds.right, y: bounds.bottom }, h.internal.camera);
        assert.ok(a.x >= 16 && b.x <= h.internal.width - 16 && a.y >= h.internal.frameInsets.top && b.y <= h.internal.height - h.internal.frameInsets.bottom);
    }
    assert.ok(riding > 5);
});

test('local Serra trips in both directions keep Feka and each occupied vehicle in frame throughout camera easing', async t => {
    const { atlasCableBounds } = await import('../src/adventure/WorldCableArt');
    for (const [width, height] of [[320,568],[400,606],[590,378],[740,320]]) for (const reverse of [false,true])
        await t.test(`${width}x${height} ${reverse ? 'upper to lower' : 'lower to upper'}`, async child => {
            const h = mapDOM(child), save = { ...openSave(reverse ? '4-5' : '4-1'), secrets: ['4-3'] };
            await readySerra(h, save);
            h.get('world-map-scene').bounds = { x:0,y:0,left:0,top:0,width,height };
            h.get('world-map-header').bounds = { x:8,y:6,left:8,top:6,width:width-16,height:44 };
            h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
            h.get('world-map-footer').bounds = { x:8,y:height-76,left:8,top:height-76,width:width-16,height:68 };
            h.observers[0].callback();
            const selection = reverse ? 15 : 19;
            h.view.render(selection, save, 100, '');
            const modes = new Set<string>();
            for (let time=200; h.internal.journey.destination && time < 120000; time+=100) {
                h.paint.calls.length=0; h.view.render(selection,save,time,'');
                const active = h.internal.journey.legs[0];
                if (!active) continue;
                modes.add(h.internal.motionState());
                const p=mapToScreen(h.internal.marker,h.internal.camera);
                assert.ok(p.x>=0 && p.x<=width && p.y>=h.internal.frameInsets.top && p.y<=height-h.internal.frameInsets.bottom,
                    `${active.id} actor at ${p.x},${p.y}`);
                const car=h.internal.currentCableCars().find((car:any)=>car.id===h.internal.activeCableCar());
                if (car) {
                    const bounds=atlasCableBounds(car);
                    const a=mapToScreen({x:bounds.left,y:bounds.top},h.internal.camera), b=mapToScreen({x:bounds.right,y:bounds.bottom},h.internal.camera);
                    assert.ok(a.x>=16 && b.x<=width-16 && a.y>=h.internal.frameInsets.top && b.y<=height-h.internal.frameInsets.bottom,
                        `${active.id} car clipping at ${JSON.stringify({a,b})}`);
                    if (active.mode==='cable-board') {
                        const terminal=active.id.includes('lower')?'lower':'upper';
                        const carName=car.id==='serra-maintenance-cable-a'?'a':'b';
                        const threshold=h.internal.maintenanceCable.lanes[carName][terminal].aboardProgress;
                        assert.equal(h.internal.activeCableCar(true),active.progress>=threshold?car.id:undefined);
                    }
                }
                assert.equal(h.internal.journey.arrived,save.selected);
            }
            assert.equal(h.internal.journey.arrived, reverse?'4-1':'4-5');
            for (const mode of ['walking','boarding','riding','arriving']) assert.ok(modes.has(mode),mode);
            assert.equal(h.events.entered,0);
        });
});

test('Reserva passenger gates follow B2 and travel signs stop at their actual stage terminals', async t => {
    const h = mapDOM(t), save = { ...openSave('4-5'), completed: STAGES.filter(stage => stage.id !== '4-5').map(stage => stage.id), secrets: [] as string[] };
    await readyReserva(h, save);
    assert.equal(h.internal.passengerActive, true);
    assert.ok(!h.internal.network.edges.some((edge: any) => edge.id.startsWith('serra-reserva-passenger')));
    h.view.render(20, save, 100, '');
    assert.equal(h.internal.journey.arrived, '4-5'); assert.equal(h.view.enterSelected(20), false);
    save.completed.push('4-5'); h.view.render(19, save, 120, '');
    assert.ok(h.internal.network.edges.some((edge: any) => edge.id === 'serra-reserva-passenger-a'));
    assert.ok(!h.internal.network.edges.some((edge: any) => edge.id === 'serra-maintenance-cable-a'), 'Passenger service does not require or invent the maintenance secret.');
    const boat = { ...h.internal.currentBoat().foot };
    h.internal.hud.travelButtons['cable-serra-reserva'].click(); h.view.render(20, save, 140, '');
    assert.equal(h.internal.journey.destination, '5-1'); assert.equal(h.view.enterSelected(20), false);
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '5-1');
    assert.equal(h.internal.passengerPair.aAt, 'upper'); assert.equal(h.internal.cablePair.aAt, 'lower');
    assert.deepEqual(h.internal.currentBoat().foot, boat);
    h.view.render(20, save, 160, ''); h.internal.hud.travelButtons['cable-reserva-serra'].click();
    assert.equal(h.events.selected.at(-1), 19, 'The return stops at the upper Serra station, not at the foot of the mountain.');
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '4-5');
    assert.equal(h.events.entered, 0); assert.equal(h.view.enterSelected(19), true);
    h.view.hide(); h.view.render(20, save, 180, '', '', { playedStage: '4-5', nextSelected: '5-1' });
    assert.equal(h.internal.journey.arrived, '4-5'); assert.equal(h.internal.journey.destination, '5-1');
    assert.ok(h.internal.journey.legs.some((leg: any) => leg.id === 'serra-reserva-passenger-a'));
    assert.equal(h.events.entered, 1, 'Returning from B2 starts the connection, not another level.');
});

test('sequential maintenance and passenger rides keep independent phases through rapid reversal, skip and reload', async t => {
    const h = mapDOM(t), save = { ...openSave('4-3'), secrets: ['4-3'] }; await readyReserva(h, save);
    assert.equal(h.internal.currentCableCars().length, 4);
    assert.equal(new Set(h.internal.currentCableCars().map((car: any) => car.id)).size, 4);
    h.view.render(20, save, 100, '');
    assert.ok(h.internal.journey.legs.some((leg: any) => leg.id === 'serra-maintenance-cable-a'));
    assert.ok(h.internal.journey.legs.some((leg: any) => leg.id === 'serra-reserva-passenger-a'));
    let time = 100;
    while (h.internal.journey.legs[0]?.id !== 'serra-reserva-passenger-a' && time < 60000) {
        h.paint.calls.length = 0; h.view.render(20, save, time += 100, '');
        assert.equal(h.internal.journey.arrived, '4-3'); assert.deepEqual(h.events.arrived, []);
    }
    assert.equal(h.internal.journey.legs[0]?.id, 'serra-reserva-passenger-a');
    assert.equal(h.internal.cablePair.aAt, 'upper'); assert.equal(h.internal.passengerPair.aAt, 'lower');
    h.view.render(20, save, time += 100, ''); const foot = { ...h.internal.journey.point };
    h.view.selectDestination(17); assert.deepEqual(h.internal.journey.point, foot);
    assert.equal(h.internal.journey.legs[0].direction, -1);
    h.view.selectDestination(20); assert.deepEqual(h.internal.journey.point, foot);
    h.internal.hud.skipButton.click(); assert.equal(h.internal.journey.arrived, '5-1');
    assert.deepEqual(h.events.arrived, [20]); assert.equal(h.events.entered, 0);
    assert.equal(h.internal.cablePair.aAt, 'upper'); assert.equal(h.internal.passengerPair.aAt, 'upper');
    save.selected = '5-1'; h.view.hide(); h.view.render(20, save, time += 100, '');
    assert.equal(h.internal.cablePair.aAt, 'lower'); assert.equal(h.internal.passengerPair.aAt, 'lower');
    h.view.render(19, save, time += 100, '');
    assert.ok(h.internal.journey.legs.some((leg: any) => leg.id === 'serra-reserva-passenger-b' && leg.direction === -1));
    h.media.matches = true; h.view.render(19, save, time += 100, '');
    assert.equal(h.internal.journey.arrived, '4-5'); assert.equal(h.internal.passengerPair.aAt, 'upper');
    assert.equal(h.events.entered, 0);
});

test('failed passenger visuals preserve older transport and permit regional recovery without moving the ferry', async t => {
    const raw = JSON.parse(readFileSync(new URL('../public/assets/world/map/serra-reserva-link.meta.json', import.meta.url), 'utf8'));
    for (const failAsset of ['reserva-diorama.webp', raw.atlas.path.split('/').pop(), raw.overlays[0].path.split('/').pop()])
        await t.test(failAsset, async child => {
            const h = mapDOM(child), save = { ...openSave('4-3'), secrets: ['4-3'] }; await readyReserva(h, save, failAsset);
            assert.equal(h.internal.passengerActive, false); assert.equal(h.internal.passengerStatus, 'failed');
            assert.equal(h.internal.maintenanceActive, true); assert.ok(h.internal.network.edges.every((edge: { id: string }) => edge.id !== 'factory-serra-link'));
            assert.equal(h.internal.bridgeActive, true); assert.equal(h.internal.connectionActive, true);
            const boat = { ...h.internal.currentBoat().foot }; h.view.render(19, save, 100, '');
            assert.ok(h.internal.journey.legs.some((leg: any) => leg.id === 'serra-maintenance-cable-a'));
            h.internal.hud.skipButton.click(); h.view.render(20, save, 120, '');
            assert.equal(h.internal.journey.arrived, '5-1'); assert.deepEqual(h.internal.currentBoat().foot, boat);
            assert.equal(h.internal.currentCableCars().length, 2); assert.equal(h.events.entered, 0);
        });
});

test('late passenger layers activate only at a stage arrival and preserve the completed maintenance trip', async t => {
    const h = mapDOM(t), save = { ...openSave('4-3'), secrets: ['4-3'] }; await readySerra(h, save);
    h.view.render(19, save, 100, ''); const active = structuredClone(h.internal.journey.legs[0]);
    await finishPassenger(h); h.view.render(19, save, 100, '');
    assert.equal(h.internal.passengerActive, false); assert.deepEqual(h.internal.journey.legs[0], active);
    let time = 100;
    while (!h.internal.passengerActive && time < 20000) { h.paint.calls.length = 0; h.view.render(19, save, time += 100, ''); }
    assert.equal(h.internal.passengerActive, true); assert.equal(h.internal.journey.arrived, '4-5');
    assert.equal(h.internal.cablePair.aAt, 'upper'); assert.equal(h.internal.passengerPair.aAt, 'lower');
    assert.deepEqual(h.events.arrived, [19]);
    h.view.render(20, save, time += 100, '');
    assert.ok(h.internal.journey.legs.some((leg: any) => leg.id === 'serra-reserva-passenger-a'));
});

test('both cable lines keep the occupied vehicle framed across Reserva trips in narrow and short layouts', async t => {
    const { atlasCableBounds } = await import('../src/adventure/WorldCableArt');
    for (const [width, height] of [[320, 568], [400, 606], [590, 378], [740, 320]]) await t.test(`${width}x${height}`, async child => {
        const h = mapDOM(child), save = { ...openSave('4-3'), secrets: ['4-3', '5-3'] }; await readyReserva(h, save);
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width, height };
        h.get('world-map-header').bounds = { x: 8, y: 6, left: 8, top: 6, width: width - 16, height: 44 };
        h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
        h.get('world-map-footer').bounds = { x: 8, y: height - 76, left: 8, top: height - 76, width: width - 16, height: 68 };
        h.observers[0].callback(); let time = 100;
        for (const selection of [24, 17]) {
            const origin = h.internal.journey.arrived, deadline = time + 90000, rides = new Set<string>();
            h.view.render(selection, save, time, '');
            while (h.internal.journey.destination && time < deadline) {
                h.paint.calls.length = 0; h.view.render(selection, save, time += 100, '');
                const active = h.internal.journey.legs[0]; if (!active) continue;
                assert.equal(h.internal.journey.arrived, origin);
                assert.ok(Object.values(h.internal.hud.travelButtons).every((button: any) => button.hidden));
                const marker = mapToScreen(h.internal.marker, h.internal.camera);
                assert.ok(marker.x >= 0 && marker.x <= width && marker.y >= h.internal.frameInsets.top && marker.y <= height - h.internal.frameInsets.bottom,
                    `${active.id}: actor outside scene at ${JSON.stringify(marker)}`);
                const id = h.internal.activeCableCar();
                if (!id) continue;
                rides.add(id.startsWith('serra-reserva') ? 'passenger' : 'maintenance');
                const car = h.internal.currentCableCars().find((car: any) => car.id === id), bounds = atlasCableBounds(car);
                const top = mapToScreen({ x: bounds.left, y: bounds.top }, h.internal.camera), bottom = mapToScreen({ x: bounds.right, y: bounds.bottom }, h.internal.camera);
                assert.ok(top.x >= 16 && bottom.x <= width - 16 && top.y >= h.internal.frameInsets.top && bottom.y <= height - h.internal.frameInsets.bottom,
                    `${active.id}: carrier outside scene at ${JSON.stringify({ top, bottom })}`);
            }
            assert.equal(h.internal.journey.arrived, STAGES[selection].id);
            assert.deepEqual([...rides].sort(), ['maintenance', 'passenger']);
            assert.equal(h.events.entered, 0);
            if (selection !== 24) continue;
            h.get('world-map-overview').click(); h.view.render(selection, save, time += 100, '');
            const entries = nativeControlEntries(h);
            const boxes = entries.flatMap(({ button, width: wide, height: tall }) => {
                if (button.hidden) return [];
                const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(button.style.transform)!;
                const x = Number(match[1]), y = Number(match[2]);
                return [{ left: x - wide / 2, right: x + wide / 2, top: y - tall, bottom: y }];
            });
            boxes.forEach((a, i) => {
                assert.ok(a.left >= 8 && a.right <= width - 8 && a.top >= h.internal.frameInsets.top && a.bottom <= height - h.internal.frameInsets.bottom);
                for (const b of boxes.slice(i + 1)) assert.ok(a.right + 8 <= b.left || b.right + 8 <= a.left || a.bottom + 8 <= b.top || b.bottom + 8 <= a.top);
            });
            h.get('world-map-overview').click(); h.view.render(selection, save, time += 100, '');
        }
    });
});


test('idle preview returns to exact Feka arrival by CTA or current-island menu without walking', async t => {
    const h = mapDOM(t), save = { ...freshSave(), selected: '1-4', completed: ['1-1', '1-2', '1-3'] };
    await readyLand(h, save, 3); const origin = { ...h.internal.marker };
    for (const route of ['cta', 'menu']) {
        h.view.selectDestination(5);
        assert.equal(h.internal.journey.arrived, '1-4');
        assert.equal(h.internal.journey.destination, null);
        assert.equal(h.view.enterSelected(5), false);
        if (route === 'cta') h.internal.hud.enterButton.click();
        else {
            h.get('world-map-overview').click();
            h.internal.hud.regionButton.click();
            h.internal.hud.regionButtons[0].click();
        }
        assert.equal(h.internal.overview, false);
        assert.equal(h.internal.controlSelection, 3);
        assert.equal(h.internal.journey.selected, '1-4');
        assert.equal(h.internal.journey.arrived, '1-4');
        assert.equal(h.internal.journey.destination, null);
        assert.deepEqual(h.internal.marker, origin);
        assert.deepEqual(h.events.arrived, []);
        assert.equal(h.events.entered, 0);
    }
});

test('preview cannot return to Feka during a journey', async t => {
    const h = mapDOM(t), save = openSave(); await readyLand(h, save);
    h.view.selectDestination(3);
    const destination = h.internal.journey.destination;
    h.view.selectDestination(25);
    assert.equal(h.internal.hud.enterButton.hidden, true);
    h.internal.hud.enterButton.click();
    assert.equal(h.internal.journey.destination, destination);
    assert.equal(h.internal.controlSelection, 25);
    assert.equal(h.events.entered, 0);
});


test('measured compact fallback owns keyboard and native activation without mutating camera, save or gameplay input', async t => {
    for (const reducedMotion of [false, true]) await t.test(`reducedMotion=${reducedMotion}`, async child => {
        const h = mapDOM(child, reducedMotion, true), save = openSave('3-5'); await readyDominio(h, save);
        const input = new Input(); child.after(() => input.dispose()); input.setMenuMode(true);
        const game = worldHarness().game; let stray = 0; game.enterSelected = () => { stray++; };
        h.windowMock.addEventListener('keydown', event => game.menuKey(event));
        h.get('world-map-scene').bounds = { x: 0, y: 0, left: 0, top: 0, width: 390, height: 640 };
        h.get('world-map-header').bounds = { x: 12, y: 10, left: 12, top: 10, width: 366, height: 80 };
        h.get('world-map-tools').bounds = h.get('world-map-header').bounds;
        h.get('world-map-footer').bounds = { x: 12, y: 500, left: 12, top: 500, width: 366, height: 128 };
        h.observers[0].callback(); h.get('world-map-overview').click(); h.view.render(14, save, 100, '');
        assert.equal(h.internal.hud.overviewFallback, true);
        assert.equal(h.get('world-map-art').width, 780, 'Responsive map uses CSS scene dimensions and capped DPR.');
        const camera = structuredClone(h.internal.camera), journey = structuredClone(h.internal.journey), saved = structuredClone(save);
        const rows = h.internal.hud.regionMenu.children.filter((element: Element) => element.classList.contains('world-map-region')) as Button[];
        h.root.focus(); const arrow = h.root.dispatch('keydown', { key: 'ArrowRight', code: 'ArrowRight' });
        assert.equal(arrow.defaultPrevented, true); assert.equal(h.internal.hud.regionMenu.hidden, false);
        assert.equal(h.active, rows[3]); assert.equal(h.active!.getAttribute('data-region-key'), 'guaira');
        rows[3].dispatch('keydown', { key: 'ArrowRight', code: 'ArrowRight', repeat: true }); assert.equal(h.active, rows[3]);
        rows[3].dispatch('keyup', { key: 'ArrowRight', code: 'ArrowRight' });
        rows[3].dispatch('keydown', { key: 'ArrowRight', code: 'ArrowRight' }); assert.equal(h.active, rows[4]);
        assert.deepEqual(h.internal.camera, camera); assert.deepEqual(h.internal.journey, journey); assert.deepEqual(save, saved);
        assert.deepEqual(h.events.selected, []); assert.equal(h.events.entered, 0);
        rows[4].dispatch('keydown', { key: 'Escape', code: 'Escape' });
        assert.equal(h.internal.hud.regionMenu.hidden, true); assert.equal(h.active, h.internal.hud.regionButton.hidden ? h.get('world-map-overview') : h.internal.hud.regionButton);
        assert.equal(h.internal.overview, true); assert.equal(h.events.exited, 0);
        h.active!.dispatch('keydown', { key: 'Escape', code: 'Escape' }); assert.equal(h.internal.overview, false); assert.equal(h.events.exited, 0);
        for (const key of ['Enter', ' ']) {
            h.internal.hud.regionButton.click(); const button = rows[2]; button.focus();
            const code = key === ' ' ? 'Space' : 'Enter';
            assert.equal(button.dispatch('keydown', { key, code }).defaultPrevented, false);
            const count: number = h.events.selected.length; button.click();
            assert.equal(h.events.selected.length, count + 1); assert.equal(h.internal.controlSelection, 14);
            assert.equal(h.internal.overview, false); assert.equal(h.internal.hud.regionMenu.hidden, true);
            assert.equal(h.active!.dispatch('keydown', { key, code, repeat: true }).defaultPrevented, true);
            h.active!.dispatch('keyup', { key, code }); assert.equal(h.events.selected.length, count + 1);
            assert.equal(h.internal.hud.regionMenu.hidden, true);
        }
        input.update(); assert.equal(input.getState().jumpPressed, false); assert.equal(input.getState().right, false);
        assert.equal(input.consumeStart(), false); assert.equal(h.events.entered, 0); assert.equal(stray, 0);
        h.view.hide(); input.setMenuMode(false);
        h.gameCanvas.dispatch('keyup', { key: ' ', code: 'Space' }); input.update(); assert.equal(input.getState().jumpPressed, false);
        assert.deepEqual(save, saved); assert.equal(h.internal.journey.arrived, '3-5');
    });
});


test('controller map route uses the real journey gate, consumes skip and requires a new arrival confirm', async t => {
    const h = mapDOM(t), save = openSave(); await readyLand(h, save);
    const original = structuredClone(save), input = new Input(), adapter = new StandardGamepad(input);
    const pad = { index: 0, id: 'map controller fixture', connected: true, mapping: 'standard', axes: [0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
    const navigatorBefore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [pad] } });
    t.after(() => { adapter.dispose(); input.dispose();
        if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore); else Reflect.deleteProperty(globalThis, 'navigator'); });
    let now = 0;
    const step = (elapsed = 17) => { const command = adapter.updateMenu(h.view.controllerOwner(), now += elapsed); if (command) h.view.control(command); };
    const neutral = () => { pad.buttons.forEach(b => { b.pressed = false; }); step(); };
    const tap = (index: number) => { neutral(); pad.buttons[index].pressed = true; step(); };
    h.root.focus(); step(); tap(15);
    assert.equal(h.events.selected.at(-1), 1); assert.equal(h.view.controllerOwner(), 'island:travel');
    assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.events.entered, 0);
    tap(0); assert.equal(h.internal.journey.arrived, '1-2'); assert.equal(h.events.entered, 0, 'A skips travel but never also enters');
    assert.equal(h.view.controllerOwner(), 'island:idle');
    for (let n = 0; n < 10; n++) step(500);
    assert.equal(h.events.entered, 0, 'Holding A across arrival cannot enter');
    tap(0); assert.equal(h.events.entered, 1); tap(0); assert.equal(h.events.entered, 1, 'Existing entry gate is single use');
    assert.deepEqual(save, original, 'Only the owning campaign may persist actual arrival');
});

test('controller map layers preserve preview locks, focused links and native modal ownership', async t => {
    const h = mapDOM(t, true), save = freshSave(); await readyLand(h, save);
    const before = structuredClone(save);
    h.root.focus(); h.view.control('right'); assert.equal(h.events.selected.at(-1), 1);
    assert.equal(h.internal.journey.arrived, '1-1'); h.view.control('confirm'); assert.equal(h.events.entered, 0);
    h.root.focus(); h.view.control('regions'); assert.equal(h.internal.hud.regionMenu.hidden, false);
    h.view.control('down'); h.view.control('back'); assert.equal(h.events.exited, 0);
    assert.equal(h.active, h.internal.hud.regionButton.hidden ? h.get('world-map-overview') : h.internal.hud.regionButton);
    h.root.focus(); h.view.control('overview'); assert.equal(h.internal.overview, true);
    h.view.control('back'); assert.equal(h.internal.overview, false); assert.equal(h.events.exited, 0);
    const external = h.documentMock.createElement('button'); h.body.append(external); external.focus();
    const selected = h.events.selected.length; assert.equal(h.view.controllerOwner(), null);
    h.view.control('right'); h.view.control('confirm'); h.view.control('back');
    assert.equal(h.events.selected.length, selected); assert.equal(h.events.entered, 0); assert.equal(h.events.exited, 0);
    h.root.focus(); Object.assign(h.documentMock, { querySelector: () => ({ open: true }) });
    assert.equal(h.view.controllerOwner(), null); h.view.control('confirm'); assert.equal(h.events.entered, 0);
    Object.assign(h.documentMock, { querySelector: () => null }); h.view.control('back'); assert.equal(h.events.exited, 1);
    assert.deepEqual(save, before); h.view.hide(); assert.equal(h.view.controllerOwner(), null);
});
