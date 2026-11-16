import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('terrain decoration respects live reduced motion in game, editor draw calls and menus', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage({ reducedMotion: 'no-preference' });
  await page.route('**/terrain-fixture', route => route.fulfill({ contentType: 'text/html', body: '<canvas id="game-canvas" hidden></canvas><main id="evidence"></main>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/terrain-fixture');
  await page.evaluate(async () => {
    const { Renderer } = await import('/src/engine/Renderer.ts');
    const { TileType: T } = await import('/src/constants.ts');
    const { hashAt } = await import('/src/graphics/palette.ts');
    const r = new Renderer(); let grassCol = 0;
    while (hashAt(grassCol, 1) % 7 !== 1) grassCol++;
    const types = [T.GROUND, T.GLOW_CRYSTAL, T.LAVA_TOP, T.LAVA_FILL, T.SPIKE, T.PLATFORM_FALLING];
    const crop = (source, x, y, w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h); return c;
    };
    let menu;
    const postcard = r.postcard.bind(r);
    r.postcard = c => { postcard(c); menu = crop(c.canvas, 0, 126, 320, 20).toDataURL(); };
    window.terrainSamples = label => {
      const samples = [];
      for (const time of [0, 560]) {
        r.clock.time = time;
        const pixels = types.map(type => {
          const c = document.createElement('canvas'); c.width = c.height = 24;
          const tiles = [[T.EMPTY], [type]];
          r.drawTile(type, 4, 4, tiles, 1, 0, c.getContext('2d'), grassCol, 1);
          const row = document.createElement('div'); row.textContent = `${label} ${time}ms tile ${type}`;
          c.style = 'width:96px;height:96px;image-rendering:pixelated;background:#25344c'; row.append(c);
          document.getElementById('evidence').append(row); return c.toDataURL();
        });
        const tiles = [Array(20).fill(T.EMPTY), Array(20).fill(T.GROUND), Array(20).fill(T.LAVA_TOP)];
        const before = JSON.stringify(tiles), camera = { x: 0, y: 0 };
        r.startScene(1); r.drawTiles(tiles, camera);
        const game = r.getContext().canvas.toDataURL();
        r.startScene(1); r.drawTitleScreen();
        samples.push({ pixels, game, menu, unchanged: before === JSON.stringify(tiles) && r.clock.time === time && camera.x === 0 && camera.y === 0 });
      }
      return samples;
    };
    window.disposeTerrain = () => r.dispose();
  });
  const normal = await page.evaluate(() => terrainSamples('normal'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => terrainSamples('reduzido'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const restored = await page.evaluate(() => terrainSamples('restaurado'));
  await page.evaluate(() => disposeTerrain());
  t.diagnostic(JSON.stringify({ normalStable: normal[0].pixels.map((p, i) => p === normal[1].pixels[i]), reducedStable: reduced[0].pixels.map((p, i) => p === reduced[1].pixels[i]) }));
  assert.deepEqual(restored, normal, 'normal visuals restored live');
  assert.ok([...normal, ...reduced].every(s => s.unchanged), 'no terrain, camera or clock mutation');
  for (let i = 0; i < 4; i++) assert.notEqual(normal[0].pixels[i], normal[1].pixels[i], 'normal material animation exists');
  assert.ok(reduced[0].pixels.every((p, i) => p === reduced[1].pixels[i]), 'reduced material pixels stable');
  assert.deepEqual(reduced[0].pixels, normal[0].pixels, 'original silhouettes and colors retained');
  for (const key of ['game', 'menu']) {
    assert.notEqual(normal[0][key], normal[1][key], key + ': normal animation exists');
    assert.ok(reduced[0][key] === reduced[1][key], key + ': reduced decoration stable');
  }
});
