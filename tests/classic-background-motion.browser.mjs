import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic and menu backgrounds suppress only autonomous drift with live reduced motion', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage({ reducedMotion: 'no-preference' });
  await page.route('**/background-fixture', route => route.fulfill({ contentType: 'text/html', body: '<canvas id="game-canvas" hidden></canvas><main id="evidence"></main>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/background-fixture');
  await page.evaluate(async () => {
    const { Renderer } = await import('/src/engine/Renderer.ts');
    const r = new Renderer(), original = r.menuBackground.draw.bind(r.menuBackground);
    let menu;
    // Capture the actual title's background before UI/characters are painted over it.
    r.menuBackground.draw = (...args) => { original(...args); menu = args[0].canvas.toDataURL(); };
    window.backgroundSamples = label => {
      const result = { scene: [], menu: [], unchanged: true };
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const c = canvas.getContext('2d'), camera = { x: 0, y: 0 };
      for (const time of [0, 5000]) {
        r.clock.time = time;
        r.drawBackground(camera, c); result.scene.push(canvas.toDataURL());
        r.startScene(1); r.drawTitleScreen(); result.menu.push(menu);
        result.unchanged &&= r.clock.time === time && camera.x === 0 && camera.y === 0;
        const row = document.createElement('div'); row.textContent = `${label} ${time}ms`;
        const copy = canvas.cloneNode(); copy.getContext('2d').drawImage(canvas, 0, 0); row.append(copy);
        document.getElementById('evidence').append(row);
      }
      camera.x = 96; camera.y = 12; r.drawBackground(camera, c); result.moved = canvas.toDataURL();
      return result;
    };
    window.disposeBackground = () => r.dispose();
  });
  const normal = await page.evaluate(() => backgroundSamples('normal'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => backgroundSamples('reduzido'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const restored = await page.evaluate(() => backgroundSamples('restaurado'));
  await page.locator('#evidence').screenshot({ path: process.env.BACKGROUND_CAPTURE || '/tmp/feka-background-motion.png' });
  await page.evaluate(() => disposeBackground());
  t.diagnostic(JSON.stringify({ normalStable: ['scene', 'menu'].map(k => normal[k][0] === normal[k][1]), reducedStable: ['scene', 'menu'].map(k => reduced[k][0] === reduced[k][1]) }));
  assert.deepEqual(restored, normal);
  assert.ok(normal.unchanged && reduced.unchanged && restored.unchanged);
  for (const key of ['scene', 'menu']) {
    assert.notEqual(normal[key][0], normal[key][1], key + ': normal drift exists');
    assert.ok(reduced[key][0] === reduced[key][1], key + ': reduced drift stops');
    assert.equal(reduced[key][0], normal[key][0], key + ': original composition retained');
  }
  assert.notEqual(reduced.moved, reduced.scene[0], 'camera still changes background framing');
});
