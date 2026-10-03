import assert from 'node:assert/strict';
import test from 'node:test';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { WorldLevel } from '../src/adventure/WorldPhysics';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { TileType as T } from '../src/constants';
import { STAGES, ISLANDS } from '../src/adventure/campaign';
import { GuairaRelief, GUAIRA_RELIEF as G, guairaReliefStage } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { guairaReliefBrowser } from './helpers/guairaReliefHarness';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import recording from './helpers/guairaReliefReplay.json';

type Run = [number, string[]];
type Harness = ReturnType<typeof guairaReliefBrowser>;
const dt = 1000 / 60;
const feet = (g: GuairaRelief) => g.player.data.position.y + g.player.data.height;
const jet = (g: GuairaRelief) => g.objects.get(G.jetId)!;
function snapshot(g: GuairaRelief) {
    const player = structuredClone(g.player.data); player.animationTimer = 0;
    return structuredClone({ player, camera: g.camera, tiles: g.level.data.tiles, objects: g.objects,
        checkpoint: g.store.save.checkpoint, elapsed: g.elapsed, time: g.time, finished: g.finished });
}
function route(h: Harness, g: GuairaRelief, blocks: Run[]) {
    let frame = 0, openedAt = 0, finishedAt = 0, highLanding = false, recoveryLanding = false;
    for (const [count, keys] of blocks) {
        h.keys(keys);
        for (let i = 0; i < count; i++) {
            const wasOpen = g.reliefOpened;
            g.update(dt); frame++;
            const p = g.player.data;
            assert.equal(p.isDead, false, `alive at ${frame}`); assert.equal(p.hasHelmet, true, `helmet at ${frame}`);
            assert.ok(p.position.y - 4 - g.camera.y >= 24, `helmet below HUD at ${frame}`);
            assert.ok(feet(g) - g.camera.y <= 168.001, `feet visible at ${frame}`);
            if (!wasOpen && g.reliefOpened) {
                openedAt = frame;
                assert.equal(jet(g).active, true, 'native destruction immediately shuts this jet');
                assert.equal(g.objects.jetDanger(jet(g)), null);
                assert.ok(224 - g.camera.y < 172, 'receiving shelf is already visible at the break');
            }
            if (p.isGrounded && feet(g) === 160) {
                highLanding = true;
                assert.ok(224 - g.camera.y >= 24 && 224 - g.camera.y <= 172, 'upper receiving shelf preview');
            }
            if (p.isGrounded && feet(g) === 224) {
                recoveryLanding = true;
                assert.ok(G.floor - g.camera.y <= 172, 'lower floor preview before walking off shelf');
            }
            if (g.finished && !finishedAt) finishedAt = frame;
        }
    }
    return { frame, openedAt, finishedAt, highLanding, recoveryLanding };
}

test('relief uses native authority, isolated tiles and no campaign/save/exit additions', t => {
    const stages = structuredClone(STAGES), islands = structuredClone(ISLANDS), h = guairaReliefBrowser(t), g = h.create();
    assert.ok(g.input instanceof Input); assert.ok(g.player instanceof Player); assert.ok(g.level instanceof WorldLevel);
    assert.equal(g.player.data.position.x, G.spawnX); assert.equal(feet(g), G.floor);
    assert.equal(g.level.data.tiles.flat().filter(tile => tile === T.BRICK_BREAKABLE).length, 3);
    assert.equal(g.stage.mechanisms.length, 1); assert.equal(g.stage.mechanisms[0].kind, 'jet');
    for (const key of ['exits','foes','pickups','dialogues','landmarks'] as const) assert.deepEqual(g.stage[key], []);
    assert.equal(g.boss, null); assert.equal(g.store.save.checkpoint, null);
    const altered = guairaReliefStage(); altered.level.tiles[10][15] = T.EMPTY;
    assert.equal(guairaReliefStage().level.tiles[10][15], T.BRICK_BREAKABLE);
    g.render(); assert.ok(h.canvas.drawCalls > 0);
    assert.deepEqual(STAGES, stages); assert.deepEqual(ISLANDS, islands); assert.deepEqual(h.storageCalls, []);
});

