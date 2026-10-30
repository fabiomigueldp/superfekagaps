/** Native DOM/keyboard and real lifecycle; gamepad, RAF and art loading are controlled.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-reconnection.browser.mjs
 * PLAYWRIGHT_MODULE may select an existing Playwright installation.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server, browser, base;
const evidence = { cases: [], errors: [], external: [], consoleErrors: [] };
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body><script type="module">
import { DeliciaApp } from '/src/adventure/delicia/DeliciaApp.ts';
import { DeliciaStore } from '/src/adventure/delicia/DeliciaProgress.ts';
import { DeliciaArt } from '/src/adventure/delicia/DeliciaArt.ts';
import { selectGamepad } from '/src/engine/GamepadDevice.ts';
import { heldKeyboardMovement } from '/src/engine/KeyboardMovement.ts';
DeliciaArt.prototype.load = async () => {};
selectGamepad(pad);
const app = new DeliciaApp(document.body, { store: new DeliciaStore(null) });
app.loadStage('delicia-1', true);
const sim = app.sim, save = JSON.stringify(app.store.save);
window.h = { app, frame,
    button(index, pressed) { pad.buttons[index].pressed = pressed; },
    connection(connected, notify) {
        pad.connected = connected;
        if (notify) { const event = new Event(connected ? 'gamepadconnected' : 'gamepaddisconnected');
            Object.defineProperty(event, 'gamepad', { value: pad }); window.dispatchEvent(event); }
    },
    snapshot: () => ({ screen: app.screen, input: app.input(), physical: [...heldKeyboardMovement()],
        focused: document.activeElement === app.canvas, documentFocused: document.hasFocus(),
        sameSimulation: app.sim === sim, sameSave: JSON.stringify(app.store.save) === save,
        elapsed: sim.elapsed, x: sim.player.x, sources: [...app.sources], connected: pad.connected })
};
frame();
</script></body></html>`;

before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    await mkdir(new URL('../.tmp/delicia-reconnection-browser/', import.meta.url), { recursive: true });
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, appType: 'custom',
        server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'delicia-reconnection-diagnostic', configureServer(vite) {
            vite.middlewares.use('/reconnection-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
    evidence.chromium = browser.version();
});
after(async () => {
    await writeFile(new URL('../.tmp/delicia-reconnection-browser/evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
    await browser?.close(); await server?.close();
});

async function setup(t) {
    const context = await browser.newContext(), page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => evidence.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
    await page.route('**/*', route => {
        if (new URL(route.request().url()).origin === base) return route.continue();
        evidence.external.push(route.request().url()); return route.abort();
    });
    await page.addInitScript(() => {
        const frames = new Map(); let id = 0, now = 1000;
        window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
        window.cancelAnimationFrame = id => frames.delete(id);
        window.frame = () => { now += 1000 / 60; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); };
        window.pad = { id: 'Reconnection fixture', index: 0, connected: true, mapping: 'standard', timestamp: 0,
            axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false,
                get value() { return Number(this.pressed); }, get touched() { return this.pressed; } })) };
        navigator.getGamepads = () => pad.connected ? [pad] : [];
        for (const key of ['super_feka_delicia_v1', 'super_feka_gaps_world_v1']) localStorage.setItem(key, 'unchanged');
    });
    t.after(async () => {
        try {
            assert.deepEqual(evidence.errors, []); assert.deepEqual(evidence.external, []); assert.deepEqual(evidence.consoleErrors, []);
            assert.equal(await page.evaluate(() => h.snapshot().sameSimulation && h.snapshot().sameSave), true);
            assert.deepEqual(await page.evaluate(() => ['super_feka_delicia_v1', 'super_feka_gaps_world_v1'].map(key => localStorage.getItem(key))), ['unchanged', 'unchanged']);
            await page.evaluate(() => h.app.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/reconnection-fixture', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.h); await page.locator('.dl-canvas').focus();
    return page;
}
const neutral = input => assert.ok(Object.values(input).every(value => value === false), JSON.stringify(input));

for (const delivery of ['poll', 'event']) for (const index of [0, 1, 9])
test(`button ${index} reconnect via ${delivery}: disconnect pauses and keyboard ownership survives resume`, async t => {
    const page = await setup(t), states = [], notify = delivery === 'event';
    const capture = async phase => { const value = await page.evaluate(() => h.snapshot()); states.push({ phase, ...value }); return value; };
    const initial = await capture('playing'); assert.equal(initial.screen, 'playing');
    await page.evaluate(notify => { h.connection(false, notify); h.frame(); }, notify);
    const disconnected = await capture('first-disconnect');
    assert.equal(disconnected.screen, 'pause'); neutral(disconnected.input); assert.equal(disconnected.elapsed, initial.elapsed);
    await page.evaluate(({ index, notify }) => { h.button(index, true); h.connection(true, notify); h.frame(); h.frame(); }, { index, notify });
    const carried = await capture('reconnected-held');
    assert.equal(carried.screen, 'pause'); neutral(carried.input); assert.equal(carried.elapsed, disconnected.elapsed);
    await page.evaluate(index => { h.button(index, false); h.frame(); }, index);
    assert.equal((await capture('reconnected-released')).screen, 'pause');
    await page.evaluate(index => { h.button(index, true); h.frame(); }, index);
    const fresh = await capture('fresh-confirm');
    assert.equal(fresh.screen, 'playing'); assert.equal(fresh.focused, true);

    // Same final sequence as the historical assertion: keydown, disconnect, frame.
    await page.keyboard.down('d');
    const before = await capture('keyboard-before-second-disconnect');
    assert.deepEqual(before.physical, [['KeyD', 'right']]);
    await page.evaluate(notify => { h.connection(false, notify); h.frame(); }, notify);
    const paused = await capture('historical-assertion-point');
    assert.equal(paused.screen, 'pause'); neutral(paused.input);
    assert.deepEqual(paused.physical, before.physical, 'The keyboard owner survives the controller loss');
    assert.equal(paused.elapsed, before.elapsed); assert.equal(paused.x, before.x);
    await page.evaluate(() => { h.frame(); h.frame(); });
    const stillPaused = await capture('awaiting-explicit-resume');
    assert.equal(stillPaused.screen, 'pause'); assert.equal(stillPaused.elapsed, paused.elapsed); assert.equal(stillPaused.x, paused.x);
    await page.getByRole('button', { name: 'CONTINUAR', exact: true }).click();
    await page.evaluate(() => h.frame());
    const resumed = await capture('keyboard-resumed');
    assert.equal(resumed.screen, 'playing'); assert.equal(resumed.input.right, true);
    assert.deepEqual(resumed.physical, before.physical); assert.ok(resumed.x > paused.x);
    assert.equal(resumed.connected, false, 'Keyboard remains usable without reconnecting the pad');
    assert.equal(resumed.focused, true); assert.equal(resumed.documentFocused, true);
    await page.keyboard.up('d'); await page.evaluate(() => h.frame());
    const released = await capture('keyboard-released');
    assert.equal(released.input.right, false); assert.deepEqual(released.physical, []);
    for (const state of states) { assert.equal(state.sameSimulation, true); assert.equal(state.sameSave, true); }
    evidence.cases.push({ index, delivery, states });
    t.diagnostic(JSON.stringify({ index, delivery, atHistoricalAssertion: { screen: paused.screen, right: paused.input.right,
        physical: paused.physical }, afterExplicitResume: { screen: resumed.screen, right: resumed.input.right,
        moved: resumed.x > paused.x }, sameSimulation: resumed.sameSimulation, sameSave: resumed.sameSave }));
});
