import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createLeaderboardServer } from '../server/leaderboard.mjs';

const directory = mkdtempSync(join(tmpdir(), 'sfg-leaderboard-'));
const siteRoot = join(directory, 'dist');
mkdirSync(siteRoot);
writeFileSync(join(siteRoot, 'index.html'), '<h1>Super Feka Gaps</h1>');
const databasePath = join(directory, 'scores.sqlite');
const server = createLeaderboardServer({ databasePath, siteRoot });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
after(async () => {
  await new Promise(resolve => server.close(resolve));
  rmSync(directory, { recursive: true, force: true });
});
const id = '58847e28-8d8c-4c58-80cc-49aca3d882b1';
const headers = { 'Content-Type': 'application/json', Origin: 'https://superfekagaps.torbware.space' };
const post = async body => fetch(base + '/api/leaderboard', { method: 'POST', headers, body: JSON.stringify(body) });

test('serves the game and an initially empty ranking', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Super Feka Gaps/);
  const range = await fetch(base + '/', { headers: { Range: 'bytes=0-3' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), 'bytes 0-3/24');
  assert.equal(await range.text(), '<h1>');
  assert.deepEqual(await (await fetch(base + '/api/leaderboard')).json(), { entries: [] });
  assert.equal((await fetch(base + '/not-here.js')).status, 404);
});

test('publishes only the best run for a player and keeps the chosen display name', async () => {
  const first = await post({ playerId: id, name: 'Feka', score: 4200, durationMs: 180000 });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).saved, true);
  const worse = await post({ playerId: id, name: 'Impostor', score: 4000, durationMs: 80000 });
  assert.equal((await worse.json()).saved, false);
  const better = await post({ playerId: id, name: 'Herói', score: 4200, durationMs: 170000 });
  assert.equal((await better.json()).saved, true);
  const { entries } = await (await fetch(base + '/api/leaderboard')).json();
  assert.deepEqual(entries, [{ rank: 1, name: 'Herói', score: 4200, durationMs: 170000 }]);
});

test('rejects malicious names, implausible scores, and foreign origins', async () => {
  assert.equal((await post({ playerId: id, name: '<script>', score: 9999, durationMs: 100000 })).status, 400);
  assert.equal((await post({ playerId: id, name: 'Ok', score: -2, durationMs: 100000 })).status, 400);
  const foreign = await fetch(base + '/api/leaderboard', {
    method: 'POST', headers: { ...headers, Origin: 'https://example.org' },
    body: JSON.stringify({ playerId: id, name: 'Ok', score: 9999, durationMs: 100000 })
  });
  assert.equal(foreign.status, 403);
});
