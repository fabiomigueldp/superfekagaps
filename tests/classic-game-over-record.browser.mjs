import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic Game Over renders the saved record result and clears it for a new run', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-classic-record',
      transform(code, id) {
        // Keep the real Game and renderer; advance simulation explicitly instead of RAF.
        if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.gameUnderTest = game;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('super_feka_gaps_highscore', '100');
    localStorage.setItem('super_feka_gaps_best_time', '42');
    localStorage.setItem('classic-record-sentinel', 'preserved');
  });
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?classic=true');
  await page.waitForFunction(() => !!window.gameUnderTest);
  const result = await page.evaluate(() => {
    const g = gameUnderTest, ui = g.renderer.ui, original = ui.gameOver.bind(ui), rendered = [];
    ui.gameOver = (context, model, touch) => { rendered.push({ ...model }); original(context, model, touch); };
    const runs = [];
    for (const score of [200, 150, 200]) {
      g.startNewGame();
      const cleared = g.newRecord === false;
      g.lives = 1; g.score = score;
      g.player.die(); g.updatePlaying(g.player.data.deathTimerMax + 1);
      g.render();
      const context = g.renderer.getContext();
      const pixels = context.getImageData(80, 65, 160, 7).data;
      runs.push({ score, cleared, lives: g.lives, state: g.state, record: g.newRecord,
        rendered: rendered.at(-1), stored: localStorage.getItem('super_feka_gaps_highscore'),
        captionPixels: Array.from(pixels) });
    }
    return { runs, bestTime: localStorage.getItem('super_feka_gaps_best_time'),
      sentinel: localStorage.getItem('classic-record-sentinel') };
  });
  t.diagnostic(JSON.stringify(result.runs.map(({ captionPixels, ...run }) => run)));
  for (const [index, run] of result.runs.entries()) {
    assert.equal(run.cleared, true); assert.equal(run.lives, 0); assert.equal(run.state, 'GAME_OVER');
    assert.equal(run.record, index === 0); assert.equal(run.rendered.newRecord, index === 0);
    assert.equal(run.rendered.score, run.score); assert.equal(run.rendered.highScore, 200); assert.equal(run.stored, '200');
  }
  assert.notDeepEqual(result.runs[0].captionPixels, result.runs[1].captionPixels, 'record celebration changes the actual caption pixels');
  assert.deepEqual(result.runs[1].captionPixels, result.runs[2].captionPixels, 'lower and tied scores share the normal caption');
  assert.equal(result.bestTime, '42'); assert.equal(result.sentinel, 'preserved'); assert.deepEqual(errors, []);
});
