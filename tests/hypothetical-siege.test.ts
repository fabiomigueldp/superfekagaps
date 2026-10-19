import test from 'node:test';
import {SCENIC_STARTS} from '../src/adventure/hipotetico/HypotheticalDevastation';
import assert from 'node:assert/strict';
import { HypotheticalGame } from '../src/adventure/hipotetico/HypotheticalGame';
import { HypotheticalGuard } from '../src/adventure/hipotetico/HypotheticalGuards';
import { HypotheticalSiege, SIEGE_APPROACH, SIEGE_EXIT, SIEGE_SECTORS, SIEGE_GATE_TICKS, SIEGE_UNLOCK_TICKS, SIEGE_LIFT_TICKS, SIEGE_LOCK_TICKS, siegeGarrison } from '../src/adventure/hipotetico/HypotheticalSiege';
import { hypotheticalStage } from '../src/adventure/hipotetico/HypotheticalStage';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import tape from './helpers/hypotheticalReplay.json';
import upperRoutes from './helpers/hypotheticalUpperRoutes.json';
const dt=1000/60;

test('a cleared district opens gradually, never wakes the next district or completes by waiting',()=>{
    const route=new HypotheticalSiege();
    for(let n=0;n<600;n++)route.update(40,0);
    assert.equal(route.cleared,0);assert.equal(route.active,false);
    route.update(100+SIEGE_APPROACH,2);assert.equal(route.active,true);
    for(let n=0;n<600;n++)route.update(300+SIEGE_APPROACH,1);
    assert.equal(route.gateHeight(0),224);
    route.update(300+SIEGE_APPROACH,0);assert.equal(route.cleared,1);assert.equal(route.gateHeight(0),224);
    let height=224;
    for(let n=0;n<SIEGE_GATE_TICKS;n++){
        route.update(300+SIEGE_APPROACH,0);assert.ok(route.gateHeight(0)<=height);height=route.gateHeight(0);
    }
    assert.equal(height,0);assert.equal(route.active,false);
    for(let n=0;n<600;n++)route.update(300+SIEGE_APPROACH,0);
    assert.equal(route.cleared,1);assert.equal(route.canExit(SIEGE_EXIT),false);
    route.update(464+SIEGE_APPROACH,3);assert.equal(route.active,true);
    const complete=new HypotheticalSiege(3);
    assert.equal(complete.canExit(SIEGE_EXIT-40),false);assert.equal(complete.canExit(SIEGE_EXIT),true);
});

test('waiting patrols cannot move, emit attacks or damage Feka before their encounter',()=>{
    const stage=hypotheticalStage('siege'),level=new WorldLevel(stage.level),objects=new WorldObjects(stage.mechanisms);
    level.bodies=objects.bodies;
    for(const spec of siegeGarrison(2)){
        const e=new HypotheticalGuard(spec,3);e.awake=false;
        const origin={x:e.x,y:e.y},p={x:e.x,y:e.y,width:14,height:24};
        for(let n=0;n<400;n++)e.update(dt,level,objects,p);
        assert.deepEqual({x:e.x,y:e.y},origin);assert.equal(e.timer,0);assert.equal(e.danger,null);
        assert.equal(e.contact(p,p,false,false),'none');assert.equal(objects.barrels.length,0);
    }
});

test('each defeated guard releases one pin, while partial progress cannot raise a gate or leak into the next post',()=>{
    const route=new HypotheticalSiege();
    route.update(96+SIEGE_APPROACH,2);route.update(200+SIEGE_APPROACH,1);
    assert.deepEqual(route.remaining,[1,3,4]);assert.equal(route.releasedThisTick,true);
    for(let n=0;n<60;n++)route.update(200+SIEGE_APPROACH,1);
    assert.deepEqual(route.lockTicks[0],[SIEGE_LOCK_TICKS,0]);assert.equal(route.gateHeight(0),224);
    assert.equal(route.cleared,0);assert.equal(route.releasedThisTick,false);
    route.update(200+SIEGE_APPROACH,0);assert.equal(route.openedThisTick,true);assert.equal(route.remaining[0],0);
    for(let n=1;n<=SIEGE_GATE_TICKS;n++){
        route.update(200+SIEGE_APPROACH,0);
        if(n<=SIEGE_UNLOCK_TICKS)assert.equal(route.gateHeight(0),224,'the bolt retracts before the grille moves');
        if(n>=SIEGE_UNLOCK_TICKS+SIEGE_LIFT_TICKS)assert.equal(route.gateHeight(0),0,'settling cannot close on Feka');
    }
    assert.equal(route.gatePhase(0),'open');assert.deepEqual(route.remaining,[0,3,4]);
    const retry=new HypotheticalSiege(1);
    assert.deepEqual(retry.remaining,[0,3,4]);assert.deepEqual(retry.lockTicks,[[18,18],[0,0,0],[0,0,0,0]]);
    assert.equal(retry.gatePhase(0),'open');assert.equal(retry.gatePhase(1),'locked');
});

