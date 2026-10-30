/** Real DeliciaApp help and controller routing in Chromium; loopback only.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-help-menu-bindings.browser.mjs
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body><script type="module">
import { DeliciaApp } from '/src/adventure/delicia/DeliciaApp.ts';
import { DeliciaStore } from '/src/adventure/delicia/DeliciaProgress.ts';
import { selectGamepad } from '/src/engine/GamepadDevice.ts';
selectGamepad(pads[0]);
const app = new DeliciaApp(document.body, { store: new DeliciaStore(null), returnToWorldMap() {} });
app.loadStage('delicia-1', true);
// Freeze the simulation clock; settings keep their native animation frames.
// Every controller sample below goes through the application's real router.
app.stopFrames();
window.h = { app, selectGamepad, sim: app.sim, save: JSON.stringify(app.store.save),
    player: JSON.stringify(app.sim.player),
    press(button) {
        const neutral = () => pads[0].buttons.forEach(b => { b.pressed = false; b.value = 0; });
        neutral(); app.pollGamepad(); pads[0].buttons[button] = { pressed: true, value: 1 };
        app.pollGamepad(); neutral(); app.pollGamepad();
        return { screen: app.screen, open: document.querySelector('#delicia-controls').open };
    },
};
</script></body></html>`;

before(async () => {
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'delicia-help-bindings', configureServer(vite) {
            vite.middlewares.use('/help-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, saved = false) {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 } }), page = await context.newPage(), errors = [];
    page.setDefaultTimeout(4000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'only loopback requests'); return route.continue();
    });
    await page.addInitScript(saved => {
        window.pads = ['Delicia fixture', 'DualSense fixture', 'Unmapped fixture'].map((id, index) => ({
            id, index, mapping: index === 2 ? '' : 'standard', connected: true, axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 32 }, () => ({ pressed: false, value: 0 })),
        }));
        navigator.getGamepads = () => pads;
        if (saved) localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ pads: {
            'standard:Delicia fixture': { bindings: { confirm: [{ button: 17 }], back: [{ button: 18 }],
                pause: [{ button: 19 }], guide: [{ button: 20 }] } },
        } }));
        for (const key of ['super_feka_delicia_v1', 'super_feka_gaps_world_v1']) localStorage.setItem(key, 'unchanged');
    }, saved);
    t.after(async () => {
        try {
            assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => h.app.sim === h.sim && JSON.stringify(h.app.sim.player) === h.player), true);
            assert.equal(await page.evaluate(() => JSON.stringify(h.app.store.save) === h.save), true);
            assert.deepEqual(await page.evaluate(() => ['super_feka_delicia_v1', 'super_feka_gaps_world_v1'].map(key => localStorage.getItem(key))), ['unchanged', 'unchanged']);
            await page.evaluate(() => h.app.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/help-fixture'); await page.waitForFunction(() => !!window.h);
    await page.locator('.dl-canvas').focus(); await page.keyboard.press('F1');
    await page.getByRole('dialog', { name: 'CONTROLES', exact: true }).waitFor();
    await page.evaluate(() => {
        h.opener = h.app.controlsHelp.restoreFocus;
        h.paragraphs = [...document.querySelectorAll('.world-controls-content > p')];
    });
    return page;
}
const text = page => page.locator('.world-controls-content > p').allTextContents();
const press = (page, button) => page.evaluate(button => h.press(button), button);

async function remap(page, action, button) {
    await page.getByRole('combobox').nth(1).selectOption(action);
    await page.locator('.feka-control-settings > button').first().click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(button => { pads[0].buttons[button] = { pressed: true, value: 1 }; }, button);
    await page.waitForFunction(() => !document.querySelector('[data-control-capture="true"]'));
    await page.evaluate(button => { pads[0].buttons[button] = { pressed: false, value: 0 }; }, button);
}

test('Delicia menu hints follow real remapping, controller actions and restoration without changing the attempt', async t => {
    const page = await setup(t), initial = await text(page);
    await page.locator('summary').click();
    for (const [action, button] of [['confirm', 17], ['back', 18], ['pause', 19], ['guide', 20]]) await remap(page, action, button);
    assert.equal(await page.locator('.feka-control-settings > button').first().evaluate(node => node === document.activeElement), true);
    const changed = await text(page);
    assert.deepEqual(changed.slice(1), initial.slice(1), 'equipment and touch guidance remain intact');
    assert.equal(await page.evaluate(() => h.paragraphs.every((p, i) => p === document.querySelectorAll('.world-controls-content > p')[i])), true);
    await page.locator('summary').focus();
    for (const button of [0, 1, 9, 8]) assert.deepEqual(await press(page, button), { screen: 'pause', open: true });
    assert.equal(await page.locator('details').evaluate(node => node.open), true, 'old confirm cannot activate the focused summary');
    await press(page, 17);
    assert.equal(await page.locator('details').evaluate(node => node.open), false, 'mapped confirm activates the focused summary');
    assert.deepEqual(await press(page, 18), { screen: 'pause', open: false });
    assert.equal(await page.evaluate(() => document.activeElement === h.opener), true);
    assert.equal(await page.locator('.dl-canvas').evaluate(node => node.inert), false);
    t.diagnostic(JSON.stringify({ oldButtonsInactive: [0, 1, 9, 8], mappedConfirm: 17, mappedBack: 18, text: changed[0] }));
    assert.match(changed[0], /Confirmar: Botão 18; voltar: Botão 19; pausar: Botão 20; controles: Botão 21/);
    assert.deepEqual(await press(page, 9), { screen: 'pause', open: false });
    assert.deepEqual(await press(page, 19), { screen: 'playing', open: false });
    assert.deepEqual(await press(page, 8), { screen: 'playing', open: false });
    assert.deepEqual(await press(page, 20), { screen: 'pause', open: true });
    await press(page, 18); assert.deepEqual(await press(page, 17), { screen: 'playing', open: false });
    assert.deepEqual(await press(page, 19), { screen: 'pause', open: false });
    await press(page, 20);
    await page.locator('summary').click();
    await page.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
    assert.deepEqual(await text(page), initial);
    assert.deepEqual(await press(page, 1), { screen: 'pause', open: false });
    assert.deepEqual(await press(page, 9), { screen: 'playing', open: false });
    assert.deepEqual(await press(page, 8), { screen: 'pause', open: true });
    await page.locator('summary').focus(); await press(page, 0);
    assert.equal(await page.locator('details').evaluate(node => node.open), false);
});

test('Delicia help reads saved bindings and the selected device without losing mode-specific content or focus', async t => {
    const page = await setup(t, true), initial = await text(page);
    assert.match(initial[0], /Confirmar: Botão 18; voltar: Botão 19; pausar: Botão 20; controles: Botão 21/);
    assert.match(initial[1], /Semente, rebatida e interação ficam disponíveis conforme os equipamentos e a fase/);
    assert.equal(await page.getByRole('checkbox', { name: /Mais vida e avisos longos/ }).count(), 1);
    for (const viewport of [{ width: 360, height: 640 }, { width: 640, height: 360 }]) {
        await page.setViewportSize(viewport);
        await page.locator('.world-controls-content > p').first().evaluate(node => node.scrollIntoView({ block: 'start' }));
        assert.equal(await page.locator('.world-controls-content').evaluate(node => node.scrollWidth <= node.clientWidth), true);
        if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/delicia-help-${viewport.width}.png` });
    }
    await page.locator('summary').click(); const device = page.getByRole('combobox').nth(0);
    await device.focus(); await device.selectOption('1');
    assert.match((await text(page))[0], /Confirmar: ×; voltar: ○; pausar: Options; controles: Share/);
    assert.equal(await device.evaluate(node => node === document.activeElement), true);
    await device.selectOption('2');
    assert.match((await text(page))[0], /Confirmar: Sem botão; voltar: Sem botão; pausar: Sem botão; controles: Sem botão/);
    await page.evaluate(() => { pads.forEach(pad => { pad.connected = false; }); h.selectGamepad(null); });
    assert.match((await text(page))[0], /Tab ou ↑\/↓.*Enter ou Espaço.*Esc/);
    assert.doesNotMatch((await text(page))[0], /A confirma|B volta|Menu pausa|View|Sem botão/);
    assert.deepEqual((await text(page)).slice(1), initial.slice(1));
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement === h.opener), true);
});
