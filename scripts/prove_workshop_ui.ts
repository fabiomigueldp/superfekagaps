/** Actual production 320×180 raster evidence. DOM/device layout needs browser QA.
 * node --import tsx scripts/prove_workshop_ui.ts OUTPUT INSTALLED_CANVAS_MODULE
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorldGame } from '../src/adventure/WorldGame';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(format: 'image/png'): Buffer }
const out = resolve(process.argv[2]);
const { createCanvas } = await import(pathToFileURL(resolve(process.argv[3])).href) as { createCanvas(w: number, h: number): NativeCanvas };
mkdirSync(out, { recursive: true });
const sheet = createCanvas(1280, 1140), sc = sheet.getContext('2d'); sc.imageSmoothingEnabled = false;
sc.fillStyle = '#191f35'; sc.fillRect(0, 0, 1280, 1140);
const report: object[] = [];
for (const [index, scene] of ['title', 'playing', 'paused', 'settings', 'boss', 'equipped'].entries()) {
    const cleanup: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanup.push(fn as () => void) });
    for (const surface of [h.window, h.document, h.canvas]) Object.assign(surface, { removeEventListener() {} });
    const screen = createCanvas(640, 360); h.canvas.getContext = () => screen.getContext('2d');
    const create = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof create> : create(tag);
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    game.renderer.setTouchControlsVisible(false);
    const internal = game as unknown as { pause(): void; settings(from: string): void; toastTimer: number };
    if (scene !== 'title') {
        const id = scene === 'boss' ? '1-5' : '1-1';
        game.store.save.seen.push(`intro:${id}`); game.load(id); internal.toastTimer = 0;
        if (scene !== 'boss') { game.camera.x = 0; game.camera.y = 95; }
        // Explicit display fixture, not a claim that these items were earned.
        game.coins = 24;
        if (scene === 'equipped') game.player.collectHelmet();
        if (scene === 'paused') internal.pause();
        if (scene === 'settings') internal.settings('paused');
    }
    const state = () => JSON.stringify({ player: game.player.data, save: game.store.save, coins: game.coins, time: game.time, elapsed: game.elapsed });
    const before = state(); game.render(); assert.equal(state(), before, 'UI paint must not alter gameplay/save state');
    const frame = createCanvas(320, 180), fc = frame.getContext('2d'); fc.imageSmoothingEnabled = false;
    fc.drawImage(screen as unknown as CanvasImageSource, 0, 0, 320, 180);
    const filename = `${scene}-native.png`; writeFileSync(join(out, filename), frame.toBuffer('image/png'));
    const column = index % 2, row = Math.floor(index / 2);
    sc.fillStyle = '#f5efd3'; sc.font = '12px monospace'; sc.fillText(`${scene.toUpperCase()} · native 320×180, nearest-neighbour 2× overview`, column * 640 + 8, row * 380 + 14);
    sc.drawImage(frame as unknown as CanvasImageSource, column * 640, row * 380 + 20, 640, 360);
    report.push({ scene, file: filename, nativeSize: [320, 180], gameplayAndSaveUnchanged: true });
    game.dispose(); cleanup.reverse().forEach(fn => fn());
}
writeFileSync(join(out, 'overview.png'), sheet.toBuffer('image/png'));
writeFileSync(join(out, 'report.json'), JSON.stringify({ kind: 'Node + native Canvas, production painter; not browser/device QA', fixtureCoins: 24, frames: report }, null, 2));
console.log(JSON.stringify(report));
