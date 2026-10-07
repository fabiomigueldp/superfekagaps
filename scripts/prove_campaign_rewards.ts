/** Offline production Canvas, staged final-bank views, not browser/device QA.
 * Traversal acceptance lives in campaign-finish-rewards.test.ts (real WorldGame).
 * Usage: node --import tsx scripts/prove_campaign_rewards.ts OUTPUT CANVAS_MODULE BASE_CHECKOUT
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
for (const id of ['1-1', '6-4']) for (const [version, Runtime] of [['before', Before], ['after', WorldGame]] as const) {
    const cleanup: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanup.push(fn as () => void) });
    for (const surface of [h.window, h.document, h.canvas]) Object.assign(surface, { removeEventListener() {} });
    const screen = createCanvas(640, 360); h.canvas.getContext = () => screen.getContext('2d');
    const create = h.document.createElement;
    h.document.createElement = tag => tag === 'canvas' ? createCanvas(1, 1) as unknown as ReturnType<typeof create> : create(tag);
    const game = new Runtime(h.canvas as unknown as HTMLCanvasElement, true);
    game.load(id); game.renderer.setTouchControlsVisible(false);
    const exit = game.stage.exits[0], p = game.player.data;
    p.position = { x: exit.x - (id === '6-4' ? 64 : 88), y: (id === '6-4' ? 192 : 224) - p.height }; p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
    game.camera.x = game.level.data.width * 16 - 320; game.camera.y = 87;
    game.render();
    const frame = createCanvas(320, 180); frame.getContext('2d').drawImage(screen as unknown as CanvasImageSource, 0, 0, 320, 180);
    writeFileSync(join(output, `${id}-finish-${version}.png`), frame.toBuffer('image/png'));
    game.dispose(); cleanup.reverse().forEach(fn => fn());
}
writeFileSync(join(output, 'scope.json'), JSON.stringify({ evidence: 'Offline actual production Canvas. Camera/player are staged, not a full-stage playthrough.', base, stages: ['1-1', '6-4'], traversalTests: 'tests/campaign-finish-rewards.test.ts' }, null, 2));
