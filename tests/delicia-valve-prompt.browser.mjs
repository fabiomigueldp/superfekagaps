/** Real valve pixels, input and simulation; loopback only.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-valve-prompt.browser.mjs
 * PLAYWRIGHT_MODULE may select an existing Playwright installation.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body><script type="module">
import { DeliciaApp } from '/src/adventure/delicia/DeliciaApp.ts';
import { DeliciaStore, freshDeliciaSave } from '/src/adventure/delicia/DeliciaProgress.ts';
import { selectGamepad } from '/src/engine/GamepadDevice.ts';
import { keyAction } from '/src/engine/ControlPreferences.ts';
import { pixelText, textWidth } from '/src/graphics/BitmapFont.ts';
import { ART } from '/src/graphics/palette.ts';
localStorage.setItem('super_feka_delicia_v1', JSON.stringify(freshDeliciaSave()));
selectGamepad(pad);
const app = new DeliciaApp(document.body, { store: new DeliciaStore(localStorage, false) });
app.stopFrames();
if (!app.loadStage('delicia-1', true)) throw Error('Stage did not load');
app.stopFrames();
const sim = app.sim, valve = sim.stage.valves[0];
Object.assign(sim.player, { x: valve.x, y: valve.y - sim.player.h, vx: 0, vy: 0 });
sim.cameraX = valve.x - 400; sim.cameraY = 0;
let clock = 1000, opened = 0;
const step = app.step.bind(app);
app.step = (dt, input) => { step(dt, input); opened += sim.events.filter(event => event.kind === 'valve').length; };
const frame = () => { app.last = clock; clock += 1000 / 60; app.loop(clock); app.stopFrames(); };
frame(); app.canvas.focus(); app.renderGame();
// Compare the paper-colored glyph pixels inside the actual scene's opaque prompt,
// not source strings or a substitute renderer. The frame and background stay out.
const paper = [1, 3, 5].map(offset => parseInt(ART.paper.slice(offset, offset + 2), 16));
const mask = data => Array.from({ length: data.length / 4 }, (_, i) => {
    const offset = i * 4;
    return paper.every((value, channel) => data[offset + channel] === value) && data[offset + 3] === 255 ? '1' : '0';
}).join('');
const label = () => {
    app.renderGame();
    const canvas = app.presentation.renderer.worldCanvas, c = canvas.getContext('2d');
    const x = Math.max(29, Math.min(290, Math.round(valve.x / 3) - Math.round(sim.cameraX / 3)));
    const y = Math.round(valve.y / 3) - Math.round(sim.cameraY / 3);
    const actual = mask(c.getImageData(x - 27, y - 62, 56, 8).data);
    if (!actual.includes('1')) throw Error('No prompt glyph pixels found');
    const expected = document.createElement('canvas'); expected.width = 58; expected.height = 12;
    const context = expected.getContext('2d');
    for (const value of ['ABRIR', 'E: ABRIR', 'ABERTA']) {
        context.clearRect(0, 0, 58, 12); pixelText(context, value, 29, 3, ART.paper, 1, 'center');
        const reference = mask(context.getImageData(1, 2, 56, 8).data);
        if (!reference.includes('1')) throw Error('Empty reference glyph mask');
        if (reference === actual) return value;
    }
    return 'unrecognized prompt';
};
window.h = { app, sim, valve, frame, label, keyAction, textWidth, count: () => opened,
    initialSave: JSON.stringify(app.store.save), initialStorage: JSON.stringify(Object.fromEntries(Object.entries(localStorage))),
    padButton(index, pressed) { pad.buttons[index].pressed = pressed; pad.buttons[index].value = Number(pressed); frame(); }
};
</script></body></html>`;

before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'delicia-valve-prompt', configureServer(vite) {
            vite.middlewares.use('/valve-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, mode) {
    const context = await browser.newContext({ viewport: mode === 'touch' ? { width: 360, height: 640 } : { width: 1280, height: 720 },
        hasTouch: mode === 'touch', reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'only loopback requests'); return route.continue();
    });
    await page.addInitScript(mode => {
        window.AudioContext = undefined; window.fetch = async () => ({ ok: false });
        window.pad = mode === 'gamepad' ? { id: 'Valve fixture', index: 0, mapping: 'standard', connected: true,
            axes: [0, 0, 0, 0], buttons: Array.from({ length: 24 }, () => ({ pressed: false, value: 0 })) } : null;
        navigator.getGamepads = () => pad ? [pad] : [];
        localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ keys: { interact: [mode === 'keyboard-default' ? 'KeyE' : 'KeyK'] },
            pads: { 'standard:Valve fixture': { bindings: { interact: [{ button: 17 }] } } } }));
        localStorage.setItem('super_feka_gaps_world_v1', 'unchanged');
    }, mode);
    t.after(async () => {
        try {
            assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => JSON.stringify(h.app.store.save) === h.initialSave), true);
            assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))) === h.initialStorage), true);
            assert.equal(await page.evaluate(() => h.app.sim === h.sim && h.app.screen === 'playing'), true);
            await page.evaluate(() => h.app.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/valve-fixture', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.h);
    return page;
}

for (const mode of ['keyboard-default', 'keyboard-remapped', 'gamepad', 'touch']) {
    test(`${mode}: valve hint names its action while configured input opens it once`, async t => {
        const page = await setup(t, mode);
        const key = mode === 'keyboard-default' ? 'KeyE' : 'KeyK', inactive = mode === 'keyboard-default' ? 'KeyK' : 'KeyE';
        const initial = await page.evaluate(({ key, inactive }) => ({ label: h.label(), inactive: h.keyAction(inactive) ?? null,
            active: h.keyAction(key), nearby: h.sim.nearbyValve.id === h.valve.id, fits: h.textWidth('ABRIR') <= 54 }), { key, inactive });
        assert.equal(initial.nearby, true); assert.equal(initial.inactive, null); assert.equal(initial.active, 'interact');
        if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/${mode}-closed.png` });
        if (mode.startsWith('keyboard')) {
            await page.keyboard.down(inactive); await page.evaluate(() => h.frame()); await page.keyboard.up(inactive);
            assert.equal(await page.evaluate(() => h.sim.valves.size), 0, 'An unbound key cannot open the valve.');
            await page.keyboard.down(key); await page.evaluate(() => h.frame()); await page.keyboard.up(key);
            await page.evaluate(() => h.frame());
        } else if (mode === 'gamepad') {
            await page.evaluate(() => { h.padButton(5, true); h.padButton(5, false); });
            assert.equal(await page.evaluate(() => h.sim.valves.size), 0, 'The old gamepad binding is inactive.');
            await page.evaluate(() => { h.padButton(17, true); h.padButton(17, false); });
        } else {
            const button = page.getByRole('button', { name: 'Abrir', exact: true });
            assert.equal(await button.isVisible(), true); await button.tap(); await page.evaluate(() => h.frame());
        }
        assert.equal(await page.evaluate(() => h.sim.valves.has(h.valve.id)), true);
        const active = await page.evaluate(() => ({ label: h.label(), opened: h.count() }));
        assert.equal(active.opened, 1); assert.equal(active.label, 'ABERTA');
        if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/${mode}-open.png` });
        t.diagnostic(JSON.stringify({ mode, initial, active }));
        assert.equal(initial.fits, true); assert.equal(initial.label, 'ABRIR');
    });
}
