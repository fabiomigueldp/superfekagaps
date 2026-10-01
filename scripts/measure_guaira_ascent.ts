/** Deterministic native-engine boarding/exit windows, at 60 Hz. No rendered-browser timing claim. */
import { guairaAscentBrowser } from '../tests/helpers/guairaAscentHarness';
import { GUAIRA_ASCENT as G } from '../src/adventure/experimental/guaira/GuairaAscent';

const cleanups: Array<() => void> = [];
const h = guairaAscentBrowser({ after: fn => { cleanups.push(fn as () => void); } });
const game = h.create();
const stepMs = 1000 / 60;
function ranges(frames: number[]) {
    const spans: number[][] = [];
    for (const frame of frames) {
        const last = spans[spans.length - 1];
        if (last && last[1] === frame - 1) last[1] = frame;
        else spans.push([frame, frame]);
    }
    return spans;
}
const measurements = [];
for (const action of ['plank-board', 'plank-exit', 'lift-board', 'lift-exit'] as const) {
    const lift = action.startsWith('lift'), exit = action.endsWith('exit'), good: number[] = [];
    for (let phase = 0; phase < 600; phase++) {
        h.keys([]); game.load(G.id);
        const p = game.player.data, body = game.objects.get(lift ? G.liftId : G.plankId)!;
        p.position.x = lift ? 640 : 208;
        h.run(game, phase);
        if (exit) {
            p.position = { x: body.x + (lift ? 38 : 16), y: body.y - p.height };
            p.velocity = { x: 0, y: 0 }; p.isGrounded = true;
        }
        h.run(game, exit ? lift ? 65 : 57 : lift ? 30 : 48, ['ArrowRight', 'Space']);
        h.run(game, !exit && lift ? 35 : 15);
        const feet = p.position.y + p.height;
        const arrived = exit ? p.position.x >= (lift ? 768 : 496) && Math.abs(feet - (lift ? 144 : 304)) < .01
            : Math.abs(feet - body.y) < .01 && p.position.x + p.width > body.x && p.position.x < body.x + body.width;
        if (!p.isDead && p.isGrounded && arrived) good.push(phase);
    }
    measurements.push({ action, sampledStartFrames: ranges(good), successfulStarts: good.length,
        secondsPerCycle: Number((good.length * stepMs / 1000).toFixed(3)) });
}
console.log(JSON.stringify({ stepMs, cycleMs: G.period, measurements }, null, 2));
for (const cleanup of cleanups) cleanup();
