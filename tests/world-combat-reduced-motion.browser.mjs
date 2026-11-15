import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('World damage and defeat feedback respects live reduced motion without hiding combat states', async t => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
  t.after(() => server.close()); await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  t.after(() => browser.close()); const page = await browser.newPage({ reducedMotion: 'no-preference' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/combat-fixture', route => route.fulfill({ contentType: 'text/html', body: '<div id="evidence"></div>' }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/combat-fixture');
  await page.evaluate(async () => {
    const { WorldArt } = await import('/src/adventure/WorldArt.ts');
    const { WorldFoe } = await import('/src/adventure/WorldEnemies.ts');
    const { BossEncounter } = await import('/src/adventure/BossEncounter.ts');
    const art = new WorldArt(), original = art.atlas.draw.bind(art.atlas), calls = [];
    art.atlas.draw = (...args) => {
      const m = args[0].getTransform();
      calls.push({ x: args[3], y: args[4], alpha: args[0].globalAlpha, transform: [m.a, m.b, m.c, m.d, m.e, m.f], frame: args[1].join('') });
      original(...args);
    };
    window.combatSamples = (label, capture) => {
      const results = [];
      for (const kind of ['minion', 'helmet', 'J1', 'B1', 'C1']) {
        const boss = kind.length === 2;
        for (const phase of boss ? ['hurt', 'defeated', 'open', 'warning'] : ['hit', 'dead']) {
          const samples = [];
          const row = document.createElement('div'); row.textContent = `${label} ${kind} ${phase}`;
          if (capture && ['minion', 'J1'].includes(kind)) document.getElementById('evidence').append(row);
          for (const time of [60, 90, 180]) {
            const entity = boss ? new BossEncounter(kind) : new WorldFoe({ id: 'fixture', kind, x: 150, y: 140 });
            if (boss) Object.assign(entity, { x: 140, y: 95, phase, timer: time, poseTime: time,
              pose: phase === 'defeated' ? 'dead' : phase === 'open' ? 'recover' : phase === 'warning' ? 'windup' : 'hurt', pattern: 'leap', targetX: 160 });
            else Object.assign(entity, { phase: 'stunned', armor: false, flash: phase === 'hit' ? time : 0, dead: phase === 'dead', deadTimer: time, age: time, timer: time });
            const before = JSON.stringify(entity);
            const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
            canvas.style = 'width:320px;height:240px;image-rendering:pixelated';
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#b5dce3'; ctx.fillRect(0, 0, 320, 240);
            calls.length = 0;
            if (boss) art.boss(ctx, entity, 0, 0, time); else art.foe(ctx, entity, 0, 0, time);
            samples.push({ calls: [...calls], image: canvas.toDataURL(), unchanged: before === JSON.stringify(entity) });
            if (capture && ['minion', 'J1'].includes(kind)) row.append(canvas);
          }
          results.push({ kind, phase, samples });
        }
      }
      return results;
    };
  });
  const normal = await page.evaluate(() => combatSamples('normal', true));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => combatSamples('reduced', true));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const restored = await page.evaluate(() => combatSamples('restored', false));
  await page.locator('#evidence').screenshot({ path: process.env.COMBAT_CAPTURE || '/tmp/feka-combat-motion.png' });
  t.diagnostic(JSON.stringify(reduced.map(r => ({ kind: r.kind, phase: r.phase, alpha: r.samples.map(s => s.calls[0]?.alpha), stablePixels: r.samples[0].image === r.samples[1].image }))));
  assert.deepEqual(restored, normal, 'normal visuals return live');
  for (const [index, result] of reduced.entries()) {
    assert.ok(result.samples.every(s => s.unchanged && s.calls.length > 0 && s.calls[0].alpha > 0));
    if (result.phase === 'warning') assert.deepEqual(result.samples, normal[index].samples, 'essential telegraph unchanged');
    else if (result.phase === 'dead') {
      const withoutAlpha = call => { const { alpha, ...rest } = call; return rest; };
      for (const sample of result.samples) assert.deepEqual(withoutAlpha(sample.calls[0]), withoutAlpha(result.samples[0].calls[0]), 'defeated foe stays in place');
      assert.ok(result.samples[1].calls[0].alpha < result.samples[0].calls[0].alpha, 'existing fade retained');
    } else assert.ok(result.samples.every(s => s.image === result.samples[0].image), `${result.kind} ${result.phase}: stable feedback`);
  }
  assert.deepEqual(errors, []);
});
