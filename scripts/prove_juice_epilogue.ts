/** Offline renderer proof, NOT browser/device footage.
 * EPILOGUE_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx scripts/prove_juice_epilogue.ts /tmp/proof
 * QA-only Canvas dependency is installed outside the repository. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Canvas, juiceEpilogueBrowser, replayJuiceVictory, juiceSnapshot, STEP } from '../tests/helpers/juiceEpilogueHarness';
import { JuiceEpilogue } from '../src/adventure/experimental/JuiceEpilogue';
import { drawJuiceEpilogue } from '../src/adventure/experimental/JuiceEpilogueArt';

const require = createRequire(import.meta.url);
const { createCanvas } = require(process.env.EPILOGUE_CANVAS_MODULE ?? '@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '/tmp/juice-epilogue-proof');
mkdirSync(out, { recursive: true });
mkdirSync(out + '/frames', { recursive: true });
const surfaces = new WeakMap<object, any>(), contexts = new WeakMap<object, CanvasRenderingContext2D>();
Canvas.prototype.getContext = function () {
    if (contexts.has(this)) return contexts.get(this)!;
    const surface = createCanvas(this.width, this.height); surfaces.set(this, surface);
    for (const key of ['width', 'height']) Object.defineProperty(this, key, {
        configurable: true, get: () => surface[key], set: value => { surface[key] = value; },
    });
    const ctx = surface.getContext('2d');
    const proxy = new Proxy(ctx, {
        get: (target, key) => key === 'drawImage'
            ? (source: object, ...args: unknown[]) => target.drawImage(surfaces.get(source) ?? source, ...args)
            : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
        set: (target, key, value) => { target[key] = value; return true; },
    });
    contexts.set(this, proxy); return proxy;
};
const rows: any[][] = [], reports: object[] = [];
let nativeDigest = '';
for (const reduced of [false, true]) {
    const cleanups: Array<() => void> = [];
    const h = juiceEpilogueBrowser({ after: fn => { cleanups.push(fn as () => void); } }, reduced);
    const game = h.create(), epilogue = new JuiceEpilogue(game);
    const snapshots = replayJuiceVictory(h, game, () => epilogue.update(STEP));
    // The native constructor deliberately stores shake=false for reduced motion.
    // Normalize only that expected presentation preference for cross-mode comparison.
    const comparable = snapshots.map(snapshot => {
        const value = JSON.parse(snapshot); value.save.preferences.shake = false;
        return JSON.stringify(value);
    });
    const digest = createHash('sha256').update(comparable.join('\n')).digest('hex');
    if (nativeDigest) assert.equal(digest, nativeDigest, 'motion preference cannot change the native victory');
    nativeDigest = digest;
    let landingFrames = 0;
    while (!epilogue.frame && landingFrames++ < 120) { game.update(STEP); epilogue.update(STEP); }
    assert.ok(epilogue.frame);
    function capture() {
        const before = juiceSnapshot(game), frame = epilogue.frame!;
        const story = JSON.stringify(frame);
        game.renderer.startScene(1);
        drawJuiceEpilogue(game.renderer.getContext(), frame, reduced);
        game.renderer.present();
        assert.equal(juiceSnapshot(game), before, 'renderer proof must preserve simulation');
        assert.equal(JSON.stringify(epilogue.frame), story, 'painting cannot consume story time');
        const image = createCanvas(320, 180), c = image.getContext('2d');
        c.imageSmoothingEnabled = false; c.drawImage(surfaces.get(h.canvas), 0, 0, 320, 180);
        return image;
    }
    game.render();
    writeFileSync(`${out}/native-victory-${reduced ? 'reduced' : 'normal'}.png`, surfaces.get(h.canvas).toBuffer('image/png'));
    const row: any[] = [];
    const selected = new Set([400, 1400, 3000, 5000, 6400]);
    let lastBeat = '', stableReduced: Buffer | null = null;
    for (let frameIndex = 0; frameIndex <= 384; frameIndex++) {
        const image = capture(), frame = epilogue.frame!;
        // First paint and repeated paint are always identical, even in normal motion.
        assert.deepEqual(image.data(), capture().data());
        if (reduced) {
            if (frame.beat === lastBeat) assert.deepEqual(image.data(), stableReduced, 'reduced-motion beat must stay still');
            stableReduced = image.data(); lastBeat = frame.beat;
        } else writeFileSync(`${out}/frames/${String(frameIndex).padStart(4, '0')}.png`, image.toBuffer('image/png'));
        const nearest = Math.round(frame.timeMs);
        if (selected.has(nearest)) {
            row.push(image);
            writeFileSync(`${out}/${reduced ? 'reduced' : 'normal'}-${nearest}-${frame.beat}.png`, image.toBuffer('image/png'));
        }
        epilogue.update(STEP);
    }
    // Fractional 60Hz sums can land just below the boundary; finish that tick.
    epilogue.update(STEP);
    assert.equal(epilogue.frame!.beat, 'complete');
    const final = capture();
    if (row.length < 5) row.push(final);
    assert.equal(row.length, 5, 'all five storyboard samples are present');
    const skip = new JuiceEpilogue(game); skip.update(STEP); assert.equal(skip.skip(), true);
    assert.deepEqual(skip.frame, epilogue.frame, 'skip and elapsed completion share the exact final frame');
    rows.push(row);
    reports.push({ reducedMotion: reduced, nativeVictoryFrames: snapshots.length, nativeDigest: digest, digestNormalization: 'save.preferences.shake=false only',
        landingFrames, nativeHits: 6, final: epilogue.frame, simulationUnchangedByPaint: true,
        reducedMotionStaticWithinBeat: reduced, skipMatchesNaturalCompletion: true });
    epilogue.dispose(); skip.dispose(); game.dispose();
    for (const cleanup of cleanups) cleanup();
}
const sheet = createCanvas(1600, 360), c = sheet.getContext('2d');
c.imageSmoothingEnabled = false;
rows.forEach((row, y) => row.forEach((image, x) => c.drawImage(image, x * 320, y * 180)));
writeFileSync(out + '/contact-sheet.png', sheet.toBuffer('image/png'));
writeFileSync(out + '/evidence.json', JSON.stringify({ method: 'Offline production Renderer and painters; native Input/Player victory; browser boundaries stubbed. Not integrated page or browser QA.', reports }, null, 2));
console.log(JSON.stringify({ out, reports }));
