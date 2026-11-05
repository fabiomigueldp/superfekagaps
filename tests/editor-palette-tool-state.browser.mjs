import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';

const fixture = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(
    '<script type="module" src="/src/main.ts"></script>', `<script type="module">
import { EditorController } from '/src/editor/EditorController.ts';
import { Renderer } from '/src/engine/Renderer.ts';
import { CAMPAIGN_LEVELS } from '/src/data/levels/index.ts';
const canvas = document.getElementById('game-canvas');
const source = JSON.stringify(CAMPAIGN_LEVELS);
const editor = new EditorController(canvas, new Renderer(canvas));
editor.init(); editor.loadLevel(editor.createBlankLevel(), '', false, true);
editor.camera.x = editor.camera.y = 0; editor.zoom = 1;
window.h = { editor, source, sources: () => JSON.stringify(CAMPAIGN_LEVELS),
  snapshot() { return { tool: editor.activeTool, cursor: canvas.style.cursor,
    pressed: [...document.querySelectorAll('.tool-btn[aria-pressed="true"]')].map(b => b.dataset.tool),
    visual: [...document.querySelectorAll('.tool-btn.active')].map(b => b.dataset.tool), dragging: editor.isDragging }; },
  point(x, y, type) { const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(type, { clientX:r.left+x, clientY:r.top+y,
      button:0, buttons:type==='pointerdown'?1:0, pointerId:1, bubbles:true })); }
};
</script>`);

test('palette tool changes keep pressed state, cursor and gestures synchronized without changing document ownership', async t => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'palette-tool-state', configureServer(vite) {
            vite.middlewares.use('/palette-fixture', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(fixture); });
        } }] });
    t.after(() => server.close()); await server.listen();
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('palette-test-save', 'preserved'));
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/palette-fixture');
    await page.waitForFunction(() => !!window.h);
    const before = await page.evaluate(() => ({ document: JSON.stringify(h.editor.levelData),
        history: JSON.stringify(h.editor.history), storage: JSON.stringify({ ...localStorage }) }));
    const observations = [];
    for (const tool of ['SELECT', 'ERASER', 'RECTANGLE', 'HAND']) {
        await page.locator(`[data-tool="${tool}"]`).click();
        await page.locator('#tile-palette button[title="Brick"]').click();
        observations.push({ from: tool, palette: 'tile', expected: ['SELECT', 'ERASER'].includes(tool) ? 'BRUSH' : tool,
            ...await page.evaluate(() => h.snapshot()) });
    }
    await page.locator('[data-tab="tab-logic"]').click();
    for (const tool of ['SELECT', 'ERASER', 'HAND']) {
        await page.locator(`[data-tool="${tool}"]`).click();
        if (tool === 'HAND') await page.evaluate(() => h.point(160, 80, 'pointerdown'));
        // Keyboard activation can select a palette entry while a pointer gesture is pending.
        await page.locator('#logic-palette button[title="Audio"]').focus();
        await page.keyboard.press('Enter');
        observations.push({ from: tool, palette: 'logic', expected: 'RECTANGLE', ...await page.evaluate(() => h.snapshot()) });
    }
    t.diagnostic(JSON.stringify(observations));
    for (const state of observations) {
        assert.equal(state.tool, state.expected);
        assert.deepEqual(state.pressed, [state.expected], JSON.stringify(state));
        assert.deepEqual(state.visual, [state.expected]);
        assert.equal(state.cursor, state.expected === 'HAND' ? 'grab' : 'crosshair');
        assert.equal(state.dragging, false);
    }
    assert.deepEqual(await page.evaluate(() => ({ document: JSON.stringify(h.editor.levelData),
        history: JSON.stringify(h.editor.history), storage: JSON.stringify({ ...localStorage }) })), before);
    await page.locator('[data-tab="tab-tiles"]').click();
    await page.locator('[data-tool="SELECT"]').click();
    await page.locator('#tile-palette button[title="Brick"]').click();
    await page.evaluate(() => { h.point(168, 88, 'pointerdown'); h.point(168, 88, 'pointerup'); });
    const painted = await page.evaluate(() => JSON.stringify(h.editor.levelData));
    assert.notEqual(painted, before.document);
    await page.locator('#btn-undo').click();
    assert.equal(await page.evaluate(() => JSON.stringify(h.editor.levelData)), before.document);
    await page.locator('#btn-redo').click();
    assert.equal(await page.evaluate(() => JSON.stringify(h.editor.levelData)), painted);
    await page.locator('[data-tool="SELECT"]').click();
    await page.evaluate(() => { const p = h.editor.levelData.playerSpawn; h.point(p.x*16+8,p.y*16+8,'pointerdown'); h.point(p.x*16+8,p.y*16+8,'pointerup'); });
    assert.equal(await page.evaluate(() => h.editor.activeSelection?.type), 'SPAWN');
    assert.equal(await page.evaluate(() => h.sources()), await page.evaluate(() => h.source));
    assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), before.storage);
    assert.deepEqual(errors, []);
});
