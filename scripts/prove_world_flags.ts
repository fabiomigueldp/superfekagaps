/**
 * Offline native Canvas evidence of the production painters/runtime, not browser,
 * device, audio or FPS QA. Full-scene fixtures position Feka at an authored flag;
 * update() earns checkpoints/exits through unchanged triggers (no forged saves).
 * Usage: node --import tsx scripts/prove_world_flags.ts OUTPUT CANVAS_MODULE BASE_CHECKOUT
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorldGame } from '../src/adventure/WorldGame';
import { drawWorldCheckpoint, drawWorldGoal } from '../src/adventure/WorldCheckpointArt';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(format: 'image/png'): Buffer }
const output = resolve(process.argv[2]), modulePath = resolve(process.argv[3]), base = resolve(process.argv[4]);
const { createCanvas } = await import(pathToFileURL(modulePath).href) as { createCanvas(w: number, h: number): NativeCanvas };
const { WorldGame: Before } = await import(pathToFileURL(join(base, 'src/adventure/WorldGame.ts')).href) as { WorldGame: typeof WorldGame };
const { drawWorldCheckpoint: beforeCheckpoint } = await import(pathToFileURL(join(base, 'src/adventure/WorldCheckpointArt.ts')).href) as { drawWorldCheckpoint: typeof drawWorldCheckpoint };
for (const file of ['src/entities/Player.ts', 'src/adventure/WorldPhysics.ts', 'src/adventure/progress.ts', 'src/adventure/campaign.ts'])
    assert.equal(readFileSync(file, 'utf8'), readFileSync(join(base, file), 'utf8'), `${file} unchanged`);
mkdirSync(output, { recursive: true });
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const records: unknown[] = [];
const scenes = ['checkpoint-ready', 'checkpoint-hoist', 'checkpoint-raised', 'checkpoint-resumed', 'goal-ready', 'goal-clear', 'secret-ready', 'secret-clear'] as const;
for (const reducedMotion of [false, true]) {
    const sheet = createCanvas(640, scenes.length * 204), sc = sheet.getContext('2d'); sc.imageSmoothingEnabled = false;
    sc.fillStyle = '#192c44'; sc.fillRect(0, 0, sheet.width, sheet.height);
    for (let row = 0; row < scenes.length; row++) {
        const scene = scenes[row], samples: string[] = [];
        for (const [version, Runtime] of [['before', Before], ['after', WorldGame]] as const) {
            const cleanups: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanups.push(fn as () => void) }, { reducedMotion });
            for (const surface of [h.window, h.document, h.canvas]) Object.assign(surface, { removeEventListener() {} });
            const screen = createCanvas(640, 360); h.canvas.getContext = () => screen.getContext('2d');
            const createElement = h.document.createElement;
            h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof createElement> : createElement(tag);
            const game = new Runtime(h.canvas as unknown as HTMLCanvasElement, true);
            game.load(scene.startsWith('secret') ? '1-3' : '1-1'); game.renderer.setTouchControlsVisible(false);
            const cp = game.stage.checkpoints[0], exit = game.stage.exits.find(e => e.id === (scene.startsWith('secret') ? 'secret' : 'normal'))!;
            const checkpoint = scene.startsWith('checkpoint'), ready = scene.endsWith('ready');
            const p = game.player.data;
            const target = checkpoint ? { x: cp.x * 16, y: cp.y * 16 } : { x: exit.x, y: exit.y + exit.height };
            p.position = { x: target.x - (ready ? 26 : 0), y: target.y - p.height }; p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
            game.camera.x = Math.max(0, Math.min(game.level.data.width * 16 - 320, target.x - 140));
            game.camera.y = Math.max(0, Math.min(game.level.data.height * 16 - 180, target.y - 137));
            if (!ready) {
                game.update(1000 / 60);
                if (checkpoint) assert.equal(game.store.save.checkpoint?.index, 0);
                else assert.equal(game.state, 'clear');
                if (scene.endsWith('raised')) for (let i = 0; i < 45; i++) game.update(1000 / 60);
                if (scene.endsWith('resumed')) game.load('1-1', true);
            }
            const state = () => JSON.stringify({ player: game.player.data, save: game.store.save, camera: game.camera, state: game.state, time: game.time, elapsed: game.elapsed, coins: game.coins });
            const before = state(); game.render(); assert.equal(state(), before, 'Painting cannot mutate run state'); samples.push(before);
            const frame = createCanvas(320, 180), fc = frame.getContext('2d'); fc.imageSmoothingEnabled = false;
            fc.drawImage(screen as unknown as CanvasImageSource, 0, 0, 320, 180);
            const file = `${reducedMotion ? 'reduced' : 'normal'}-${scene}-${version}.png`, data = frame.toBuffer('image/png'); writeFileSync(join(output, file), data);
            sc.fillStyle = '#ffe29a'; sc.font = '11px sans-serif'; sc.fillText(`${version.toUpperCase()} · ${scene} · ${reducedMotion ? 'reduced' : 'normal'}`, version === 'before' ? 5 : 325, row * 204 + 16);
            sc.drawImage(frame as unknown as CanvasImageSource, version === 'before' ? 0 : 320, row * 204 + 24);
            records.push({ file, sha256: hash(data), state: game.state, checkpoint: game.store.save.checkpoint?.index ?? null });
            game.dispose(); cleanups.reverse().forEach(fn => fn());
        }
        assert.equal(samples[0], samples[1], `${scene}: before/after gameplay, camera, progress and reward timing match exactly`);
    }
    writeFileSync(join(output, `${reducedMotion ? 'reduced' : 'normal'}-scene-comparison.png`), sheet.toBuffer('image/png'));
}
// Nearest-neighbour state atlas of the exact production flag functions.
const atlas = createCanvas(1000, 660), ac = atlas.getContext('2d'); ac.imageSmoothingEnabled = false;
ac.fillStyle = '#192c44'; ac.fillRect(0, 0, 1000, 660);
for (let frame = 0; frame < 5; frame++) {
    const cell = createCanvas(200, 110), cc = cell.getContext('2d'); cc.fillStyle = '#36566a'; cc.fillRect(0, 0, 200, 110);
    const reducedMotion = frame === 4, time = frame * 180;
    beforeCheckpoint(cc, 12, 52, true);
    drawWorldCheckpoint(cc, 47, 52, false, { time, reducedMotion });
    drawWorldCheckpoint(cc, 87, 52, true, { time, reducedMotion });
    drawWorldGoal(cc, 126, 12, false, false, false, { time, reducedMotion });
    drawWorldGoal(cc, 5, 67, true, false, false, { time, reducedMotion });
    drawWorldGoal(cc, 49, 67, false, true, false, { time, reducedMotion });
    drawWorldGoal(cc, 93, 67, false, false, true, { time, reducedMotion, activationAge: frame * 140 });
    drawWorldCheckpoint(cc, 161, 107, true, { time, reducedMotion, activationAge: frame * 140 });
    ac.drawImage(cell as unknown as CanvasImageSource, frame % 2 * 500, Math.floor(frame / 2) * 220, 400, 220);
    ac.fillStyle = '#ffe29a'; ac.font = '12px sans-serif'; ac.fillText(reducedMotion ? 'REDUCED / STATIC' : `${time} ms`, frame % 2 * 500 + 405, Math.floor(frame / 2) * 220 + 16);
}
writeFileSync(join(output, 'flag-state-atlas.png'), atlas.toBuffer('image/png'));
// Render the actual Remastered reference, not an imitation of its flag painter.
const cleanup: Array<() => void> = [], referenceHarness = guairaBrowser({ after: fn => cleanup.push(fn as () => void) });
for (const surface of [referenceHarness.window, referenceHarness.document, referenceHarness.canvas]) Object.assign(surface, { removeEventListener() {} });
const classic = new Before(referenceHarness.canvas as unknown as HTMLCanvasElement, true);
const reference = createCanvas(400, 140), rc = reference.getContext('2d'); rc.fillStyle = '#36566a'; rc.fillRect(0, 0, 400, 140);
const referencePainter = classic.renderer as unknown as { flagAt(c: CanvasRenderingContext2D, x: number, y: number, kind: 'checkpoint' | 'goal', state: 'inactive' | 'active' | 'clear'): void };
for (let i = 0; i < 4; i++) {
    rc.fillStyle = '#ffe29a'; rc.font = '10px sans-serif'; rc.fillText(`Remastered ${i * 180} ms`, i * 100 + 2, 13);
    referencePainter.flagAt(rc, i * 100 + 13, 55, 'checkpoint', 'inactive');
    referencePainter.flagAt(rc, i * 100 + 51, 55, 'checkpoint', 'active');
    referencePainter.flagAt(rc, i * 100 + 13, 110, 'goal', 'inactive');
    referencePainter.flagAt(rc, i * 100 + 51, 110, 'goal', 'clear');
    classic.renderer.advanceClock(180);
}
writeFileSync(join(output, 'actual-remastered-reference-native.png'), reference.toBuffer('image/png'));
classic.dispose(); cleanup.reverse().forEach(fn => fn());
writeFileSync(join(output, 'proof.json'), JSON.stringify({ evidence: 'Offline native Canvas raster. Deterministic staged activation/exit fixtures, not browser or native route acceptance.', base, unchanged: ['Player', 'WorldPhysics', 'progress', 'campaign'], sceneStateEquivalence: true, records }, null, 2));
console.log(JSON.stringify({ output, images: records.length + 4, sceneStateEquivalence: true }));
