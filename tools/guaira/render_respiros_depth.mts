/** Offline native-input/render proof, not a manual browser playtest.
 * node --import tsx tools/guaira/render_respiros_depth.mts OUTPUT_DIRECTORY
 * RESPIROS_CANVAS_MODULE points to an installed @napi-rs/canvas if not local.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Canvas } from '../../tests/helpers/guairaLabHarness';
import { guairaRespirosBrowser } from '../../tests/helpers/guairaRespirosHarness';
import { jetCycleTick } from '../../src/adventure/WorldMachineState';
import { GUAIRA_RESPIROS as G } from '../../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import recording from '../../tests/helpers/guairaRespirosReplay.json';
const out = resolve(process.argv[2]);
const { createCanvas } = createRequire(import.meta.url)(process.env.RESPIROS_CANVAS_MODULE ?? '@napi-rs/canvas');
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
mkdirSync(out, {recursive:true});
const cleanups: Array<() => void> = [];
const h = guairaRespirosBrowser({after: f => cleanups.push(f)} as any), game = h.create();
const report: object[] = [];
function capture(name: string) {
    game.render();
    const native = createCanvas(320,180); native.getContext('2d').drawImage(surfaces.get(h.canvas),0,0,320,180);
    writeFileSync(resolve(out,name+'.png'),native.toBuffer('image/png'));
    report.push({name, x:game.player.data.position.x, feet:game.player.data.position.y+game.player.data.height,
        helmet:game.player.data.hasHelmet, finished:game.finished, time:game.objects.time});
}
h.run(game,recording.initialSettleFrames); capture('arrival');
for (const [i, [frames, keys]] of (recording.runs as Array<[number,string[]]>).entries()) {
    h.run(game,frames,keys); assert.equal(game.player.data.hasHelmet,true);
    if ([4,5,6,7,8].includes(i)) capture(['','','','','final-checkpoint','outlet-c-ready','dry-island','outlet-d-ready','finish'][i]);
}
assert.equal(game.finished,true);
h.keys([]); game.load(G.id); h.run(game,1);
function walk(x: number) { for(let i=0;game.player.data.position.x<x&&i<600;i++) h.run(game,1,['ArrowRight']); }
function wait(id: string) {
    h.run(game,30);
    for(let i=0;i<252;i++) {
        const tick=jetCycleTick(game.objects.get(id)!,game.objects.time);
        if(tick>=2500&&tick<2534)return;
        h.run(game,1);
    }
}
walk(128);wait(G.firstJetId);walk(304);wait(G.secondJetId);walk(578);h.run(game,30);capture('maintenance-coins');
h.run(game,30,['Space']);h.run(game,30);assert.equal(game.coins,2);capture('maintenance-shelf');
h.run(game,20,['Space']);capture('maintenance-raised-jump');h.run(game,40);
walk(624);wait(G.thirdJetId);walk(816);wait(G.fourthJetId);walk(G.finishX);
assert.equal(game.finished,true);assert.equal(game.player.data.hasHelmet,true);capture('optional-finish');
writeFileSync(resolve(out,'report.json'),JSON.stringify({proof:'Automated native keyboard input with production Canvas painters; no position/clock edits.',report},null,2));
for (const cleanup of cleanups.reverse()) cleanup();
