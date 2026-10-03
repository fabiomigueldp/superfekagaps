import assert from 'node:assert/strict';
import test from 'node:test';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { WorldObjects, WorldLevel } from '../src/adventure/WorldPhysics';
import { STAGES, ISLANDS } from '../src/adventure/campaign';
import { jetCycle, jetCycleTick } from '../src/adventure/WorldMachineState';
import { GuairaRespiros, GUAIRA_RESPIROS as G, guairaRespirosStage } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import { guairaRespirosBrowser } from './helpers/guairaRespirosHarness';
import recording from './helpers/guairaRespirosReplay.json';

const dt = 1000 / 60;
const feet = (g: GuairaRespiros) => g.player.data.position.y + g.player.data.height;
const snapshot = (g: GuairaRespiros) => structuredClone({ player: g.player.data, objects: g.objects,
    time: g.time, elapsed: g.elapsed, finished: g.finished, camera: g.camera, checkpoint: g.store.save.checkpoint });
type Harness = ReturnType<typeof guairaRespirosBrowser>;
function replay(h: Harness, g: GuairaRespiros, stopAtRefuge = false) {
    h.run(g, recording.initialSettleFrames);
    let frames = recording.initialSettleFrames;
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        h.keys(keys);
        for (let i = 0; i < count; i++, frames++) {
            g.update(dt);
            assert.equal(g.player.data.isDead, false, `alive at ${frames}`);
            assert.equal(g.player.data.hasHelmet, true, `helmet at ${frames}`);
            if (stopAtRefuge && g.store.save.checkpoint && keys.length === 0) {
                h.run(g, 40); return frames + 40;
            }
        }
    }
    return frames;
}
/** Controlled departure fixtures only. The complete keyboard/touch replay never relocates Feka. */
function departure(h: Harness, g: GuairaRespiros, x: number, phase = 0) {
    h.keys([]); g.load(G.id); g.player.data.position.x = x;
    h.run(g, phase + 1);
}
function walkUntil(h: Harness, g: GuairaRespiros, x: number) {
    let frames = 0;
    while (g.player.data.position.x < x && g.player.data.hasHelmet && !g.player.data.isDead && frames < 420) {
        h.run(g, 1, ['ArrowRight']); frames++;
    }
    return frames;
}
function waitForRetraction(h: Harness, g: GuairaRespiros, id: string) {
    h.run(g, 30); // Native friction must settle before a departure is classified.
    for (let frame = 0; frame < 252; frame++) {
        const tick = jetCycleTick(g.objects.get(id)!, g.objects.time);
        if (tick >= 2500 && tick < 2534) return;
        h.run(g, 1);
    }
    assert.fail('one cycle always contains a completely retracted departure');
}

test('Respiros clones a continuous native floor and four ungated jets without storage or campaign changes', t => {
    const campaign = structuredClone(STAGES), islands = structuredClone(ISLANDS), h = guairaRespirosBrowser(t), g = h.create();
    assert.ok(g.player instanceof Player); assert.ok(g.input instanceof Input);
    assert.ok(g.objects instanceof WorldObjects); assert.ok(g.level instanceof WorldLevel);
    assert.equal(g.stage.id, G.id); assert.equal(g.player.data.position.x, G.spawnX); assert.equal(feet(g), G.floor);
    assert.equal(g.player.data.hasHelmet, true); assert.equal(g.boss, null);
    assert.deepEqual(g.stage.foes, []); assert.deepEqual(g.stage.exits, []); assert.equal(g.stage.pickups.length, 2);
    assert.deepEqual(g.stage.mechanisms.map(b => [b.kind, b.x, b.y, b.width, b.height, b.phase, b.period, b.gated]),
        [['jet',160,176,96,132,0,4200,undefined], ['jet',384,176,176,132,1200,4200,undefined],
         ['jet',704,176,80,132,600,4200,undefined], ['jet',880,176,112,132,2700,4200,undefined]]);
    for (let x = 0; x < G.width; x++) assert.notEqual(g.stage.level.tiles[19][x], 0);
    const altered = guairaRespirosStage(); altered.level.tiles[19][0] = 0;
    assert.notEqual(guairaRespirosStage().level.tiles[19][0], 0);
    g.render(); assert.ok(h.canvas.drawCalls > 0); assert.equal(g.mapReturnHref, './guaira.html?at=rice');
    assert.deepEqual(STAGES, campaign); assert.deepEqual(ISLANDS, islands); assert.equal(ISLANDS.length, 6);
});

