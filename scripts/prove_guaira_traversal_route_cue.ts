/**
 * Real production Canvas before/after from identical native-input replay states.
 * Only DOM/audio boundaries are stubbed. No player/camera/physics edits.
 * This is offline raster evidence, not browser/device/audio/FPS QA.
 * node --import tsx scripts/prove_guaira_traversal_route_cue.ts OUTPUT CANVAS_MODULE BASE_CHECKOUT
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guairaTraversalBrowser } from '../tests/helpers/guairaTraversalHarness';
import { GUAIRA_TRAVERSAL as G } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { drawGuairaTraversalBackground as afterBackground } from '../src/adventure/experimental/guaira/GuairaTraversalArt';
import { supportsStanding } from '../src/world/tileRules';
import upper from '../tests/helpers/guairaTraversalReplay.json';
import lower from '../tests/helpers/guairaTraversalMaintenanceReplay.json';

interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const output = resolve(process.argv[2] ?? '/tmp/guaira-traversal-route-cue');
assert.ok(process.argv[3] && process.argv[4], 'provide existing native Canvas module and canonical base checkout');
const { createCanvas } = await import(pathToFileURL(resolve(process.argv[3])).href) as { createCanvas(w: number, h: number): NativeCanvas };
const baseRoot = resolve(process.argv[4]);
const artPath = 'src/adventure/experimental/guaira/GuairaTraversalArt.ts';
const { drawGuairaTraversalBackground: beforeBackground } = await import(pathToFileURL(join(baseRoot, artPath)).href) as { drawGuairaTraversalBackground: typeof afterBackground };
const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const stagePath = 'src/adventure/experimental/guaira/GuairaTraversal.ts';
assert.equal(readFileSync(stagePath, 'utf8'), readFileSync(join(baseRoot, stagePath), 'utf8'), 'stage geometry, IDs and progression remain byte-identical');
mkdirSync(output, { recursive: true });
const records: unknown[] = [];
for (const reducedMotion of [false, true]) for (const route of ['upper', 'maintenance'] as const) {
    const cleanups: Array<() => void> = [];
    const h = guairaTraversalBrowser({ after: fn => cleanups.push(fn as () => void) }, { reducedMotion });
    const screen = createCanvas(640, 360);
    h.canvas.getContext = () => screen.getContext('2d');
    const createElement = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof createElement> : createElement(tag);
    const game = h.create(); game.renderer.setTouchControlsVisible(false);
    const replay = route === 'upper' ? upper : lower;
    const samples = route === 'upper' ? [370, 429, 476] : [370, 429, 454];
    const sheet = createCanvas(1280, 1152), sc = sheet.getContext('2d');
    sc.fillStyle = '#493c43'; sc.fillRect(0, 0, sheet.width, sheet.height); sc.imageSmoothingEnabled = false;
    const images: unknown[] = [], checkpoints = new Set<number>(); let frame = 0;
    const state = () => JSON.stringify({ player: game.player.data, camera: game.camera, objects: game.objects,
        level: game.level.data, stage: game.stage, save: game.store.save, coins: game.coins, finished: game.finished,
        time: game.time, elapsed: game.elapsed, state: game.state });
    function capture() {
        if (!samples.includes(frame)) return;
        const initial = state(), buffers: Buffer[] = [], pixels: Uint8ClampedArray[] = [];
        for (const [i, painter] of [beforeBackground, afterBackground].entries()) {
            game.art.background = (c, _island, cx, cy, time) => painter(c, cx, cy, time, reducedMotion, !!game.objects.get(G.bridgeId)?.active);
            game.render(); assert.equal(state(), initial, 'both background versions leave the run untouched');
            const data = screen.toBuffer('image/png'); buffers.push(data);
            pixels.push(screen.getContext('2d').getImageData(0, 0, 640, 360).data);
            const file = `${route}-${reducedMotion ? 'reduced' : 'normal'}-${frame}-${i ? 'after' : 'before'}.png`;
            writeFileSync(join(output, file), data);
            const y = samples.indexOf(frame) * 384;
            sc.fillStyle = '#f0d29a'; sc.font = '13px sans-serif';
            sc.fillText(`${i ? 'AFTER' : 'BEFORE'} / ${route} / native-input frame ${frame}`, i * 640 + 8, y + 17);
            sc.drawImage(screen as unknown as CanvasImageSource, i * 640, y + 24);
        }
        let changedPixels = 0;
        const cx = Math.round(game.camera.x), cy = Math.round(game.camera.y);
        for (let p = 0; p < 640 * 360; p++) {
            if ([0, 1, 2, 3].every(channel => pixels[0][p * 4 + channel] === pixels[1][p * 4 + channel])) continue;
            changedPixels++;
            const sx = Math.floor((p % 640) / 2), sy = Math.floor(Math.floor(p / 640) / 2);
            const wx = sx + cx, wy = sy + cy;
            assert.ok(wx >= 757 && wx < 779 && wy >= 216 && wy < 251 && sy >= 23,
                `all altered pixels belong to the small pipe, got ${wx},${wy}`);
            assert.equal(supportsStanding(game.level.data.tiles[Math.floor(wy / 16)]?.[Math.floor(wx / 16)] ?? 0), false,
                'real solid tiles, including their walkable cap, occlude the background pipe');
        }
        assert.ok(changedPixels > 0, 'the cue is visible from this native approach/choice');
        images.push({ frame, changedPixels, stateSha256: hash(initial), beforeSha256: hash(buffers[0]), afterSha256: hash(buffers[1]),
            position: structuredClone(game.player.data.position), camera: { x: game.camera.x, y: game.camera.y }, coins: game.coins });
    }
    for (const [count, keys] of replay.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let n = 0; n < count; n++) {
            game.update(replay.stepMs); frame++;
            assert.equal(game.player.data.isDead, false); assert.equal(game.player.data.hasHelmet, true);
            if (game.store.save.checkpoint) checkpoints.add(game.store.save.checkpoint.index);
            capture();
        }
    }
    assert.equal(frame, replay.frames); assert.equal(game.finished, true); assert.equal(game.finalBridgeReady, true);
    assert.equal(game.coins, route === 'upper' ? 13 : 14); assert.deepEqual([...checkpoints], [0, 1, 2]);
    assert.equal(h.storageCalls.filter(call => call.startsWith('set:')).length, 0, 'no persistent write');
    const file = `${route}-${reducedMotion ? 'reduced' : 'normal'}-comparison.png`;
    writeFileSync(join(output, file), sheet.toBuffer('image/png'));
    records.push({ route, reducedMotion, frames: frame, coins: game.coins, finished: game.finished, helmet: game.player.data.hasHelmet,
        finalPosition: structuredClone(game.player.data.position), checkpoints: [...checkpoints], images, comparison: file });
    for (const cleanup of cleanups) cleanup();
}
const proof = { kind: 'offline-native-input-production-canvas-before-after', browserQA: false, deviceQA: false, audioQA: false,
    note: 'Before and after backgrounds render the exact same live input-driven state. Real terrain, player, camera, pickups and HUD are unchanged.',
    unchangedStageSha256: hash(readFileSync(stagePath)), beforeArtSha256: hash(readFileSync(join(baseRoot, artPath))), afterArtSha256: hash(readFileSync(artPath)), records };
writeFileSync(join(output, 'proof.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ output, routeRuns: records.length, stageByteIdentical: true, beforeAfterPairs: 12 }, null, 2));
