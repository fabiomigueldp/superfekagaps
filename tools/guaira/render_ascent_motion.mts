/** Automated native-input/render proof, not a manual playtest. No player-state setters. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
// An optional source root permits the exact same replay to prove baseline parity.
const source = resolve(process.env.ASCENT_SOURCE_ROOT ?? process.cwd());
const { Canvas } = await import(pathToFileURL(resolve(source, 'tests/helpers/guairaLabHarness.ts')).href);
const { guairaAscentBrowser } = await import(pathToFileURL(resolve(source, 'tests/helpers/guairaAscentHarness.ts')).href);
const out = resolve(process.argv[2] ?? '/tmp/guaira-ascent-motion-proof');
const { createCanvas } = createRequire(import.meta.url)(process.env.ASCENT_CANVAS_MODULE ?? '@napi-rs/canvas');
const surfaces = new WeakMap(), contexts = new WeakMap();
Canvas.prototype.getContext = function() {
    if (contexts.has(this)) return contexts.get(this);
    const surface = createCanvas(this.width, this.height); surfaces.set(this, surface);
    for (const key of ['width', 'height']) Object.defineProperty(this, key, { configurable: true,
        get: () => surface[key], set: value => { surface[key] = value; } });
    const ctx = surface.getContext('2d'), proxy = new Proxy(ctx, {
        get: (target, key) => key === 'drawImage' ? (image, ...args) => target.drawImage(surfaces.get(image) ?? image, ...args)
            : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
        set: (target, key, value) => { target[key] = value; return true; }
    });
    contexts.set(this, proxy); return proxy;
};
mkdirSync(out, { recursive: true });
const runs = JSON.parse(readFileSync(resolve(source, 'tests/helpers/guairaAscentReplay.json'), 'utf8')).runs;
const reducedMotion = process.argv[3] === 'reduced';
const simulation = createHash('sha256');
const cleanups = [], h = guairaAscentBrowser({ after: f => cleanups.push(f) }, { reducedMotion }), game = h.create();
const captures = new Map([[0,'departure'],[1,'board-plank'],[2,'plank-arrival'],[4,'lift-bank'],[6,'board-lift'],[7,'lift-lower-turn'],[8,'lift-rising'],[10,'upper-bank'],[12,'board-service'],[13,'service-arrival'],[15,'complete']]);
const report = [];
for (let i=0;i<runs.length;i++) {
    const [frames, keys] = runs[i];
    for(let f=0;f<frames;f++) {
        h.run(game,1,keys); assert.equal(game.player.data.isDead,false);
        simulation.update(JSON.stringify({ player:game.player.data, objects:game.objects,
            elapsed:game.elapsed, coins:game.coins, checkpoint:game.store.save.checkpoint, finished:game.finished }));
    }
    if (!captures.has(i)) continue;
    const before = JSON.stringify({ player:game.player.data,objects:game.objects,save:game.store.save });
    game.render();
    assert.equal(JSON.stringify({ player:game.player.data,objects:game.objects,save:game.store.save }),before);
    const native = createCanvas(320,180); native.getContext('2d').drawImage(surfaces.get(h.canvas),0,0,320,180);
    writeFileSync(`${out}/${captures.get(i)}.png`,native.toBuffer('image/png'));
    report.push({ scene:captures.get(i), player:structuredClone(game.player.data.position), checkpoint:game.store.save.checkpoint?.index, coins:game.coins, finished:game.finished });
}
assert.equal(game.finished,true);
writeFileSync(`${out}/report.json`,JSON.stringify({evidence:'automated native keyboard replay and real Canvas renderer; not browser or manual play',reducedMotion,simulationSha256:simulation.digest('hex'),report},null,2));
for(const cleanup of cleanups.reverse()) cleanup();
console.log(JSON.stringify(report));
