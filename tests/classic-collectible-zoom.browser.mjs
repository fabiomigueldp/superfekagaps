import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic collects and renders overlapping coins across normal and reduced zoom', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-collectible-zoom',
      transform(code, id) {
        // Real Game and rendering, with simulation advanced explicitly instead of RAF.
        if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.gameUnderTest = game;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('collectible-zoom-sentinel', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?classic=true');
  await page.waitForFunction(() => !!window.gameUnderTest);
  const result = await page.evaluate(async () => {
    const { ALL_LEVELS } = await import('/src/data/levels/index.ts');
    const { normalizeLevelData } = await import('/src/world/levelValidation.ts');
    const { TileType, COIN_SCORE } = await import('/src/constants.ts');
    const { CollectibleType } = await import('/src/types.ts');
    const originalLevel = ALL_LEVELS[0], g = gameUnderTest;
    // A valid wide map, confined to this browser context; campaign files stay untouched.
    ALL_LEVELS[0] = normalizeLevelData({ ...originalLevel, width: 400, height: 16,
      tiles: Array.from({ length: 16 }, (_, y) => Array(400).fill(y === 15 ? TileType.GROUND : TileType.EMPTY)),
      playerSpawn: { x: 175, y: 12 }, goalPosition: { x: 390, y: 14 },
      enemies: [], triggers: [], checkpoints: [], isBossLevel: false,
      collectibles: [175, 177].map(x => ({ type: CollectibleType.COIN, position: { x, y: 12 } })) });
    const storage = JSON.stringify({ ...localStorage }), runs = [], drawn = [];
    const draw = g.renderer.drawCollectible.bind(g.renderer);
    g.renderer.drawCollectible = (coin, camera) => { drawn.push(coin); draw(coin, camera); };
    try {
      for (const zoom of [1, 0.5, 0.1]) {
        g.startNewGame();
        const coin = g.collectibles[0], other = g.collectibles[1];
        g.player.data.position = { ...coin.position };
        Object.assign(g.camera, { x: coin.position.x - 240 / zoom, y: 0, zoom });
        drawn.length = 0; g.render();
        const rendered = drawn.includes(coin), before = g.score;
        g.checkCollectibles(16);
        const scoreAfter = g.score, coinsAfter = g.coins;
        g.checkCollectibles(16);
        runs.push({ zoom, rendered, collected: coin.collected, otherCollected: other.collected,
          credited: scoreAfter - before, coinsAfter, scoreStable: g.score === scoreAfter, coinsStable: g.coins === coinsAfter });
      }
    } finally { ALL_LEVELS[0] = originalLevel; }
    return { runs, coinScore: COIN_SCORE, storageUnchanged: storage === JSON.stringify({ ...localStorage }) };
  });
  t.diagnostic(JSON.stringify(result));
  for (const run of result.runs) {
    assert.equal(run.collected, true, `overlap collected at zoom ${run.zoom}`);
    assert.equal(run.rendered, true, `visible coin rendered at zoom ${run.zoom}`);
    assert.equal(run.otherCollected, false);
    assert.equal(run.credited, result.coinScore); assert.equal(run.coinsAfter, 1);
    assert.equal(run.scoreStable, true); assert.equal(run.coinsStable, true);
  }
  assert.equal(result.storageUnchanged, true); assert.deepEqual(errors, []);
});