for (const touch of [false, true]) test(`${touch ? 'native touch' : 'keyboard'} replay walks, waits and completes intact through real Input/WorldGame/Player`, t => {
    const h = guairaRespirosBrowser(t, { touch }), g = h.create();
    let completions = 0; (g as unknown as { complete(): void }).complete = () => { completions++; };
    assert.equal(replay(h, g), recording.inputFrames + recording.initialSettleFrames);
    assert.equal(g.finished, true); assert.equal(feet(g), G.floor); assert.equal(g.player.data.hasHelmet, true);
    assert.equal(g.store.save.checkpoint?.index, 1); assert.equal(g.player.data.velocity.x, 0);
    assert.equal(g.player.data.position.x, recording.expected.x);
    assert.equal(g.mapReturnHref, './guaira.html?at=rice&visit=respiros-clear'); assert.equal(g.canAdvanceToBoss, true);
    assert.equal(g.coins, 0); assert.equal(completions, 0); assert.deepEqual(g.store.save.completed, []); assert.deepEqual(g.store.save.times, {});
    const done = snapshot(g); h.run(g, 100, ['ArrowLeft', 'Space']); g.render();
    assert.deepEqual(snapshot(g), done); assert.match(h.status.textContent, /Passagem do arrozal inspecionada/);
    h.keys([]); g.load(G.id); replay(h, g); assert.deepEqual(snapshot(g), done, 'repeat is deterministic');
});

test('252 native departure phases expose generous but different walking windows on both grates', t => {
    const h = guairaRespirosBrowser(t), g = h.create();
    for (const [start, target, expectedCount, walkFrames, spans] of [
        [128,304,157,91,[[0,41],[137,251]]], [304,608,117,155,[[41,157]]]
    ] as const) {
        const safe: number[] = [];
        for (let phase = 0; phase < 252; phase++) {
            departure(h, g, start, phase); const frames = walkUntil(h, g, target);
            if (g.player.data.hasHelmet && !g.player.data.isDead && g.player.data.position.x >= target) {
                safe.push(phase); assert.equal(frames, walkFrames);
            }
        }
        assert.equal(safe.length, expectedCount);
        assert.deepEqual(safe, spans.flatMap(([a,b]) => Array.from({ length: b-a+1 }, (_,i) => a+i)));
        const cyclicSafeWindow = expectedCount * dt;
        assert.ok(cyclicSafeWindow >= 1950);
        // Retraction ends at tick2500; the next dangerous water starts after6000.
        // Even measuring all the way to a deep safe target, the second passage
        // retains 3500 - 2583.33 = 916.67ms, exceeding the required600ms.
        assert.ok(3500 - walkFrames * dt >= 600);
    }
});

function finishPair(h: Harness, g: GuairaRespiros) {
    walkUntil(h, g, G.finalCheckpointX); waitForRetraction(h, g, G.thirdJetId);
    walkUntil(h, g, G.finalRefugeX); waitForRetraction(h, g, G.fourthJetId);
    walkUntil(h, g, G.finishX);
}

test('observing retraction solves all252 starting phases while blind walking, running and fixed jumps do not', t => {
    const h = guairaRespirosBrowser(t), g = h.create();
    const blindCounts: number[] = [];
    for (const policy of ['walk', 'run', 'jump']) {
        let safe = 0;
        for (let phase = 0; phase < 252; phase++) {
            departure(h, g, G.spawnX, phase);
            for (let frame = 0; frame < 420 && g.player.data.position.x < 656 && g.player.data.hasHelmet && !g.player.data.isDead; frame++)
                h.run(g, 1, ['ArrowRight', ...(policy === 'run' ? ['ShiftLeft'] : []), ...(policy === 'jump' && frame % 48 < 24 ? ['Space'] : [])]);
            if (g.player.data.position.x >= 656 && g.player.data.hasHelmet && !g.player.data.isDead) safe++;
        }
        assert.ok(safe > 0 && safe < 252); blindCounts.push(safe);
    }
    assert.deepEqual(blindCounts, [89,87,100]);
    for (let phase = 0; phase < 252; phase++) {
        departure(h, g, G.spawnX, phase);
        walkUntil(h, g, 128); waitForRetraction(h, g, G.firstJetId);
        walkUntil(h, g, G.checkpointX); waitForRetraction(h, g, G.secondJetId);
        finishPair(h, g);
        assert.equal(g.finished, true, `observed policy at phase${phase}`);
        assert.equal(g.player.data.hasHelmet, true, `no forced damage at phase${phase}`);
    }
});

