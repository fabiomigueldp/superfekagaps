import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const fixture = `<!doctype html><html><canvas id="game-canvas"></canvas><script type="module">
import { Game } from '/src/game/Game.ts';
import { MusicManager } from '/src/engine/MusicManager.ts';
import { GameState } from '/src/constants.ts';
// Observe the music bus target without fetching or playing audio. Keep the real
// Game state transitions and MusicManager policies, including asynchronous starts.
const engine = { volume: 1, track: null, ensureReady: () => true,
  setMusicVolume(value) { this.volume = value; },
  async playMusic(id) { this.track = id; return true; },
  async crossfadeTo(id) { this.track = id; return true; },
  stopMusic() { this.track = null; }
};
const manager = new MusicManager(engine);
const game = new Game(document.querySelector('canvas'));
let respawns = 0;
game.audio = new Proxy({
  onStateChange: (...args) => manager.onStateChange(...args),
  onPlayerDeathStart: () => manager.onPlayerDeathStart(),
  onRespawn: () => { respawns++; manager.onRespawn(); },
  isEnabled: () => false
}, { get: (object, key) => object[key] ?? (() => {}) });
// Confirm menu actions directly; keyboard routing is outside this audio test.
game.input.consumeStart = () => true;
window.h = { game, manager, engine, GameState,
  sample: () => ({ state: game.state, gain: engine.volume, track: engine.track, respawns }),
  start() { game.changeState(GameState.MENU); game.updateMenu(); return this.sample(); },
  die() { game.playerDie(); return this.sample(); },
  finishDeath() { game.handlePlayerDeath(); return this.sample(); },
  menu() { game.updateGameOver(3000); return this.sample(); },
  restart() { game.updateMenu(); return this.sample(); },
  pause() { game.changeState(GameState.PAUSED); return this.sample(); },
  resume() { game.changeState(GameState.PLAYING); return this.sample(); }
};
</script></html>`;

test('Classic restores music after last-life Game Over without losing death or pause attenuation', async t => {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
        configFile: false, appType: 'custom', server: { host: '127.0.0.1', port: 0 },
        plugins: [{ name: 'classic-music-game-over', configureServer(vite) {
            vite.middlewares.use('/music-fixture', (_req, res) => {
                res.setHeader('Content-Type', 'text/html'); res.end(fixture);
            });
        } }] });
    t.after(() => server.close()); await server.listen();
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/music-fixture');
    await page.waitForFunction(() => !!window.h);
    assert.equal((await page.evaluate(() => h.start())).gain, 1);
    await page.evaluate(() => { h.game.lives = 1; });
    assert.equal((await page.evaluate(() => h.die())).gain, .1, 'death remains attenuated');
    assert.deepEqual(await page.evaluate(() => h.finishDeath()), { state: 'GAME_OVER', gain: .1, track: null, respawns: 0 });
    const menu = await page.evaluate(() => h.menu());
    const restarted = await page.evaluate(() => h.restart());
    t.diagnostic(JSON.stringify({ menu, restarted }));
    assert.deepEqual(menu, { state: 'MENU', gain: 1, track: 'theme', respawns: 0 });
    assert.deepEqual(restarted, { state: 'PLAYING', gain: 1, track: 'game', respawns: 0 });
    assert.equal((await page.evaluate(() => h.pause())).gain, .2);
    assert.equal((await page.evaluate(() => { h.manager.onRespawn(); return h.sample(); })).gain, .2, 'respawn cannot override pause gain');
    assert.equal((await page.evaluate(() => h.resume())).gain, 1);
    assert.equal((await page.evaluate(() => h.die())).gain, .1);
    const respawned = await page.evaluate(() => h.finishDeath());
    assert.equal(respawned.state, 'PLAYING'); assert.equal(respawned.gain, 1); assert.equal(respawned.respawns, 1);
    assert.deepEqual(errors, []);
});
