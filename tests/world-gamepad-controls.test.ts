import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { Input } from '../src/engine/Input';
import { StandardGamepad, type GamepadMode } from '../src/engine/StandardGamepad';
import { WorldGame } from '../src/adventure/WorldGame';
import { WorldControlsHelp } from '../src/adventure/WorldControlsHelp';
import { FACTORY_SALON } from '../src/adventure/factory/FactorySalon';
import { GroundPoundState } from '../src/types';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const STEP = 1000 / 60;
function standardPad(index = 0, id = 'Standard fixture') {
    return { index, id, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
}
type Pad = ReturnType<typeof standardPad>;

/** Real Input/World paths; only browser and device boundaries are simulated.
 * This suite is not physical-controller or browser Gamepad API verification. */
function devices(t: TestContext) {
    const owned: Array<() => void> = [];
    const h = sceneLifecycleBrowser({ after: callback => t.after(() => {
        owned.reverse().forEach(dispose => dispose()); (callback as () => void)();
    }) });
    const pad = standardPad(); let pads: Array<Pad | null> = [pad], polls = 0, focused = true;
    const api = { read: () => pads };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => { polls++; return api.read(); } });
    Object.assign(h.document, { hasFocus: () => focused });
    const button = (index: number, pressed = true, target = pad) => {
        target.buttons[index].pressed = pressed; target.buttons[index].value = pressed ? 1 : 0;
    };
    const neutral = (target = pad) => { target.axes.fill(0); target.buttons.forEach(b => { b.pressed = false; b.value = 0; }); };
    const focus = (value: boolean) => { focused = value; h.window.dispatch(value ? 'focus' : 'blur'); };
    const hidden = (value: boolean) => { h.document.hidden = value; h.document.dispatch('visibilitychange'); };
    return { ...h, pad, api, own: (dispose: () => void) => owned.push(dispose), button, neutral, focus, hidden,
        polls: () => polls, pads: (value: Array<Pad | null>) => { pads = value; }, focused: (value: boolean) => { focused = value; } };
}

function inputFixture(t: TestContext) {
    const h = devices(t), input = new Input(h.canvas as unknown as HTMLCanvasElement), adapter = new StandardGamepad(input);
    h.own(() => { adapter.dispose(); input.dispose(); });
    const step = (mode: GamepadMode = 'playing') => { const pause = adapter.update(mode); input.update(); return pause; };
    return { ...h, input, adapter, step };
}

function worldFixture(t: TestContext) {
    const h = devices(t);
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const decorate = (element: LifecycleElement) => {
        Object.defineProperty(element, 'isConnected', { get: () => element === h.body || element.parent !== null });
        element.focus = () => { doc.activeElement = element; element.dispatch('focus'); };
        Object.assign(element, { inert: false, open: false,
            showModal() { (element as unknown as HTMLDialogElement).open = true; },
            close() { (element as unknown as HTMLDialogElement).open = false; element.dispatch('close'); } });
        return element;
    };
    const create = doc.createElement; doc.createElement = tag => decorate(create(tag));
    decorate(h.canvas); decorate(h.body);
    const writes: string[] = [];
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: () => null, setItem: (_key: string, value: string) => writes.push(value)
    } });
    const make = <T extends WorldGame>(Scene: new (canvas: HTMLCanvasElement) => T) => {
        const game = new Scene(h.canvas as unknown as HTMLCanvasElement); h.own(() => game.dispose()); h.canvas.focus(); return game;
    };
    const game = make(WorldGame); game.enableGamepadControls();
    const step = () => game.update(STEP);
    const play = () => { game.load('1-1'); h.neutral(); step(); };
    return { ...h, game, make, writes, step, play };
}

