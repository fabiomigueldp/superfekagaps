import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Input } from '../src/engine/Input';
import { StandardGamepad } from '../src/engine/StandardGamepad';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

function fixture(t: TestContext) {
    let dispose = () => {};
    const h = sceneLifecycleBrowser({ after: callback => t.after(() => { dispose(); (callback as () => void)(); }) });
    const pad = { index: 0, id: 'menu standard fixture', connected: true, mapping: 'standard', axes: [0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
    let pads = [pad], polls = 0;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => { polls++; return pads; } });
    Object.assign(h.document, { hasFocus: () => true });
    const input = new Input(h.canvas as unknown as HTMLCanvasElement), gamepad = new StandardGamepad(input);
    dispose = () => { gamepad.dispose(); input.dispose(); };
    const neutral = () => { pad.axes.fill(0); pad.buttons.forEach(button => { button.pressed = false; }); };
    return { ...h, pad, input, gamepad, neutral, button: (index: number, down = true) => { pad.buttons[index].pressed = down; },
        polls: () => polls, disconnect: () => { pads = []; h.window.dispatch('gamepaddisconnected', { gamepad: pad }); },
        reconnect: () => { pads = [pad]; h.window.dispatch('gamepadconnected', { gamepad: pad }); },
        step: (now = 0, owner: string | null = 'title:0') => gamepad.updateMenu(owner, now) };
}

test('menu directions have a 350/120 ms monotonic repeat with no catch-up burst', t => {
    const h = fixture(t); assert.equal(h.step(), null); h.button(13);
    assert.equal(h.step(10), 'down'); assert.equal(h.step(359), null); assert.equal(h.step(360), 'down');
    assert.equal(h.step(479), null); assert.equal(h.step(480), 'down');
    assert.equal(h.step(10_000), 'down'); assert.equal(h.step(10_000), null); assert.equal(h.step(10_119), null);
    assert.equal(h.step(10_120), 'down');
    h.button(13, false); assert.equal(h.step(10_121), null); h.button(13); assert.equal(h.step(10_122), 'down');
    assert.equal(h.frames.size, 0, 'Only the World host owns frame scheduling');
});

for (const [index, command] of [[0, 'confirm'], [1, 'back'], [2, 'regions'], [3, 'overview'], [9, 'pause']] as const) {
    test(`${command} consumes the gesture and cannot cross page/layer identities`, t => {
        const h = fixture(t); h.button(index);
        assert.equal(h.step(), null); assert.equal(h.step(500), null);
        h.neutral(); h.step(600); h.button(index); assert.equal(h.step(601), command);
        for (const owner of ['intro:0', 'intro:1', 'gallery:7', 'map:island:idle', 'map:regions:idle', 'map:island:travel', 'map:island:idle'])
            assert.equal(h.step(1000, owner), null, owner);
        h.button(index, false); h.pad.axes[1] = .3; h.step(1100, 'map:island:idle'); h.button(index);
        assert.equal(h.step(1101, 'map:island:idle'), null, 'An unreleased stick is not a neutral handoff');
        h.neutral(); h.step(1200, 'map:island:idle'); h.button(index); assert.equal(h.step(1201, 'map:island:idle'), command);
        h.input.update(); assert.ok(Object.values(h.input.getState()).every(value => value === false));
    });
}

test('raw opposed controls never arm, D-pad overrides analog, and action chords do nothing', t => {
    const h = fixture(t); h.button(14); h.button(15); assert.equal(h.step(), null);
    h.button(14, false); assert.equal(h.step(1), null);
    h.neutral(); h.step(2); h.pad.axes[0] = 1; h.button(14); assert.equal(h.step(3), 'left');
    h.button(15); assert.equal(h.step(400), null); h.button(14, false); h.button(15, false);
    assert.equal(h.step(401), 'right', 'Releasing D-pad uses the currently held stick');
    h.button(0); h.button(1); assert.equal(h.step(402), null);
    h.button(1, false); assert.equal(h.step(403), null, 'A conflicting action chord cannot degrade into an activation');
    h.neutral(); h.step(404); h.button(0); h.button(13); assert.equal(h.step(405), 'confirm', 'One discrete action takes priority over navigation');
});

for (const [axis, positive, negative] of [[0, 'right', 'left'], [1, 'down', 'up']] as const) {
    test(`axis ${axis} hysteresis releases across zero without repeating the opposite direction`, t => {
        const h = fixture(t); h.step(); h.pad.axes[axis] = .46; assert.equal(h.step(1), positive);
        h.pad.axes[axis] = .3; assert.equal(h.step(351), positive);
        h.pad.axes[axis] = -.35; assert.equal(h.step(471), null);
        h.pad.axes[axis] = -.46; assert.equal(h.step(472), negative);
        h.pad.axes[axis] = .35; assert.equal(h.step(822), null);
        h.pad.axes[axis] = .25; assert.equal(h.step(823), null);
        h.pad.axes[axis] = NaN; assert.equal(h.step(824), null);
        h.pad.axes[axis] = Infinity; assert.equal(h.step(825), null);
    });
}

test('owner suspension and disconnect clear repeats without cancelling keyboard/touch owners', t => {
    const h = fixture(t); h.step(); h.button(15); assert.equal(h.step(1), 'right');
    h.key('keydown', 'w'); const touch = h.input.createActionSource(); touch.press('run');
    const polls = h.polls(); assert.equal(h.step(1000, null), null); assert.equal(h.polls(), polls);
    assert.equal(h.step(1001), null); h.neutral(); h.step(1002); h.button(15); assert.equal(h.step(1003), 'right');
    h.disconnect(); h.input.update(); assert.equal(h.input.getState().jump, true); assert.equal(h.input.getState().run, true);
    assert.equal(h.input.getState().jumpReleased, false); h.reconnect(); assert.equal(h.step(2000), null);
    h.neutral(); h.step(2001); h.button(15); assert.equal(h.step(2002), 'right');
    touch.dispose();
});

test('blur/pagehide/visibility/reset discard pending repeat and require neutral on return', t => {
    const h = fixture(t);
    for (const boundary of ['blur', 'pagehide', 'hidden', 'reset']) {
        h.neutral(); h.step(); h.button(13); assert.equal(h.step(1), 'down');
        if (boundary === 'hidden') { h.document.hidden = true; h.document.dispatch('visibilitychange'); }
        else if (boundary === 'reset') h.input.reset();
        else h.window.dispatch(boundary);
        assert.equal(h.step(1000), null);
        if (boundary === 'hidden') { h.document.hidden = false; h.document.dispatch('visibilitychange'); }
        else if (boundary === 'blur') h.window.dispatch('focus');
        else if (boundary === 'pagehide') h.window.dispatch('pageshow');
        assert.equal(h.step(1001), null); h.neutral(); h.step(1002); h.button(13); assert.equal(h.step(1003), 'down');
    }
});
