import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { guairaReliefBrowser } from '../tests/helpers/guairaReliefHarness';
import { GUAIRA_RELIEF as G } from '../src/adventure/experimental/guaira/relief/GuairaReliefStage';
import { jetCycle } from '../src/adventure/WorldMachineState';
import recording from '../tests/helpers/guairaReliefReplay.json';

/** Entire route advances only through real input events and native fixed updates. */
const destination = resolve(process.argv[2] ?? '.tmp/relief-proof');
mkdirSync(destination, { recursive: true });
const summaries = [];
for (const name of ['maintenance', 'interval', 'headBump', 'skipFlag'] as const)
    for (const touch of [false, true]) for (const reducedMotion of [false, true]) {
        const cleanup: Array<() => unknown> = [];
        const h = guairaReliefBrowser({ after: callback => { cleanup.push(callback as () => unknown); } }, { touch, reducedMotion });
        const g = h.create();
        const round = (value: number) => Math.round(value * 1e6) / 1e6;
        const read = (frame: number, keys: string[]) => {
            const p = g.player.data, j = g.objects.get(G.jetId)!, cycle = jetCycle(j, g.objects.time);
            return { frame, keys, player: { x: round(p.position.x), y: round(p.position.y), feet: round(p.position.y + p.height),
                vx: round(p.velocity.x), vy: round(p.velocity.y), grounded: p.isGrounded, pound: p.groundPoundState,
                helmet: p.hasHelmet, dead: p.isDead },
                tiles: [15,16,17].map(col => g.level.getTile(col,10)), open: g.reliefOpened,
                jet: { closed: j.active, phase: cycle.phase, height: cycle.height, danger: cycle.danger },
                checkpoint: g.store.save.checkpoint ? { ...g.store.save.checkpoint } : null,
                camera: { x: round(g.camera.x), y: round(g.camera.y) }, time: round(g.objects.time), elapsed: round(g.elapsed), finished: g.finished };
        };
        const frames = [read(0, [])]; let frame = 0;
        for (const [count, keys] of recording[name] as Array<[number, string[]]>) {
            h.keys(keys);
            for (let i = 0; i < count; i++) { g.update(1000 / 60); frames.push(read(++frame, keys)); }
        }
        if (!g.finished || g.player.data.isDead || !g.player.data.hasHelmet) throw Error(`Native route failed: ${name}`);
        const events = frames.flatMap((sample, index) => {
            const previous = frames[index - 1]; if (!previous) return [];
            const opened = !previous.open && sample.open, checkpoint = !previous.checkpoint && !!sample.checkpoint;
            const finished = !previous.finished && sample.finished;
            return opened || checkpoint || finished ? [{ frame: sample.frame, opened, checkpoint, finished,
                player: sample.player, jet: sample.jet, camera: sample.camera }] : [];
        });
        const variant = `${name}-${touch ? 'touch' : 'keyboard'}${reducedMotion ? '-reduced' : ''}`, file = `${variant}.json`;
        const bytes = JSON.stringify({ hz: 60, route: name, touch, reducedMotion, frames }) + '\n';
        writeFileSync(resolve(destination, file), bytes);
        summaries.push({ variant, file, sha256: createHash('sha256').update(bytes).digest('hex'),
            inputFrames: frame, finishFrame: events.find(event => event.finished)?.frame,
            actualSeconds: g.elapsed, final: frames.at(-1), events });
        for (const restore of cleanup.reverse()) restore();
    }
writeFileSync(resolve(destination, 'summary.json'), JSON.stringify(summaries, null, 2) + '\n');
console.log(JSON.stringify({ destination, variants: summaries.map(({ variant, inputFrames, finishFrame, events }) => ({ variant, inputFrames, finishFrame, events })) }, null, 2));
