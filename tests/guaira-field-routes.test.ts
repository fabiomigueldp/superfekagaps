import { introductionReached } from './helpers/guairaCourseTest';
import assert from 'node:assert/strict';
import test from 'node:test';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';
import { guairaRespirosBrowser } from './helpers/guairaRespirosHarness';
import { GUAIRA_RESPIROS as R } from '../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import { jetCycle, jetCycleTick } from '../src/adventure/WorldMachineState';
import tapes from './helpers/guairaFieldRoutesReplays.json';

type Run = [number, string[]];
type Harness = ReturnType<typeof guairaTraversalBrowser> | ReturnType<typeof guairaRespirosBrowser>;
type Game = ReturnType<Harness['create']>;
const factories = { travessia: guairaTraversalBrowser, respiros: guairaRespirosBrowser };
const dt = 1000 / 60;
const feet = (g: Game) => g.player.data.position.y + g.player.data.height;
function input(h: Harness, keys: string[], touch = false) {
    if (!touch) { h.keys(keys); return; }
    const x: Record<string, number> = { ArrowLeft: .08, ArrowRight: .22, ArrowDown: .5, ShiftLeft: .78, Space: .93 };
    const touches = keys.map((key, i) => ({ identifier: i + 1, target: h.canvas, clientX: x[key] * 640, clientY: 330 }));
    h.canvas.dispatch(touches.length ? 'touchstart' : 'touchend', { touches });
}
function play(h: Harness, g: Game, runs: Run[], stop = Infinity, touch = false, observe = (_frame: number) => {}) {
    let n = 0;
    for (const [count, keys] of runs) {
        input(h, keys, touch);
        for (let i = 0; i < count && n < stop; i++) { g.update(dt); observe(++n); }
        if (n >= stop) break;
    }
    return n;
}
function visible(g: Game, x: number, y: number, width = 16) {
    assert.ok(x + width > g.camera.x && x + width <= g.camera.x + 320.01, `receiving span ${x}..${x+width}`);
    assert.ok(y - g.camera.y >= 24 && y - g.camera.y <= 172.01, `receiving surface y${y} at ${y-g.camera.y}`);
}

for (const name of ['travessia', 'respiros'] as const) for (const touch of [false, true]) for (const reducedMotion of [false, true])
test(`${name}: field exploration completes with native ${touch ? 'touch' : 'keyboard'}, reduced=${reducedMotion}`, t => {
    const h = factories[name](t, { touch, reducedMotion }), g = h.create();
    const contacts = new Set<number>(); let previousY = g.camera.y, previousX = g.camera.x;
    const n = play(h, g, tapes[name].runs as Run[], Infinity, touch, frame => {
        const p = g.player.data;
        assert.equal(p.isDead, false, `alive at ${frame}`); assert.equal(p.hasHelmet, true, `intact at ${frame}`);
        assert.ok(p.position.y - 10 - g.camera.y >= 23, `helmet at ${frame}`);
        assert.ok(feet(g) - g.camera.y <= 172.01, `feet at ${frame}`);
        assert.ok(Math.abs(g.camera.y-previousY) <= 8.001, `vertical continuity at ${frame}`);
        assert.ok(Math.abs(g.camera.x-previousX) <= 6.5, `horizontal continuity at ${frame}`);
        previousY = g.camera.y; previousX = g.camera.x;
        if (p.isGrounded) contacts.add(Math.round(feet(g)));
        if (name === 'travessia') {
            if (frame === 275) visible(g,624,224,24);
            if (frame === 429) { visible(g,780,256); visible(g,800,192,48); visible(g,944,240,32); }
            if (frame === 608) { assert.equal(feet(g),240); visible(g,976,224,32); }
            if (frame === 854) visible(g,1360,192,16);
        } else {
            if (frame === 701) { visible(g,736,160,32); visible(g,744,138); }
            if (frame === 753) visible(g,800,240,48);
            if (frame === 820) { visible(g,880,176,112); visible(g,848,304,32); }
            if (frame === 864) { assert.equal(feet(g),304); assert.ok(p.position.x+p.width<R.fourthStart); }
            if (frame >= 701) {
                assert.equal(jetCycle(g.objects.get(R.thirdJetId)!,g.objects.time).danger,null);
                assert.equal(g.objects.get(R.fourthJetId)!.active,false,'D retains its independent timing');
            }
        }
    });
    assert.equal(n,tapes[name].frames); assert.equal(g.finished,true); assert.equal(g.coins,tapes[name].coins);
    for (const y of name==='travessia'?[208,256,240,224,192]:[288,240,192,160,304]) assert.ok(contacts.has(y),`support ${y}`);
    assert.deepEqual(g.store.save.completed,[]); assert.deepEqual(h.storageCalls,[]);
    const snapshot=()=>JSON.stringify({p:g.player.data,o:g.objects,camera:g.camera,tiles:g.level.data.tiles,coins:g.coins,t:g.time});
    const before=snapshot();g.render();g.render();assert.equal(snapshot(),before);
});

