/**
 * Native Input + production GuairaJunction/Renderer/Canvas raster proof.
 * DOM/audio boundaries are stubbed. No state/position/camera edits in replay.
 * Not browser, device, DOM-toolbar, font-loading, audio or FPS QA.
 * node --import tsx scripts/prove_guaira_junction_depth.ts OUTPUT /path/to/@napi-rs/canvas/index.js
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guairaJunctionBrowser } from '../tests/helpers/guairaJunctionHarness';
import { GUAIRA_JUNCTION as G } from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import direct from '../tests/helpers/guairaJunctionReplay.json';
import optional from '../tests/helpers/guairaJunctionOptionalReplay.json';

interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const output = resolve(process.argv[2] ?? '/tmp/guaira-junction-depth-proof');
const modulePath = resolve(process.argv[3] ?? '/tmp/guaira-depth-render/node_modules/@napi-rs/canvas/index.js');
const { createCanvas } = await import(pathToFileURL(modulePath).href) as { createCanvas(width: number, height: number): NativeCanvas };
mkdirSync(output, { recursive: true });
const records: unknown[] = [];
for (const reducedMotion of [false, true]) for (const route of ['direct', 'optional'] as const) {
    const cleanups: Array<() => void> = [];
    const h = guairaJunctionBrowser({ after: fn => cleanups.push(fn as () => void) }, { touch: true, reducedMotion });
    const screen = createCanvas(640, 360);
    h.canvas.getContext = () => screen.getContext('2d');
    const createElement = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof createElement> : createElement(tag);
    const game = h.create();
    // Production chapter uses an external control bar. This proof captures the
    // composed game viewport, not that DOM bar; native touch still drives input.
    game.renderer.setTouchControlsVisible(false);
    const replay = route === 'direct' ? direct : optional;
    const sampleFrames = route === 'direct' ? [0, 299, 434, 790, 818, 893] : [972, 1118, 1132, 1172, 1202, 1838];
    const sheet = createCanvas(1920, 768), c = sheet.getContext('2d');
    c.fillStyle = '#382f36'; c.fillRect(0, 0, sheet.width, sheet.height); c.imageSmoothingEnabled = false;
    const images: unknown[] = []; let minimumHelmetTop = Infinity;
    function capture(frame: number) {
        if (!sampleFrames.includes(frame)) return;
        const before = JSON.stringify({ p: game.player.data, objects: game.objects, routing: game.routing, finished: game.finished, coins: game.coins, camera: game.camera });
        game.render();
        assert.equal(JSON.stringify({ p: game.player.data, objects: game.objects, routing: game.routing, finished: game.finished, coins: game.coins, camera: game.camera }), before);
        const file = `${route}-${reducedMotion ? 'reduced' : 'normal'}-${frame}.png`, data = screen.toBuffer('image/png');
        writeFileSync(join(output, file), data);
        const i = images.length, x = i % 3 * 640, y = Math.floor(i / 3) * 384;
        c.fillStyle = '#f3ddb1'; c.font = '14px sans-serif'; c.fillText(`${route} / ${reducedMotion ? 'reduced' : 'normal'} / native-input frame ${frame}`, x + 8, y + 17);
        c.drawImage(screen as unknown as CanvasImageSource, x, y + 24);
        images.push({ frame, file, sha256: createHash('sha256').update(data).digest('hex'), player: structuredClone(game.player.data.position),
            feet: game.player.data.position.y + game.player.data.height, camera: { x: game.camera.x, y: game.camera.y }, coins: game.coins,
            selected: game.routing.selected, supplied: game.routing.supplied, finished: game.finished, status: h.status.textContent });
        if (route === 'direct' && frame === 790) {
            const left = G.exitGapStartX - Math.round(game.camera.x), right = G.exitGapEndX - Math.round(game.camera.x);
            assert.ok(left > 0 && right < 320, 'both edges of the exit gap visible before the jump');
            assert.equal(game.player.data.isGrounded, true);
        }
    }
    capture(0); let frame = 0;
    for (const [count, keys] of replay.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let n = 0; n < count; n++) {
            game.update(replay.stepMs); frame++;
            assert.equal(game.player.data.isDead, false); assert.equal(game.player.data.hasHelmet, true);
            if (route === 'optional' && frame >= 1118 && frame <= 1202) minimumHelmetTop = Math.min(minimumHelmetTop, game.player.data.position.y - Math.round(game.camera.y) - 4);
            capture(frame);
        }
    }
    assert.equal(game.finished, true); assert.equal(game.coins, route === 'optional' ? 3 : 0); assert.equal(frame, replay.frames);
    if (route === 'optional') assert.ok(minimumHelmetTop >= 23, 'helmet never behind HUD during shelf detour');
    const contactSheet = `${route}-${reducedMotion ? 'reduced' : 'normal'}-contact.png`;
    writeFileSync(join(output, contactSheet), sheet.toBuffer('image/png'));
    let immediateRejump: unknown = null;
    if (route === 'optional') {
        // A real retry, then the same native tape up to first shelf contact.
        // Re-jump immediately, without the recording's later settling wait.
        h.keys([]); game.load(G.id); let arrivalFrame = 0;
        for (const [count, keys] of optional.runs as Array<[number, string[]]>) {
            h.keys(keys);
            for (let n = 0; n < count && arrivalFrame < 1143; n++) { game.update(optional.stepMs); arrivalFrame++; }
            if (arrivalFrame === 1143) break;
        }
        assert.equal(game.player.data.isGrounded, true);
        h.run(game, 14, ['Space']);
        const helmetTop = game.player.data.position.y - Math.round(game.camera.y) - 4;
        assert.ok(helmetTop >= 23);
        game.render();
        const file = `optional-${reducedMotion ? 'reduced' : 'normal'}-immediate-rejump.png`, data = screen.toBuffer('image/png');
        writeFileSync(join(output, file), data);
        immediateRejump = { file, arrivalFrame, jumpFrames: 14, helmetTop, sha256: createHash('sha256').update(data).digest('hex') };
    }
    records.push({ route, reducedMotion, input: 'native touch', frames: frame, finished: true, coins: route === 'optional' ? 3 : 0,
        minimumHelmetTop: Number.isFinite(minimumHelmetTop) ? minimumHelmetTop : null, storageCalls: h.storageCalls.length, contactSheet, images, immediateRejump });
    for (const cleanup of cleanups) cleanup();
}
const result = { kind: 'offline-production-canvas-native-input-raster', renderer: '@napi-rs/canvas', browserQA: false, deviceQA: false,
    evidence: 'Production game, native Input/Player/WorldObjects and camera; real Canvas pixels. Only DOM/audio boundaries stubbed.', records };
writeFileSync(join(output, 'proof.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ output, routes: records.length, proof: join(output, 'proof.json') }, null, 2));
