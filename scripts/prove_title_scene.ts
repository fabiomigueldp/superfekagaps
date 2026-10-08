/** Production raster review, no browser or external image assets.
 * node --import tsx scripts/prove_title_scene.ts OUTPUT INSTALLED_CANVAS_MODULE
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorldGame } from '../src/adventure/WorldGame';
import { pixelText } from '../src/graphics/BitmapFont';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';

interface NativeCanvas {
    width: number; height: number;
    getContext(type: '2d'): CanvasRenderingContext2D;
    toBuffer(format: 'image/png'): Buffer;
}
const out = resolve(process.argv[2]);
const { createCanvas } = await import(pathToFileURL(resolve(process.argv[3])).href) as { createCanvas(w: number, h: number): NativeCanvas };
mkdirSync(out, { recursive: true });
const report: object[] = [];
const sheet = createCanvas(1280, 1140), sc = sheet.getContext('2d');
sc.imageSmoothingEnabled = false; sc.fillStyle = '#191f35'; sc.fillRect(0, 0, 1280, 1140);
for (const reducedMotion of [false, true]) {
    const cleanup: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanup.push(fn as () => void) }, { reducedMotion });
    for (const target of [h.window, h.document, h.canvas]) Object.assign(target, { removeEventListener() {} });
    const screen = createCanvas(640, 360); h.canvas.getContext = () => screen.getContext('2d');
    const create = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof create> : create(tag);
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    const frame = createCanvas(320, 180), c = frame.getContext('2d'); c.imageSmoothingEnabled = false;
    const save = JSON.stringify(game.store.save);
    const paint = (time: number) => {
        game.time = time; game.render(); c.drawImage(screen as unknown as CanvasImageSource, 0, 0, 320, 180);
        assert.equal(JSON.stringify(game.store.save), save, 'Scenery never changes saved progression');
        return frame.toBuffer('image/png');
    };
    const times = [0, 7100, 21900, 37000, 69000, 1200000];
    let first: Buffer | undefined, ground: Uint8ClampedArray | undefined;
    for (const [index, time] of times.entries()) {
        const png = paint(time), nativeName = `${reducedMotion ? 'still' : 'title'}-${time}.png`;
        writeFileSync(join(out, nativeName), png);
        if (reducedMotion && first) assert.ok(png.equals(first), 'Reduced motion is pixel-identical at every time');
        first ??= png;
        const pixels = c.getImageData(0, 174, 320, 6).data;
        if (ground) assert.deepEqual(pixels, ground, 'The ground never slides under the cast');
        ground = pixels;
        if (!reducedMotion) {
            const x = index % 2 * 640, y = Math.floor(index / 2) * 380;
            pixelText(sc, `${time / 1000} S - CENA NATIVA 2X`, x + 8, y + 6, '#f5efd3');
            sc.drawImage(frame as unknown as CanvasImageSource, x, y + 20, 640, 360);
        }
    }
    const repeat = paint(7100); paint(94000); assert.ok(paint(7100).equals(repeat), 'Draw order never advances animation');
    const start = performance.now(); for (let i = 0; i < 240; i++) { game.time = i * 1000 / 60; game.render(); }
    report.push({ reducedMotion, times, repeatable: true, stationaryGround: true, saveUnchanged: true,
        nativeCanvasMeanRenderMs: (performance.now() - start) / 240 });
    game.dispose(); cleanup.reverse().forEach(fn => fn());
}
writeFileSync(join(out, 'overview.png'), sheet.toBuffer('image/png'));
writeFileSync(join(out, 'report.json'), JSON.stringify({ kind: 'Offline production Canvas; browser verification is separate', scenes: report }, null, 2));
console.log(JSON.stringify(report, null, 2));
