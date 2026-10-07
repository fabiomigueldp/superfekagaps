/** Native Canvas proof using the production Delicia painter and assets.
 * node --import tsx tools/qa/render_checkpoint_camera.mts BASELINE_ROOT OUTPUT
 * CAMERA_CANVAS_MODULE may point to an existing @napi-rs/canvas install.
 * No browser/device or hardware-performance evidence is claimed.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DeliciaArt } from '../../src/adventure/delicia/DeliciaArt';
import { DELICIA_STAGES, DELICIA_ASSETS } from '../../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../../src/adventure/delicia/DeliciaSimulation';

const baseline = resolve(process.argv[2]), out = resolve(process.argv[3]);
const { DeliciaSimulation: BeforeSimulation } = await import(pathToFileURL(`${baseline}/src/adventure/delicia/DeliciaSimulation.ts`).href);
const { createCanvas, loadImage, GlobalFonts } = createRequire(import.meta.url)(process.env.CAMERA_CANVAS_MODULE ?? '@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'ProofSans');
globalThis.document = { createElement: () => createCanvas(1, 1) } as unknown as Document;
const art = new DeliciaArt();
for (const name of ['backdrop', 'environment-atlas', 'props', 'boss-atlas', 'enemies-v2', 'jaja-motion-v2', 'guina-motion-v2', 'landmarks-v2', 'terrain-v2']) {
    art.images.set(name, await loadImage(resolve('public', DELICIA_ASSETS.replace(/^\//, ''), `${name}.webp`)));
}
mkdirSync(out, { recursive: true });
const report = [], snapshots = new Map();
for (const reduced of [false, true]) for (const version of ['before', 'after']) {
    const stage = DELICIA_STAGES.find(s => s.id === 'delicia-11')!;
    const Simulation = version === 'before' ? BeforeSimulation : DeliciaSimulation;
    const sim = new Simulation(stage, false, 2);
    for (let frame = 0; frame <= 24; frame++) {
        if (frame) sim.update(1 / 60, noDeliciaInput());
        if (![0, 6, 12, 24].includes(frame)) continue;
        const state = JSON.stringify(sim), canvas = createCanvas(960, 540);
        art.draw(canvas.getContext('2d'), sim, reduced);
        assert.equal(JSON.stringify(sim), state, 'Painting cannot advance camera or gameplay.');
        const key = `${reduced ? 'reduced' : 'normal'}-${version}-${frame}`;
        snapshots.set(key, canvas); writeFileSync(`${out}/${key}.png`, canvas.toBuffer('image/png'));
        report.push({ reduced, version, frame, cameraX: sim.cameraX, cameraY: sim.cameraY,
            screenLeft: sim.player.x - sim.cameraX, screenFeet: sim.player.y + sim.player.h - sim.cameraY,
            player: structuredClone(sim.player), checkpoint: sim.checkpoint });
    }
}
for (const frame of [0, 6, 12, 24]) {
    const pairs = report.filter(r => r.frame === frame);
    for (const row of pairs.slice(1)) assert.deepEqual(row.player, pairs[0].player, 'Camera-only changes preserve the trajectory.');
}
const sheet = createCanvas(1280, 862), c = sheet.getContext('2d');
c.fillStyle = '#202736'; c.fillRect(0, 0, 1280, 862); c.fillStyle = '#f3d7a4'; c.font = '20px ProofSans';
c.fillText('Delicia 11, checkpoint 3: native Canvas / production painter and assets', 16, 29);
c.font = '16px ProofSans'; c.fillText('Same saved checkpoint, no simulation warm-up. No browser/device QA.', 16, 55);
for (const [i, frame] of [0, 12].entries()) {
    const x = i * 640; c.fillText(`BEFORE: ${frame} frames after resume`, x + 12, 86);
    c.drawImage(snapshots.get(`normal-before-${frame}`), x, 98, 640, 360);
    c.fillText(`AFTER: ${frame} frames after resume`, x + 12, 486);
    c.drawImage(snapshots.get(`normal-after-${frame}`), x, 498, 640, 360);
}
writeFileSync(`${out}/checkpoint-before-after.png`, sheet.toBuffer('image/png'));
writeFileSync(`${out}/report.json`, JSON.stringify({ baseline, method: 'Native Canvas, production DeliciaSimulation, painter and assets. No browser/device QA.', records: report }, null, 2));
console.log(JSON.stringify({ out, images: snapshots.size, report }));
