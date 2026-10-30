/** Real completion/journal menus and Chromium accessibility tree; loopback only.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-menu-details.browser.mjs
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
import { DeliciaStore, freshDeliciaSave, DELICIA_SAVE_KEY } from '/src/adventure/delicia/DeliciaProgress.ts';
import { noDeliciaInput } from '/src/adventure/delicia/DeliciaSimulation.ts';
import { keyAction } from '/src/engine/ControlPreferences.ts';
const scenario = new URL(location.href).searchParams.get('scenario'), initial = freshDeliciaSave();
initial.music = .2; initial.effects = .4;
initial.assists = scenario === 'assisted';
if (scenario === 'checkpoint') initial.checkpoint = { stage: 'delicia-1', index: 0, valves: [] };
if (scenario === 'journal') initial.lore.push('origem');
localStorage.setItem(DELICIA_SAVE_KEY, JSON.stringify(initial));
let returns = 0, app;
app = new DeliciaApp(document.body, { store: new DeliciaStore(localStorage, false), returnToWorldMap: () => { returns++; app.dispose(); } });
app.stopFrames();
if (scenario === 'journal') app.openJournal(() => { returns++; app.showSettings(); });
else {
    if (!app.loadStage('delicia-1', true)) throw Error('Stage did not load');
    const sim = app.sim; sim.elapsed = scenario === 'eligible' ? 30 : 48; sim.coins = 7;
    for (const valve of sim.stage.valves) sim.valves.add(valve.id);
    for (const pickup of sim.stage.pickups) if (pickup.kind === 'seal') sim.collected.add(pickup.id);
    Object.assign(sim.player, { x: sim.stage.gate.x, y: sim.stage.gate.y, vx: 0, vy: 0, invincible: 2 });
    app.step(1 / 120, noDeliciaInput());
    if (app.screen !== 'clear' || !sim.finished) throw Error('Gate did not complete the stage');
}
app.stopFrames(); app.renderGame();
window.h = { app, initial, keyAction, sim: app.sim, returns: () => returns,
    root: app.presentation.menus.root, saved: JSON.stringify(app.store.save),
    raw: localStorage.getItem(DELICIA_SAVE_KEY), controls: localStorage.getItem('super_feka_gaps_controls_v1'),
    stored: () => JSON.parse(localStorage.getItem(DELICIA_SAVE_KEY)),
    detail: () => typeof app.menu.detail === 'function' ? app.menu.detail() : app.menu.detail,
};
</script></body></html>`;

before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'delicia-menu-details', configureServer(vite) {
            vite.middlewares.use('/details-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, scenario, touch) {
    const context = await browser.newContext({ viewport: touch ? { width: 360, height: 640 } : { width: 1280, height: 720 }, hasTouch: touch });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'only loopback requests'); return route.continue();
    });
    await page.addInitScript(() => {
        window.AudioContext = undefined; navigator.getGamepads = () => []; window.fetch = async () => ({ ok: false });
        localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ keys: { jump: ['KeyK'], run: ['KeyV'] } }));
        localStorage.setItem('super_feka_gaps_world_v1', 'untouched-world-save');
    });
    t.after(async () => {
        try {
            assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => JSON.stringify(h.app.store.save) === h.saved), true);
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_delicia_v1') === h.raw), true);
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_gaps_controls_v1') === h.controls), true);
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_gaps_world_v1')), 'untouched-world-save');
            assert.deepEqual(await page.evaluate(() => ['KeyK', 'KeyV'].map(h.keyAction)), ['jump', 'run']);
            assert.equal(await page.evaluate(() => h.app.sim === h.sim), true);
            await page.evaluate(() => h.app.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/details-fixture?scenario=' + scenario); await page.waitForFunction(() => !!window.h);
    return page;
}

async function describe(page) {
    const state = await page.evaluate(async () => {
        const root = h.root, buttons = [...root.querySelectorAll('button')], focus = document.activeElement;
        const mutations = [], observer = new MutationObserver(records => mutations.push(...records));
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] });
        for (let frame = 0; frame < 10; frame++) h.app.renderGame();
        await Promise.resolve(); observer.disconnect();
        return { title: h.app.menu.title, detail: h.detail(), label: root.getAttribute('aria-label'),
            sameFocus: document.activeElement === focus, focusedInMenu: root.contains(focus),
            sameButtons: buttons.every((button, index) => root.querySelectorAll('button')[index] === button),
            mutations: mutations.length, live: root.getAttribute('aria-live') };
    });
    const cdp = await page.context().newCDPSession(page);
    try {
        const { nodes } = await cdp.send('Accessibility.getFullAXTree');
        state.accessibleName = nodes.find(node => node.role?.value === 'navigation' && node.name?.value.startsWith(state.title))?.name?.value;
    } finally { await cdp.detach(); }
    assert.equal(state.sameFocus, true); assert.equal(state.focusedInMenu, true);
    assert.equal(state.sameButtons, true); assert.equal(state.mutations, 0); assert.equal(state.live, null);
    return state;
}
async function activate(page, label, touch) {
    const button = page.getByRole('button', { name: label, exact: true });
    if (touch) await button.tap(); else { await button.focus(); await page.keyboard.press('Enter'); }
}

for (const touch of [false, true]) for (const scenario of ['eligible', 'checkpoint', 'assisted', 'journal']) {
    test(`${scenario}, ${touch ? 'touch' : 'keyboard'}: visible menu details remain accessible through the actual flow`, async t => {
        const page = await setup(t, scenario, touch), first = await describe(page);
        if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/${scenario}-${touch ? 'touch' : 'keyboard'}.png` });
        const descriptions = [first];
        if (scenario === 'journal') {
            assert.match(first.detail, /PÁGINA 1\//);
            await activate(page, 'PRÓXIMA', touch); descriptions.push(await describe(page));
            assert.match(descriptions[1].detail, /PÁGINA 2\//);
            assert.notEqual(descriptions[1].label, first.label);
            await activate(page, 'VOLTAR', touch);
            assert.equal(await page.evaluate(() => h.app.screen), 'settings');
            assert.equal(await page.evaluate(() => h.root.getAttribute('aria-label')), 'OPÇÕES', 'No stale detail or separator on menus without a detail.');
        } else {
            const data = await page.evaluate(() => ({ saved: h.stored(), initial: h.initial, elapsed: h.sim.elapsed }));
            const eligible = scenario === 'eligible';
            assert.deepEqual(data.saved, { ...data.initial, completed: ['delicia-1'], selected: 'delicia-2', checkpoint: null,
                times: eligible ? { 'delicia-1': data.elapsed } : {}, medals: eligible ? { 'delicia-1': ['clean', 'seals', 'tempo'] } : {} });
            assert.equal(first.detail, eligible ? 'Travessia sem dano · Os três selos · Ritmo cítrico' : 'TEMPO PARCIAL · SEM RECORDE');
            await activate(page, 'SEGUIR VIAGEM', touch);
            assert.equal(await page.locator('.canvas-menu-accessibility').count(), 0);
        }
        assert.equal(await page.evaluate(() => h.returns()), 1, 'Continuation/return activates once.');
        t.diagnostic(JSON.stringify({ scenario, touch, descriptions }));
        for (const state of descriptions) {
            assert.ok(state.label.includes(state.detail), 'Native menu must include its visible detail.');
            assert.ok(state.accessibleName?.includes(state.detail), 'Chromium must expose the detail to assistive technology.');
        }
    });
}
