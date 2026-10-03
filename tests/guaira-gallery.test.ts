import assert from 'node:assert/strict';
import test from 'node:test';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { TileType as T } from '../src/constants';
import { GroundPoundState } from '../src/types';
import { WorldLevel } from '../src/adventure/WorldPhysics';
import { STAGES, ISLANDS } from '../src/adventure/campaign';
import { GuairaGallery, GUAIRA_GALLERY as G, guairaGalleryStage, galleryArrival } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { guairaGalleryBrowser } from './helpers/guairaGalleryHarness';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import recording from './helpers/guairaGalleryReplay.json';

const dt = 1000 / 60;
const feet = (g: GuairaGallery) => g.player.data.position.y + g.player.data.height;
type Harness = ReturnType<typeof guairaGalleryBrowser>;
type Run = [number, string[]];
const runs = recording.runs as Run[];
const tiles = (g: GuairaGallery, row: number, col: number) => [0,1,2].map(i => g.level.getTile(col+i,row));
function snapshot(g: GuairaGallery) {
    const p = structuredClone(g.player.data); p.animationTimer = 0;
    return structuredClone({ p, camera: g.camera, time: g.time, elapsed: g.elapsed, objects: g.objects,
        tiles: g.level.data.tiles, checkpoint: g.store.save.checkpoint, finished: g.finished });
}
function visible(g: GuairaGallery, x: number, y: number, width = 16) {
    assert.ok(x + width > g.camera.x && x < g.camera.x + 320, `surface x${x} inside camera${g.camera.x}`);
    assert.ok(y - g.camera.y >= 24 && y - g.camera.y <= 172, `surface y${y} visible at${y-g.camera.y}`);
}
function replay(h: Harness, g: GuairaGallery, blocks = runs) {
    let frames = 0, firstDescent = false, secondDescent = false, firstBreak = false, secondBreak = false;
    for (const [count, keys] of blocks) {
        h.keys(keys);
        for (let i = 0; i < count; i++, frames++) {
            const before = g.openings;
            g.update(dt);
            const p = g.player.data;
            assert.equal(p.isDead, false, `alive at${frames}`); assert.equal(p.hasHelmet, true, `helmet at${frames}`);
            assert.ok(p.position.y - g.camera.y >= 26, `actor clear of HUD at${frames}`);
            assert.ok(feet(g) - g.camera.y <= 172, `actor visible at${frames}`);
            if (!before.first && g.openings.first) { firstBreak = true; visible(g,160,240,32); }
            if (!before.second && g.openings.second) { secondBreak = true; visible(g,384,336,32); }
            firstDescent ||= p.position.x >= 160 && p.position.x < 224 && feet(g) >= 240;
            secondDescent ||= p.position.x >= 384 && p.position.x < 448 && feet(g) >= 336;
            if (p.isGrounded && feet(g) === 240 && p.position.x < 224) visible(g,192,288,32);
            if (p.isGrounded && feet(g) === 336 && p.position.x < 448) visible(g,416,384,32);
        }
    }
    return { frames, firstDescent, secondDescent, firstBreak, secondBreak };
}

test('gallery is an isolated native level with only six real breakable tiles and no campaign hooks', t => {
    const stages = structuredClone(STAGES), islands = structuredClone(ISLANDS), h = guairaGalleryBrowser(t), g = h.create();
    assert.ok(g.player instanceof Player); assert.ok(g.input instanceof Input); assert.ok(g.level instanceof WorldLevel);
    assert.equal(g.player.data.position.x,48); assert.equal(feet(g),176); assert.equal(g.player.data.hasHelmet,true);
    assert.equal(g.stage.level.tiles.flat().filter(tile => tile === T.BRICK_BREAKABLE).length,6);
    for (const key of ['exits','foes','mechanisms','pickups','dialogues','landmarks'] as const) assert.deepEqual(g.stage[key],[]);
    assert.equal(g.boss,null); assert.equal(g.mapReturnHref,'./guaira.html?at=bairro');
    for (let row=0;row<15;row++) assert.equal(g.level.getTile(14,row),T.GROUND);
    for (let row=0;row<21;row++) assert.equal(g.level.getTile(28,row),T.GROUND);
    assert.equal(g.level.getTile(27,19),T.EMPTY,'B lip must not seal the underpass');
    assert.equal(g.level.getTile(13,16),T.EMPTY,'A recovery underpass remains open');
    const altered=guairaGalleryStage(); altered.level.tiles[11][10]=T.EMPTY;
    assert.equal(guairaGalleryStage().level.tiles[11][10],T.BRICK_BREAKABLE);
    g.render(); assert.ok(h.canvas.drawCalls>0); assert.deepEqual(STAGES,stages); assert.deepEqual(ISLANDS,islands);
});

