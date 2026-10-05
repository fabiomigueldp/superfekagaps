/** Local-only actual Canvas/atlas proof. No browser/device or gameplay claims.
 * WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/render_campaign_water_motion.mts OUTPUT
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { paintWorldAtlas } from '../../src/adventure/WorldAtlasArt';
import { campaignArtOverlay, campaignArtBounds } from '../../src/adventure/GuairaCampaignArt';
import { campaignWaterOverlay } from '../../src/adventure/GuairaCampaignConsequences';
import { GuairaCampaignWaterMotion, GUAIRA_CAMPAIGN_WATER_PATCHES } from '../../src/adventure/GuairaCampaignWaterMotion';
import { freshSave } from '../../src/adventure/progress';
const { createCanvas, loadImage } = createRequire(import.meta.url)(process.env.WATER_CANVAS_MODULE ?? '@napi-rs/canvas');
const root = resolve(import.meta.dirname, '../..'), out = resolve(process.argv[2] ?? '/tmp/guaira-campaign-water-motion');
mkdirSync(out, { recursive: true });
const image = await loadImage(`${root}/public/assets/world/map/guaira-campaign/guaira.webp`);
const waterImage = await loadImage(`${root}/public/assets/world/map/guaira-campaign/guaira-water-restored.webp`);
const save = freshSave(); save.guaira.completed = ['guaira-prefeito'];
const water = campaignWaterOverlay(save, waterImage)!;
const bounds = campaignArtBounds('guaira');
let allocations = 0;
const effect = new GuairaCampaignWaterMotion(waterImage, () => { allocations++; return createCanvas(1, 1); });
const camera = (width: number, height: number, native = false) => ({ width, height,
    center: native ? { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 } : { x: 4.21, y: .67 },
    zoom: native ? 1 / (bounds.right - bounds.left) : width === 390 ? 1 : 1.1 });
function render(width: number, height: number, seconds: number, mode: 'before' | 'after' | 'reduced' | 'unearned', native = false) {
    const canvas = createCanvas(width, height), c = canvas.getContext('2d'), view = camera(width, height, native);
    const reducedMotion = mode === 'reduced', restored = mode !== 'unearned';
    paintWorldAtlas(c, { camera: view, time: 0, reducedMotion: true, islands: [],
        connections: [campaignArtOverlay('guaira', image), ...(restored ? [water] : []),
            ...(mode === 'before' ? [] : effect.overlays(restored, view, seconds, reducedMotion))],
        actor: { point: { x: 0, y: 0 }, walking: false, facingLeft: false, aboard: false, visible: false } });
    return canvas;
}
const pixels = (canvas: any) => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
function diff(a: any, b: any, mask?: any) {
    const p = pixels(a), q = pixels(b), m = mask && pixels(mask); let changed = 0, escaped = 0;
    for (let i = 0; i < p.length; i += 4) if ([0, 1, 2, 3].some(k => p[i + k] !== q[i + k])) {
        changed++; if (m && !m[i + 3]) escaped++;
    }
    return { changed, escaped };
}
const report: unknown[] = [];
for (const [width, height, native] of [[1920, 1200, true], [1280, 800, false], [390, 540, false], [640, 360, false]] as const) {
    const before = render(width, height, 0, 'before', native), a = render(width, height, 1.2, 'after', native), b = render(width, height, 3.6, 'after', native);
    const mask = createCanvas(width, height), c = mask.getContext('2d'), view = camera(width, height, native);
    const base = Math.min(width / 1.6, height), k = base * view.zoom;
    c.drawImage(waterImage, width / 2 + (bounds.left - view.center.x) * k * 1.6,
        height / 2 + (bounds.top - view.center.y) * k, (bounds.right - bounds.left) * k * 1.6, (bounds.bottom - bounds.top) * k);
    const motion = diff(a, b, mask), delta = diff(before, a, mask);
    assert.ok(motion.changed > 0); assert.equal(motion.escaped, 0); assert.equal(delta.escaped, 0);
    assert.ok(delta.changed < width * height * .0005);
    assert.equal(diff(a, render(width, height, 1.2, 'after', native)).changed, 0);
    assert.equal(diff(before, render(width, height, 800, 'reduced', native)).changed, 0);
    assert.equal(diff(render(width, height, 1, 'unearned', native), render(width, height, 900, 'unearned', native)).changed, 0);
    const prefix = `${width}x${height}`;
    writeFileSync(`${out}/${prefix}-before.png`, before.toBuffer('image/png'));
    writeFileSync(`${out}/${prefix}-after.png`, a.toBuffer('image/png'));
    writeFileSync(`${out}/${prefix}-later.png`, b.toBuffer('image/png'));
    report.push({ width, height, changedFromStatic: delta.changed, movingPixels: motion.changed, escapedPixels: motion.escaped,
        deterministicMismatch: 0, reducedMotionMismatch: 0, unearnedMismatch: 0 });
}
// Enlarged inspection only: crop actual native renderer frames, never new art.
const contact = createCanvas(900, 300), c = contact.getContext('2d');
for (let i = 0; i < 3; i++) {
    const source = render(1920, 1200, i === 1 ? 1.2 : 3.6, i === 0 ? 'before' : 'after', true);
    const [x, y, w, h] = GUAIRA_CAMPAIGN_WATER_PATCHES[0];
    c.drawImage(source, x - 8, y - 8, w + 16, h + 16, i * 300, 0, 300, 249);
    for (let j = 1; j <= 2 && j < GUAIRA_CAMPAIGN_WATER_PATCHES.length; j++) {
        const [gx, gy, gw, gh] = GUAIRA_CAMPAIGN_WATER_PATCHES[j];
        c.drawImage(source, gx - 2, gy - 2, gw + 4, gh + 4, i * 300 + 12 + (j - 1) * 150, 249, 126, 51);
    }
}
writeFileSync(`${out}/native-water-details-before-after-later.png`, contact.toBuffer('image/png'));
const timings = [];
for (let i = 0; i < 600; i++) { const start = performance.now(); effect.overlays(true, camera(1280, 800), i / 60, false); timings.push(performance.now() - start); }
timings.sort((a, b) => a - b);
const result = { proof: 'actual paintWorldAtlas, native Canvas; no browser/device FPS claim', cases: report, allocations,
    scratchPixels: GUAIRA_CAMPAIGN_WATER_PATCHES.reduce((sum, [, , w, h]) => sum + w * h, 0), detailPaintMedianMs: timings[300], detailPaintP95Ms: timings[570], newAssets: 0 };
writeFileSync(`${out}/report.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
// Optional review frames are enlarged crops of the real renderer, not runtime zoom.
if (process.argv.includes('--motion-frames')) {
    mkdirSync(`${out}/frames`, { recursive: true });
    for (let i = 0; i < 120; i++) {
        const source = render(1920, 1200, i / 20, 'after', true), frame = createCanvas(720, 300), c = frame.getContext('2d');
        c.fillStyle = '#173d47'; c.fillRect(0, 0, 720, 300);
        c.drawImage(source, 985, 602, 70, 58, 0, 0, 350, 290);
        c.drawImage(source, 1367, 748, 36, 28, 374, 38, 324, 252);
        c.font = '14px sans-serif'; c.fillStyle = '#e4efde';
        c.fillText('Native Canvas details, enlarged for review', 368, 24);
        writeFileSync(`${out}/frames/${String(i).padStart(3, '0')}.png`, frame.toBuffer('image/png'));
    }
}
