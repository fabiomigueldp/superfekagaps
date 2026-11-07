import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic save shortcut commits focused fields once and preserves text editing and save failures', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-field-save',
      transform(code, id) {
        if (id.endsWith('/src/main.ts')) return code.replace('game = new mode.Game(canvas);',
          'game = new mode.Game(canvas); window.editorUnderTest = game.editorController;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close());
  const results = [], errors = [];
  for (const field of ['name', 'dialog', 'time']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('field-save-sentinel', 'preserved'));
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?editor=true');
    await page.waitForFunction(() => !!window.editorUnderTest);
    const initial = await page.evaluate(async field => {
      const e = editorUnderTest, data = e.createBlankLevel();
      data.triggers = [{ id: 'dialog', type: 'DIALOG', x: 480, y: 64, width: 32, height: 32,
        active: true, oneShot: false, text: 'Original dialogue' }];
      e.loadLevel(data, 'memory.ts', true); e.selectTab('tab-levels');
      if (field === 'dialog') { e.activeSelection = { type: 'TRIGGER', data: e.levelData.triggers[0] }; e.updateInspector(); }
      Object.defineProperty(e.fs, 'isMounted', { value: true });
      window.writes = []; window.fieldChanges = 0; window.savePrevented = false;
      // Only the write boundary is replaced; no real filesystem or downloads.
      e.fs.saveLevel = (filename, data) => new Promise((resolve, reject) => {
        window.writes.push({ filename, data: structuredClone(data) }); window.finishWrite = resolve; window.failWrite = reject;
      });
      window.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') window.savePrevented = event.defaultPrevented;
      });
      const input = field === 'dialog' ? document.querySelector('#inspector-content textarea')
        : document.getElementById(field === 'time' ? 'level-time-limit' : 'level-name');
      input.addEventListener('change', () => window.fieldChanges++);
      return { data: JSON.stringify(e.levelData), storage: JSON.stringify({ ...localStorage }),
        campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) };
    }, field);
    const input = field === 'dialog' ? page.getByRole('textbox', { name: 'Text', exact: true })
      : page.locator(field === 'time' ? '#level-time-limit' : '#level-name');
    await input.click();
    if (field !== 'time') {
      await input.press('End'); const original = await input.inputValue(); await page.keyboard.type('bef');
      assert.equal(await input.inputValue(), original + 'bef');
      await page.keyboard.press('Control+z'); assert.notEqual(await input.inputValue(), original + 'bef');
      assert.equal(await page.evaluate(() => editorUnderTest.history.index === 0 && editorUnderTest.activeTool === 'BRUSH'), true);
    }
    await input.fill(field === 'time' ? '-1' : 'Edited ' + field);
    const shortcut = field === 'dialog' ? 'Meta+s' : 'Control+s';
    await page.keyboard.press(shortcut);
    const started = await page.evaluate(() => ({ count: writes.length, prevented: savePrevented, changes: fieldChanges,
      index: editorUnderTest.history.index, saving: editorUnderTest.saving }));
    const result = { field, started };
    if (started.count) {
      await page.keyboard.press(shortcut);
      result.single = await page.evaluate(() => writes.length === 1 && fieldChanges === 1);
      if (field === 'dialog') {
        await page.evaluate(() => window.failWrite(new Error('Simulated write failure')));
        await page.waitForFunction(() => !editorUnderTest.saving);
        result.failed = await page.evaluate(() => editorUnderTest.history.isDirty(editorUnderTest.levelData) &&
          document.getElementById('editor-message').textContent === 'Simulated write failure');
        await input.click(); await page.keyboard.press(shortcut);
        result.retry = await page.evaluate(() => writes.length === 2 && fieldChanges === 1 && editorUnderTest.history.index === 1);
      }
      await page.evaluate(() => window.finishWrite()); await page.waitForFunction(() => !editorUnderTest.saving);
      result.saved = await page.evaluate(async ({ field, initial }) => {
        const e = editorUnderTest, write = writes.at(-1), saved = JSON.stringify(e.levelData);
        const clean = !e.history.isDirty(e.levelData), matches = JSON.stringify(write.data) === saved;
        e.restoreHistory(false); const undo = JSON.stringify(e.levelData) === initial.data;
        e.restoreHistory(true); const redo = JSON.stringify(e.levelData) === saved;
        return { clean, matches, undo, redo, filename: write.filename,
          value: field === 'dialog' ? write.data.triggers[0].text : field === 'time' ? write.data.timeLimit : write.data.name,
          preserved: initial.storage === JSON.stringify({ ...localStorage }) &&
            initial.campaign === JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) };
      }, { field, initial });
    }
    results.push(result); await page.close();
  }
  t.diagnostic(JSON.stringify(results));
  for (const r of results) {
    assert.deepEqual(r.started, { count: 1, prevented: true, changes: 1, index: r.field === 'time' ? 0 : 1, saving: true });
    assert.equal(r.single, true);
    if (r.field === 'dialog') { assert.equal(r.failed, true); assert.equal(r.retry, true); }
    assert.deepEqual(r.saved, { clean: true, matches: true, undo: true, redo: true, filename: 'memory.ts',
      value: r.field === 'time' ? 300 : 'Edited ' + r.field, preserved: true });
  }
  assert.deepEqual(errors, []);
});
