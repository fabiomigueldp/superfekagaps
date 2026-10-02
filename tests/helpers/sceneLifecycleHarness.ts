import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { WorldGame } from '../../src/adventure/WorldGame';

/** Native EventTarget dispatch/removal; only browser/device boundaries are instrumented. */
class Surface extends EventTarget {
    readonly listeners: Array<{ type: string; callback: EventListenerOrEventListenerObject; capture: boolean }> = [];
    override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        super.addEventListener(type, callback, options);
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        if (callback && !this.listeners.some(item => item.type === type && item.callback === callback && item.capture === capture))
            this.listeners.push({ type, callback, capture });
    }
    override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        // Node's native EventTarget accepts the explicit capture option for removal.
        super.removeEventListener(type, callback, { capture });
        const index = this.listeners.findIndex(item => item.type === type && item.callback === callback && item.capture === capture);
        if (index >= 0) this.listeners.splice(index, 1);
    }
    dispatch(type: string, values: Record<string, unknown> = {}) {
        const event = new Event(type, { cancelable: true });
        for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
        this.dispatchEvent(event); return event;
    }
}
export class LifecycleElement extends Surface {
    id = ''; className = ''; title = ''; type = ''; width = 640; height = 360;
    hidden = false; disabled = false; tabIndex = 0; textContent = ''; isContentEditable = false;
    readonly style: Record<string, string> = {};
    readonly attributes = new Map<string, string>();
    readonly captures = new Set<number>();
    children: LifecycleElement[] = []; parent: LifecycleElement | null = null;
    drawCalls = 0;
    readonly context = new Proxy({ imageSmoothingEnabled: false } as Record<string, unknown>, {
        get: (object, key: string) => {
            if (key in object) return object[key];
            if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
            return () => { this.drawCalls++; };
        }
    });
    constructor(readonly tagName = 'DIV') { super(); }
    append(...children: LifecycleElement[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children: LifecycleElement[]) { for (const child of this.children) child.parent = null; this.children = []; this.append(...children); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    get classList() { return { contains: (name: string) => this.className.split(/\s+/).includes(name), toggle: () => {} }; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    removeAttribute(name: string) { this.attributes.delete(name); }
    getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 }; }
    getContext() { return this.context as unknown as CanvasRenderingContext2D; }
    closest(selector: string): LifecycleElement | null {
        if (this.tagName === 'BUTTON' && selector.includes('button') || this.tagName === 'A' && selector.includes('a[href]')) return this;
        return this.parent?.closest(selector) ?? null;
    }
    matches() { return false; }
    focus() {}
    click() { this.dispatch('click', { detail: 0 }); }
    setPointerCapture(id: number) { this.captures.add(id); }
    hasPointerCapture(id: number) { return this.captures.has(id); }
    releasePointerCapture(id: number) { this.captures.delete(id); this.dispatch('lostpointercapture', { pointerId: id }); }
}
class Param { value = 0; setValueAtTime() {} setTargetAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
export class DeviceNode {
    readonly gain = new Param(); readonly frequency = new Param(); readonly Q = new Param();
    type = ''; buffer: unknown; disconnected = false; onended: (() => void) | null = null;
    started = false; stopped = false; stopCalls = 0;
    connect() {} disconnect() { this.disconnected = true; }
    start() { this.started = true; }
    stop(at?: number) { this.stopCalls++; if (at === undefined) this.stopped = true; }
}
export function sceneLifecycleBrowser(t: Pick<TestContext, 'after'>) {
    const surfaces: Surface[] = [];
    const makeElement = (tag: string) => { const element = new LifecycleElement(tag.toUpperCase()); surfaces.push(element); return element; };
    const canvas = makeElement('canvas'); canvas.id = 'game-canvas';
    const status = makeElement('p'), body = makeElement('body'); body.append(canvas, status);
    const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
    const requestAnimationFrame = (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; };
    const cancelAnimationFrame = (id: number) => { frames.delete(id); };
    const media = Object.assign(new Surface(), { matches: false });
    const document = Object.assign(new Surface(), { hidden: false, title: '', body, activeElement: null,
        getElementById: (id: string) => id === 'game-canvas' ? canvas : null,
        createElement: makeElement, createElementNS: (_namespace: string, tag: string) => makeElement(tag) });
    const window = Object.assign(new Surface(), { innerWidth: 640, innerHeight: 440, devicePixelRatio: 1,
        requestAnimationFrame, cancelAnimationFrame, matchMedia: () => media, worldGame: undefined as WorldGame | undefined,
        renderer: undefined as unknown });
    surfaces.push(window, document, media);
    const contexts: DeviceContext[] = [];
    let failGainAt = 0;
    class DeviceContext {
        state = 'running'; currentTime = 0; sampleRate = 100; closeCalls = 0; resumeCalls = 0; suspendCalls = 0;
        readonly destination = new DeviceNode(); readonly nodes: DeviceNode[] = [];
        private gains = 0;
        constructor() { contexts.push(this); }
        make() { const node = new DeviceNode(); this.nodes.push(node); return node; }
        createGain() { if (++this.gains === failGainAt) throw Error('Audio device failed'); return this.make(); }
        createOscillator() { return this.make(); }
        createBufferSource() { return this.make(); }
        createBiquadFilter() { return this.make(); }
        createBuffer() { return { getChannelData: () => new Float32Array(100) }; }
        resume() { this.resumeCalls++; this.state = 'running'; return Promise.resolve(); }
        suspend() { this.suspendCalls++; this.state = 'suspended'; return Promise.resolve(); }
        close() { this.closeCalls++; this.state = 'closed'; return Promise.resolve(); }
    }
    const clips: Clip[] = [];
    class Clip {
        volume = 0; pauses = 0; loads = 0; src = ''; reject!: (reason?: unknown) => void;
        constructor(src: string) { this.src = src; clips.push(this); }
        play() { return new Promise<void>((_resolve, reject) => { this.reject = reject; }); }
        pause() { this.pauses++; }
        removeAttribute() { this.src = ''; }
        load() { this.loads++; }
    }
    const observers: Observer[] = [];
    class Observer {
        disconnected = false; targets: unknown[] = [];
        constructor(readonly callback: () => void) { observers.push(this); }
        observe(target: unknown) { this.targets.push(target); }
        disconnect() { this.disconnected = true; this.targets = []; }
    }
    const images: ImageBoundary[] = [];
    class ImageBoundary { onload: (() => void) | null = null; onerror: (() => void) | null = null; src = ''; decoding = '';
        constructor() { images.push(this); }
    }
    const requests: Array<{ signal?: AbortSignal; resolve: (value: unknown) => void }> = [];
    const descriptors = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({ window, document, HTMLElement: LifecycleElement, HTMLButtonElement: LifecycleElement,
        navigator: { maxTouchPoints: 2 }, PointerEvent: Event, location: { hash: '' }, matchMedia: () => media,
        requestAnimationFrame, cancelAnimationFrame, AudioContext: DeviceContext, Audio: Clip, ResizeObserver: Observer, Image: ImageBoundary,
        fetch: (_url: string, options?: { signal?: AbortSignal }) => new Promise(resolve => requests.push({ signal: options?.signal, resolve })) })) {
        descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    descriptors.set('localStorage', Object.getOwnPropertyDescriptor(globalThis, 'localStorage'));
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { assert.fail('An ephemeral scene must never touch campaign storage'); } });
    t.after(() => {
        window.worldGame?.dispose();
        for (const [name, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
        }
    });
    function frame(now = performance.now() + 20) {
        const pending = [...frames.values()]; frames.clear();
        for (const callback of pending) callback(now);
    }
    const key = (type: 'keydown' | 'keyup', key: string) => window.dispatch(type, {
        key, code: key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key, repeat: false
    });
    return { window, document, canvas, status, body, media, contexts, frames, clips, observers, images, requests, frame, key,
        listenerCount: () => surfaces.reduce((count, target) => count + target.listeners.length, 0),
        drawCount: () => surfaces.reduce((count, target) => count + (target instanceof LifecycleElement ? target.drawCalls : 0), 0),
        failGain: (at: number) => { failGainAt = at; },
        create: <T>(Scene: new (canvas: HTMLCanvasElement, status: HTMLElement) => T) => new Scene(canvas as unknown as HTMLCanvasElement, status as unknown as HTMLElement)
    };
}