for (const touch of [false,true]) for (const reducedMotion of [false,true]) test(`complete native ${touch?'touch':'keyboard'} replay, reduced motion${reducedMotion}`, t => {
    const h=guairaGalleryBrowser(t,{touch,reducedMotion}),g=h.create();
    let campaignCompletions=0; (g as unknown as {complete():void}).complete=()=>{campaignCompletions++;};
    const result=replay(h,g);
    assert.deepEqual([result.firstBreak,result.firstDescent,result.secondBreak,result.secondDescent],[true,true,true,true]);
    assert.equal(g.finished,true); assert.equal(feet(g),192); assert.equal(g.player.data.position.x,recording.expected.x);
    assert.deepEqual(tiles(g,11,10),[0,0,0]); assert.deepEqual(tiles(g,18,24),[0,0,0]);
    assert.equal(g.store.save.checkpoint?.index,0); assert.equal(g.coins,0); assert.equal(campaignCompletions,0);
    assert.deepEqual(g.store.save.completed,[]); assert.deepEqual(g.store.save.times,{}); assert.equal(g.mapReturnHref,G.mapHref);
    const frozen=snapshot(g), idle=g.player.data.animationTimer; h.run(g,60,['ArrowLeft','Space','ArrowDown']); g.render();
    assert.deepEqual(snapshot(g),frozen);
    assert.equal(g.player.data.animationTimer,idle,'Completed avatar paint uses its own clock; native PlayerData stays frozen');
    assert.match(h.status.textContent,/ACESSO DE INSPEÇÃO ABERTO/);
    if(reducedMotion) assert.deepEqual((g as unknown as {sparks:unknown[]}).sparks,[]);
    h.keys([]); g.load(G.id); replay(h,g); assert.deepEqual(snapshot(g),frozen,'same input remains deterministic');
});

for (const touch of [false,true]) test(`single-tile openings remain traversable and sufficient with native ${touch?'touch':'keys'}`,t=>{
    const h=guairaGalleryBrowser(t,{touch}),g=h.create();
    const result=replay(h,g,recording.partialRuns as Run[]);
    assert.equal(g.finished,true); assert.equal(result.firstDescent,true); assert.equal(result.secondDescent,true);
    assert.deepEqual(tiles(g,11,10),[0,T.BRICK_BREAKABLE,T.BRICK_BREAKABLE]);
    assert.deepEqual(tiles(g,18,24),[0,T.BRICK_BREAKABLE,T.BRICK_BREAKABLE]);
    assert.equal(galleryArrival(g.level,g.player.data),true,'completion never secretly demands all six tiles');
});

for(const touch of [false,true])test(`right-edge single holes have visible lower floors and complete via ${touch?'touch':'keys'}`,t=>{
    const h=guairaGalleryBrowser(t,{touch}),g=h.create();
    h.run(g,100,['ArrowRight']);h.run(g,30);visible(g,192,288,32);
    h.run(g,8,['Space']);h.run(g,40,['ArrowDown']);visible(g,192,288,32);
    assert.deepEqual(tiles(g,11,10),[10,10,0]);
    h.run(g,32,['ArrowLeft']);h.run(g,30);assert.equal(feet(g),240);
    h.run(g,42,['ArrowRight']);h.run(g,30);h.run(g,120,['ArrowRight']);h.run(g,30);visible(g,416,384,32);
    h.run(g,8,['Space']);h.run(g,40,['ArrowDown']);visible(g,416,384,32);
    assert.deepEqual(tiles(g,18,24),[10,10,0]);
    h.run(g,32,['ArrowLeft']);h.run(g,30);assert.equal(feet(g),336);
    h.run(g,55,['ArrowRight']);h.run(g,30);
    for(const[n,k]of runs.slice(12))h.run(g,n,k);
    assert.equal(g.finished,true);assert.equal(g.player.data.hasHelmet,true);assert.equal(g.player.data.isDead,false);
});

