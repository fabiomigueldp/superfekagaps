import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic emits one jump sound per executed manual or buffered jump', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-jump-audio',
      transform(code, id) {
        // Real Game and rendering, with simulation advanced explicitly instead of RAF.
        if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.gameUnderTest = game;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('jump-audio-sentinel', 'preserved'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?classic=true');
  await page.waitForFunction(() => !!window.gameUnderTest);
  const result = await page.evaluate(async () => {
    const { ALL_LEVELS } = await import('/src/data/levels/index.ts');
    const { normalizeLevelData } = await import('/src/world/levelValidation.ts');
    const { TileType } = await import('/src/constants.ts');
    const originalLevel = ALL_LEVELS[0], g = gameUnderTest;
    ALL_LEVELS[0] = normalizeLevelData({ ...originalLevel, width: 80, height: 16,
      tiles: Array.from({ length: 16 }, (_, y) => Array(80).fill(y === 15 ? TileType.GROUND : TileType.EMPTY)),
      playerSpawn: { x: 10, y: 15 }, goalPosition: { x: 75, y: 15 },
      enemies: [], triggers: [], checkpoints: [], collectibles: [], isBossLevel: false });
    const storage = JSON.stringify({ ...localStorage }), runs = [];
    const neutral = { left: false, right: false, jump: false, run: false, down: false,
      start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
    let state = neutral, calls = 0, events = 0, frame = 0;
    const callFrames = [], eventFrames = [];
    g.input.getState = () => state;
    const playJump = g.audio.playJump.bind(g.audio);
    g.audio.playJump = () => { calls++; callFrames.push(frame); playJump(); };
    const step = (input = {}) => { state = { ...neutral, ...input }; frame++; g.updatePlaying(16); };
    try {
      for (const name of ['held', 'tap', 'buffered tap', 'airborne', 'reveal blocked', 'idle']) {
        g.startNewGame(); g.player.data.respawnRevealTimer = 0;
        step(); // Settle on the real floor before observing the scenario.
        calls = 0; events = 0; frame = 0; callFrames.length = 0; eventFrames.length = 0;
        const update = g.player.update.bind(g.player);
        g.player.update = (...args) => {
          const result = update(...args);
          if (result.jumpStarted) { events++; eventFrames.push(frame); }
          return result;
        };
        if (name === 'buffered tap') {
          g.player.data.position.y -= 2; g.player.data.velocity.y = 2;
          g.player.data.isGrounded = false; g.player.data.coyoteTimer = 0;
        } else if (name === 'airborne') {
          g.player.data.position.y = 40; g.player.data.velocity.y = 0;
          g.player.data.isGrounded = false; g.player.data.coyoteTimer = 0;
        } else if (name === 'reveal blocked') g.player.data.respawnRevealTimer = 500;
        step(name === 'idle' ? {} : { jumpPressed: true, jump: name === 'held', jumpReleased: name !== 'held' });
        const firstFrameEvents = events;
        const remaining = name === 'held' ? 100 : 4;
        for (let i = 0; i < remaining; i++) step({ jump: name === 'held' });
        runs.push({ name, events, calls, firstFrameEvents, eventFrames: [...eventFrames], callFrames: [...callFrames] });
      }
    } finally { ALL_LEVELS[0] = originalLevel; }
    return { runs, storageUnchanged: storage === JSON.stringify({ ...localStorage }) };
  });
  t.diagnostic(JSON.stringify(result));
  for (const [index, run] of result.runs.entries()) {
    const expected = index < 3 ? 1 : 0;
    assert.equal(run.events, expected, `${run.name}: actual Player jump events`);
    assert.equal(run.calls, expected, `${run.name}: one sound per jump`);
    assert.deepEqual(run.callFrames, run.eventFrames, 'audio occurs exactly on the launch frame');
    if (run.name === 'buffered tap') assert.equal(run.firstFrameEvents, 0, 'buffer waits for landing');
  }
  assert.equal(result.storageUnchanged, true); assert.deepEqual(errors, []);
});
