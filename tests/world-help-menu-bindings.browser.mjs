/** Shared help text against real menu commands; Chromium and loopback only.
 * npm install --no-save --package-lock=false playwright@1.58.2
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/world-help-menu-bindings.browser.mjs
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body><button id="open">Controles</button><canvas tabindex="0"></canvas><script type="module">
import { WorldControlsHelp } from '/src/adventure/WorldControlsHelp.ts';
import { GamepadDevice, selectGamepad } from '/src/engine/GamepadDevice.ts';
import { controlPreferences, profileFor, editProfile, saveControls } from '/src/engine/ControlPreferences.ts';
selectGamepad(pads[0]);
const custom = new URLSearchParams(location.search).has('custom');
const help = new WorldControlsHelp(document.querySelector('canvas'), {
    canOpen: () => true, resetInput() {}, suspendTouch: () => () => {},
}, custom ? { navigation: ['Instrução específica deste modo.'] } : {});
const device = new GamepadDevice();
document.querySelector('#open').onclick = () => help.open();
window.h = { help, device, controlPreferences, profileFor, editProfile, saveControls,
    command(binding) {
        const pad = pads[0], neutral = () => { pad.buttons.forEach(b => { b.pressed = false; b.value = 0; }); pad.axes.fill(0); };
        neutral(); device.menu('proof');
        if ('button' in binding) { pad.buttons[binding.button].pressed = true; pad.buttons[binding.button].value = 1; }
        else pad.axes[binding.axis] = binding.target;
        const command = device.menu('proof'); neutral(); device.menu('proof'); return command;
    },
};
</script></body></html>`;

before(async () => {
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'help-menu-bindings', configureServer(vite) {
            vite.middlewares.use('/help-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, { saved = false, custom = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 } }), page = await context.newPage(), errors = [];
    page.setDefaultTimeout(3000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'only loopback requests'); return route.continue();
    });
    await page.addInitScript(saved => {
        window.pads = ['Menu hint fixture', 'DualSense fixture'].map((id, index) => ({
            id, index, mapping: 'standard', connected: true, axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 24 }, () => ({ pressed: false, value: 0 })),
        }));
        navigator.getGamepads = () => pads;
        if (saved) localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ pads: {
            'standard:Menu hint fixture': { bindings: { confirm: [{ button: 17 }], back: [{ button: 18 }],
                pause: [{ button: 19 }], run: [{ button: 20 }], parry: [{ axis: 2, rest: 0, target: -1 }] } },
        } }));
    }, saved);
    t.after(async () => {
        try {
            assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => localStorage.getItem('campaign-fixture')), 'unchanged');
            await page.evaluate(() => { h.help.dispose(); h.device.dispose(); });
        } finally { await context.close(); }
    });
    await page.goto(base + '/help-fixture' + (custom ? '?custom' : ''));
    await page.waitForFunction(() => !!window.h);
    await page.evaluate(() => localStorage.setItem('campaign-fixture', 'unchanged'));
    await page.locator('#open').click();
    await page.evaluate(() => { h.paragraphs = [...document.querySelectorAll('.world-controls-content > p')]; });
    return page;
}
const text = page => page.locator('.world-controls-content > p').allTextContents();

test('default help follows live confirmation remapping and restoration without replacing paragraphs or stealing focus', async t => {
    const page = await setup(t), initial = await text(page);
    await page.locator('summary').click(); await page.getByRole('combobox').nth(1).selectOption('confirm');
    const binding = page.locator('.feka-control-settings > button').first(); await binding.click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => { pads[0].buttons[4] = { pressed: true, value: 1 }; });
    await page.waitForFunction(() => !document.querySelector('[data-control-capture="true"]'));
    await page.evaluate(() => { pads[0].buttons[4] = { pressed: false, value: 0 }; });
    const changed = await text(page);
    assert.match(changed[1], /Confirmar: LB;/); assert.match(changed[2], /pular a viagem: LB\./);
    assert.deepEqual(await page.evaluate(() => [h.command({ button: 0 }), h.command({ button: 4 })]), [null, 'confirm']);
    assert.equal(await binding.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => h.paragraphs.every((p, i) => p === document.querySelectorAll('.world-controls-content > p')[i])), true);
    await page.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
    assert.deepEqual(await text(page), initial); assert.equal(await page.evaluate(() => h.command({ button: 0 })), 'confirm');
    await page.getByRole('button', { name: 'VOLTAR ÀS OPÇÕES', exact: true }).click();
    assert.equal(await page.locator('#open').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('canvas').evaluate(node => node.inert), false);
});

test('saved menu bindings appear on opening, match commands and refresh when the selected device changes', async t => {
    const page = await setup(t, { saved: true }), hints = await text(page);
    assert.match(hints[1], /Confirmar: Botão 18; voltar: Botão 19; pausar\/continuar: Botão 20/);
    assert.match(hints[2], /Ilhas: Botão 21; mundo: Eixo 3 −;/);
    assert.deepEqual(await page.evaluate(() => [17, 18, 19, 20].map(button => h.command({ button })).concat(h.command({ axis: 2, target: -1 }))),
        ['confirm', 'back', 'pause', 'regions', 'overview']);
    for (const viewport of [{ width: 360, height: 640 }, { width: 640, height: 360 }]) {
        await page.setViewportSize(viewport);
        assert.equal(await page.locator('.world-controls-content').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    }
    await page.locator('summary').click(); const device = page.getByRole('combobox').nth(0);
    await device.focus(); await device.selectOption('1');
    assert.match((await text(page))[1], /Confirmar: ×; voltar: ○; pausar\/continuar: Options/);
    assert.equal(await device.evaluate(node => node === document.activeElement), true);
});

test('mode-specific navigation remains owned by its caller', async t => {
    const page = await setup(t, { custom: true }), initial = await text(page);
    await page.evaluate(() => { h.editProfile(pads[0]).bindings.confirm = [{ button: 4 }]; h.saveControls(); });
    assert.deepEqual(await text(page), initial);
    assert.equal(initial[0], 'Instrução específica deste modo.');
});
