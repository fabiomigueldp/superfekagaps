import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic canvas commits the focused field once and reclaims editor shortcuts without changing text editing', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-classic-editor',
      transform(code, id) {
        // Observe the actual instance created by the normal editor route.
        if (id.endsWith('/src/main.ts')) return code.replace('game = new mode.Game(canvas);',
          'game = new mode.Game(canvas); globalThis.editorUnderTest = game.editorController;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('editor-focus-save', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?editor=true');
  await page.waitForFunction(() => !!window.editorUnderTest);
  const original = await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) }));
  const observations = [];
  for (const field of ['name', 'id', 'dialog']) {
    await page.evaluate(field => {
      const e = window.editorUnderTest, canvas = document.getElementById('game-canvas');
      canvas.focus();
      const data = e.createBlankLevel();
      data.triggers = [{ id: 'dialog', type: 'DIALOG', x: 480, y: 64, width: 32, height: 32,
        active: true, oneShot: false, text: 'Original dialogue' }];
      e.loadLevel(data, '', false, true); e.camera.x = e.camera.y = 0; e.zoom = 1;
      e.selectTab('tab-levels');
      if (field === 'dialog') { e.activeSelection = { type: 'TRIGGER', data: e.levelData.triggers[0] }; e.updateInspector(); }
      window.fieldChanges = 0;
      const input = field === 'dialog' ? document.querySelector('#inspector-content textarea') : document.getElementById('level-' + field);
      input.addEventListener('change', () => window.fieldChanges++);
    }, field);
    await page.locator('[data-tool="BRUSH"]').click();
    const input = field === 'dialog' ? page.getByRole('textbox', { name: 'Text', exact: true }) : page.locator('#level-' + field);
    await input.fill('Draft');
    const beforeTyping = await page.evaluate(() => JSON.stringify(editorUnderTest.history));
    await input.press('End'); await page.keyboard.type('ef');
    assert.equal(await input.inputValue(), 'Draftef', 'tool letters remain text while the field owns focus');
    assert.equal(await page.evaluate(() => editorUnderTest.activeTool), 'BRUSH');
    await page.keyboard.press('Control+z');
    assert.notEqual(await input.inputValue(), 'Draftef', 'native text undo remains available');
    assert.equal(await page.evaluate(() => JSON.stringify(editorUnderTest.history)), beforeTyping, 'text undo does not undo the level');
    const value = 'Edited ' + field; await input.fill(value);
    const beforeClick = await page.evaluate(() => ({ index: editorUnderTest.history.index, tile: editorUnderTest.levelData.tiles[5][10] }));
    const box = await page.locator('#game-canvas').boundingBox();
    await page.mouse.click(box.x + 168, box.y + 88);
    const clicked = await page.evaluate(field => {
      const e = editorUnderTest;
      return { focus: document.activeElement.id, changes: window.fieldChanges,
        value: field === 'dialog' ? e.levelData.triggers[0].text : e.levelData[field],
        index: e.history.index, tile: e.levelData.tiles[5][10], document: JSON.stringify(e.levelData),
        editable: document.getElementById('game-canvas').isContentEditable };
    }, field);
    await page.keyboard.press('Control+z');
    const undone = await page.evaluate(field => ({ tile: editorUnderTest.levelData.tiles[5][10],
      value: field === 'dialog' ? editorUnderTest.levelData.triggers[0].text : editorUnderTest.levelData[field] }), field);
    await page.keyboard.press('Control+Shift+z');
    const redone = await page.evaluate(() => JSON.stringify(editorUnderTest.levelData));
    const tools = [];
    for (const key of ['e', 's', 'r', 'h', 'b']) { await page.keyboard.press(key); tools.push(await page.evaluate(() => editorUnderTest.activeTool)); }
    const view = await page.evaluate(() => JSON.stringify([editorUnderTest.camera.x, editorUnderTest.camera.y, editorUnderTest.zoom]));
    await page.keyboard.press('f');
    const fitted = await page.evaluate(() => JSON.stringify([editorUnderTest.camera.x, editorUnderTest.camera.y, editorUnderTest.zoom]));
    observations.push({ field, value, beforeClick, clicked, undone, redo: redone === clicked.document, tools, fitted: fitted !== view });
  }
  t.diagnostic(JSON.stringify(observations.map(({ clicked, ...rest }) => ({ ...rest, clicked: { ...clicked, document: undefined } }))));
  for (const result of observations) {
    assert.equal(result.clicked.focus, 'game-canvas'); assert.equal(result.clicked.editable, false);
    assert.equal(result.clicked.changes, 1); assert.equal(result.clicked.value, result.value);
    assert.equal(result.clicked.index, result.beforeClick.index + 2, 'field commit and paint are separate undo steps');
    assert.notEqual(result.clicked.tile, result.beforeClick.tile);
    assert.deepEqual(result.undone, { tile: result.beforeClick.tile, value: result.value });
    assert.equal(result.redo, true);
    assert.deepEqual(result.tools, ['ERASER', 'SELECT', 'RECTANGLE', 'HAND', 'BRUSH']);
    assert.equal(result.fitted, true);
  }
  assert.deepEqual(await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) })), original);
  assert.deepEqual(errors, []);
});
