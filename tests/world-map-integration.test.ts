import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { type TestContext } from 'node:test';
import { STAGES } from '../src/adventure/campaign';
import { freshSave, ProgressStore, SAVE_KEY } from '../src/adventure/progress';
import { WorldGame } from '../src/adventure/WorldGame';
import { COSTA_ART_BOUNDS, FALLBACK_POINTS, fallbackMapMetadata, parseMapMetadata } from '../src/adventure/WorldMapArt';
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
    const fetches: Array<{ url: string; signal: AbortSignal; resolve: (value: unknown) => void }> = [];
    const fetchMock = (url: string, options: { signal: AbortSignal }) => new Promise(resolve => {
        fetches.push({ url, signal: options.signal, resolve });
    });
    const restore: Array<() => void> = [];
    for (const [name, value] of Object.entries({ document: documentMock, window: windowMock, Image: MockImage,
        ResizeObserver: Observer, HTMLElement: Element, HTMLButtonElement: Button, fetch: fetchMock,
        requestAnimationFrame: () => assert.fail('The map must use the existing game loop, never start its own RAF.') })) {
        const original = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
        restore.push(() => { if (original) Object.defineProperty(globalThis, name, original); else Reflect.deleteProperty(globalThis, name); });
    }
    const events = { selected: [] as number[], arrived: [] as number[], entered: 0, exited: 0, unlocked: 0 };
    const view = new WorldMapView(gameCanvas as unknown as HTMLCanvasElement, {
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
const dioramaName = (world: number) => world === 1 ? 'costa-diorama' : 'porto-diorama';
async function finishWorld(h: ReturnType<typeof mapDOM>, world: number, metadata: unknown = fixtureMapMetadata(world), imageSuccess = true) {
    const image = h.images.find(image => image.src.endsWith(`${dioramaName(world)}.webp`));
    const request = h.fetches.find(request => request.url.endsWith(`${dioramaName(world)}.meta.json`));
    assert.ok(image && request, `World ${world} must already have been visited before its assets can settle.`);
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
function tick(h: ReturnType<typeof mapDOM>, selected: number, save: ReturnType<typeof freshSave>, from: number, duration: number) {
    for (let time = from + 50; time <= from + duration; time += 50) h.view.render(selected, save, time, '');
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

test('only the visible connected pair is requested and cached, with no duplicate visits or distant Porto decoration', t => {
    const h = mapDOM(t, true), save = openSave('2-1');
    assert.equal(h.images.length, 0); h.view.render(5, save, 0, '');
    assert.ok(h.images.some(image => image.src.endsWith('porto-diorama.webp')));
    assert.ok(h.images.some(image => image.src.endsWith('costa-diorama.webp')));
    assert.ok(h.images.every(image => !image.src.endsWith('porto-distant.webp')));
    const count = [h.images.length, h.fetches.length];
    for (const selected of [0, 5, 10, 15, 20, 25, 0, 5]) h.view.render(selected, save, selected + 20, '');
    assert.deepEqual([h.images.length, h.fetches.length], count);
});

test('paired art waits for matching metadata in either completion order and never applies invalid coordinates', async t => {
    for (const metadataFirst of [false, true]) await t.test(String(metadataFirst), async child => {
        const h = mapDOM(child, true), data = fixtureMapMetadata(1, { '1-1': { x: .25, y: .62 } });
        h.view.render(0, freshSave(), 0, '');
        const image = h.images.find(image => image.src.endsWith('costa-diorama.webp'))!, request = h.fetches.find(request => request.url.endsWith('costa-diorama.meta.json'))!;
        if (metadataFirst) request.resolve({ ok: true, json: async () => data }); else image.onload?.();
        await flushAssets(); h.view.render(0, freshSave(), 16, ''); assert.equal(currentArt(h, 1).assets.island, null);
        if (metadataFirst) image.onload?.(); else request.resolve({ ok: true, json: async () => data });
        await flushAssets(); h.view.render(0, freshSave(), 32, '');
        assert.equal(currentArt(h, 1).assets.island, image); assert.deepEqual(h.internal.marker, data.nodes['1-1']);
    });
});

test('failed island pairs retain usable fallback, preserve the other cache, and do not retry per frame', async t => {
    for (const [metadata, imageSuccess] of [[fixtureMapMetadata(1), true], [{}, true], [fixtureMapMetadata(2), false]] as const) await t.test(JSON.stringify(metadata).slice(0, 30), async child => {
        const save = openSave(), j = mapDOM(child, true); j.view.render(0, save, 0, ''); await finishWorld(j, 1);
        await finishWorld(j, 2, metadata, imageSuccess); j.view.render(0, save, 16, '');
        assert.ok(currentArt(j, 1).assets.island); assert.equal(currentArt(j, 2).assets.island, null);
        const requests = j.fetches.length; j.view.render(5, save, 32, ''); j.view.render(0, save, 48, '');
        assert.equal(j.fetches.length, requests); assert.ok(j.internal.network.nodes['2-1']);
    });
});

test('late geometry is activated only after safe arrival and optional shadows never restart a walk', async t => {
    const h = mapDOM(t), save = openSave(); h.view.render(0, save, 0, ''); h.view.render(1, save, 50, '');
    const active = structuredClone(h.internal.journey.legs[0]), data = fixtureMapMetadata(1, { '1-2': { x: .43, y: .37 } });
    await finishWorld(h, 1, data); h.view.render(1, save, 100, '');
    assert.equal(currentArt(h, 1).assets.island, null); assert.deepEqual(h.internal.journey.legs[0].points, active.points);
    h.images.find(image => image.src.endsWith('costa-shadow.webp'))!.onload?.(); await flushAssets();
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
    for (const selected of [1, 4, 5, 25]) {
        h.view.render(selected, save, selected + 20, ''); assert.deepEqual(h.internal.marker, foot);
        assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.view.enterSelected(selected), false);
        assert.equal(h.internal.hud.enterButton.disabled, true); assert.match(h.get('world-map-status').textContent, /Prévia/);
    }
    assert.deepEqual(h.events.arrived, []); assert.equal(save.selected, '1-1');
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

test('later worlds retain fallback navigation and explicit entry without creating any sea edge', t => {
    const h = mapDOM(t, true), save = openSave(); h.view.render(0, save, 0, ''); h.view.render(14, save, 16, '');
    assert.equal(h.internal.journey.arrived, '3-5'); assert.equal(h.events.entered, 0); assert.equal(h.internal.hud.enterButton.disabled, false);
    h.view.render(10, save, 32, ''); assert.equal(h.internal.journey.arrived, '3-1');
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
        buttons: [{ run() {} }], menuSelection: 0,
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
    h.game.complete(false); assert.equal(h.game.state, 'clear'); assert.equal(h.game.nextMapSelection, '2-1');
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
async function readyConnection(h: ReturnType<typeof mapDOM>, save = openSave('1-5'), failAsset = '') {
    const selection = STAGES.findIndex(stage => stage.id === save.selected);
    h.view.render(selection, save, 0, ''); await finishWorld(h, 1, actualMetadata(1)); await finishWorld(h, 2, actualMetadata(2));
    for (const name of ['coast-port-journey', 'journey-boat']) {
        const data = JSON.parse(readFileSync(new URL(`../public/assets/world/map/${name}.meta.json`, import.meta.url), 'utf8'));
        h.fetches.find(request => request.url.endsWith(`${name}.meta.json`))!.resolve({ ok: true, json: async () => data });
    }
    await flushAssets();
    const connection = JSON.parse(readFileSync(new URL('../public/assets/world/map/coast-port-journey.meta.json', import.meta.url), 'utf8'));
    const boat = JSON.parse(readFileSync(new URL('../public/assets/world/map/journey-boat.meta.json', import.meta.url), 'utf8'));
    for (const size of [connection.islands.costa.overlay, connection.islands.porto.overlay, boat.atlas]) {
        const image = h.images.find(image => image.src.endsWith(size.path.split('/').pop()))!;
        assert.ok(image, `Expected validated journey image ${size.path}`);
        Object.assign(image, { naturalWidth: size.width, naturalHeight: size.height });
        if (size.path.includes(failAsset) && failAsset) image.onerror?.(); else image.onload?.();
    }
    await flushAssets(); h.view.render(selection, save, 16, '');
}

test('Costa to Porto travels through connected docks with Feka aboard, saves only final arrival and waits for Enter', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save);
    assert.equal(h.internal.connectionStatus, 'ready'); assert.equal(h.internal.connectionActive, true);
    assert.ok(h.internal.network.nodes['1-junction']); assert.ok(h.internal.network.edges.some((edge: { id: string }) => edge.id === 'coast-port-sail'));
    h.view.render(5, save, 100, ''); const modes = new Set<string>();
    for (let time = 150; time <= 12000; time += 50) {
        h.view.render(5, save, time, ''); const mode = h.internal.motionState(); modes.add(mode);
        if (mode === 'sailing') {
            assert.equal(h.internal.journey.arrived, '1-5'); assert.deepEqual(h.internal.currentBoat().foot, h.internal.marker);
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
    h.view.render(3, save, 100, ''); assert.equal(h.internal.journey.destination, '1-4'); assert.equal(h.internal.journey.blocked, null);
    h.view.hide(); h.view.render(4, save, 5000, ''); assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.internal.journey.destination, null);
    const locked = freshSave(); h.view.hide(); h.view.render(0, locked, 5100, ''); h.view.render(5, locked, 5150, '');
    assert.equal(h.internal.journey.blocked, 'unavailable'); assert.equal(h.internal.journey.arrived, '1-1'); assert.equal(h.view.enterSelected(5), false);
});

test('failed crossing art exposes a clear usable region fallback without inventing any water route', async t => {
    const h = mapDOM(t, true), save = openSave('1-5'); await readyConnection(h, save, 'journey-boat.webp');
    assert.equal(h.internal.connectionStatus, 'failed'); h.view.render(5, save, 100, '');
    assert.equal(h.internal.journey.arrived, '2-1'); assert.equal(h.internal.journey.destination, null); assert.equal(h.events.entered, 0);
    assert.ok(h.internal.network.edges.every((edge: { mode: string }) => edge.mode !== 'sail'));
    assert.match(h.get('world-map-warning').textContent, /travessia visual não carregou/); assert.equal(h.internal.hud.enterButton.disabled, false);
});

test('a phase clear crossing and reloading mid-sail both begin at the played Costa arrival', async t => {
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save); h.view.hide();
    h.view.render(5, save, 1000, '', '', { playedStage: '1-5', nextSelected: '2-1' });
    assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.internal.journey.destination, '2-1'); assert.equal(h.internal.motionState(), 'walking');
    let time = 1000; while (h.internal.motionState() !== 'sailing' && time < 6000) { time += 50; h.view.render(5, save, time, ''); }
    assert.equal(h.internal.motionState(), 'sailing'); h.view.hide(); h.view.render(4, save, 9000, '');
    assert.equal(h.internal.journey.arrived, '1-5'); assert.equal(h.internal.journey.destination, null); assert.deepEqual(h.internal.marker, point(actualMetadata(1).nodes['1-5']));
});

test('vertical keyboard region selection matches docks and drawer rather than retaining a locked phase number', t => {
    mapDOM(t); const h = worldHarness(); h.game.selection = 2; h.game.menuKey({ key: 'ArrowDown', repeat: false, target: null, preventDefault() {} });
    assert.equal(h.game.selection, 5); h.game.menuKey({ key: 'ArrowUp', repeat: false, target: null, preventDefault() {} }); assert.equal(h.game.selection, 0);
});

test('boat heading changes at the same aspect-adjusted segment boundary as the sampled passenger path', async t => {
    const { journeyPathSegment } = await import('../src/adventure/WorldMapView');
    const { samplePath } = await import('../src/adventure/WorldMapModel');
    const h = mapDOM(t), save = openSave('1-5'); await readyConnection(h, save);
    const route: MapPoint[] = h.internal.connection.sailRoute;
    const lengths = route.slice(1).map((point, index) => Math.hypot((point.x - route[index].x) * 1.6, point.y - route[index].y));
    const total = lengths.reduce((sum, length) => sum + length, 0), boundary = (lengths[0] + lengths[1]) / total;
    assert.equal(journeyPathSegment(route, boundary - 1e-6), 1); assert.equal(journeyPathSegment(route, boundary + 1e-6), 2);
    const sampled = samplePath(route, boundary); assert.ok(Math.hypot(sampled.x - route[2].x, sampled.y - route[2].y) < 1e-8);
    const edge = h.internal.network.edges.find((edge: { mode: string }) => edge.mode === 'sail'); h.media.matches = true;
    for (const direction of [1, -1]) for (const progress of [boundary - 1e-6, boundary + 1e-6]) {
        h.internal.journey.legs = [{ ...edge, direction, progress }]; h.internal.marker = samplePath(route, progress);
        const segment = journeyPathSegment(route, progress), expected = direction === 1 ? h.internal.connection.segmentHeadings[segment]
            : h.internal.connection.reverseSegmentHeadings[route.length - 2 - segment];
        assert.equal(h.internal.currentBoat().frame.index, expected);
    }
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
        assert.equal(button.style.transform, `translate(${Math.round(projected.x)}px, ${Math.round(projected.y)}px) translate(-50%, -100%)`);
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
});
