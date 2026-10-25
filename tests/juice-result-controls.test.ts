import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import type { GamepadMenuCommand } from '../src/engine/GamepadDevice';

/** Execute the real page wiring, standalone routing and DOM menu. The scene,
 * dialog and browser boundaries are modeled; native device coverage is separate. */
function fixture() {
    let active: Element | null = null;
    const nav = new EventTarget(), window = new EventTarget();
    class Element extends EventTarget {
        hidden = false; disabled = false; textContent = ''; style = {}; parent = nav;
        readonly attributes = new Map<string, string>();
        readonly classList = { add() {}, remove() {} };
        constructor(readonly id: string, readonly x = 0) { super(); }
        focus() { active = this; }
        click() { this.dispatchEvent(new Event('click')); }
        setAttribute(name: string, value: string) { this.attributes.set(name, value); }
        getAttribute(name: string) { return this.attributes.get(name) ?? null; }
        closest(selector: string) { return selector === 'nav' ? this.parent : this.hidden ? this : null; }
        matches() { return this.disabled; }
        getClientRects() { return [{}]; }
        getBoundingClientRect() { return { x: this.x, y: 0, width: 44, height: 44 }; }
        scrollIntoView() {}
    }
    const ids = ['game-canvas', 'lab-status', 'lab-pause', 'lab-present', 'lab-skip', 'lab-replay', 'lab-retry', 'lab-exit'];
    const elements = new Map(ids.map((id, i) => [id, new Element(id, i * 50)]));
    const controls = ids.slice(2).map(id => elements.get(id)!);
    Object.assign(nav, { querySelectorAll: () => controls, getBoundingClientRect: () => ({ height: 60 }) });
    const document = Object.assign(new EventTarget(), {
        hidden: false, body: { style: {} }, get activeElement() { return active; },
        getElementById: (id: string) => elements.get(id), createElement: (tag: string) => new Element(tag),
        querySelector: () => nav,
    });
    Object.defineProperty(document, 'activeElement', { get: () => active });
    type Host = { owner(): string | null; control(command: GamepadMenuCommand): void };
    let game!: Scene;
    const cleanups: Array<() => void> = [], frames = new Map<number, () => void>();
    let frame = 0, pauses = 0, resets = 0;
    class Scene {
        state = 'playing'; labMode: 'intro' | 'combat' | 'result' = 'intro'; isDisposed = false;
        player = { data: { isDead: false } }; intro = null;
        epilogue = { frame: null, skip() {} }; host!: Host;
        input = { reset: () => { resets++; }, suspendCanvasTouchControls: () => () => {} };
        constructor() { game = this; }
        addCleanup(cleanup: () => void) { cleanups.push(cleanup); }
        enableGamepadControls(host: Host) { this.host = host; }
        toggleLabPause() { pauses++; this.state = this.state === 'paused' ? 'playing' : 'paused'; }
        load() { this.labMode = 'combat'; this.state = 'playing'; }
        replayIntro() { this.labMode = 'intro'; this.state = 'playing'; }
        skipIntro() { this.labMode = 'combat'; }
        presentIntro() {}
        start() {}
        dispose() { this.isDisposed = true; cleanups.forEach(cleanup => cleanup()); }
    }
    class Help {
        isOpen = false;
        constructor(_canvas: Element, readonly host: { canOpen(): boolean; resetInput(): void }) {}
        canControl() { return this.isOpen && this.host.canOpen(); }
        open() { if (this.host.canOpen()) { this.host.resetInput(); this.isOpen = true; } }
        control(command: string) { if (['back', 'guide', 'pause'].includes(command)) this.isOpen = false; }
        dispose() { this.isOpen = false; }
    }
    const globals = { document, window, Event, AbortController, HTMLElement: Element,
        HTMLSelectElement: class {}, HTMLInputElement: class {}, HTMLTextAreaElement: class {},
        getComputedStyle: () => ({ visibility: 'visible' }), innerWidth: 640, innerHeight: 440, performance,
        requestAnimationFrame: (callback: () => void) => { frames.set(++frame, callback); return frame; },
        cancelAnimationFrame: (id: number) => frames.delete(id) };
    function module(path: string, dependencies: Record<string, unknown>) {
        const exports: Record<string, unknown> = {};
        const source = readFileSync(new URL(path, import.meta.url), 'utf8');
        const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
        runInNewContext(code, { ...globals, exports, require: (name: string) => {
            if (name.endsWith('.css')) return {};
            assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
            return dependencies[name];
        } }, { filename: path });
        return exports;
    }
    const dom = module('../src/engine/DomGamepadMenu.ts', { './GamepadDevice': {} });
    const standalone = module('../src/adventure/StandaloneControls.ts', {
        './WorldControlsHelp': { WorldControlsHelp: Help }, '../engine/DomGamepadMenu': dom,
    });
    module('../src/juice-lab.ts', {
        './adventure/StandaloneControls': standalone,
        './adventure/experimental/JuiceLabHost': { JuiceLabHost: Scene },
        './adventure/experimental/JuiceLabToolbar': { LabToolbarAction: class { setLabel() {} } },
    });
    const refresh = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); };
    return { game, elements, refresh, focus: () => active?.id, pauses: () => pauses, resets: () => resets,
        result() { game.labMode = 'result'; refresh(); } };
}

test('Juice Lab result routes directional and confirm commands to the existing toolbar', () => {
    const h = fixture(); h.result();
    assert.equal(h.game.state, 'playing');
    assert.equal(h.game.host.owner(), 'standalone:playing:true');
    h.game.host.control('right'); assert.equal(h.focus(), 'lab-pause');
    h.game.host.control('right'); assert.equal(h.focus(), 'lab-replay');
    h.game.host.control('right'); assert.equal(h.focus(), 'lab-retry');
    h.game.host.control('back'); assert.equal(h.focus(), 'lab-exit');
    assert.equal(h.pauses(), 0);
    h.game.dispose(); assert.equal(h.game.host.owner(), null);
});

test('result help opens without pausing and routes back to the result owner', () => {
    const h = fixture(); h.result();
    h.game.host.control('guide');
    assert.equal(h.game.state, 'playing'); assert.equal(h.pauses(), 0);
    assert.equal(h.game.host.owner(), 'help'); assert.equal(h.resets(), 1);
    h.game.host.control('back'); assert.equal(h.game.host.owner(), 'standalone:playing:true');
    h.game.host.control('pause'); assert.equal(h.focus(), 'lab-exit'); assert.equal(h.pauses(), 0);
    h.game.dispose();
});

for (const [button, mode] of [['lab-retry', 'combat'], ['lab-replay', 'intro']] as const) {
    test(`${button} confirm retires result routing immediately`, () => {
        const h = fixture(); h.result();
        assert.equal(h.game.host.owner(), 'standalone:playing:true');
        h.elements.get(button)!.focus(); h.game.host.control('confirm');
        assert.equal(h.game.labMode, mode); assert.equal(h.game.host.owner(), 'playing');
        assert.equal(h.focus(), 'game-canvas');
        h.game.host.control('guide'); assert.equal(h.game.state, 'paused'); assert.equal(h.pauses(), 1);
        assert.equal(h.game.host.owner(), 'help'); h.game.host.control('back');
        assert.equal(h.game.host.owner(), 'standalone:paused:false');
        h.game.dispose();
    });
}
