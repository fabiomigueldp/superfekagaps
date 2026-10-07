import assert from 'node:assert/strict';
import test from 'node:test';
import { Input } from '../src/engine/Input';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

for (const dimension of ['width', 'height'] as const) {
    for (const phase of ['touchend', 'touchcancel'] as const) {
        test(`${phase} releases its canvas owner while layout has zero ${dimension}`, t => {
            const h = sceneLifecycleBrowser(t), input = new Input();
            t.after(() => input.dispose());
            const finger = { target: h.canvas, identifier: 1, clientX: 595, clientY: 330 };
            h.canvas.dispatch('touchstart', { touches: [finger], changedTouches: [finger] });
            input.update(); assert.equal(input.getState().jump, true);
            const rect = h.canvas.getBoundingClientRect();
            h.canvas.getBoundingClientRect = () => ({ ...rect, [dimension]: 0 });
            h.canvas.dispatch(phase, { touches: [], changedTouches: [finger] });
            input.update();
            assert.equal(input.getState().jump, false, 'Layout disappearance cannot swallow the owning finger’s terminal event.');
            assert.equal(input.getState().jumpReleased, phase === 'touchend');
            h.canvas.getBoundingClientRect = () => rect;
            input.update(); assert.equal(input.getState().jump, false);
            h.canvas.dispatch('touchmove', { touches: [finger], changedTouches: [finger] });
            input.update(); assert.equal(input.getState().jump, false, 'The finished gesture cannot re-arm when layout returns.');
            h.canvas.dispatch('touchstart', { touches: [finger], changedTouches: [finger] });
            input.update(); assert.equal(input.getState().jumpPressed, true);
        });
    }
}

test('layout-less cancellation discards only its own queued edge and preserves surviving owners', t => {
    const h = sceneLifecycleBrowser(t), input = new Input();
    t.after(() => input.dispose());
    const a = { target: h.canvas, identifier: 1, clientX: 595, clientY: 330 };
    const b = { ...a, identifier: 2 };
    const c = { ...a, identifier: 3, clientX: 320 };
    const source = input.createActionSource(); source.press('run');
    h.key('keydown', 'ArrowLeft');
    h.canvas.dispatch('touchstart', { touches: [a, b, c], changedTouches: [a, b, c] });
    const rect = h.canvas.getBoundingClientRect();
    h.canvas.getBoundingClientRect = () => ({ ...rect, width: 0 });
    // Even if remaining coordinates drift, no usable geometry exists to change their actions.
    h.canvas.dispatch('touchcancel', { touches: [{ ...b, clientX: 10 }, c], changedTouches: [a] });
    input.update();
    const surviving = input.getState();
    assert.equal(surviving.jump, true); assert.equal(surviving.jumpPressed, true);
    assert.equal(surviving.down, true); assert.equal(surviving.downPressed, true);
    assert.equal(surviving.left, true); assert.equal(surviving.run, true);
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [b, c] });
    input.update();
    assert.equal(input.getState().jump, false); assert.equal(input.getState().jumpReleased, false);
    assert.equal(input.getState().down, false);
    assert.equal(input.getState().left, true); assert.equal(input.getState().run, true);
});

test('zero-size cancellation clears queued jump/down/menu commands before their first update', t => {
    const h = sceneLifecycleBrowser(t), input = new Input();
    t.after(() => input.dispose());
    const fingers = [
        { target: h.canvas, identifier: 1, clientX: 595, clientY: 330 },
        { target: h.canvas, identifier: 2, clientX: 320, clientY: 330 },
        { target: h.canvas, identifier: 3, clientX: 320, clientY: 20 }
    ];
    h.canvas.dispatch('touchstart', { touches: fingers, changedTouches: fingers });
    const rect = h.canvas.getBoundingClientRect();
    h.canvas.getBoundingClientRect = () => ({ ...rect, width: 0, height: 0 });
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: fingers });
    input.update();
    assert.equal(input.getState().jumpPressed, false); assert.equal(input.getState().jumpReleased, false);
    assert.equal(input.getState().downPressed, false); assert.equal(input.consumePause(), false);
});

test('a new finger on layout-less canvas is not admitted when a surviving finger ends', t => {
    const h = sceneLifecycleBrowser(t), input = new Input();
    t.after(() => input.dispose());
    const old = { target: h.canvas, identifier: 1, clientX: 595, clientY: 330 };
    const fresh = { ...old, identifier: 2 };
    h.canvas.dispatch('touchstart', { touches: [old], changedTouches: [old] });
    input.update();
    const rect = h.canvas.getBoundingClientRect();
    h.canvas.getBoundingClientRect = () => ({ ...rect, height: 0 });
    h.canvas.dispatch('touchstart', { touches: [old, fresh], changedTouches: [fresh] });
    h.canvas.dispatch('touchend', { touches: [fresh], changedTouches: [old] });
    input.update(); assert.equal(input.getState().jump, false); assert.equal(input.getState().jumpReleased, true);
    h.canvas.getBoundingClientRect = () => rect;
    h.canvas.dispatch('touchmove', { touches: [fresh], changedTouches: [fresh] });
    input.update(); assert.equal(input.getState().jump, false); assert.equal(input.getState().jumpPressed, false);
});

test('a finger that left its control has no action restored by a zero-size terminal event', t => {
    const h = sceneLifecycleBrowser(t), input = new Input();
    t.after(() => input.dispose());
    const old = { target: h.canvas, identifier: 1, clientX: 595, clientY: 330 };
    h.canvas.dispatch('touchstart', { touches: [old], changedTouches: [old] });
    const outside = { ...old, clientX: 800 };
    h.canvas.dispatch('touchmove', { touches: [outside], changedTouches: [outside] });
    const rect = h.canvas.getBoundingClientRect();
    h.canvas.getBoundingClientRect = () => ({ ...rect, width: 0 });
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [outside] });
    input.update();
    assert.equal(input.getState().jump, false); assert.equal(input.getState().jumpPressed, false);
    assert.equal(input.getState().jumpReleased, false);
});
