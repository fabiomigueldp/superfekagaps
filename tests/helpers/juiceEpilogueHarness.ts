import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { JuiceMinibossModel } from '../../src/adventure/experimental/JuiceMinibossModel';
import type { TestContext } from 'node:test';
import { freshSave, SAVE_KEY } from '../../src/adventure/progress';
import { WorldGame } from '../../src/adventure/WorldGame';
import { JuiceMinibossLab } from '../../src/adventure/experimental/JuiceMinibossLab';

// Browser-boundary fixture based on the existing juice lifecycle harness.
// The constructor, Input, Player, encounter and Renderer remain production code.
type Listener = (event: Record<string, unknown>) => void;

/** Browser boundaries only: the lab, renderer, input, player and encounter are real. */
class EventSurface {
    private listeners = new Map<string, Array<{ listener: Listener; capture: boolean }>>();
    addEventListener(type: string, listener: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), { listener, capture }]);
    }
    removeEventListener(type: string, listener: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        this.listeners.set(type, (this.listeners.get(type) ?? []).filter(entry => entry.listener !== listener || entry.capture !== capture));
    }
    get listenerCount() { return [...this.listeners.values()].reduce((count, entries) => count + entries.length, 0); }
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

class Element extends EventSurface {
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
    disabled = false;
    contentEditable = 'false';
    spellcheck = true;
    style: Record<string, string> = {};
    focused = false;
    focusCount = 0;
    closest(selector: string): Element | null {
        return this.tagName === 'BUTTON' && selector.includes('button') || this.tagName === 'A' && selector.includes('a[href]') ? this : null;
    }
    matches() { return false; }
    get isContentEditable() { return this.contentEditable === 'true'; }
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
    focus() {
        this.focused = true; this.focusCount++;
        (document as unknown as { activeElement: Element }).activeElement = this;
    }
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

export function juiceEpilogueBrowser(t: Pick<TestContext, 'after'>, reducedMotion = false) {
    const canvas = new Canvas(); canvas.id = 'game-canvas';
    const status = new Element(); status.id = 'lab-status';
    const retry = new Element(); retry.id = 'lab-retry';
    const pause = new Element(); pause.id = 'lab-pause';
    const skip = new Element(); skip.id = 'lab-skip';
    const replay = new Element(); replay.id = 'lab-replay';
    const present = new Element(); present.id = 'lab-present';
    const exit = new Element(); exit.id = 'lab-exit'; exit.tagName = 'A';
    for (const button of [retry, pause, skip, replay, present]) button.tagName = 'BUTTON';
    const elements = new Map<string, Element>([canvas, status, retry, pause, skip, replay, present, exit].map(element => [element.id, element]));
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; };
    const cancelFrame = (id: number) => { frames.delete(id); };
    const matchMedia = (query: string) => Object.assign(new EventSurface(), {
        matches: reducedMotion && query === '(prefers-reduced-motion: reduce)', media: query,
    });
    const document = Object.assign(new EventSurface(), {
        title: '', hidden: false, activeElement: null as Element | null, body: { style: {} }, querySelector: () => null,
        getElementById: (id: string) => elements.get(id) ?? null,
        createElement: (tag: string) => tag === 'canvas' ? new Canvas() : new Element()
    });
    const window = Object.assign(new EventSurface(), {
        innerWidth: 640, innerHeight: 440, devicePixelRatio: 1, requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame, matchMedia,
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
        navigator: { maxTouchPoints: 0 }, location: { hash: '' },
        innerWidth: window.innerWidth, innerHeight: window.innerHeight, requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame, matchMedia }))
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
    function create(withIntro = false) { const game = new JuiceMinibossLab(canvas as unknown as HTMLCanvasElement, status as unknown as HTMLElement); if (!withIntro) game.skipIntro(); return game; }
    function frame() {
        const pending = [...frames]; frames.clear();
        for (const [, callback] of pending) callback(performance.now());
    }
    return { canvas, status, retry, pause, skip, replay, present, exit, document, window, frames, storageCalls, create, key, pointer, hidden, frame };
}


export const STEP = 1000 / 60;
const recording = JSON.parse(readFileSync(new URL('./juiceLabReplay.json', import.meta.url), 'utf8')) as {
    keys: string[]; runs: Array<[number, number]>; frames: number;
    expectedHits: Array<{ frame: number; health: number }>;
};
export function juiceSnapshot(game: JuiceMinibossLab): string {
    const boss = game.boss as NonNullable<typeof game.boss> & { model: JuiceMinibossModel };
    return JSON.stringify({ player: game.player.data, boss: boss.model, time: game.time,
        input: game.input.getState(), save: game.store.save, mode: game.labMode });
}
/** Replays ordinary key transitions through production Input, not injected flags. */
export function replayJuiceVictory(h: { window: { dispatch(type: string, data?: Record<string, unknown>): unknown }; canvas: unknown },
    game: JuiceMinibossLab, afterStep?: () => void, advance: (dt: number) => void = dt => game.update(dt)): string[] {
    const mapping: Record<string, string> = { left: 'ArrowLeft', right: 'ArrowRight', run: 'ShiftLeft', jump: 'Space' };
    let held = new Set<string>(), frame = 0, health = game.boss!.health;
    const snapshots: string[] = [], hits: Array<{ frame: number; health: number }> = [];
    function keys(next: Set<string>) {
        for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        held = next;
    }
    for (const [count, bits] of recording.runs) {
        keys(new Set(recording.keys.flatMap((key, i) => bits & (1 << i) && mapping[key] ? [mapping[key]] : [])));
        for (let n = 0; n < count; n++, frame++) {
            advance(STEP); afterStep?.();
            assert.equal(game.player.data.isDead, false, `native replay died at ${frame}`);
            if (game.boss!.health !== health) { health = game.boss!.health; hits.push({ frame, health }); }
            snapshots.push(juiceSnapshot(game));
        }
    }
    keys(new Set());
    assert.equal(frame, recording.frames); assert.deepEqual(hits, recording.expectedHits);
    assert.equal(game.boss!.phase, 'defeated');
    return snapshots;
}
