/** Pixel-art comparison from the production painters. Poses are explicitly
 * authored inspection states, not a claimed gameplay victory.
 * node --import tsx scripts/prove_guaira_level_finish.ts OUTPUT CANVAS_MODULE BASE_REF
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SkeletonBullModel } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { drawSkeletonBull } from '../src/adventure/experimental/guaira/SkeletonBullArt';
import { GuairaMayorModel } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { drawGuairaMayor } from '../src/adventure/experimental/guaira/GuairaMayorArt';
import { pixelText } from '../src/graphics/BitmapFont';

interface Canvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const [outArg, canvasArg, baseline = 'HEAD'] = process.argv.slice(2);
assert.ok(outArg && canvasArg);
const out = resolve(outArg); mkdirSync(out, { recursive: true });
const { createCanvas } = await import(pathToFileURL(resolve(canvasArg)).href) as { createCanvas(w: number, h: number): Canvas };
const sourceRoot = 'src/adventure/experimental/guaira/';
async function oldPainter(file: string) {
    let source = execFileSync('git', ['show', `${baseline}:${sourceRoot}${file}.ts`], { encoding: 'utf8' });
    for (const [relative, actual] of [['./SkeletonBullModel', `${sourceRoot}SkeletonBullModel.ts`], ['../../WorldPainting', 'src/adventure/WorldPainting.ts']])
        source = source.split(`'${relative}'`).join(JSON.stringify(pathToFileURL(resolve(actual)).href));
    const path = join(out, `baseline-${file}.ts`); writeFileSync(path, source);
    return import(pathToFileURL(path).href);
}
const oldBull = (await oldPainter('SkeletonBullArt')).drawSkeletonBull as typeof drawSkeletonBull;
const oldMayor = (await oldPainter('GuairaMayorArt')).drawGuairaMayor as typeof drawGuairaMayor;
const fresh = (w: number, h: number) => {
    const canvas = createCanvas(w, h), c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false; c.fillStyle = '#302b35'; c.fillRect(0, 0, w, h);
    return { canvas, c };
};
function bullFrame(b: SkeletonBullModel, before: boolean, reduced = false) {
    const { canvas, c } = fresh(96, 52);
    c.fillStyle = '#bf8d64'; c.fillRect(0, 0, 96, 47);
    c.fillStyle = '#e6a270'; c.fillRect(0, 47, 96, 2);
    c.translate(48 - (b.x + b.width / 2), 13 - b.y);
    const snapshot = JSON.stringify(b); (before ? oldBull : drawSkeletonBull)(c, b, reduced);
    assert.equal(JSON.stringify(b), snapshot);
    return canvas;
}
const sheet = fresh(768, 6 * 228);
for (const [row, [state, tick]] of ([['idle',0],['tell',28],['charge',4],['brake',7],['recover',12],['rattle',24]] as const).entries()) {
    const b = new SkeletonBullModel(); b.state = state; b.stateTick = tick;
    for (const [column, before] of [true,false].entries()) {
        pixelText(sheet.c, `${before ? 'ANTES' : 'DEPOIS'} / ${state.toUpperCase()}`, column * 384 + 8, row * 228 + 6, '#f0ddae');
        sheet.c.drawImage(bullFrame(b, before) as unknown as CanvasImageSource, column * 384, row * 228 + 20, 384, 208);
    }
}
writeFileSync(join(out, 'ossabravo-poses.png'), sheet.canvas.toBuffer('image/png'));
const gallop = join(out, 'gallop'); mkdirSync(gallop, { recursive: true });
const b = new SkeletonBullModel(); b.state = 'charge';
const stridePoses = [new Set<string>(), new Set<string>()];
for (let tick = 0; tick < 180; tick++) {
    b.stateTick = tick;
    const frame = fresh(768, 232);
    for (const [column, before] of [true,false].entries()) {
        const pose = bullFrame(b, before);
        if (tick < 18) stridePoses[column].add(pose.toBuffer('image/png').toString('base64'));
        pixelText(frame.c, `${before ? 'ANTES' : 'DEPOIS'} / CORRIDA`, column * 384 + 8, 7, '#f0ddae');
        frame.c.drawImage(pose as unknown as CanvasImageSource, column * 384, 24, 384, 208);
    }
    writeFileSync(join(gallop, `${String(tick).padStart(4,'0')}.png`), frame.canvas.toBuffer('image/png'));
}
assert.equal(stridePoses[0].size, 6); assert.ok(stridePoses[1].size >= 16);
const m = new GuairaMayorModel(); m.state = 'idle';
function mayorFrame(tick: number, before: boolean) {
    m.tick = tick;
    const { canvas, c } = fresh(80, 60);
    c.fillStyle = '#d4af87'; c.fillRect(0,0,80,60);
    c.translate(-238,-105);
    (before ? oldMayor : drawGuairaMayor)(c,m);
    return canvas;
}
const blink = join(out, 'blink'); mkdirSync(blink, { recursive: true });
for (let tick = 0; tick < 600; tick += 2) {
    const frame = fresh(640, 264);
    for (const [column, before] of [true,false].entries()) {
        pixelText(frame.c, `${before ? 'ANTES' : 'DEPOIS'} / OLHAR`, column * 320 + 8, 7, '#f0ddae');
        frame.c.drawImage(mayorFrame(tick,before) as unknown as CanvasImageSource, column * 320, 24, 320, 240);
    }
    writeFileSync(join(blink, `${String(tick/2).padStart(4,'0')}.png`), frame.canvas.toBuffer('image/png'));
}
const eyeSheet = fresh(960, 528);
for (const [row,before] of [true,false].entries()) for (const [column,tick] of [273,276,280].entries()) {
    pixelText(eyeSheet.c, `${before?'ANTES':'DEPOIS'} / TICK ${tick}`, column * 320 + 8, row * 264 + 7, '#f0ddae');
    eyeSheet.c.drawImage(mayorFrame(tick,before) as unknown as CanvasImageSource, column * 320, row * 264 + 24, 320, 240);
}
writeFileSync(join(out,'prefeito-olhar.png'),eyeSheet.canvas.toBuffer('image/png'));
const report = { kind: 'production-painters-authored-inspection', baseline: execFileSync('git',['rev-parse',baseline],{encoding:'utf8'}).trim(),
    gameplayVictory: false, spriteScale: 'integer-nearest-neighbor', gallopFPS:60, gallopTicks:180,
    gallopPoses: { before: stridePoses[0].size, after: stridePoses[1].size }, blinkFPS:30, blinkSimulationTicks:600,
    oldBlinkTicks:120, newBlinkTicks:6, simulationMutatedByPainting:false };
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