for(const touch of [false,true])test(`native ${touch?'touch':'keyboard'} route can skip the optional flag and still complete`,t=>{
    const h=guairaGalleryBrowser(t,{touch}),g=h.create();
    const blocks:Run[]=[...runs.slice(0,6),[12,['ArrowRight']],[42,['ArrowRight','Space']],[30,[]],
        [12,['ArrowRight']],[30,[]],...runs.slice(8)];
    for(const[n,k]of blocks)for(let i=0;i<n;i++){
        h.run(g,1,k);assert.equal(g.store.save.checkpoint,null);assert.equal(g.player.data.hasHelmet,true);
    }
    assert.equal(g.finished,true);assert.equal(feet(g),192);
});

test('real break preserves native150ms ground-pound recovery before falling onto the visible shelf',t=>{
    const h=guairaGalleryBrowser(t),g=h.create();
    for(const [count,keys] of runs.slice(0,3))h.run(g,count,keys);
    h.keys(['ArrowDown']);let frame=0;
    while(!g.openings.first && frame++<90)g.update(dt);
    assert.equal(g.openings.first,true); assert.equal(feet(g),176);
    assert.equal(g.player.data.groundPoundState,GroundPoundState.RECOVERY);assert.equal(g.player.data.groundPoundTimer,150);
    visible(g,160,240,32);
    h.run(g,8);assert.equal(feet(g),176);assert.equal(g.player.data.groundPoundState,GroundPoundState.RECOVERY);
    h.run(g,30);assert.equal(feet(g),240);assert.equal(g.player.data.isGrounded,true);visible(g,192,288,32);
});

for(const reducedMotion of [false,true])test(`camera crosses lid edges and returning falls without abrupt rebound, reduced motion${reducedMotion}`,t=>{
    const h=guairaGalleryBrowser(t,{reducedMotion}),g=h.create();
    const blocks:Run[]=[[100,['ArrowRight']],[30,[]],[8,['Space']],[40,['ArrowDown']],[32,['ArrowLeft']],[30,[]],
        [42,['ArrowRight']],[30,[]],[120,['ArrowRight']],[30,[]],[8,['Space']],[40,['ArrowDown']],[32,['ArrowLeft']],[30,[]]];
    let previousY=g.camera.y,frame=0,maxDelta=0;
    for(const[n,k]of blocks){h.keys(k);for(let i=0;i<n;i++,frame++){
        g.update(dt);const delta=g.camera.y-previousY;
        maxDelta=Math.max(maxDelta,Math.abs(delta));assert.ok(Math.abs(delta)<=8.000001,`camera step at${frame}`);
        if(g.player.data.velocity.y>0)assert.ok(delta>=-.000001,`no upward rebound while falling at${frame}`);
        assert.ok(g.player.data.position.y-g.camera.y>=26);assert.ok(feet(g)-g.camera.y<=172);
        previousY=g.camera.y;
    }}
    assert.equal(maxDelta,8);assert.equal(feet(g),336);
});

for(const touch of [false,true])test(`both shafts have physical outward and return paths with ${touch?'touch':'keyboard'}`,t=>{
    const h=guairaGalleryBrowser(t,{touch}),g=h.create();
    for(const [n,k]of runs.slice(0,4))h.run(g,n,k);
    h.run(g,20,['ArrowLeft','Space']);h.run(g,40);assert.equal(feet(g),176);assert.ok(g.player.data.position.x<160);
    h.run(g,64,['ArrowRight']);h.run(g,30);assert.equal(feet(g),288);assert.ok(g.player.data.position.x>240);
    h.run(g,40,['ArrowLeft']);h.run(g,30);assert.ok(g.player.data.position.x>=160&&g.player.data.position.x<192);
    h.run(g,26,['Space']);h.run(g,40);assert.equal(feet(g),240);
    h.run(g,20,['ArrowLeft','Space']);h.run(g,40);assert.equal(feet(g),176);assert.ok(g.player.data.position.x<160);
    h.keys([]);g.load(G.id);for(const [n,k]of runs.slice(0,12))h.run(g,n,k);
    h.run(g,40,['ArrowLeft']);h.run(g,30);assert.equal(feet(g),384);assert.ok(g.player.data.position.x<416);
    h.run(g,26,['Space']);h.run(g,40);assert.equal(feet(g),336);
    h.run(g,20,['ArrowLeft','Space']);h.run(g,40);assert.equal(feet(g),288);assert.ok(g.player.data.position.x<384);
    h.run(g,64,['ArrowRight']);h.run(g,30);assert.equal(feet(g),384);assert.ok(g.player.data.position.x>464);
    assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true);
});

