/** Offline actual map/atlas painters and source-image masks. No browser/device QA.
 * WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/render_redesign_routes.mts OUTPUT
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { guairaCamera, paintGuairaMap, paintGuairaWaterFrame, guairaScreenPoint, GUAIRA_FEKA_PIXEL_WIDTH } from '../../src/adventure/experimental/guaira/GuairaMapArt';
import { parseGuairaMetadata } from '../../src/adventure/experimental/guaira/GuairaMapModel';
import { GuairaWaterMotion, GUAIRA_WATER_CONTRACT } from '../../src/adventure/experimental/guaira/GuairaWaterMotion';
import { performance } from 'node:perf_hooks';
import { GuairaChapterWater } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterWater';
import { GuairaChapterSession } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { freshGuairaChapterProgress, guairaChapterRoute } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import bairroData from '../../src/adventure/experimental/guaira/chapter/GuairaBairroWaterData.json';
const { createCanvas, loadImage } = createRequire(import.meta.url)(process.env.WATER_CANVAS_MODULE ?? '@napi-rs/canvas');
const root = resolve(import.meta.dirname, '../..'), out = resolve(process.argv[2] ?? '/tmp/guaira-redesign-native');
mkdirSync(out, { recursive: true });
const metadata = parseGuairaMetadata(JSON.parse(readFileSync(`${root}/public/assets/world/experimental/guaira/guaira-diorama.meta.json`, 'utf8')))!;
assert.ok(metadata);
const image = await loadImage(`${root}/public/assets/world/experimental/guaira/guaira-diorama.webp`);
const maskImage = await loadImage(`${root}/public/assets/world/experimental/guaira/guaira-water-mask.png`);
const effect = new GuairaWaterMotion(maskImage, GUAIRA_WATER_CONTRACT, createCanvas(1, 1));
const points = [...Object.entries(metadata.nodes), ...Object.entries(metadata.routes).map(([key, route]) => {
    const index = Math.floor((route.length - 1) / 2), a = route[index], b = route[index + 1];
    return [`route-${key}`, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }] as const;
})];
/** Narrow native-backend allowance, explicitly not general image tolerance.
 * Only 1–2 pixels intersecting the antialiased shadow boundary may differ by
 * at most two RGB levels. Alpha, body, scenery and water remain exact.
 */
