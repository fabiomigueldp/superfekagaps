import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const fixture = `<!doctype html><html><link rel="stylesheet" href="/src/game/scoreboard.css">
<canvas id="game-canvas" tabindex="0"></canvas><script type="module">
import { GlobalScoreboard } from '/src/game/GlobalScoreboard.ts';
window.board = new GlobalScoreboard();
</script></html>`;
const entry = name => ({ rank: 1, name, score: 5000, durationMs: 60000 });
const playerId = 'e742b666-3451-40d7-9ae6-cedba14f7368';

test('confirmed scoreboard results survive name preference failures while HTTP retry and response ownership remain intact', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    appType: 'custom', server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'scoreboard-storage', configureServer(vite) {
      vite.middlewares.use('/scoreboard-fixture', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(fixture); });
    } }] });
  t.after(() => server.close()); await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const posts = [], plans = [], held = [];
  let holdReady; const heldReady = new Promise(resolve => { holdReady = resolve; });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    assert.equal(url.origin, base, 'no external requests');
    if (url.pathname !== '/api/leaderboard') return route.continue();
    if (request.method() === 'GET') return route.fulfill({ json: { entries: [entry('Existing')] } });
    assert.equal(request.method(), 'POST'); posts.push(request.postDataJSON());
    const plan = plans.shift(); assert.ok(plan, 'every POST must be explicitly expected');
    if (plan.hold) { held.push(route); holdReady(); return; }
    return route.fulfill({ status: plan.status ?? 200, json: plan.body });
  });
  await page.addInitScript(id => {
    localStorage.setItem('super_feka_gaps_player_id', id);
    localStorage.setItem('unrelated-save', 'preserved');
    const original = Storage.prototype.setItem;
    window.nameWrites = 0; window.failName = false;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'super_feka_gaps_player_name') {
        window.nameWrites++;
        if (window.failName) throw new DOMException('Name storage blocked', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  }, playerId);
  await page.goto(base + '/scoreboard-fixture'); await page.waitForFunction(() => !!window.board);
  const input = page.getByRole('textbox', { name: 'Seu nome no placar' });
  const submit = page.getByRole('button', { name: 'PUBLICAR', exact: true });
  const status = page.locator('.scoreboard-status');
  const snapshot = () => page.evaluate(() => ({ status: document.querySelector('.scoreboard-status').textContent,
    hidden: document.querySelector('.scoreboard-form').hidden, disabled: document.querySelector('button[type="submit"]').disabled,
    doneFocused: document.activeElement === document.querySelector('.scoreboard-done'),
    list: document.querySelector('.scoreboard-entries').textContent,
    name: localStorage.getItem('super_feka_gaps_player_name'), writes: window.nameWrites }));
  async function show(failName) {
    await page.evaluate(fail => { window.failName = fail; board.showEnding(5000, 60000, true); }, failName);
    await page.waitForFunction(() => document.querySelector('.scoreboard-status').textContent === '');
  }
  const results = [];
  for (const [fail, saved] of [[true, true], [true, false], [false, true]]) {
    const count = posts.length; await show(fail); assert.equal(posts.length, count, 'showing the dialog is not consent');
    await input.fill('!'); await submit.click(); assert.equal(posts.length, count, 'invalid names cannot submit');
    await input.fill('Feka  Test'); plans.push({ body: { saved, entries: [entry(saved ? 'Feka Test' : 'Previous')] } });
    await submit.click(); await page.waitForFunction(() => document.querySelector('.scoreboard-status').textContent !== 'Publicando recorde…');
    const result = await snapshot(); results.push({ fail, saved, ...result });
    if (result.hidden) await page.locator('.scoreboard-form').evaluate(form => form.dispatchEvent(new Event('submit', { cancelable: true })));
    assert.equal(posts.length, count + 1, 'confirmed results cannot be submitted again');
  }
  await show(false); await input.fill('Retry Name');
  plans.push({ status: 503, body: { error: 'Temporary failure' } });
  const writes = (await snapshot()).writes; await submit.click(); await status.filter({ hasText: 'Temporary failure' }).waitFor();
  const failed = await snapshot();
  plans.push({ body: { saved: true, entries: [entry('Retry Name')] } });
  await submit.click(); await page.locator('.scoreboard-form[hidden]').waitFor({ state: 'attached' });
  const retried = await snapshot();
  await show(true); await input.fill('Old Session'); plans.push({ hold: true }); await submit.click();
  await heldReady;
  await show(false); const current = await snapshot();
  const response = page.waitForResponse(r => r.request().method() === 'POST');
  await held.shift().fulfill({ json: { saved: true, entries: [entry('Stale')] } }); await response;
  await page.waitForTimeout(50); assert.deepEqual(await snapshot(), current, 'retired POST cannot persist a name or replace the new ending');
  t.diagnostic(JSON.stringify({ results, failed, retried, posts }));
  for (const result of results) {
    assert.equal(result.hidden, true); assert.equal(result.disabled, true); assert.equal(result.doneFocused, true);
    assert.equal(result.status, result.saved ? 'Recorde publicado! Seu nome já está no placar.' : 'Seu recorde publicado já é igual ou maior.');
    assert.ok(result.list.includes(result.saved ? 'Feka Test' : 'Previous'));
    assert.equal(result.name, result.fail ? null : 'Feka Test');
  }
  assert.equal(failed.hidden, false); assert.equal(failed.disabled, false); assert.equal(failed.writes, writes);
  assert.equal(retried.hidden, true); assert.equal(retried.name, 'Retry Name');
  assert.equal(posts.length, 6);
  for (const post of posts) assert.deepEqual(post, { playerId, name: post.name, score: 5000, durationMs: 60000 });
  assert.equal(posts[0].name, 'Feka Test');
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('super_feka_gaps_player_id'), localStorage.getItem('unrelated-save')]), [playerId, 'preserved']);
  assert.deepEqual(errors, []);
});
