/**
 * Real production Canvas before/after from identical native-input replay states.
 * Only DOM/audio boundaries are stubbed. No player/camera/physics edits.
 * Offline raster evidence, not browser/device/audio/FPS QA.
 * node --import tsx scripts/prove_guaira_ascent_travel_cue.ts OUTPUT CANVAS_MODULE BASE_CHECKOUT
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guairaAscentBrowser } from '../tests/helpers/guairaAscentHarness';
import { GUAIRA_ASCENT as G, guairaAscentStage } from '../src/adventure/experimental/guaira/GuairaAscent';
import { drawGuairaAscentObjects as afterObjects } from '../src/adventure/experimental/guaira/GuairaAscentArt';
import { ascentTravelDirection } from '../src/adventure/experimental/guaira/GuairaAscentTravelCue';
import replay from '../tests/helpers/guairaAscentReplay.json';

interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const output = resolve(process.argv[2] ?? '/tmp/guaira-ascent-travel-cue');
assert.ok(process.argv[3] && process.argv[4], 'provide existing native Canvas module and canonical base checkout');
const { createCanvas } = await import(pathToFileURL(resolve(process.argv[3])).href) as { createCanvas(w: number, h: number): NativeCanvas };
const base = resolve(process.argv[4]), folder = 'src/adventure/experimental/guaira/';
const { drawGuairaAscentObjects: beforeObjects } = await import(pathToFileURL(join(base, folder, 'GuairaAscentArt.ts')).href) as { drawGuairaAscentObjects: typeof afterObjects };
const { guairaAscentStage: beforeStage } = await import(pathToFileURL(join(base, folder, 'GuairaAscent.ts')).href) as { guairaAscentStage: typeof guairaAscentStage };
assert.deepEqual(guairaAscentStage(), beforeStage(), 'all stage geometry, timing, collectibles, checkpoints and IDs unchanged');
for (const file of ['src/adventure/WorldPhysics.ts', 'src/entities/Player.ts', 'src/adventure/progress.ts'])
    assert.equal(readFileSync(file, 'utf8'), readFileSync(join(base, file), 'utf8'), `${file} byte-identical to baseline`);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
mkdirSync(output, { recursive: true });
const records: unknown[] = [];
for (const reducedMotion of [false, true]) for (const route of ['crossings', 'round-trip'] as const) {
    const cleanups: Array<() => void> = [];
    const h = guairaAscentBrowser({ after: fn => cleanups.push(fn as () => void) }, { reducedMotion });
    const screen = createCanvas(640, 360);
    h.canvas.getContext = () => screen.getContext('2d');
    const createElement = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof createElement> : createElement(tag);
    const game = h.create(); game.renderer.setTouchControlsVisible(false);
    const frames = route === 'crossings' ? [0, 220, 730, 1150] : [150, 450];
    const sheet = createCanvas(640, frames.length * 204), sc = sheet.getContext('2d');
    sc.fillStyle = '#382f36'; sc.fillRect(0, 0, sheet.width, sheet.height); sc.imageSmoothingEnabled = false;
    const detail = createCanvas(576, frames.length * 162), dc = detail.getContext('2d');
    dc.fillStyle = '#382f36'; dc.fillRect(0, 0, detail.width, detail.height); dc.imageSmoothingEnabled = false;
    const images: unknown[] = [], checkpoints = new Set<number>(); let frame = 0;
    const state = () => JSON.stringify({ player: game.player.data, camera: game.camera, objects: game.objects,
        level: game.level.data, stage: game.stage, save: game.store.save, coins: game.coins, finished: game.finished,
        time: game.time, elapsed: game.elapsed, state: game.state });
    function capture() {
        if (!frames.includes(frame)) return;
        const initial = state(), pixels: Uint8ClampedArray[] = [], files: string[] = [], hashes: string[] = [];
        const focusId = frame === 730 ? G.liftId : frame === 1150 ? G.serviceId : G.plankId;
        const body = game.objects.get(focusId)!, axis = focusId === G.liftId ? 'y' : 'x';
        const cx = Math.round(game.camera.x), cy = Math.round(game.camera.y);
        const plateX = Math.round(body.x) + Math.floor(body.width / 2) - cx;
        const plateY = Math.round(body.y) + body.height + 5 - cy;
        const originalPainter = game.art.objects;
        for (const [version, painter] of [beforeObjects, afterObjects].entries()) {
            game.art.objects = (c, objects, x, y, time) => painter(c, objects, x, y, time, reducedMotion, game.state === 'playing' && !game.finished);
            game.render(); assert.equal(state(), initial, 'both painters preserve the full run state');
            // Keep each raster immutable: native Canvas may defer drawImage source reads.
            const native = createCanvas(320, 180), nc = native.getContext('2d'); nc.imageSmoothingEnabled = false;
            nc.drawImage(screen as unknown as CanvasImageSource, 0, 0, 320, 180);
            const data = native.toBuffer('image/png'); pixels.push(nc.getImageData(0, 0, 320, 180).data);
            const file = `${route}-${reducedMotion ? 'reduced' : 'normal'}-${frame}-${version ? 'after' : 'before'}-native.png`;
            writeFileSync(join(output, file), data); files.push(file); hashes.push(hash(data));
            const row = frames.indexOf(frame);
            sc.fillStyle = '#f0d29a'; sc.font = '11px sans-serif';
            sc.fillText(`${version ? 'AFTER' : 'BEFORE'} / frame ${frame} / ${reducedMotion ? 'reduced' : 'normal'}`, version * 320 + 5, row * 204 + 16);
            sc.drawImage(native as unknown as CanvasImageSource, version * 320, row * 204 + 24);
            dc.fillStyle = '#f0d29a'; dc.font = '11px sans-serif';
            dc.fillText(`${version ? 'AFTER' : 'BEFORE'} / ${focusId} / ${frame}`, version * 288 + 5, row * 162 + 15);
            // Unretouched nearest-neighbour detail of the same composed scene.
            dc.drawImage(native as unknown as CanvasImageSource, plateX - 24, plateY - 15, 48, 23,
                version * 288, row * 162 + 24, 288, 138);
        }
        game.art.objects = originalPainter;
        let changedPixels = 0;
        for (let p = 0; p < 320 * 180; p++) {
            if ([0, 1, 2, 3].every(channel => pixels[0][p * 4 + channel] === pixels[1][p * 4 + channel])) continue;
            changedPixels++;
            const wx = p % 320 + cx, wy = Math.floor(p / 320) + cy;
            assert.ok(game.objects.bodies.some(b => {
                const left = Math.round(b.x) + Math.floor(b.width / 2) - 6, top = Math.round(b.y) + b.height;
                return wx >= left && wx < left + 13 && wy >= top && wy < top + 11;
            }), `changed pixel ${wx},${wy} is confined to a 13x11 plate below a real cap`);
            assert.ok(Math.floor(p / 320) >= 23, 'no changes behind the HUD');
        }
        assert.ok(changedPixels > 0, 'cue is visible from the native approach/ride');
        images.push({ frame, focusId, direction: ascentTravelDirection(body, axis), changedPixels, files, hashes,
            fullStateSha256: hash(initial), player: structuredClone(game.player.data.position),
            camera: { x: game.camera.x, y: game.camera.y }, body: { x: body.x, y: body.y, px: body.px, py: body.py } });
    }
    capture();
    outer: for (const [count, keys] of replay.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let n = 0; n < count; n++) {
            game.update(replay.stepMs); frame++;
            assert.equal(game.player.data.isDead, false); assert.equal(game.player.data.hasHelmet, true);
            if (game.store.save.checkpoint) checkpoints.add(game.store.save.checkpoint.index);
            capture();
            if (route === 'round-trip' && frame === 130) break outer;
        }
    }
    if (route === 'round-trip') {
        h.keys([]);
        while (frame < 450) {
            game.update(replay.stepMs); frame++; capture();
            const plank = game.objects.get(G.plankId)!, player = game.player.data;
            assert.equal(player.isDead, false); assert.equal(player.isGrounded, true);
            assert.ok(Math.abs(player.position.y + player.height - plank.y) < 1e-8, 'native carry stays on deck throughout turnaround');
        }
    } else {
        assert.equal(frame, replay.frames); assert.equal(game.finished, true); assert.equal(game.coins, 0);
        assert.deepEqual([...checkpoints], [0, 1]);
    }
    assert.equal(h.storageCalls.filter(call => call.startsWith('set:')).length, 0);
    const prefix = `${route}-${reducedMotion ? 'reduced' : 'normal'}`;
    writeFileSync(join(output, `${prefix}-comparison-native.png`), sheet.toBuffer('image/png'));
    writeFileSync(join(output, `${prefix}-detail.png`), detail.toBuffer('image/png'));
    records.push({ route, reducedMotion, input: 'native keyboard', frames: frame, finished: game.finished,
        checkpoints: [...checkpoints], comparison: `${prefix}-comparison-native.png`, detail: `${prefix}-detail.png`, images });
    for (const cleanup of cleanups) cleanup();
}
const result = { kind: 'offline-production-canvas-native-input-raster', baseline: base, renderer: '@napi-rs/canvas',
    browserQA: false, deviceQA: false, scope: '13x11 mechanism-mounted plates; stage, physics and save schema unchanged', records };
writeFileSync(join(output, 'proof.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ output, scenarios: records.length, proof: join(output, 'proof.json') }, null, 2));
