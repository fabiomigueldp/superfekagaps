import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('fit to content contains full entity extents without moving the world', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-fit-extents',
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
  await page.addInitScript(() => localStorage.setItem('fit-save-sentinel', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?editor=true');
  await page.waitForFunction(() => !!window.editorUnderTest);
  const original = await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) }));
  const results = [];
  for (const shifted of [false, true]) {
    await page.evaluate(async shifted => {
      const { normalizeLevelData } = await import('/src/world/levelValidation.ts');
      const e = editorUnderTest, data = e.createBlankLevel(), dx = shifted ? -16 : 0, dy = shifted ? -10 : 0;
      Object.assign(data, { originX: dx, originY: dy, width: 24, height: 14, isBossLevel: true,
        tiles: Array.from({ length: 14 }, () => Array(24).fill(0)),
        playerSpawn: { x: dx + 2, y: dy + (shifted ? 0.5 : 6) },
        enemies: [{ type: 'JOAOZAO', position: { x: dx + 12, y: dy + 2 } }],
        collectibles: [{ type: 'COIN', position: { x: dx + 14.75, y: dy + 8.5 } }],
        checkpoints: [{ x: dx + 7, y: dy + 9 }], goalPosition: { x: dx + 5, y: dy + 10 }, triggers: [] });
      data.tiles[11][3] = 1;
      e.loadLevel(normalizeLevelData(data), '', false, true);
      e.selectTab('tab-bounds');
    }, shifted);
    const before = await page.evaluate(() => JSON.stringify(editorUnderTest.levelData));
    await page.locator('#btn-fit-content').click();
    const fitted = await page.evaluate(() => JSON.stringify(editorUnderTest.levelData));
    if (!shifted) await page.locator('#game-canvas').screenshot({ path: process.env.FIT_CAPTURE || '/tmp/feka-fit-extents.png' });
    const checks = await page.evaluate(async before => {
      const { enemySpawnRect } = await import('/src/entities/enemies/enemyCatalog.ts');
      const { flagVisualRect } = await import('/src/graphics/flagGeometry.ts');
      const { PLAYER_FRAME_W, PLAYER_FRAME_H, PLAYER_HITBOX_H, PLAYER_RENDER_OFFSET_X, PLAYER_RENDER_OFFSET_Y } = await import('/src/assets/playerSpriteSpec.ts');
      const e = editorUnderTest, d = e.levelData, old = JSON.parse(before);
      const bounds = { x: d.originX * 16, y: d.originY * 16, right: (d.originX + d.width) * 16, bottom: (d.originY + d.height) * 16 };
      const rects = [enemySpawnRect(d.enemies[0].type, d.enemies[0].position),
        { x: d.playerSpawn.x * 16 + PLAYER_RENDER_OFFSET_X, y: d.playerSpawn.y * 16 - PLAYER_HITBOX_H + PLAYER_RENDER_OFFSET_Y, width: PLAYER_FRAME_W, height: PLAYER_FRAME_H },
        { x: d.collectibles[0].position.x * 16, y: d.collectibles[0].position.y * 16, width: 16, height: 16 },
        flagVisualRect('goal', d.goalPosition.x * 16, d.goalPosition.y * 16),
        ...d.checkpoints.map(p => flagVisualRect('checkpoint', p.x * 16, p.y * 16))];
      const contained = rects.map(r => r.x >= bounds.x && r.y >= bounds.y && r.x + r.width <= bounds.right && r.y + r.height <= bounds.bottom);
      const entities = value => JSON.stringify([value.playerSpawn, value.enemies, value.collectibles, value.checkpoints, value.goalPosition, value.triggers]);
      const worldTiles = value => value.tiles.flatMap((row, y) => row.flatMap((tile, x) => tile ? [[x + value.originX, y + value.originY, tile]] : []));
      return { bounds, contained, entitiesUnchanged: entities(old) === entities(d), tilesUnchanged: JSON.stringify(worldTiles(old)) === JSON.stringify(worldTiles(d)), index: e.history.index };
    }, before);
    await page.locator('#btn-fit-content').click();
    const idempotent = await page.evaluate(fitted => JSON.stringify(editorUnderTest.levelData) === fitted && editorUnderTest.history.index === 1, fitted);
    await page.evaluate(() => editorUnderTest.restoreHistory(false));
    const undo = await page.evaluate(before => JSON.stringify(editorUnderTest.levelData) === before, before);
    await page.evaluate(() => editorUnderTest.restoreHistory(true));
    const redo = await page.evaluate(fitted => JSON.stringify(editorUnderTest.levelData) === fitted, fitted);
    results.push({ shifted, ...checks, idempotent, undo, redo });
  }
  t.diagnostic(JSON.stringify(results));
  for (const result of results) {
    assert.ok(result.contained.every(Boolean), 'full entity extents inside fitted bounds');
    assert.equal(result.index, 1);
    assert.ok(result.entitiesUnchanged && result.tilesUnchanged && result.idempotent && result.undo && result.redo);
  }
  assert.deepEqual(await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) })), original);
  assert.deepEqual(errors, []);
});
