/** Focus/visibility regression checks with production Game, Input and simulation.
 * npm ci
 * npm install --no-save --package-lock=false playwright@1.58.2
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/classic-interruption-pause.browser.mjs
 * Alternatively install Playwright's Chromium with `npx playwright install chromium`.
 * Browser events, RAF and the clock are controlled; audio output is replaced.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser, server, base;
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}canvas{width:640px;height:360px}</style>
<canvas id="game-canvas" tabindex="0" contenteditable="true"></canvas>
<script type="module">
import '/src/game/scoreboard.css';
import { Game } from '/src/game/Game.ts';
import { Player } from '/src/entities/Player.ts';
import { Minion } from '/src/entities/enemies/Minion.ts';
import { Level } from '/src/world/Level.ts';
import { GameState, TileType } from '/src/constants.ts';
let now = 1000, hidden = false, frameId = 0;
const frames = new Map();
Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
window.cancelAnimationFrame = id => frames.delete(id);
const canvas = document.querySelector('canvas');
const game = new Game(canvas);
const transitions = [];
let pauseSounds = 0;
game.audio = new Proxy({
  onStateChange: (from, to) => transitions.push([from, to]),
  playPause: () => { pauseSounds++; }, isEnabled: () => false
}, { get: (object, key) => object[key] ?? (() => {}) });
const tiles = Array.from({ length: 20 }, (_, row) => Array(80).fill(row >= 16 ? TileType.GROUND : TileType.EMPTY));
game.level = new Level({ id: 'focus-test', name: 'Focus test', width: 80, height: 20, tiles,
  playerSpawn: { x: 5, y: 10 }, enemies: [], collectibles: [], triggers: [], checkpoints: [],
  goalPosition: { x: 70, y: 14 }, timeLimit: 180, isBossLevel: false });
game.player = new Player(5, 10);
game.minions = [new Minion(18, 14)];
game.levelTime = 180;
game.camera.bounds = game.level.getBounds();
game.camera.zoom = 1;
game.state = GameState.PLAYING;
// Drawing is irrelevant to interruption state; the production visual clock and
// interpolation still run through gameLoop and update.
game.render = () => {};
game.start();
window.h = {
  game, states: Object.values(GameState), transitions,
  snapshot: () => structuredClone({ player: game.player.data, enemies: game.minions.map(enemy => enemy.data),
    levelTime: game.levelTime, totalRunTime: game.totalRunTime, camera: game.camera, clock: game.renderer.clock.time }),
  state: () => ({ state: game.state, lastTime: game.lastTime, now, accumulator: game.accumulator,
    hidden, pauseSounds, scheduledFrames: frames.size, input: game.input.getState() }),
  elapse: ms => { now += ms; },
  frame: ms => { now += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now)); },
  event: type => {
    if (type === 'hidden' || type === 'visible') {
      hidden = type === 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
    } else window.dispatchEvent(new Event(type));
  }
};
canvas.focus();
</script></html>`;

before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    appType: 'custom', server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'classic-interruption-fixture', configureServer(vite) {
      vite.middlewares.use('/interruption-fixture', (_request, response) => {
        response.setHeader('Content-Type', 'text/html'); response.end(fixture);
      });
    } }] });
  await server.listen();
  base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, hasTouch: true });
  const page = await context.newPage(), errors = [], requests = [];
  page.setDefaultTimeout(3000);
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => {
    try {
      assert.deepEqual(errors, [], 'no browser exception');
      assert.ok(requests.every(url => new URL(url).origin === base), 'no external service is contacted');
      assert.equal(await page.evaluate(() => localStorage.getItem('classic-save-fixture')), 'unchanged');
    } finally { await context.close(); }
  });
  await page.route('**/*', route => {
    requests.push(route.request().url());
    return new URL(route.request().url()).origin === base ? route.continue() : route.abort();
  });
  await page.route('**/api/leaderboard', route => route.fulfill({ json: { entries: [] } }));
  await page.goto(base + '/interruption-fixture');
  await page.waitForFunction(() => !!window.h);
  await page.evaluate(() => localStorage.setItem('classic-save-fixture', 'unchanged'));
  return page;
}

for (const interruption of ['blur', 'hidden']) {
  test(`${interruption} pauses active Classic play, clears commands and freezes simulation`, async t => {
    const page = await setup(t);
    const result = await page.evaluate(interruption => {
      h.frame(100); // prove that the real simulation was already advancing
      const before = h.snapshot();
      const source = h.game.input.createActionSource();
      source.press('right'); source.press('jump');
      for (const code of ['Enter', 'Escape', 'KeyM', 'ArrowDown']) {
        document.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      }
      h.game.accumulator = 12;
      h.event(interruption);
      const interrupted = h.state();
      h.frame(200);
      return { before, interrupted, after: h.snapshot(), state: h.state(), transitions: h.transitions };
    }, interruption);
    assert.ok(result.before.totalRunTime > 0);
    assert.equal(result.interrupted.state, 'PAUSED');
    assert.equal(result.interrupted.accumulator, 0);
    assert.equal(result.interrupted.lastTime, result.interrupted.now);
    assert.ok(Object.values(result.interrupted.input).every(value => value === false));
    assert.deepEqual(result.after, result.before, 'player, enemies, timers and visual clock remain frozen');
    assert.equal(result.state.state, 'PAUSED');
    assert.equal(result.state.scheduledFrames, 1, 'interruption cannot create extra animation loops');
    assert.deepEqual(result.transitions, [['PLAYING', 'PAUSED']]);
  });
}

