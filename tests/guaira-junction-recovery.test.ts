import assert from 'node:assert/strict';
import test from 'node:test';
import { guairaJunctionBrowser } from './helpers/guairaJunctionHarness';
import { GUAIRA_JUNCTION as G, type GuairaJunction } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import recordings from './helpers/guairaJunctionRecoveryReplays.json';
import original from './helpers/guairaJunctionReplay.json';

type Run=[number,string[]];
const feet=(g:GuairaJunction)=>g.player.data.position.y+g.player.data.height;
const steps=[G.returnLowerId,G.returnUpperId];
const snapshot=(g:GuairaJunction)=>structuredClone({p:g.player.data,o:g.objects,c:g.camera,
    route:g.routing,coins:g.coins,time:g.time,checkpoint:g.store.save.checkpoint,finished:g.finished});

for(const route of ['direct','optional'] as const)for(const touch of [false,true])for(const reducedMotion of [false,true])
    test(`${route}: miss and recover locally with native ${touch?'touch':'keyboard'}, reduced=${reducedMotion}`,t=>{
        const h=guairaJunctionBrowser(t,{touch,reducedMotion}),g=h.create();
        let updates=0,fell=0,recovered=0,lowestX=Infinity,unlocked=false;
        const used=new Set<string>();
        for(const[n,keys]of recordings[route].runs as Run[])for(let i=0;i<n;i++) {
            h.run(g,1,keys);updates++;
            const p=g.player.data;
            assert.equal(p.isDead,false);assert.equal(p.hasHelmet,true);
            assert.ok(p.position.y-4-g.camera.y>=23,'helmet below HUD');
            assert.ok(feet(g)-g.camera.y<=172,'floor stays visible');
            if(!g.returnStairOpen)for(const id of steps) {
                assert.equal(g.objects.get(id)!.y,G.returnHomeY);assert.equal(g.objects.get(id)!.active,false);
            }
            unlocked ||= g.returnStairOpen;
            if(unlocked)for(const id of steps)assert.equal(g.objects.get(id)!.active,true,'A/B reversals do not retract the stair');
            if(!fell&&p.isGrounded&&feet(g)===G.recoveryY&&p.position.x>G.exitGapStartX)fell=updates;
            if(fell&&!recovered) {
                lowestX=Math.min(lowestX,p.position.x);
                if(p.position.x>=448&&p.position.x<608&&feet(g)>G.returnUpperY)
                    assert.ok(G.middleY-g.camera.y>=24,'destination lip remains visible from the stair approach');
                assert.equal(g.routing.supplied,'b','recover without repeating the inlet selector');
                for(const id of steps) {
                    const b=g.objects.get(id)!;
                    if(p.isGrounded&&Math.abs(feet(g)-b.y)<.01&&p.position.x+p.width>b.x&&p.position.x<b.x+b.width)used.add(id);
                }
                if(p.isGrounded&&feet(g)===G.middleY&&p.position.x>=384&&p.position.x<576)recovered=updates;
            }
        }
        assert.equal(updates,recordings[route].frames);assert.ok(fell>0);assert.ok(recovered>fell);
        assert.ok(recovered-fell<360,'local return takes fewer than six seconds in this recording');
        assert.ok(lowestX>=480,'no walk back to A or the inlet');assert.deepEqual([...used].sort(),[...steps].sort());
        assert.equal(g.finished,true);assert.equal(g.coins,recordings[route].coins);
        assert.equal(g.store.save.checkpoint?.index,g.stage.checkpoints.length-1);assert.deepEqual(g.store.save.completed,[]);assert.deepEqual(h.storageCalls,[]);
        const before=snapshot(g);g.render();assert.deepEqual(snapshot(g),before,'paint is read-only');
    });

type Harness=ReturnType<typeof guairaJunctionBrowser>;
function reachCheckpoint(h:Harness,g:GuairaJunction) {
    for(const[n,keys]of original.runs as Run[])for(let i=0;i<n;i++) {
        h.run(g,1,keys);if(g.returnStairOpen){h.keys([]);return;}
    }
    assert.fail('native supported arrival must capture the checkpoint');
}

test('stowed treads cannot bypass the first lift from the recovery floor',t=>{
    const h=guairaJunctionBrowser(t),g=h.create();
    // Explicit floor fixtures sample tap, held, running and reversing jumps;
    // no test injects an unlocked checkpoint or active step.
    for(const x of [432,480,520,552])for(const direction of ['','ArrowLeft','ArrowRight'])for(const hold of [1,9,24]) {
        h.keys([]);g.load(G.id);const p=g.player.data;
        p.position={x,y:G.recoveryY-p.height};p.velocity={x:0,y:0};p.isGrounded=true;
        const horizontal=direction?[direction,'ShiftLeft']:[];
        for(let n=0;n<70;n++) {
            h.run(g,1,n<hold?[...horizontal,'Space']:horizontal);
            assert.equal(g.store.save.checkpoint,null);assert.equal(g.returnStairOpen,false);assert.equal(g.finished,false);
            for(const id of steps)assert.equal(g.objects.get(id)!.y,G.returnHomeY);
        }
        assert.equal(p.isDead,false);
    }
});