function compareFrames(full, partial, width, height, camera, actor) {
    const a = full.getContext('2d').getImageData(0, 0, width, height).data;
    const b = partial.getContext('2d').getImageData(0, 0, width, height).data;
    const p = guairaScreenPoint(actor.point, camera), scale = camera.imageWidth * GUAIRA_FEKA_PIXEL_WIDTH;
    const cx = p.x, cy = p.y - 1, rx = scale * 8, ry = scale * 2.6;
    const differences = []; let maxRGBDelta = 0;
    for (let i = 0; i < a.length; i += 4) {
        assert.equal(a[i + 3], b[i + 3], 'Alpha must remain exact');
        const delta = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (!delta) continue;
        const x = (i / 4) % width, y = Math.floor(i / 4 / width);
        const nearestX = Math.max(x, Math.min(x + 1, cx)), nearestY = Math.max(y, Math.min(y + 1, cy));
        const farX = Math.max(Math.abs(x - cx), Math.abs(x + 1 - cx)), farY = Math.max(Math.abs(y - cy), Math.abs(y + 1 - cy));
        // Include a 0.03px numerical fringe around the ellipse boundary only.
        const touchesOuter = ((nearestX - cx) / (rx + .03)) ** 2 + ((nearestY - cy) / (ry + .03)) ** 2 <= 1;
        const touchesInner = (farX / (rx - .03)) ** 2 + (farY / (ry - .03)) ** 2 >= 1;
        assert.ok(delta <= 2 && touchesOuter && touchesInner, `Non-shadow mismatch at ${x},${y}, RGB delta ${delta}`);
        differences.push({ x, y, delta }); maxRGBDelta = Math.max(maxRGBDelta, delta);
    }
    assert.ok(differences.length <= 2, `Unexpected growing error: ${differences.length} pixels`);
    return { exact: differences.length === 0, shadowEdgePixels: differences, maxRGBDelta, alphaExact: true, allOtherPixelsExact: true };
}
const report = [];
for (const [width, height] of [[390, 500], [1280, 800]]) for (const [label, point] of points) for (const reducedMotion of [false, true]) {
    const camera = guairaCamera(metadata, width, height, point, false);
    const actor = { point, moving: false, facingLeft: label.includes('3'), reducedMotion };
    const full = createCanvas(width, height), partial = createCanvas(width, height);
    const before = JSON.stringify({ metadata, actor });
    paintGuairaMap(full.getContext('2d'), image, camera, actor, 0, { effect, seconds: 1.25 });
    paintGuairaMap(partial.getContext('2d'), image, camera, actor, 0, { effect, seconds: 0 });
    paintGuairaWaterFrame(partial.getContext('2d'), image, camera, actor, 0, { effect, seconds: 1.25 });
    const comparison = compareFrames(full, partial, width, height, camera, actor);
    assert.equal(JSON.stringify({ metadata, actor }), before, 'Painter must not change navigation');
    if (!reducedMotion) writeFileSync(`${out}/chapter-${width}-${label.replace(':', '-')}.png`, full.toBuffer('image/png'));
    report.push({ width, height, label, reducedMotion, partialFrameEqualsFull: comparison.exact, comparison, navigationUnchanged: true });
}
// Exercise the real chapter composition with locked and durable accepted receipts.
// Native completion acceptance itself remains covered by guaira-chapter-water tests.
const villageCases = [];
for (const [width, height] of [[390, 500], [1280, 800]]) for (const reducedMotion of [false, true]) for (const released of [false, true]) {
    const progress = freshGuairaChapterProgress();
    if (released) progress.completed = guairaChapterRoute(progress.opening);
    const session = new GuairaChapterSession({ progress }), water = new GuairaChapterWater();
    water.setIrrigation(effect); water.update(session.snapshot()); assert.equal(water.released, released);
    const point = metadata.nodes['guaira-2'], camera = guairaCamera(metadata, width, height, point, false);
    const actor = { point, moving: false, facingLeft: false, reducedMotion };
    const full = createCanvas(width, height), partial = createCanvas(width, height);
    const before = JSON.stringify(session.snapshot());
    paintGuairaMap(full.getContext('2d'), image, camera, actor, 0, { effect: water, seconds: 1.25 });
    paintGuairaMap(partial.getContext('2d'), image, camera, actor, 0, { effect: water, seconds: 0 });
    paintGuairaWaterFrame(partial.getContext('2d'), image, camera, actor, 0, { effect: water, seconds: 1.25 });
    const comparison = compareFrames(full, partial, width, height, camera, actor);
    assert.equal(JSON.stringify(session.snapshot()), before);
    if (!reducedMotion) {
        const label = released ? 'released' : 'locked';
        writeFileSync(`${out}/village-${width}-${label}.png`, full.toBuffer('image/png'));
        // Exact source-painter detail is enlarged only for inspection, never runtime.
        const native = createCanvas(1920, 1200), nc = native.getContext('2d');
        paintGuairaMap(nc, image, { width: 1920, height: 1200, x: 0, y: 0, imageWidth: 1920 }, actor, 0, { effect: water, seconds: 1.25 });
        const [x, y, w, h] = bairroData.bounds, detail = createCanvas((w + 28) * 5, (h + 28) * 5);
        detail.getContext('2d').drawImage(native, x - 14, y - 14, w + 28, h + 28, 0, 0, detail.width, detail.height);
        writeFileSync(`${out}/receiver-${label}-detail.png`, detail.toBuffer('image/png'));
    }
    villageCases.push({ width, height, reducedMotion, released, partialFrameEqualsFull: comparison.exact, comparison, acceptedReceiptsUnchanged: true });
}
// Repeated real partial redraws must not accumulate edge errors or leave trails.
const repeatedCases = [];
for (const label of ['guaira-1', 'route-2:3']) for (const reducedMotion of [false, true]) {
    const width = 390, height = 500, point = points.find(([name]) => name === label)![1];
    const camera = guairaCamera(metadata, width, height, point, false), actor = { point, moving: false, facingLeft: label.includes('3'), reducedMotion };
    const full = createCanvas(width, height), partial = createCanvas(width, height), mismatchedLocations = new Set<string>();
    paintGuairaMap(partial.getContext('2d'), image, camera, actor, 0, { effect, seconds: 0 });
    let maxPixels = 0, maxRGBDelta = 0;
    for (let frame = 1; frame <= 100; frame++) {
        const seconds = frame / 30;
        paintGuairaWaterFrame(partial.getContext('2d'), image, camera, actor, 0, { effect, seconds });
        paintGuairaMap(full.getContext('2d'), image, camera, actor, 0, { effect, seconds });
        const comparison = compareFrames(full, partial, width, height, camera, actor);
        maxPixels = Math.max(maxPixels, comparison.shadowEdgePixels.length); maxRGBDelta = Math.max(maxRGBDelta, comparison.maxRGBDelta);
        for (const p of comparison.shadowEdgePixels) mismatchedLocations.add(`${p.x},${p.y}`);
    }
    assert.ok(mismatchedLocations.size <= 2, 'No expanding trail or drifting error footprint');
    repeatedCases.push({ label, facingLeft: actor.facingLeft, reducedMotion, consecutiveFrames: 100, maxPixels, maxRGBDelta, mismatchedLocations: [...mismatchedLocations], alphaAndAllOtherPixelsExact: true });
}
// At source-image scale every animated irrigation pixel must remain in visible water.
const raw = createCanvas(1920, 1200), rawMask = createCanvas(1920, 1200);
effect.draw(raw.getContext('2d'), { x: 0, y: 0, imageWidth: 1920 }, 1.25);
for (const { bounds: [x, y, w, h], atlas: [ax, ay] } of GUAIRA_WATER_CONTRACT.regions) rawMask.getContext('2d').drawImage(maskImage, ax, ay, w, h, x, y, w, h);
const drawPixels = raw.getContext('2d').getImageData(0, 0, 1920, 1200).data;
const maskPixels = rawMask.getContext('2d').getImageData(0, 0, 1920, 1200).data;
let active = 0, escaped = 0;
for (let i = 3; i < drawPixels.length; i += 4) if (drawPixels[i]) { active++; if (!maskPixels[i]) escaped++; }
assert.ok(active > 0); assert.equal(escaped, 0);
const times = [], timing = createCanvas(1280, 800).getContext('2d');
for (let i = 0; i < 120; i++) { const start = performance.now(); effect.draw(timing, { x: 0, y: 0, imageWidth: 1280 }, i / 30); times.push(performance.now() - start); }
times.sort((a, b) => a - b);
const result = { method: 'Actual Guaira map painter, actor frames, camera, masks and partial redraw in native Canvas; not browser/device FPS', cases: report.length, routeFrames: report, villageCases, repeatedCases, shadowEdgeTolerance: { maxPixelsPerFrame: 2, maxRGBDelta: 2, boundaryFringePixels: .03, reason: 'Native Canvas compound-clip ellipse antialiasing only; alpha, body, scenery, water and all other pixels exact' }, activeEffectPixels: active, escapedEffectPixels: escaped,
    scratchSize: [effect.canvas.width, effect.canvas.height], estimatedAtlasAndScratchBytes: (GUAIRA_WATER_CONTRACT.atlasSize[0] * GUAIRA_WATER_CONTRACT.atlasSize[1] + effect.canvas.width * effect.canvas.height) * 4,
    nativeCanvasWaterMedianMs: times[60], nativeCanvasWaterP95Ms: times[114] };
writeFileSync(`${out}/chapter-report.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