for (const touch of [false, true]) for (const reducedMotion of [false, true])
    for (const name of ['maintenance', 'interval'] as const)
        test(`full ${name} native ${touch ? 'touch' : 'keyboard'} route, reduced motion ${reducedMotion}`, t => {
            const h = guairaReliefBrowser(t, { touch, reducedMotion }), g = h.create();
            const trace = route(h, g, recording[name] as Run[]);
            assert.equal(g.finished, true); assert.equal(feet(g), G.floor);
            assert.equal(g.reliefOpened, name === 'maintenance'); assert.equal(jet(g).active, name === 'maintenance');
            assert.equal(trace.openedAt > 0, name === 'maintenance');
            assert.equal(trace.highLanding, name === 'maintenance');
            assert.equal(g.store.save.checkpoint?.index, 0); assert.equal(g.coins, 0);
            assert.deepEqual(g.store.save.completed, []); assert.deepEqual(g.store.save.times, {});
            const frozen = snapshot(g); h.run(g, 60, ['ArrowLeft', 'Space', 'ArrowDown']); g.render();
            assert.deepEqual(snapshot(g), frozen); assert.match(h.status.textContent, /PASSAGEM INSPECIONADA/);
            h.keys([]); g.load(G.id); route(h, g, recording[name] as Run[]);
            assert.deepEqual(snapshot(g), frozen, 'same physical route repeats deterministically');
        });

for (const touch of [false, true]) test(`native ${touch ? 'touch' : 'keyboard'} head bump and flag skip are valid alternatives`, t => {
    const h = guairaReliefBrowser(t, { touch }), g = h.create();
    route(h, g, recording.headBump as Run[]);
    assert.equal(g.finished, true); assert.equal(g.reliefOpened, true);
    assert.equal(g.level.getTile(15,10), T.EMPTY); assert.equal(g.level.getTile(17,10), T.BRICK_BREAKABLE,
        'one native opening suffices without secretly requiring the entire lid');
    h.keys([]); g.load(G.id); route(h, g, recording.skipFlag as Run[]);
    assert.equal(g.finished, true); assert.equal(g.store.save.checkpoint, null); assert.equal(g.reliefOpened, false);
});

function waitForRetraction(h: Harness, g: GuairaRelief) {
    let sawLiquid = false;
    for (let n = 0; n < 510; n++) {
        h.run(g, 1);
        const danger = g.objects.jetDanger(jet(g));
        sawLiquid ||= !!danger;
        if (sawLiquid && !danger) return;
    }
    assert.fail('a complete native warning/discharge/retraction must repeat');
}

for (const touch of [false, true]) test(`twelve native arrival phases allow observation, reversal and recovery with ${touch ? 'touch' : 'keys'}`, t => {
    const h = guairaReliefBrowser(t, { touch }), g = h.create();
    for (let delay = 0; delay < 252; delay += 21) {
        h.keys([]); g.load(G.id); h.run(g, delay); h.run(g, 154, ['ArrowRight']); h.run(g, 30);
        assert.ok(g.player.data.position.x + g.player.data.width < G.jetStart);
        assert.ok(G.jetEnd - g.camera.x < 320 && 208 - g.camera.y >= 24, 'whole dangerous column visible from refuge');
        waitForRetraction(h,g);
        h.run(g,45,['ArrowRight']); assert.ok(g.player.data.position.x > G.jetStart, 'enters the real grate');
        h.run(g,45,['ArrowLeft']); h.run(g,30);
        assert.ok(g.player.data.position.x + g.player.data.width < G.jetStart, 'reverses to dry bank');
        h.run(g,756); assert.equal(g.player.data.hasHelmet,true); assert.equal(g.player.data.isDead,false);
        waitForRetraction(h,g); h.run(g,130,['ArrowRight']);
        assert.equal(g.finished,true, `arrival delay ${delay}`); assert.equal(g.player.data.hasHelmet,true);
        assert.equal(g.reliefOpened,false);
    }
});

