/** Chromium callback identity/owner checks for the real lazy-entry lifecycle.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/delicia-entry-lifecycle.browser.mjs
 * PLAYWRIGHT_MODULE may select an existing Playwright installation.
 * Only module delivery, the map boundary, gamepad, RAF and art loading are controlled.
 */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url)), directory = root + '.tmp/delicia-entry-lifecycle-browser';
await mkdir(directory, { recursive: true });
const originalOwner = await readFile(root + 'src/adventure/WorldGame.ts', 'utf8');
const source = ts.createSourceFile('WorldGame.ts', originalOwner, ts.ScriptTarget.Latest, true);
const ownerClass = source.statements.find(ts.isClassDeclaration);
const method = ownerClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(source) === 'mountChapter').getText(source);
assert.ok(method.includes("await import('./WorldChapterHost')"));
await writeFile(`${directory}/Owner.ts`, `// Diagnostic extraction: only lazy delivery is controlled.\nimport { installDomGamepad } from '/src/engine/DomGamepadMenu.ts';\nexport class Owner {${method.replace("await import('./WorldChapterHost')", 'await window.loadChapterHost()')}}\n`);
const originalHost = await readFile(root + 'src/adventure/WorldChapterHost.ts', 'utf8');
assert.ok(originalHost.includes("await import('./delicia/DeliciaApp')"));
await writeFile(`${directory}/Host.ts`, originalHost.replace("await import('./delicia/DeliciaApp')", 'await window.loadDeliciaApp()').replaceAll("'./", "'/src/adventure/"));

const fixture = `<!doctype html><html><body><script type="module">
import { Owner } from '/.tmp/delicia-entry-lifecycle-browser/Owner.ts';
import { mountWorldChapter } from '/.tmp/delicia-entry-lifecycle-browser/Host.ts';
import { DeliciaApp } from '/src/adventure/delicia/DeliciaApp.ts';
import { DeliciaArt } from '/src/adventure/delicia/DeliciaArt.ts';
import { DeliciaStore } from '/src/adventure/delicia/DeliciaProgress.ts';
import { ProgressStore } from '/src/adventure/progress.ts';
DeliciaArt.prototype.load = async () => {};
const store = new ProgressStore(null), deliciaStore = new DeliciaStore(null);
deliciaStore.save.completed.push('delicia-1');
const mapRoot = document.createElement('section'), mapCanvas = document.createElement('canvas'); document.body.append(mapRoot, mapCanvas);
mapCanvas.id = 'listener-map'; mapCanvas.tabIndex = 0;
let returned = 0, delivered, release, mode = '', pauseCalls = 0;
const owner = Object.assign(new Owner(), { chapterActive: false, running: true, isDisposed: false,
    input: { reset() {} }, audio: { enabled: true, pause() {}, volume() {} }, store, mapCanvas, renderer: {},
    cancelFrame() {}, requestFrame() {},
    mapView: { root: mapRoot, deliciaStore, openChapter() { returned++; }, hud: { focusEnter() { mapCanvas.focus(); } } },
});
let gate, started;
window.loadChapterHost = () => {
    if (mode === 'inner-error') return Promise.resolve({ mountWorldChapter });
    started(); return gate.then(() => {
        if (mode === 'outer-error') throw Error('Expected outer import failure');
        return { mountWorldChapter };
    });
};
window.loadDeliciaApp = () => {
    if (mode !== 'inner-error') return Promise.resolve({ DeliciaApp });
    started(); return gate.then(() => { throw Error('Expected inner import failure'); });
};
window.h = { owner, lastMotion: null, save: JSON.stringify(deliciaStore.save),
    begin(nextMode) {
        mode = nextMode; gate = new Promise(resolve => { release = resolve; });
        const waiting = new Promise(resolve => { started = resolve; });
        delivered = owner.mountChapter('delicia', 'delicia-1');
        return waiting;
    },
    async deliver() {
        release(); await delivered;
        const app = window.deliciaGame;
        if (app) { this.lastMotion = app.systemMotion; const pause = app.pause.bind(app);
            app.pause = () => { pauseCalls++; return pause(); }; }
    },
    app: () => window.deliciaGame,
    state: () => ({ active: owner.chapterActive, returned, frames: pendingFrameCount(), pauseCalls,
        sameSave: JSON.stringify(deliciaStore.save) === h.save, dialogs: document.querySelectorAll('dialog').length,
        chapterHosts: document.querySelectorAll('.world-chapter-host').length }),
};
</script></body></html>`;