for (const options of [{}, { touch: true }, { reducedMotion: true }])
test(`the refuge teaches B's full warning after A, with native braking ${JSON.stringify(options)}`, t => {
    const h = guairaRespirosBrowser(t, options), g = h.create();
    for (const initialWait of [0, 30, 120, 251]) {
        // Continuous route from the authored spawn. Vary the player's initial
        // hesitation, then observe A; never relocate Feka or alter the clock.
        h.keys([]); g.load(G.id); h.run(g, initialWait + 1);
        walkUntil(h, g, 128); waitForRetraction(h, g, G.firstJetId);
        walkUntil(h, g, G.checkpointX);
        const b = g.objects.get(G.secondJetId)!;
        assert.equal(jetCycle(b, g.objects.time).phase, 'idle', 'arrive before the warning');
        // The same native arrival at the old phase already met a discharge.
        assert.ok(jetCycle({ ...b, phase: 2100 }, g.objects.time).danger,
            'baseline comparison: the old rhythm skipped observation of the warning');
        let chargingFrames = 0;
        const seen = new Set<string>();
        for (let frame = 0; frame < 252; frame++) {
            h.run(g, 1); // release direction; native friction settles in the refuge
            const state = jetCycle(b, g.objects.time);
            seen.add(state.phase);
            if (state.phase === 'charging') chargingFrames++;
            assert.ok(g.player.data.position.x >= G.firstEnd);
            assert.ok(g.player.data.position.x + g.player.data.width <= G.secondStart);
            assert.equal(g.player.data.hasHelmet, true);
            if (state.phase === 'venting') break;
        }
        assert.ok(chargingFrames >= 47, 'observe essentially the full native 800ms warning');
        assert.deepEqual([...seen], ['idle', 'charging', 'rising', 'flowing', 'falling', 'venting']);
        // A deliberate 600ms reaction after retraction still leaves ample time
        // to walk the long grate; neither running nor jumping is needed.
        h.run(g, 36); finishPair(h, g);
        assert.equal(g.finished, true); assert.equal(g.player.data.hasHelmet, true);
    }
});

for (const touch of [false, true]) test(`three cycles of refuge idle and edge braking stay dry with ${touch ? 'touch' : 'keys'}`, t => {
    const h = guairaRespirosBrowser(t, { touch }), g = h.create();
    for (const x of [128,304,608]) {
        departure(h, g, x); h.run(g, 756);
        assert.equal(g.player.data.position.x, x); assert.equal(g.player.data.hasHelmet, true); assert.equal(g.player.data.isDead, false);
    }
    for (const run of [false,true]) for (const side of ['left','right']) {
        // Start far enough inside the128px refuge to accelerate and stop near
        // either edge with the native released-key/touch friction.
        departure(h, g, side === 'right' ? 290 : 342);
        const direction = side === 'right' ? 'ArrowRight' : 'ArrowLeft';
        h.run(g, 12, [direction, ...(run ? ['ShiftLeft'] : [])]); const before = g.player.data.position.x;
        h.run(g, 120); const after = g.player.data.position.x;
        assert.ok(after >= G.firstEnd && after + g.player.data.width <= G.secondStart);
        assert.ok(Math.abs(after-before) <= (run ? 19.2 : 10.8)); assert.equal(g.player.data.velocity.x,0);
        h.run(g,756); assert.equal(g.player.data.hasHelmet,true); assert.equal(g.player.data.isDead,false);
    }
});

