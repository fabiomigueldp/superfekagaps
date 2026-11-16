import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('attack warning keeps its progress and geometry without flashing under reduced motion', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage({ reducedMotion: 'no-preference' });
  await page.route('**/warning-fixture', route => route.fulfill({ contentType: 'text/html', body: '<canvas id="game-canvas" hidden></canvas>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/warning-fixture');
  await page.evaluate(async () => {
    const { Renderer } = await import('/src/engine/Renderer.ts');
    const { Joaozao } = await import('/src/entities/enemies/Joaozao.ts');
    const { ART } = await import('/src/graphics/palette.ts');
    const r = new Renderer(), boss = new Joaozao(20, 10);
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
    const c = canvas.getContext('2d'), original = c.fillRect.bind(c); let rectangles = [];
    c.fillRect = (...args) => { rectangles.push({ args, color: c.fillStyle }); original(...args); };
    window.warningSamples = () => {
      const runs = [];
      for (const progress of [0, .5, 1]) for (const time of [0, 90, 180]) {
        r.clock.time = time; boss.data.attackPreview = { x: 40, y: 60, width: 48, progress };
        const camera = { x: 10, y: 20 }, before = JSON.stringify(boss.data);
        c.clearRect(0, 0, 120, 80); rectangles = [];
        r.drawEnemy(boss.data, camera, c);
        runs.push({ progress, time, image: canvas.toDataURL(), rectangles,
          unchanged: before === JSON.stringify(boss.data) && r.clock.time === time && camera.x === 10 && camera.y === 20 });
      }
      return { runs, red: ART.red };
    };
    window.disposeWarning = () => r.dispose();
  });
  const normal = await page.evaluate(() => warningSamples());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => warningSamples());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const restored = await page.evaluate(() => warningSamples());
  await page.evaluate(() => disposeWarning());
  assert.deepEqual(restored, normal, 'normal warning restored live');
  for (let i = 0; i < 9; i += 3) {
    assert.notEqual(normal.runs[i].image, normal.runs[i + 1].image, 'normal color alternates');
    assert.ok(reduced.runs.slice(i, i + 3).every(r => r.image === reduced.runs[i].image), 'reduced warning stays stable');
  }
  for (const [i, run] of reduced.runs.entries()) {
    assert.equal(run.unchanged, true);
    assert.deepEqual(run.rectangles.map(r => r.args), normal.runs[i].rectangles.map(r => r.args), 'positions and sizes preserved');
    const bar = run.rectangles.find(r => r.color === reduced.red && r.args[1] === 41);
    assert.deepEqual(bar.args, [30, 41, Math.round(48 * run.progress), 1], 'temporal progress remains visible');
  }
  assert.notEqual(reduced.runs[0].image, reduced.runs[3].image);
  assert.notEqual(reduced.runs[3].image, reduced.runs[6].image);
});
