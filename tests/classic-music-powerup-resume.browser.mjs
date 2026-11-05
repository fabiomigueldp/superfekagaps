import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const fixture = `<!doctype html><html><canvas id="game-canvas"></canvas><script type="module">
import { Game } from '/src/game/Game.ts';
import { MusicManager } from '/src/engine/MusicManager.ts';
import { GameState } from '/src/constants.ts';
import { ALL_LEVELS } from '/src/data/levels/index.ts';
const source = JSON.stringify(ALL_LEVELS);
const game = new Game(document.querySelector('canvas'));
const storage = () => JSON.stringify({...localStorage});
window.h = { async run(boss, paused, trigger) {
  // Keep production Game, Audio and Player updates; observe requested tracks
  // without fetching audio or using an output device.
  const engine = { track: null, gain: 1, ensureReady: () => true,
    setMusicVolume(value) { this.gain = value; }, stopMusic() { this.track = null; },
    async playMusic(id) { this.track = id; return true; },
    async crossfadeTo(id) { this.track = id; return true; } };
  const manager = new MusicManager(engine); game.audio.musicManager = manager;
  game.startNewGame();
  if (boss) { game.loadLevel(ALL_LEVELS.findIndex(level => level.isBossLevel)); game.updateBossIntro(2000); }
  await Promise.resolve();
  const originalStorage = storage();
  const tick = async ms => { game.update(ms); await Promise.resolve(); };
  if (trigger) manager.applyLevelTrigger('theme', trigger);
  game.player.collectMiniFanta(); await tick(16);
  const during = engine.track;
  const remaining = game.player.data.miniFantaTimer;
  let pauseGain = null, frozen = true;
  if (paused) {
    game.changeState(GameState.PAUSED); await tick(100);
    pauseGain = engine.gain; frozen = game.player.data.miniFantaTimer === remaining;
    game.changeState(GameState.PLAYING); await tick(16);
  }
  const resumed = engine.track;
  // Shorten only the fixture's remaining duration; expiration still occurs in Player.update.
  game.player.data.miniFantaTimer = 16; await tick(16);
  return { boss, paused, trigger, during, resumed, expired: engine.track,
    timer: game.player.data.miniFantaTimer, state: game.state, pauseGain, frozen, gain: engine.gain,
    savesPreserved: storage() === originalStorage, sourcePreserved: JSON.stringify(ALL_LEVELS) === source };
} };
</script></html>`;

test('Classic powerup expiration restores normal/boss music after pause and preserves trigger priority', async t => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
        appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'classic-powerup-resume', configureServer(vite) {
            vite.middlewares.use('/powerup-fixture', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(fixture); });
        } }] });
    t.after(() => server.close()); await server.listen();
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        window.AudioContext = undefined; window.webkitAudioContext = undefined;
        localStorage.setItem('classic-powerup-save-sentinel', 'preserved');
    });
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/powerup-fixture');
    await page.waitForFunction(() => !!window.h);
    const observations = [];
    for (const boss of [false, true]) for (const paused of [false, true]) for (const trigger of [null, 'PLAY', 'STOP'])
        observations.push(await page.evaluate(args => h.run(...args), [boss, paused, trigger]));
    t.diagnostic(JSON.stringify(observations));
    for (const result of observations) {
        const expected = result.trigger === 'STOP' ? null : result.trigger === 'PLAY' ? 'theme' : result.boss ? 'boss' : 'game';
        const powered = result.trigger ? expected : 'powerup';
        assert.equal(result.during, powered); assert.equal(result.resumed, powered);
        assert.equal(result.expired, expected, JSON.stringify(result));
        assert.equal(result.timer, 0); assert.equal(result.state, 'PLAYING');
        assert.equal(result.pauseGain, result.paused ? .2 : null);
        assert.equal(result.gain, 1); assert.equal(result.frozen, true);
        assert.equal(result.savesPreserved, true); assert.equal(result.sourcePreserved, true);
    }
    assert.deepEqual(errors, []);
});
