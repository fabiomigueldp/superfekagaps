/** Native Canvas/Node evidence, not browser FPS or device QA.
 * node --import tsx scripts/prove_bitmap_font.ts OUTPUT CANVAS_MODULE BASE_CHECKOUT
 * Uses esbuild already supplied by Vite; no additional dependencies are installed.
 * The base checkout must contain the unchanged font and GameUI from c1bd522.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import type * as Font from '../src/graphics/BitmapFont';
import type * as UI from '../src/graphics/GameUI';
import type * as Pixels from '../src/graphics/pixels';

type Bundle = typeof Font & typeof UI & typeof Pixels;
interface NativeCanvas {
  width: number; height: number;
  getContext(type: '2d'): CanvasRenderingContext2D;
  toBuffer(type: 'image/png'): Buffer;
}
const [outArg, canvasArg, baseArg] = process.argv.slice(2);
assert.ok(outArg && canvasArg && baseArg, 'Provide output, installed Canvas module and unchanged base checkout.');
const out = resolve(outArg), base = resolve(baseArg), current = process.cwd();
mkdirSync(out, { recursive: true });
const git = (directory: string, ...args: string[]) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
const verifiedBase = 'c1bd522463b23998e68272542f13558dbf63edc6';
const baselineTree = git(base, 'rev-parse', 'HEAD^{tree}');
assert.equal(baselineTree, git(current, 'rev-parse', `${verifiedBase}^{tree}`), 'Baseline must match the verified base tree.');
const fontPath = 'src/graphics/BitmapFont.ts';
const fontSources = [base, current].map(directory => readFileSync(join(directory, fontPath), 'utf8'));
assert.equal(fontSources[0].trim(), git(base, 'show', `HEAD:${fontPath}`), 'Baseline font must have no working-tree changes.');
const sources = {
  verifiedBase, baselineCheckoutCommit: git(base, 'rev-parse', 'HEAD'), baselineTree,
  candidateCheckoutCommit: git(current, 'rev-parse', 'HEAD'),
  bitmapFontSha256: fontSources.map(source => createHash('sha256').update(source).digest('hex')),
};
const { createCanvas } = await import(pathToFileURL(resolve(canvasArg)).href) as {
  createCanvas(w: number, h: number): NativeCanvas;
};
for (const file of ['GameUI.ts', 'pixels.ts']) assert.equal(
  readFileSync(join(base, 'src/graphics', file), 'utf8'),
  readFileSync(join(current, 'src/graphics', file), 'utf8'), `${file} must be unchanged.`);
Object.assign(globalThis, { document: { createElement: () => createCanvas(1, 1) } });
const modules: Bundle[] = [];
for (const [index, directory] of [base, current].entries()) {
  const outfile = join(out, `${index ? 'after' : 'before'}.mjs`);
  await build({
    stdin: { contents: ['BitmapFont', 'GameUI', 'pixels'].map(name =>
      `export * from ${JSON.stringify(join(directory, 'src/graphics', name))};`).join('\n'), loader: 'ts', resolveDir: directory },
    bundle: true, minify: true, platform: 'node', format: 'esm', outfile,
  });
  modules.push(await import(pathToFileURL(outfile).href) as Bundle);
}

// Exhaustive legacy-operation parity across all code points, including lone
// surrogate inputs. Avoid hashes here: compare every coordinate and width.
const operationBuffers = [[], []] as number[][];
const recording = operationBuffers.map(values => ({ fillStyle: '',
  fillRect(x: number, y: number, w: number, h: number) { values.push(x, y, w, h); },
}) as unknown as CanvasRenderingContext2D);
let unicodeDraws = 0;
for (let point = 0; point <= 0x10ffff; point++) {
  const value = String.fromCodePoint(point);
  for (let side = 0; side < 2; side++) {
    operationBuffers[side].length = 0;
    modules[side].pixelText(recording[side], value, 13.2, 10.7, '#123456', 1.25, 'center');
  }
  assert.equal(modules[0].textWidth(value), modules[1].textWidth(value), `Width U+${point.toString(16)}`);
  assert.equal(operationBuffers[0].length, operationBuffers[1].length);
  for (let i = 0; i < operationBuffers[0].length; i++)
    assert.equal(operationBuffers[0][i], operationBuffers[1][i], `Draw U+${point.toString(16)}`);
  unicodeDraws += operationBuffers[0].length / 4;
}

const hud: UI.HudModel = { score: 14560, lives: 3, time: 156, level: 'BOSS: JOÃOZÃO',
  soundEnabled: true, hasHelmet: true, miniFantaTimer: 4500, coins: 43, bossHealth: 2 };
const renderers = modules.map(module => new module.GameUI(new module.SpriteAtlas()));
const frames: object[] = [];
for (const mode of ['hud', 'title', 'text'] as const) for (let step = 0; step < 6; step++) {
  const images = modules.map((font, side) => {
    const canvas = createCanvas(320, 180), c = canvas.getContext('2d');
    c.fillStyle = '#324456'; c.fillRect(0, 0, 320, 180);
    if (mode === 'hud') renderers[side].hud(c, { ...hud, time: 28 + step, coins: step,
      soundEnabled: step % 2 === 0, hasHelmet: step % 2 === 1, bossHealth: step % 4 });
    else if (mode === 'title') renderers[side].title(c, step * 700, step % 2 === 0);
    else {
      c.globalAlpha = .3 + step * .1;
      c.globalCompositeOperation = step % 2 ? 'xor' : 'source-over';
      c.translate(.3, .7); c.scale(1.2, .8);
      c.beginPath(); c.rect(2, 2, 250, 130); c.clip();
      for (const [row, value] of ['áàâãéêíóôõúüç', 'a\u0301 A\u0303\u0327 ß ﬁ İ Å', '未知 🦊 𝒜 \ud800', '← → ↓ ↑ × ★ ♥'].entries())
        font.pixelText(c, value, 160.3, 18 + row * 30, row % 2 ? 'rgba(40,200,80,.6)' : '#ffefbc', [.5, 1, 1.25, 2][step % 4], ['left', 'center', 'right'][step % 3] as 'left');
    }
    return canvas;
  });
  const bytes = images.map(image => image.getContext('2d').getImageData(0, 0, 320, 180).data);
  assert.deepEqual(bytes[1], bytes[0], `${mode}-${step} must be bit-identical.`);
  frames.push({ mode, step, rgbaSha256: createHash('sha256').update(bytes[0]).digest('hex') });
  if (step === 0) writeFileSync(join(out, `${mode}.png`), images[1].toBuffer('image/png'));
}

// Warm production-minified GameUI, sample allocation volume separately, then
// time alternating rounds. Read one pixel every paint to flush native raster work.
const iterations = 400, timings: Record<string, number[][]> = { hud: [[], []], title: [[], []] };
const contexts = modules.map(() => createCanvas(320, 180).getContext('2d'));
function paint(side: number, mode: 'hud' | 'title', frame: number) {
  const c = contexts[side]; c.clearRect(0, 0, 320, 180);
  if (mode === 'hud') renderers[side].hud(c, { ...hud, time: 156 - frame / 60 });
  else renderers[side].title(c, frame * 1000 / 60, false);
  c.getImageData(0, 0, 1, 1);
}
const sampledBytes: number[] = [];
for (let side = 0; side < 2; side++) {
  for (let frame = 0; frame < iterations; frame++) { paint(side, 'hud', frame); paint(side, 'title', frame); }
  const inspector = new Session(); inspector.connect();
  await inspector.post('HeapProfiler.enable');
  await inspector.post('HeapProfiler.startSampling', {
    samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true,
  });
  for (let frame = 0; frame < iterations; frame++) { paint(side, 'hud', frame); paint(side, 'title', frame); }
  const { profile } = await inspector.post('HeapProfiler.stopSampling');
  let bytes = 0;
  const visit = (node: typeof profile.head) => {
    if (node.callFrame.url.endsWith(side ? '/after.mjs' : '/before.mjs')) bytes += node.selfSize;
    node.children.forEach(visit);
  };
  visit(profile.head); sampledBytes.push(bytes); inspector.disconnect();
  writeFileSync(join(out, `${side ? 'after' : 'before'}.heap.json`), JSON.stringify(profile));
}
for (const mode of ['hud', 'title'] as const) for (let round = 0; round < 9; round++)
  for (const side of round % 2 ? [1, 0] : [0, 1]) {
    const start = performance.now();
    for (let frame = 0; frame < iterations; frame++) paint(side, mode, frame);
    timings[mode][side].push((performance.now() - start) / iterations);
  }
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const report = {
  kind: 'Node + native Canvas; production-minified helper/UI bundles; not browser FPS',
  sources, node: process.version, iterationsPerRound: iterations, alternatingRounds: 9,
  timing: Object.fromEntries(Object.entries(timings).map(([mode, rounds]) => [mode, { roundsMs: rounds, medianMs: rounds.map(median) }])),
  allocation: { method: 'V8 sampling interval 512, including collected objects, selfSize attributed to minified GameUI bundles; estimates of allocation volume, not retained heap or peak memory',
    hudTitlePairs: iterations, sampledBytes, reduction: 1 - sampledBytes[1] / sampledBytes[0] },
  parity: { unicodeCodePointsIncludingSurrogates: 0x110000, orderedRectanglesCompared: unicodeDraws, nativeRgbaFrames: frames },
  cache: 'Only fixed authored glyph coordinates and five accent tables. No caller text, colors, canvas, contexts or runtime variants retained; no disposal hook required.',
};
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
