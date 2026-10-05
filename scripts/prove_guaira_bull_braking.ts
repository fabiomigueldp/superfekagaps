/** Actual production-Canvas before/after, driven by the unchanged encounter clock.
 * node --import tsx scripts/prove_guaira_bull_braking.ts OUTPUT CANVAS_MODULE BASE_CHECKOUT
 * Offline raster evidence, not browser/device/FPS QA. No installs or network.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BULL_RULES as R, SkeletonBullModel } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import * as afterArt from '../src/adventure/experimental/guaira/GuairaLabArt';
import { drawSkeletonBull as afterActor } from '../src/adventure/experimental/guaira/SkeletonBullArt';
import { GuairaBullEncounter } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import replay from '../tests/helpers/guairaLabReplay.json';

interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const [outputArg, canvasArg, baselineArg] = process.argv.slice(2);
assert.ok(outputArg && canvasArg && baselineArg, 'Provide output, installed native Canvas module, and unchanged base checkout.');
const output = resolve(outputArg), base = resolve(baselineArg);
const { createCanvas } = await import(pathToFileURL(resolve(canvasArg)).href) as { createCanvas(w: number, h: number): NativeCanvas };
const artPath = 'src/adventure/experimental/guaira/GuairaLabArt.ts';
const actorPath = 'src/adventure/experimental/guaira/SkeletonBullArt.ts';
const beforeArt = await import(pathToFileURL(join(base, artPath)).href) as typeof afterArt;
const { drawSkeletonBull: beforeActor } = await import(pathToFileURL(join(base, actorPath)).href) as { drawSkeletonBull: typeof afterActor };
const unchanged = [artPath, 'src/adventure/experimental/guaira/SkeletonBullModel.ts', 'src/adventure/experimental/guaira/GuairaBullLab.ts'];
for (const file of unchanged) assert.equal(readFileSync(file, 'utf8'), readFileSync(join(base, file), 'utf8'), `${file} must be byte-identical`);
mkdirSync(output, { recursive: true });
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const player = { x: 68, y: 200, width: 14, height: 24 };
const sequences: unknown[] = [], replays: unknown[] = [];
for (const facing of [-1, 1] as const) for (const reduced of [false, true]) {
    const b = new SkeletonBullModel(), name = `${facing < 0 ? 'left' : 'right'}-${reduced ? 'reduced' : 'normal'}`;
    for (let tick = 0; tick < 600 && !(b.state === 'brake' && b.facing === facing); tick++) b.update(R.tickMs, player);
    assert.equal(b.state, 'brake'); assert.equal(b.facing, facing);
    const sheet = createCanvas(1152, 340), sc = sheet.getContext('2d'); sc.imageSmoothingEnabled = false;
    sc.fillStyle = '#302836'; sc.fillRect(0, 0, sheet.width, sheet.height);
    const frames: unknown[] = [], poses = [new Set<string>(), new Set<string>()];
    let lastBrake = '';
    for (let tick = 0; tick <= R.brake + 6; tick++) {
        const before = JSON.stringify(b), framePixels: Uint8ClampedArray[] = [];
        const pair = createCanvas(1280, 600), pc = pair.getContext('2d'); pc.imageSmoothingEnabled = false;
        pc.fillStyle = '#302836'; pc.fillRect(0, 0, pair.width, pair.height);
        for (const [index, art, actor] of [[0, beforeArt, beforeActor], [1, afterArt, afterActor]] as const) {
            const native = createCanvas(320, 180), c = native.getContext('2d');
            art.drawGuairaBackground(c); art.drawGuairaFloor(c, 64); art.drawGuairaBoss(c, b, 0, 64, reduced);
            assert.equal(JSON.stringify(b), before);
            const rgba = c.getImageData(0, 0, 320, 180).data; framePixels.push(rgba);
            const file = `${name}-${String(tick).padStart(2, '0')}-${index ? 'after' : 'before'}.png`;
            writeFileSync(join(output, file), native.toBuffer('image/png'));
            pc.drawImage(native as unknown as CanvasImageSource, index * 640, 28, 640, 360);
            // Nearest-neighbor crop of exactly the same frame, no painted replacement.
            const cropX = Math.max(0, Math.min(224, b.x + b.width / 2 - 48));
            pc.drawImage(native as unknown as CanvasImageSource, cropX, 116, 96, 48, index * 640 + 128, 400, 384, 192);
            pc.fillStyle = '#f0ddae'; pc.font = '16px sans-serif';
            pc.fillText(`${index ? 'AFTER' : 'BEFORE'} / ${name} / ${b.state} ${b.stateTick}`, index * 640 + 12, 20);
            const isolated = createCanvas(96, 48), ic = isolated.getContext('2d');
            ic.translate(48 - (b.x + b.width / 2), 12 - b.y); actor(ic, b, reduced);
            const pose = hash(isolated.toBuffer('image/png'));
            if (tick < R.brake) poses[index].add(pose);
            if (index && tick === R.brake - 1) lastBrake = pose;
            if (index && tick === R.brake) assert.equal(pose, lastBrake, 'recovery starts on the exact settled pose');
            const column = [0, 7, 14, 20].indexOf(tick);
            if (column >= 0) {
                sc.fillStyle = '#f0ddae'; sc.font = '14px sans-serif';
                sc.fillText(`${index ? 'AFTER' : 'BEFORE'} / ${b.state} ${b.stateTick}`, column * 288 + 8, index * 170 + 19);
                sc.drawImage(native as unknown as CanvasImageSource, cropX, 116, 96, 48, column * 288, index * 170 + 26, 288, 144);
            }
        }
        let changedPixels = 0;
        for (let pixel = 0; pixel < 320 * 180; pixel++) if ([0, 1, 2, 3].some(ch => framePixels[0][pixel * 4 + ch] !== framePixels[1][pixel * 4 + ch])) {
            changedPixels++;
            const x = pixel % 320, y = Math.floor(pixel / 320);
            assert.ok(x >= b.x - 18 && x < b.x + b.width + 18 && y >= b.y - 64 && y < b.arena.floor - 64 + 2, 'only local actor pixels change');
        }
        writeFileSync(join(output, `${name}-pair-${String(tick).padStart(2, '0')}.png`), pair.toBuffer('image/png'));
        frames.push({ tick, state: b.state, stateTick: b.stateTick, changedPixels, stateSha256: hash(before), openingTicksRemaining: b.openingTicksRemaining });
        b.update(R.tickMs, player);
    }
    assert.deepEqual(poses.map(set => set.size), [1, reduced ? 1 : 3]);
    writeFileSync(join(output, `${name}-pose-sheet.png`), sheet.toBuffer('image/png'));
    sequences.push({ name, facing, reducedMotion: reduced, beforePoseCount: poses[0].size, afterPoseCount: poses[1].size, frames });
}

// Existing ordinary keyboard replay also renders both real boss painters in the
// complete production scene. No player/camera/model edits or save writes.
for (const reduced of [false, true]) {
    const cleanups: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanups.push(fn as () => void) }, { reducedMotion: reduced });
    const screen = createCanvas(640, 360); h.canvas.getContext = () => screen.getContext('2d');
    const createElement = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof createElement> : createElement(tag);
    const game = h.create(), hits: Array<{ frame: number; health: number }> = [];
    let held = new Set<string>(), frame = 0, samples = 0;
    const state = () => JSON.stringify({ player: game.player.data, boss: game.boss, objects: game.objects,
        camera: game.camera, time: game.time, save: game.store.save, state: game.state });
    for (const [count, codes] of replay.runs as Array<[number, string[]]>) {
        const next = new Set(codes);
        for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        held = next;
        for (let n = 0; n < count; n++, frame++) {
            const oldHealth = game.boss!.health; game.update(replay.stepMs);
            const b = (game.boss as GuairaBullEncounter).model;
            if (b.health < oldHealth) hits.push({ frame, health: b.health });
            assert.equal(game.player.data.hasHelmet, true); assert.equal(game.player.data.isDead, false);
            if (b.state !== 'brake') continue;
            const initial = state();
            for (const [version, art] of [['before', beforeArt], ['after', afterArt]] as const) {
                game.art.boss = (c, boss, cx, cy) => art.drawGuairaBoss(c, (boss as GuairaBullEncounter).model, cx, cy, reduced);
                game.render(); assert.equal(state(), initial);
                if (b.stateTick === 7) writeFileSync(join(output, `replay-${reduced ? 'reduced' : 'normal'}-${frame}-${version}.png`), screen.toBuffer('image/png'));
            }
            samples++;
        }
    }
    assert.equal(frame, replay.frames); assert.deepEqual(hits, replay.expectedHits);
    assert.equal(game.boss!.phase, 'defeated'); assert.deepEqual(game.store.save.completed, []);
    replays.push({ reducedMotion: reduced, frames: frame, renderedBrakePairs: samples, hits, helmetIntact: true, noSavedProgress: true });
    for (const cleanup of cleanups) cleanup();
}
const proof = { kind: 'offline-native-production-canvas', browserQA: false, deviceQA: false, fpsQA: false,
    beforeSourceSha256: hash(readFileSync(join(base, actorPath))), afterSourceSha256: hash(readFileSync(actorPath)),
    byteIdenticalFiles: unchanged, sequences, replays };
writeFileSync(join(output, 'proof.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ output, sequences: sequences.length, replays, localActorOnly: true, seamlessRecovery: true }, null, 2));