test('repeated interruptions and return discard elapsed time and never resume automatically', async t => {
  const page = await setup(t);
  const result = await page.evaluate(() => {
    h.frame(100);
    const before = h.snapshot(), returns = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      for (const event of ['blur', 'hidden', 'blur', 'hidden']) h.event(event);
      h.elapse(60000); // a hidden tab can receive no RAF callbacks at all
      // Commands queued while away cannot cause an implicit restart on return.
      document.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
      h.event('visible'); h.event('focus');
      returns.push(h.state());
      h.frame(1);
      h.frame(100);
    }
    return { before, after: h.snapshot(), returns, state: h.state(), transitions: h.transitions };
  });
  assert.deepEqual(result.after, result.before);
  assert.deepEqual(result.transitions, [['PLAYING', 'PAUSED']]);
  for (const state of result.returns) {
    assert.equal(state.state, 'PAUSED');
    assert.equal(state.accumulator, 0);
    assert.equal(state.lastTime, state.now);
    assert.ok(Object.values(state.input).every(value => value === false));
  }
  assert.equal(result.state.pauseSounds, 0, 'duplicate events do not replay pause actions');
  assert.equal(result.state.scheduledFrames, 1);
});

for (const control of ['Escape', 'Enter', 'touch']) {
  test(`the existing ${control} control resumes explicitly without a catch-up burst`, async t => {
    const page = await setup(t);
    await page.evaluate(() => {
      h.frame(100); h.event('hidden'); h.elapse(60000); h.event('visible'); h.event('focus');
      // One paused tick enables the existing touch menu controls.
      h.frame(17);
    });
    const before = await page.evaluate(() => h.snapshot());
    if (control === 'touch') await page.touchscreen.tap(120, 120);
    else await page.keyboard.press(control);
    const result = await page.evaluate(() => {
      h.frame(17);
      const resumed = { snapshot: h.snapshot(), state: h.state() };
      h.frame(17);
      return { resumed, next: h.snapshot(), transitions: h.transitions };
    });
    assert.equal(result.resumed.state.state, 'PLAYING');
    assert.deepEqual(result.resumed.snapshot, before, 'the resume tick cannot replay time spent away');
    assert.ok(result.next.totalRunTime > before.totalRunTime);
    assert.ok(result.next.totalRunTime - before.totalRunTime < .018, 'only one normal simulation tick follows');
    assert.deepEqual(result.transitions, [['PLAYING', 'PAUSED'], ['PAUSED', 'PLAYING']]);
  });
}

test('manual pause remains paused across interruptions until the existing resume command', async t => {
  const page = await setup(t);
  await page.keyboard.press('Escape');
  await page.evaluate(() => h.frame(17));
  const result = await page.evaluate(() => {
    const before = h.snapshot();
    for (const event of ['blur', 'hidden', 'visible', 'focus', 'blur', 'focus']) h.event(event);
    h.frame(200);
    return { before, after: h.snapshot(), state: h.state(), transitions: h.transitions };
  });
  assert.equal(result.state.state, 'PAUSED');
  assert.deepEqual(result.before, result.after);
  assert.equal(result.state.pauseSounds, 1);
  assert.deepEqual(result.transitions, [['PLAYING', 'PAUSED']]);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => { h.frame(17); return h.game.state; }), 'PLAYING');
});

test('interruptions preserve all non-playing states, including editor and the open scoreboard', async t => {
  const page = await setup(t);
  const states = await page.evaluate(() => h.states.filter(state => state !== 'PLAYING'));
  for (const state of states) {
    const result = await page.evaluate(state => {
      h.game.state = state;
      const before = h.snapshot();
      for (const event of ['blur', 'hidden', 'visible', 'focus']) h.event(event);
      return { state: h.game.state, before, after: h.snapshot(), transitions: h.transitions };
    }, state);
    assert.equal(result.state, state);
    assert.deepEqual(result.after, result.before);
    assert.deepEqual(result.transitions, []);
  }
  await page.evaluate(() => { h.game.state = 'ENDING'; h.game.globalScoreboard.showEnding(4200, 100000, true); });
  await page.locator('#scoreboard-name').fill('Feka');
  const ending = await page.evaluate(() => {
    for (const event of ['blur', 'hidden', 'visible', 'focus']) h.event(event);
    return { state: h.game.state, open: h.game.globalScoreboard.isOpen,
      focused: document.activeElement.id, name: document.querySelector('#scoreboard-name').value };
  });
  assert.deepEqual(ending, { state: 'ENDING', open: true, focused: 'scoreboard-name', name: 'Feka' });
});
