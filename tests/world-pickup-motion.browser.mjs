import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('World pickups stay legible and still with live reduced motion', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage({ reducedMotion: 'no-preference' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/pickup-fixture', route => route.fulfill({ contentType: 'text/html', body: '<canvas id="game-canvas" hidden></canvas><main id="evidence"></main>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/pickup-fixture');
  await page.evaluate(async () => {
    const { WorldGame } = await import('/src/adventure/WorldGame.ts');
    const { WorldArt } = await import('/src/adventure/WorldArt.ts');
    const { Renderer } = await import('/src/engine/Renderer.ts');
    const { ProgressStore } = await import('/src/adventure/progress.ts');
    const renderer = new Renderer(), art = new WorldArt(), store = new ProgressStore(null, false);
    // Isolate collectible pixels; the real renderLevel loop and all pickup drawing remain intact.
    for (const name of ['background', 'structures', 'terrain', 'objects']) art[name] = () => {};
    const pickups = ['seal', 'seal', 'coin', 'fanta', 'helmet'].map((kind, i) => ({ id: `fixture:${i}`, kind, x: 32 + i * 52, y: 80 }));
    store.save.seals = [pickups[1].id];
    const game = Object.assign(Object.create(WorldGame.prototype), { renderer, art, store,
      stage: { id: 'fixture', world: 1, number: 1, landmarks: [], checkpoints: [], exits: [], pickups },
      camera: { x: 0, y: 0, shakeTimer: 0 }, level: { getFallingPlatformRenderData: () => [] },
      objects: {}, collected: new Set(), foes: [], boss: null, sparks: [], state: 'playing',
      hudAccessibility: { showsReadableStrip: true }, player: { data: { hasHelmet: false } }, renderPlayer: () => {} });
    const snapshot = () => JSON.stringify({ stage: game.stage, save: store.save, collected: [...game.collected], time: game.time });
    window.pickupSamples = (label, capture) => {
      const result = [];
      for (const time of [0, 330, 710]) {
        game.time = time; const before = snapshot();
        const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
        canvas.style = 'width:640px;height:360px;image-rendering:pixelated';
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#25344c'; ctx.fillRect(0, 0, 320, 180);
        game.renderLevel(ctx);
        const pixels = pickups.map(item => {
          const crop = document.createElement('canvas'); crop.width = 24; crop.height = 28;
          crop.getContext('2d').drawImage(canvas, item.x - 4, item.y - 4, 24, 28, 0, 0, 24, 28);
          return crop.toDataURL();
        });
        result.push({ pixels, unchanged: before === snapshot() });
        if (capture) {
          const row = document.createElement('div'); row.textContent = `${label} ${time}ms: selo disponível / ganho / moeda / Fanta / capacete`; row.append(canvas);
          document.getElementById('evidence').append(row);
        }
      }
      return result;
    };
    window.disposePickups = () => renderer.dispose();
  });
  const normal = await page.evaluate(() => pickupSamples('normal', true));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => pickupSamples('reduzido', true));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const restored = await page.evaluate(() => pickupSamples('restaurado', false));
  await page.locator('#evidence').screenshot({ path: process.env.PICKUP_CAPTURE || '/tmp/feka-world-pickups.png' });
  await page.evaluate(() => disposePickups());
  t.diagnostic(JSON.stringify({ normalStable: normal[0].pixels.map((p, i) => normal.every(s => s.pixels[i] === p)),
    reducedStable: reduced[0].pixels.map((p, i) => reduced.every(s => s.pixels[i] === p)) }));
  assert.deepEqual(restored, normal, 'normal animation returns live');
  assert.ok([...normal, ...reduced, ...restored].every(s => s.unchanged), 'drawing does not mutate data or timers');
  for (const i of [0, 2, 3]) assert.ok(normal.some(s => s.pixels[i] !== normal[0].pixels[i]), 'normal animation visible');
  assert.ok(reduced.every(s => s.pixels.every((p, i) => p === reduced[0].pixels[i])), 'reduced pickup pixels stable');
  assert.notEqual(reduced[0].pixels[0], reduced[0].pixels[1], 'earned seal remains distinct');
  for (const i of [1, 4]) assert.ok([...normal, ...reduced].every(s => s.pixels[i] === normal[0].pixels[i]), 'already static items unchanged');
  assert.deepEqual(errors, []);
});