for (const touch of [false,true]) test(`maintenance detour and opened grate remain reversible by native ${touch?'touch':'keys'}`,t=>{
    const h=guairaReliefBrowser(t,{touch}),g=h.create();
    route(h,g,recording.maintenance.slice(0,12) as Run[]);
    assert.equal(feet(g),224); assert.equal(g.reliefOpened,true);
    h.run(g,135,['ArrowRight']);h.run(g,30);assert.ok(g.player.data.position.x>G.jetEnd);
    h.run(g,220,['ArrowLeft']);h.run(g,30);assert.ok(g.player.data.position.x<128);
    assert.equal(feet(g),G.floor);assert.equal(g.player.data.hasHelmet,true);assert.equal(g.finished,false);
    h.run(g,756);assert.equal(g.objects.jetDanger(jet(g)),null);
    h.run(g,260,['ArrowRight']);assert.equal(g.finished,true);assert.equal(g.reliefOpened,true);
});

for (const touch of [false,true]) test(`real break during live discharge stops pressure immediately with ${touch?'touch':'keys'}`,t=>{
    const h=guairaReliefBrowser(t,{touch}),g=h.create();
    route(h,g,recording.maintenance.slice(0,10) as Run[]);h.run(g,124);
    let wasDangerous=false,sawSnapshot=false;
    h.run(g,8,['Space']);h.keys(['ArrowDown']);
    for(let n=0;n<40;n++){
        wasDangerous ||= !!g.objects.jetDanger(jet(g));g.update(dt);
        if(g.reliefOpened){sawSnapshot=!!jet(g).jetShutdown;break;}
    }
    assert.equal(wasDangerous,true);assert.equal(g.reliefOpened,true);assert.equal(sawSnapshot,true);
    assert.equal(g.objects.jetDanger(jet(g)),null);assert.equal(g.player.data.hasHelmet,true);
    h.run(g,200,['ArrowRight']);assert.equal(g.finished,true);assert.equal(g.player.data.hasHelmet,true);
});

test('the initial phase asks for a choice, and backing out of the intact upper route stays safe',t=>{
    const h=guairaReliefBrowser(t),g=h.create();
    h.run(g,204,['ArrowRight']);assert.equal(g.player.data.hasHelmet,false,'blind walking meets the visible first discharge');
    assert.equal(g.reliefOpened,false);
    h.keys([]);g.load(G.id);route(h,g,recording.maintenance.slice(0,8) as Run[]);
    assert.equal(feet(g),160);h.run(g,90,['ArrowLeft']);h.run(g,50);
    assert.ok(g.player.data.position.x<100);assert.equal(feet(g),G.floor);
    assert.equal(g.reliefOpened,false);assert.equal(g.player.data.hasHelmet,true);
});

test('first warning is visible with measured braking margin before native contact damage',t=>{
    const h=guairaReliefBrowser(t),g=h.create();h.keys(['ArrowRight']);
    let warningFrame=0,warningGap=0,hitFrame=0;
    for(let frame=1;frame<=204;frame++){
        g.update(dt);const p=g.player.data,s=jetCycle(jet(g),g.objects.time);
        if(!warningFrame&&s.phase==='charging'){
            warningFrame=frame;warningGap=G.jetStart-p.position.x-p.width;
            const gaugeX=G.jetStart-17-g.camera.x;
            assert.ok(gaugeX>0&&gaugeX+10<320);assert.ok(G.floor-57-g.camera.y>23);
            const frozen=snapshot(g);g.render();assert.deepEqual(snapshot(g),frozen);
        }
        if(!hitFrame&&!p.hasHelmet)hitFrame=frame;
    }
    assert.equal(warningFrame,114);assert.equal(hitFrame,172);assert.ok(warningGap>115);
    h.keys([]);g.load(G.id);h.run(g,warningFrame,['ArrowRight']);h.run(g,30);
    assert.ok(G.jetStart-g.player.data.position.x-g.player.data.width>104);
    assert.equal(g.player.data.hasHelmet,true);h.run(g,756);assert.equal(g.player.data.hasHelmet,true);
});

test('helmet-assisted crossing is a valid arrival and the result reports only the actual relief state',t=>{
    const h=guairaReliefBrowser(t),g=h.create();h.run(g,300,['ArrowRight']);g.render();
    assert.equal(g.finished,true);assert.equal(g.player.data.hasHelmet,false);assert.equal(g.reliefOpened,false);
    assert.match(h.status.textContent,/alívio intacto, grelha mantém o ciclo/);
    assert.doesNotMatch(h.status.textContent,/pelo intervalo/);
});

