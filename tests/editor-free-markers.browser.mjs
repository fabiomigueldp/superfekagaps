import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('checkpoint and goal placement match free and snapped previews without bypassing bounds or history', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-marker-placement',
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
  await page.addInitScript(() => localStorage.setItem('marker-save-sentinel', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?editor=true');
  await page.waitForFunction(() => !!window.editorUnderTest);
  const original = await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) }));
  const box = await page.locator('#game-canvas').boundingBox();
  const click = (x, y) => page.mouse.click(box.x + x, box.y + y);
  const snapshot = () => page.evaluate(() => JSON.stringify(editorUnderTest.levelData));
  const results = [];
  for (const type of ['CHECKPOINT', 'GOAL']) for (const ctrl of [false, true]) {
    await page.evaluate(type => {
      const e = editorUnderTest, data = e.createBlankLevel();
      Object.assign(data, { originX: 2, originY: 3, width: 10, height: 8, tiles: Array.from({ length: 8 }, () => Array(10).fill(0)),
        playerSpawn: { x: 3, y: 4 }, goalPosition: { x: 10, y: 9 } });
      e.loadLevel(data, '', false, true); e.camera.x = e.camera.y = 0; e.zoom = 1;
      e.setTool('BRUSH'); e.activeContent = { type: 'ENTITY', id: type.toLowerCase(), entityType: type };
      document.getElementById('game-canvas').focus();
    }, type);
    const initial = await snapshot();
    if (ctrl) await page.keyboard.down('Control');
    await page.mouse.move(box.x + 88, box.y + 104);
    const preview = await page.evaluate(() => {
      let point; editorUnderTest.drawGhostPreview({ drawEditorGhost(_item, x, y) { point = { x: x / 16, y: y / 16 }; } }, {});
      return point;
    });
    await click(88, 104); const placed = await snapshot();
    const point = await page.evaluate(type => type === 'GOAL' ? editorUnderTest.levelData.goalPosition : editorUnderTest.levelData.checkpoints[0], type);
    await page.evaluate(() => editorUnderTest.restoreHistory(false)); const undo = await snapshot() === initial;
    await page.evaluate(() => editorUnderTest.restoreHistory(true)); const redo = await snapshot() === placed;
    await click(88, 104);
    const duplicate = await page.evaluate(() => editorUnderTest.history.index === 1);
    await click(92, 108);
    const nearby = await page.evaluate(() => ({ count: editorUnderTest.levelData.checkpoints.length, index: editorUnderTest.history.index }));
    const beforeOutside = await snapshot();
    for (const [x, y] of [[31, 104], [192, 104], [88, 47], [88, 176]]) await click(x, y);
    const bounds = await snapshot() === beforeOutside;
    await click(191, 175);
    const edge = await page.evaluate(type => type === 'GOAL' ? editorUnderTest.levelData.goalPosition : editorUnderTest.levelData.checkpoints.at(-1), type);
    const restUnchanged = await page.evaluate(initial => {
      const omitMarkers = data => { const { checkpoints, goalPosition, ...rest } = data; return JSON.stringify(rest); };
      return omitMarkers(editorUnderTest.levelData) === omitMarkers(JSON.parse(initial));
    }, initial);
    if (ctrl) await page.keyboard.up('Control');
    results.push({ type, ctrl, preview, point, undo, redo, duplicate, nearby, bounds, edge, restUnchanged });
  }
  t.diagnostic(JSON.stringify(results));
  for (const r of results) {
    assert.deepEqual(r.point, r.ctrl ? { x: 5.5, y: 6.5 } : { x: 5, y: 6 });
    assert.deepEqual(r.point, r.preview);
    assert.equal(r.undo && r.redo && r.duplicate && r.bounds && r.restUnchanged, true);
    assert.deepEqual(r.nearby, { count: r.type === 'GOAL' ? 0 : r.ctrl ? 2 : 1, index: r.ctrl ? 2 : 1 });
    assert.deepEqual(r.edge, r.ctrl ? { x: 191 / 16, y: 175 / 16 } : { x: 11, y: 10 });
  }
  assert.deepEqual(await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) })), original);
  assert.deepEqual(errors, []);
});
