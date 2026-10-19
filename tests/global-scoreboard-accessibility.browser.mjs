/** Real keyboard/modal regression checks; no production API or save is touched.
 * npm ci
 * npm install --no-save --package-lock=false playwright@1.58.2
 * CHROMIUM_PATH=/usr/bin/chromium node --test tests/global-scoreboard-accessibility.browser.mjs
 * Without CHROMIUM_PATH, install Playwright's Chromium with `npx playwright install chromium`.
 * Separate from the Node-only suite because native dialog focus needs a real browser.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser, server, base;
const saves = { super_feka_gaps_highscore: '4200', super_feka_gaps_best_time: '100', unrelated_save: '{"checkpoint":7}' };
const entries = [{ rank: 1, name: 'Feka', score: 4200, durationMs: 100000 }];
const fixture = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#191f35}canvas{width:200px;height:100px}</style>
<button id="outside">Fora do placar</button><canvas id="game-canvas" tabindex="0" contenteditable="true" aria-label="Área do jogo"></canvas>
<script type="module">
import '/src/game/scoreboard.css';
import { GlobalScoreboard } from '/src/game/GlobalScoreboard.ts';
import { Input } from '/src/engine/Input.ts';
window.board = new GlobalScoreboard();
window.input = new Input(document.querySelector('canvas'));
</script></html>`;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, appType: 'custom',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'scoreboard-fixture', configureServer(vite) {
      vite.middlewares.use('/scoreboard-fixture', (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(fixture);
      });
    } }]
  });
  await server.listen();
  base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(t, { viewport, getStatus = 200, ranking = entries } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  const errors = [], posts = [];
  page.on('pageerror', error => errors.push(error.message));
  let postHandler = route => route.fulfill({ json: { entries: ranking, saved: true } });
  await page.route('**/*', route => {
    assert.equal(new URL(route.request().url()).origin, base, 'fixture stays on loopback');
    return route.continue();
  });
  await page.route('**/api/leaderboard', route => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON());
      return postHandler(route);
    }
    return route.fulfill({ status: getStatus, json: { entries: ranking } });
  });
  await page.goto(base + '/scoreboard-fixture');
  await page.waitForFunction(() => window.board && window.input);
  await page.evaluate(sentinel => { for (const [key, value] of Object.entries(sentinel)) localStorage.setItem(key, value); }, saves);
  t.after(async () => {
    try {
      assert.deepEqual(errors, [], 'no browser exceptions');
      assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(saves)), saves);
    } finally { await context.close(); }
  });
  await page.locator('#game-canvas').focus();
  return { page, posts, setPostHandler: handler => { postHandler = handler; } };
}

async function show(page, canSubmit = true) {
  const response = page.waitForResponse('**/api/leaderboard');
  await page.evaluate(canSubmit => window.board.showEnding(4200, 100000, canSubmit), canSubmit);
  await response;
  await page.waitForFunction(() => document.querySelector('.scoreboard-status').textContent !== 'Carregando placar…');
}
async function focused(page, selector) {
  await page.waitForFunction(selector => document.activeElement === document.querySelector(selector), selector);
}
async function closed(page, selector) {
  await page.waitForFunction(() => !window.board.isOpen && !document.querySelector('dialog[open]'));
  await focused(page, selector);
}
async function keyboardStaysInModal(page) {
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let n = 0; n < 7; n++) {
      await page.keyboard.press(key);
      // Native modal navigation may visit browser chrome (activeElement=body),
      // but must never reach an inert page control or a hidden/disabled form field.
      assert.equal(await page.evaluate(() => {
        const active = document.activeElement;
        return active === document.body || (!!active.closest('dialog[open]') && !active.closest('[hidden], :disabled'));
      }), true);
    }
  }
  await page.locator('.scoreboard-close').focus();
  await page.evaluate(() => document.querySelector('#outside').focus());
  await focused(page, '.scoreboard-close');
}
async function idleInput(page) {
  assert.equal(await page.evaluate(() => {
    input.update();
    return Object.values(input.getState()).every(value => value === false);
  }), true, 'dialog keys do not become gameplay actions');
}

