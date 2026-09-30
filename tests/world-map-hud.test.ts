import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldMapHud, type WorldMapHudState, type WorldMapMotionState } from '../src/adventure/WorldMapHud';

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
    focus() { this.focusCount++; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this); }
    getContext() { return { setTransform() {}, fillRect() {}, fillStyle: '', imageSmoothingEnabled: false }; }
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
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: (tag: string) => new Element(tag) } });
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
    return { hud, calls, state };
}
const asElement = (element: HTMLElement) => element as unknown as Element;
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

test('every in-flight state exposes skip and an honest motion status, with explicit entry after arrival', t => {
    const { hud, calls, state } = fixture(t);
    for (const [motionState, copy] of [['walking', 'a caminho'], ['boarding', 'Embarcando'], ['sailing', 'Navegando'], ['arriving', 'Desembarcando']] as const) {
        hud.update({ ...state, motionState: motionState as WorldMapMotionState, canEnter: false });
        assert.equal(hud.skipButton.hidden, false); assert.equal(hud.enterButton.hidden, true);
        assert.match(find(asElement(hud.root), 'world-map-status').textContent, new RegExp(copy));
        hud.skipButton.click(); assert.equal(calls.at(-1), 'skip');
    }
    assert.equal(calls.filter(value => value === 'skip').length, 4);
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
