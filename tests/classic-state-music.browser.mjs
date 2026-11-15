import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Classic state music outranks an active powerup after completion', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'observe-state-music',
      transform(code, id) {
        // Real Game and rendering, with simulation advanced explicitly instead of RAF.
        if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.gameUnderTest = game;');
      }
    }] });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('state-music-sentinel', 'preserved'));
  const posts = [];
  await page.route('**/api/leaderboard', route => {
    if (route.request().method() === 'POST') posts.push(route.request().url());
    return route.fulfill({ json: { entries: [] } });
  });
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?classic=true');
  await page.waitForFunction(() => !!window.gameUnderTest);
  const result = await page.evaluate(async () => {
    const { GameState } = await import('/src/constants.ts');
    const g = gameUnderTest, manager = g.audio.musicManager, engine = g.audio.getAudioEngine(), calls = [], snapshots = [];
    // Instrument only the playback boundary; Game, Audio, policy and manager remain real.
    engine.ensureReady = () => true;
    engine.playMusic = async track => { calls.push(['play', track]); return true; };
    engine.crossfadeTo = async track => { calls.push(['crossfade', track]); return true; };
    engine.stopMusic = () => calls.push(['stop', null]);
    engine.setMusicVolume = value => calls.push(['gain', value]);
    const tick = async name => {
      g.update(0); await Promise.resolve();
      snapshots.push({ name, state: g.state, buff: g.player.data.miniFantaTimer > 0,
        desired: manager.desiredTrackId, current: manager.currentTrackId });
    };
    g.startNewGame(); g.player.collectMiniFanta(); await tick('buff');
    g.changeState(GameState.PAUSED); await tick('pause');
    g.changeState(GameState.PLAYING); await tick('resume');
    g.audio.applyLevelTrigger('boss', 'PLAY'); await tick('trigger');
    g.audio.applyLevelTrigger('', 'STOP'); await tick('trigger silence');
    g.onLevelComplete(); await tick('clear'); await tick('clear again');
    g.goToNextLevel(); await tick('next level');
    g.player.collectMiniFanta(); await tick('new buff');
    g.player.data.miniFantaTimer = 0; await tick('expiry');
    g.player.collectMiniFanta(); await tick('buff before ending');
    g.onGameComplete();
    // The open scoreboard pauses Game.update; close it without submitting so music really updates.
    document.querySelector('.scoreboard-done').click();
    await tick('ending'); await tick('ending again');
    g.startNewGame(); await tick('restart');
    g.player.collectMiniFanta(); await tick('buff before death');
    g.lives = 1; g.player.die(); g.handlePlayerDeath(); await tick('game over');
    return { snapshots, calls, sentinel: localStorage.getItem('state-music-sentinel') };
  });
  t.diagnostic(JSON.stringify(result));
  const expected = ['powerup', 'powerup', 'powerup', 'boss', null, null, null, 'game', 'powerup', 'game', 'powerup', 'ending', 'ending', 'game', 'powerup', null];
  assert.equal(result.snapshots.length, expected.length);
  for (const [i, snapshot] of result.snapshots.entries()) {
    assert.equal(snapshot.desired, expected[i], snapshot.name + ': desired music');
    assert.equal(snapshot.current, expected[i], snapshot.name + ': playback request');
  }
  for (const name of ['clear', 'ending', 'game over']) assert.equal(result.snapshots.find(s => s.name === name).buff, true);
  assert.equal(result.sentinel, 'preserved'); assert.deepEqual(posts, []); assert.deepEqual(errors, []);
});
