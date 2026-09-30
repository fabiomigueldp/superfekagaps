// Production render export and hazard/animation integration checks. No duplicate artwork.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.GAME_URL || 'http://127.0.0.1:3000';
const assets = path.resolve(__dirname, '../public/assets/world');
const out = path.resolve(__dirname, '../docs/world/capturas/mecanismos');
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
    const errors = [], checks = [];
    const check = (label, value) => { assert.ok(value, label); checks.push(label); };
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
        page.on('pageerror', e => { errors.push(String(e)); console.error(e.stack); });
        await page.goto(base); await page.waitForFunction(() => window.worldGame);
        const exported = await page.evaluate(async () => {
            const { WorldObjects, WorldLevel } = await import('/src/adventure/WorldPhysics.ts');
            const { drawWorldObjects } = await import('/src/adventure/WorldMechanisms.ts');
            const { jetCycle, cannonCycle, cannonMuzzle } = await import('/src/adventure/WorldMachineState.ts');
            const { SpriteAtlas } = await import('/src/graphics/pixels.ts');
            const { STAGES } = await import('/src/adventure/campaign.ts');
            const { pixelText } = await import('/src/graphics/BitmapFont.ts');
            const atlas = new SpriteAtlas(), levelData = structuredClone(STAGES.find(s => s.id === '3-5').level);
            const models = [
                { id: 'jet-factory', label: 'Jato de suco', kind: 'jet', world: 3 },
                { id: 'jet-cold', label: 'Jato da Reserva', kind: 'jet', world: 5 },
                { id: 'jet-oven', label: 'Saída do forno', kind: 'jet', world: 6 },
                { id: 'cannon-factory', label: 'Canhão da Fábrica', kind: 'launcher', world: 3 },
                { id: 'cannon-cold', label: 'Canhão pressurizado', kind: 'launcher', world: 5 },
                { id: 'lift-port', label: 'Elevador do Porto', kind: 'lift', world: 2, period: 4000, events: [500, 2500], samples: [0, 550, 1100, 2200, 2550, 3200], note: 'A superfície clara é o apoio. Cabos, guias e pistão acompanham a subida.' },
                { id: 'gondola', label: 'Teleférico da Serra', kind: 'swing', world: 4, period: 4200, samples: [0, 800, 1600, 2100, 3000, 4000], note: 'As polias giram com o deslocamento, param nas extremidades e invertem no retorno.' },
                { id: 'conveyor', label: 'Esteira e acionador', kind: 'belt', world: 3, period: 2400, events: [600, 1200], samples: [0, 600, 950, 1200, 1500, 2000], note: 'A inversão mantém a posição da correia. As setas mostram o sentido real do transporte.' },
                { id: 'support', label: 'Suporte de Joãozão', kind: 'support', world: 6, period: 3200, events: [1000], samples: [500, 1050, 1200, 1500, 1800, 3000], note: 'Impacto, ruptura das travessas e descida do apoio. Fragmentos e tremor das colunas são decorativos.' },
                { id: 'reinforced', label: 'Gelo reforçado', kind: 'target', world: 5, period: 3200, events: [800, 1800], samples: [500, 850, 1750, 1850, 2050, 3000], note: 'O barril comum é bloqueado; o pressurizado rompe o gelo e abre a passagem.' }
            ];
            const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = Math.ceil(models.reduce((n, m) => n + (m.period || (m.kind === 'jet' ? 4200 : 3200)) / 50, 0) / 10) * 96;
            const c = canvas.getContext('2d'), cell = document.createElement('canvas'); cell.width = 160; cell.height = 96;
            const cc = cell.getContext('2d'), groups = [], contact = document.createElement('canvas'); contact.width = 960; contact.height = models.length * 120;
            const sc = contact.getContext('2d'); sc.fillStyle = '#172a40'; sc.fillRect(0, 0, contact.width, contact.height);
            let entry = 0;
            for (const [row, model] of models.entries()) {
                const jet = model.kind === 'jet', cannon = model.kind === 'launcher';
                const period = model.period || (jet ? 4200 : 3200), frames = [];
                let bSpec = { id: 'm', kind: model.kind, x: jet ? 74 : 114, y: jet ? 176 : 208, width: jet ? 13 : 16, height: jet ? 48 : 16, direction: -1, period, pressurized: !jet && model.world === 5 };
                if (model.kind === 'lift') Object.assign(bSpec, { x: 80, y: 216, width: 48, height: 8, to: { x: 80, y: 184 } });
                if (model.kind === 'swing') Object.assign(bSpec, { x: 16, y: 184, width: 48, height: 8, to: { x: 96, y: 184 } });
                if (model.kind === 'belt') Object.assign(bSpec, { x: 8, y: 220, width: 144, height: 4 });
                if (model.kind === 'support') Object.assign(bSpec, { x: 56, y: 176, width: 64, height: 8, to: { x: 56, y: 208 } });
                if (model.kind === 'target') Object.assign(bSpec, { x: 110, y: 176, width: 16, height: 48 });
                const specs = [bSpec];
                if (['belt', 'lift'].includes(model.kind)) specs.push({ id: 'control', kind: 'switch', x: 136, y: 203, width: 24, height: 5, link: 'm' });
                const o = new WorldObjects(specs), b = o.get('m'), l = new WorldLevel(levelData);
                const samples = model.samples || (jet ? [900, 1700, 1850, 2100, 2450, 2600] : [2600, 3150, 0, 150, 450, 750]);
                if (cannon) {
                    const muzzle = cannonMuzzle(b); b.firedAt = 0; b.timer = period;
                    o.spawnBarrel(muzzle.x - 14, muzzle.y - 8, -1, model.world === 5);
                }
                if (model.kind === 'belt') o.spawnBarrel(128, 208, -1);
                const triggered = new Set();
                const trigger = () => {
                    for (const at of model.events || []) if (o.time >= at - .01 && !triggered.has(at)) {
                        triggered.add(at);
                        if (model.kind === 'support') b.active = true;
                        else if (model.kind === 'target') o.spawnBarrel(95, 208, 1, at === 1800);
                        else o.activate('control');
                    }
                };
                const step = 1000 / 60;
                for (let t = 0; t < period; t += 50) {
                    while (o.time < t - .01) { trigger(); o.update(Math.min(step, t - o.time), l, 100); }
                    trigger();
                    cc.fillStyle = model.world === 6 ? '#4d3d49' : model.world === 5 ? '#294559' : '#26384e'; cc.fillRect(0, 0, 160, 96);
                    const cy = 150;
                    cc.fillStyle = '#3d5667'; cc.fillRect(0, 74, 160, 22);
                    cc.fillStyle = model.world === 5 ? '#c6e7e9' : model.world === 6 ? '#cda785' : '#9bb5b1'; cc.fillRect(0, 74, 160, 2);
                    cc.fillStyle = '#283e52'; for (let x = 0; x < 160; x += 16) cc.fillRect(x, 78, 1, 18);
                    if (o.get('control')) { cc.fillStyle = '#597581'; cc.fillRect(132, 58, 28, 16); cc.fillStyle = '#c9d7bd'; cc.fillRect(132, 58, 28, 2); }
                    drawWorldObjects(cc, o, atlas, 0, cy, o.time, model.world);
                    const x = entry % 10 * 160, y = Math.floor(entry / 10) * 96;
                    c.drawImage(cell, x, y);
                    let state = jet ? jetCycle(b, o.time) : cannon ? cannonCycle(b, o.time) : { phase: 'holding' };
                    if (model.kind === 'lift') state.phase = Math.abs(b.y - b.py) < .01 ? 'holding' : b.y < b.py ? 'ascending' : 'descending';
                    if (model.kind === 'swing') state.phase = Math.abs(b.x - b.px) < .01 ? 'holding' : 'moving';
                    if (model.kind === 'belt') state.phase = b.active ? 'beltRight' : 'beltLeft';
                    if (model.kind === 'support') state.phase = !b.active ? 'intact' : b.y < b.to.y ? 'collapsing' : 'collapsed';
                    if (model.kind === 'target') state.phase = b.active ? (o.time - b.brokenAt < 450 ? 'shattered' : 'passage') : b.hitAt !== undefined && o.time - b.hitAt < 180 ? 'resisted' : 'sealed';
                    const danger = jet ? o.jetDanger(b) : null;
                    frames.push({ x, y, width: 160, height: 96, time: t, phase: state.phase || state.pose,
                        danger: danger ? { ...danger, y: danger.y - cy } : null,
                        barrels: o.barrels.map(p => ({ x: p.x, y: p.y - cy, width: p.width, height: p.height })),
                        surfaces: o.bodies.filter(p => ['lift', 'swing', 'support', 'belt'].includes(p.kind)).map(p => ({ x: p.x, y: p.kind === 'belt' ? p.y + p.height - cy : p.y - cy, width: p.width, height: 2 })),
                        solids: o.bodies.filter(p => p.kind === 'target' && !p.active).map(p => ({ x: p.x, y: p.y - cy, width: p.width, height: p.height })) });
                    entry++;
                    const col = samples.indexOf(t);
                    if (col >= 0) {
                        sc.drawImage(cell, col * 160, row * 120 + 16);
                        pixelText(sc, `${t} MS`, col * 160 + 6, row * 120 + 108, '#bdd7da');
                    }
                }
                pixelText(sc, model.label.toUpperCase(), 6, row * 120 + 3, '#f5d891');
                groups.push({ ...model, period, frameMs: 50, frames });
            }
            // Use the actual game damage loop, above the rising plume and inside a full one.
            const g = window.worldGame; g.load('3-3'); g.state = 'playing';
            g.objects.bodies = [Object.assign(new WorldObjects([{ id: 'j', kind: 'jet', x: 160, y: 176, width: 13, height: 48 }]).bodies[0])];
            g.foes = []; g.stage = { ...g.stage, dialogues: [], pickups: [], exits: [] };
            g.level = new WorldLevel(levelData); g.player.data.position = { x: 160, y: 163 }; g.player.data.velocity = { x: 0, y: 0 };
            g.objects.time = 1820;
            let hits = 0; const hurt = g.hurt; g.hurt = () => { hits++; };
            g.update(1000 / 60); const risingHits = hits;
            g.objects.time = 2100; g.player.data.position = { x: 160, y: 163 }; g.player.data.velocity.y = 0;
            g.update(1000 / 60); const flowingHits = hits - risingHits;
            g.objects.get('j').active = true; g.update(1000 / 60); const closedHits = hits - flowingHits - risingHits;
            g.hurt = hurt;
            return { png: canvas.toDataURL().split(',')[1], sheet: contact.toDataURL().split(',')[1], manifest: { source: ['WorldMachineAssets.ts', 'WorldMachineArt.ts', 'WorldMachineState.ts'], groups }, hits: { risingHits, flowingHits, closedHits } };
        });
        check('The real damage loop follows the growing jet', exported.hits.risingHits === 0 && exported.hits.flowingHits === 1 && exported.hits.closedHits === 0);
        check('All ten mechanism variants contain complete cycles', exported.manifest.groups.length === 10 && exported.manifest.groups.every(g => g.frames.length * g.frameMs === g.period));
        fs.writeFileSync(path.join(assets, 'mechanisms.png'), Buffer.from(exported.png, 'base64'));
        fs.writeFileSync(path.join(assets, 'mechanisms.json'), JSON.stringify(exported.manifest, null, 2));
        fs.writeFileSync(path.join(out, 'ciclos.png'), Buffer.from(exported.sheet, 'base64'));
        // Staged production views make scale and terrain integration inspectable.
        for (const [name, stage, kind] of [['fabrica', '3-3', 'jet'], ['canhao', '3-2', 'launcher'], ['reserva', '5-3', 'launcher'], ['forno', '6-2', 'jet'], ['elevador', '2-5', 'lift'], ['teleferico', '4-3', 'platform'], ['suporte', '6-5', 'support'], ['gelo', '5-5', 'target']]) {
            await page.evaluate(({ stage, kind }) => {
                const g = window.worldGame; g.load(stage); g.state = 'playing'; g.update = () => {};
                const b = g.objects.bodies.find(b => b.kind === kind);
                g.time = 2100; g.objects.time = 2100 - (b.phase || 0); b.timer = 400;
                if (kind === 'lift' || kind === 'support') {
                    b.active = true;
                    for (let i = 0; i < 35; i++) g.objects.update(1000 / 60, g.level, b.x);
                }
                g.camera.x = Math.max(0, Math.min(g.level.data.width * 16 - 320, b.x - 190)); g.camera.y = g.stage.level.isBossLevel ? 64 : Math.max(0, Math.min(g.level.data.height * 16 - 180, b.y + b.height - 135));
                const ride = ['lift', 'platform', 'support'].includes(kind);
                g.player.data.position = { x: ride ? b.x + 8 : b.x - 52, y: b.y + (ride ? 0 : b.height) - 24 };
            }, { stage, kind });
            await page.waitForTimeout(35); await page.locator('#game-canvas').screenshot({ path: path.join(out, name + '.png') });
        }
        await page.goto(base + '/docs/world/capturas/mecanismos/');
        await page.waitForFunction(() => document.querySelector('#machine-kind').options.length === 10 && document.querySelector('#phase').textContent);
        await page.locator('#machine-toggle').click();
        const seek = value => page.locator('#machine-time').evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event('input')); }, value);
        await seek(2100);
        const flow = await page.locator('#machine-preview').screenshot();
        await seek(1850);
        check('Timeline exposes the shorter rising plume', !flow.equals(await page.locator('#machine-preview').screenshot()));
        const paused = await page.locator('#machine-preview').screenshot(); await page.waitForTimeout(180);
        check('The machine inspector freezes on the selected frame', paused.equals(await page.locator('#machine-preview').screenshot()));
        await page.locator('#machine-hitboxes').check();
        check('Collision overlay can be inspected independently', !paused.equals(await page.locator('#machine-preview').screenshot()));
        await page.locator('#machine-kind').selectOption('cannon-cold');
        await seek(150);
        check('Inspector selects the production recoil frame', (await page.locator('#phase').textContent()).includes('Recuo'));
        await page.locator('#machine-kind').selectOption('conveyor'); await seek(950);
        check('Inspector exposes the real reversed conveyor direction', (await page.locator('#phase').textContent()).includes('direita'));
        await page.locator('#machine-kind').selectOption('lift-port'); await seek(2200);
        const resting = await page.locator('#machine-preview').screenshot(); await seek(2250);
        check('A stopped lift has stopped pulleys', resting.equals(await page.locator('#machine-preview').screenshot()));
        await page.locator('#machine-kind').selectOption('reinforced'); await seek(850);
        check('Ordinary barrel resistance is visible', (await page.locator('#phase').textContent()).includes('sem pressão'));
        await seek(1850); check('Pressurized barrel fracture is visible', (await page.locator('#phase').textContent()).includes('Quebra'));
        check('No browser runtime errors', errors.length === 0);
        fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ checks, errors, frames: exported.manifest.groups.reduce((n, g) => n + g.frames.length, 0), stagedViews: true }, null, 2));
        console.log(JSON.stringify({ checks: checks.length, errors }, null, 2));
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
