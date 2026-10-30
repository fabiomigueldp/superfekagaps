/** Attempt-owned records through real settings, death and retry menus. Loopback only.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-attempt-records.browser.mjs
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
import { DELICIA_STAGES } from '/src/adventure/delicia/DeliciaContent.ts';
import { noDeliciaInput } from '/src/adventure/delicia/DeliciaSimulation.ts';
import { keyAction } from '/src/engine/ControlPreferences.ts';
const initial = freshDeliciaSave(), stage = DELICIA_STAGES[0];
initial.assists = new URL(location.href).searchParams.get('assists') === 'true';
initial.completed = [stage.id]; initial.times[stage.id] = 90; initial.medals[stage.id] = ['seals'];
initial.collected = stage.pickups.filter(p => p.kind === 'seal').map(p => p.id);
initial.music = .2; initial.effects = .4; initial.reducedMotion = true;
localStorage.setItem(DELICIA_SAVE_KEY, JSON.stringify(initial));
let returns = 0, loads = 0;
const app = new DeliciaApp(document.body, { store: new DeliciaStore(localStorage, false), returnToWorldMap() { returns++; } });
app.stopFrames();
const load = app.loadStage.bind(app); app.loadStage = (...args) => { loads++; return load(...args); };
app.loadStage(stage.id, true); app.stopFrames(); app.renderGame();
const first = app.sim;
window.h = { app, initial, first, keyAction, loads: () => loads, returns: () => returns,
    controls: localStorage.getItem('super_feka_gaps_controls_v1'), stored: () => JSON.parse(localStorage.getItem(DELICIA_SAVE_KEY)),
    checkpoint() {
        const sim = app.sim, valve = stage.valves[0], cp = stage.checkpoints[1];
        Object.assign(sim.player, { x: valve.x, y: valve.y - sim.player.h, vx: 0, vy: 0, invincible: 2 });
        app.step(1 / 120, { ...noDeliciaInput(), interact: true });
        Object.assign(sim.player, { x: cp.x, y: cp.y, vx: 0, vy: 0 }); app.step(1 / 120, noDeliciaInput());
        return { checkpoint: app.store.save.checkpoint, opened: sim.valves.has(valve.id) };
    },
    die() {
        Object.assign(app.sim.player, { x: stage.spawn.x, y: stage.height, vx: 0, vy: 0, health: 1, invincible: 0 });
        app.step(1 / 120, noDeliciaInput()); app.renderGame();
        return { screen: app.screen, dead: app.sim.dead, finished: app.sim.finished, saved: structuredClone(app.store.save) };
    },
    finish() {
        const sim = app.sim; sim.elapsed = 30;
        stage.valves.forEach(valve => sim.valves.add(valve.id));
        Object.assign(sim.player, { x: stage.gate.x, y: stage.gate.y, vx: 0, vy: 0, invincible: 2 });
        app.step(1 / 120, noDeliciaInput()); app.renderGame();
        return { screen: app.screen, finished: sim.finished, elapsed: sim.elapsed, eligible: sim.recordEligible,
            assists: sim.assists, saved: structuredClone(app.store.save), label: app.presentation.menus.root.getAttribute('aria-label') };
    },
};
</script></body></html>`;

before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'delicia-attempt-records', configureServer(vite) {
            vite.middlewares.use('/attempt-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, assists, touch) {
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
            assert.deepEqual(await page.evaluate(() => h.stored()), await page.evaluate(() => h.app.store.save));
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_gaps_controls_v1') === h.controls), true);
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_gaps_world_v1')), 'untouched-world-save');
            assert.deepEqual(await page.evaluate(() => ['KeyK', 'KeyV'].map(h.keyAction)), ['jump', 'run']);
            await page.evaluate(() => h.app.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/attempt-fixture?assists=' + assists); await page.waitForFunction(() => !!window.h);
    return page;
}
async function activate(page, label, touch, scope = page) {
    const button = scope.getByRole('button', { name: label, exact: true });
    if (touch) await button.tap(); else { await button.focus(); await page.keyboard.press('Enter'); }
}

for (const touch of [false, true]) for (const assists of [false, true]) for (const path of ['finish', 'retry', 'checkpoint']) {
    test(`${touch ? 'touch' : 'keyboard'}, assists=${assists}, ${path}: rewards use the attempt and retry applies the next preference`, async t => {
        const page = await setup(t, assists, touch);
        const initial = await page.evaluate(() => structuredClone(h.initial));
        let checkpoint = null;
        if (path === 'checkpoint') {
            const reached = await page.evaluate(() => h.checkpoint());
            assert.equal(reached.opened, true); checkpoint = reached.checkpoint;
            assert.equal(checkpoint.index, 1); assert.equal(checkpoint.valves.length, 1);
        }
        if (touch) await page.getByRole('button', { name: 'Pausar', exact: true }).tap();
        else await page.keyboard.press('Escape');
        await activate(page, 'OPÇÕES', touch); await activate(page, 'CONTROLES', touch);
        const dialog = page.getByRole('dialog', { name: 'CONTROLES', exact: true });
        const option = dialog.getByRole('checkbox', { name: /Mais vida e avisos longos/ });
        assert.match(await option.getAttribute('aria-label') || await option.evaluate(node => node.parentElement.textContent), /Vale na próxima fase/);
        if (touch) await option.tap(); else { await option.focus(); await page.keyboard.press('Space'); }
        assert.equal(await option.isChecked(), !assists);
        assert.deepEqual(await page.evaluate(() => h.app.store.save), { ...initial, checkpoint, assists: !assists });
        assert.equal(await page.evaluate(() => h.app.sim === h.first && h.app.sim.assists === h.initial.assists), true);
        assert.equal(await page.evaluate(() => h.app.sim.player.health), assists ? 6 : 4);
        await activate(page, 'VOLTAR', touch, dialog); await activate(page, 'VOLTAR', touch); await activate(page, 'CONTINUAR', touch);
        assert.equal(await page.evaluate(() => h.app.screen), 'playing');
        if (path !== 'finish') {
            const dead = await page.evaluate(() => h.die());
            assert.equal(dead.dead, true); assert.equal(dead.finished, false); assert.equal(dead.screen, 'dead');
            assert.deepEqual(dead.saved, { ...initial, checkpoint, assists: !assists }, 'Death cannot award or erase progress.');
            await activate(page, 'TENTAR DE NOVO', touch);
            const retried = await page.evaluate(() => ({ screen: h.app.screen, changed: h.app.sim !== h.first,
                assists: h.app.sim.assists, health: h.app.sim.player.health, checkpoint: h.app.sim.checkpoint,
                position: { x: h.app.sim.player.x, y: h.app.sim.player.y },
                expected: h.app.store.save.checkpoint ? h.app.sim.stage.checkpoints[1] : h.app.sim.stage.spawn,
                valves: [...h.app.sim.valves], loads: h.loads(), elapsed: h.app.sim.elapsed, damage: h.app.sim.damageTaken }));
            assert.equal(retried.screen, 'playing'); assert.equal(retried.changed, true); assert.equal(retried.loads, 2);
            assert.equal(retried.assists, !assists); assert.equal(retried.health, assists ? 4 : 6);
            assert.equal(retried.checkpoint, checkpoint ? 1 : -1); assert.deepEqual(retried.position, retried.expected);
            assert.deepEqual(retried.valves, checkpoint?.valves ?? []); assert.equal(retried.elapsed, 0); assert.equal(retried.damage, 0);
        }
        const result = await page.evaluate(() => h.finish()), eligible = path === 'finish' ? !assists : path === 'retry' && assists;
        assert.equal(result.screen, 'clear'); assert.equal(result.finished, true); assert.equal(result.eligible, eligible);
        t.diagnostic(JSON.stringify({ touch, assists, path, eligible, savedTime: result.saved.times['delicia-1'], label: result.label }));
        if (process.env.BROWSER_ARTIFACT_DIR && path === 'finish')
            await page.screenshot({ path: `${process.env.BROWSER_ARTIFACT_DIR}/${touch ? 'touch' : 'keyboard'}-${assists ? 'assisted' : 'normal'}.png` });
        assert.deepEqual(result.saved, { ...initial, assists: !assists, selected: 'delicia-2', checkpoint: null,
            times: { 'delicia-1': eligible ? result.elapsed : 90 }, medals: { 'delicia-1': eligible ? ['seals', 'clean', 'tempo'] : ['seals'] } });
        if (eligible) assert.match(result.label, /Travessia sem dano.*Os três selos.*Ritmo cítrico/);
        else assert.match(result.label, /SEM RECORDE/);
        const saved = await page.evaluate(() => JSON.stringify(h.app.store.save));
        await activate(page, 'SEGUIR VIAGEM', touch);
        assert.equal(await page.evaluate(() => h.returns()), 1);
        assert.equal(await page.evaluate(() => h.loads()), path === 'finish' ? 1 : 2);
        assert.equal(await page.evaluate(() => JSON.stringify(h.app.store.save)), saved);
    });
}