let server, browser, context, page, cdp, baseline;
const evidence = { cycles: [], errors: [], external: [], consoleErrors: [] };
before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root, configFile: false, appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'delicia-listener-diagnostic', configureServer(vite) {
            vite.middlewares.use('/listener-fixture', (_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end(fixture); });
        } }] });
    await server.listen(); const base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
    evidence.chromium = browser.version();
    context = await browser.newContext(); page = await context.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', error => evidence.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
    await page.route('**/*', route => {
        if (new URL(route.request().url()).origin === base) return route.continue();
        evidence.external.push(route.request().url()); return route.abort();
    });
    await page.addInitScript(() => {
        const ids = new WeakMap(), records = new Map(); let next = 0;
        const id = listener => { if (!ids.has(listener)) ids.set(listener, ++next); return ids.get(listener); };
        const original = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, listener, options) {
            if (listener) {
                const key = id(listener);
                if (!records.has(key)) records.set(key, { id: key, stack: new Error().stack });
            }
            return Reflect.apply(original, this, [type, listener, options]);
        };
        window.listenerProbe = { identify: listener => records.get(id(listener)) ?? { id: id(listener), stack: 'Unobserved registration' } };
        const frames = new Map(); let frameId = 0;
        window.pendingFrameCount = () => frames.size;
        window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
        window.cancelAnimationFrame = id => frames.delete(id);
        navigator.getGamepads = () => [];
        for (const key of ['super_feka_delicia_v1', 'super_feka_gaps_world_v1']) localStorage.setItem(key, 'unchanged');
    });
    await page.goto(base + '/listener-fixture', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => !!window.h);
    cdp = await context.newCDPSession(page);
    baseline = await snapshot(); evidence.baseline = baseline;
});
after(async () => {
    await writeFile(`${directory}/native-evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
    await browser?.close(); await server?.close();
});

async function snapshot() {
    const result = await cdp.send('Runtime.evaluate', { includeCommandLineAPI: true, returnByValue: true, expression: `(() => {
        const rows = [];
        for (const [target, object] of [['window', window], ['document', document], ['motion', h.lastMotion]]) {
            if (!object) continue;
            for (const [type, listeners] of Object.entries(getEventListeners(object)))
                for (const entry of listeners) rows.push({ target, type, capture: entry.useCapture,
                    ...listenerProbe.identify(entry.listener) });
        }
        return rows.sort((a,b) => a.id-b.id || a.type.localeCompare(b.type));
    })()` });
    assert.equal(result.exceptionDetails, undefined, 'Native DevTools listener inspection must succeed');
    return result.result.value;
}
const identity = rows => rows.map(({ target, type, capture, id }) => ({ target, type, capture, id }));
const activity = rows => rows.filter(row => row.type === 'blur' || row.type === 'visibilitychange');
const added = rows => rows.filter(row => !baseline.some(base => base.id === row.id && base.target === row.target && base.type === row.type && base.capture === row.capture));
const owners = rows => rows.map(row => {
    const source = row.stack.split('\n').find(line => /src\//.test(line) && !line.includes('DisposalScope')) ?? row.stack.split('\n').find(line => line.includes('Owner.ts'));
    return { id: row.id, target: row.target, type: row.type, source };
});
function activityOwner(row) {
    for (const name of ['GamepadDevice', 'CanvasMenuAccessibility', 'ControlSettings', 'DeliciaApp'])
        if (row.stack.includes(`/${name}.ts:`)) return name;
    if (row.stack.includes('/Owner.ts:')) return 'entry';
    assert.fail(`Unexpected activity owner: ${row.stack}`);
}
function assertOwners(rows, expected) {
    const groups = {};
    for (const row of rows) (groups[activityOwner(row)] ??= []).push(`${row.target}:${row.type}`);
    for (const events of Object.values(groups)) events.sort();
    assert.deepEqual(groups, expected, 'Every activity callback has a live, known owner');
}
const activityPair = ['document:visibilitychange', 'window:blur'];

for (const mode of ['success', 'outer-error', 'inner-error']) test(`native listener ownership remains stable over five ${mode} cycles`, async t => {
    const sceneIds = new Set(), consoleErrorsBefore = evidence.consoleErrors.length;
    for (let visit = 0; visit < 5; visit++) {
        const before = await page.evaluate(() => h.state());
        await page.evaluate(mode => h.begin(mode), mode);
        const loading = await snapshot();
        const loadingActivity = activity(added(loading));
        assertOwners(loadingActivity, { entry: activityPair, GamepadDevice: activityPair });
        const loadingPad = loadingActivity.filter(row => activityOwner(row) === 'GamepadDevice');
        if (mode === 'success' && visit % 2) await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
        await page.evaluate(() => h.deliver());
        const live = await snapshot(), active = activity(added(live));
        if (mode === 'success') {
            assertOwners(active, { GamepadDevice: activityPair, CanvasMenuAccessibility: ['document:visibilitychange'],
                ControlSettings: activityPair, DeliciaApp: activityPair });
            assert.ok(active.every(row => !loadingActivity.some(old => old.id === row.id)),
                'The entry lease and loading controller end before chapter ownership begins');
        } else {
            assert.deepEqual(identity(active), identity(loadingPad),
                'Only the error screen controller retains the very same loading callbacks');
        }
        for (const row of active) { assert.equal(sceneIds.has(row.id), false, 'A later scene must not retain the previous callbacks'); sceneIds.add(row.id); }
        let commandCalls;
        if (mode === 'success') {
            if (await page.evaluate(() => h.app().screen === 'pause')) await page.getByRole('button', { name: 'CONTINUAR', exact: true }).click();
            await page.locator('.dl-canvas').focus(); await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => h.app().screen), 'pause');
            commandCalls = await page.evaluate(() => h.state().pauseCalls);
            assert.equal(commandCalls, before.pauseCalls + 1);
            await page.getByRole('button', { name: 'VOLTAR AO MAPA', exact: true }).click();
        } else {
            await page.getByRole('button', { name: 'Voltar ao mapa', exact: true }).click();
        }
        const closed = await snapshot(), state = await page.evaluate(() => h.state());
        assert.deepEqual(identity(closed), identity(baseline), 'Every scene listener is removed; global callback identities stay unchanged');
        assert.equal(state.frames, 0); assert.equal(state.active, false); assert.equal(state.chapterHosts, 0); assert.equal(state.dialogs, 0);
        assert.equal(state.returned, before.returned + 1); assert.equal(state.sameSave, true);
        evidence.cycles.push({ mode, visit, loading: owners(activity(added(loading))), active: owners(active), liveCount: live.length,
            closedCount: closed.length, state, commandCalls });
    }
    assert.deepEqual(evidence.errors, []); assert.deepEqual(evidence.external, []);
    const newErrors = evidence.consoleErrors.slice(consoleErrorsBefore);
    assert.equal(newErrors.length, mode === 'success' ? 0 : 5);
    assert.ok(newErrors.every(message => message.includes(`Expected ${mode === 'outer-error' ? 'outer' : 'inner'} import failure`)));
    assert.deepEqual(await page.evaluate(() => ['super_feka_delicia_v1', 'super_feka_gaps_world_v1'].map(key => localStorage.getItem(key))), ['unchanged', 'unchanged']);
    t.diagnostic(JSON.stringify({ mode, visits: 5, stableGlobalListeners: baseline.length, sceneListenersAfterClose: 0 }));
});