test('each grate allows a native walking reversal after a completely retracted departure', t => {
    const h = guairaRespirosBrowser(t), g = h.create();
    for (const [x, id, middle] of [[128,G.firstJetId,200],[304,G.secondJetId,450]] as const) {
        departure(h,g,x); waitForRetraction(h,g,id); walkUntil(h,g,middle);
        for (let i=0;i<120 && g.player.data.position.x>x;i++) h.run(g,1,['ArrowLeft']);
        h.run(g,30); assert.equal(g.player.data.hasHelmet,true); assert.equal(g.player.data.isDead,false);
        assert.ok(g.player.data.position.x <= x); assert.equal(feet(g),G.floor);
    }
});

test('short and held native jumps remain framed below the HUD without mandatory jumping', t => {
    const h=guairaRespirosBrowser(t),g=h.create();
    for(const hold of [1,30]) for(const x of [48,304,608]) {
        departure(h,g,x); let rise=0;
        for(let frame=0;frame<60;frame++) {
            h.run(g,1,frame<hold?['Space']:[]);
            const p=g.player.data; rise=Math.max(rise,G.floor-feet(g));
            assert.ok(p.position.y-g.camera.y>=23, 'native apex remains below HUD');
            assert.ok(feet(g)-g.camera.y<=172.001); assert.ok(p.position.x-g.camera.x>=24);
        }
        assert.ok(hold===1?rise<21:rise>102); assert.equal(g.player.data.hasHelmet,true); assert.equal(feet(g),G.floor);
    }
    departure(h,g,304); h.run(g,100);
    assert.ok(g.camera.x+320 >= G.secondEnd+14,'entire second grate and receiving standing area visible before entry');
    assert.ok(G.jetTop-g.camera.y>=23); assert.equal(G.floor-g.camera.y,160);
    h.run(g,10,['ArrowLeft','ShiftLeft']); assert.ok(g.player.data.position.x-g.camera.x>=24,'retreat never loses actor');
});

for(const afterCheckpoint of [false,true]) test(`native water removes helmet, then kills and respawns ${afterCheckpoint?'after':'before'} the checkpoint`,t=>{
    const h=guairaRespirosBrowser(t),g=h.create();
    if(afterCheckpoint) replay(h,g,true);
    else h.run(g,30);
    // Controlled damage fixture: stand inside the relevant real jet through
    // multiple cycles; no hurt()/die() call and no fabricated collision.
    g.player.data.position.x=afterCheckpoint?460:200;
    let hurt=false,dead=false;const previous=g.player;
    for(let i=0;i<1000&&g.player===previous;i++) {
        h.run(g,1);hurt ||= !g.player.data.hasHelmet;dead ||= g.player.data.isDead;
    }
    assert.equal(hurt,true);assert.equal(dead,true);assert.notEqual(g.player,previous);
    assert.equal(g.player.data.position.x,afterCheckpoint?304:48);assert.equal(g.objects.time,0);
    assert.equal(g.player.data.hasHelmet,true);assert.equal(g.finished,false);
    assert.equal(g.store.save.checkpoint?.index,afterCheckpoint?0:undefined);
    assert.equal(g.mapReturnHref,'./guaira.html?at=rice');
    h.run(g,800);assert.equal(g.player.data.hasHelmet,true);assert.equal(g.player.data.isDead,false);
});

test('checkpoint equipment is native and full retry clears checkpoint, result, water phase and held input synchronously',t=>{
    const h=guairaRespirosBrowser(t),g=h.create();replay(h,g,true);
    assert.equal(g.finished,false);assert.equal(g.mapReturnHref,'./guaira.html?at=rice');
    g.store.save.checkpoint!.helmet=false;g.load(G.id,true);assert.equal(g.player.data.hasHelmet,false);
    h.keys([]);g.load(G.id);replay(h,g);g.toggleRespirosPause();assert.equal(g.canAdvanceToBoss,false);
    h.keys(['ArrowRight']);g.load(G.id);
    assert.equal(g.finished,false);assert.equal(g.canAdvanceToBoss,false);assert.equal(g.state,'playing');
    assert.equal(g.store.save.checkpoint,null);assert.equal(g.objects.time,0);assert.equal(g.player.data.position.x,48);
    assert.equal(g.player.data.hasHelmet,true);assert.equal(g.input.getState().right,false);
    assert.equal(g.mapReturnHref,'./guaira.html?at=rice');assert.deepEqual(g.store.save.completed,[]);
});

