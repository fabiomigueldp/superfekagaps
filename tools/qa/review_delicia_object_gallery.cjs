const { chromium } = require(process.env.PLAYWRIGHT_LIB || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve('docs/world/delicia/object-polish-2026-10-08');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.CHROMIUM_CHANNEL || 'msedge' });
  const report = { errors: [], viewports: [], images: 0 };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 920 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto((process.env.DELICIA_URL || 'http://localhost:3000') + '/docs/world/delicia/object-polish-2026-10-08/index.html');
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#actors canvas').count(), 8);
    assert.equal(await page.locator('#bosses canvas').count(), 2);
    const first = () => page.locator('#actors canvas').first().evaluate(canvas => canvas.toDataURL());
    const initial = await first(); await page.getByRole('button', { name: 'Próximo quadro' }).click();
    assert.notEqual(await first(), initial);
    for (const pose of ['walk', 'tell', 'attack', 'stun']) await page.locator('#pose').selectOption(pose);
    for (const beat of ['idle', 'tell', 'attack', 'recover', 'stagger', 'transition', 'defeated']) await page.locator('#beat').selectOption(beat);
    await page.locator('#pose').selectOption('walk'); await page.locator('#beat').selectOption('tell');
    const beforeAnimation = await first(); await page.locator('#motion').click();
    await page.waitForFunction(before => document.querySelector('#actors canvas').toDataURL() !== before, beforeAnimation);
    await page.locator('#motion').click();
    await page.getByRole('button', { name: 'Comparar com a arte anterior' }).click();
    assert.equal(await page.locator('#sheets').getAttribute('class'), 'two');
    await page.getByRole('button', { name: 'Ampliar a arte atual' }).click();
    for (const value of await page.locator('#object option').evaluateAll(options => options.map(option => option.value))) {
      await page.locator('#object').selectOption(value);
      await page.locator('#old-object').evaluate(image => image.decode());
      await page.locator('#new-object').evaluate(image => image.decode()); report.images += 2;
    }
    await page.locator('#object').selectOption('valve-open');
    await page.evaluate(async () => { for (const image of document.images) image.loading = 'eager'; await Promise.all([...document.images].map(image => image.decode())); });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 920 }); await page.evaluate(() => scrollTo(0, 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(out, `gallery-${width}.png`) }); report.viewports.push(width);
    }
    const sheets = await page.evaluate(async () => {
      const { SpriteAtlas } = await import('/src/graphics/pixels.ts');
      const { pixelText } = await import('/src/graphics/BitmapFont.ts');
      const { ART } = await import('/src/graphics/palette.ts');
      const { deliciaFoeFrame, deliciaBossFrame, DELICIA_PIXEL_PALETTE: palette } = await import('/src/adventure/delicia/DeliciaPixelSprites.ts');
      const { drawDeliciaValve, drawDeliciaMachine } = await import('/src/adventure/delicia/DeliciaObjectArt.ts');
      const { DeliciaSimulation } = await import('/src/adventure/delicia/DeliciaSimulation.ts');
      const { DeliciaArt } = await import('/src/adventure/delicia/DeliciaArt.ts');
      const { PLAYER_PALETTE, PLAYER_SPRITES } = await import('/src/assets/playerSpriteSpec.ts');
      const atlas = new SpriteAtlas(), images = {};
      const make = (w, h, scale) => { const canvas = document.createElement('canvas'); canvas.width = w * scale; canvas.height = h * scale; const c = canvas.getContext('2d'); c.scale(scale, scale); c.fillStyle = ART.ink; c.fillRect(0, 0, w, h); return { canvas, c }; };
      const kinds = ['pulp', 'beetle', 'wasp', 'roller', 'sentinel', 'bottler', 'mimic', 'bloom'], names = ['POLPA', 'BESOURO', 'VESPA', 'ROLO', 'GUARDA', 'GARRAFA', 'BARRIL', 'FLOR'];
      {
        const { canvas, c } = make(512, 294, 3);
        ['ANDAR', 'AVISO', 'ACAO', 'TONTO'].forEach((label, i) => pixelText(c, label, 73 + i * 108, 5, ART.goldLight));
        kinds.forEach((kind, row) => {
          const y = 21 + row * 34; pixelText(c, names[row], 3, y + 9, ART.paper);
          ['walk', 'tell', 'attack', 'stun'].forEach((pose, column) => {
            for (let f = 0; f < 4; f++) atlas.draw(c, deliciaFoeFrame(kind, pose, (f + .1) / (kind === 'wasp' ? 14 : 7)), palette, 71 + column * 108 + f * 26, y);
          });
        }); images['enemy-motion'] = canvas.toDataURL();
      }
      {
        const { canvas, c } = make(1024, 354, 2), beats = ['intro', 'idle', 'tell', 'attack', 'recover', 'stagger', 'transition', 'defeated'];
        for (const [i, kind] of ['jaja', 'guina'].entries()) for (let row = 0; row < 2; row++) {
          const y = 18 + (i * 2 + row) * 87; pixelText(c, kind.toUpperCase(), 3, y + 25, ART.paper);
          for (let col = 0; col < 4; col++) {
            const beat = beats[row * 4 + col], x = 65 + col * 238;
            pixelText(c, beat.toUpperCase(), x, y - 11, ART.goldLight);
            for (let f = 0; f < 4; f++) atlas.draw(c, deliciaBossFrame(kind, beat, (f + .1) / 7), palette, x + f * 58, y);
          }
        } images['boss-motion'] = canvas.toDataURL();
      }
      {
        const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
        const sim=new DeliciaSimulation(),valve=sim.stage.valves[0];
        sim.player.x=valve.x-80;sim.player.y=valve.y-sim.player.h;sim.player.grounded=true;
        sim.cameraX=valve.x-480;sim.checkpoint=0;sim.valves.add(valve.id);
        const art=new DeliciaArt();art.draw(canvas.getContext('2d'),sim,true);art.dispose();images['valve-interaction']=canvas.toDataURL();
      }
      {
        const { canvas, c } = make(384, 210, 3);
        pixelText(c, 'IMPÉRIO DA DELÍCIA', 10, 10, ART.goldLight); pixelText(c, 'CRIATURAS, OBJETOS E CHEFES', 10, 24, ART.rockTop);
        kinds.forEach((kind, i) => { atlas.draw(c, deliciaFoeFrame(kind, 'walk', 0), palette, 16 + i * 46, 43); pixelText(c, names[i], 28 + i * 46, 72, ART.paper, 1, 'center'); });
        atlas.draw(c, PLAYER_SPRITES.idle, PLAYER_PALETTE, 13, 137); pixelText(c, 'FEKA', 22, 170, ART.rockTop, 1, 'center');
        atlas.draw(c, deliciaBossFrame('jaja', 'tell', 0), palette, 49, 105); pixelText(c, 'JAJÁ', 77, 170, ART.paper, 1, 'center');
        atlas.draw(c, deliciaBossFrame('guina', 'tell', 0), palette, 141, 105); pixelText(c, 'GUINA', 169, 170, ART.paper, 1, 'center');
        drawDeliciaValve(c, 247, 165, true); pixelText(c, 'VÁLVULA', 247, 170, ART.paper, 1, 'center');
        const sim = new DeliciaSimulation(); sim.time = 2.6;
        drawDeliciaMachine(c, { id: 'preview-press', kind: 'press', x: 294 * 3, y: 90 * 3, w: 24 * 3, h: 75 * 3, period: 4, phase: 0 }, sim, 0);
        pixelText(c, 'PRENSA', 306, 170, ART.paper, 1, 'center');
        sim.time = 3.6; drawDeliciaMachine(c, { id: 'preview-jet', kind: 'jet', x: 349 * 3, y: 130 * 3, w: 14 * 3, h: 35 * 3, period: 4, phase: 0 }, sim, 0);
        pixelText(c, 'JATO', 356, 170, ART.paper, 1, 'center');
        pixelText(c, 'ARTE NATIVA DO WORLD - 08.10.2026', 10, 192, ART.tealLight); images.preview = canvas.toDataURL();
      }
      return images;
    });
    for (const [name, image] of Object.entries(sheets)) fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(image.split(',')[1], 'base64'));
    assert.deepEqual(report.errors, []); fs.writeFileSync(path.join(out, 'gallery-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