test('stick deadzone, D-pad priority and jump/run/down use existing owned actions', t => {
    const h = inputFixture(t); h.step();
    for (const axis of [-.25, 0, .25, NaN, Infinity]) {
        h.pad.axes[0] = axis; h.step();
        assert.equal(h.input.getState().left, false); assert.equal(h.input.getState().right, false);
    }
    h.pad.axes[0] = .26; h.step(); assert.equal(h.input.getState().right, true);
    h.pad.axes[0] = -.26; h.step(); assert.equal(h.input.getState().left, true);
    h.button(15); h.step(); assert.equal(h.input.getState().right, true, 'D-pad overrides opposing stick');
    h.button(14); h.step(); assert.equal(h.input.getState().left, false); assert.equal(h.input.getState().right, false);
    h.neutral(); h.pad.axes[1] = 1; h.step(); assert.equal(h.input.getState().down, false, 'Vertical stick never attacks');
    h.button(0); h.button(2); h.button(13); h.step();
    let state = h.input.getState();
    assert.equal(state.jump, true); assert.equal(state.jumpPressed, true); assert.equal(state.run, true); assert.equal(state.downPressed, true);
    h.step(); state = h.input.getState(); assert.equal(state.jumpPressed, false); assert.equal(state.downPressed, false);
    h.neutral(); h.step(); state = h.input.getState();
    assert.equal(state.jump, false); assert.equal(state.jumpReleased, true); assert.equal(state.run, false); assert.equal(state.down, false);
    h.step(); assert.equal(h.input.getState().jumpReleased, false);
});

for (const held of ['jump', 'start', 'opposed-dpad', 'stick-and-dpad'] as const) {
    test(`first connection never arms from raw held ${held}`, t => {
        const h = inputFixture(t);
        if (held === 'jump') h.button(0);
        if (held === 'start') h.button(9);
        if (held === 'opposed-dpad') { h.button(14); h.button(15); }
        if (held === 'stick-and-dpad') { h.pad.axes[0] = -1; h.button(15); }
        for (let i = 0; i < 3; i++) assert.equal(h.step(), false);
        assert.ok(Object.values(h.input.getState()).every(value => value === false));
        h.button(14, false); h.button(15, false); h.button(0); h.pad.axes[0] = 0;
        assert.equal(h.step(), false); assert.equal(h.input.getState().jumpPressed, false, 'Switching held controls is not a neutral sample');
        h.neutral(); h.step(); h.button(0); h.step(); assert.equal(h.input.getState().jumpPressed, true);
    });
}

test('keyboard and touch owners survive controller cancellation with no false jump release', t => {
    const h = inputFixture(t); h.step(); h.pad.axes[0] = -1; h.button(0); h.button(2); h.step();
    const touch = h.input.createActionSource(); touch.press('down');
    h.key('keydown', 'd'); h.key('keydown', 'w'); h.key('keydown', 'x'); h.step();
    assert.equal(h.input.getState().right, true, 'Existing keyboard priority remains unchanged');
    h.window.dispatch('gamepaddisconnected', { gamepad: h.pad }); h.pads([]); h.step();
    const state = h.input.getState();
    assert.equal(state.right, true); assert.equal(state.left, false); assert.equal(state.run, true);
    assert.equal(state.jump, true); assert.equal(state.jumpReleased, false); assert.equal(state.down, true);
    h.key('keyup', 'w'); h.step(); assert.equal(h.input.getState().jumpReleased, true);
    touch.dispose();
});

test('an actual canvas touch and keyboard jump survive unsampled controller cancellation', t => {
    const h = inputFixture(t); h.step();
    const finger = { identifier: 1, target: h.canvas, clientX: 595, clientY: 330 };
    h.canvas.dispatch('touchstart', { touches: [finger], changedTouches: [finger] });
    h.key('keydown', 'd'); h.button(0); h.adapter.update('playing');
    h.window.dispatch('gamepaddisconnected', { gamepad: h.pad }); h.pads([]); h.input.update();
    assert.equal(h.input.getState().jumpPressed, true); assert.equal(h.input.getState().jump, true);
    assert.equal(h.input.getState().right, true); assert.equal(h.input.getState().jumpReleased, false);
    h.canvas.dispatch('touchend', { touches: [], changedTouches: [finger] }); h.input.update();
    assert.equal(h.input.getState().jumpReleased, true);
});

