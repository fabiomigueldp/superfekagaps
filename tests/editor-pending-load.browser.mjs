import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic checks pending fields when delayed document reads finish and ignores stale reads', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-pending-load',
      transform(code, id) {
        if (id.endsWith('/src/main.ts')) return code.replace('game = new mode.Game(canvas);',
          'game = new mode.Game(canvas); window.editorUnderTest = game.editorController;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close());
  const results = [], errors = [];
  for (const source of ['import', 'list']) for (const decision of ['cancel', 'accept', 'stale']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => localStorage.setItem('pending-load-save', 'preserved'));
    page.on('pageerror', error => errors.push(error.message));
    let dialogs = 0;
    page.on('dialog', async dialog => { dialogs++; await (decision === 'accept' ? dialog.accept() : dialog.dismiss()); });
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?editor=true');
    await page.waitForFunction(() => !!window.editorUnderTest);
    const initial = await page.evaluate(async source => {
      const e = window.editorUnderTest, data = e.createBlankLevel();
      data.triggers = [{ id: 'dialog', type: 'DIALOG', x: 480, y: 64, width: 32, height: 32,
        active: true, oneShot: false, text: 'Original dialogue' }];
      e.loadLevel(data, '', false, true); e.selectTab('tab-levels');
      if (source === 'list') { e.activeSelection = { type: 'TRIGGER', data: e.levelData.triggers[0] }; e.updateInspector(); }
      const incoming = e.createBlankLevel(); incoming.id = 'incoming'; incoming.name = 'Incoming level';
      window.pendingReads = []; window.fieldChanges = 0;
      const defer = value => new Promise(resolve => window.pendingReads.push(() => resolve(value)));
      // Both read boundaries are in-memory; no directory picker or user file is accessed.
      if (source === 'import') File.prototype.text = function () { return defer(JSON.stringify(incoming)); };
      else {
        Object.defineProperty(e.fs, 'isMounted', { value: true });
        e.fs.listLevels = async () => ['incoming.ts'];
        e.fs.readLevel = () => defer(structuredClone(incoming));
        await e.refreshLevelList();
      }
      const field = source === 'import' ? document.getElementById('level-name') : document.querySelector('#inspector-content textarea');
      field.addEventListener('change', () => window.fieldChanges++);
      return { data: JSON.stringify(e.levelData), storage: JSON.stringify({ ...localStorage }),
        campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) };
    }, source);
    const startRead = async () => {
      if (source === 'import') await page.locator('#level-import').setInputFiles({ name: 'incoming.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
      else await page.locator('.level-list-item').click();
    };
    await startRead(); await page.waitForFunction(() => window.pendingReads.length === 1);
    if (decision === 'stale') {
      if (source === 'import') {
        // A newer request invalidates the old response without changing documentVersion.
        await startRead(); await page.waitForFunction(() => window.pendingReads.length === 2);
      } else {
        // A committed edit invalidates the response even if loadRequest is unchanged.
        await page.locator('#level-id').fill('edited-id'); await page.locator('#level-id').press('Tab');
      }
    }
    const field = source === 'import' ? page.locator('#level-name') : page.getByRole('textbox', { name: 'Text', exact: true });
    await field.click(); await field.press('End'); await page.keyboard.type(' draft');
    const pending = await page.evaluate(() => ({ data: JSON.stringify(editorUnderTest.levelData),
      index: editorUnderTest.history.index, changes: window.fieldChanges }));
    await page.evaluate(async () => {
      window.pendingReads[0]();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const result = await page.evaluate(async ({ source, initial }) => {
      const e = editorUnderTest, focused = document.activeElement;
      return { id: e.levelData.id, data: JSON.stringify(e.levelData), index: e.history.index,
        value: source === 'import' ? e.levelData.name : e.levelData.triggers[0]?.text,
        changes: window.fieldChanges, fieldFocused: focused.matches('#level-name, #inspector-content textarea'),
        preserved: initial.storage === JSON.stringify({ ...localStorage }) &&
          initial.campaign === JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) };
    }, { source, initial });
    if (decision === 'cancel' && dialogs) result.history = await page.evaluate(initial => {
      const e = editorUnderTest, edited = JSON.stringify(e.levelData);
      e.restoreHistory(false); const undo = JSON.stringify(e.levelData) === initial;
      e.restoreHistory(true); return { undo, redo: JSON.stringify(e.levelData) === edited };
    }, initial.data);
    results.push({ source, decision, dialogs, pending, result }); await page.close();
  }
  t.diagnostic(JSON.stringify(results.map(({ pending, result, ...rest }) => ({ ...rest,
    pending: { ...pending, data: undefined }, result: { ...result, data: undefined } }))));
  for (const { source, decision, dialogs, pending, result } of results) {
    assert.equal(pending.changes, 0); assert.equal(result.preserved, true);
    if (decision === 'stale') {
      assert.equal(dialogs, 0); assert.equal(result.data, pending.data);
      assert.equal(result.index, pending.index); assert.equal(result.changes, 0); assert.equal(result.fieldFocused, true);
    } else {
      assert.equal(dialogs, 1, source + ' asks before replacing the pending draft');
      assert.equal(result.changes, 1); assert.equal(result.fieldFocused, false);
      if (decision === 'accept') { assert.equal(result.id, 'incoming'); assert.equal(result.index, 0); }
      else {
        assert.equal(result.id, 'new_level'); assert.equal(result.value.endsWith(' draft'), true); assert.equal(result.index, 1);
        assert.deepEqual(result.history, { undo: true, redo: true });
      }
    }
  }
  assert.deepEqual(errors, []);
});
