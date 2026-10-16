/** Production-painter inspection, deliberately authored poses rather than a playthrough.
 * node --import tsx scripts/prove_guaira_life.ts OUTPUT CANVAS_MODULE BASELINE_DIRECTORY
 * Baseline files are snapshots taken before this round, including earlier material work.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorldObjects } from '../src/adventure/WorldPhysics';
import { guairaAscentStage } from '../src/adventure/experimental/guaira/GuairaAscent';
import { drawGuairaAscentObjects } from '../src/adventure/experimental/guaira/GuairaAscentArt';
import { drawGuairaWorker, type GuairaWorkerKind } from '../src/adventure/experimental/guaira/GuairaWorkerArt';
import { drawGuairaRicePlant } from '../src/adventure/experimental/guaira/GuairaRiceArt';
import { pixelText } from '../src/graphics/BitmapFont';

interface Canvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const [outArg, canvasArg, baselineArg] = process.argv.slice(2);
assert.ok(outArg && canvasArg && baselineArg);
const out = resolve(outArg), baseline = resolve(baselineArg);
mkdirSync(out, { recursive: true });
const { createCanvas } = await import(pathToFileURL(resolve(canvasArg)).href) as { createCanvas(w: number, h: number): Canvas };
const sourceRoot = resolve('src/adventure/experimental/guaira');
const baselineHashes: Record<string, string> = {};
async function oldPainter(file: string) {
    const source = readFileSync(join(baseline, `${file}.ts`), 'utf8');
    baselineHashes[file] = createHash('sha256').update(source).digest('hex');
    const rewritten = source.replace(/from (['"])(\.[^'"]+)\1/g, (_match, _quote, relative: string) =>
        `from ${JSON.stringify(pathToFileURL(resolve(sourceRoot, relative + '.ts')).href)}`);
    const filePath = join(out, `baseline-${file}.ts`); writeFileSync(filePath, rewritten);
    return import(pathToFileURL(filePath).href);
}
const oldWorker = (await oldPainter('GuairaWorkerArt')).drawGuairaWorker as typeof drawGuairaWorker;
const oldAscent = (await oldPainter('GuairaAscentArt')).drawGuairaAscentObjects as typeof drawGuairaAscentObjects;
const objects = new WorldObjects(guairaAscentStage().mechanisms);
const fresh = (w: number, h: number, color = '#302b35') => {
    const canvas = createCanvas(w,h), c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = color; c.fillRect(0,0,w,h); return { canvas,c };
};
const kinds = ['pump','rice','inspector'] as const;
const labels = ['MECANICO','ARROZAL','INSPETOR'];
function workerFrame(kind: GuairaWorkerKind, time: number, before: boolean, watching = false) {
    const { canvas,c } = fresh(40,36,'#d3b68b');
    c.fillStyle='#b28d65'; c.fillRect(0,33,40,3);
    if (kind === 'inspector' && before) {
        const surface = createCanvas(320,180), context = surface.getContext('2d');
        const snapshot = JSON.stringify(objects);
        oldAscent(context,objects,440,168,time,false);
        assert.equal(JSON.stringify(objects),snapshot);
        c.drawImage(surface as unknown as CanvasImageSource,123,98,24,29,8,4,24,29);
    } else {
        const state = Object.freeze({ activeTimeMs:time,valveActive:watching,bridgeRise:.5,reducedMotion:false });
        (before ? oldWorker : drawGuairaWorker)(c,16,33,kind,state);
    }
    return canvas;
}
const counts: Record<string,{before:number;after:number}> = {};
for (const kind of kinds) {
    const before = new Set<string>(), after = new Set<string>();
    for (let time=0;time<3600;time+=20) {
        before.add(workerFrame(kind,time,true).toBuffer('image/png').toString('base64'));
        after.add(workerFrame(kind,time,false).toBuffer('image/png').toString('base64'));
    }
    assert.ok(after.size>=7);
    counts[kind] = {before:before.size,after:after.size};
}
// All three workers, before above / after below, using exactly the same clock.
const folder=join(out,'workers');mkdirSync(folder,{recursive:true});
for(let frame=0;frame<216;frame++) {
    const {canvas,c}=fresh(720,480),time=frame*1000/30;
    for(const [row,before] of [true,false].entries()) for(const [column,kind] of kinds.entries()) {
        pixelText(c,`${before?'ANTES':'DEPOIS'} / ${labels[column]}`,column*240+8,row*240+8,'#f0ddae');
        c.drawImage(workerFrame(kind,time,before) as unknown as CanvasImageSource,column*240,row*240+24,240,216);
    }
    writeFileSync(join(folder,`${String(frame).padStart(4,'0')}.png`),canvas.toBuffer('image/png'));
}
const poses=fresh(1008,3*228);
for(const [row,kind] of kinds.entries()) for(const [column,beat] of [0,1480,1700,1920,2150,2370,3050].entries()) {
    const offset=kind==='rice'?730:kind==='inspector'?390:0;
    const time=(beat-offset+3600)%3600;
    pixelText(poses.c,`${labels[row]} ${beat}`,column*144+4,row*228+6,'#f0ddae');
    poses.c.drawImage(workerFrame(kind,time,false) as unknown as CanvasImageSource,column*144+12,row*228+24,120,108);
    // Enlarged crop below makes the hands and tool legible without smoothing.
    poses.c.drawImage(workerFrame(kind,time,false) as unknown as CanvasImageSource,6,8,28,18,column*144+2,row*228+138,140,90);
}
writeFileSync(join(out,'worker-poses.png'),poses.canvas.toBuffer('image/png'));
const rice=fresh(720,288);
for(let row=0;row<2;row++) {
    pixelText(rice.c,row?'ARROZAL AO FUNDO':'ARROZAL PROXIMO',8,row*144+8,'#f0ddae');
    const field=fresh(180,30,'#c8b38b');
    for(let column=0;column<8;column++) drawGuairaRicePlant(field.c,12+column*22,27,6400,8+column*43,column%3,15+column%6,Boolean(row));
    rice.c.drawImage(field.canvas as unknown as CanvasImageSource,0,row*144+24,720,120);
}
writeFileSync(join(out,'rice-variants.png'),rice.canvas.toBuffer('image/png'));
const reactions=fresh(720,240);
for(const [column,kind] of kinds.entries()) {
    pixelText(reactions.c,`${labels[column]} / ATENTO`,column*240+8,8,'#f0ddae');
    reactions.c.drawImage(workerFrame(kind,0,false,true) as unknown as CanvasImageSource,column*240,24,240,216);
}
writeFileSync(join(out,'worker-reactions.png'),reactions.canvas.toBuffer('image/png'));
const report={kind:'production-painters-authored-inspection',baseline:'pre-round source snapshots',baselineHashes,
    gameplayVictory:false,fps:30,seconds:7.2,workCycleMs:3600,blinkMs:80,poses:counts,
    spriteScale:'integer-nearest-neighbor',stateUnchanged:true};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
