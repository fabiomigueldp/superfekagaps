import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic protects pending field edits on native navigation without warning for clean values', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-editor-exit',
      configureServer(vite) {
        vite.middlewares.use('/leave', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<p>Local destination</p>'); });
      },
      transform(code, id) {
        if (id.endsWith('/src/main.ts')) return code.replace('game = new mode.Game(canvas);',
          'game = new mode.Game(canvas); window.editorUnderTest = game.editorController;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('pending-exit-save', 'preserved'));
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
  const results = [], errors = [];
  for (const field of ['name', 'id', 'dialog']) for (const kind of ['changed', 'untouched', 'reverted', 'normalized']) {
    if (field === 'dialog' && kind === 'normalized') continue;
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    let dialogs = 0; page.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
    await page.goto(origin + '/?editor=true'); await page.waitForFunction(() => !!window.editorUnderTest);
    const initial = await page.evaluate(async field => {
      const e = window.editorUnderTest, data = e.createBlankLevel();
      data.triggers = [{ id: 'dialog', type: 'DIALOG', x: 480, y: 64, width: 32, height: 32,
        active: true, oneShot: false, text: 'Original dialogue' }];
      e.loadLevel(data, '', false, true); e.selectTab('tab-levels');
      if (field === 'dialog') { e.activeSelection = { type: 'TRIGGER', data: e.levelData.triggers[0] }; e.updateInspector(); }
      const input = field === 'dialog' ? document.querySelector('#inspector-content textarea') : document.getElementById('level-' + field);
      window.fieldChanges = 0; input.addEventListener('change', () => window.fieldChanges++);
      return { value: input.value, data: JSON.stringify(e.levelData), storage: JSON.stringify({ ...localStorage }),
        campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) };
    }, field);
    const input = field === 'dialog' ? page.getByRole('textbox', { name: 'Text', exact: true }) : page.locator('#level-' + field);
    await input.click();
    if (kind !== 'untouched') {
      await input.press('End'); await page.keyboard.type(' draft');
      if (kind === 'reverted') for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
      if (kind === 'normalized') await input.fill('   ');
    }
    const pending = await page.evaluate(() => ({ clean: !editorUnderTest.history.isDirty(editorUnderTest.levelData),
      changes: window.fieldChanges, focused: document.activeElement.tagName }));
    const navigate = async () => { try { await page.goto(origin + '/leave', { timeout: 3000 }); } catch (error) {
      if (!dialogs) throw error;
    } };
    await navigate();
    const result = { field, kind, pending, warned: dialogs === 1, left: page.url() === origin + '/leave' };
    if (dialogs) {
      result.committed = await page.evaluate(field => ({ value: field === 'dialog' ? editorUnderTest.levelData.triggers[0].text : editorUnderTest.levelData[field],
        changes: window.fieldChanges, index: editorUnderTest.history.index }), field);
      await navigate();
      result.repeat = dialogs === 2 && await page.evaluate(() => window.fieldChanges === 1 && editorUnderTest.history.index === 1);
      result.history = await page.evaluate(initial => {
        const e = editorUnderTest, edited = JSON.stringify(e.levelData);
        e.restoreHistory(false); const undo = JSON.stringify(e.levelData) === initial;
        e.restoreHistory(true); const redo = JSON.stringify(e.levelData) === edited;
        e.restoreHistory(false); return { undo, redo, clean: !e.history.isDirty(e.levelData) };
      }, initial.data);
      result.preserved = await page.evaluate(async initial => initial.storage === JSON.stringify({ ...localStorage }) &&
        initial.campaign === JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS), initial);
      await navigate(); result.cleanExit = dialogs === 2 && page.url() === origin + '/leave';
    }
    result.storage = await page.evaluate(value => JSON.stringify({ ...localStorage }) === value, initial.storage);
    results.push(result); await page.close();
  }
  t.diagnostic(JSON.stringify(results));
  for (const r of results) {
    assert.equal(r.pending.clean, true); assert.equal(r.pending.changes, 0);
    assert.equal(r.pending.focused, r.field === 'dialog' ? 'TEXTAREA' : 'INPUT');
    assert.equal(r.storage, true);
    if (r.kind === 'changed') {
      assert.equal(r.warned, true, r.field + ' warns before losing pending text'); assert.equal(r.left, false);
      assert.equal(r.committed.value.endsWith(' draft'), true);
      assert.equal(r.committed.changes, 1); assert.equal(r.committed.index, 1);
      assert.equal(r.repeat && r.preserved && r.cleanExit, true);
      assert.deepEqual(r.history, { undo: true, redo: true, clean: true });
    } else { assert.equal(r.warned, false, r.field + ' ' + r.kind); assert.equal(r.left, true); }
  }
  assert.deepEqual(errors, []);
});
