/** Offline native Canvas proof; presentation fixtures, not browser/device QA or a campaign replay.
 * node --import tsx scripts/prove_guaira_chapter_water.ts OUTPUT /path/to/@napi-rs/canvas/index.js
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GuairaChapterWater } from '../src/adventure/experimental/guaira/chapter/GuairaChapterWater';
import { GuairaChapterSession } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { guairaCamera, guairaScreenPoint, paintGuairaMap, paintGuairaWaterFrame, GUAIRA_FEKA_PIXEL_WIDTH, type GuairaCamera, type GuairaMapActor } from '../src/adventure/experimental/guaira/GuairaMapArt';
import { GUAIRA_WATER_CONTRACT, GuairaWaterMotion } from '../src/adventure/experimental/guaira/GuairaWaterMotion';
import { PLAYER_PALETTE, PLAYER_SPRITES } from '../src/assets/playerSpriteSpec';
import data from '../src/adventure/experimental/guaira/chapter/GuairaBairroWaterData.json';

interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const output = resolve(process.argv[2] ?? '/tmp/guaira-chapter-water-proof');
const modulePath = process.argv[3]; assert.ok(modulePath, 'Provide an installed native Canvas module path');
const { createCanvas, loadImage } = await import(pathToFileURL(resolve(modulePath)).href) as {
    createCanvas(width: number, height: number): NativeCanvas; loadImage(path: string): Promise<CanvasImageSource>;
};
mkdirSync(output, { recursive: true });
const base = 'public/assets/world/experimental/guaira/';
const [image, atlas] = await Promise.all([loadImage(`${base}guaira-diorama.webp`), loadImage(`${base}guaira-water-mask.png`)]);
const metadata = JSON.parse(readFileSync(`${base}guaira-diorama.meta.json`, 'utf8'));
const session = new GuairaChapterSession();
for (const sceneId of session.snapshot().route) {
    const attempt = session.enterScene(sceneId, session.snapshot().generation)!;
    const result = sceneId === 'guaira-lab' ? { sceneId, kind: 'defeated-bull' } as const
        : sceneId === 'guaira-prefeito' ? { sceneId, kind: 'mayor-water-released' } as const : { sceneId, kind: 'reached-finish' } as const;
    session.continueFrom(attempt, { attempt, alive: true, state: 'playing', result });
}
const pixels = (canvas: NativeCanvas) => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
function differences(a: Uint8ClampedArray, b: Uint8ClampedArray, mask?: Uint8ClampedArray) {
    let changed = 0, escaped = 0;
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) {
        changed++; if (mask && mask[i + 3] === 0) escaped++;
    }
    return { changed, escaped };
}
const cases: unknown[] = [];
for (const [name, width, height, ratio] of [['desktop', 1000, 560, 1], ['phone', 320, 420, 1], ['landscape', 568, 210, 1], ['phone-dpr2', 320, 420, 2]] as const) {
    const actor: GuairaMapActor = { point: metadata.nodes['guaira-2'], moving: false, reducedMotion: false, facingLeft: false };
    const camera = guairaCamera(metadata, width, height, actor.point, false);
    function surface() { const canvas = createCanvas(width * ratio, height * ratio); canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0); return canvas; }
    function render(effect: GuairaChapterWater, seconds: number, model = actor, view = camera) {
        const canvas = surface(); paintGuairaMap(canvas.getContext('2d'), image, view, model, 0, { effect, seconds }); return canvas;
    }
    for (const irrigation of [false, true]) {
        const wet = new GuairaChapterWater(), dry = new GuairaChapterWater();
        if (irrigation) for (const effect of [wet, dry]) effect.setIrrigation(new GuairaWaterMotion(atlas, GUAIRA_WATER_CONTRACT, createCanvas(1, 1) as unknown as HTMLCanvasElement));
        wet.update(session.snapshot());
        const full = render(wet, 2.3), partial = render(wet, .2);
        assert.equal(differences(pixels(full), pixels(render(wet, 2.3))).changed, 0, 'repeat full is deterministic');
        paintGuairaWaterFrame(partial.getContext('2d'), image, camera, actor, 0, { effect: wet, seconds: 2.3 });
        const fullPixels = pixels(full), partialPixels = pixels(partial);
        const mismatch = [];
        for (let i = 0; i < fullPixels.length; i += 4) if (fullPixels.slice(i, i + 4).some((value, n) => value !== partialPixels[i + n])) mismatch.push({ x: (i / 4) % full.width, y: Math.floor(i / 4 / full.width), full: [...fullPixels.slice(i, i + 4)], partial: [...partialPixels.slice(i, i + 4)] });
        assert.equal(mismatch.length, 0, `${name}/${irrigation}: same-frame full/partial equality: ${JSON.stringify(mismatch.slice(0, 12))}`);
        const mask = surface(), m = mask.getContext('2d'), scale = camera.imageWidth / 1920;
        m.translate(camera.x, camera.y); m.scale(scale, scale); m.fillStyle = '#fff';
        for (const polygon of [data.bowl, data.fall]) {
            m.beginPath(); m.moveTo(polygon[0][0], polygon[0][1]); for (const p of polygon.slice(1)) m.lineTo(p[0], p[1]); m.closePath(); m.fill();
        }
        const delta = differences(pixels(render(dry, 2.3)), pixels(full), pixels(mask));
        assert.equal(delta.escaped, 0, `${name}/${irrigation}: all water stays within exported bowl/fall`);
        assert.ok(delta.changed > 0, `${name}: authored payoff is visible at the existing camera`);
        const reduced = { ...actor, reducedMotion: true };
        assert.equal(differences(pixels(render(wet, 0, reduced)), pixels(render(wet, 900, reduced))).changed, 0);
        const animated = differences(pixels(render(wet, 0)), pixels(render(wet, 2.3))).changed;
        assert.ok(animated > 0);
        cases.push({ name, irrigation, ratio, wetPixels: delta.changed, escapedPixels: delta.escaped, fullPartialDifference: 0, reducedMotionDifference: 0, animatedPixels: animated });
        if (irrigation) {
            writeFileSync(join(output, `${name}-dry.png`), render(dry, 1.25, reduced).toBuffer('image/png'));
            writeFileSync(join(output, `${name}-wet.png`), render(wet, 1.25, reduced).toBuffer('image/png'));
        }
    }
}
// Deliberate painter overlap fixture, not a possible route or art-clearance claim.
const overlap: GuairaCamera = { x: 0, y: 0, imageWidth: 1920, width: 1920, height: 1200 };
const [bx, by, bw, bh] = data.bounds;
const actor: GuairaMapActor = { point: { x: (bx + bw / 2) / 1920, y: (by + bh * .8) / 1200 }, moving: false, facingLeft: false, reducedMotion: true };
const wet = new GuairaChapterWater(); wet.update(session.snapshot());
const a = createCanvas(1920, 1200), b = createCanvas(1920, 1200), actorMask = createCanvas(1920, 1200);
paintGuairaMap(a.getContext('2d'), image, overlap, actor, 0);
paintGuairaMap(b.getContext('2d'), image, overlap, actor, 0, { effect: wet, seconds: 1.25 });
const p = guairaScreenPoint(actor.point, overlap), scale = overlap.imageWidth * GUAIRA_FEKA_PIXEL_WIDTH, maskContext = actorMask.getContext('2d');
for (let row = 0; row < PLAYER_SPRITES.idle.length; row++) for (let col = 0; col < PLAYER_SPRITES.idle[row].length; col++) {
    if (!PLAYER_PALETTE[PLAYER_SPRITES.idle[row][col]]) continue;
    maskContext.fillRect(Math.round(p.x - 8 * scale + col * scale), Math.round(p.y - PLAYER_SPRITES.idle.length * scale + row * scale), Math.ceil(scale), Math.ceil(scale));
}
const before = pixels(a), after = pixels(b), mask = pixels(actorMask);
let actorPixels = 0;
for (let i = 0; i < mask.length; i += 4) if (mask[i + 3] === 255) {
    actorPixels++; assert.deepEqual(after.slice(i, i + 4), before.slice(i, i + 4), 'opaque Feka sprite is painted last');
}
const report = { kind: 'offline-native-canvas', browserQA: false, presentationFixture: true, geometry: data, runtimeExtraCanvasCount: 0, runtimeVectorBytes: Buffer.byteLength(JSON.stringify(data)), actorOverlapPixels: actorPixels, cases };
writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
