/** Automated native-input/render proof, not a manual playtest. No player-state setters. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Canvas } from '../../tests/helpers/guairaLabHarness';
import { guairaTraversalBrowser } from '../../tests/helpers/guairaTraversalHarness';
const out = resolve(process.argv[2] ?? '/tmp/guaira-travessia-depth-proof');
const { createCanvas } = createRequire(import.meta.url)(process.env.TRAVERSAL_CANVAS_MODULE ?? '@napi-rs/canvas');
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
const maintenance = process.argv[3] === 'maintenance';
const runs = JSON.parse(readFileSync(new URL(maintenance ? '../../tests/helpers/guairaTraversalMaintenanceReplay.json' : '../../tests/helpers/guairaTraversalReplay.json', import.meta.url), 'utf8')).runs;
const cleanups = [], h = guairaTraversalBrowser({ after: f => cleanups.push(f) }), game = h.create();
const captures = new Map(maintenance ? [[10,'maintenance-entry'],[12,'maintenance-coins'],[14,'maintenance-exit'],[16,'rejoin-bank'],[27,'complete']] : [[0,'street'],[4,'sluice-ready'],[8,'rice-bank-entry'],[12,'upper-rice-bank'],[16,'final-plate'],[19,'final-sluice'],[21,'combined-crossing'],[23,'raised-landing'],[25,'complete']]);
const report = [];
for (let i=0;i<runs.length;i++) {
    const [frames, keys] = runs[i];
    for(let f=0;f<frames;f++) { h.run(game,1,keys); assert.equal(game.player.data.isDead,false); }
    if (!captures.has(i)) continue;
    const before = JSON.stringify({ player:game.player.data,objects:game.objects,save:game.store.save });
    game.render();
    assert.equal(JSON.stringify({ player:game.player.data,objects:game.objects,save:game.store.save }),before);
    const native = createCanvas(320,180); native.getContext('2d').drawImage(surfaces.get(h.canvas),0,0,320,180);
    writeFileSync(`${out}/${captures.get(i)}.png`,native.toBuffer('image/png'));
    report.push({ scene:captures.get(i), player:structuredClone(game.player.data.position), checkpoint:game.store.save.checkpoint?.index, coins:game.coins, finished:game.finished });
}
assert.equal(game.finished,true);
writeFileSync(`${out}/report.json`,JSON.stringify({evidence:'automated native keyboard replay and real Canvas renderer; not manual play',report},null,2));
for(const cleanup of cleanups.reverse()) cleanup();
console.log(JSON.stringify(report));
