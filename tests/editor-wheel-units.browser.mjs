import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('editor wheel zoom normalizes units and preserves cursor anchor', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-wheel-units',
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
  await page.addInitScript(() => localStorage.setItem('wheel-save-sentinel', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?editor=true');
  await page.waitForFunction(() => !!window.editorUnderTest);
  const original = await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) }));
  const result = await page.evaluate(() => {
    const e = editorUnderTest, canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    // MouseEvent coordinates are integer CSS pixels; use the dispatched point as the oracle.
    const mouse = { x: Math.round(rect.left + rect.width * 0.37) - rect.left,
      y: Math.round(rect.top + rect.height * 0.65) - rect.top };
    const initial = JSON.stringify(e.levelData), index = e.history.index, runs = [];
    for (const [name, start, pixels] of [['out', 1, 96], ['in', 1, -96], ['minimum', 0.031, 96], ['maximum', 7.999, -96], ['zero', 1, 0]]) {
      for (const mode of [WheelEvent.DOM_DELTA_PIXEL, WheelEvent.DOM_DELTA_LINE, WheelEvent.DOM_DELTA_PAGE]) {
        e.zoom = start; Object.assign(e.camera, { x: -120, y: 45 });
        const before = { x: mouse.x / start + e.camera.x, y: mouse.y / start + e.camera.y };
        const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaMode: mode,
          deltaY: pixels / (mode === 1 ? 16 : mode === 2 ? rect.height : 1),
          clientX: rect.left + mouse.x, clientY: rect.top + mouse.y });
        canvas.dispatchEvent(event);
        runs.push({ name, mode, zoom: e.zoom, expected: Math.max(0.03, Math.min(8, start - pixels * 0.0002)),
          anchorError: Math.max(Math.abs(mouse.x / e.zoom + e.camera.x - before.x), Math.abs(mouse.y / e.zoom + e.camera.y - before.y)),
          prevented: event.defaultPrevented });
      }
    }
    const zoom = e.zoom, camera = JSON.stringify(e.camera);
    const outside = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaMode: 1, deltaY: 6 });
    document.body.dispatchEvent(outside);
    return { runs, unchanged: initial === JSON.stringify(e.levelData) && index === e.history.index,
      outsideUnchanged: zoom === e.zoom && camera === JSON.stringify(e.camera) && !outside.defaultPrevented };
  });
  t.diagnostic(JSON.stringify(result));
  for (const run of result.runs) {
    assert.ok(Math.abs(run.zoom - run.expected) < 1e-12, `${run.name}, deltaMode ${run.mode}`);
    assert.ok(run.anchorError < 1e-9, 'world point remains under cursor');
    assert.equal(run.prevented, true);
  }
  assert.equal(result.unchanged, true); assert.equal(result.outsideUnchanged, true);
  assert.deepEqual(await page.evaluate(async () => ({ storage: JSON.stringify({ ...localStorage }),
    campaign: JSON.stringify((await import('/src/data/levels/index.ts')).CAMPAIGN_LEVELS) })), original);
  assert.deepEqual(errors, []);
});
