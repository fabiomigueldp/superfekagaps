import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('removing theme layers keeps keyboard focus in the same section without stealing unrelated focus', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-layer-focus',
      transform(code, id) {
        if (id.endsWith('/src/main.ts')) return code.replace('game = new mode.Game(canvas);',
          'game = new mode.Game(canvas); window.editorUnderTest = game.editorController;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?editor=true');
  await page.waitForFunction(() => !!window.editorUnderTest);
  const results = [];
  for (const section of ['surface', 'underground']) {
    const list = section === 'surface' ? 'theme-layers-list' : 'theme-underground-layers-list';
    const add = section === 'surface' ? 'btn-add-layer' : 'btn-add-underground-layer';
    await page.evaluate(() => {
      const e = editorUnderTest, data = e.createBlankLevel();
      const layers = ['clouds', 'mountains', 'hills'].map(type => ({ type, color: '#123456', scrollFactor: 0.3 }));
      data.theme = { skyGradient: ['#ffffff', '#000000'], layers,
        underground: { startRow: 5, skyGradient: ['#222222', '#111111'], layers: structuredClone(layers) } };
      e.loadLevel(data, '', false, true); e.selectTab('tab-theme');
    });
    // Native focus transfer commits a pending numeric field before keyboard removal.
    await page.locator('#theme-underground-start-row').fill('6');
    await page.locator('#' + list + ' .remove').nth(1).focus();
    const before = await page.evaluate(() => JSON.stringify(editorUnderTest.levelData));
    const steps = [];
    for (const key of ['Enter', 'Space', 'Enter']) {
      await page.keyboard.press(key);
      steps.push(await page.evaluate(list => {
        const buttons = [...document.querySelectorAll('#' + list + ' .remove')];
        return { remaining: buttons.length, focusedIndex: buttons.indexOf(document.activeElement),
          focusedId: document.activeElement.id, name: document.activeElement.getAttribute('aria-label') };
      }, list));
    }
    const history = await page.evaluate(({ section, before }) => {
      const e = editorUnderTest, after = JSON.stringify(e.levelData), original = JSON.parse(before);
      const other = section === 'surface' ? e.levelData.theme.underground.layers : e.levelData.theme.layers;
      const expectedOther = section === 'surface' ? original.theme.underground.layers : original.theme.layers;
      const preserved = JSON.stringify(other) === JSON.stringify(expectedOther) && e.levelData.theme.underground.startRow === 6;
      const index = e.history.index;
      for (let i = 0; i < 3; i++) e.restoreHistory(false);
      const undo = JSON.stringify(e.levelData) === before;
      for (let i = 0; i < 3; i++) e.restoreHistory(true);
      return { index, preserved, undo, redo: JSON.stringify(e.levelData) === after };
    }, { section, before });
    // A programmatic activation while focus is elsewhere must not redirect it.
    await page.locator('#' + add).click();
    await page.locator('#theme-biome').focus();
    await page.locator('#' + list + ' .remove').first().evaluate(button => button.click());
    const unrelated = await page.evaluate(() => document.activeElement.id);
    results.push({ section, steps, history, unrelated });
  }
  t.diagnostic(JSON.stringify(results));
  for (const r of results) {
    assert.deepEqual(r.steps, [
      { remaining: 2, focusedIndex: 1, focusedId: '', name: 'Remover camada 2' },
      { remaining: 1, focusedIndex: 0, focusedId: '', name: 'Remover camada 1' },
      { remaining: 0, focusedIndex: -1, focusedId: r.section === 'surface' ? 'btn-add-layer' : 'btn-add-underground-layer',
        name: r.section === 'surface' ? 'Adicionar camada à superfície' : 'Adicionar camada subterrânea' }
    ]);
    assert.deepEqual(r.history, { index: 4, preserved: true, undo: true, redo: true });
    assert.equal(r.unrelated, 'theme-biome');
  }
  assert.deepEqual(errors, []);
});
