/**
 * Offline native Canvas raster proof. Production GuairaRespiros/Renderer/Feka and
 * painters render authored poses plus the mechanics owner's frozen native-input
 * replay. Pose sheets are not a replay. Nothing here is browser/device QA or FPS.
 * npm install --prefix /tmp/feka-respiros-canvas @napi-rs/canvas@0.1.80
 * node --import tsx scripts/prove_guaira_respiros_art.ts /tmp/guaira-respiros-art-proof /tmp/feka-respiros-canvas/node_modules/@napi-rs/canvas/index.js [path/to/GuairaRespiros.ts]
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { WorldGame } from '../src/adventure/WorldGame';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { drawRespirosBackground, drawRespirosTerrain, drawRespirosObjects, RESPIROS_WATER_COLORS } from '../src/adventure/experimental/guaira/respiros/GuairaRespirosArt';
import { pixelText } from '../src/graphics/BitmapFont';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';

interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const output = resolve(process.argv[2] ?? '/tmp/guaira-respiros-art-proof');
const modulePath = process.argv[3] ?? '/tmp/feka-respiros-canvas/node_modules/@napi-rs/canvas/index.js';
const { createCanvas } = await import(pathToFileURL(resolve(modulePath)).href) as { createCanvas(width: number, height: number): NativeCanvas };
const enginePath = resolve(process.argv[4] ?? 'src/adventure/experimental/guaira/respiros/GuairaRespiros.ts');
const { GuairaRespiros } = await import(pathToFileURL(enginePath).href) as {
    GuairaRespiros: new (canvas: HTMLCanvasElement, status: HTMLElement) => WorldGame & { finished: boolean };
};
mkdirSync(output, { recursive: true }); mkdirSync(join(output, 'frames'), { recursive: true });
const cleanups: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanups.push(fn as () => void) }, { touch: true });
const screen = createCanvas(640, 360);
h.canvas.getContext = () => screen.getContext('2d');
const createElement = h.document.createElement;
h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof createElement> : createElement(tag);
const game = new GuairaRespiros(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
game.player.data.hasHelmet = true; game.player.data.isGrounded = true; game.player.data.respawnRevealTimer = 0;
game.store.save.preferences.shake = false;
game.renderer.setTouchControlsVisible(false);
let reduced = false;
game.art.background = (c, _island, cx, cy) => drawRespirosBackground(c, cx, cy, game.objects.time, reduced);
game.art.terrain = (c, level, _island, cx, cy) => drawRespirosTerrain(c, level, cx, cy);
game.art.objects = (c, objects, cx, cy) => drawRespirosObjects(c, objects, cx, cy, objects.time, reduced);
const samples = [
    { label: 'ENTRADA / AGUA AMBIENTE', time: 0, x: 48, cx: 0 },
    { label: 'REGUA EM CARGA / SEM DANO', time: 1600, x: 128, cx: 80 },
    { label: 'DESCARGA / ALTURA 128PX', time: 2100, x: 128, cx: 80 },
    { label: 'REFUGIO / MARGEM VISIVEL', time: 4050, x: 309, cx: 261 },
    { label: 'RETRACAO / ALTURA REAL', time: 350, x: 309, cx: 261 },
    { label: 'MARGEM FINAL / POSE', time: 4800, x: 660, cx: 384 },
];
function render(time: number, x: number, cameraX: number) {
    game.time = game.objects.time = time; game.player.data.position.x = x;
    game.camera.x = cameraX; game.camera.y = 144;
    const before = JSON.stringify({ objects: game.objects, player: game.player.data, camera: game.camera });
    game.render();
    assert.equal(JSON.stringify({ objects: game.objects, player: game.player.data, camera: game.camera }), before);
    return screen.toBuffer('image/png');
}
const sheet = createCanvas(1920, 1640), c = sheet.getContext('2d');
c.imageSmoothingEnabled = false; c.fillStyle = '#493c43'; c.fillRect(0, 0, sheet.width, sheet.height);
pixelText(c, 'PASSAGEM DOS RESPIROS / PROVA OFFLINE DO CANVAS NATIVO', 16, 12, '#f0d29a', 2);
pixelText(c, 'POSES AUTORADAS: NAO E REPLAY NEM QA DE NAVEGADOR OU DISPOSITIVO', 16, 35, '#dac099', 2);
const records: Array<{ file: string; label: string; reduced: boolean; time: number; playerX: number; cameraX: number; sha256: string }> = [];
for (reduced of [false, true]) for (let i = 0; i < samples.length; i++) {
    const sample = samples[i], data = render(sample.time, sample.x, sample.cx);
    const file = `${reduced ? 'reduced' : 'normal'}-${i}-${sample.time}.png`;
    writeFileSync(join(output, file), data);
    const index = i + (reduced ? 6 : 0), x = index % 3 * 640, y = 70 + Math.floor(index / 3) * 388;
    pixelText(c, `${reduced ? 'REDUZIDO' : 'NORMAL'} / ${sample.label}`, x + 8, y + 4, '#f0d29a', 1);
    c.drawImage(screen as unknown as CanvasImageSource, x, y + 20);
    records.push({ file, label: sample.label, reduced, time: sample.time, playerX: sample.x, cameraX: sample.cx, sha256: createHash('sha256').update(data).digest('hex') });
}
writeFileSync(join(output, 'contact-sheet.png'), sheet.toBuffer('image/png'));
// The legacy fallback remains a supported composition: real native controls,
// no PointerEvent/DOM bar, and both readouts are still drawn by the same painter.
game.renderer.setTouchControlsVisible(true);
const fallback = createCanvas(1280,776), fc = fallback.getContext('2d');
fc.fillStyle = '#493c43'; fc.fillRect(0,0,1280,776); fc.imageSmoothingEnabled = false;
for (const [i, sample] of [{ label: 'AVISO A', time: 1600, x: 128, cx: 80 }, { label: 'AVISO B', time: 3700, x: 309, cx: 261 },
    { label: 'DESCARGA B', time: 4050, x: 309, cx: 261 }, { label: 'RETRACAO B', time: 350, x: 309, cx: 261 }].entries()) {
    reduced = true; render(sample.time, sample.x, sample.cx);
    const x = i % 2 * 640, y = Math.floor(i / 2) * 388;
    pixelText(fc, `OFFLINE / FALLBACK TOUCH / ${sample.label}`, x + 8, y + 8, '#f0d29a');
    fc.drawImage(screen as unknown as CanvasImageSource, x, y + 28);
}
writeFileSync(join(output, 'touch-fallback.png'), fallback.toBuffer('image/png'));
game.renderer.setTouchControlsVisible(false);
// An actual Canvas pixel read proves coverage independently from the command
// recorder used by normal tests. Fractional camera is passed straight to art.
const liquid = new Set(Object.values(RESPIROS_WATER_COLORS).map(color => color.slice(1).toLowerCase()));
let checkedPixels = 0;
for (const time of [0,1400,1799,1800.5,1801,1920,2330,2499,2499.3,2499.5,2500,2600]) for (const cx of [95.25,261.75]) for (const rm of [false,true]) {
    const native = createCanvas(320,180), n = native.getContext('2d'); game.objects.time = time;
    drawRespirosObjects(n, game.objects, cx, 144.25, -90000, rm);
    const pixels = n.getImageData(0, 0, 320, 180).data;
    const expected = new Uint8Array(320 * 180);
    for (const b of game.objects.bodies) {
        const danger = jetCycle(b, time).danger; if (!danger) continue;
        const left = Math.max(0, Math.floor(danger.x - cx)), right = Math.min(320, Math.ceil(danger.x + danger.width - cx));
        const top = Math.max(23, Math.floor(danger.y - 144.25)), bottom = Math.min(180, Math.ceil(danger.y + danger.height - 144.25));
        if (right <= left) continue;
        for (let y = top; y < bottom; y++) expected.fill(1, y * 320 + left, y * 320 + right);
    }
    for (let p = 0; p < expected.length; p++) {
        const color = Array.from(pixels.slice(p * 4, p * 4 + 3), channel => channel.toString(16).padStart(2,'0')).join('');
        assert.equal(liquid.has(color) && pixels[p * 4 + 3] === 255, expected[p] === 1, `native Canvas mismatch t${time} pixel${p}`);
        checkedPixels++;
    }
}
// Side-by-side normal/reduced native frames make gauge and height parity clear.
for (let frame = 0; frame <= 84; frame++) {
    const pair = createCanvas(1280,388), pc = pair.getContext('2d');
    pc.fillStyle = '#493c43'; pc.fillRect(0,0,1280,388);
    for (const rm of [false,true]) {
        reduced = rm; render(frame * 50, 128, 80);
        pixelText(pc, `OFFLINE / ${rm ? 'REDUZIDO' : 'NORMAL'} / ${frame * 50} MS`, (rm ? 640 : 0) + 8, 8, '#f0d29a');
        pc.drawImage(screen as unknown as CanvasImageSource, rm ? 640 : 0, 28);
    }
    writeFileSync(join(output,'frames',`${String(frame).padStart(3,'0')}.png`), pair.toBuffer('image/png'));
}
// Capture the independently measured input recording through the actual wrapper.
// No position, phase, damage, checkpoint or completion edits occur in this pass.
const recordingPath = resolve(dirname(enginePath), '../../../../../tests/helpers/guairaRespirosReplay.json');
const recording = JSON.parse(readFileSync(recordingPath, 'utf8')) as { initialSettleFrames: number; stepMs: number; inputFrames: number; runs: [number,string[]][] };
game.load('guaira-respiros'); reduced = false;
const replaySamples = new Map([[0,'entrada'],[90,'carga'],[126,'descarga'],[300,'refugio'],[1283,'espera-segura'],[1370,'segunda-passagem'],[1523,'conclusao']]);
const replayImages: Array<{ frame: number; file: string; x: number; time: number; finished: boolean }> = [];
function captureReplay(frame: number) {
    if (!replaySamples.has(frame)) return;
    const before = JSON.stringify({ player: game.player.data, objects: game.objects, finished: game.finished });
    game.render();
    assert.equal(JSON.stringify({ player: game.player.data, objects: game.objects, finished: game.finished }), before);
    const file = `replay-${String(frame).padStart(4,'0')}-${replaySamples.get(frame)}.png`;
    writeFileSync(join(output,file), screen.toBuffer('image/png'));
    replayImages.push({ frame, file, x: game.player.data.position.x, time: game.objects.time, finished: game.finished });
}
for (let i = 0; i < recording.initialSettleFrames; i++) game.update(recording.stepMs);
captureReplay(0);
let frame = 0, held = new Set<string>();
for (const [count, keys] of recording.runs) {
    const next = new Set(keys);
    for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code, target: h.canvas });
    for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code, target: h.canvas });
    held = next;
    for (let i = 0; i < count; i++) {
        game.update(recording.stepMs); frame++;
        assert.equal(game.player.data.isDead, false); assert.equal(game.player.data.hasHelmet, true);
        captureReplay(frame);
    }
}
assert.equal(frame, recording.inputFrames); assert.equal(game.finished,true);
const result = { kind: 'offline-native-canvas-art-proof', authoredPoseSheet: true, nativeInputReplay: true, browserQA: false, deviceQA: false,
    rasterBackend: '@napi-rs/canvas@0.1.80', nativeComposition: '320x180 nearest-neighbour to640x360', checkedPixels,
    snapshotCount: records.length, animationFrames: 85, cameraY: 144, records,
    replay: { inputFrames: frame, finished: game.finished, hasHelmet: game.player.data.hasHelmet, finalX: game.player.data.position.x, images: replayImages } };
writeFileSync(join(output,'proof.json'), JSON.stringify(result,null,2));
console.log(JSON.stringify({ ...result, records: records.map(record => record.file), output },null,2));
for (const cleanup of cleanups) cleanup();
