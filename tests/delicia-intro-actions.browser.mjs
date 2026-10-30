/** Native dialogue, accessibility tree and input routing; loopback only.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-intro-actions.browser.mjs
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
import { DELICIA_STAGES } from '/src/adventure/delicia/DeliciaContent.ts';
import { DeliciaArt } from '/src/adventure/delicia/DeliciaArt.ts';
import { selectGamepad } from '/src/engine/GamepadDevice.ts';
import { keyAction, profileFor } from '/src/engine/ControlPreferences.ts';
DeliciaArt.prototype.load = async () => {};
const number = Number(new URL(location.href).searchParams.get('stage'));
const save = freshDeliciaSave(); save.completed = DELICIA_STAGES.slice(0, number - 1).map(s => s.id);
localStorage.setItem('super_feka_delicia_v1', JSON.stringify(save));
selectGamepad(pad);
const app = new DeliciaApp(document.body, { store: new DeliciaStore(localStorage, false) });
app.stopFrames();
const announced = [], voices = [], announce = app.announce.bind(app), voice = app.audio.voice.bind(app.audio);
app.announce = message => { announce(message); announced.push({ message, text: app.status.textContent,
    role: app.status.getAttribute('role'), live: app.status.getAttribute('aria-live') }); };
app.audio.voice = name => { voices.push(name); voice(name); };
if (!app.loadStage('delicia-' + number)) throw Error('Stage did not unlock');
app.stopFrames();
let advances = 0, completions = 0;
const advance = app.advanceDialogue.bind(app), done = app.dialogueDone;
app.advanceDialogue = () => { advances++; advance(); };
app.dialogueDone = () => { completions++; done(); };
const sim = app.sim, initialSave = JSON.stringify(app.store.save), initialStorage = JSON.stringify(Object.fromEntries(Object.entries(localStorage)));
window.h = { app, sim, announced, voices, keyAction, profileFor, initialSave, initialStorage,
    counts: () => ({ advances, completions }),
    input() { app.last = 1000; app.loop(1000); app.stopFrames(); return app.input(); },
    padButton(index, pressed) { pad.buttons[index].pressed = pressed; pad.buttons[index].value = Number(pressed); app.pollGamepad(); },
};
</script></body></html>`;

before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'delicia-intro-actions', configureServer(vite) {
            vite.middlewares.use('/intro-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, stage, mode) {
    const context = await browser.newContext({ viewport: mode === 'touch' ? { width: 360, height: 640 } : { width: 1280, height: 720 },
        hasTouch: mode === 'touch', reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'only loopback requests'); return route.continue();
    });
    await page.addInitScript(mode => {
        // Keep audio hardware outside this text/input check; no audio source or file is changed.
        window.AudioContext = undefined;
        window.pad = mode === 'gamepad' ? { id: 'Intro fixture', index: 0, mapping: 'standard', connected: true,
            axes: [0, 0, 0, 0], buttons: Array.from({ length: 32 }, () => ({ pressed: false, value: 0 })) } : null;
        navigator.getGamepads = () => pad ? [pad] : [];
        localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ keys: { run: ['KeyV'], parry: ['KeyB'] },
            pads: { 'standard:Intro fixture': { bindings: { run: [{ button: 17 }], parry: [{ button: 18 }], confirm: [{ button: 19 }] } } } }));
        localStorage.setItem('super_feka_gaps_world_v1', 'unchanged');
    }, mode);
    t.after(async () => {
        try {
            assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => JSON.stringify(h.app.store.save)), await page.evaluate(() => h.initialSave));
            assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage)))), await page.evaluate(() => h.initialStorage));
            assert.equal(await page.evaluate(() => h.app.sim === h.sim && h.sim.elapsed === 0), true);
            await page.evaluate(() => h.app.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/intro-fixture?stage=' + stage, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.h);
    await page.getByRole('button', { name: 'CONTINUAR', exact: true }).focus();
    return page;
}

async function confirm(page, mode) {
    if (mode === 'gamepad') await page.evaluate(() => { h.padButton(19, false); h.padButton(19, true); h.padButton(19, false); });
    else if (mode === 'touch') await page.getByRole('button', { name: 'CONTINUAR', exact: true }).tap();
    else await page.keyboard.press('Enter');
}
const expected = {
    7: 'A nascente voltou a correr! Segure Correr e salte nas travessias. As balsas ajudam a alcançar a outra margem.',
    8: 'As esteiras empurram você. Use Rebater contra os projéteis: latão contra latão.',
};
for (const stage of [7, 8]) for (const mode of ['keyboard', 'gamepad', 'touch']) {
    test(`stage ${stage}, ${mode}: action-based intro is displayed, announced and continued exactly once`, async t => {
        const page = await setup(t, stage, mode);
        const state = await page.evaluate(() => ({ text: h.app.menu.text,
            label: h.app.presentation.menus.root.getAttribute('aria-label'),
            announced: h.announced, voices: h.voices,
            keys: ['ShiftLeft', 'KeyQ', 'KeyV', 'KeyB'].map(code => h.keyAction(code) ?? null) }));
        t.diagnostic(JSON.stringify({ stage, mode, ...state }));
        assert.deepEqual(state.keys, [null, null, 'run', 'parry']);
        assert.equal(state.label, 'Jajá: ' + state.text);
        assert.deepEqual(state.announced[0], { message: state.label, text: state.label, role: 'status', live: 'polite' });
        assert.deepEqual(state.voices, [''], 'Neither edited introduction selects a dubbed line.');
        const cdp = await page.context().newCDPSession(page);
        try {
            const { nodes } = await cdp.send('Accessibility.getFullAXTree');
            assert.ok(nodes.some(node => node.name?.value === state.label));
            assert.ok(nodes.some(node => node.role?.value === 'button' && node.name?.value === 'CONTINUAR'));
        } finally { await cdp.detach(); }
        await confirm(page, mode);
        assert.equal(await page.evaluate(() => h.app.screen), 'dialogue', 'First activation only reveals the sentence.');
        assert.equal(await page.evaluate(() => h.app.dialogueTime === Infinity), true);
        assert.deepEqual(await page.evaluate(() => h.counts()), { advances: 1, completions: 0 });
        if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/stage-${stage}-${mode}.png` });
        await confirm(page, mode);
        assert.equal(await page.evaluate(() => h.app.screen), 'playing');
        assert.deepEqual(await page.evaluate(() => h.counts()), { advances: 2, completions: 1 });
        assert.equal(await page.locator('.dl-canvas').evaluate(node => node === document.activeElement), true);
        if (mode === 'keyboard') {
            for (const [key, action, active] of [['ShiftLeft', 'run', false], ['KeyQ', 'parry', false], ['KeyV', 'run', true], ['KeyB', 'parry', true]]) {
                await page.keyboard.down(key);
                assert.equal((await page.evaluate(() => h.input()))[action], active);
                await page.keyboard.up(key); await page.evaluate(() => h.app.resetInput());
            }
        } else if (mode === 'gamepad') {
            await page.evaluate(() => h.app.pollGamepad());
            for (const [button, action] of [[17, 'run'], [18, 'parry']]) {
                await page.evaluate(() => h.app.pollGamepad()); // Observe neutral after the preceding reset.
                await page.evaluate(button => h.padButton(button, true), button);
                assert.equal((await page.evaluate(() => h.input()))[action], true, `Mapped gamepad ${action} remains active.`);
                await page.evaluate(button => { h.padButton(button, false); h.app.resetInput(); }, button);
            }
        }
        assert.equal(state.text, expected[stage]);
    });
}
