/** Real DOM, keyboard events, app router and simulation; gamepad/RAF and art loading are controlled.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-pause-gamepad.browser.mjs
 * PLAYWRIGHT_MODULE may point to an existing Playwright/Playwright Core installation.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body><script type="module">
import { DeliciaApp } from '/src/adventure/delicia/DeliciaApp.ts';
import { DeliciaStore } from '/src/adventure/delicia/DeliciaProgress.ts';
import { DeliciaArt } from '/src/adventure/delicia/DeliciaArt.ts';
import { selectGamepad } from '/src/engine/GamepadDevice.ts';
DeliciaArt.prototype.load = async () => {};
selectGamepad(pad);
const app = new DeliciaApp(document.body, { store: new DeliciaStore(null) });
app.loadStage('delicia-1', true);
const sim = app.sim, save = JSON.stringify(app.store.save);
window.h = { app, sim, save, set: (index, pressed) => { pad.buttons[index].pressed = pressed; },
    frame, snapshot: () => ({ screen: app.screen, input: app.input(), focused: document.activeElement === app.canvas,
        sameSimulation: app.sim === sim, sameSave: JSON.stringify(app.store.save) === save, elapsed: app.sim.elapsed }) };
frame();
</script></body></html>`;

before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'delicia-pause-gamepad', configureServer(vite) {
            vite.middlewares.use('/pause-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t) {
    const context = await browser.newContext(), page = await context.newPage(), errors = [], external = [];
    page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        if (new URL(route.request().url()).origin === base) return route.continue();
        external.push(route.request().url()); return route.abort();
    });
    await page.addInitScript(() => {
        const frames = new Map(); let id = 0, now = 1000;
        window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
        window.cancelAnimationFrame = id => frames.delete(id);
        window.frame = () => { now += 1000 / 60; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); };
        window.pad = { id: 'Pause fixture', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 17 }, () => ({ pressed: false, get value() { return Number(this.pressed); }, get touched() { return this.pressed; } })) };
        navigator.getGamepads = () => [pad];
        for (const key of ['super_feka_delicia_v1', 'super_feka_gaps_world_v1']) localStorage.setItem(key, 'unchanged');
    });
    t.after(async () => {
        try {
            assert.deepEqual(errors, []); assert.deepEqual(external, []);
            assert.equal(await page.evaluate(() => h.snapshot().sameSimulation && h.snapshot().sameSave), true);
            assert.deepEqual(await page.evaluate(() => ['super_feka_delicia_v1', 'super_feka_gaps_world_v1'].map(key => localStorage.getItem(key))), ['unchanged', 'unchanged']);
            await page.evaluate(() => h.app.dispose());
        } finally { await context.close(); }
    });
    // App readiness is explicit; unrelated asset completion is not an input boundary.
    await page.goto(base + '/pause-fixture', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => !!window.h);
    await page.locator('.dl-canvas').focus();
    return page;
}

for (const index of [0, 1, 9]) {
    test(`fresh controller button ${index} after keyboard pause is accepted on the next frame`, async t => {
        const page = await setup(t);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => h.snapshot().screen), 'pause');
        const state = await page.evaluate(index => { h.set(index, true); h.frame(); return h.snapshot(); }, index);
        assert.equal(state.screen, 'playing'); assert.equal(state.focused, true);
    });
    test(`controller button ${index} carried into pause stays blocked until released`, async t => {
        const page = await setup(t);
        await page.evaluate(index => h.set(index, true), index);
        await page.keyboard.press('Escape');
        const elapsed = await page.evaluate(() => h.snapshot().elapsed);
        const held = await page.evaluate(() => { h.frame(); h.frame(); return h.snapshot(); });
        assert.equal(held.screen, 'pause'); assert.equal(held.elapsed, elapsed);
        assert.ok(Object.values(held.input).every(value => value === false));
        const released = await page.evaluate(index => { h.set(index, false); h.frame(); return h.snapshot(); }, index);
        assert.equal(released.screen, 'pause');
        const fresh = await page.evaluate(index => { h.set(index, true); h.frame(); return h.snapshot(); }, index);
        assert.equal(fresh.screen, 'playing'); assert.equal(fresh.focused, true);
    });
}