test('deployment never carries a player standing on the patio through its floor',t=>{
    const h=guairaJunctionBrowser(t),g=h.create();
    for(const x of [480,516,552]) {
        h.keys([]);g.load(G.id);reachCheckpoint(h,g);
        // Supported patio fixtures isolate the carry tolerance above each guide.
        const p=g.player.data;p.position={x,y:G.middleY-p.height};p.velocity={x:0,y:0};p.isGrounded=true;
        for(let n=0;n<100;n++) {
            h.run(g,1);assert.equal(feet(g),G.middleY);assert.equal(p.position.x,x);assert.equal(p.isGrounded,true);
        }
        assert.equal(g.objects.get(G.returnLowerId)!.y,G.returnLowerY);
        assert.equal(g.objects.get(G.returnUpperId)!.y,G.returnUpperY);
    }
});

test('partly deployed guides freeze on pause and complete under the native clock',t=>{
    const h=guairaJunctionBrowser(t),g=h.create();reachCheckpoint(h,g);h.run(g,18);
    const step=g.objects.get(G.returnLowerId)!;
    assert.ok(step.y>G.returnHomeY&&step.y<G.returnLowerY);
    g.toggleJunctionPause();const frozen=snapshot(g);h.run(g,120);g.render();assert.deepEqual(snapshot(g),frozen);
    g.toggleJunctionPause();h.run(g,100);assert.equal(step.y,G.returnLowerY);
    g.render();assert.match(h.status.textContent,/escada de retorno aberta/);
});

test('checkpoint death restores the open stair and coins; a new attempt stows it',t=>{
    const h=guairaJunctionBrowser(t),g=h.create();
    outer:for(const[n,keys]of recordings.optional.runs as Run[])for(let i=0;i<n;i++) {
        h.run(g,1,keys);if(feet(g)===G.recoveryY&&g.player.data.position.x>G.exitGapStartX)break outer;
    }
    assert.equal(g.coins,3);assert.equal(g.returnStairOpen,true);assert.equal(g.finished,false);
    const before=g.player;h.keys([]);g.player.die('fall');
    for(let n=0;n<180&&g.player===before;n++)h.run(g,1);
    assert.notEqual(g.player,before);assert.equal(g.coins,3);assert.equal(g.player.data.position.x,G.checkpointX);
    assert.equal(g.objects.get(G.returnLowerId)!.y,G.returnLowerY);
    assert.equal(g.objects.get(G.returnUpperId)!.y,G.returnUpperY);
    for(const id of steps)assert.equal(g.objects.get(id)!.active,true);
    g.load(G.id);assert.equal(g.coins,0);assert.equal(g.returnStairOpen,false);
    for(const id of steps){assert.equal(g.objects.get(id)!.active,false);assert.equal(g.objects.get(id)!.y,G.returnHomeY);}
});

test('the stair accepts varied jump holds and also allows a stronger jump to skip its upper tread',t=>{
    const h=guairaJunctionBrowser(t),g=h.create();let skipped=false;
    for(const lowerHold of [9,16,28])for(const upperHold of [4,8,16]) {
        h.keys([]);g.load(G.id);let remaining=1039;
        for(const[n,keys]of recordings.direct.runs as Run[]) {
            const amount=Math.min(n,remaining);h.run(g,amount,keys);remaining-=amount;if(!remaining)break;
        }
        assert.equal(feet(g),G.recoveryY);
        h.run(g,lowerHold,['Space']);h.run(g,46-lowerHold);assert.equal(feet(g),G.returnLowerY);
        h.run(g,upperHold,['ArrowLeft','Space']);h.run(g,21-upperHold,['ArrowLeft']);h.run(g,18);
        assert.ok(feet(g)===G.returnUpperY||feet(g)===G.middleY,'short and held jumps reach a valid next landing');
        skipped ||= feet(g)===G.middleY;
        if(feet(g)===G.returnUpperY){h.run(g,12,['Space']);h.run(g,30);}
        assert.equal(feet(g),G.middleY);assert.equal(g.player.data.isGrounded,true);
        assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true);assert.equal(g.routing.supplied,'b');
    }
    assert.equal(skipped,true,'mastering the held jump can shorten the recovery');
});
