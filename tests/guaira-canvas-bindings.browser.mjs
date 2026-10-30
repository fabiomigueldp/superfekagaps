/** Real chapter host, native scenes and keyboard input; isolated loopback storage.
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/guaira-canvas-bindings.browser.mjs
 * PLAYWRIGHT_MODULE may select an existing Playwright installation.
 */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body><main class="world-chapter-host"></main><script type="module">
import '/src/adventure/experimental/guaira/chapter/guaira-chapter-game.css';
import { GuairaChapterApp } from '/src/adventure/experimental/guaira/chapter/GuairaChapterApp.ts';
import { freshSave, SAVE_KEY } from '/src/adventure/progress.ts';
import { controlPreferences, saveControls } from '/src/engine/ControlPreferences.ts';
const initial = freshSave(); initial.preferences = { music:.2, effects:.4, voice:.3, shake:false };
if (!localStorage.getItem(SAVE_KEY)) localStorage.setItem(SAVE_KEY, JSON.stringify(initial));
const scene = new URLSearchParams(location.search).get('scene');
const app = new GuairaChapterApp(document.querySelector('main'), { initialScene:scene });
window.h = { app, scene, controlPreferences, saveControls, get game() { return app.activeGame; },
    freeze() { h.game.running=false; h.game.cancelFrame(); },
    step(n=1) { for (let i=0;i<n;i++) h.game.update(1000/60); },
    saved() { return Object.fromEntries(Object.entries(localStorage).filter(([key]) => key !== 'super_feka_gaps_controls_v1')); },
};
</script></body></html>`;

before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    server = await createServer({ root:fileURLToPath(new URL('../', import.meta.url)), configFile:false,
        appType:'custom', server:{host:'127.0.0.1', port:0}, plugins:[{name:'guaira-canvas-bindings', configureServer(vite) {
            vite.middlewares.use('/canvas-fixture', (_request, response) => {
                response.setHeader('Content-Type', 'text/html'); response.end(fixture);
            });
        }}] });
    await server.listen(); base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH});
});
after(async () => { await browser?.close(); await server?.close(); });

async function sampleKey(page, code) {
    await page.keyboard.down(code);
    const state = await page.evaluate(() => { h.game.input.update(); return {...h.game.input.getState()}; });
    await page.keyboard.up(code);
    await page.evaluate(() => h.game.input.update());
    return state;
}
async function accessibleName(page) {
    const session = await page.context().newCDPSession(page);
    try {
        const {root} = await session.send('DOM.getDocument');
        const {nodeId} = await session.send('DOM.querySelector', {nodeId:root.nodeId, selector:'#game-canvas'});
        const {nodes} = await session.send('Accessibility.getPartialAXTree', {nodeId, fetchRelatives:false});
        assert.equal(nodes[0].ignored, false, 'Canvas participates in the Chromium accessibility tree');
        return nodes[0].name.value;
    } finally { await session.detach(); }
}
async function openSettings(page) {
    await page.keyboard.press('KeyP'); await page.evaluate(() => h.step());
    await page.waitForFunction(() => document.querySelector('nav').dataset.state === 'paused');
    await page.getByRole('button', {name:'Opções', exact:true}).click();
    await page.getByRole('button', {name:'Controles', exact:true}).click();
    if (!await page.locator('.feka-control-settings').evaluate(node => node.open)) await page.locator('summary').click();
}

for (const [scene, title, objective, compact] of [
    ['guaira-travessia', 'Travessia da Vala Seca', 'Abra a comporta e atravesse até o arrozal.', false],
    ['gallery', 'Galeria dos Remendos, percurso opcional.', 'Abra as tampas rachadas e alcance o patamar de inspeção.', true],
]) test(`${scene}: accessible canvas follows saved keys, real remapping, restoration and scene disposal`, async t => {
    const context = await browser.newContext({viewport:compact ? {width:360,height:640} : {width:1280,height:720},
        hasTouch:compact, reducedMotion:'reduce'}), page = await context.newPage(), errors = [];
    page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, base, 'Only loopback traffic'); return route.continue();
    });
    await page.addInitScript(() => {
        window.AudioContext = undefined; navigator.getGamepads = () => [];
        localStorage.setItem('super_feka_gaps_controls_v1', JSON.stringify({keys:{left:['KeyH'],right:['KeyL'],
            jump:['KeyK'],run:['KeyV'],down:['KeyB'],pause:['KeyP'],mute:['KeyU']}}));
        localStorage.setItem('unrelated-project-save', 'untouched');
        localStorage.setItem('super_feka_gaps_delicia_v1', 'unrelated Delícia save');
    });
    t.after(async () => { try { assert.deepEqual(errors, []); await page.evaluate(() => h.app.dispose()); }
        finally { await context.close(); } });
    await page.goto(`${base}/canvas-fixture?scene=${scene}`);
    await page.waitForFunction(() => window.h?.app.mode === 'game');
    await page.evaluate(() => { h.freeze(); h.step(30); h.originalGame=h.game; h.originalCanvas=document.querySelector('#game-canvas'); });
    const canvas = page.locator('#game-canvas'), saved = await page.evaluate(() => h.saved());
    await canvas.focus();
    const oldJump = await sampleKey(page, 'Space'), jump = await sampleKey(page, 'KeyK');
    assert.equal(oldJump.jump, false); assert.equal(jump.jump, true);
    for (const [code, action] of [['KeyH','left'],['KeyL','right'],['KeyV','run'],['KeyB','down'],['KeyU','mute']])
        assert.equal((await sampleKey(page, code))[action], true, `${code} still performs ${action}`);
    const initial = await canvas.getAttribute('aria-label');
    t.diagnostic(JSON.stringify({scene, oldSpaceJumps:oldJump.jump, configuredKJumps:jump.jump, initial}));
    assert.ok(initial.includes(title)); assert.ok(initial.includes(objective));
    assert.match(initial, /Pular: K/); assert.match(initial, /Correr: V/); assert.match(initial, /Sentada no ar: B/);
    assert.match(initial, /Esquerda: H; Direita: L/); assert.match(initial, /Pausar: P; Som: U/);
    assert.doesNotMatch(initial, /Espaço|Shift|M para o som|Sementes|Rebater/);
    assert.equal(await accessibleName(page), initial, 'Chromium accessibility tree exposes the current instructions');

    await openSettings(page);
    const touch = await page.locator('.world-controls-content > h3 + p').textContent();
    await page.getByRole('combobox').nth(1).selectOption('jump');
    await page.getByRole('button', {name:'Alterar Pular: K',exact:true}).click();
    await page.keyboard.press('KeyN');
    await page.waitForFunction(() => !document.querySelector('[data-control-capture="true"]'));
    assert.match(await canvas.getAttribute('aria-label'), /Pular: N/);
    assert.equal(await page.getByRole('button', {name:'Alterar Pular: N',exact:true}).evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => h.game === h.originalGame && document.querySelector('#game-canvas') === h.originalCanvas), true);
    assert.deepEqual(await page.evaluate(() => h.saved()), saved, 'Control remapping does not change campaign progress or preferences');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', {name:'Controles',exact:true}).evaluate(node => node === document.activeElement), true);
    await page.getByRole('button', {name:'Voltar à pausa',exact:true}).click();
    await page.getByRole('button', {name:/^Retomar a tentativa(?: opcional)?$/}).click();
    assert.equal(await canvas.evaluate(node => node === document.activeElement), true);
    assert.equal((await sampleKey(page, 'KeyK')).jump, false);
    assert.equal((await sampleKey(page, 'KeyN')).jump, true);

    await openSettings(page);
    assert.equal(await page.locator('.world-controls-content > h3 + p').textContent(), touch, 'Touch instructions stay intact');
    await page.getByRole('button', {name:'Restaurar padrão',exact:true}).click();
    const restored = await canvas.getAttribute('aria-label');
    assert.match(restored, /Pular: Espaço; Correr: Shift esq\./);
    assert.match(restored, /Pausar: Esc; Som: M/);
    assert.ok(restored.includes(title)); assert.ok(restored.includes(objective));
    assert.deepEqual(await page.evaluate(() => h.saved()), saved);
    if (process.env.BROWSER_ARTIFACT_DIR)
        await page.screenshot({path:`${process.env.BROWSER_ARTIFACT_DIR}/${scene}-restored.png`});
    await page.keyboard.press('Escape');
    await page.getByRole('button', {name:'Voltar à pausa',exact:true}).click();
    await page.getByRole('button', {name:/^Retomar a tentativa(?: opcional)?$/}).click();
    assert.equal((await sampleKey(page, 'KeyN')).jump, false);
    assert.equal((await sampleKey(page, 'Space')).jump, true);
    assert.equal(await accessibleName(page), restored);

    await page.keyboard.press('Escape'); await page.evaluate(() => h.step());
    await page.waitForFunction(() => document.querySelector('nav').dataset.state === 'paused');
    await page.getByRole('button', {name:'Opções',exact:true}).click();
    await page.locator('#chapter-retry').click();
    await page.waitForFunction(() => h.app.mode === 'game' && h.game !== h.originalGame);
    await page.evaluate(() => { h.freeze(); h.controlPreferences.keys.jump=['KeyG']; h.saveControls(); });
    assert.match(await canvas.getAttribute('aria-label'), /Pular: G/);
    assert.equal(await page.evaluate(() => h.originalCanvas.getAttribute('aria-label')), restored, 'Scene replacement releases the old label listener');
    assert.equal(await page.evaluate(() => h.originalGame.isDisposed), true);
    const replaced = await canvas.getAttribute('aria-label');
    await page.evaluate(() => { h.lastCanvas=document.querySelector('#game-canvas'); h.app.dispose(); h.controlPreferences.keys.jump=['KeyT']; h.saveControls(); });
    assert.equal(await page.evaluate(() => h.lastCanvas.getAttribute('aria-label')), replaced, 'App disposal releases the current label listener');
    assert.deepEqual(await page.evaluate(() => h.saved()), saved);
});
