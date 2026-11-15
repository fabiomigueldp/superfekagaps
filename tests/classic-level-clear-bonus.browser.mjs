import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic level-clear summary reports the credited time bonus without crediting it again', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-clear-bonus',
      transform(code, id) {
        // Real Game and rendering, with simulation advanced explicitly instead of RAF.
        if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.gameUnderTest = game;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('clear-bonus-sentinel', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?classic=true');
  await page.waitForFunction(() => !!window.gameUnderTest);
  const result = await page.evaluate(() => {
    const g = gameUnderTest, ui = g.renderer.ui, original = ui.clear.bind(ui), rendered = [];
    ui.clear = (context, level, score, bonus) => { rendered.push({ level, score, bonus }); original(context, level, score, bonus); };
    const storage = JSON.stringify({ ...localStorage }), runs = [];
    for (const remaining of [12.75, 0.99, 1.01]) {
      g.startNewGame(); g.score = 100; g.levelTime = remaining;
      const before = g.score; g.onLevelComplete(); g.render();
      const frames = [{ score: g.score, ...rendered.at(-1) }];
      for (let i = 0; i < 2; i++) { g.updateLevelClear(500); g.render(); frames.push({ score: g.score, ...rendered.at(-1) }); }
      runs.push({ remaining, before, credited: g.score - before, frames, state: g.state,
        timer: g.levelClearTimer, levelTime: g.levelTime });
    }
    return { runs, storageUnchanged: storage === JSON.stringify({ ...localStorage }) };
  });
  t.diagnostic(JSON.stringify(result));
  for (const [index, run] of result.runs.entries()) {
    const expected = [120, 0, 10][index];
    assert.equal(run.credited, expected); assert.equal(run.state, 'LEVEL_CLEAR');
    assert.equal(run.timer, 2000); assert.equal(run.levelTime, run.remaining);
    for (const frame of run.frames) {
      assert.equal(frame.score, 100 + expected); assert.equal(frame.bonus, expected);
      assert.equal(frame.bonus, run.credited, 'announced bonus equals the score increment');
    }
  }
  assert.equal(result.storageUnchanged, true); assert.deepEqual(errors, []);
});
