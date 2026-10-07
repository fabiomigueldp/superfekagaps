/** Offline production Canvas evidence, with staged local basin views.
 * Usage: node --import tsx scripts/prove_campaign_basin_recovery.ts OUTPUT CANVAS_MODULE BASE_CHECKOUT
 * Real collection + escape is tested separately in campaign-basin-recovery.test.ts.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorldGame } from '../src/adventure/WorldGame';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(format: 'image/png'): Buffer }
const output = resolve(process.argv[2]), modulePath = resolve(process.argv[3]), base = resolve(process.argv[4]);
const { createCanvas } = await import(pathToFileURL(modulePath).href) as { createCanvas(w: number, h: number): NativeCanvas };
const { WorldGame: Before } = await import(pathToFileURL(join(base, 'src/adventure/WorldGame.ts')).href) as { WorldGame: typeof WorldGame };
mkdirSync(output, { recursive: true });
for (const id of ['4-3', '4-4']) for (const view of ['basin', 'return', 'attachment']) for (const [version, Runtime] of [['before', Before], ['after', WorldGame]] as const) {
    const cleanup: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanup.push(fn as () => void) });
    for (const surface of [h.window, h.document, h.canvas]) Object.assign(surface, { removeEventListener() {} });
    const screen = createCanvas(640, 360); h.canvas.getContext = () => screen.getContext('2d');
    const create = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof create> : create(tag);
    const game = new Runtime(h.canvas as unknown as HTMLCanvasElement, true);
    game.load(id); game.renderer.setTouchControlsVisible(false);
    const p = game.player.data;
    p.position = { x: view === 'basin' ? 1600 : 1708, y: (view === 'basin' ? 336 : 272) - p.height };
    p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
    game.camera.x = view === 'attachment' ? 1648 : 1568;
    game.camera.y = view === 'basin' ? 188 : view === 'attachment' ? 100 : 120;
    game.render();
    const frame = createCanvas(320, 180); frame.getContext('2d').drawImage(screen as unknown as CanvasImageSource, 0, 0, 320, 180);
    writeFileSync(join(output, `${id}-${view}-${version}.png`), frame.toBuffer('image/png'));
    game.dispose(); cleanup.reverse().forEach(fn => fn());
}
writeFileSync(join(output, 'basin-scope.json'), JSON.stringify({ evidence: 'Offline production Canvas. Camera/player are staged, not browser or entire-stage acceptance.', base, stages: ['4-3', '4-4'], traversalTests: 'tests/campaign-basin-recovery.test.ts' }, null, 2));
