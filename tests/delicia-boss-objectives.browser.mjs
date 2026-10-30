/** Local Chromium: encounter objectives, real valve/seed/gate contacts and saved checkpoint.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-boss-objectives.browser.mjs
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
const number = Number(new URL(location.href).searchParams.get('stage')), id = 'delicia-' + number;
const initial = freshDeliciaSave(); initial.music = .2; initial.effects = .4;
initial.completed = Array.from({ length: number - 1 }, (_, i) => 'delicia-' + (i + 1));
initial.selected = id; initial.checkpoint = { stage: id, index: 0, valves: [] };
localStorage.setItem(DELICIA_SAVE_KEY, JSON.stringify(initial));
const app = new DeliciaApp(document.body, { store: new DeliciaStore(localStorage, false) });
app.stopFrames(); if (!app.loadStage(id, true)) throw Error('Stage did not load');
app.stopFrames(); app.renderGame();
window.h = { app, initial, id, keyAction, noDeliciaInput,
    hud: app.presentation.hud.root, raw: localStorage.getItem(DELICIA_SAVE_KEY),
    controls: localStorage.getItem('super_feka_gaps_controls_v1'),
    step: input => { app.step(1 / 120, input ?? noDeliciaInput()); app.pressed.clear(); app.released.clear(); app.renderGame(); },
    hit: fatal => {
        const sim = app.sim, boss = sim.boss;
        // Prepare a vulnerability window; damage and defeat use real seed collision.
        boss.update(1, sim.player); boss.beat = 'recover'; boss.openValve();
        if (fatal) { boss.hp = 1; boss.phase = 3; }
        sim.projectiles.push({ x: boss.x + 5, y: boss.y + 50, w: 12, h: 10,
            vx: 0, vy: 0, gravity: 0, kind: 'seed', life: 1, friendly: true });
        h.step();
    },
};
</script></body></html>`;

before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'delicia-boss-objectives', configureServer(vite) {
            vite.middlewares.use('/objectives-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        } }] });
    await server.listen(); base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, number, compact) {
    const context = await browser.newContext({ viewport: compact ? { width: 360, height: 640 } : { width: 1280, height: 720 }, hasTouch: compact });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'Only loopback requests.'); return route.continue();
    });
    await page.addInitScript(() => {
        window.AudioContext = undefined; navigator.getGamepads = () => []; window.fetch = async () => ({ ok: false });
        localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({ keys: { jump: ['KeyK'], run: ['KeyV'], interact: ['KeyL'] } }));
        localStorage.setItem('super_feka_gaps_world_v1', 'untouched-world-save');
    });
    t.after(async () => {
        try {
            assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_gaps_controls_v1') === h.controls), true);
            assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_gaps_world_v1')), 'untouched-world-save');
            assert.deepEqual(await page.evaluate(() => ['KeyK', 'KeyV', 'KeyL'].map(h.keyAction)), ['jump', 'run', 'interact']);
            await page.evaluate(() => h.app.dispose());
        } finally { await context.close(); }
    });
    await page.goto(base + '/objectives-fixture?stage=' + number); await page.waitForFunction(() => !!window.h);
    return page;
}

async function describe(page, compact) {
    const data = await page.evaluate(async () => {
        const sim = h.app.sim, focus = document.activeElement;
        const snapshot = () => JSON.stringify(sim, (_key, value) => value instanceof Map || value instanceof Set ? [...value] : value);
        const before = snapshot();
        const records = [], observer = new MutationObserver(changes => records.push(...changes));
        observer.observe(h.hud, { attributes: true, childList: true, subtree: true });
        for (let frame = 0; frame < 10; frame++) h.app.renderGame();
        await Promise.resolve(); observer.disconnect();
        const span = h.hud.querySelector('span'), style = getComputedStyle(span), rect = span.getBoundingClientRect();
        return { label: h.hud.getAttribute('aria-label'), text: span.textContent,
            visible: !span.hidden && style.visibility === 'visible',
            fits: span.scrollWidth <= span.clientWidth && rect.left >= 0 && rect.right <= innerWidth,
            health: sim.player.health, hp: sim.boss?.hp, maxHp: sim.boss?.maxHp,
            gate: sim.gateOpen, finished: sim.finished, valves: [...sim.valves],
            seals: sim.stage.pickups.filter(p => p.kind === 'seal').length,
            checkpoint: sim.checkpoint, live: h.hud.getAttribute('aria-live'), mutations: records.length,
            sameFocus: focus === document.activeElement, unchanged: sim === h.app.sim && before === snapshot() };
    });
    const cdp = await page.context().newCDPSession(page);
    try {
        const { nodes } = await cdp.send('Accessibility.getFullAXTree');
        data.accessibleName = nodes.find(node => node.role?.value === 'group' && node.name?.value.startsWith('D-'))?.name?.value;
    } finally { await cdp.detach(); }
    assert.equal(data.label, data.text); assert.equal(data.accessibleName, data.label);
    assert.equal(data.visible, compact); if (compact) assert.equal(data.fits, true);
    assert.equal(data.sameFocus, true); assert.equal(data.unchanged, true);
    assert.equal(data.mutations, 0); assert.equal(data.live, null, 'No unsolicited announcement on every frame.');
    return data;
}

async function interact(page) {
    await page.keyboard.down('KeyL'); await page.evaluate(() => h.step(h.app.input())); await page.keyboard.up('KeyL');
}
async function screenshot(page, name) {
    if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: process.env.BROWSER_ARTIFACT_DIR + '/' + name + '.png' });
}

for (const compact of [false, true]) for (const number of [6, 12]) {
    test(`D-${number}, ${compact ? 'compact' : 'desktop'}: objectives follow the encounter, defeat and saved checkpoint`, async t => {
        const page = await setup(t, number, compact), name = number === 6 ? 'Jajá' : 'Guina';
        const states = [await describe(page, compact)];
        await screenshot(page, `${number}-${compact ? 'compact' : 'desktop'}-initial`);
        assert.equal(states[0].seals, 0); assert.equal(states[0].gate, false); assert.equal(states[0].checkpoint, 0);
        await page.evaluate(() => {
            const sim = h.app.sim, valve = sim.stage.valves[0];
            Object.assign(sim.player, { x: valve.x, y: valve.y - sim.player.h, invincible: 10 });
            sim.boss.pressure = 70; sim.boss.shield = true;
        });
        await interact(page); states.push(await describe(page, compact));
        assert.deepEqual(await page.evaluate(() => [h.app.sim.boss.pressure, h.app.sim.boss.shield, h.app.sim.valveReady('left')]), [25, false, false]);
        assert.equal(states[1].hp, states[0].hp); assert.deepEqual(states[1].valves, []); assert.equal(states[1].gate, false);
        await page.evaluate(() => h.hit(false)); states.push(await describe(page, compact));
        assert.equal(states[2].hp, states[0].hp - 1); assert.equal(states[2].gate, false);
        await page.evaluate(() => h.hit(true)); states.push(await describe(page, compact));
        assert.equal(states[3].hp, 0); assert.equal(states[3].gate, true); assert.equal(states[3].finished, false);
        await screenshot(page, `${number}-${compact ? 'compact' : 'desktop'}-open`);
        assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_delicia_v1') === h.raw), true, 'Combat and HUD do not alter checkpoint progress.');
        await page.evaluate(() => { h.previous = h.app.sim; h.app.loadStage(h.id, true); h.app.stopFrames(); h.app.renderGame(); });
        states.push(await describe(page, compact));
        assert.equal(await page.evaluate(() => h.previous !== h.app.sim), true);
        assert.equal(states[4].hp, states[0].maxHp); assert.equal(states[4].gate, false);
        assert.deepEqual(await page.evaluate(() => ({ x: h.app.sim.player.x, y: h.app.sim.player.y })), { x: 130, y: 378 });
        assert.equal(await page.evaluate(() => JSON.stringify(h.app.store.save) === JSON.stringify(h.initial)), true);
        // Defeat alone opens the gate; the gate contact still owns completion.
        await page.evaluate(() => {
            h.hit(true); const sim = h.app.sim;
            Object.assign(sim.player, { x: sim.stage.gate.x, y: sim.stage.gate.y, invincible: 10 }); h.step();
        });
        assert.deepEqual(await page.evaluate(() => [h.app.sim.finished, h.app.screen, h.hud.hidden]), [true, 'dialogue', true]);
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('super_feka_delicia_v1')));
        const initial = await page.evaluate(() => h.initial);
        assert.deepEqual(saved, { ...initial, completed: [...initial.completed, `delicia-${number}`],
            selected: `delicia-${number === 6 ? 7 : 12}`, checkpoint: null,
            lore: [...initial.lore, ...(number === 6 ? ['jaja'] : ['recomeço', 'delicia'])] });
        t.diagnostic(JSON.stringify({ number, compact, states }));
        const labels = [states[0], states[1], states[2], states[3], states[4]].map(state => state.label);
        assert.deepEqual(labels, [states[0].maxHp, states[0].maxHp, states[0].maxHp - 1, 0, states[0].maxHp].map(hp =>
            `D-${number} · 4 vidas · ${hp > 0 ? `${name}: ${hp}/${states[0].maxHp}` : 'Portão aberto'}`));
    });
}

for (const compact of [false, true]) test(`traversal, ${compact ? 'compact' : 'desktop'}: collectible and permanent valve counts remain accurate`, async t => {
    const page = await setup(t, 1, compact), states = [await describe(page, compact)];
    await page.evaluate(() => {
        const sim = h.app.sim, valve = sim.stage.valves[0];
        Object.assign(sim.player, { x: valve.x, y: valve.y - sim.player.h, invincible: 10 });
    });
    await interact(page); states.push(await describe(page, compact));
    await page.evaluate(() => {
        const sim = h.app.sim, seal = sim.stage.pickups.find(p => p.kind === 'seal');
        Object.assign(sim.player, { x: seal.x - sim.player.w / 2, y: seal.y - sim.player.h / 2, vx: 0, vy: 0 }); h.step();
    });
    states.push(await describe(page, compact));
    assert.deepEqual(states.map(state => state.label), [
        'D-1 · 4 vidas · 0 laranjas · 0/3 selos · 0/2 fontes',
        'D-1 · 4 vidas · 0 laranjas · 0/3 selos · 1/2 fontes',
        'D-1 · 4 vidas · 0 laranjas · 1/3 selos · 1/2 fontes',
    ]);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('super_feka_delicia_v1'))), initial = await page.evaluate(() => h.initial);
    assert.deepEqual(saved, { ...initial, collected: ['delicia-1:s1'], checkpoint: { ...initial.checkpoint, valves: ['v5'] } });
    t.diagnostic(JSON.stringify({ compact, states }));
});
