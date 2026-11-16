import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic items and flag states stay distinct and still with live reduced motion', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage({ reducedMotion: 'no-preference' });
  await page.route('**/items-fixture', route => route.fulfill({ contentType: 'text/html', body: '<canvas id="game-canvas" hidden></canvas>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/items-fixture');
  await page.evaluate(async () => {
    const { Renderer } = await import('/src/engine/Renderer.ts');
    const { CollectibleType: C } = await import('/src/types.ts');
    const r = new Renderer(), camera = { x: 10, y: 20 };
    window.itemSamples = () => [0, 360, 540].map(time => {
      r.clock.time = time; const pictures = [], unchanged = [];
      for (const type of [C.COIN, C.MINI_FANTA]) {
        const item = { type, active: true, collected: false, position: { x: 60, y: 80 }, width: 16, height: 16, animationTimer: time };
        const before = JSON.stringify(item);
        r.startScene(1); r.drawCollectible(item, camera); pictures.push(r.getContext().canvas.toDataURL());
        unchanged.push(before === JSON.stringify(item));
        item.collected = true; r.startScene(1); const empty = r.getContext().canvas.toDataURL();
        r.drawCollectible(item, camera); unchanged.push(empty === r.getContext().canvas.toDataURL());
      }
      for (const [kind, state] of [['checkpoint', 'inactive'], ['checkpoint', 'active'], ['goal', 'inactive']]) {
        const flag = { kind, state, enabled: true, anchor: { x: 60, y: 80 } }, before = JSON.stringify(flag);
        r.startScene(1); r.drawFlag(flag, camera); pictures.push(r.getContext().canvas.toDataURL());
        unchanged.push(before === JSON.stringify(flag));
        flag.enabled = false; r.startScene(1); const empty = r.getContext().canvas.toDataURL();
        r.drawFlag(flag, camera); unchanged.push(empty === r.getContext().canvas.toDataURL());
      }
      return { pictures, unchanged: unchanged.every(Boolean) && r.clock.time === time && camera.x === 10 && camera.y === 20 };
    });
    window.disposeItems = () => r.dispose();
  });
  const normal = await page.evaluate(() => itemSamples());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => itemSamples());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const restored = await page.evaluate(() => itemSamples());
  await page.evaluate(() => disposeItems());
  t.diagnostic(JSON.stringify({ normalStable: normal[0].pictures.map((p, i) => normal.every(s => s.pictures[i] === p)), reducedStable: reduced[0].pictures.map((p, i) => reduced.every(s => s.pictures[i] === p)) }));
  assert.deepEqual(restored, normal);
  assert.ok([...normal, ...reduced].every(s => s.unchanged), 'data, visibility gates and clocks preserved');
  for (let i = 0; i < 5; i++) {
    assert.ok(normal.some(s => s.pictures[i] !== normal[0].pictures[i]), 'normal animation exists');
    assert.ok(reduced.every(s => s.pictures[i] === reduced[0].pictures[i]), 'reduced animation stable');
    assert.equal(reduced[0].pictures[i], normal[0].pictures[i], 'original color, orientation and position retained');
  }
  assert.equal(new Set(reduced[0].pictures).size, 5, 'items and flag states remain distinct');
});
