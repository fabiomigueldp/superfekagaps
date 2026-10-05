/** Native production-Canvas evidence, not browser/device QA.
 * node --import tsx scripts/prove_juice_blocked_stomp.ts OUTPUT CANVAS_MODULE BASE_CHECKOUT
 * QA-only Canvas dependency stays outside the repository. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Canvas, juiceEpilogueBrowser, replayJuiceVictory, juiceSnapshot } from '../tests/helpers/juiceEpilogueHarness';
import { JuiceMinibossLab } from '../src/adventure/experimental/JuiceMinibossLab';
import { FactorySalonSession } from '../src/adventure/factory/FactorySalonSession';
import type { JuiceMinibossModel } from '../src/adventure/experimental/JuiceMinibossModel';

interface NativeCanvas {
    width: number; height: number;
    getContext(type: '2d'): CanvasRenderingContext2D;
    toBuffer(type: 'image/png'): Buffer;
}
const [outArg, canvasArg, baselineArg] = process.argv.slice(2);
assert.ok(outArg && canvasArg && baselineArg, 'Provide output, installed Canvas module and unchanged base checkout.');
const out = resolve(outArg), base = resolve(baselineArg);
const { createCanvas } = await import(pathToFileURL(resolve(canvasArg)).href) as { createCanvas(w: number, h: number): NativeCanvas };
const beforeLab = await import(pathToFileURL(join(base, 'src/adventure/experimental/JuiceMinibossLab.ts')).href) as { JuiceMinibossLab: typeof JuiceMinibossLab };
const beforeSalon = await import(pathToFileURL(join(base, 'src/adventure/factory/FactorySalonSession.ts')).href) as { FactorySalonSession: typeof FactorySalonSession };
for (const file of ['JuiceMinibossModel.ts', 'JuiceMonsterPainter.ts', 'JuiceArenaPainter.ts']) {
    const relative = `src/adventure/experimental/${file}`;
    assert.equal(readFileSync(relative, 'utf8'), readFileSync(join(base, relative), 'utf8'), `${file} must stay unchanged`);
}
mkdirSync(out, { recursive: true });
const surfaces = new WeakMap<object, NativeCanvas>(), contexts = new WeakMap<object, CanvasRenderingContext2D>();
Canvas.prototype.getContext = function () {
    if (contexts.has(this)) return contexts.get(this)!;
    const surface = createCanvas(this.width, this.height); surfaces.set(this, surface);
    for (const key of ['width', 'height'] as const) Object.defineProperty(this, key, {
        configurable: true, get: () => surface[key], set: (value: number) => { surface[key] = value; },
    });
    const ctx = surface.getContext('2d');
    const proxy = new Proxy(ctx, {
        get(target, key) {
            if (key === 'drawImage') return (source: object, ...args: unknown[]) =>
                (target.drawImage as (...args: unknown[]) => void)(surfaces.get(source) ?? source, ...args);
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
        set(target, key, value) { Reflect.set(target, key, value, target); return true; },
    });
    contexts.set(this, proxy); return proxy;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const reports: object[] = [];
for (const reduced of [false, true]) for (const embedded of [false, true]) {
    const mode = `${embedded ? 'factory' : 'lab'}-${reduced ? 'reduced' : 'normal'}`;
    const snapshots: string[][] = [], pairs = new Map<string, NativeCanvas[]>(), statuses: Array<Record<string, string>> = [];
    for (const [index, Game] of [
        embedded ? beforeSalon.FactorySalonSession : beforeLab.JuiceMinibossLab,
        embedded ? FactorySalonSession : JuiceMinibossLab,
    ].entries()) {
        const cleanups: Array<() => void> = [];
        const h = juiceEpilogueBrowser({ after: fn => { cleanups.push(fn as () => void); } }, reduced);
        h.window.innerWidth = 320; h.window.innerHeight = 220;
        const game = new Game(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
        game.skipIntro(); game.audio.enabled = false;
        const b = (game.boss as NonNullable<typeof game.boss> & { model: JuiceMinibossModel }).model;
        let frame = 0, openingAfter = -1;
        const messages: Record<string, string> = {};
        snapshots.push(replayJuiceVictory(h, game, () => {
            let sample = '';
            if (frame === 269 || frame === 768) { sample = `blocked-${frame}`; openingAfter = frame; }
            else if (openingAfter >= 0 && b.vulnerable) { sample = `opening-after-${openingAfter}`; openingAfter = -1; }
            else if (frame === 283 || frame === 789) sample = `hit-${frame}`;
            if (sample) {
                const before = juiceSnapshot(game); game.render();
                assert.equal(juiceSnapshot(game), before, 'Painting cannot alter the encounter or save.');
                const screen = surfaces.get(h.canvas)!;
                assert.equal(screen.width, 320, 'Proof includes compact 320px native presentation.');
                const image = createCanvas(320, 180);
                image.getContext('2d').drawImage(screen as unknown as CanvasImageSource, 0, 0);
                pairs.set(sample, [...(pairs.get(sample) ?? []), image]);
                writeFileSync(join(out, `${mode}-${sample}-${index ? 'after' : 'before'}.png`), image.toBuffer('image/png'));
                messages[sample] = h.status.textContent;
                if (sample.startsWith('blocked')) assert.equal(/Sem dano/.test(h.status.textContent), index === 1);
                if (sample.startsWith('opening')) assert.match(h.status.textContent, /Abertura!/);
            }
            frame++;
        }));
        statuses.push(messages);
        assert.deepEqual(h.storageCalls, []); game.dispose(); cleanups.forEach(fn => fn());
    }
    assert.deepEqual(snapshots[1], snapshots[0], 'Every native replay frame, player state, score, save and encounter must be identical.');
    assert.equal(pairs.size, 6);
    const sheet = createCanvas(640, pairs.size * 180), c = sheet.getContext('2d');
    let row = 0;
    const sampleReports: object[] = [];
    for (const [sample, [before, after]] of pairs) {
        const old = before.getContext('2d').getImageData(0, 0, 320, 180).data;
        const fresh = after.getContext('2d').getImageData(0, 0, 320, 180).data;
        let changed = 0;
        for (let p = 0; p < 320 * 180; p++) if ([0, 1, 2, 3].some(ch => old[p * 4 + ch] !== fresh[p * 4 + ch])) {
            changed++;
            assert.ok(Math.floor(p / 320) >= 14 && Math.floor(p / 320) < 33, 'Only the existing HUD hint rows change.');
        }
        assert.equal(changed > 0, sample.startsWith('blocked'), 'Opening and hit presentation remain exactly unchanged.');
        c.drawImage(before as unknown as CanvasImageSource, 0, row * 180);
        c.drawImage(after as unknown as CanvasImageSource, 320, row++ * 180);
        sampleReports.push({ sample, changedPixels: changed, beforeStatus: statuses[0][sample], afterStatus: statuses[1][sample] });
    }
    writeFileSync(join(out, `${mode}-before-left-after-right.png`), sheet.toBuffer('image/png'));
    reports.push({ mode, muted: true, width: 320, identicalNativeFrames: snapshots[0].length,
        replaySha256: hash(snapshots[0].join('\n')), samples: sampleReports });
}
writeFileSync(join(out, 'evidence.json'), JSON.stringify({ method: 'Native production Canvas renderer, Input, Player and encounters. Browser boundaries stubbed. Not browser/device/FPS QA.', reports }, null, 2));
console.log(JSON.stringify({ out, reports }, null, 2));
