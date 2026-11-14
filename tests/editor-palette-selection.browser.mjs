import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('palette selection exposes one pressed item across tabs and reconstruction', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-palette-selection',
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
  const before = await page.evaluate(() => ({ data: JSON.stringify(editorUnderTest.levelData),
    history: JSON.stringify(editorUnderTest.history), storage: JSON.stringify({ ...localStorage }) }));
  const states = [];
  async function observe(expected, type) {
    const state = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('#tile-palette button, #logic-palette button')];
      return { visual: buttons.filter(b => b.classList.contains('selected')).map(b => b.title),
        pressed: buttons.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.title),
        complete: buttons.every(b => ['true', 'false'].includes(b.getAttribute('aria-pressed'))),
        content: editorUnderTest.activeContent.type };
    });
    const accessible = await page.getByRole('button', { pressed: true }).filter({ hasText: expected }).count();
    states.push({ expected, type, accessible, ...state });
  }
  await observe('Ground', 'TILE');
  await page.locator('#tile-palette button[title="Brick"]').focus(); await page.keyboard.press('Enter');
  await observe('Brick', 'TILE');
  await page.locator('[data-tab="tab-logic"]').click();
  await page.locator('#logic-palette button[title="Audio"]').focus(); await page.keyboard.press('Space');
  await observe('Audio', 'TRIGGER');
  await page.locator('[data-tab="tab-tiles"]').click();
  await page.locator('#tile-palette button[title="Coin"]').focus(); await page.keyboard.press('Enter');
  await observe('Coin', 'ENTITY');
  await page.evaluate(() => { editorUnderTest.buildPalette(); editorUnderTest.buildLogicPalette(); });
  await observe('Coin', 'ENTITY');
  await page.locator('[data-tab="tab-logic"]').click();
  await page.locator('#logic-palette button[title="Dialog"]').click();
  await page.evaluate(() => { editorUnderTest.buildPalette(); editorUnderTest.buildLogicPalette(); });
  await observe('Dialog', 'TRIGGER');
  t.diagnostic(JSON.stringify(states));
  for (const s of states) assert.deepEqual(s, { expected: s.expected, type: s.type, accessible: 1,
    visual: [s.expected], pressed: [s.expected], complete: true, content: s.type });
  assert.deepEqual(await page.evaluate(() => ({ data: JSON.stringify(editorUnderTest.levelData),
    history: JSON.stringify(editorUnderTest.history), storage: JSON.stringify({ ...localStorage }) })), before);
  assert.deepEqual(errors, []);
});
