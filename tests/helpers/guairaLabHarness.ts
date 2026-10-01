import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { freshSave, SAVE_KEY } from '../../src/adventure/progress';
import { WorldGame } from '../../src/adventure/WorldGame';
import { GuairaBullLab } from '../../src/adventure/experimental/guaira/GuairaBullLab';

type Listener = (event: Record<string, unknown>) => void;

/** Browser boundaries only: the lab, renderer, input, player and encounter are real. */
class EventSurface {
    private listeners = new Map<string, Array<{ listener: Listener; capture: boolean }>>();
    addEventListener(type: string, listener: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), { listener, capture }]);
    }
    dispatch(type: string, data: Record<string, unknown> = {}) {
        let prevented = false;
        const event = { target: this, currentTarget: this, repeat: false,
            preventDefault() { prevented = true; }, ...data };
        const listeners = this.listeners.get(type) ?? [];
        for (const capture of [true, false])
            for (const entry of listeners) if (entry.capture === capture) entry.listener(event);
        return prevented;
    }
}

export class Element extends EventSurface {
    id = '';
    tagName = 'DIV';
    className = '';
    title = '';
    children: Element[] = [];
    readonly attributes = new Map<string, string>();
    private ownText = '';
    get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join(''); }
    set textContent(value: string) { this.ownText = value; this.children = []; }
    hidden = false;
    contentEditable = 'false';
    spellcheck = true;
    style: Record<string, string> = {};
    focused = false;
    closest(selector: string): Element | null {
        return this.tagName === 'BUTTON' && selector.includes('button') || this.tagName === 'A' && selector.includes('a[href]') ? this : null;
    }
    matches() { return false; }
    get isContentEditable() { return this.contentEditable === 'true'; }
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
    focus() { this.focused = true; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 360 }; }
}

export class Canvas extends Element {
    width = 640;
    height = 360;
    drawCalls = 0;
    private context = Object.assign(Object.fromEntries([
        'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'fill', 'stroke',
        'fillRect', 'strokeRect', 'clearRect', 'save', 'restore', 'setTransform', 'translate',
        'scale', 'rotate', 'rect', 'clip', 'drawImage'
    ].map(name => [name, () => { this.drawCalls++; }])), {
        globalAlpha: 1, imageSmoothingEnabled: false,
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} })
    }) as unknown as CanvasRenderingContext2D;
    getContext() { return this.context; }
}

export function guairaBrowser(t: Pick<TestContext, 'after'>, options: { touch?: boolean; reducedMotion?: boolean } = {}) {
    const canvas = new Canvas(); canvas.id = 'game-canvas';
    const status = new Element(); status.id = 'lab-status';
    const retry = new Element(); retry.id = 'lab-retry';
    const pause = new Element(); pause.id = 'lab-pause';
    const exit = new Element(); exit.id = 'lab-exit'; exit.tagName = 'A';
    for (const button of [retry, pause]) button.tagName = 'BUTTON';
    const elements = new Map<string, Element>([canvas, status, retry, pause, exit].map(element => [element.id, element]));
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; };
    const document = Object.assign(new EventSurface(), {
        title: '', hidden: false, body: { style: {} }, querySelector: () => null,
        getElementById: (id: string) => elements.get(id) ?? null,
        createElement: (tag: string) => tag === 'canvas' ? new Canvas() : new Element()
    });
    const window = Object.assign(new EventSurface(), {
        innerWidth: 640, innerHeight: 440, devicePixelRatio: 1, requestAnimationFrame: requestFrame,
        worldGame: undefined as WorldGame | undefined
    });
    const savedCampaign = JSON.stringify({ ...freshSave(), completed: ['1-1'], selected: '1-2' });
    const storageCalls: string[] = [];
    const storage = {
        getItem(key: string) { storageCalls.push(`get:${key}`); return key === SAVE_KEY ? savedCampaign : null; },
        setItem(key: string) { storageCalls.push(`set:${key}`); },
        removeItem(key: string) { storageCalls.push(`remove:${key}`); },
        clear() { storageCalls.push('clear'); }
    };
    const original = new Map<string, PropertyDescriptor | undefined>();
    function global(name: string, descriptor: PropertyDescriptor) {
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
    }
    t.after(() => {
        for (const [name, descriptor] of original) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
        assert.deepEqual(storageCalls, [], 'The ephemeral lab must not even look up localStorage.');
    });
    for (const [name, value] of Object.entries({ document, window, HTMLElement: Element,
        navigator: { maxTouchPoints: options.touch ? 2 : 0 }, matchMedia: () => ({ matches: !!options.reducedMotion }), location: { hash: '' },
        innerWidth: window.innerWidth, innerHeight: window.innerHeight, requestAnimationFrame: requestFrame }))
        global(name, { writable: true, value });
    const storageDescriptor = { get() { storageCalls.push('localStorage'); return storage; } };
    global('localStorage', storageDescriptor);
    Object.defineProperty(window, 'localStorage', storageDescriptor);

    function key(key: string, repeat = false) {
        const code = key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key;
        window.dispatch('keydown', { key, code, repeat, target: canvas });
        if (!repeat) window.dispatch('keyup', { key, code, target: canvas });
    }
    function pointer(x: number, y: number) { canvas.dispatch('pointerdown', { clientX: x * 2, clientY: y * 2 }); }
    function hidden(value: boolean) { document.hidden = value; document.dispatch('visibilitychange'); }
    function create() { return new GuairaBullLab(canvas as unknown as HTMLCanvasElement, status as unknown as HTMLElement); }
    function frame() {
        const pending = [...frames]; frames.clear();
        for (const [, callback] of pending) callback(performance.now());
    }
    return { canvas, status, retry, pause, exit, document, window, frames, storageCalls, create, key, pointer, hidden, frame };
}