for (const touch of [false, true]) test(`${touch ? 'native touch' : 'keyboard'} can jump over the optional checkpoint and still clear intact`, t => {
    const h = guairaRespirosBrowser(t, { touch }), g = h.create();
    const blocks: Array<[number, string[]]> = [[161,[]], [110,['ArrowRight']],
        [40,['ArrowRight','Space']], [271,[]], [140,['ArrowRight']]];
    let frames = 0;
    for (const [count, keys] of blocks) for (let i = 0; i < count; i++, frames++) {
        h.run(g, 1, keys);
        assert.equal(g.player.data.hasHelmet, true, `helmet at ${frames}`);
        assert.equal(g.player.data.isDead, false, `alive at ${frames}`);
        assert.notEqual(g.store.save.checkpoint?.index, 0, `first optional flag bypassed at ${frames}`);
    }
    finishPair(h, g);
    assert.equal(g.finished, true); assert.equal(feet(g), G.floor);
    assert.equal(g.mapReturnHref, './guaira.html?at=rice&visit=respiros-clear');
});

test('exit requires grounded dry-bank arrival but never requires the recovery flag',t=>{
    const h=guairaRespirosBrowser(t),g=h.create();
    g.player.data.position={x:G.finishX,y:200};g.player.data.isGrounded=false;h.run(g,1);assert.equal(g.finished,false);
    // Completion predicate fixture deliberately omits the checkpoint; the
    // full no-reposition replay above supplies the traversal proof.
    for(let i=0;i<60&&!g.finished;i++)h.run(g,1);
    assert.equal(g.finished,true);assert.equal(g.store.save.checkpoint,null);
});

test('pause, blur and hidden tab freeze both charging and flowing and require explicit resume with cleared controls',t=>{
    const h=guairaRespirosBrowser(t),g=h.create();
    for(const phase of ['charging','flowing'])for(const pause of [()=>{h.key('Escape');h.run(g,1);},()=>h.pointer(305,10),()=>h.window.dispatch('blur'),()=>h.hidden(true)]){
        h.keys([]);g.load(G.id);h.run(g,phase==='charging'?80:125);
        assert.equal(jetCycle(g.objects.get(G.firstJetId)!,g.objects.time).phase,phase);
        h.keys(['ArrowRight']);pause();assert.equal(g.state,'paused');const frozen=snapshot(g);
        h.run(g,120);g.render();assert.deepEqual(snapshot(g),frozen);assert.equal(g.input.getState().right,false);
        h.hidden(false);h.key('Escape',true);assert.equal(g.state,'paused');h.key('Escape');h.run(g,1);assert.equal(g.state,'playing');
    }
    h.keys([]);g.load(G.id);replay(h,g);g.toggleRespirosPause();const done=snapshot(g);h.run(g,60);g.render();assert.deepEqual(snapshot(g),done);
    g.toggleRespirosPause();h.run(g,60);assert.deepEqual(snapshot(g),done);
});

test('touch cancellation and focus loss release controls while safe idle does not drift into a grate',t=>{
    const h=guairaRespirosBrowser(t,{touch:true}),g=h.create();departure(h,g,304);
    h.run(g,8,['ArrowRight']);h.canvas.dispatch('touchcancel',{touches:[],changedTouches:[{identifier:1}]});
    g.update(dt);assert.equal(g.input.getState().right,false);h.run(g,800);
    assert.equal(g.player.data.hasHelmet,true);assert.equal(g.player.data.isDead,false);
    h.run(g,1,['Space']);h.window.dispatch('blur');assert.equal(g.input.getState().jump,false);
});