test('barrels shatter against encounter gates before Feka moves; ordinary breakable targets retain their behavior',()=>{
    for(const pressurized of [false,true]){
        const stage=hypotheticalStage('siege'),level=new WorldLevel(stage.level),objects=new WorldObjects(stage.mechanisms);
        const gate=objects.get('siege-gate-0')!;
        objects.spawnBarrel(gate.x-13,204,1,pressurized);
        objects.update(dt,level,gate.x-14);
        assert.equal(gate.active,false);assert.equal(gate.brokenAt,undefined);assert.equal(objects.barrels.length,0);
        const p={x:gate.x-14,y:200,width:14,height:24};
        assert.equal(level.resolveCollision(p,{x:5,y:0},p).position.x,gate.x-14);
        assert.ok(objects.events.some(e=>e.kind==='barrelBreak'&&e.y>200));
        assert.ok(!objects.events.some(e=>e.kind==='break'));
    }
    const level=new WorldLevel(hypotheticalStage('siege').level);
    const ordinary=new WorldObjects([{id:'ordinary',kind:'target',x:352,y:192,width:16,height:32}]);
    ordinary.spawnBarrel(339,204,1);ordinary.update(dt,level,338);
    assert.equal(ordinary.get('ordinary')!.active,true);assert.equal(ordinary.barrels.length,0);
});

test('closed gate blocks floor movement and high jumps; raised collision follows the visible bottom',()=>{
    const stage=hypotheticalStage('siege'),level=new WorldLevel(stage.level),objects=new WorldObjects(stage.mechanisms);
    level.bodies=objects.bodies;
    const gate=objects.bodies.find(b=>b.id==='siege-gate-0')!;
    for(const y of [200,130,60,4]){
        const p={x:gate.x-17,y,width:14,height:24},r=level.resolveCollision(p,{x:8,y:0},p);
        assert.equal(r.position.x,gate.x-14);
    }
    gate.height=150;
    const p={x:gate.x-17,y:200,width:14,height:24};assert.equal(level.resolveCollision(p,{x:8,y:0},p).position.x,gate.x-9);
    gate.height=0;gate.active=true;
    const high={...p,y:50};assert.equal(level.resolveCollision(high,{x:8,y:0},high).position.x,gate.x-9);
});

test('blindado and ariete survive a pound, stay visibly broken, and can then be finished',()=>{
    for(const kind of ['helmet','charger'] as const){
        const e=new HypotheticalGuard({id:kind,kind,x:120,y:224,behavior:'canal'});
        const p={x:e.x+4,y:e.y-23,width:14,height:24},old={...p,y:p.y-4};
        assert.equal(e.contact(p,old,true,false),'bounce');assert.equal(e.armor,true);assert.equal(e.dead,false);
        assert.equal(e.contact(p,old,true,true),'bounce');assert.equal(e.armor,false);assert.equal(e.dead,false);assert.equal(e.phase,'stunned');
        assert.equal(e.blocksStomp,false);assert.equal(e.armorLostAt,e.age);
        assert.equal(e.contact(p,old,true,false),'kill');
    }
});

test('elevated launchers threaten the floor with a complete telegraph, then commit to their throw',()=>{
    const stage=hypotheticalStage('siege'),level=new WorldLevel(stage.level),objects=new WorldObjects(stage.mechanisms);
    level.bodies=objects.bodies;
    const e=new HypotheticalGuard(siegeGarrison(1).find(s=>s.kind==='loader')!,2);
    const p={x:570+SIEGE_APPROACH,y:200,width:14,height:24};
    for(let n=0;n<92;n++)e.update(dt,level,objects,p);
    assert.equal(e.phase,'warning');const facing=e.facing;
    while(e.timer<800){e.update(dt,level,objects,{...p,x:720+SIEGE_APPROACH});assert.equal(objects.barrels.length,0);assert.equal(e.facing,facing);}
    while(objects.barrels.length===0)e.update(dt,level,objects,p);
    assert.equal(objects.barrels[0].vx<0,true);assert.equal(e.lastRelease,e.age);
});

