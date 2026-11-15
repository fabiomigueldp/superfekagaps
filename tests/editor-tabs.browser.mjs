import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('editor tabs expose selection, support scoped navigation and commit fields before hiding panels', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-editor-tabs',
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
  const initial = await page.evaluate(() => ({ data: JSON.stringify(editorUnderTest.levelData),
    storage: JSON.stringify({ ...localStorage }) }));
  const states = [];
  async function observe(expected) {
    states.push({ expected, ...await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.tab-btn')];
      return { active: tabs.filter(b => b.classList.contains('active')).map(b => b.dataset.tab),
        selected: tabs.filter(b => b.getAttribute('aria-selected') === 'true').map(b => b.dataset.tab),
        reachable: tabs.filter(b => b.tabIndex === 0).map(b => b.dataset.tab),
        focus: document.activeElement.dataset.tab,
        panels: [...document.querySelectorAll('.tab-content')].filter(p => getComputedStyle(p).display !== 'none').map(p => p.id),
        linked: tabs.every(b => b.getAttribute('role') === 'tab' && b.getAttribute('aria-controls') === b.dataset.tab &&
          document.getElementById(b.dataset.tab).getAttribute('role') === 'tabpanel' &&
          document.getElementById(b.dataset.tab).getAttribute('aria-labelledby') === b.id && !!b.id) };
    }) });
  }
  await page.locator('[data-tab="tab-tiles"]').focus(); await observe('tab-tiles');
  for (const [key, expected] of [['ArrowRight', 'tab-logic'], ['End', 'tab-theme'], ['ArrowRight', 'tab-tiles'],
    ['ArrowLeft', 'tab-theme'], ['Home', 'tab-tiles']]) { await page.keyboard.press(key); await observe(expected); }
  await page.locator('[data-tab="tab-levels"]').click(); await observe('tab-levels');
  await page.locator('#level-name').fill('Pending tab edit');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Home'); await page.keyboard.press('End');
  const textKeys = await page.evaluate(() => document.activeElement.id === 'level-name' &&
    document.querySelector('.tab-btn.active').dataset.tab === 'tab-levels');
  await page.evaluate(() => editorUnderTest.selectTab('tab-bounds')); await observe('tab-bounds');
  const committed = await page.evaluate(() => ({ name: editorUnderTest.levelData.name, index: editorUnderTest.history.index }));
  await page.keyboard.press('Tab');
  const panelEntry = await page.evaluate(() => document.activeElement.closest('.tab-content')?.id);
  await page.evaluate(() => { editorUnderTest.fs.mount = async () => true; document.getElementById('btn-mount').disabled = false; });
  await page.locator('#btn-mount').click();
  await page.waitForFunction(() => document.querySelector('.tab-btn.active').dataset.tab === 'tab-levels');
  const mountFocus = await page.evaluate(() => document.activeElement.id);
  await page.locator('[data-tab="tab-levels"]').focus(); await observe('tab-levels');
  const semantics = { lists: await page.getByRole('tablist', { name: 'Painéis do editor' }).count(),
    selected: await page.getByRole('tab', { name: 'Levels', selected: true }).count(),
    panel: await page.getByRole('tabpanel', { name: 'Levels' }).count() };
  const preserved = await page.evaluate(initial => {
    const e = editorUnderTest, edited = JSON.stringify(e.levelData); e.restoreHistory(false);
    const undo = JSON.stringify(e.levelData) === initial.data; e.restoreHistory(true);
    return { undo, redo: JSON.stringify(e.levelData) === edited, storage: JSON.stringify({ ...localStorage }) === initial.storage };
  }, initial);
  t.diagnostic(JSON.stringify({ states, textKeys, committed, panelEntry, mountFocus, semantics, preserved }));
  for (const s of states) assert.deepEqual(s, { expected: s.expected, active: [s.expected], selected: [s.expected],
    reachable: [s.expected], focus: s.expected, panels: [s.expected], linked: true });
  assert.equal(textKeys, true); assert.deepEqual(committed, { name: 'Pending tab edit', index: 1 });
  assert.equal(panelEntry, 'tab-bounds'); assert.equal(mountFocus, 'btn-mount');
  assert.deepEqual(semantics, { lists: 1, selected: 1, panel: 1 });
  assert.deepEqual(preserved, { undo: true, redo: true, storage: true }); assert.deepEqual(errors, []);
});
