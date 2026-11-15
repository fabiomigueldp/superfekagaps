import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('falling platforms suppress only arming shake and follow live reduced motion changes', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage({ reducedMotion: 'no-preference' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/motion-fixture', route => route.fulfill({ contentType: 'text/html',
    body: '<canvas id="game-canvas"></canvas>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/motion-fixture');
  await page.evaluate(async () => {
    const { Renderer } = await import('/src/engine/Renderer.ts');
    const { FALLING_PLATFORM_FALL_MS } = await import('/src/constants.ts');
    const renderer = new Renderer();
    const original = renderer.drawTile.bind(renderer), draws = [];
    renderer.drawTile = (...args) => {
      draws.push({ x: args[1], y: args[2], alpha: args[6].globalAlpha });
      original(...args); // Keep the real tile painter and canvas drawing.
    };
    const platforms = ['contact', 'arming', 'arming', 'falling', 'cooldown'].map((phase, i) =>
      Object.freeze({ col: 3, row: 2, phase, timer: i === 3 ? FALLING_PLATFORM_FALL_MS / 2 : i * 40, contact: 0 }));
    window.samplePlatforms = () => {
      draws.length = 0;
      renderer.drawFallingPlatforms(platforms, { x: 3, y: 5 }, 1, 1);
      return { reduced: renderer.reducedMotion, draws: [...draws] };
    };
  });
  const normal = await page.evaluate(() => samplePlatforms());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => samplePlatforms());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const restored = await page.evaluate(() => samplePlatforms());
  t.diagnostic(JSON.stringify({ normal, reduced, restored }));
  assert.equal(normal.reduced, false); assert.equal(reduced.reduced, true);
  assert.equal(normal.draws.length, 4, 'cooldown remains invisible');
  assert.deepEqual(normal.draws.map(draw => draw.x), [61, 62, 60, 61]);
  assert.deepEqual(reduced.draws.map(draw => draw.x), [61, 61, 61, 61]);
  assert.deepEqual(reduced.draws, normal.draws.map(draw => ({ ...draw, x: 61 })),
    'platform visibility, vertical fall and opacity are unchanged');
  assert.ok(normal.draws[3].y > normal.draws[0].y, 'fall displacement remains visible');
  assert.deepEqual(restored, normal, 'the same renderer resumes normal motion live');
  assert.deepEqual(errors, []);
});
