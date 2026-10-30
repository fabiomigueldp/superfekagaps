/** Chapter help with native DOM and real configurable input; loopback only.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/guaira-chapter-help-bindings.browser.mjs
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body><canvas id="game" tabindex="0"></canvas><script type="module">
import { GuairaChapterControlsHelp } from '/src/adventure/experimental/guaira/chapter/GuairaChapterControlsHelp.ts';
import { Input } from '/src/engine/Input.ts';
import { StandardGamepad } from '/src/engine/StandardGamepad.ts';
import { selectGamepad } from '/src/engine/GamepadDevice.ts';
import { editProfile, saveControls } from '/src/engine/ControlPreferences.ts';
const canvas = document.querySelector('canvas');
selectGamepad(pads[0]);
let input;
const game = { state: 'playing', isDisposed: false, get input() { return input; } };
const runtime = { game, togglePause() { game.state = game.state === 'playing' ? 'paused' : 'playing'; } };
const help = new GuairaChapterControlsHelp(canvas, () => runtime, new URLSearchParams(location.search).has('optional'));
document.body.append(help.button);
input = new Input(canvas);
const controls = new StandardGamepad(input);
const neutral = () => { pads[0].buttons.forEach(b => { b.pressed = false; b.value = 0; }); pads[0].axes.fill(0); };
const press = binding => {
    if ('button' in binding) pads[0].buttons[binding.button] = { pressed: true, value: 1 };
    else pads[0].axes[binding.axis] = binding.target;
};
window.h = { help, game, runtime, input, controls, editProfile, saveControls, selectGamepad,
    command(binding, route = false) {
        neutral(); controls.updateMenu('help'); press(binding);
        const command = controls.updateMenu('help'); neutral(); controls.updateMenu('help');
        if (route && command) help.control(command);
        return command;
    },
    play(binding) {
        neutral(); controls.update('playing'); input.update(); press(binding);
        const pause = controls.update('playing'); input.update(); const state = { ...input.getState() };
        neutral(); controls.update('playing'); input.update(); return { pause, state };
    },
};
</script></body></html>`;

before(async () => {
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'chapter-help-bindings', configureServer(vite) {
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
    page.setDefaultTimeout(3000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'only loopback requests'); return route.continue();
    });
    await page.addInitScript(saved => {
        window.pads = ['Chapter fixture', 'DualSense fixture', 'Unmapped fixture'].map((id, index) => ({
            id, index, mapping: index === 2 ? '' : 'standard', connected: true, axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 32 }, () => ({ pressed: false, value: 0 })),
        }));
        navigator.getGamepads = () => pads;
        if (saved) localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ pads: {
            'standard:Chapter fixture': { bindings: { confirm: [{ button: 17 }], back: [{ button: 18 }],
                jump: [{ button: 19 }], run: [{ button: 20 }], down: [{ axis: 2, rest: 0, target: -1 }],
                pause: [{ button: 21 }], left: [{ button: 22 }], right: [{ button: 23 }] } },
        } }));
        localStorage.setItem('campaign-fixture', 'unchanged');
    }, saved);
    t.after(async () => {
        try {
            assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => localStorage.getItem('campaign-fixture')), 'unchanged');
            await page.evaluate(() => { h.help.dispose(); h.controls.dispose(); h.input.dispose(); });
        } finally { await context.close(); }
    });
    await page.goto(base + '/help-fixture' + (saved ? '?optional' : ''));
    await page.waitForFunction(() => !!window.h);
    await page.locator('#chapter-controls').click();
    await page.evaluate(() => { h.paragraphs = [...document.querySelectorAll('.world-controls-content > p')]; });
    return page;
}
const text = page => page.locator('.world-controls-content > p').allTextContents();
const footer = page => page.locator('.world-controls-footer-hint').textContent();

async function remap(page, action, button) {
    await page.getByRole('combobox').nth(1).selectOption(action);
    await page.locator('.feka-control-settings > button').first().click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(button => { pads[0].buttons[button] = { pressed: true, value: 1 }; }, button);
    await page.waitForFunction(() => !document.querySelector('[data-control-capture="true"]'));
    await page.evaluate(button => { pads[0].buttons[button] = { pressed: false, value: 0 }; }, button);
}

test('chapter help follows live menu remaps and restoration while retaining focus and chapter guidance', async t => {
    const page = await setup(t), initial = await text(page), initialFooter = await footer(page);
    await page.locator('summary').click();
    await remap(page, 'confirm', 17); await remap(page, 'back', 18);
    const commands = await page.evaluate(() => [0, 1, 17, 18].map(button => h.command({ button })));
    assert.deepEqual(commands, [null, null, 'confirm', 'back']);
    const changed = await text(page), hint = await footer(page);
    t.diagnostic(JSON.stringify({ commands, menu: changed[1], footer: hint }));
    assert.match(changed[1], /confirmar: Botão 18; voltar: Botão 19/);
    assert.match(hint, /Esc ou Botão 19 volta/);
    assert.deepEqual(changed.slice(2), initial.slice(2), 'chapter, retry, map and touch guidance survives');
    assert.equal(await page.locator('.feka-control-settings > button').first().evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => h.paragraphs.every((p, i) => p === document.querySelectorAll('.world-controls-content > p')[i])), true);
    await page.locator('summary').focus();
    assert.equal(await page.evaluate(() => h.command({ button: 17 }, true)), 'confirm');
    assert.equal(await page.locator('details').evaluate(node => node.open), false, 'mapped confirm activates the real focused control');
    assert.equal(await page.evaluate(() => h.command({ button: 18 }, true)), 'back');
    assert.equal(await page.locator('#chapter-controls-help').evaluate(node => node.open), false);
    assert.equal(await page.locator('#chapter-controls').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('#game').evaluate(node => node.inert), false);
    assert.equal(await page.evaluate(() => h.game.state), 'paused', 'closing help does not resume');
    await page.locator('#chapter-controls').click(); await page.locator('summary').click();
    await page.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
    assert.deepEqual(await text(page), initial); assert.equal(await footer(page), initialFooter);
    assert.deepEqual(await page.evaluate(() => [0, 1].map(button => h.command({ button }))), ['confirm', 'back']);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#chapter-controls').evaluate(node => node === document.activeElement), true);
});

test('saved gameplay bindings, device changes and unassigned controls stay accurate in optional chapter help', async t => {
    const page = await setup(t, true), hints = await text(page);
    assert.match(hints[0], /pular: Botão 20; correr: Botão 21; sentada no ar: Eixo 3 −; pausar: Botão 22/);
    assert.match(hints[1], /confirmar: Botão 18; voltar: Botão 19/);
    assert.match(hints[4], /Voltar ao mapa encerra o percurso opcional/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { h.runtime.togglePause(); document.querySelector('canvas').focus(); });
    const actions = await page.evaluate(() => Object.fromEntries([
        ['oldJump', { button: 0 }], ['jump', { button: 19 }], ['run', { button: 20 }],
        ['down', { axis: 2, target: -1 }], ['pause', { button: 21 }],
        ['left', { button: 22 }], ['right', { button: 23 }],
    ].map(([action, binding]) => [action, h.play(binding)])));
    assert.equal(actions.oldJump.state.jump, false);
    for (const action of ['jump', 'run', 'down', 'left', 'right']) assert.equal(actions[action].state[action], true, action);
    assert.equal(actions.pause.pause, true);
    await page.locator('#chapter-controls').click();
    for (const viewport of [{ width: 360, height: 640 }, { width: 640, height: 360 }]) {
        await page.setViewportSize(viewport);
        assert.equal(await page.locator('.world-controls-content').evaluate(node => node.scrollWidth <= node.clientWidth), true);
        assert.equal(await page.locator('footer').evaluate(node => node.scrollWidth <= node.clientWidth), true);
        if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/chapter-help-${viewport.width}.png` });
    }
    await page.locator('summary').click(); const device = page.getByRole('combobox').nth(0);
    await device.focus(); await device.selectOption('1');
    assert.match((await text(page))[0], /pular: ×; correr: □ \/ R2; sentada no ar: Eixo 2 \+ \/ ↓ \/ L1; pausar: Options/);
    assert.match((await text(page))[1], /confirmar: ×; voltar: ○/); assert.match(await footer(page), /Esc ou ○ volta/);
    assert.equal(await device.evaluate(node => node === document.activeElement), true);
    await device.selectOption('2');
    assert.match((await text(page))[0], /pular: Sem botão/); assert.match((await text(page))[1], /confirmar: Sem botão; voltar: Sem botão/);
    assert.match(await footer(page), /Esc volta/); assert.doesNotMatch(await footer(page), /ou Sem botão/);
    const unassigned = await text(page);
    await device.selectOption('keyboard');
    assert.deepEqual(await text(page), unassigned, 'editing keyboard bindings does not deselect the active gamepad');
    await page.evaluate(() => { pads.forEach(pad => { pad.connected = false; }); h.selectGamepad(null); });
    assert.doesNotMatch((await text(page)).slice(0, 2).join(' '), /A\/×|B\/○|Sem botão|Botão/);
    assert.match(await footer(page), /Esc volta/);
});
