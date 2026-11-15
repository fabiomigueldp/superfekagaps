import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic boss visibility follows zoomed horizontal and vertical viewport boundaries', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-boss-visibility',
      transform(code, id) {
        // Real Game and rendering, with simulation advanced explicitly instead of RAF.
        if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.gameUnderTest = game;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('boss-visibility-sentinel', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?classic=true');
  await page.waitForFunction(() => !!window.gameUnderTest);
  const result = await page.evaluate(async () => {
    const { ALL_LEVELS } = await import('/src/data/levels/index.ts');
    const { normalizeLevelData } = await import('/src/world/levelValidation.ts');
    const { TileType } = await import('/src/constants.ts');
    const originalLevel = ALL_LEVELS[2], g = gameUnderTest;
    // Large valid arena in memory; no campaign or save files are changed.
    ALL_LEVELS[2] = normalizeLevelData({ ...originalLevel, width: 400, height: 200,
      tiles: Array.from({ length: 200 }, (_, y) => Array(400).fill(y === 199 ? TileType.GROUND : TileType.EMPTY)),
      playerSpawn: { x: 10, y: 10 }, goalPosition: { x: 390, y: 198 },
      triggers: [], checkpoints: [], collectibles: [] });
    const storage = JSON.stringify({ ...localStorage }), runs = [];
    try {
      g.loadLevel(2);
      const boss = g.boss.data;
      for (const zoom of [1, 0.5, 0.1, 2, 8]) {
        Object.assign(g.camera, { x: 128, y: 128, zoom });
        const right = 128 + 320 / zoom, bottom = 128 + 180 / zoom;
        const cases = [
          ['right edge', right, 128, true], ['right outside', right + 1, 128, false],
          ['bottom edge', 128, bottom, true], ['bottom outside', 128, bottom + 1, false],
          ['left edge', 128 - boss.width, 128, true], ['left outside', 127 - boss.width, 128, false],
          ['top edge', 128, 128 - boss.height, true], ['top outside', 128, 127 - boss.height, false]
        ];
        for (const [edge, x, y, expected] of cases) {
          Object.assign(boss.position, { x, y });
          runs.push({ zoom, edge, expected, visible: g.isBossVisible() });
        }
      }
      const bossInstance = g.boss; g.boss = null;
      const absentVisible = g.isBossVisible(); g.boss = bossInstance;
      return { runs, absentVisible, storageUnchanged: storage === JSON.stringify({ ...localStorage }) };
    } finally { ALL_LEVELS[2] = originalLevel; }
  });
  t.diagnostic(JSON.stringify(result));
  for (const run of result.runs) assert.equal(run.visible, run.expected, `${run.edge} at zoom ${run.zoom}`);
  assert.equal(result.absentVisible, false);
  assert.equal(result.storageUnchanged, true); assert.deepEqual(errors, []);
});
