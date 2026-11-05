import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic gestures belong to one pointer through competing touches and cancellation', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-editor-pointer-owner',
      transform(code, id) {
        if (id.endsWith('/src/main.ts')) return code.replace('game = new mode.Game(canvas);',
          'game = new mode.Game(canvas); window.editorUnderTest = game.editorController;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('pointer-owner-save', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?editor=true');
  await page.waitForFunction(() => !!window.editorUnderTest);
  const original = await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) }));
  const canvas = page.locator('#game-canvas'), box = await canvas.boundingBox();
  const session = await page.context().newCDPSession(page);
  const touch = (type, points) => session.send('Input.dispatchTouchEvent', { type,
    touchPoints: points.map(([id, x, y]) => ({ id, x: box.x + x, y: box.y + y })) });
  const setup = kind => page.evaluate(kind => {
    const e = window.editorUnderTest, data = e.createBlankLevel();
    data.playerSpawn = { x: 10, y: 5 };
    if (kind === 'ERASER') for (const row of data.tiles) row.fill(1);
    e.loadLevel(data, '', false, true); e.camera.x = e.camera.y = 0; e.zoom = 1;
    e.setTool(kind === 'BOUNDS' ? 'SELECT' : kind);
    window.ownerEvents = [];
    document.getElementById('game-canvas').onpointerdown = event => window.ownerEvents.push(event.pointerId);
  }, kind);
  const snapshot = () => page.evaluate(() => ({ data: JSON.stringify(editorUnderTest.levelData),
    camera: [editorUnderTest.camera.x, editorUnderTest.camera.y], index: editorUnderTest.history.index,
    dragging: editorUnderTest.isDragging }));
  const results = [];
  for (const kind of ['BRUSH', 'ERASER', 'SELECT', 'RECTANGLE', 'BOUNDS', 'HAND']) {
    const runs = [];
    for (const competing of [false, true]) {
      await setup(kind); const initial = await snapshot();
      const y = kind === 'BOUNDS' ? 240 : 88, endY = kind === 'BOUNDS' ? 272 : 88;
      await touch('touchStart', [[1, 168, y]]);
      if (competing) {
        await touch('touchStart', [[1, 168, y], [2, 328, 136]]);
        await touch('touchMove', [[1, 168, y], [2, 360, 152]]);
        // A different pointer type can also be primary; isPrimary alone is insufficient.
        await page.evaluate(() => {
          const c = document.getElementById('game-canvas'), r = c.getBoundingClientRect();
          c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 99, pointerType: 'pen', isPrimary: true,
            buttons: 1, clientX: r.left + 400, clientY: r.top + 160 }));
          for (const type of ['pointercancel', 'lostpointercapture'])
            c.dispatchEvent(new PointerEvent(type, { pointerId: 99 }));
        });
      }
      await touch('touchMove', [[1, 200, endY], ...(competing ? [[2, 360, 152]] : [])]);
      if (competing) await touch('touchMove', [[1, 200, endY]]);
      await touch('touchMove', [[1, 232, endY]]);
      await touch('touchEnd', []);
      const final = await snapshot();
      await page.evaluate(() => editorUnderTest.restoreHistory(false));
      const undo = (await snapshot()).data === initial.data;
      await page.evaluate(() => editorUnderTest.restoreHistory(true));
      const redo = (await snapshot()).data === final.data;
      runs.push({ final, undo, redo });
    }
    results.push({ kind, same: JSON.stringify(runs[0]) === JSON.stringify(runs[1]),
      normal: { index: runs[0].final.index, changed: kind === 'HAND' ? runs[0].final.camera[0] !== 0 : runs[0].final.index === 1 },
      undo: runs.every(r => r.undo), redo: runs.every(r => r.redo), stopped: runs.every(r => !r.final.dragging) });
  }
  const cancellations = [];
  for (const ending of ['cancel', 'capture', 'tool', 'blur']) {
    await setup('BRUSH'); await touch('touchStart', [[1, 168, 88]]);
    await touch('touchMove', [[1, 200, 88]]);
    const oldId = await page.evaluate(() => window.ownerEvents[0]);
    if (ending === 'cancel') await touch('touchCancel', []);
    else {
      await page.evaluate(ending => {
        if (ending === 'capture') document.getElementById('game-canvas').releasePointerCapture(window.ownerEvents[0]);
        if (ending === 'tool') editorUnderTest.setTool('BRUSH');
        if (ending === 'blur') window.dispatchEvent(new Event('blur'));
      }, ending);
      // Flush native lostpointercapture; this move must not continue painting.
      await touch('touchMove', [[1, 232, 88]]); await touch('touchEnd', []);
    }
    const ended = await snapshot();
    await touch('touchStart', [[3, 264, 88]]);
    await page.evaluate(id => document.getElementById('game-canvas').dispatchEvent(
      new PointerEvent('lostpointercapture', { pointerId: id })), oldId);
    await touch('touchMove', [[3, 296, 88]]); await touch('touchEnd', []);
    cancellations.push({ ending, ended: !ended.dragging, index: ended.index,
      noTail: JSON.parse(ended.data).tiles[5][14] === 0,
      fresh: await page.evaluate(() => editorUnderTest.levelData.tiles[5][18] === 1 && editorUnderTest.history.index === 2) });
  }
  const mouse = [];
  for (const button of ['left', 'right', 'middle']) {
    await setup('BRUSH'); await page.mouse.move(box.x + 168, box.y + 88);
    const hover = await page.evaluate(() => editorUnderTest.hoveredCol === 10);
    await page.mouse.down({ button }); await page.mouse.move(box.x + 200, box.y + 88); await page.mouse.up({ button });
    mouse.push({ button, hover, valid: await page.evaluate(button => !editorUnderTest.isDragging &&
      (button === 'left' ? editorUnderTest.levelData.tiles[5][12] === 1 && editorUnderTest.history.index === 1
        : editorUnderTest.camera.x === -32 && editorUnderTest.history.index === 0), button) });
  }
  t.diagnostic(JSON.stringify({ results, cancellations, mouse }));
  for (const r of results) {
    assert.equal(r.same, true, r.kind + ' ignores competing pointers');
    assert.equal(r.normal.changed, true, r.kind + ' normal gesture remains effective');
    assert.equal(r.undo && r.redo && r.stopped, true, r.kind + ' history and completion');
  }
  for (const r of cancellations) assert.deepEqual(r, { ending: r.ending, ended: true, index: 1, noTail: true, fresh: true });
  for (const r of mouse) assert.deepEqual(r, { button: r.button, hover: true, valid: true });
  assert.deepEqual(await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) })), original);
  assert.deepEqual(errors, []);
});