test('disconnect before Input samples discards every controller tap rather than committing it', t => {
    const h = inputFixture(t); h.step(); h.button(0); h.button(2); h.button(13); h.pad.axes[0] = 1; h.adapter.update('playing');
    h.window.dispatch('gamepaddisconnected', { gamepad: h.pad }); h.pads([]); h.input.update();
    assert.ok(Object.values(h.input.getState()).every(value => value === false));
});

for (const loss of ['missing', 'disconnected', 'mapping', 'throw', 'api-absent'] as const) {
    test(`${loss} device/API cancels held controller actions and reconnect requires neutral`, t => {
        const h = inputFixture(t); h.step(); h.button(0); h.pad.axes[0] = 1; h.step();
        if (loss === 'missing') h.pads([null]);
        if (loss === 'disconnected') h.pad.connected = false;
        if (loss === 'mapping') h.pad.mapping = '';
        if (loss === 'throw') h.api.read = () => { throw Error('Blocked Gamepad API'); };
        if (loss === 'api-absent') Reflect.deleteProperty(navigator, 'getGamepads');
        h.step(); assert.ok(Object.values(h.input.getState()).every(value => value === false));
        h.pads([h.pad]); h.pad.connected = true; h.pad.mapping = 'standard'; h.api.read = () => [h.pad];
        Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => h.api.read() });
        h.step(); assert.equal(h.input.getState().jump, false); assert.equal(h.input.getState().right, false);
        h.neutral(); h.step(); h.button(0); h.step(); assert.equal(h.input.getState().jumpPressed, true);
    });
}

test('selection stays on the current controller and replacement cannot inherit held actions', t => {
    const h = inputFixture(t), second = standardPad(1, 'Second'); h.pads([null, second]); h.step();
    h.button(0, true, h.pad); h.pads([h.pad, second]); h.step();
    assert.equal(h.input.getState().jump, false, 'Adding a lower-index controller does not steal ownership');
    h.button(2, true, second); h.step(); assert.equal(h.input.getState().run, true);
    second.connected = false; h.step(); assert.equal(h.input.getState().run, false); assert.equal(h.input.getState().jump, false);
    h.neutral(); h.step(); h.button(0); h.step(); assert.equal(h.input.getState().jump, true);
    // A same-id/index reconnect event between polls still invalidates ownership.
    h.window.dispatch('gamepadconnected', { gamepad: h.pad }); h.step(); assert.equal(h.input.getState().jump, false);
    h.neutral(); h.step(); h.button(0); h.step(); assert.equal(h.input.getState().jumpPressed, true);
});

for (const boundary of ['blur', 'pagehide', 'hidden', 'focus-race', 'reset', 'orientationchange'] as const) {
    test(`${boundary} cancels input and held controls cannot reactivate on return`, t => {
        const h = inputFixture(t); h.step(); h.button(0); h.pad.axes[0] = 1; h.step();
        if (boundary === 'blur') h.focus(false);
        if (boundary === 'pagehide') h.window.dispatch('pagehide');
        if (boundary === 'hidden') h.hidden(true);
        if (boundary === 'focus-race') h.focused(false);
        if (boundary === 'reset') h.input.reset();
        if (boundary === 'orientationchange') h.window.dispatch('orientationchange');
        const polls = h.polls(); h.step();
        assert.ok(Object.values(h.input.getState()).every(value => value === false));
        if (!['reset', 'orientationchange'].includes(boundary)) assert.equal(h.polls(), polls, 'No polling while unavailable');
        if (boundary === 'blur') h.focus(true);
        if (boundary === 'pagehide') h.window.dispatch('pageshow');
        if (boundary === 'hidden') h.hidden(false);
        if (boundary === 'focus-race') h.focused(true);
        h.step(); assert.equal(h.input.getState().jump, false); assert.equal(h.input.getState().right, false);
        h.neutral(); h.step(); h.button(0); h.step(); assert.equal(h.input.getState().jumpPressed, true);
    });
}