test('run-jump and reversing jump sweeps cannot bypass either intact lid/wall',t=>{
    const h=guairaGalleryBrowser(t),g=h.create();
    for(const firstOpened of [false,true])for(const run of [false,true])for(const hold of [1,8,16,30])for(let delay=0;delay<=70;delay+=5){
        h.keys([]);g.load(G.id);
        if(firstOpened)for(const[n,k]of runs.slice(0,6))h.run(g,n,k);
        for(let frame=0;frame<180;frame++){
            const phase=(frame-delay+240)%60;
            const direction=frame>=110&&frame<125?'ArrowLeft':'ArrowRight';
            h.run(g,1,[direction,...(run?['ShiftLeft']:[]),...(frame>=delay&&phase<hold?['Space']:[])]);
            assert.ok(g.player.data.position.x<= (firstOpened?434:210)+.001,'ceiling-high wall blocks crossing');
            assert.equal(g.openings.second,false);if(!firstOpened)assert.equal(g.openings.first,false);
            assert.equal(g.finished,false);assert.equal(g.player.data.isDead,false);
        }
    }
});

test('partial opening returns use real native head bumps, never fabricated breaks',t=>{
    const h=guairaGalleryBrowser(t),g=h.create();
    for(const[n,k]of (recording.partialRuns as Run[]).slice(0,6))h.run(g,n,k);
    h.run(g,15,['ArrowLeft']);h.run(g,30);assert.equal(feet(g),288);
    const before=tiles(g,11,10).filter(x=>x===T.BRICK_BREAKABLE).length;
    h.run(g,26,['Space']);h.run(g,40);assert.equal(feet(g),240);
    assert.ok(tiles(g,11,10).filter(x=>x===T.BRICK_BREAKABLE).length<before,'native head contact opens a remaining lid tile');
    h.run(g,20,['ArrowLeft','Space']);h.run(g,40);assert.equal(feet(g),176);
});

for(const checkpoint of [false,true])for(const helmet of [false,true])test(`isolated native death fixture rebuilds checkpoint${checkpoint}, helmet${helmet}`,t=>{
    const h=guairaGalleryBrowser(t),g=h.create();
    // Equipment/death are controlled fixtures; traversal proofs above do not mutate player state.
    g.player.data.hasHelmet=helmet;
    for(const[n,k]of runs.slice(0,checkpoint?10:4))h.run(g,n,k);
    assert.equal(!!g.store.save.checkpoint,checkpoint);
    const before=g.player;g.player.die('fall');
    for(let i=0;i<240&&g.player===before;i++)h.run(g,1);
    assert.notEqual(g.player,before);assert.equal(g.player.data.position.x,checkpoint?320:48);
    assert.equal(feet(g),checkpoint?288:176);assert.equal(g.player.data.hasHelmet,checkpoint?helmet:true);
    assert.deepEqual(tiles(g,11,10),checkpoint?[0,0,0]:[10,10,10]);assert.deepEqual(tiles(g,18,24),[10,10,10]);
    assert.equal(g.finished,false);assert.equal(g.objects.time,0);assert.equal(g.mapReturnHref,G.mapHref);
    assert.equal(g.store.save.checkpoint?.helmet,checkpoint?helmet:undefined);
});

test('canonical checkpoint reconstruction widens partial A and restores a partially broken B',t=>{
    const h=guairaGalleryBrowser(t),g=h.create();
    for(const[n,k]of (recording.partialRuns as Run[]).slice(0,10))h.run(g,n,k);
    assert.deepEqual(tiles(g,11,10),[0,10,10]);assert.deepEqual(tiles(g,18,24),[0,10,10]);
    const before=g.player;g.player.die('fall');
    for(let i=0;i<240&&g.player===before;i++)h.run(g,1);
    assert.notEqual(g.player,before);assert.equal(g.player.data.position.x,320);assert.equal(feet(g),288);
    assert.deepEqual(tiles(g,11,10),[0,0,0]);assert.deepEqual(tiles(g,18,24),[10,10,10]);
});

