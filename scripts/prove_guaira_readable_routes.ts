/** Player-view comparisons and complete, input-only production replays.
 * node --import tsx scripts/prove_guaira_readable_routes.ts OUTPUT CANVAS_MODULE BASELINE
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import type { WorldGame } from '../src/adventure/WorldGame';
import tapes from '../tests/helpers/guairaReadableRoutesReplays.json';
import ascent from '../tests/helpers/guairaAscentReplay.json';
import gallery from '../tests/helpers/guairaGalleryReplay.json';

type Game = WorldGame & { finished: boolean };
type Run = [number, string[]];
interface Canvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const [outArg, canvasArg, baselineArg] = process.argv.slice(2); assert.ok(outArg && canvasArg && baselineArg);
const out = resolve(outArg), baseline = resolve(baselineArg), root = resolve('src/adventure/experimental/guaira');
mkdirSync(out, { recursive: true });
const { createCanvas } = await import(pathToFileURL(resolve(canvasArg)).href) as { createCanvas(w: number, h: number): Canvas };
const prepared = new Set<string>(), beforeHashes: Record<string, string> = {}, currentHashes: Record<string, string> = {};
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
function previous(sourceFile: string): string {
    const name = basename(sourceFile), file = join(out, 'previous-' + name);
    if (prepared.has(name)) return file; prepared.add(name);
    const source = readFileSync(join(baseline, name), 'utf8'); beforeHashes[name] = hash(source); currentHashes[name] = hash(readFileSync(sourceFile));
    writeFileSync(file, source.replace(/from (['"])(\.[^'"]+)\1/g, (_m, _q, relative: string) => {
        const target = resolve(dirname(sourceFile), relative + '.ts');
        return `from ${JSON.stringify(pathToFileURL(existsSync(join(baseline, basename(target))) ? previous(target) : target).href)}`;
    })); return file;
}
const comparisons: object[] = [], replays: object[] = [];
for (const key of ['subida', 'galeria'] as const) for (const before of [true, false]) {
    const source = join(root, key === 'subida' ? 'GuairaAscent.ts' : 'gallery/GuairaGallery.ts');
    const module = await import(pathToFileURL(before ? previous(source) : source).href);
    const Scene = module[key === 'subida' ? 'GuairaAscent' : 'GuairaGallery'] as new(c: HTMLCanvasElement, s: HTMLElement) => Game;
    const cleanups: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanups.push(fn as () => void) });
    for (const target of [h.window, h.document, h.canvas]) Object.assign(target, { removeEventListener() {} });
    const screen = createCanvas(640, 360), frame = createCanvas(320, 180), fc = frame.getContext('2d'); fc.imageSmoothingEnabled = false;
    h.canvas.getContext = () => screen.getContext('2d'); const create = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof create> : create(tag);
    const g = new Scene(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    g.renderer.setTouchControlsVisible(false); g.store.save.preferences.shake = false;
    const state = () => JSON.stringify({ p: g.player.data, o: g.objects, tiles: g.level.data.tiles, camera: g.camera, coins: g.coins, t: g.time });
    const capture = () => {
        const original = state(); g.render(); assert.equal(state(), original, 'painting never changes simulation');
        fc.drawImage(screen as unknown as CanvasImageSource, 0, 0, 320, 180); return frame.toBuffer('image/png');
    };
    let held = new Set<string>();
    function keys(list: string[]) {
        const next = new Set(list);
        for (const k of held) if (!next.has(k)) h.window.dispatch('keyup', { code: k, key: k === 'Space' ? ' ' : k, target: h.canvas });
        for (const k of next) if (!held.has(k)) h.window.dispatch('keydown', { code: k, key: k === 'Space' ? ' ' : k, target: h.canvas });
        held = next;
    }
    function play(runs: Run[], stop = Infinity, observe = (_n: number) => {}) {
        let n = 0;
        for (const [count, input] of runs) {
            keys(input);
            for (let i = 0; i < count && n < stop; i++) { g.update(1000 / 60); observe(++n); }
            if (n >= stop) break;
        } return n;
    }
    const fresh = () => { keys([]); g.load(g.stage.id); };
    try {
        const views = key === 'subida' ? [
            { name: 'canal', runs: [[84, ['ArrowRight']]] as Run[], stop: 84 },
            { name: 'chegada', runs: ascent.runs as Run[], stop: 412 },
            { name: 'escolha', runs: ascent.runs as Run[], stop: 958 }
        ] : [{ name: 'oficina', runs: gallery.runs as Run[], stop: 211 }];
        for (const view of views) {
            fresh(); play(view.runs, view.stop);
            const png = capture(); assert.ok(png.equals(capture()));
            writeFileSync(join(out, `${view.name}-${before ? 'before' : 'after'}.png`), png);
            comparisons.push({ view: view.name, before, nativeUpdates: view.stop, player: { ...g.player.data.position },
                feet: g.player.data.position.y + g.player.data.height, camera: { x: g.camera.x, y: g.camera.y },
                nativeInputOnly: true, manualPoseOrClockChanges: false });
        }
        if (before) continue;
        fresh(); const folder = join(out, key + '-replay'); mkdirSync(folder, { recursive: true });
        let frames = 0, completedAt = 0, minHelmetTop = Infinity, maxFeet = 0, maxCameraStep = 0, previousY = g.camera.y;
        const contacts: Record<string, number> = {}, pickups: Record<string, number> = {};
        const milestones: Record<number, string> = key === 'subida' ? { 200: 'canal', 246: 'saida', 407: 'sacada', 504: 'embarque', 972: 'leitura', 1014: 'mirante', 1069: 'casa' }
            : { 211: 'entrada', 287: 'deposito', 364: 'retorno', 400: 'reencontro', 499: 'segunda-tampa', 683: 'subida' };
        const updates = play(tapes[key].runs as Run[], Infinity, n => {
            assert.equal(g.player.data.isDead, false); assert.equal(g.player.data.hasHelmet, true);
            if (g.finished && !completedAt) completedAt = n;
            const feet = g.player.data.position.y + g.player.data.height;
            minHelmetTop = Math.min(minHelmetTop, g.player.data.position.y - 10 - g.camera.y);
            maxFeet = Math.max(maxFeet, feet - g.camera.y); maxCameraStep = Math.max(maxCameraStep, Math.abs(g.camera.y - previousY)); previousY = g.camera.y;
            if (g.player.data.isGrounded) contacts[Math.round(feet)] = (contacts[Math.round(feet)] ?? 0) + 1;
            for (const id of (g as unknown as { collected: Set<string> }).collected) pickups[id] ??= n;
            if ((n - 1) % 4 === 0) writeFileSync(join(folder, `${String(frames++).padStart(4, '0')}.png`), capture());
            if (milestones[n]) writeFileSync(join(out, `${key}-${milestones[n]}.png`), capture());
        });
        assert.equal(g.finished, true); assert.equal(updates, tapes[key].frames);
        assert.equal(g.coins, key === 'subida' ? 7 : 5); assert.ok(minHelmetTop >= 23); assert.ok(maxFeet <= 172); assert.ok(maxCameraStep <= 8.001);
        writeFileSync(join(out, key + '-complete.png'), capture());
        replays.push({ key, updates, completedAt, seconds: completedAt / 60, videoFrames: frames, videoFps: 15, coins: g.coins,
            complete: true, damage: false, checkpoint: g.store.save.checkpoint?.index, contacts, pickups, minHelmetTop, maxFeet, maxCameraStep,
            nativeInputOnly: true, manualPoseOrClockChanges: false, renderPure: true });
        console.log(JSON.stringify(replays.at(-1)));
    } finally { g.dispose(); cleanups.reverse().forEach(fn => fn()); }
}
const hostName = 'GuairaChapterApp.ts';
beforeHashes[hostName] = hash(readFileSync(join(baseline, hostName)));
currentHashes[hostName] = hash(readFileSync(join(root, 'chapter', hostName)));
writeFileSync(join(out, 'detail-verification.json'), JSON.stringify({ beforeHashes, currentHashes, comparisons, replays }, null, 2));