test('automatic opening, native modality, Escape and repeated keyboard reopening return focus', async t => {
  const { page, posts } = await setup(t);
  await show(page);
  await focused(page, '#scoreboard-name');
  assert.equal(await page.getByRole('dialog', { name: 'HALL DOS HERÓIS' }).count(), 1);
  assert.equal(await page.evaluate(() => document.querySelector('dialog').matches(':modal')), true);
  await keyboardStaysInModal(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('m');
  await page.keyboard.press('Escape');
  await closed(page, '#game-canvas');
  await idleInput(page);
  for (const closeWith of ['Escape', '.scoreboard-close', '.scoreboard-done']) {
    await page.locator('.scoreboard-tab').focus();
    await page.keyboard.press('Enter');
    await focused(page, '#scoreboard-name');
    if (closeWith === 'Escape') await page.keyboard.press('Escape');
    else { await page.locator(closeWith).focus(); await page.keyboard.press('Space'); }
    await closed(page, '.scoreboard-tab');
    await idleInput(page);
  }
  assert.equal(posts.length, 0, 'opening never publishes automatically');
  await page.evaluate(() => board.hide());
  await show(page, false);
  await focused(page, '.scoreboard-done');
  await keyboardStaysInModal(page);
  await page.locator('.scoreboard-done').focus();
  await page.keyboard.press('Enter');
  await closed(page, '#game-canvas');
});

test('repeated publishing via Enter and button activation has safe focus, stable identity and no duplicate POST', async t => {
  const { page, posts, setPostHandler } = await setup(t);
  for (const [index, saved] of [true, false, true].entries()) {
    setPostHandler(route => route.fulfill({ json: { entries, saved } }));
    await show(page);
    await focused(page, '#scoreboard-name');
    await page.locator('#scoreboard-name').fill('Feka');
    if (index === 0) await page.keyboard.press('Enter');
    else { await page.locator('button[type=submit]').focus(); await page.keyboard.press('Enter'); }
    await page.waitForFunction(() => document.querySelector('.scoreboard-form').hidden);
    await focused(page, '.scoreboard-done');
    assert.match(await page.locator('.scoreboard-status').textContent(), saved ? /Recorde publicado/ : /igual ou maior/);
    assert.equal(posts.length, index + 1);
    assert.deepEqual(posts[index], { playerId: posts[0].playerId, name: 'Feka', score: 4200, durationMs: 100000 });
    assert.match(posts[0].playerId, /^[\da-f-]{36}$/);
    assert.equal(await page.evaluate(() => localStorage.getItem('super_feka_gaps_player_name')), 'Feka');
    await keyboardStaysInModal(page);
    await page.keyboard.press('Escape');
    await closed(page, '#game-canvas');
    await page.locator('.scoreboard-tab').click();
    await focused(page, '.scoreboard-done');
    await page.evaluate(() => document.querySelector('form').requestSubmit());
    await page.locator('.scoreboard-done').click();
    await closed(page, '.scoreboard-tab');
    assert.equal(posts.length, index + 1);
    await page.evaluate(() => board.hide());
  }
});

test('offline ranking and a failed POST preserve the form, local records and a working retry', async t => {
  const { page, posts, setPostHandler } = await setup(t, { getStatus: 503 });
  await show(page);
  await focused(page, '#scoreboard-name');
  assert.match(await page.locator('.scoreboard-status').textContent(), /recorde local continua salvo/);
  await page.locator('#scoreboard-name').fill('F');
  await page.keyboard.press('Enter');
  assert.equal(posts.length, 0, 'native name validation still applies');
  setPostHandler(route => route.fulfill({ status: 503, json: { error: 'Tente novamente.' } }));
  await page.locator('#scoreboard-name').fill('Feka');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.scoreboard-status').textContent === 'Tente novamente.');
  await focused(page, '#scoreboard-name');
  assert.equal(await page.locator('button[type=submit]').isEnabled(), true);
  assert.equal(await page.locator('.scoreboard-form').isVisible(), true);
  setPostHandler(route => route.fulfill({ json: { entries, saved: true } }));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.scoreboard-form').hidden);
  await focused(page, '.scoreboard-done');
  assert.equal(posts.length, 2);
});

for (const action of ['close', 'hide', 'reopen', 'move-focus']) {
  test(`a delayed publication after ${action} only redirects focus when the form still owns it`, async t => {
    const { page, posts, setPostHandler } = await setup(t);
    let receive;
    const pending = new Promise(resolve => { receive = resolve; });
    setPostHandler(route => { receive(route); });
    await show(page);
    await page.locator('#scoreboard-name').fill('Feka');
    if (action === 'close') await page.locator('button[type=submit]').focus();
    await page.keyboard.press('Enter');
    const route = await pending;
    await focused(page, '#scoreboard-name');
    if (action === 'hide') await page.evaluate(() => { document.activeElement.blur(); board.hide(); });
    else if (action === 'move-focus') await page.locator('.scoreboard-close').focus();
    else {
      await page.keyboard.press('Escape');
      await closed(page, '#game-canvas');
      if (action === 'reopen') await page.locator('.scoreboard-tab').click();
    }
    await route.fulfill({ json: { entries, saved: true } });
    await page.waitForFunction(() => document.querySelector('.scoreboard-form').hidden);
    await focused(page, action === 'reopen' ? '.scoreboard-done' : action === 'move-focus' ? '.scoreboard-close' : '#game-canvas');
    assert.equal(posts.length, 1);
    if (action === 'close' || action === 'hide') {
      assert.equal(await page.evaluate(() => !!document.querySelector(':modal')), false);
      await page.locator('#outside').focus();
      await focused(page, '#outside');
    }
  });
}

test('hide and immediate reopen do not leave inert content or stale close callbacks; missing opener falls back to canvas', async t => {
  const { page } = await setup(t);
  await show(page);
  await page.evaluate(() => { board.hide(); board.showEnding(4200, 100000, false); });
  await focused(page, '.scoreboard-done');
  await page.waitForTimeout(50); // let the previous native close event be dispatched
  await focused(page, '.scoreboard-done');
  await page.locator('.scoreboard-done').click();
  await closed(page, '#game-canvas');
  await page.locator('.scoreboard-tab').click();
  await page.evaluate(() => document.querySelector('.scoreboard-tab').remove());
  await page.keyboard.press('Escape');
  await closed(page, '#game-canvas');
  await page.locator('#outside').focus();
  await page.evaluate(() => { board.hide(); board.hide(); });
  await focused(page, '#outside');
  await show(page, false);
  await page.evaluate(() => document.querySelector('dialog').close());
  await closed(page, '#outside');
});

for (const viewport of [{ width: 360, height: 640 }, { width: 640, height: 360 }]) {
  test(`long ranking stays scrollable and initial focus visible at ${viewport.width}×${viewport.height}`, async t => {
    const ranking = Array.from({ length: 10 }, (_, index) => ({ ...entries[0], rank: index + 1, name: 'Jogador de teste' }));
    const { page } = await setup(t, { viewport, ranking });
    for (const canSubmit of [true, false]) {
      await show(page, canSubmit);
      await focused(page, canSubmit ? '#scoreboard-name' : '.scoreboard-done');
      assert.equal(await page.evaluate(() => {
        const panel = document.querySelector('dialog').getBoundingClientRect();
        const focus = document.activeElement.getBoundingClientRect();
        return panel.left >= 0 && panel.right <= innerWidth && panel.top >= 0 && panel.bottom <= innerHeight &&
          focus.top >= panel.top && focus.bottom <= panel.bottom;
      }), true, 'panel and focused control fit inside the viewport');
      await page.keyboard.press('Escape');
      await closed(page, '#game-canvas');
    }
  });
}
