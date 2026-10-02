// Compare two outputs of prove_guaira_bull_hud.mjs and write paired native frames.
// node --import tsx scripts/compare_guaira_bull_hud.mjs BEFORE AFTER OUTPUT CANVAS_MODULE
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pixelText } from '../src/graphics/BitmapFont.ts';
const [beforeArg, afterArg, outputArg, canvasModule = '@napi-rs/canvas'] = process.argv.slice(2);
assert.ok(beforeArg && afterArg && outputArg, 'Provide before, after and comparison output directories');
const beforeDir = resolve(beforeArg), afterDir = resolve(afterArg), output = resolve(outputArg);
const before = JSON.parse(readFileSync(`${beforeDir}/report.json`, 'utf8'));
const after = JSON.parse(readFileSync(`${afterDir}/report.json`, 'utf8'));
const { createCanvas, loadImage } = createRequire(import.meta.url)(canvasModule);
mkdirSync(output, { recursive: true });
const cases = [], images = new Map();
for (const b of before.cases) {
    const a = after.cases.find(c => c.name === b.name); assert.ok(a, b.name);
    assert.equal(a.digest, b.digest, `${b.name}: gameplay must be identical frame for frame`);
    assert.equal(a.rows.length, b.rows.length);
    for (let i = 0; i < a.rows.length; i++) {
        assert.equal(a.rows[i].actorSha256, b.rows[i].actorSha256, `${b.name}/${i}: same native actor`);
        assert.equal(a.rows[i].coveredPixels, 0, `${b.name}/${i}: no HUD pixel over Feka`);
    }
    for (const row of a.images) {
        assert.ok(b.images.some(old => old.file === row.file && old.frame === row.frame));
        const pair = await Promise.all([beforeDir, afterDir].map(dir => loadImage(`${dir}/${row.file}`)));
        const raster = pair.map(img => { const c = createCanvas(320, 180); c.getContext('2d').drawImage(img, 0, 0);
            return c.getContext('2d').getImageData(0, 0, 320, 180).data; });
        for (let y = 23; y < 180; y++) for (let x = 0; x < 320; x++) {
            // Old campaign panel plus its two-pixel shadow; everything else is unchanged.
            if (x >= 64 && x < 258 && y >= 26 && y < 52) continue;
            const i = (y * 320 + x) * 4;
            for (let c = 0; c < 4; c++) assert.equal(raster[0][i + c], raster[1][i + c], `${row.file}: changed arena pixel at ${x},${y}`);
        }
        images.set(row.file, pair);
    }
    cases.push({ name: a.name, frames: a.frameCount, sameSimulation: true, samePlayerRaster: true,
        beforeOverlapFrames: b.overlapFrames, afterOverlapFrames: a.overlapFrames,
        beforeMaximumCoveredPixels: b.worst.coveredPixels, afterMaximumCoveredPixels: a.worst.coveredPixels,
        minimumActorY: a.minimumActorY, stateDigest: a.digest });
}
async function sheet(filename, rows) {
    const canvas = createCanvas(640, rows.length * 192 + 14), c = canvas.getContext('2d');
    c.fillStyle = '#211b2b'; c.fillRect(0, 0, canvas.width, canvas.height); c.imageSmoothingEnabled = false;
    pixelText(c, 'ANTES', 8, 3, '#f0ddae'); pixelText(c, 'DEPOIS', 328, 3, '#f0ddae');
    rows.forEach(([file, title], i) => {
        assert.ok(images.has(file), file);
        const pair = images.get(file), y = 14 + i * 192;
        pixelText(c, title, 8, y + 1, '#edcaf5');
        c.drawImage(pair[0], 0, y + 12); c.drawImage(pair[1], 320, y + 12);
    });
    writeFileSync(`${output}/${filename}.png`, canvas.toBuffer('image/png'));
}
await sheet('jump-before-after-native', [1, 13, 21, 23, 31, 40].map(frame => [`held-${String(frame).padStart(2, '0')}.png`, `SALTO NORMAL - FRAME ${frame}`]));
await sheet('combat-before-after-native', ['tell', 'charge', 'rattle', 'bones', 'brake', 'recover'].map(phase => [`winning-${phase}.png`, phase.toUpperCase()]));
await sheet('summaries-before-after-native', [['pause-jump-paused.png', 'PAUSA NO SALTO'], ['winning-victory.png', 'VITORIA - CONTINUAR A MAQUETE'], ['winning-victory-paused.png', 'VITORIA PAUSADA']]);
writeFileSync(`${output}/comparison.json`, JSON.stringify({ cases, sampledArenaPixelsUnchangedOutsideFormerPanel: true,
    capture: 'Actual game renderer, native 320x180, unchanged ordinary inputs. Offline Canvas; not browser or human playtest.' }, null, 2));
console.log(JSON.stringify(cases, null, 2));
