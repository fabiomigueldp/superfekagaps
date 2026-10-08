/* Actual stage objects, arranged at each mechanical state. Not a playthrough. */
const { chromium } = require(process.env.PLAYWRIGHT_LIB || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(process.env.DELICIA_OUTPUT || 'output/delicia/objects');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.CHROMIUM_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto((process.env.DELICIA_URL || 'http://localhost:3000') + '/delicia.html');
    await page.waitForFunction(() => window.worldGame?.mapView);
    const result = await page.evaluate(async () => {
      const { ALL_DELICIA_STAGES } = await import('/src/adventure/delicia/DeliciaContent.ts');
      const { DeliciaSimulation, steamPhase } = await import('/src/adventure/delicia/DeliciaSimulation.ts');
      const { DeliciaArt } = await import('/src/adventure/delicia/DeliciaArt.ts');
      const sprites = await import('/src/adventure/delicia/DeliciaPixelSprites.ts');
      const art = new DeliciaArt(), canvas = document.createElement('canvas');
      canvas.width = 960; canvas.height = 540; const c = canvas.getContext('2d'), frames = [];
      for (const kind of ['valve', 'press', 'wind', 'jet', 'steam', 'thorns', 'juice']) {
        const items = stage => kind === 'valve' ? stage.valves : ['press', 'wind', 'jet'].includes(kind)
          ? (stage.machines || []).filter(item => item.kind === kind) : stage.hazards.filter(item => item.kind === kind);
        const stage = ALL_DELICIA_STAGES.find(stage => !stage.boss && items(stage).length);
        if (!stage) continue;
        const item = items(stage)[0];
        const states = kind === 'valve' ? ['closed', 'open'] : ['press', 'jet', 'steam'].includes(kind) ? ['safe', 'tell', 'active'] : ['active'];
        if (item.disabledBy) states.push('disabled');
        for (const state of states) {
          const sim = new DeliciaSimulation(stage), period = item.period || 4;
          const fraction = { safe: .2, tell: .65, active: .9 }[state] || .9;
          sim.time = period * fraction - (item.phase || 0) + period;
          sim.cameraX = Math.max(0, Math.min(stage.width - 960, item.x + (item.w || 0) / 2 - 480));
          sim.cameraY = kind === 'juice' ? 180 : 0;
          const floor = stage.floors.find(f => f.h > 50 && f.x + f.w > sim.cameraX + 160 && f.x < sim.cameraX + 800);
          sim.player.x = Math.max(floor.x + 18, Math.min(floor.x + floor.w - sim.player.w - 18, sim.cameraX + 90));
          sim.player.y = floor.y - sim.player.h; sim.player.grounded = true;
          if (state === 'open') sim.valves.add(item.id);
          if (state === 'disabled') sim.valves.add(item.disabledBy);
          const snapshot = JSON.stringify(sim);
          art.draw(c, sim, true);
          if (snapshot !== JSON.stringify(sim)) throw Error('Art mutated simulation state');
          const pixels = c.getImageData(0, 0, 960, 540).data; let brokenPixels = 0;
          for (let y = 0; y < 540; y++) for (let x = 0; x < 960; x++) {
            const a = (y * 960 + x) * 4, b = (Math.floor(y / 3) * 3 * 960 + Math.floor(x / 3) * 3) * 4;
            if (pixels[a] !== pixels[b] || pixels[a + 1] !== pixels[b + 1] || pixels[a + 2] !== pixels[b + 2]) brokenPixels++;
          }
          frames.push({ name: kind + '-' + state, stage: stage.id, state, phase: steamPhase(sim.time, item.period, item.phase), brokenPixels, image: canvas.toDataURL() });
        }
      }
      const kinds = ['pulp', 'beetle', 'wasp', 'roller', 'sentinel', 'bottler', 'mimic', 'bloom'];
      const poses = ['walk', 'tell', 'attack', 'stun'], beats = ['intro', 'idle', 'tell', 'attack', 'recover', 'stagger', 'transition', 'defeated'];
      const actors = kinds.map(kind => ({ kind, poses: Object.fromEntries(poses.map(pose => [pose, [0, 1, 2, 3].map(f => sprites.deliciaFoeFrame(kind, pose, (f + .1) / (kind === 'wasp' ? 14 : 7)))])) }));
      const bosses = ['jaja', 'guina'].map(kind => ({ kind, poses: Object.fromEntries(beats.map(pose => [pose, [0, 1, 2, 3].map(f => sprites.deliciaBossFrame(kind, pose, (f + .1) / 7))])) }));
      const projectiles = sprites.deliciaProjectileFrame ? Object.fromEntries(['seed', 'juice', 'heart'].map(kind => [kind, [false, true].map(friendly => sprites.deliciaProjectileFrame(kind, friendly))])) : {};
      art.dispose(); return { frames, atlas: { palette: sprites.DELICIA_PIXEL_PALETTE, actors, bosses, pickups: sprites.DELICIA_ICONS, projectiles } };
    });
    for (const frame of result.frames) { fs.writeFileSync(path.join(out, frame.name + '.png'), Buffer.from(frame.image.split(',')[1], 'base64')); delete frame.image; }
    fs.writeFileSync(path.join(out, 'atlas.json'), JSON.stringify(result.atlas));
    fs.writeFileSync(path.join(out, 'objects-report.json'), JSON.stringify({ frames: result.frames, errors, arranged: true }, null, 2));
    if (errors.length || result.frames.some(frame => frame.brokenPixels)) throw Error('Object rendering failed: ' + JSON.stringify(errors));
    console.log(JSON.stringify({ frames: result.frames.length, errors, out }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
