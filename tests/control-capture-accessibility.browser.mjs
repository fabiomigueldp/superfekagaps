/** Native accessible-name checks for the shared remapping UI; loopback only.
 * npm install --no-save --package-lock=false playwright@1.58.2
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/control-capture-accessibility.browser.mjs
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<script type="module">
import { ControlSettings } from '/src/engine/ControlSettings.ts';
import { controlPreferences, keyAction, profileFor } from '/src/engine/ControlPreferences.ts';
const settings = new ControlSettings();
document.body.append(settings.root); settings.root.open = true;
window.h = { settings, controlPreferences, keyAction, profileFor };
</script></html>`;

before(async () => {
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'control-capture-fixture', configureServer(vite) {
            vite.middlewares.use('/capture-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, gamepad = false) {
    const context = await browser.newContext(), page = await context.newPage(), errors = [];
    page.setDefaultTimeout(3000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'only loopback requests');
        return route.continue();
    });
    if (gamepad) await page.addInitScript(() => {
        window.pad = { index: 0, id: 'Capture fixture', mapping: 'standard', connected: true,
            axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
        navigator.getGamepads = () => [window.pad];
    });
    t.after(async () => {
        try {
            assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => localStorage.getItem('campaign-fixture')), 'unchanged');
            await page.evaluate(() => h.settings.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/capture-fixture'); await page.waitForFunction(() => !!window.h);
    await page.evaluate(() => localStorage.setItem('campaign-fixture', 'unchanged'));
    if (gamepad) await page.getByRole('combobox').nth(0).selectOption('0');
    await page.getByRole('combobox').nth(1).selectOption('jump');
    return { page, binding: page.locator('.feka-control-settings > button').first() };
}

async function accessibleName(page) {
    const cdp = await page.context().newCDPSession(page);
    try {
        const { root } = await cdp.send('DOM.getDocument');
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.feka-control-settings > button' });
        const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
        return nodes.find(node => node.role?.value === 'button')?.name?.value;
    } finally { await cdp.detach(); }
}

test('keyboard capture exposes Cancelar in the native accessible name and restores the binding on cancellation', async t => {
    const { page, binding } = await setup(t), initial = await accessibleName(page);
    const preferences = await page.evaluate(() => JSON.stringify(h.controlPreferences));
    for (const cancel of ['button', 'Escape']) {
        await binding.focus(); await page.keyboard.press('Enter');
        assert.equal(await binding.textContent(), 'Cancelar');
        assert.equal(await accessibleName(page), 'Cancelar alteração de Pular');
        assert.equal(await binding.evaluate(node => node === document.activeElement), true);
        if (cancel === 'button') await page.getByRole('button', { name: 'Cancelar alteração de Pular', exact: true }).click();
        else await page.keyboard.press('Escape');
        assert.equal(await accessibleName(page), initial);
        assert.equal(await page.locator('[data-control-capture="true"]').count(), 0);
        assert.equal(await page.evaluate(() => JSON.stringify(h.controlPreferences)), preferences);
    }
});

test('a captured key and restoration expose the active binding again', async t => {
    const { page, binding } = await setup(t), initial = await accessibleName(page);
    await binding.click(); await page.keyboard.press('r');
    assert.equal(await accessibleName(page), 'Alterar Pular: R');
    assert.equal(await page.evaluate(() => h.keyAction('KeyR')), 'jump');
    assert.equal(await page.evaluate(() => h.keyAction('Space')), undefined);
    await page.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
    assert.equal(await accessibleName(page), initial);
    assert.equal(await page.evaluate(() => h.keyAction('Space')), 'jump');
    assert.equal(await page.evaluate(() => h.keyAction('KeyR')), undefined);
});

test('gamepad capture exposes cancellation and returns to the selected button after completion', async t => {
    const { page, binding } = await setup(t, true), initial = await accessibleName(page);
    const preferences = await page.evaluate(() => JSON.stringify(h.controlPreferences));
    await binding.click();
    assert.equal(await accessibleName(page), 'Cancelar alteração de Pular');
    await page.getByRole('button', { name: 'Cancelar alteração de Pular', exact: true }).click();
    assert.equal(await accessibleName(page), initial);
    assert.equal(await page.evaluate(() => JSON.stringify(h.controlPreferences)), preferences);
    await binding.click();
    // Let the real capture poll observe the neutral controller before pressing.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => { pad.buttons[3] = { pressed: true, value: 1 }; });
    await page.waitForFunction(() => !h.settings.root.dataset.controlCapture);
    assert.equal(await accessibleName(page), 'Alterar Pular: Y');
    assert.deepEqual(await page.evaluate(() => h.profileFor(pad).bindings.jump), [{ button: 3 }]);
});
