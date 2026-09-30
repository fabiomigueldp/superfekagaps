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
    const observers: Array<{ target: Element | null; disconnected: boolean; callback: () => void }> = [];
    class Observer {
        target: Element | null = null;
        disconnected = false;
        constructor(readonly callback: () => void) { observers.push(this); }
        observe(target: Element) { this.target = target; }
        disconnect() { this.target = null; this.disconnected = true; }
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
        async finishAssets(metadata: unknown = fallbackMapMetadata(), imageSuccess = true) {
            images.forEach(image => imageSuccess ? image.onload?.() : image.onerror?.());
            fetches.forEach(request => request.resolve({ ok: true, json: async () => metadata }));
            await new Promise<void>(resolve => setImmediate(resolve));
        }
    };
}

const point = (value: { x: number; y: number }) => ({ x: value.x, y: value.y });

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

test('metadata rejects incomplete or nonfinite node exports and drops malformed paths', () => {
    for (const value of [null, undefined, 42, {}, { nodes: {} }]) assert.equal(parseMapMetadata(value), null);
    for (const value of [NaN, Infinity, -.01, 1.01, '0.5']) {
        const data = structuredClone(fallbackMapMetadata());
        (data.nodes['1-3'] as any).x = value;
        assert.equal(parseMapMetadata(data), null);
    }
    const data = fallbackMapMetadata();
    data.routes = { '0:1': [FALLBACK_POINTS[0], FALLBACK_POINTS[1]], '1:2': [FALLBACK_POINTS[1]],
        '3:4': [{ x: Infinity, y: .5 }, FALLBACK_POINTS[4]], '20:21': [FALLBACK_POINTS[0], FALLBACK_POINTS[1]] };
    data.secretRoute = [{ x: .5, y: NaN }];
    const parsed = parseMapMetadata(data)!;
    assert.deepEqual(Object.keys(parsed.routes), ['0:1']);
    assert.deepEqual(parsed.secretRoute, []);
});

test('map show/hide remounts nothing, restores focus/tabindex and retains exactly one listener set', t => {
    const h = mapDOM(t);
    h.gameCanvas.setAttribute('tabindex', '7');
    const originalChildren = h.body.children.length;
    assert.equal(h.root.hidden, true);
    assert.equal(h.fetches.length, 1);
    assert.equal(h.images.length, 3);
    for (let iteration = 0; iteration < 3; iteration++) {
        h.view.show(iteration * 1000); h.view.show(iteration * 1000 + 1);
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
    h.view.show(0); h.view.dispose();
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
    const h = mapDOM(t, true), data = fallbackMapMetadata();
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
    const h = mapDOM(t), data = fallbackMapMetadata();
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

function worldHarness() {
    const values = new Map<string, string>(), writes: string[] = [], calls: string[] = [];
    const store = new ProgressStore({ getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); writes.push(value); } });
    const game = Object.create(WorldGame.prototype) as any;
    const mapRenders: unknown[][] = [];
    Object.assign(game, { store, state: 'map', selection: 0, time: 1234, toast: '', toastTimer: 0,
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
    const h = mapDOM(t, true), metadata = fallbackMapMetadata();
    metadata.nodes['1-4'] = { x: .71, y: .61 };
    h.view.render(3, freshSave(), 0, '');
    assert.deepEqual(h.internal.marker, FALLBACK_POINTS[3]);
    await h.finishAssets(metadata);
    h.view.render(3, freshSave(), 100, '');
    assert.equal(h.internal.assets.island, h.images[0]);
    assert.deepEqual(h.internal.marker, metadata.nodes['1-4']);
    assert.equal(h.get('world-map-stage-title').textContent, STAGES[3].name);
});

test('a failed terrain image never applies its metadata over fallback art', async t => {
    const h = mapDOM(t, true), metadata = fallbackMapMetadata();
    metadata.nodes['1-1'] = { x: .7, y: .2 };
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
    const h = mapDOM(t, true), metadata = fallbackMapMetadata();
    metadata.secretRoute = [{ x: .1, y: .1 }, { x: .9, y: .9 }];
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
    const h = mapDOM(t), data = fallbackMapMetadata();
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
        [844, 392, 68, 307], [840, 757, 94, 563], [320, 568, 92, 377]]) {
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