test('native play crosses three physical gates, defeats every garrison and preserves districts across a death',t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    let held=new Set<string>(),previousPlayer=g.player,priorCleared=0,entered=false,sawRetry=false,maxCamera=0;
    const districts=new Set<number>(),defeated=new Set<string>(),opens=new Set<number>();
    try{
        for(const [count,keys] of tape.runs as [number,string[]][]){
            const next=new Set(keys);
            for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{key:k==='Space'?' ':k,code:k,target:h.canvas});
            for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{key:k==='Space'?' ':k,code:k,target:h.canvas});
            held=next;
            for(let n=0;n<count;n++){
                g.update(dt);
                if(g.act==='siege'){
                    if(!entered){assert.equal(g.foes.length,9);assert.ok(g.foes.every(e=>e instanceof HypotheticalGuard&&!e.awake));entered=true;}
                    const route=g.fight.route;
                    assert.ok(route.cleared>=priorCleared,'completed districts cannot be lost on a retry');priorCleared=route.cleared;
                    if(route.active)districts.add(route.cleared);
                    for(const e of g.foes)if(e.dead)defeated.add(e.spec.id);
                    for(const [i] of SIEGE_SECTORS.entries()){
                        const gate=g.objects.bodies.find(b=>b.id===`siege-gate-${i}`)!;
                        assert.equal(gate.height,route.gateHeight(i));assert.equal(gate.active,gate.height===0);
                        if(gate.height>0&&gate.height<224)opens.add(i);
                    }
                    if(g.player!==previousPlayer&&priorCleared>0){
                        sawRetry=true;assert.equal(g.player.data.position.x,route.checkpoint);
                        assert.ok(g.fight.destroyed>=priorCleared);assert.equal(g.fight.backdrop.tick,SCENIC_STARTS[priorCleared]);
                        assert.ok(g.fight.backdrop.casualties>=priorCleared*2);
                        assert.ok(g.foes.every(e=>(e as HypotheticalGuard).wave>priorCleared));
                    }
                    maxCamera=Math.max(maxCamera,g.camera.x);
                }
                if(g.player!==previousPlayer){held=new Set();previousPlayer=g.player;}
            }
        }
        assert.deepEqual([...districts],[0,1,2]);assert.deepEqual([...opens],[0,1,2]);assert.equal(defeated.size,9);
        assert.ok(sawRetry);assert.ok(maxCamera>=950);assert.equal(g.receipt.won,true);
    }finally{g.dispose();}
});

for(const route of upperRoutes)test(`native jumps cross optional upper approach ${route.link+1} and land in the next post`,t=>{
    const h=sceneLifecycleBrowser(t),g=new HypotheticalGame(h.canvas as unknown as HTMLCanvasElement);
    let held=new Set<string>(),previousPlayer=g.player,n=0,coinsAtBranch=0;
    const landed=new Set<string>();
    try{
        for(const [count,keys] of route.runs as [number,string[]][]){
            const next=new Set(keys);
            for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{key:k==='Space'?' ':k,code:k,target:h.canvas});
            for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{key:k==='Space'?' ':k,code:k,target:h.canvas});held=next;
            for(let i=0;i<count;i++){
                g.update(dt);n++;
                if(n===route.branchAt)coinsAtBranch=g.coins;
                if(n>route.branchAt){
                    assert.equal(g.fight.route.cleared,route.link+1);
                    assert.equal(g.receipt.deaths,route.deathsAtBranch,'the alternate approach does not cause another death');
                    const p=g.player.getRect();
                    if(g.player.data.isGrounded)for(const body of g.objects.bodies)
                        if(body.kind==='support'&&Math.abs(p.y+p.height-body.y)<.1&&p.x+p.width>body.x&&p.x<body.x+body.width)landed.add(body.id);
                }
                if(g.player!==previousPlayer){held=new Set();previousPlayer=g.player;}
            }
        }
        assert.ok(landed.has(`siege-link-${route.link}`));
        assert.ok(landed.has(`siege-scaffold-${route.link+1}-0`));
        assert.equal(g.fight.route.entered,route.link+1);assert.equal(g.fight.route.active,true);
        assert.ok(g.coins>coinsAtBranch);assert.equal(g.player.data.hasHelmet,true);
    }finally{g.dispose();}
});
