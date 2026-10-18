/** Art inspection only: explicit poses drawn by the production sprite renderer. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { HypotheticalModel } from '../src/adventure/hipotetico/HypotheticalModel';
import { dinosaurPose, drawHypotheticalDinosaur } from '../src/adventure/hipotetico/HypotheticalArt';
import { pixelText } from '../src/graphics/BitmapFont';

const [destination, canvasModule] = process.argv.slice(2);
assert.ok(destination && canvasModule, 'Pass output PNG and canvas module paths');
const { createCanvas } = await import(pathToFileURL(resolve(canvasModule)).href);
const canvas = createCanvas(768, 456), c = canvas.getContext('2d');
const poses: readonly (readonly [string, Partial<HypotheticalModel>])[] = [
    ['REPOUSO', { state: 'rest', age: 20, tick: 40 }],
    ['RAJADA', { state: 'attack', attack: 'rifle', age: 20, tick: 100, muzzle: 4, heat: .8 }],
    ['INVESTIDA', { state: 'attack', attack: 'charge', age: 22, tick: 170, velocity: 5, motionSpeed: 5, travel: 18 }],
    ['FRENAGEM', { state: 'attack', attack: 'charge', age: 45, tick: 200, velocity: 1, motionSpeed: 2, riderSway: 3, travel: 180 }],
    ['SALTO', { state: 'attack', attack: 'leap', age: 29, tick: 240 }],
    ['POUSO', { state: 'attack', attack: 'leap', age: 60, tick: 271 }],
    ['VIRADA', { state: 'turn', attack: 'charge', age: 18, tick: 400, pivotAge: 6 }],
    ['TRES QUARTOS', { state: 'turn', attack: 'charge', age: 16, tick: 398, pivotAge: 4 }],
    ['MORDIDA', { state: 'attack', attack: 'bite', age: 17, tick: 420 }],
    ['RECARGA', { state: 'reload', attack: 'rifle', age: 12, tick: 460, motionSpeed: 2, velocity: 2, travel: 120 }],
    ['ABERTURA', { state: 'recover', attack: 'bite', age: 20, tick: 520, health: 3 }],
    ['DERROTA', { state: 'won', attack: 'bite', age: 30, tick: 550, health: 0 }],
];
for (let i = 0; i < poses.length; i++) {
    const [label, state] = poses[i], b = new HypotheticalModel('duel');
    Object.assign(b, state, { x: 96, y: 132, facing: 1, targetX: 185, targetY: 112 });
    const snapshot = JSON.stringify(b);
    c.save(); c.translate(i % 4 * 192, Math.floor(i / 4) * 152);
    c.fillStyle = i % 2 ? '#30434b' : '#293e47'; c.fillRect(0, 0, 192, 152);
    c.fillStyle = '#485950'; c.fillRect(0, 132, 192, 1);
    drawHypotheticalDinosaur(c, dinosaurPose(b, 0, 0));
    pixelText(c, label, 7, 141, '#e7cb9c', 1); c.restore();
    assert.equal(JSON.stringify(b), snapshot, 'Painting a pose must never advance combat');
}
const file = resolve(destination); mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, canvas.toBuffer('image/png'));
console.log(JSON.stringify({ file, width: canvas.width, height: canvas.height, poses: poses.length, artInspectionOnly: true }));
