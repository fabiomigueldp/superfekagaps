/** Production art comparisons plus native keyboard routes, kept separate.
 * node --import tsx scripts/prove_guaira_pressure.ts OUTPUT CANVAS_MODULE BASELINE
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { WorldGame } from '../src/adventure/WorldGame';
import type { JunctionRouting } from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import { pixelText } from '../src/graphics/BitmapFont';
import { TileType } from '../src/constants';
import { jetCycle } from '../src/adventure/WorldMachineState';

interface Canvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
type Game = WorldGame & { routing?: JunctionRouting; finished: boolean };
type Run = [number, string[]];
const [outArg, canvasArg, baselineArg] = process.argv.slice(2);
assert.ok(outArg && canvasArg && baselineArg);
const out = resolve(outArg), baseline = resolve(baselineArg), root = resolve('src/adventure/experimental/guaira');
mkdirSync(out, { recursive: true });
const { createCanvas, loadImage } = await import(pathToFileURL(resolve(canvasArg)).href) as {
    createCanvas(w: number, h: number): Canvas; loadImage(bytes: Buffer): Promise<CanvasImageSource>;
};
const hashes: Record<string, string> = {}, snapshots: object[] = [], replays: object[] = [];
const prepared = new Set<string>();
function previous(folder: string, name: string): string {
    const file = join(out, `baseline-${name}.ts`);
    if (prepared.has(name)) return file;
    prepared.add(name);
    const source = readFileSync(join(baseline, name + '.ts'), 'utf8');
    hashes[name] = createHash('sha256').update(source).digest('hex');
    writeFileSync(file, source.replace(/from (['"])(\.[^'"]+)\1/g, (_match, _quote, relative: string) => {
        const dependency = basename(relative);
        const target = existsSync(join(baseline, dependency + '.ts'))
            ? previous(dirname(resolve(root, folder, relative)), dependency)
            : resolve(root, folder, relative + '.ts');
        return `from ${JSON.stringify(pathToFileURL(target).href)}`;
    }));
    return file;
}
const fresh = (w: number, h: number) => {
    const canvas = createCanvas(w, h), c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false; c.fillStyle = '#302b35'; c.fillRect(0, 0, w, h);
    return { canvas, c };
};
for (const config of [
    { key: 'patio', folder: 'junction', game: 'GuairaJunction', art: 'GuairaJunctionArt', prefix: 'drawJunction' },
    { key: 'alivio', folder: 'relief', game: 'GuairaRelief', art: 'GuairaReliefArt', prefix: 'drawRelief' },
] as const) {
    const old = await import(pathToFileURL(previous(config.folder, config.art)).href);
    const current = await import(pathToFileURL(resolve(root, config.folder, config.art + '.ts')).href);
    const cleanups: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanups.push(fn as () => void) });
    for (const target of [h.window, h.document, h.canvas]) Object.assign(target, { removeEventListener() {} });
    const screen = createCanvas(640, 360); h.canvas.getContext = () => screen.getContext('2d');
    const create = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof create> : create(tag);
    const module = await import(pathToFileURL(resolve(root, config.folder, config.game + '.ts')).href);
    const Scene = module[config.game] as new (canvas: HTMLCanvasElement, status: HTMLElement) => Game;
    const game = new Scene(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    game.renderer.setTouchControlsVisible(false); game.store.save.preferences.shake = false;
    const frame = createCanvas(320, 180), fc = frame.getContext('2d'); fc.imageSmoothingEnabled = false;
    function painters(before: boolean, reduced = false) {
        const a = before ? old : current, p = config.prefix;
        if (config.key === 'patio') {
            game.art.background = (c, _i, x, y) => a[p + 'Background'](c, x, y, game.objects.time, reduced, game.routing);
            game.art.objects = (c, objects, x, y) => a[p + 'Objects'](c, objects, x, y, objects.time, reduced, game.routing);
        } else {
            game.art.background = (c, _i, x, y) => a[p + 'Background'](c, game.level, x, y, game.objects.time, reduced);
            game.art.objects = (c, objects, x, y) => a[p + 'Objects'](c, objects, x, y, reduced);
        }
        game.art.terrain = (c, level, _i, x, y) => a[p + 'Terrain'](c, level, x, y, reduced);
    }
    function capture(before: boolean, reduced = false) {
        painters(before, reduced);
        const state = () => JSON.stringify({ p: game.player.data, o: game.objects, r: game.routing, tiles: game.level.data.tiles, camera: game.camera, save: game.store.save });
        const saved = state(); game.render(); assert.equal(state(), saved);
        fc.drawImage(screen as unknown as CanvasImageSource, 0, 0, 320, 180);
        return frame.toBuffer('image/png');
    }
    const poses = config.key === 'patio' ? [
        { key: 'patio-seletor', cx: 170, cy: 180, x: 210, feet: 304, time: 1400, open: false, supply: 'a' as const, pending: true },
        { key: 'patio-curvas', cx: 240, cy: 128, x: 432, feet: 256, time: 1600, open: false, supply: 'b' as const, pending: false },
        { key: 'patio-base', cx: 240, cy: 230, x: 260, feet: 304, time: 1600, open: false, supply: 'a' as const, pending: false },
    ] : [
        { key: 'alivio-rede', cx: 200, cy: 176, x: 352, feet: 336, time: 1500, open: false, supply: 'a' as const, pending: false },
        { key: 'alivio-retorno', cx: 200, cy: 176, x: 352, feet: 336, time: 1500, open: true, supply: 'a' as const, pending: false },
        { key: 'alivio-camara', cx: 112, cy: 96, x: 230, feet: 160, time: 3000, open: true, supply: 'a' as const, pending: false },
    ];
    const pose = (p: typeof poses[number]) => {
        game.load(game.stage.id); game.player.data.respawnRevealTimer = 0;
        game.camera.x = p.cx; game.camera.y = p.cy;
        game.player.data.position.x = p.x; game.player.data.position.y = p.feet - game.player.data.height;
        game.time = game.objects.time = p.time;
        if (game.routing) {
            game.routing.selected = p.pending ? 'b' : p.supply; game.routing.supplied = p.supply;
            game.routing.warningRemaining = p.pending ? 200 : 0;
            for (const [id, outlet, y] of [['junction-deck-a','a',304],['junction-deck-b','b',208]] as const) {
                const b = game.objects.get(id)!; b.active = p.supply === outlet; b.y = b.py = b.active ? y : 400;
            }
        } else if (p.open) {
            game.level.data.tiles[10][15] = TileType.EMPTY;
            const b = game.objects.get('relief-service-grate')!; b.active = b.observedActive = true;
        }
    };
    const sheet = fresh(1280, 1152);
    for (const [row, p] of poses.entries()) {
        pose(p);
        for (const [col, before] of [true, false].entries()) {
            const png = capture(before); writeFileSync(join(out, `${p.key}-${before ? 'before' : 'after'}.png`), png);
            pixelText(sheet.c, `${before ? 'ANTES' : 'DEPOIS'} / ${p.key.toUpperCase()}`, col * 640 + 8, row * 384 + 8, '#f0ddae');
            sheet.c.drawImage(await loadImage(png), col * 640, row * 384 + 24, 640, 360);
        }
        const first = capture(false); game.objects.time = 0; capture(false); game.objects.time = p.time;
        assert.ok(first.equals(capture(false)), 'painting must repeat');
        const reduced = capture(false, true); game.objects.time = p.time + 100;
        assert.ok(reduced.equals(capture(false, true)), 'reduced decoration must freeze');
        snapshots.push({ ...p, deterministic: true, stateUnchanged: true, authoredPose: true });
    }
    writeFileSync(join(out, config.key + '-sheet.png'), sheet.canvas.toBuffer('image/png'));
    pose(poses[1]); const folder = join(out, config.key + '-motion'); mkdirSync(folder, { recursive: true });
    for (let i = 0; i < 126; i++) {
        game.time = game.objects.time = i * 1000 / 30;
        const pair = fresh(1280, 384);
        for (const [col, before] of [true, false].entries()) {
            pixelText(pair.c, `${before ? 'ANTES' : 'DEPOIS'} / ${config.key.toUpperCase()}`, col * 640 + 8, 8, '#f0ddae');
            pair.c.drawImage(await loadImage(capture(before)), col * 640, 24, 640, 360);
        }
        writeFileSync(join(folder, `${String(i).padStart(4,'0')}.png`), pair.canvas.toBuffer('image/png'));
    }
    if (config.key === 'alivio') {
        const recording = JSON.parse(readFileSync('tests/helpers/guairaReliefReplay.json', 'utf8')) as Record<string, Run[]>;
        const routes = { maintenance: recording.maintenance, interval: recording.interval,
            discharge: [...recording.maintenance.slice(0,10),[124,[]],[8,['Space']],[40,['ArrowDown']],[200,['ArrowRight']]] as Run[] };
        for (const [name, runs] of Object.entries(routes)) {
            game.load(game.stage.id); const folder = join(out, 'relief-' + name); mkdirSync(folder, { recursive: true });
            let held = new Set<string>(), updates = 0, images = 0, openedAt: number | null = null, shutdownHeight = 0;
            for (const [count, keys] of runs) {
                const next = new Set(keys);
                for (const key of held) if (!next.has(key)) h.window.dispatch('keyup', { code: key, key: key === 'Space' ? ' ' : key, target: h.canvas });
                for (const key of next) if (!held.has(key)) h.window.dispatch('keydown', { code: key, key: key === 'Space' ? ' ' : key, target: h.canvas });
                held = next;
                for (let i = 0; i < count; i++, updates++) {
                    game.update(1000 / 60); const b = game.objects.get('relief-service-grate')!;
                    assert.equal(game.player.data.hasHelmet, true); assert.equal(game.player.data.isDead, false);
                    if (b.active && openedAt === null) { openedAt = updates; shutdownHeight = b.jetShutdown?.height ?? 0; }
                    if (b.active) assert.equal(jetCycle(b, game.objects.time).danger, null);
                    if (updates % 4 === 0) writeFileSync(join(folder, `${String(images++).padStart(4,'0')}.png`), capture(false));
                }
            }
            for (const key of held) h.window.dispatch('keyup', { code: key, key, target: h.canvas });
            assert.equal(game.finished, true); assert.equal(openedAt !== null, name !== 'interval');
            if (name === 'discharge') assert.ok(shutdownHeight > 0, 'real break occurred during live discharge');
            replays.push({ name, updates, images, fps: 15, finished: true, damage: false, openedAt, shutdownHeight, manualPoseOrClockChanges: false });
        }
    }
    game.dispose(); cleanups.reverse().forEach(fn => fn());
}
const report = { kind: 'native-art-and-input-verification', hashes, snapshots, replays, motion: { authored: true, fps: 30, frames: 126 } };
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