for (const hold of [1,2,3]) test(`the inspection channel returns by two ${hold}-frame jumps without a helmet`,t=>{
    const h=guairaTraversalBrowser(t),g=h.create();play(h,g,tapes.travessia.runs as Run[],570);
    // Equipment-only fixture. Arrival at the channel is entirely native input.
    g.player.data.hasHelmet=false;
    for (const y of [240,224]) {
        h.run(g,hold,['Space']);h.run(g,16,['ArrowRight']);h.run(g,20);
        assert.equal(feet(g),y);assert.equal(g.player.data.isDead,false);
    }
    assert.ok(g.player.data.position.x>=976);assert.equal(g.finished,false);
});

for (const hold of [1,3,5]) test(`a short inspection jump (${hold} frames) safely falls onto the isolated floor`,t=>{
    const h=guairaRespirosBrowser(t),g=h.create();play(h,g,tapes.respiros.runs as Run[],701);
    h.run(g,hold,['ArrowRight','Space']);h.run(g,70-hold,['ArrowRight']);h.run(g,30);
    assert.equal(g.player.data.hasHelmet,true);assert.equal(g.player.data.isDead,false);
    assert.equal(feet(g),304);assert.ok(g.player.data.position.x>=R.thirdEnd&&g.player.data.position.x+g.player.data.width<R.fourthStart);
    assert.equal(g.objects.get(R.thirdJetId)!.active,true);
    // Wait for an observed retraction of D; never edit its clock or collision.
    for(let i=0;i<253;i++){const tick=jetCycleTick(g.objects.get(R.fourthJetId)!,g.objects.time);if(tick>=2500&&tick<2534)break;h.run(g,1);}
    h.run(g,140,['ArrowRight']);assert.equal(introductionReached(g), true);assert.equal(g.player.data.hasHelmet,true);
});

test('the high deck clears a live C at every native departure phase; the dry return is reached by a second jump',t=>{
    const h=guairaRespirosBrowser(t),g=h.create();
    for(let phase=0;phase<252;phase++) {
        h.keys([]);g.load(R.id);play(h,g,tapes.respiros.runs as Run[],653);
        assert.equal(feet(g),192);assert.equal(g.objects.get(R.serviceValveId)!.active,false);
        h.run(g,phase);h.run(g,32,['ArrowRight','Space']);h.run(g,20);
        assert.equal(feet(g),R.inspectionTop);assert.equal(g.player.data.hasHelmet,true,`first jump phase ${phase}`);
        h.run(g,34,['ArrowRight','Space']);h.run(g,40);
        assert.equal(feet(g),R.overlookTop);assert.equal(g.player.data.hasHelmet,true,`return phase ${phase}`);
        assert.equal(g.player.data.isDead,false);assert.equal(g.objects.get(R.thirdJetId)!.active,false);
    }
});

for (const name of ['travessia','respiros'] as const) test(`${name}: camera settles, pause freezes and native checkpoint recovery remains valid`,t=>{
    const h=factories[name](t),g=h.create();play(h,g,tapes[name].runs as Run[],name==='travessia'?706:820);
    input(h,[]);for(let n=0;n<90;n++)g.update(dt);
    const beforeY=g.camera.y,beforeX=g.camera.x;for(let n=0;n<30;n++)g.update(dt);
    assert.ok(Math.abs(g.camera.y-beforeY)<.001&&Math.abs(g.camera.x-beforeX)<.001);
    const toggle=()=> 'toggleTraversalPause' in g?g.toggleTraversalPause():g.toggleRespirosPause();
    toggle();const frozen=JSON.stringify({p:g.player.data,o:g.objects,camera:g.camera,t:g.time});
    for(let n=0;n<90;n++)g.update(dt);g.render();assert.equal(JSON.stringify({p:g.player.data,o:g.objects,camera:g.camera,t:g.time}),frozen);
    toggle();const old=g.player,coins=g.coins;old.die('fall'); // Explicit recovery fixture, not traversal evidence.
    for(let n=0;n<180&&g.player===old;n++)g.update(dt);
    assert.notEqual(g.player,old);assert.equal(g.player.data.position.x,name==='travessia'?1024:608);assert.equal(g.coins,coins);
    g.load(g.stage.id);assert.equal(g.coins,0);assert.equal(g.store.save.checkpoint,null);
});
