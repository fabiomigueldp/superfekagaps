import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('reduced motion keeps impact death still and replaces the iris with a fade, live', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage({ reducedMotion: 'no-preference' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/death-fixture', route => route.fulfill({ contentType: 'text/html', body: '<canvas id="game-canvas" hidden></canvas><div id="evidence"></div>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/death-fixture');
  await page.evaluate(async () => {
    const { Renderer } = await import('/src/engine/Renderer.ts');
    const { Player } = await import('/src/entities/Player.ts');
    const { PLAYER_SPRITES } = await import('/src/assets/playerSpriteSpec.ts');
    const r = new Renderer(), original = r.atlas.draw.bind(r.atlas), calls = [];
    r.atlas.draw = (...args) => { calls.push({ x: args[3], y: args[4], pose: Object.keys(PLAYER_SPRITES).find(key => PLAYER_SPRITES[key] === args[1]) }); original(...args); };
    const player = new Player(10, 8); player.data.isGrounded = true; player.die('hit', 140);
    const camera = { x: 0, y: 0 };
    window.sampleDeath = (label, capture) => {
      const poses = [], frames = [];
      const draw = elapsed => {
        player.data.deathTimer = player.data.deathTimerMax - elapsed;
        const before = JSON.stringify(player.data);
        r.startScene(1); const c = r.getContext(); c.fillStyle = '#b5dce3'; c.fillRect(0, 0, 320, 180);
        calls.length = 0; r.drawPlayer(player.data, camera); r.drawPlayerTransition(player.data, camera); r.present();
        poses.push({ elapsed, calls: [...calls], unchanged: before === JSON.stringify(player.data) });
        frames.push(r.getContext().canvas.toDataURL());
        if (capture) {
          const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
          canvas.style = 'display:block;width:320px;height:180px;image-rendering:pixelated'; canvas.getContext('2d').drawImage(r.getContext().canvas, 0, 0);
          const span = document.createElement('span'); span.textContent = elapsed + ' ms'; span.append(canvas); row.append(span);
        }
      };
      const row = document.createElement('div'); row.textContent = label;
      row.style = 'display:flex;gap:8px;width:1450px';
      document.getElementById('evidence').style.width = '1500px';
      document.getElementById('evidence').append(row);
      for (const elapsed of [200, 400, 650, 1100]) draw(elapsed);
      const transitions = [];
      for (const kind of ['hit', 'fall']) {
        const p = new Player(10, 8); p.die(kind);
        p.data.deathTimer = p.data.deathTimerMax - (kind === 'hit' ? 1100 : 550);
        r.startScene(1); const c = r.getContext(); c.fillStyle = '#b5dce3'; c.fillRect(0, 0, 320, 180);
        r.drawPlayerTransition(p.data, camera); r.present();
        const output = r.getContext();
        transitions.push({ kind, corner: [...output.getImageData(0, 0, 1, 1).data], center: [...output.getImageData(160, 90, 1, 1).data] });
        if (kind === 'fall') {
          calls.length = 0; r.drawPlayer(p.data, camera); transitions.at(-1).spriteCalls = calls.length;
        }
      }
      return { poses, transitions, frames };
    };
  });
  const normal = await page.evaluate(() => sampleDeath('normal', true));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => sampleDeath('reduced', true));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const restored = await page.evaluate(() => sampleDeath('restored live', false));
  await page.locator('#evidence').screenshot({ path: process.env.DEATH_CAPTURE || '/tmp/feka-death-motion.png' });
  t.diagnostic(JSON.stringify({ normal: normal.poses, reduced: reduced.poses, transitions: reduced.transitions }));
  assert.deepEqual(normal, restored, 'normal presentation is restored live on the same renderer');
  assert.ok(new Set(normal.poses.map(p => JSON.stringify(p.calls))).size > 1, 'default animation still moves');
  assert.ok(reduced.poses.every(p => p.unchanged));
  for (const pose of reduced.poses) assert.deepEqual(pose.calls, reduced.poses[0].calls, 'stable damage pose');
  for (const transition of reduced.transitions) {
    assert.deepEqual(transition.corner, transition.center, 'uniform fade, no spatial iris');
    assert.notDeepEqual(transition.corner, [181, 220, 227, 255], 'transition still communicates death');
    if (transition.kind === 'fall') assert.equal(transition.spriteCalls, 0, 'fallen player stays invisible');
  }
  assert.deepEqual(errors, []);
});
