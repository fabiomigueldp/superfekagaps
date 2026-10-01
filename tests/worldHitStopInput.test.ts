import assert from 'node:assert/strict';
import test from 'node:test';
import { secretCannonHarness, DT } from './helpers/worldSecretCannonHarness';
import { Input } from '../src/engine/Input';
import { GroundPoundState, type InputState } from '../src/types';

function harness() {
    (globalThis as any).window = { addEventListener() {}, requestAnimationFrame() {} };
    (globalThis as any).document = { addEventListener() {}, getElementById() { return { addEventListener() {} }; } };
    const h = secretCannonHarness(), g = h.game;
    g.input = new Input();
    g.player.data.position = { x: 1600, y: 80 };
    g.player.data.velocity = { x: 0, y: -7 };
    g.player.data.isGrounded = false;
    g.player.data.respawnRevealTimer = 0;
    const inputs: InputState[] = [];
    const update = g.player.update.bind(g.player);
    g.player.update = (dt: number, input: InputState, level: any) => { inputs.push({ ...input }); return update(dt, input, level); };
    const press = (code: string) => { g.input.pressedKeys.add(code); g.input.refreshHeldActions(); };
    const release = (code: string) => { g.input.pressedKeys.delete(code); g.input.refreshHeldActions(); };
    const freeze = () => { g.hitStop = 70; };
    const thaw = () => { while (g.hitStop > 0) g.update(DT); g.update(DT); };
    return { ...h, g, inputs, press, release, freeze, thaw };
}

test('down held during hitstop starts ground pound on first playable step only', () => {
    const h = harness(); h.freeze(); h.press('ArrowDown');
    h.g.update(DT);
    assert.equal(h.inputs.length, 0);
    h.thaw();
    assert.equal(h.inputs[0].downPressed, true);
    assert.equal(h.g.player.data.groundPoundState, GroundPoundState.WINDUP);
    h.g.update(DT);
    assert.equal(h.inputs[1].downPressed, false);
    assert.equal(h.inputs[1].down, true);
});

test('short down tap during hitstop survives release without holding down', () => {
    const h = harness(); h.freeze(); h.press('ArrowDown'); h.release('ArrowDown'); h.thaw();
    assert.equal(h.inputs[0].downPressed, true);
    assert.equal(h.inputs[0].down, false);
    assert.equal(h.g.player.data.groundPoundState, GroundPoundState.WINDUP);
});

test('jump press and release survive hitstop once, with current held and movement state', () => {
    const h = harness(); h.freeze(); h.press('Space'); h.press('ArrowRight'); h.g.update(DT);
    h.release('Space'); h.release('ArrowRight'); h.thaw();
    assert.equal(h.inputs[0].jumpPressed, true);
    assert.equal(h.inputs[0].jumpReleased, true);
    assert.equal(h.inputs[0].jump, false);
    assert.equal(h.inputs[0].right, false);
    h.g.update(DT);
    assert.equal(h.inputs[1].jumpPressed, false);
    assert.equal(h.inputs[1].jumpReleased, false);
});

test('held buffered jump launches and released buffered jump retains short-hop cut', () => {
    function jump(released: boolean) {
        const h = harness(); h.g.player.data.isGrounded = true; h.g.player.data.velocity.y = 0;
        h.freeze(); h.press('Space'); h.g.update(DT);
        if (released) h.release('Space');
        h.thaw();
        assert.equal(h.g.player.data.isGrounded, false);
        assert.ok(h.g.player.data.velocity.y < 0);
        assert.equal(h.inputs[0].jump, !released);
        return h.g.player.data.velocity.y;
    }
    assert.ok(jump(false) < jump(true));
});

test('release of an existing jump during hitstop is delivered once', () => {
    const h = harness(); h.press('Space'); h.g.update(DT); h.freeze(); h.release('Space'); h.thaw();
    assert.equal(h.inputs[1].jumpPressed, false);
    assert.equal(h.inputs[1].jumpReleased, true);
    h.g.update(DT); assert.equal(h.inputs[2].jumpReleased, false);
});

test('mute and pause are immediate; pause/resume discards buffered attacks', () => {
    const h = harness(); let toggles = 0; h.g.audio.toggle = () => toggles++;
    h.freeze(); h.press('ArrowDown'); h.g.input.pendingMute = true; h.g.update(DT);
    assert.equal(toggles, 1); assert.ok(h.g.hitStopInput.downPressed);
    h.g.input.pendingPause = true; h.g.update(DT);
    assert.equal(h.g.state, 'paused'); assert.equal(h.inputs.length, 0); assert.equal(h.g.hitStopInput, null);
    h.g.resume(); h.thaw();
    assert.equal(h.inputs[0].downPressed, false);
    assert.equal(h.g.player.data.groundPoundState, GroundPoundState.NONE);
    assert.equal(toggles, 1);
});

for (const transition of ['restart', 'load', 'map', 'death'] as const) {
    test(`${transition} discards buffered gameplay edges`, () => {
        const h = harness(); h.freeze(); h.press('ArrowDown'); h.g.update(DT);
        assert.ok(h.g.hitStopInput.downPressed);
        if (transition === 'restart') h.g.restart();
        else if (transition === 'load') h.g.load('5-3');
        else if (transition === 'map') h.g.toMap();
        else { h.g.player.die('hit'); h.g.beginDeathFeedback(); }
        assert.equal(h.g.hitStopInput, null);
        if (transition === 'death') { h.g.update(DT); assert.equal(h.g.hitStopInput, null); }
        if (transition === 'restart') {
            h.g.player.data.respawnRevealTimer = 0;
            h.g.update(DT);
            assert.equal(h.g.player.data.groundPoundState, GroundPoundState.NONE);
        }
    });
}