test('reduced motion preserves jet heights, native timing and replay while suppressing cosmetic impacts',t=>{
    const h=guairaRespirosBrowser(t,{reducedMotion:true}),g=h.create();assert.equal(g.reducedMotion,true);assert.equal(g.store.save.preferences.shake,false);
    h.run(g,125);assert.equal(jetCycle(g.objects.get(G.firstJetId)!,g.objects.time).height,128);
    const before=snapshot(g);g.render();g.render();assert.deepEqual(snapshot(g),before);
    h.keys([]);g.load(G.id);replay(h,g);assert.equal(g.finished,true);
    assert.deepEqual((g as unknown as {sparks:unknown[]}).sparks,[]);
});

test('final independently phased outlets resolve all 252 departure phases via the dry island', t => {
    const h = guairaRespirosBrowser(t), g = h.create();
    for (let phase = 0; phase < 252; phase++) {
        departure(h, g, G.finalCheckpointX, phase);
        finishPair(h, g);
        assert.equal(g.finished, true, `final pair phase ${phase}`);
        assert.equal(g.player.data.hasHelmet, true);
    }
});

for (const touch of [false, true]) test(`final dry island, native braking and recovery are safe with ${touch ? 'touch' : 'keyboard'}`, t => {
    const h = guairaRespirosBrowser(t, { touch }), g = h.create();
    departure(h, g, G.finalCheckpointX);
    waitForRetraction(h, g, G.thirdJetId); walkUntil(h, g, G.finalRefugeX);
    h.run(g, 756);
    assert.ok(g.player.data.position.x >= G.thirdEnd && g.player.data.position.x + g.player.data.width <= G.fourthStart);
    assert.equal(g.player.data.hasHelmet, true);
    const previous = g.player;
    g.player.data.position.x = 920; // Damage-only fixture, not traversal evidence.
    for (let i = 0; i < 1000 && g.player === previous; i++) h.run(g, 1);
    assert.notEqual(g.player, previous);
    assert.equal(g.player.data.position.x, G.finalCheckpointX);
    assert.equal(g.store.save.checkpoint?.index, 1);
    assert.equal(g.player.data.hasHelmet, true);
    finishPair(h, g); assert.equal(g.finished, true);
});

for (const touch of [false, true]) test(`optional maintenance coins rejoin the intact native route with ${touch ? 'touch' : 'keyboard'}`, t => {
    const h = guairaRespirosBrowser(t, { touch }), g = h.create();
    h.run(g, 1); walkUntil(h, g, 128); waitForRetraction(h, g, G.firstJetId);
    walkUntil(h, g, G.checkpointX); waitForRetraction(h, g, G.secondJetId);
    walkUntil(h, g, 578); h.run(g, 30);
    for (let i = 0; i < 60; i++) {
        h.run(g, 1, i < 30 ? ['Space'] : []);
        assert.ok(Math.round(g.player.data.position.y) - g.camera.y - 4 >= 23, 'shelf jump stays below HUD');
        assert.equal(g.player.data.hasHelmet, true);
    }
    assert.equal(feet(g), G.shelfTop);
    assert.equal(g.coins, 2);
    // A second full shelf jump checks the raised takeoff apex too.
    for (let i = 0; i < 60; i++) {
        h.run(g, 1, i < 30 ? ['Space'] : []);
        assert.ok(Math.round(g.player.data.position.y) - g.camera.y - 4 >= 23);
    }
    finishPair(h, g); assert.equal(g.finished, true); assert.equal(g.coins, 2);
    assert.deepEqual(g.store.save.completed, []); assert.deepEqual(h.storageCalls, []);
    h.keys([]); g.load(G.id); assert.equal(g.coins, 0);
});

for (const touch of [false, true]) test(`raised shelf jump retreat keeps the full helmet below HUD with ${touch ? 'touch' : 'keyboard'}`, t => {
    const h = guairaRespirosBrowser(t, { touch }), g = h.create();
    departure(h, g, 584); // Controlled camera fixture; complete traversal is tested above.
    h.run(g, 40, ['Space']); h.run(g, 40);
    assert.equal(feet(g), G.shelfTop);
    let crossed = false;
    for (let i = 0; i < 50; i++) {
        h.run(g, 1, i < 30 ? ['Space', 'ArrowLeft'] : []);
        crossed ||= g.player.data.position.x < G.secondEnd;
        assert.ok(Math.round(g.player.data.position.y) - g.camera.y - 4 >= 23);
    }
    assert.equal(crossed, true);
});
