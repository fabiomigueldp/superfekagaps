/** Actual atlas renderer proof. Requires optional @napi-rs/canvas via WATER_CANVAS_MODULE. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { paintWorldAtlas } from '../../src/adventure/WorldAtlasArt';
import { campaignArtOverlay } from '../../src/adventure/GuairaCampaignArt';
import { campaignWaterOverlay } from '../../src/adventure/GuairaCampaignConsequences';
import { freshSave } from '../../src/adventure/progress';
import { guairaChapterRoute } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
const { createCanvas, loadImage } = createRequire(import.meta.url)(process.env.WATER_CANVAS_MODULE ?? '@napi-rs/canvas');
const root = resolve(import.meta.dirname, '../..'), out = resolve(process.argv[2] ?? `${root}/docs/world/diorama/guaira-campaign/water-outcome`);
mkdirSync(out, { recursive: true });
const image = await loadImage(`${root}/public/assets/world/map/guaira-campaign/guaira.webp`);
const waterImage = await loadImage(`${root}/public/assets/world/map/guaira-campaign/guaira-water-restored.webp`);
const save = freshSave(), initial = JSON.stringify(save);
const render = (width: number, height: number, restored: boolean, reducedMotion: boolean) => {
    const canvas = createCanvas(width, height), c = canvas.getContext('2d');
    const state = structuredClone(save); if (restored) state.guaira.completed = guairaChapterRoute(state.guaira.opening);
    const water = campaignWaterOverlay(state, waterImage);
    paintWorldAtlas(c, { camera: { width, height, center: { x: 4.21, y: .67 }, zoom: width === 390 ? 1.0 : 1.1 },
        time: 0, reducedMotion, islands: [], connections: [campaignArtOverlay('guaira', image), ...(water ? [water] : [])],
        actor: { point: { x: 0, y: 0 }, walking: false, facingLeft: false, aboard: false, visible: false } });
    return canvas;
};
const report = [];
for (const [width, height] of [[1280, 800], [390, 540], [640, 360]]) {
    for (const reducedMotion of [false, true]) {
        const before = render(width, height, false, reducedMotion), after = render(width, height, true, reducedMotion);
        const a = before.getContext('2d').getImageData(0, 0, width, height).data, b = after.getContext('2d').getImageData(0, 0, width, height).data;
        let changed = 0;
        for (let i = 0; i < a.length; i += 4) if ([0, 1, 2, 3].some(k => a[i+k] !== b[i+k])) changed++;
        assert.ok(changed > 0); assert.ok(changed < width * height * .002, 'water must remain a restrained local cue');
        const key = `${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}`;
        writeFileSync(`${out}/${key}-before.png`, before.toBuffer('image/png')); writeFileSync(`${out}/${key}-after.png`, after.toBuffer('image/png'));
        report.push({ width, height, reducedMotion, changedPixels: changed });
    }
}
assert.equal(JSON.stringify(save), initial);
// Source-scale crop makes the exact earned change reviewable without oversized runtime art.
const detail = createCanvas(900, 250), c = detail.getContext('2d');
for (let i = 0; i < 2; i++) {
    const source = createCanvas(1920, 1200), s = source.getContext('2d'); s.drawImage(image, 0, 0); if (i) s.drawImage(waterImage, 0, 0);
    c.fillStyle = '#173d47'; c.fillRect(i * 450, 0, 450, 250);
    c.drawImage(source, 962, 593, 110, 100, i * 450 + 50, 30, 220, 200);
    c.drawImage(source, 1350, 729, 60, 65, i * 450 + 280, 65, 120, 130);
}
writeFileSync(`${out}/trough-and-channel-before-after.png`, detail.toBuffer('image/png'));
writeFileSync(`${out}/report.json`, JSON.stringify({ renderer: 'paintWorldAtlas', originalSaveUnchanged: true, proof: report }, null, 2) + '\n');
console.log(JSON.stringify(report));
