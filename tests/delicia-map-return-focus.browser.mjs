/** Real local map, DOM focus, gamepad reader and checkpoint entry; loopback only.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-map-return-focus.browser.mjs
 * PLAYWRIGHT_MODULE may select an existing Playwright installation.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body><canvas id="game"></canvas><script type="module">
import '/src/adventure/map.css';
import { WorldMapView } from '/src/adventure/WorldMapView.ts';
import { freshSave } from '/src/adventure/progress.ts';
import { DeliciaApp } from '/src/adventure/delicia/DeliciaApp.ts';
import { freshDeliciaSave, DELICIA_SAVE_KEY } from '/src/adventure/delicia/DeliciaProgress.ts';
import { DELICIA_STAGES } from '/src/adventure/delicia/DeliciaContent.ts';
import { GamepadDevice, selectGamepad } from '/src/engine/GamepadDevice.ts';
import { keyAction } from '/src/engine/ControlPreferences.ts';
const initial = freshDeliciaSave();
initial.completed = ['delicia-1']; initial.selected = 'delicia-2'; initial.reducedMotion = true;
initial.checkpoint = { stage: 'delicia-2', index: 1, valves: [DELICIA_STAGES[1].valves[0].id] };
initial.music = .2; initial.effects = .4;
localStorage.setItem(DELICIA_SAVE_KEY, JSON.stringify(initial));
const raw = localStorage.getItem(DELICIA_SAVE_KEY), save = freshSave(), world = JSON.stringify(save), entries = [];
let app = null;
const view = new WorldMapView(document.querySelector('#game'), {
    select() {}, enter() { throw Error('Unexpected World stage entry'); }, exit() {}, unlockAudio() {},
    guaira() { throw Error('Unexpected Guaíra entry'); },
    enterChapter(chapter, stage) {
        entries.push([chapter, stage]); view.hide();
        app = new DeliciaApp(document.body, { store: view.deliciaStore, initialStage: stage, returnToWorldMap() {} });
        app.stopFrames();
    },
});
let clock = 0;
const frame = () => { if (!app) view.render(0, save, clock += 16.67, ''); };
frame(); view.openChapter('delicia');
const timer = setInterval(frame, 16), device = new GamepadDevice(); selectGamepad(pad);
const poll = () => { const command = device.menu(view.controllerOwner()); if (command) view.control(command); };
poll();
window.h = { view, save, world, initial, raw, entries, keyAction, get app() { return app; },
    controls: localStorage.getItem('super_feka_gaps_controls_v1'),
    press(index) { poll(); pad.buttons[index] = { pressed: true, value: 1 }; poll(); poll(); poll();
        pad.buttons[index] = { pressed: false, value: 0 }; poll(); },
    state: () => ({ chapter: view.chapter, overview: view.overview, owner: view.controllerOwner(),
        focus: document.activeElement.className, focusInMap: view.root.contains(document.activeElement),
        selected: view.deliciaStore.save.selected, entries: [...entries] }),
    dispose() { clearInterval(timer); device.dispose(); app?.dispose(); view.dispose(); },
};
</script></body></html>`;

before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'delicia-map-return-focus', configureServer(vite) {
            vite.middlewares.use('/map-return-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, compact) {
    const context = await browser.newContext({ viewport: compact ? { width: 360, height: 640 } : { width: 1280, height: 720 }, hasTouch: compact });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'only loopback requests'); return route.continue();
    });
    await page.addInitScript(() => {
        window.AudioContext = undefined;
        window.pad = { id: 'Map return fixture', index: 0, mapping: 'standard', connected: true,
            axes: [0, 0, 0, 0], buttons: Array.from({ length: 24 }, () => ({ pressed: false, value: 0 })) };
        navigator.getGamepads = () => [pad];
        localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ keys: { jump: ['KeyK'], run: ['KeyV'] },
            pads: { 'standard:Map return fixture': { bindings: { back: [{ button: 19 }], confirm: [{ button: 18 }] } } } }));
        localStorage.setItem('super_feka_gaps_world_v1', 'untouched-world-save');
    });
    t.after(async () => {
        try {
            assert.deepEqual(errors, []);
            assert.deepEqual(await page.evaluate(() => h.view.deliciaStore.save), await page.evaluate(() => h.initial));
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_delicia_v1') === h.raw), true);
            assert.equal(await page.evaluate(() => JSON.stringify(h.save) === h.world), true);
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_gaps_controls_v1') === h.controls), true);
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_gaps_world_v1')), 'untouched-world-save');
            assert.deepEqual(await page.evaluate(() => ['KeyK', 'KeyV'].map(h.keyAction)), ['jump', 'run']);
            await page.evaluate(() => h.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/map-return-fixture');
    await page.waitForFunction(() => window.h && !h.view.hud.chapterButtons[1].hidden);
    assert.equal(await page.evaluate(() => getComputedStyle(h.view.root).position), 'fixed', 'Use the campaign map stylesheet.');
    return page;
}

async function command(page, mode, command) {
    if (mode === 'keyboard') await page.keyboard.press({ back: 'Escape', right: 'ArrowRight', left: 'ArrowLeft', confirm: 'Enter' }[command]);
    else await page.evaluate(index => h.press(index), { back: 19, right: 15, left: 14, confirm: 18 }[command]);
}

for (const compact of [false, true]) for (const mode of ['keyboard', 'gamepad']) {
    test(`${mode}, ${compact ? 'compact' : 'desktop'}: cancel retains map navigation and reentry resumes the saved checkpoint once`, async t => {
        const page = await setup(t, compact);
        await page.evaluate(() => h.view.hud.chapterButtons[1].focus());
        assert.equal(await page.evaluate(() => h.view.controllerOwner()), 'delicia:idle');
        await command(page, mode, 'back');
        const returned = await page.evaluate(() => h.state()); t.diagnostic(JSON.stringify(returned));
        if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/${mode}-${compact ? 'compact' : 'desktop'}-return.png` });
        assert.equal(returned.chapter, null); assert.equal(returned.overview, true);
        assert.equal(returned.focusInMap, true, 'Hiding a focused chapter sign must retain the map focus.');
        assert.equal(returned.owner, 'overview:idle'); assert.deepEqual(returned.entries, []);
        // Continue with the same device, without repairing focus through a click.
        await page.waitForFunction(() => h.view.hud.overviewFallback || !h.view.hud.deliciaOverview.hidden);
        for (let count = 0; count < 10; count++) {
            if (await page.evaluate(() => [h.view.hud.deliciaOverview, h.view.hud.deliciaRegion].includes(document.activeElement))) break;
            await command(page, mode, 'right');
        }
        assert.equal(await page.evaluate(() => [h.view.hud.deliciaOverview, h.view.hud.deliciaRegion].includes(document.activeElement)), true);
        await command(page, mode, 'confirm');
        assert.equal(await page.evaluate(() => h.view.chapter), 'delicia');
        assert.equal(await page.evaluate(() => h.view.chapterStages[h.view.chapterIndex].id), 'delicia-2');
        await command(page, mode, 'right'); // Phase 3 is inspectable, still locked.
        assert.equal(await page.evaluate(() => h.view.hud.enterButton.disabled), true);
        await command(page, mode, 'confirm');
        assert.deepEqual(await page.evaluate(() => h.entries), []);
        await command(page, mode, 'left');
        await command(page, mode, 'confirm');
        assert.deepEqual(await page.evaluate(() => h.entries), [['delicia', 'delicia-2']]);
        const resumed = await page.evaluate(() => ({ stage: h.app.sim.stage.id, checkpoint: h.app.sim.checkpoint,
            position: { x: h.app.sim.player.x, y: h.app.sim.player.y }, expected: h.app.sim.stage.checkpoints[1],
            valves: [...h.app.sim.valves], expectedValves: h.initial.checkpoint.valves, recordEligible: h.app.sim.recordEligible }));
        assert.equal(resumed.stage, 'delicia-2'); assert.equal(resumed.checkpoint, 1);
        assert.deepEqual(resumed.position, resumed.expected); assert.deepEqual(resumed.valves, resumed.expectedValves);
        assert.equal(resumed.recordEligible, false);
    });
}

for (const compact of [false, true]) test(`${compact ? 'touch' : 'pointer'}: the persistent World control retains its own focus on chapter exit`, async t => {
    const page = await setup(t, compact), world = page.getByRole('button', { name: 'Ver mundo', exact: true });
    if (compact) await world.tap(); else await world.click();
    assert.equal(await page.evaluate(() => h.view.chapter), null);
    assert.equal(await page.evaluate(() => document.activeElement === h.view.hud.overviewButton), true);
    assert.equal(await page.evaluate(() => h.view.controllerOwner()), 'overview:idle');
    assert.deepEqual(await page.evaluate(() => h.entries), []);
});
