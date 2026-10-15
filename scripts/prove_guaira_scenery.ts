/** Authored production-renderer poses, not a played victory or physical-device benchmark.
 * node --import tsx scripts/prove_guaira_scenery.ts OUTPUT INSTALLED_CANVAS_MODULE [--motion]
 * --motion exports twelve seconds of authored, stationary Traversal poses at 15 fps.
 * --tour also captures intermediate camera positions, including both recovery routes.
 * --replay records the existing native-input replays at 15 fps, without pose/clock edits.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import { pixelText } from '../src/graphics/BitmapFont';
import type { WorldGame } from '../src/adventure/WorldGame';

interface NativeCanvas {
    width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D;
    toBuffer(format: 'image/png'): Buffer;
}
type GameConstructor = new (canvas: HTMLCanvasElement, status: HTMLElement) => WorldGame;
const out = resolve(process.argv[2]);
const { createCanvas } = await import(pathToFileURL(resolve(process.argv[3])).href) as { createCanvas(w: number, h: number): NativeCanvas };
mkdirSync(out, { recursive: true });
const definitions = [
    ['travessia', 'GuairaTraversal', 'GuairaTraversal', 920, 64],
    ['patio', 'junction/GuairaJunction', 'GuairaJunction', 650, 70],
    ['respiros', 'respiros/GuairaRespiros', 'GuairaRespiros', 520, 144],
    ['curral', 'GuairaBullLab', 'GuairaBullLab', 0, 64],
    ['subida', 'GuairaAscent', 'GuairaAscent', 920, 38],
    ['prefeito', 'GuairaMayorLab', 'GuairaMayorLab', 0, 64],
    ['galeria', 'gallery/GuairaGallery', 'GuairaGallery', 430, 70],
    ['alivio', 'relief/GuairaRelief', 'GuairaRelief', 330, 160],
] as const;
const report: object[] = [];
const tours: Record<string, ReadonlyArray<readonly [number, number]>> = {
    travessia: [[0,88],[240,88],[432,88],[650,88],[916,64],[1216,64]],
    patio: [[0,168],[160,60],[320,220],[440,120],[592,70],[704,70]],
    respiros: [[0,144],[160,144],[352,144],[520,144],[688,144],[864,144]],
    subida: [[0,168],[208,220],[440,168],[560,86],[768,38],[1024,38]],
};
const replays: Record<string, string> = {
    travessia: 'guairaTraversalReplay.json', patio: 'guairaJunctionReplay.json',
    respiros: 'guairaRespirosReplay.json', subida: 'guairaAscentReplay.json',
};
for (const reducedMotion of [false, true]) {
    const sheet = createCanvas(1280, 1520), sc = sheet.getContext('2d');
    sc.imageSmoothingEnabled = false; sc.fillStyle = '#322f39'; sc.fillRect(0, 0, 1280, 1520);
    const laterSheet = createCanvas(1280, 1520), lc = laterSheet.getContext('2d');
    lc.imageSmoothingEnabled = false; lc.fillStyle = '#322f39'; lc.fillRect(0, 0, 1280, 1520);
    for (const [index, [name, file, exportName, laterX, laterY]] of definitions.entries()) {
        const cleanups: Array<() => void> = [];
        const h = guairaBrowser({ after: fn => cleanups.push(fn as () => void) }, { reducedMotion });
        for (const target of [h.window, h.document, h.canvas]) Object.assign(target, { removeEventListener() {} });
        const screen = createCanvas(640, 360); h.canvas.getContext = () => screen.getContext('2d');
        const create = h.document.createElement;
        h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof create> : create(tag);
        const module = await import(pathToFileURL(resolve(`src/adventure/experimental/guaira/${file}.ts`)).href);
        const Scene = module[exportName] as GameConstructor;
        const game = new Scene(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
        game.renderer.setTouchControlsVisible(false);
        game.store.save.preferences.shake = false; game.player.data.respawnRevealTimer = 0;
        const c = createCanvas(320, 180), cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
        const state = () => JSON.stringify({ player: game.player.data, objects: game.objects, boss: game.boss,
            tiles: game.level.data.tiles, camera: game.camera, save: game.store.save });
        const capture = () => {
            const before = state(); game.render(); assert.equal(state(), before, 'Painting cannot mutate simulation or progress');
            cc.drawImage(screen as unknown as CanvasImageSource, 0, 0, 320, 180);
            return c.toBuffer('image/png');
        };
        const paint = (time: number) => { game.time = game.objects.time = time; return capture(); };
        const initial = { x: game.camera.x, y: game.camera.y };
        for (const [pose, x, y] of [['entry', initial.x, initial.y], ['later', laterX, laterY]] as const) {
            game.camera.x = x; game.camera.y = y;
            const first = paint(6400), prefix = `${name}-${pose}${reducedMotion ? '-reduced' : ''}`;
            writeFileSync(join(out, `${prefix}.png`), first);
            const background = createCanvas(320, 180), bc = background.getContext('2d');
            const paintBackground = (time: number) => {
                game.time = game.objects.time = time;
                bc.clearRect(0, 0, 320, 180);
                const before = state();
                game.art.background(bc, { id: 1 } as never, x, y, time);
                assert.equal(state(), before, 'Background cannot mutate simulation or progress');
                return background.toBuffer('image/png');
            };
            writeFileSync(join(out, `${prefix}-background.png`), paintBackground(6400));
            paint(23800); assert.ok(paint(6400).equals(first), 'Same clock and camera must produce the same frame');
            const atZero = paintBackground(0), later = paintBackground(18900);
            if (reducedMotion) assert.ok(atZero.equals(later), `${name}: decorative motion must freeze`);
            const sx = index % 2 * 640, sy = Math.floor(index / 2) * 380, target = pose === 'entry' ? sc : lc;
            pixelText(target, name.toUpperCase(), sx + 8, sy + 6, '#ecd0a0');
            paint(6400); target.drawImage(c as unknown as CanvasImageSource, sx, sy + 20, 640, 360);
            report.push({ name, pose, camera: { x, y }, reducedMotion, repeatable: true,
                stateUnchanged: true, motionVisible: !atZero.equals(later), sha256: createHash('sha256').update(first).digest('hex') });
            if (process.argv.includes('--motion') && name === 'travessia' && pose === 'entry' && !reducedMotion) {
                const frames = join(out, 'motion'); mkdirSync(frames, { recursive: true });
                for (let frame = 0; frame < 180; frame++)
                    writeFileSync(join(frames, `${String(frame).padStart(3, '0')}.png`), paint(6400 + frame * 1000 / 15));
            }
        }
        if (process.argv.includes('--tour') && !reducedMotion && tours[name]) {
            const poses = tours[name], tour = createCanvas(1280, Math.ceil(poses.length / 2) * 380);
            const tc = tour.getContext('2d'); tc.imageSmoothingEnabled = false;
            tc.fillStyle = '#322f39'; tc.fillRect(0, 0, tour.width, tour.height);
            for (const [i, [x, y]] of poses.entries()) {
                game.camera.x = x; game.camera.y = y;
                writeFileSync(join(out, `${name}-tour-${i}.png`), paint(6400));
                const sx = i % 2 * 640, sy = Math.floor(i / 2) * 380;
                pixelText(tc, `${name.toUpperCase()} ${x},${y}`, sx + 8, sy + 6, '#ecd0a0');
                tc.drawImage(c as unknown as CanvasImageSource, sx, sy + 20, 640, 360);
                report.push({ name, pose: `tour-${i}`, camera: { x, y }, reducedMotion: false, stateUnchanged: true });
            }
            writeFileSync(join(out, `${name}-tour.png`), tour.toBuffer('image/png'));
        }
        if (process.argv.includes('--replay') && !reducedMotion && replays[name]) {
            const replay = JSON.parse(readFileSync(resolve('tests/helpers', replays[name]), 'utf8')) as {
                stepMs: number; initialSettleFrames?: number; runs: Array<[number, string[]]>;
            };
            game.load(game.stage.id);
            for (let i = 0; i < (replay.initialSettleFrames ?? 0); i++) game.update(replay.stepMs);
            const folder = join(out, `${name}-replay`); mkdirSync(folder, { recursive: true });
            let held = new Set<string>(), frame = 0, images = 0;
            const keyEvent = (type: string, code: string) => h.window.dispatch(type, { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            for (const [count, keys] of replay.runs) {
                const next = new Set(keys);
                for (const code of held) if (!next.has(code)) keyEvent('keyup', code);
                for (const code of next) if (!held.has(code)) keyEvent('keydown', code);
                held = next;
                for (let i = 0; i < count; i++, frame++) {
                    game.update(replay.stepMs);
                    assert.equal(game.player.data.isDead, false, `${name}: native replay must stay safe`);
                    assert.equal(game.player.data.hasHelmet, true, `${name}: no damage during the replay`);
                    if (frame % 4 === 0) writeFileSync(join(folder, `${String(images++).padStart(4, '0')}.png`), capture());
                }
            }
            for (const code of held) keyEvent('keyup', code);
            assert.equal((game as WorldGame & { finished: boolean }).finished, true, `${name}: native inputs must complete the stage`);
            writeFileSync(join(out, `${name}-complete.png`), capture());
            report.push({ name, pose: 'native-replay', updates: frame, images, fps: 15, finished: true, damage: false, manualPoseOrClockChanges: false });
            console.log(JSON.stringify({ replay: name, updates: frame, images, finished: true }));
        }
        game.dispose(); cleanups.reverse().forEach(fn => fn());
    }
    writeFileSync(join(out, reducedMotion ? 'overview-reduced.png' : 'overview.png'), sheet.toBuffer('image/png'));
    writeFileSync(join(out, reducedMotion ? 'later-reduced.png' : 'later.png'), laterSheet.toBuffer('image/png'));
}
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ poses: report.filter(r => 'camera' in r).length,
    nativeReplays: report.filter(r => 'updates' in r).length, output: out, deterministic: true, reducedMotion: true }));
