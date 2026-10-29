import assert from 'node:assert/strict';
import test from 'node:test';
import { GamepadDevice, selectGamepad } from '../src/engine/GamepadDevice';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const CAPTURE = '[data-control-capture="true"]';

test('capture query excludes detached nodes, text and nonmatching attribute values', t => {
    const h = sceneLifecycleBrowser(t), capture = h.document.createElement('details');
    capture.dataset.controlCapture = 'true';
    assert.equal(h.document.querySelector(CAPTURE), null);
    h.body.append(h.document.createTextNode('<details data-control-capture="true">'), capture);
    for (const value of ['', 'false', 'TRUE']) {
        capture.dataset.controlCapture = value; assert.equal(h.document.querySelector(CAPTURE), null);
    }
    capture.dataset.controlCapture = 'true'; capture.hidden = true;
    assert.equal(h.document.querySelector(CAPTURE), capture, 'selectors also match hidden connected elements');
    capture.remove(); assert.equal(h.document.querySelector(CAPTURE), null);
});

test('capture query returns the first matching element in document order including the root', t => {
    const h = sceneLifecycleBrowser(t), later = h.document.createElement('details'), earlier = h.document.createElement('details');
    const group = h.document.createElement('section');
    later.dataset.controlCapture = earlier.dataset.controlCapture = 'true';
    group.append('label', earlier); h.body.append(group, later);
    assert.equal(h.document.querySelector(CAPTURE), earlier);
    h.body.append(group); assert.equal(h.document.querySelector(CAPTURE), later);
    h.document.documentElement.dataset.controlCapture = 'true';
    assert.equal(h.document.querySelector(CAPTURE), h.document.documentElement);
    delete h.document.documentElement.dataset.controlCapture; later.remove();
    assert.equal(h.document.querySelector(CAPTURE), earlier);
    h.body.replaceChildren(); assert.equal(h.document.querySelector(CAPTURE), null);
});

test('dataset and HTML data attributes reflect edits and removals through either API', t => {
    const h = sceneLifecycleBrowser(t), capture = h.document.createElement('details'); h.body.append(capture);
    capture.dataset.controlCapture = 'true';
    assert.equal(capture.getAttribute('data-control-capture'), 'true');
    assert.equal('controlCapture' in capture.dataset, true);
    assert.equal(h.document.querySelector("[data-control-capture='true']"), capture);
    capture.setAttribute('DATA-CONTROL-CAPTURE', 'false');
    assert.equal(capture.dataset.controlCapture, 'false'); assert.equal(h.document.querySelector(CAPTURE), null);
    capture.setAttribute('data-control-capture', 'true');
    assert.equal(h.document.querySelector(' [DATA-CONTROL-CAPTURE = "true"] '), capture);
    assert.deepEqual(Object.keys(capture.dataset), ['controlCapture']);
    delete capture.dataset.controlCapture;
    assert.equal('controlCapture' in capture.dataset, false);
    assert.equal(capture.getAttribute('data-control-capture'), null); assert.equal(h.document.querySelector(CAPTURE), null);
    capture.dataset.controlCapture = 'true'; capture.removeAttribute('data-control-capture');
    assert.equal(capture.dataset.controlCapture, undefined); assert.deepEqual(Object.keys(capture.dataset), []);
});

test('unsupported selector shapes fail explicitly instead of silently returning no match', t => {
    const h = sceneLifecycleBrowser(t);
    assert.throws(() => h.document.querySelector('dialog[open]'), /Unsupported lifecycle selector/);
});

test('real gamepad reader is blocked during capture and rearms only after release', t => {
    let device: GamepadDevice | undefined;
    t.after(() => { device?.dispose(); selectGamepad(null); });
    const h = sceneLifecycleBrowser(t), baseline = h.listenerCount();
    const pad = { id: 'Capture query fixture', index: 0, mapping: 'standard', connected: true, timestamp: 0,
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    Object.assign(navigator, { getGamepads: () => [pad] });
    selectGamepad(pad as unknown as Gamepad); device = new GamepadDevice();
    const confirm = (pressed: boolean) => { pad.buttons[0].pressed = pressed; pad.buttons[0].value = Number(pressed); };
    assert.equal(device.menu('fixture'), null);
    confirm(true); assert.equal(device.menu('fixture'), 'confirm');
    const capture = h.document.createElement('details'); h.body.append(capture); capture.dataset.controlCapture = 'true';
    confirm(false); assert.equal(device.menu('fixture'), null);
    confirm(true); assert.equal(device.menu('fixture'), null);
    delete capture.dataset.controlCapture;
    assert.equal(device.menu('fixture'), null, 'the held capture button cannot activate a menu');
    confirm(false); assert.equal(device.menu('fixture'), null);
    confirm(true); assert.equal(device.menu('fixture'), 'confirm');
    device.dispose(); assert.equal(h.listenerCount(), baseline);
});