test('ordinary pause/resume uses Start edges and requires a full neutral poll between toggles', t => {
    const h = worldFixture(t); h.play(); const save = structuredClone(h.game.store.save), writes = h.writes.length;
    h.button(9); h.step(); assert.equal(h.game.state, 'paused');
    for (let i = 0; i < 6; i++) h.step(); assert.equal(h.game.state, 'paused');
    h.button(9, false); h.button(0); h.step(); h.button(9); h.step();
    assert.equal(h.game.state, 'paused', 'Jump held during release is not neutral');
    h.neutral(); h.step(); h.button(9); h.step(); assert.equal(h.game.state, 'playing');
    h.button(0); for (let i = 0; i < 3; i++) h.step();
    assert.equal(h.game.state, 'playing'); assert.equal(h.game.input.getState().jumpPressed, false);
    h.neutral(); h.step(); h.button(0); h.step(); assert.equal(h.game.input.getState().jumpPressed, true);
    assert.deepEqual(h.game.store.save, save); assert.equal(h.writes.length, writes);
});

test('immediate keyboard pause and resume invalidate a held controller between samples', t => {
    const h = worldFixture(t); h.play(); h.button(0); h.step();
    const internal = h.game as unknown as { pause(): void; resume(): void };
    internal.pause(); internal.resume(); h.step();
    assert.equal(h.game.input.getState().jump, false); assert.equal(h.game.input.getState().jumpPressed, false);
    h.neutral(); h.step(); h.button(0); h.step(); assert.equal(h.game.input.getState().jumpPressed, true);
});

for (const screen of ['dialogue'] as const) {
    test(`${screen} never polls a controller or receives menu activation`, t => {
        const h = worldFixture(t); h.play();
        (h.game as unknown as { change(screen: string): void }).change(screen);
        const save = structuredClone(h.game.store.save), writes = h.writes.length, polls = h.polls();
        h.button(0); h.button(9); h.button(13); h.pad.axes[0] = 1;
        for (let i = 0; i < 3; i++) h.step();
        assert.equal(h.game.state, screen); assert.equal(h.polls(), polls);
        assert.ok(Object.values(h.game.input.getState()).every(value => value === false));
        assert.deepEqual(h.game.store.save, save); assert.equal(h.writes.length, writes);
        h.game.load('1-1'); h.step(); assert.equal(h.game.input.getState().jumpPressed, false); assert.equal(h.game.state, 'playing');
    });
}

test('help, experimental hub and flight ownership suppress controller polling and activation', t => {
    const h = worldFixture(t); h.play();
    const internal = h.game as unknown as { change(screen: string): void; controlsHelp: WorldControlsHelp;
        experimentalHub?: { isOpen: boolean }; flightCleanup?: () => void };
    internal.change('settings'); internal.controlsHelp.open();
    const save = structuredClone(h.game.store.save), polls = h.polls();
    h.button(9); h.button(0); h.step();
    assert.equal(internal.controlsHelp.isOpen, true); assert.equal(h.game.state, 'settings'); assert.equal(h.polls(), polls);
    internal.controlsHelp.close();
    // These host flags are browser-overlay boundaries; no overlay code is substituted for Input.
    internal.experimentalHub = { isOpen: true }; h.step(); assert.equal(h.polls(), polls); internal.experimentalHub = undefined;
    internal.change('paused'); internal.flightCleanup = () => {}; h.step();
    assert.equal(h.game.state, 'paused'); assert.equal(h.polls(), polls); internal.flightCleanup = undefined;
    h.step(); assert.equal(h.game.state, 'paused', 'Held Start cannot resume on return from the flight owner');
    assert.deepEqual(h.game.store.save, save);
});

test('sampled controller edges already committed to hitstop survive disconnect with keyboard edges', t => {
    const h = worldFixture(t); h.play();
    const internal = h.game as unknown as { hitStop: number; hitStopInput: { jumpPressed: boolean; downPressed: boolean } | null };
    h.game.player.data.position = { x: 1600, y: 80 }; h.game.player.data.velocity = { x: 0, y: -7 };
    h.game.player.data.isGrounded = false; h.game.player.data.respawnRevealTimer = 0;
    internal.hitStop = 70; h.button(13); h.key('keydown', 'w'); h.step();
    assert.equal(internal.hitStopInput?.downPressed, true); assert.equal(internal.hitStopInput?.jumpPressed, true);
    h.window.dispatch('gamepaddisconnected', { gamepad: h.pad }); h.pads([]); h.key('keyup', 'w');
    while (internal.hitStop > 0) h.step(); h.step();
    assert.equal(h.game.player.data.groundPoundState, GroundPoundState.WINDUP);
    assert.equal(h.game.input.getState().down, false); assert.equal(h.game.input.getState().downPressed, false);
    assert.equal(internal.hitStopInput, null, 'The host consumes its shared buffer once, regardless of device connection');
});

