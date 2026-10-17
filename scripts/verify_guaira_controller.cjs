// Real browser DOM, chapter host, Input and rendering. Only the Gamepad API
// device boundary is simulated. Actor positions, collisions and timers stay native.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.FEKA_UI_URL || 'http://localhost:3000';
const out = path.resolve(process.env.GUAIRA_OUTPUT || 'output/guaira/controller-readiness-2026-10-16/surface-browser');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const report = { physicalDevice: false, mountsForSurfaceInspection: true, actorOrHazardEdits: false, checks: [], errors: [] };
  try {
    for (const [name, viewport, reduced] of [
      ['desktop', { width: 1440, height: 900 }, false],
      ['landscape', { width: 844, height: 390 }, true],
      ['portrait', { width: 390, height: 844 }, true],
    ]) {
      const context = await browser.newContext({ viewport, hasTouch: reduced, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
      await page.addInitScript(() => {
        window.__controller = { index: 0, id: 'Guaíra browser controller', connected: true, mapping: 'standard', axes: [0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
        window.__polls = 0;
        Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => { window.__polls++; return window.__controller.connected ? [window.__controller] : []; } });
      });
      await page.goto(base + '/?chapter=guaira', { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForFunction(() => window.worldGame?.mapView);
      await page.evaluate(async () => window.worldGame.mountChapter('guaira', 'guaira-travessia'));
      await page.waitForSelector('[data-state="playing"]'); await page.locator('#game-canvas').focus();
      await page.evaluate(() => {
        const g = window.worldGame; g.cancelFrame(); g.running = false; g.load(g.stage.id);
        window.__oldGame = g;
        window.__nativeSnapshot = () => JSON.stringify({ player: g.player.data, objects: g.objects, camera: g.camera, time: g.time, coins: g.coins });
      });
      async function step(buttons, frames = 1) {
        return page.evaluate(({ buttons, frames }) => {
          const p = window.__controller; p.buttons.forEach((b, i) => { b.pressed = buttons.includes(i); b.value = b.pressed ? 1 : 0; });
          const g = window.worldGame; for (let i = 0; i < frames; i++) g.update(1000 / 60);
          if (!g.isDisposed) g.render();
          return { state: g.state, x: g.player.data.position.x, jump: g.input.getState().jump, right: g.input.getState().right, focused: document.activeElement?.id };
        }, { buttons, frames });
      }
      async function press(...buttons) { await step([]); return step(buttons); }
      await step([]); const moved = await step([15, 2], 18); assert.ok(moved.x > 80);
      assert.equal((await press(9)).state, 'paused');
      await page.waitForSelector('[data-state="paused"]');
      const pause = await page.evaluate(() => {
        const g = window.worldGame, canvas = document.querySelector('#game-canvas'); g.render();
        const before = window.__nativeSnapshot(), pixels = canvas.toDataURL();
        for (let i = 0; i < 90; i++) { g.update(1000 / 60); g.render(); }
        const r = canvas.getBoundingClientRect();
        return { stateFrozen: before === window.__nativeSnapshot(), pixelsFrozen: pixels === canvas.toDataURL(),
          fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
      });
      assert.ok(pause.stateFrozen && pause.pixelsFrozen && pause.fits);
      await page.screenshot({ path: path.join(out, name + '-pause.png') });
      assert.equal((await press(13)).focused, 'chapter-options'); await press(0);
      await page.waitForSelector('#chapter-pause-options:not([hidden])');
      await press(13); await press(0); await page.waitForSelector('#chapter-controls-help[open]');
      await step([0], 40); assert.equal(await page.locator('#chapter-controls-help').evaluate(el => el.open), true);
      await page.screenshot({ path: path.join(out, name + '-help.png') });
      const scrollBefore = await page.locator('#chapter-controls-help .world-controls-content').evaluate(el => ({ top: el.scrollTop, overflow: el.scrollHeight - el.clientHeight }));
      for (let i = 0; i < 3; i++) await press(13);
      const scrollAfter = await page.locator('#chapter-controls-help .world-controls-content').evaluate(el => el.scrollTop);
      if (scrollBefore.overflow > 0) assert.ok(scrollAfter > scrollBefore.top, 'controller scrolls the native help content');
      await press(1); await page.waitForSelector('#chapter-controls-help:not([open])', { state: 'attached' });
      await step([1], 20); assert.equal(await page.locator('#chapter-pause-options').evaluate(el => el.hidden), false);
      await press(1); assert.equal(await page.locator('#chapter-pause-options').evaluate(el => el.hidden), true);
      assert.equal((await press(9)).state, 'playing'); assert.equal((await step([9], 20)).state, 'playing');
      await press(15); await page.evaluate(() => { window.__controller.connected = false; });
      assert.equal((await step([15])).right, false);
      await page.evaluate(() => { window.__controller.connected = true; });
      assert.equal((await step([15], 20)).right, false, 'reconnect needs released controls');
      await page.keyboard.down('ArrowLeft'); const keyboard = await page.evaluate(() => { window.worldGame.update(1000 / 60); return window.worldGame.input.getState().left; });
      await page.keyboard.up('ArrowLeft'); assert.equal(keyboard, true);
      await page.evaluate(() => window.dispatchEvent(new Event('blur'))); assert.equal((await step([9])).state, 'paused');
      await page.evaluate(() => window.dispatchEvent(new Event('focus'))); assert.equal((await step([9], 20)).state, 'paused');
      await press(9); assert.equal((await step([9])).state, 'playing');
      await press(9); await press(13); await press(0); // pause > options
      await press(13); await press(13); assert.equal(await page.evaluate(() => document.activeElement.id), 'chapter-retry');
      await press(0); await page.waitForFunction(() => window.worldGame !== window.__oldGame && window.worldGame?.stage?.id === 'guaira-travessia');
      const retry = await page.evaluate(() => {
        const current = window.worldGame, old = window.__oldGame, polls = window.__polls;
        for (let i = 0; i < 10; i++) old.update(1000 / 60);
        return { oldDisposed: old.isDisposed, retiredPolls: window.__polls - polls, noInheritedJump: !current.input.getState().jump,
          checkpoint: current.store.save.checkpoint, completed: current.finished, x: current.player.data.position.x };
      });
      assert.ok(retry.oldDisposed && retry.noInheritedJump); assert.equal(retry.retiredPolls, 0); assert.equal(retry.completed, false); assert.equal(retry.checkpoint, null);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      report.checks.push({ name, viewport, reduced, pause, helpScrolled: scrollAfter > scrollBefore.top, keyboardAlongsideController: keyboard, retry });
      console.log(name + ': pause, options, help, reconnect, focus and retry passed'); await context.close();
    }
    assert.deepEqual(report.errors, []); report.passed = true;
  } finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
  console.log(JSON.stringify({ passed: report.passed, surfaces: report.checks.length, errors: report.errors }));
})().catch(error => { console.error(error); process.exitCode = 1; });