test('standing in the live native jet loses helmet, dies and rebuilds at the prior flag with a full warning',t=>{
    const h=guairaReliefBrowser(t),g=h.create();h.run(g,154,['ArrowRight']);h.run(g,80);h.run(g,45,['ArrowRight']);h.keys([]);
    let helmetLost=false,died=false,reconstructed=false;
    const old=g.objects;
    for(let n=0;n<650;n++){
        g.update(dt);helmetLost ||= !g.player.data.hasHelmet;died ||= g.player.data.isDead;
        if(g.objects!==old){reconstructed=true;break;}
    }
    assert.equal(helmetLost,true);assert.equal(died,true);assert.equal(reconstructed,true);
    assert.equal(g.player.data.position.x,G.checkpointX);assert.equal(g.player.data.hasHelmet,true);
    assert.equal(g.reliefOpened,false);assert.equal(jet(g).active,false);assert.equal(g.objects.time,0);
    // Let native reveal finish; then observe the object clock, not presentation time.
    let chargingFrames=0,firstDanger=0;
    for(let n=0;n<220;n++){
        h.run(g,1);const s=jetCycle(jet(g),g.objects.time);
        if(s.phase==='charging')chargingFrames++;
        if(s.danger){firstDanger=g.objects.time;break;}
    }
    assert.ok(chargingFrames>=47);assert.ok(firstDanger>=2700);assert.equal(g.player.data.hasHelmet,true);
});

test('explicit death fixtures distinguish initial reset, checkpoint reconstruction and fresh retry',t=>{
    const h=guairaReliefBrowser(t),g=h.create();
    g.player.die('fall');h.run(g,160);assert.equal(g.player.data.position.x,G.spawnX);assert.equal(g.store.save.checkpoint,null);
    h.keys([]);g.load(G.id);route(h,g,recording.maintenance.slice(0,12) as Run[]);
    g.player.die('fall');h.keys([]);const old=g.objects;
    for(let n=0;n<160&&g.objects===old;n++)g.update(dt);
    assert.equal(g.player.data.position.x,G.checkpointX);assert.equal(g.reliefOpened,false);
    assert.equal(g.level.getTile(16,10),T.BRICK_BREAKABLE);assert.equal(jet(g).active,false);
    h.keys(['ArrowRight']);g.load(G.id);
    assert.equal(g.player.data.position.x,G.spawnX);assert.equal(g.store.save.checkpoint,null);assert.equal(g.elapsed,0);
    assert.equal(g.objects.time,0);assert.equal(g.finished,false);assert.equal(g.input.getState().right,false);
});

for(const event of ['escape','pause','blur','hidden','touchcancel'] as const)test(`native interruption ${event} preserves physical state`,t=>{
    const h=guairaReliefBrowser(t,{touch:event==='touchcancel'}),g=h.create();
    h.run(g,154,['ArrowRight']);h.run(g,220); // safe bank while next warning is charging
    if(event==='escape')h.key('Escape');else if(event==='pause')g.toggleReliefPause();
    else if(event==='blur')h.window.dispatch('blur');else if(event==='hidden')h.hidden(true);
    else {h.keys(['ArrowRight']);h.canvas.dispatch('touchcancel',{touches:[]});}
    if(event==='touchcancel'){
        h.run(g,80);assert.ok(g.player.data.position.x+g.player.data.width<G.jetStart);assert.equal(g.input.getState().right,false);
    }else{
        g.update(dt);assert.equal(g.state,'paused');const frozen=snapshot(g);h.run(g,120);g.render();assert.deepEqual(snapshot(g),frozen);
        if(event==='hidden')h.hidden(false);assert.equal(g.state,'paused');g.toggleReliefPause();assert.equal(g.state,'playing');
    }
});

test('dispose cancels ownership, clears local result/checkpoint and reentry is fresh',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaRelief);
    const count=h.listenerCount();assert.ok(count>0);g.dispose();
    assert.equal(g.isDisposed,true);assert.equal(g.finished,false);assert.equal(g.store.save.checkpoint,null);
    assert.equal(h.frames.size,0);assert.equal(h.listenerCount(),0);g.update(dt);g.render();
    const next=h.create(GuairaRelief);assert.equal(next.reliefOpened,false);assert.equal(next.player.data.position.x,G.spawnX);next.dispose();
});