test('actual FactoryCampaign salon suspends parent gamepad and receives none of its controls', t => {
    const h = worldFixture(t); h.game.dispose();
    const require = createRequire(import.meta.url), css = require.extensions['.css']; require.extensions['.css'] = () => {};
    let FactoryCampaign: typeof import('../src/adventure/factory/FactoryCampaign').FactoryCampaign;
    try { ({ FactoryCampaign } = require('../src/adventure/factory/FactoryCampaign')); }
    finally { if (css) require.extensions['.css'] = css; else delete require.extensions['.css']; }
    const game = h.make(FactoryCampaign); game.enableGamepadControls(); game.load(FACTORY_SALON.stage);
    game.update(STEP); h.button(0); game.update(STEP);
    game.player.data.position = { x: FACTORY_SALON.door.x, y: FACTORY_SALON.support.y - game.player.data.height };
    game.player.data.isGrounded = true; game.enterSalon();
    const salon = (game as unknown as { salon: import('../src/adventure/factory/FactorySalonSession').FactorySalonSession }).salon;
    assert.ok(salon); const polls = h.polls(), save = structuredClone(game.store.save);
    h.button(9); h.pad.axes[0] = 1;
    for (let i = 0; i < 4; i++) game.update(STEP);
    assert.equal(h.polls(), polls); assert.equal(game.state, 'paused'); assert.equal(salon.state, 'playing');
    assert.ok(Object.values(salon.input.getState()).every(value => value === false));
    assert.ok(Object.values(game.input.getState()).every(value => value === false));
    assert.deepEqual(game.store.save, save);
    game.leaveSalon(); game.update(STEP); assert.equal(game.state, 'playing');
    assert.equal(game.input.getState().jump, false); assert.equal(game.input.getState().right, false);
    h.neutral(); game.update(STEP); h.button(0); game.update(STEP); assert.equal(game.input.getState().jumpPressed, true);
});

test('gamepad enable/dispose is idempotent, optional hosts remain opt-out, and no extra frame chain is owned', t => {
    const h = worldFixture(t); h.play(); const count = h.listenerCount();
    h.game.enableGamepadControls(); assert.equal(h.listenerCount(), count);
    assert.equal(h.frames.size, 0, 'Only the host may own requestAnimationFrame');
    h.game.dispose(); h.game.dispose(); h.game.enableGamepadControls();
    assert.equal(h.listenerCount(), 0); const polls = h.polls(); h.game.update(STEP); assert.equal(h.polls(), polls);
    const optional = h.make(WorldGame); optional.load('1-1'); h.button(0); h.button(9); optional.update(STEP);
    assert.equal(optional.state, 'playing'); assert.equal(h.polls(), polls); assert.equal(optional.input.getState().jump, false);
    optional.dispose(); assert.equal(h.listenerCount(), 0);
});

test('disposing only the adapter cancels its unsampled jump and preserves the keyboard owner', t => {
    const h = inputFixture(t); h.step(); const baseline = h.listenerCount();
    h.button(0); h.adapter.update('playing'); h.key('keydown', 'd'); h.adapter.dispose(); h.adapter.dispose(); h.input.update();
    assert.equal(h.input.getState().jumpPressed, false); assert.equal(h.input.getState().right, true);
    assert.equal(h.listenerCount(), baseline - 7); const polls = h.polls();
    h.adapter.update('playing'); h.window.dispatch('focus'); h.window.dispatch('pageshow');
    assert.equal(h.polls(), polls); h.input.dispose(); assert.equal(h.listenerCount(), 0);
});
