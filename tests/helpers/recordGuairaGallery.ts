import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { guairaGalleryBrowser } from './guairaGalleryHarness';
import recording from './guairaGalleryReplay.json';

/** Reproducible60Hz evidence. Only event dispatch and update() advance play;
 * every other operation reads the native simulation. This is not a fixture. */
const destination = resolve(process.argv[2] ?? '.tmp/gallery-proof');
mkdirSync(destination, { recursive: true });
const summaries = [];
for (const touch of [false, true]) for (const reducedMotion of [false, true]) {
    const cleanup: Array<() => unknown> = [];
    const h = guairaGalleryBrowser({ after: callback => { cleanup.push(callback as () => unknown); } }, { touch, reducedMotion });
    const g = h.create();
    const frames: ReturnType<typeof read>[] = [];
    const round = (value: number) => Math.round(value * 1e6) / 1e6;
    const read = (frame: number, keys: string[]) => {
        const p = g.player.data;
        return { frame, keys, player: { x: round(p.position.x), y: round(p.position.y), feet: round(p.position.y + p.height),
            vx: round(p.velocity.x), vy: round(p.velocity.y), grounded: p.isGrounded, pound: p.groundPoundState,
            recoveryMs: round(p.groundPoundTimer), helmet: p.hasHelmet, dead: p.isDead },
            tiles: [10,11,12].map(x => g.level.getTile(x,11)).concat([24,25,26].map(x => g.level.getTile(x,18))),
            checkpoint: g.store.save.checkpoint ? { ...g.store.save.checkpoint } : null,
            camera: { x: round(g.camera.x), y: round(g.camera.y) }, time: round(g.time), elapsed: round(g.elapsed), finished: g.finished };
    };
    frames.push(read(0, []));
    let frame = 0;
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let i = 0; i < count; i++) { g.update(1000 / 60); frames.push(read(++frame, keys)); }
    }
    if (!g.finished || g.player.data.isDead || !g.player.data.hasHelmet) throw Error('Native replay did not finish intact');
    const changes = frames.flatMap((sample, index) => {
        const before = frames[index-1];
        if (!before) return [];
        const removed = sample.tiles.flatMap((tile, i) => tile !== before.tiles[i] ? [i] : []);
        const checkpoint = !before.checkpoint && !!sample.checkpoint;
        const arrived = !before.finished && sample.finished;
        return removed.length || checkpoint || arrived ? [{ frame: sample.frame, removedTileIndexes: removed, checkpoint, arrived,
            player: sample.player, camera: sample.camera }] : [];
    });
    const name = `${touch ? 'touch' : 'keyboard'}${reducedMotion ? '-reduced' : ''}`;
    const file = `${name}.json`;
    const bytes = JSON.stringify({ hz: 60, input: name, tileOrder: ['A10','A11','A12','B24','B25','B26'], frames });
    writeFileSync(resolve(destination, file), bytes + '\n');
    summaries.push({ name, file, sha256: createHash('sha256').update(bytes + '\n').digest('hex'),
        frames: frame, seconds: frame / 60, result: frames.at(-1), changes });
    for (const restore of cleanup.reverse()) restore();
}
writeFileSync(resolve(destination, 'summary.json'), JSON.stringify(summaries, null, 2) + '\n');
console.log(JSON.stringify({ destination, variants: summaries.map(({ name, frames, seconds, changes }) => ({ name, frames, seconds, changes })) }, null, 2));
