import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('block powerups emerge visually without delaying collection', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-powerup-emergence',
      transform(code, id) {
        // Real Game and rendering, with simulation advanced explicitly instead of RAF.
        if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.gameUnderTest = game;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('emergence-sentinel', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?classic=true');
  await page.waitForFunction(() => !!window.gameUnderTest);
  const runs = [];
  for (const reduced of [false, true]) {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    runs.push(await page.evaluate(async reduced => {
      const { ALL_LEVELS } = await import('/src/data/levels/index.ts');
      const { normalizeLevelData } = await import('/src/world/levelValidation.ts');
      const { TileType } = await import('/src/constants.ts');
      const originalLevel = ALL_LEVELS[0], g = gameUnderTest, storage = JSON.stringify({ ...localStorage });
      const results = [];
      let evidence = document.getElementById('evidence');
      if (!evidence) {
        evidence = document.createElement('div'); evidence.id = 'evidence';
        evidence.style = 'position:absolute;top:0;left:0;right:0;z-index:99999;background:#fff;color:#000;padding:16px;font:16px monospace';
        document.body.append(evidence);
      }
      try {
        for (const kind of ['MINI_FANTA', 'HELMET']) for (const source of ['head', 'pound']) {
          const tiles = Array.from({ length: 20 }, (_, y) => Array(40).fill(y === 19 ? TileType.GROUND : TileType.EMPTY));
          tiles[10][10] = TileType['POWERUP_BLOCK_' + kind];
          ALL_LEVELS[0] = normalizeLevelData({ ...originalLevel, width: 40, height: 20, tiles,
            playerSpawn: { x: 10, y: 14 }, goalPosition: { x: 38, y: 19 },
            enemies: [], triggers: [], checkpoints: [], collectibles: [], isBossLevel: false });
          g.startNewGame(); g.player.data.respawnRevealTimer = 0;
          if (source === 'head') {
            Object.assign(g.player.data.position, { x: 160, y: 180 });
            g.player.data.velocity.y = -8; g.updatePlaying(16);
          } else g.handleGroundPoundImpact({ x: 168, y: 160, col: 10, row: 10 });
          const item = g.collectibles[0];
          if (!item) throw new Error('real block activation did not spawn an item');
          // Rewind visual elapsed time only for a precise initial-frame comparison.
          if (item.emergenceTimer !== undefined) item.emergenceTimer = 240;
          g.player.data.position.x = 40;
          const position = JSON.stringify(item.position), velocity = JSON.stringify(item.velocity), score = g.score;
          const row = document.createElement('div'); row.textContent = `${reduced ? 'reduced' : 'normal'} ${source} ${kind}: 0 / 120 / 240 ms`;
          evidence.append(row);
          const frames = [];
          for (const elapsed of [0, 120, 240]) {
            if (elapsed) g.checkCollectibles(120);
            const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 32;
            canvas.style = 'width:64px;height:128px;image-rendering:pixelated;margin:4px;background:#c5e6ed';
            const ctx = canvas.getContext('2d');
            g.renderer.drawCollectible(item, { x: 160, y: 144 }, ctx);
            const pixels = ctx.getImageData(0, 0, 16, 16).data;
            const count = pixels.filter((_, i) => i % 4 === 3 && pixels[i] > 0).length;
            const reference = document.createElement('canvas'); reference.width = 16; reference.height = 16;
            g.renderer.drawCollectible({ ...item, emergenceTimer: undefined }, { x: 160, y: 144 }, reference.getContext('2d'));
            const expected = reference.getContext('2d').getImageData(0, 0, 16, 16).data;
            frames.push({ elapsed, count, sameAsStatic: pixels.every((v, i) => v === expected[i]) });
            g.renderer.drawTile(TileType.BLOCK_USED, 0, 16, [[TileType.BLOCK_USED]], 0, 0, ctx);
            row.append(canvas);
          }
          const unchanged = position === JSON.stringify(item.position) && velocity === JSON.stringify(item.velocity) && score === g.score;
          // Even during emergence, collection uses the final physical rectangle immediately.
          item.emergenceTimer = 240; g.player.data.position = { ...item.position };
          g.checkCollectibles(0);
          results.push({ kind, source, frames, unchanged, collected: item.collected,
            applied: kind === 'HELMET' ? g.player.data.hasHelmet : g.player.data.miniFantaTimer > 0 });
        }
      } finally { ALL_LEVELS[0] = originalLevel; }
      return { reduced, results, storageUnchanged: storage === JSON.stringify({ ...localStorage }) };
    }, reduced));
  }
  await page.locator('#evidence').screenshot({ path: process.env.EMERGENCE_CAPTURE || '/tmp/feka-emergence.png' });
  t.diagnostic(JSON.stringify(runs));
  for (const run of runs) {
    for (const item of run.results) {
      assert.equal(item.unchanged, true); assert.equal(item.collected, true); assert.equal(item.applied, true);
      if (run.reduced) assert.ok(item.frames.every(frame => frame.sameAsStatic));
      else {
        assert.equal(item.frames[0].count, 0, 'initial item is concealed by the block');
        assert.ok(item.frames[1].count > 0 && !item.frames[1].sameAsStatic, 'item partially emerges');
        assert.equal(item.frames[2].sameAsStatic, true);
      }
    }
    assert.equal(run.storageUnchanged, true);
  }
  assert.deepEqual(errors, []);
});