test('completion predicate and checkpoint tolerance do not grant arrival from the air or lower shaft',t=>{
    const h=guairaGalleryBrowser(t),g=h.create();
    // Predicate/tolerance fixtures are deliberately separate from complete input-only runs.
    g.player.data.position={x:320,y:336};g.player.data.isGrounded=false;h.run(g,1);
    assert.equal(g.store.save.checkpoint,null);assert.equal(g.finished,false);
    g.player.data.position={x:G.finishX,y:G.terraceY-24};g.player.data.isGrounded=true;
    assert.equal(galleryArrival(g.level,g.player.data),false,'intact lids cannot finish even at exit');
    h.keys([]);g.load(G.id);replay(h,g);
    const p=structuredClone(g.player.data);p.isGrounded=false;assert.equal(galleryArrival(g.level,p),false);
    p.isGrounded=true;p.isDead=true;assert.equal(galleryArrival(g.level,p),false);
    p.isDead=false;p.position.y+=48;assert.equal(galleryArrival(g.level,p),false);
    g.store.save.checkpoint=null;assert.equal(galleryArrival(g.level,g.player.data),true,'checkpoint is never a completion prerequisite');
});

test('retry clears result, both holes, checkpoint and held input immediately even after victory/pause',t=>{
    const h=guairaGalleryBrowser(t),g=h.create();replay(h,g);g.toggleGalleryPause();h.keys(['ArrowRight']);g.load(G.id);
    assert.equal(g.finished,false);assert.equal(g.state,'playing');assert.equal(g.store.save.checkpoint,null);
    assert.deepEqual(g.openings,{first:false,second:false});assert.equal(g.player.data.position.x,48);
    assert.equal(g.input.getState().right,false);assert.equal(g.player.data.hasHelmet,true);assert.equal(g.time,0);
});

test('pause, Escape, blur and hidden freeze simulation and clear native controls during a descent',t=>{
    const h=guairaGalleryBrowser(t),g=h.create();
    for(const pause of [()=>{h.key('Escape');h.run(g,1);},()=>h.pointer(305,10),()=>h.window.dispatch('blur'),()=>h.hidden(true)]){
        h.keys([]);g.load(G.id);for(const[n,k]of runs.slice(0,3))h.run(g,n,k);
        h.run(g,1,['ArrowDown']);h.keys(['ArrowRight']);pause();assert.equal(g.state,'paused');
        const frozen=snapshot(g);h.run(g,120);g.render();assert.deepEqual(snapshot(g),frozen);
        assert.equal(g.input.getState().right,false);h.hidden(false);h.key('Escape',true);assert.equal(g.state,'paused');
        h.key('Escape');h.run(g,1);assert.equal(g.state,'playing');
    }
    h.keys([]);g.load(G.id);replay(h,g);g.toggleGalleryPause();const won=snapshot(g);h.run(g,60);assert.deepEqual(snapshot(g),won);
});

test('touch cancellation releases movement and descent input',t=>{
    const h=guairaGalleryBrowser(t,{touch:true}),g=h.create();
    h.run(g,8,['ArrowRight']);h.canvas.dispatch('touchcancel',{touches:[],changedTouches:[{identifier:2}]});
    g.update(dt);assert.equal(g.input.getState().right,false);
    h.run(g,8,['Space']);h.window.dispatch('blur');assert.equal(g.input.getState().jump,false);assert.equal(g.state,'paused');
});

test('terminal disposal drops local result/checkpoint, native listeners and frame ownership; reentry is fresh',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaGallery);g.start();assert.ok(h.listenerCount()>0);assert.equal(h.frames.size,1);
    g.dispose();assert.equal(g.isDisposed,true);assert.equal(g.finished,false);assert.equal(g.store.save.checkpoint,null);
    assert.equal(h.listenerCount(),0);assert.equal(h.frames.size,0);assert.equal(h.window.worldGame,undefined);
    const frozen=snapshot(g);g.load(G.id);g.update(dt);g.render();g.toggleGalleryPause();g.start();assert.deepEqual(snapshot(g),frozen);
    const next=h.create(GuairaGallery);assert.deepEqual(next.openings,{first:false,second:false});assert.equal(next.player.data.position.x,48);
    next.dispose();assert.equal(h.listenerCount(),0);
});
