import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { Input, type InputAction } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { Renderer } from '../src/engine/Renderer';
import { WorldGame } from '../src/adventure/WorldGame';
import { STAGES } from '../src/adventure/campaign';
import { freshSave, SAVE_KEY } from '../src/adventure/progress';
import { GuairaBullEncounter, GuairaBullLab } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { installGuairaLabControls } from '../src/guaira-lab-controls';
import { Canvas } from './helpers/guairaLabHarness';

const recording = JSON.parse(readFileSync(new URL('./helpers/guairaLabReplay.json', import.meta.url), 'utf8')) as {
    stepMs: number; frames: number; runs: Array<[number, string[]]>; expectedHits: Array<{ frame: number; health: number }>;
};
const actions: InputAction[] = ['left', 'right', 'jump', 'run', 'down'];
const keyAction: Record<string, InputAction> = { ArrowLeft: 'left', ArrowRight: 'right', Space: 'jump', ShiftLeft: 'run', ArrowDown: 'down' };

function event(target: EventTarget, type: string, values: Record<string, unknown> = {}) {
    return target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
}

/** Real EventTarget dispatch/cancellation; only DOM, capture and canvas device boundaries are substituted. */
class DomElement extends EventTarget {
    id = ''; className = ''; title = ''; type = ''; hidden = false; disabled = false;
    contentEditable = 'false'; spellcheck = true; textContent = ''; style: Record<string, string> = {};
    children: DomElement[] = []; parent: DomElement | null = null;
    readonly attributes = new Map<string, string>();
    readonly captures = new Set<number>();
    constructor(readonly tagName = 'DIV') { super(); }
    append(...children: DomElement[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    removeAttribute(name: string) { this.attributes.delete(name); }
    closest(selector: string): DomElement | null {
        return this.tagName === 'BUTTON' && selector.includes('button') ? this : this.parent?.closest(selector) ?? null;
    }
    getBoundingClientRect() {
        return { left: 0, top: 0, width: this.hidden ? 0 : 320,
            height: this.hidden ? 0 : this.id === 'guaira-touch-controls' ? 56 : 180 };
    }
    setPointerCapture(id: number) { this.captures.add(id); }
    hasPointerCapture(id: number) { return this.captures.has(id); }
    releasePointerCapture(id: number) {
        if (this.captures.delete(id)) event(this, 'lostpointercapture', { pointerId: id });
    }
}
class DomCanvas extends DomElement {
    width = 640; height = 360;
    readonly device = new Canvas();
    constructor() { super('CANVAS'); }
    getContext() { return this.device.getContext(); }
}

function browser(t: TestContext) {
    const body = new DomElement('BODY'), canvas = new DomCanvas(), status = new DomElement();
    canvas.id = 'game-canvas'; body.append(canvas, status);
    const canvases = [canvas], observed = new Set<DomElement>(), cleanups: Array<() => void> = [];
    const find = (root: DomElement, id: string): DomElement | undefined => root.id === id ? root : root.children.map(child => find(child, id)).find(Boolean);
    const doc = Object.assign(new EventTarget(), {
        body, hidden: false, title: '', querySelector: () => null,
        getElementById: (id: string) => find(body, id) ?? null,
        createElement: (tag: string) => {
            if (tag !== 'canvas') return new DomElement(tag.toUpperCase());
            const created = new DomCanvas(); canvases.push(created); return created;
        }
    });
    const win = Object.assign(new EventTarget(), { innerWidth: 640, innerHeight: 440, devicePixelRatio: 1,
        requestAnimationFrame() { assert.fail('This deterministic wrapper test must not schedule an animation loop.'); } });
    const savedCampaign = JSON.stringify({ ...freshSave(), completed: ['1-1'], selected: '1-2' });
    const persisted = new Map([[SAVE_KEY, savedCampaign]]), storageCalls: string[] = [];
    const storage = {
        getItem(key: string) { storageCalls.push(`get:${key}`); return persisted.get(key) ?? null; },
        setItem(key: string, value: string) { storageCalls.push(`set:${key}`); persisted.set(key, value); },
        removeItem(key: string) { storageCalls.push(`remove:${key}`); persisted.delete(key); },
        clear() { storageCalls.push('clear'); persisted.clear(); }
    };
    const original = new Map<string, PropertyDescriptor | undefined>();
    const globals: Record<string, unknown> = { window: win, document: doc, HTMLElement: DomElement,
        PointerEvent: class extends Event {}, navigator: { maxTouchPoints: 5 }, location: { hash: '' },
        matchMedia: () => Object.assign(new EventTarget(), { matches: false }), innerWidth: 640, innerHeight: 440,
        ResizeObserver: class {
            private target?: DomElement;
            observe(target: DomElement) { this.target = target; observed.add(target); }
            disconnect() { if (this.target) observed.delete(this.target); }
        }
    };
    for (const [name, value] of Object.entries(globals)) {
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    original.set('localStorage', Object.getOwnPropertyDescriptor(globalThis, 'localStorage'));
    const storageDescriptor = { configurable: true, get() { storageCalls.push('localStorage'); return storage; } };
    Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    Object.defineProperty(win, 'localStorage', storageDescriptor);
    t.after(() => {
        for (const cleanup of cleanups) cleanup();
        for (const [name, descriptor] of original) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
        }
        assert.deepEqual(storageCalls, [], 'The lab must not access the saved campaign, even through a storage lookup.');
        assert.deepEqual([...persisted], [[SAVE_KEY, savedCampaign]]);
    });
    return { body, canvas, status, doc, win, observed, cleanups,
        draws: () => canvases.reduce((count, value) => count + value.device.drawCalls, 0) };
}

test('DOM pointers win the real bull replay and survive pause, retry, hidden and bfcache lifecycle without leaked controls', t => {
    const h = browser(t), campaign = structuredClone(STAGES);
    const game = new GuairaBullLab(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    const controls = installGuairaLabControls(game, h.canvas as unknown as HTMLCanvasElement, () => game.boss?.phase === 'defeated');
    h.cleanups.push(() => controls.dispose());
    assert.ok(game instanceof WorldGame); assert.ok(game.input instanceof Input);
    assert.ok(game.player instanceof Player); assert.ok(game.renderer instanceof Renderer);
    const roots = () => h.body.children.filter(child => child.id === 'guaira-touch-controls');
    const buttons = () => Object.fromEntries(roots()[0].children.map(button => [button.getAttribute('data-action')!, button])) as Record<InputAction, DomElement>;
    let pointer = 0;
    const down = (action: InputAction, target = buttons()[action]) => {
        const id = ++pointer;
        assert.equal(event(target, 'pointerdown', { pointerId: id, button: 0 }), false, 'An active DOM press owns and cancels its native event.');
        assert.ok(target.hasPointerCapture(id)); return id;
    };
    const up = (id: number, cancelled = false) => event(h.win, cancelled ? 'pointercancel' : 'pointerup', { pointerId: id });
    const neutral = () => {
        game.input.update(); const state = game.input.getState();
        for (const action of [...actions, 'jumpPressed', 'jumpReleased', 'downPressed'] as const) assert.equal(state[action], false, action);
        for (const root of roots()) for (const button of root.children) {
            assert.equal(button.getAttribute('data-held'), null); assert.equal(button.captures.size, 0);
        }
    };
    const step = () => { game.update(recording.stepMs); controls.sync(); };
    const retry = () => { game.load('guaira-lab'); controls.sync(); };
    const togglePause = () => { game.toggleLabPause(); controls.sync(); };
    const legacyJump = () => event(h.canvas, 'touchstart', { touches: [{ identifier: 99, target: h.canvas, clientX: 298, clientY: 162 }] });
    assert.equal(roots().length, 1); assert.equal(roots()[0].hidden, false); assert.equal(h.observed.size, 1);
    assert.equal(roots()[0].children.length, 5);
    assert.ok(roots()[0].children.every(button => button.tagName === 'BUTTON' && !button.disabled));
    let draws = h.draws(); game.renderer.drawTouchControls(); assert.equal(h.draws(), draws, 'DOM mode suppresses the real canvas overlay.');
    legacyJump(); neutral();

    // Convert only recorded key identities to button identities. The real Input
    // edges, Player physics, WorldGame collision and boss timing remain untouched.
    const held = new Map<InputAction, number>(), hits: Array<{ frame: number; health: number }> = [];
    const phases = new Set<string>(); let frame = 0, health = 6;
    for (const [count, keys] of recording.runs) {
        const next = new Set(keys.map(code => { assert.ok(keyAction[code], code); return keyAction[code]; }));
        for (const [action, id] of held) if (!next.has(action)) { up(id); held.delete(action); }
        for (const action of next) if (!held.has(action)) held.set(action, down(action));
        for (let n = 0; n < count; n++, frame++) {
            step(); const boss = (game.boss as GuairaBullEncounter).model; phases.add(boss.state);
            assert.equal(game.player.data.isDead, false, `DOM replay died at frame ${frame}`);
            assert.equal(game.player.data.hasHelmet, true, `DOM replay lost its helmet at frame ${frame}`);
            assert.equal(game.camera.x, 0); assert.equal(game.camera.y, 64);
            if (boss.health !== health) { hits.push({ frame, health: boss.health }); health = boss.health; }
        }
    }
    assert.equal(frame, recording.frames); assert.deepEqual(hits, recording.expectedHits);
    assert.equal(game.boss?.phase, 'defeated'); assert.equal(game.boss?.health, 0);
    assert.equal(game.canAdvanceToAscent, true); assert.equal(game.mapReturnHref, './guaira.html?at=corral&visit=bull-clear');
    for (const phase of ['tell', 'charge', 'brake', 'rattle', 'bones', 'recover']) assert.ok(phases.has(phase), phase);
    assert.ok(roots()[0].children.every(button => button.disabled));
    for (const id of held.values()) up(id);
    neutral(); game.render(); assert.match(h.status.textContent, /Vitória/); assert.ok(h.draws() > draws);

    // The fifth button reaches the real ground-pound mechanic after an ordinary jump.
    retry(); const jump = down('jump'); step(); up(jump);
    const pound = down('down'); step(); assert.ok(game.player.isGroundPoundActive()); up(pound, true);
    retry(); down('right'); down('jump'); const oldPlayer = game.player, oldBoss = game.boss;
    retry(); assert.notEqual(game.player, oldPlayer); assert.notEqual(game.boss, oldBoss);
    assert.equal(game.player.data.hasHelmet, true); neutral();
    const oldUp = down('right'); down('jump'); togglePause(); neutral();
    assert.equal(game.state, 'paused'); assert.ok(roots()[0].children.every(button => button.disabled));
    const frozen = structuredClone({ player: game.player.data, boss: (game.boss as GuairaBullEncounter).model, time: game.time });
    for (let i = 0; i < 4; i++) step();
    assert.deepEqual(structuredClone({ player: game.player.data, boss: (game.boss as GuairaBullEncounter).model, time: game.time }), frozen);
    togglePause(); up(oldUp); neutral();
    for (const interrupt of ['blur', 'hidden'] as const) {
        down('right'); down('jump');
        if (interrupt === 'blur') event(h.win, 'blur');
        else { h.doc.hidden = true; event(h.doc, 'visibilitychange'); }
        controls.sync(); assert.equal(game.state, 'paused'); neutral();
        h.doc.hidden = false; event(h.doc, 'visibilitychange'); controls.sync();
        assert.equal(game.state, 'paused', 'Showing the page cannot resume gameplay or an old gesture.');
        togglePause(); neutral();
    }

    const staleButtons = buttons(), stalePointer = down('jump'); down('right');
    event(h.win, 'pagehide', { persisted: true });
    assert.equal(roots().length, 0); assert.equal(h.observed.size, 0); neutral();
    assert.ok(Object.values(staleButtons).every(button => button.captures.size === 0));
    draws = h.draws(); game.renderer.drawTouchControls(); assert.ok(h.draws() > draws, 'Suspension restores the actual fallback overlay.');
    legacyJump(); game.input.update(); assert.equal(game.input.getState().jumpPressed, true); game.input.reset();
    event(h.win, 'pageshow', { persisted: false }); assert.equal(roots().length, 0);
    for (let i = 0; i < 3; i++) event(h.win, 'pageshow', { persisted: true });
    assert.equal(roots().length, 1); assert.equal(h.observed.size, 1);
    assert.notEqual(buttons().jump, staleButtons.jump); controls.sync();
    event(staleButtons.jump, 'pointerdown', { pointerId: stalePointer, button: 0 }); up(stalePointer); neutral();
    legacyJump(); neutral();
    draws = h.draws(); game.renderer.drawTouchControls(); assert.equal(h.draws(), draws);
    const fresh = down('right'); step(); assert.ok(game.player.data.velocity.x > 0); up(fresh);
    down('jump'); controls.dispose(); controls.dispose();
    assert.equal(roots().length, 0); assert.equal(h.observed.size, 0); neutral();
    event(h.win, 'pageshow', { persisted: true }); assert.equal(roots().length, 0, 'Disposed wrappers cannot remount.');
    legacyJump(); game.input.update(); assert.equal(game.input.getState().jumpPressed, true);
    assert.deepEqual(game.store.save.completed, []); assert.deepEqual(game.store.save.times, {});
    assert.deepEqual(STAGES, campaign);
});
