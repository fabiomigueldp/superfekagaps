/** Native focus/keyboard and real Delicia input/simulation; RAF and art loading are controlled.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-movement-focus.browser.mjs
 * PLAYWRIGHT_MODULE can select an existing Playwright/Playwright Core installation.
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
import { heldKeyboardMovement } from '/src/engine/KeyboardMovement.ts';
DeliciaArt.prototype.load = async () => {};
const app = new DeliciaApp(document.body, { store: new DeliciaStore(null) });
app.loadStage('delicia-1', true);
window.h = { app, sim: app.sim, save: JSON.stringify(app.store.save), frame,
    snapshot: () => ({ screen: app.screen, input: app.input(), physical: [...heldKeyboardMovement()],
        focused: document.hasFocus(), x: app.sim.player.x }) };
frame();
</script></body></html>`;
before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'delicia-movement-focus', configureServer(vite) {
            vite.middlewares.use('/movement-fixture', (_request, response) => {
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
        navigator.getGamepads = () => [];
        for (const key of ['super_feka_delicia_v1', 'super_feka_gaps_world_v1']) localStorage.setItem(key, 'unchanged');
    });
    t.after(async () => {
        try {
            assert.deepEqual(errors, []); assert.deepEqual(external, []);
            assert.equal(await page.evaluate(() => h.app.sim === h.sim && JSON.stringify(h.app.store.save) === h.save), true);
            assert.deepEqual(await page.evaluate(() => ['super_feka_delicia_v1', 'super_feka_gaps_world_v1'].map(key => localStorage.getItem(key))), ['unchanged', 'unchanged']);
            await page.evaluate(() => h.app.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/movement-fixture', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => !!window.h);
    await page.locator('.dl-canvas').focus();
    return page;
}

for (const [key, action] of [['a', 'left'], ['d', 'right'], ['Shift', 'run']])
test(`held ${action} survives native in-page focus changes and still releases on keyup`, async t => {
    const page = await setup(t);
    await page.keyboard.down(key);
    const before = await page.evaluate(() => { h.frame(); return h.snapshot(); });
    assert.equal(before.input[action], true); assert.equal(before.focused, true);
    await page.getByRole('button', { name: 'Pausar', exact: true }).focus();
    await page.locator('.dl-canvas').focus();
    const after = await page.evaluate(() => { h.frame(); return h.snapshot(); });
    assert.equal(after.focused, true); assert.equal(after.screen, 'playing');
    assert.equal(after.input[action], true, 'Moving focus inside the document is not losing window focus');
    assert.deepEqual(after.physical, before.physical);
    await page.keyboard.up(key);
    assert.equal(await page.evaluate(action => { h.frame(); return h.snapshot().input[action]; }, action), false);
});

test('a window blur event clears a held direction before returning to gameplay', async t => {
    const page = await setup(t);
    await page.keyboard.down('d');
    assert.equal(await page.evaluate(() => { h.frame(); return h.snapshot().input.right; }), true);
    // Headless tab selection does not reliably deliver OS window focus events.
    // Dispatch at the real Window; element focus changes above remain native.
    await page.evaluate(() => window.dispatchEvent(new FocusEvent('blur')));
    assert.equal(await page.evaluate(() => h.app.screen), 'pause');
    assert.deepEqual(await page.evaluate(() => h.snapshot().physical), []);
    await page.evaluate(() => window.dispatchEvent(new FocusEvent('focus')));
    await page.getByRole('button', { name: 'CONTINUAR', exact: true }).click();
    const resumed = await page.evaluate(() => { h.frame(); return h.snapshot(); });
    assert.equal(resumed.screen, 'playing'); assert.equal(resumed.input.right, false);
    await page.keyboard.up('d');
});

test('keyup stopped by a native control still releases movement at window capture', async t => {
    const page = await setup(t);
    await page.keyboard.down('d'); await page.evaluate(() => h.frame());
    const pause = page.getByRole('button', { name: 'Pausar', exact: true });
    await pause.focus();
    await pause.evaluate(button => button.addEventListener('keyup', event => event.stopImmediatePropagation(), { once: true }));
    await page.keyboard.up('d'); await page.locator('.dl-canvas').focus();
    const released = await page.evaluate(() => { h.frame(); return h.snapshot(); });
    assert.equal(released.input.right, false); assert.deepEqual(released.physical, []);
});

test('the shared Input consumer also preserves movement across element focus changes', async t => {
    const page = await setup(t);
    await page.evaluate(async () => {
        const { Input } = await import('/src/engine/Input.ts');
        h.sharedInput = new Input(h.app.canvas);
    });
    try {
        await page.keyboard.down('d');
        assert.equal(await page.evaluate(() => { h.sharedInput.update(); return h.sharedInput.getState().right; }), true);
        await page.getByRole('button', { name: 'Pausar', exact: true }).focus(); await page.locator('.dl-canvas').focus();
        assert.equal(await page.evaluate(() => { h.sharedInput.update(); return h.sharedInput.getState().right; }), true);
        await page.keyboard.up('d');
        assert.equal(await page.evaluate(() => { h.sharedInput.update(); return h.sharedInput.getState().right; }), false);
    } finally { await page.evaluate(() => h.sharedInput.dispose()); }
});
