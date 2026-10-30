import assert from 'node:assert/strict';
import { BrowserErrorCaptureEnum, Window, HTMLElement, HTMLCanvasElement, HTMLInputElement, type Document, type TEventListener } from 'happy-dom';
import { createMediaQueryHarness } from './mediaQueryHarness';

interface Boundaries {
    window: Window;
    pickerFails: boolean;
    contexts: WeakMap<object, object>;
    captureFailures: WeakSet<HTMLElement>;
    captures: WeakMap<HTMLElement, Set<number>>;
}
// Happy DOM shares prototypes between windows. Dispatch adapters by ownerDocument,
// retaining native behavior for documents outside this harness.
const boundaries = new WeakMap<Document, Boundaries>();
const rect = HTMLElement.prototype.getBoundingClientRect, rects = HTMLElement.prototype.getClientRects;
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value(this: HTMLElement) {
    const state = boundaries.get(this.ownerDocument);
    return state ? new state.window.DOMRect(0, 0, 960, 540) : rect.call(this);
} });
Object.defineProperty(HTMLElement.prototype, 'getClientRects', { configurable: true, value(this: HTMLElement) {
    const state = boundaries.get(this.ownerDocument);
    if (!state) return rects.call(this);
    const absent = !this.isConnected || this.closest('[hidden], [inert], dialog:not([open])')
        || state.window.getComputedStyle(this).display === 'none';
    const rectangles = absent ? [] : [this.getBoundingClientRect()];
    return Object.assign(rectangles, { item: (index: number) => rectangles[index] ?? null });
} });
const context = HTMLCanvasElement.prototype.getContext;
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value(this: HTMLCanvasElement, ...args: unknown[]) {
    const state = boundaries.get(this.ownerDocument);
    if (!state) return Reflect.apply(context, this, args);
    if (!state.contexts.has(this)) state.contexts.set(this, new Proxy<Record<string, unknown>>({ canvas: this }, {
        get(object, key: string) {
            if (key in object) return object[key];
            if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
            if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
            return () => {};
        },
    }));
    return state.contexts.get(this);
} });
const capture = HTMLElement.prototype.setPointerCapture, captured = HTMLElement.prototype.hasPointerCapture,
    release = HTMLElement.prototype.releasePointerCapture;
Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value(this: HTMLElement, id: number) {
    const state = boundaries.get(this.ownerDocument);
    if (!state) return capture.call(this, id);
    if (state.captureFailures.has(this)) throw new state.window.DOMException('Capture unavailable');
    if (!state.captures.has(this)) state.captures.set(this, new Set());
    state.captures.get(this)!.add(id);
} });
Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value(this: HTMLElement, id: number) {
    const state = boundaries.get(this.ownerDocument);
    return state ? state.captures.get(this)?.has(id) ?? false : captured.call(this, id);
} });
Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value(this: HTMLElement, id: number) {
    const state = boundaries.get(this.ownerDocument);
    if (!state) return release.call(this, id);
    if (state.captures.get(this)?.delete(id)) this.dispatchEvent(new state.window.PointerEvent('lostpointercapture', { pointerId: id, bubbles: true }));
} });
const click = HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click = function () {
    const state = boundaries.get(this.ownerDocument);
    if (state && this.type === 'file') {
        assert.ok(this.isConnected, 'Chooser must remain attached');
        if (state.pickerFails) throw Error('Picker unavailable');
    }
    click.call(this);
};

/**
 * Shared Happy DOM tree/events/forms instead of a growing hand-written browser mock.
 * Layout rectangles, canvas painting, picker and pointer capture remain controlled boundaries.
 * This does not model CSS layout or the browser's automatic modal focus/top layer; the
 * browser contract checks the explicit focus transitions used here. Global installs are
 * for sequential fixtures within one Node test process, with dispose after each visit.
 */
export function createDeliciaDom(initiallyFocused = true) {
    const window = new Window({ width: 960, height: 540, url: 'http://127.0.0.1/', settings: {
        enableJavaScriptEvaluation: false, enableCSSFileLoading: false, enableImageFileLoading: false,
        enableIframePageLoading: false, errorCapture: BrowserErrorCaptureEnum.disabled,
        navigation: { disableMainFrameNavigation: true, disableChildFrameNavigation: true, disableChildPageNavigation: true },
    } });
    const document: typeof window.document & { hidden: boolean } = window.document;
    let focused = initiallyFocused, hidden = false;
    const state: Boundaries = { window, pickerFails: false, contexts: new WeakMap(), captureFailures: new WeakSet(), captures: new WeakMap() };
    boundaries.set(window.document, state);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden, set: (value: boolean) => { hidden = value; } });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
    document.hasFocus = () => focused;
    const mediaQueries = createMediaQueryHarness();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: mediaQueries.matchMedia });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });

    const original = new Map<string, PropertyDescriptor | undefined>();
    return { window, document, body: document.body, mediaQueries,
        failPicker(value = true) { state.pickerFails = value; },
        failPointerCapture(element: HTMLElement) { state.captureFailures.add(element); },
        focus(value: boolean, notify = true) {
            focused = value;
            if (notify) window.dispatchEvent(new window.Event(value ? 'focus' : 'blur'));
        },
        install(overrides: Record<string, unknown>) {
            const globals = { window, document, location: window.location, matchMedia: mediaQueries.matchMedia,
                Event: window.Event, CustomEvent: window.CustomEvent, KeyboardEvent: window.KeyboardEvent, PointerEvent: window.PointerEvent,
                HTMLElement: window.HTMLElement, HTMLButtonElement: window.HTMLButtonElement, HTMLInputElement: window.HTMLInputElement,
                HTMLSelectElement: window.HTMLSelectElement, HTMLTextAreaElement: window.HTMLTextAreaElement, HTMLDialogElement: window.HTMLDialogElement,
                getComputedStyle: window.getComputedStyle.bind(window), ...overrides };
            for (const [name, value] of Object.entries(globals)) {
                original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
                Object.defineProperty(globalThis, name, { configurable: true, value });
            }
        },
        async dispose() {
            mediaQueries.dispose();
            await window.happyDOM.close();
            boundaries.delete(window.document);
            for (const [name, descriptor] of original) {
                if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
            }
            original.clear();
        },
    };
}

/** The file picker is external; retain a real FileList while controlling its bytes/read completion. */
export function setInputFile(input: HTMLInputElement, file: { size: number; text(): Promise<string> }) {
    const window = input.ownerDocument.defaultView!;
    const value = new window.File([], 'progress.json', { type: 'application/json' }), files = new window.FileList();
    Object.defineProperties(value, { size: { value: file.size }, text: { value: () => file.text() } });
    files.push(value); input.files = files;
}

/** Invoke the captured read callback so tests can await success/failure, including stale completions. */
export async function changeInputFile(input: HTMLInputElement, callback: TEventListener | null = input.onchange): Promise<void> {
    assert.equal(typeof callback, 'function');
    if (typeof callback === 'function') await Reflect.apply(callback, input, [new input.ownerDocument.defaultView!.Event('change')]);
}
