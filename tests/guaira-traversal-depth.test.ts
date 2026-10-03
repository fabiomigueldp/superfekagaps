import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { GUAIRA_TRAVERSAL as G, guairaTraversalStage } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';
const upper = JSON.parse(readFileSync(new URL('./helpers/guairaTraversalReplay.json', import.meta.url), 'utf8')) as { runs: Array<[number, string[]]> };
const maintenance = JSON.parse(readFileSync(new URL('./helpers/guairaTraversalMaintenanceReplay.json', import.meta.url), 'utf8')).runs as Array<[number,string[]]>;
for (const [name, runs] of [['upper banks',upper.runs], ['maintenance channel',maintenance]] as const) test(`native-input ${name} completes the combined crossing safely`, t => {
    const h = guairaTraversalBrowser(t), g = h.create();
    const checkpoints = new Set<number>(), lowerCoins = new Set<string>();
    for (const [count, keys] of runs) for (let frame = 0; frame < count; frame++) {
        h.run(g,1,keys);
        assert.equal(g.player.data.isDead,false); assert.equal(g.player.data.hasHelmet,true);
        if (g.store.save.checkpoint) checkpoints.add(g.store.save.checkpoint.index);
        if (g.player.data.position.y > 210 && g.player.data.position.x >= 768 && g.player.data.position.x < 976) lowerCoins.add(String(g.coins));
    }
    assert.equal(g.finished,true); assert.equal(g.finalBridgeReady,true);
    assert.deepEqual([...checkpoints],[0,1,2]);
    assert.ok(g.coins < 17,'completion never requires the optional coins');
    if (name === 'maintenance channel') assert.ok(lowerCoins.size >= 3,'reward trail is reached with native movement');
    else assert.equal(lowerCoins.size,0,'the bank route does not require descending into the channel');
});
for (const checkpoint of [1,2]) test(`checkpoint ${checkpoint} restores only the solved upstream sluices`, t => {
    const h=guairaTraversalBrowser(t), g=h.create();
    outer: for (const [count,keys] of upper.runs) for(let f=0;f<count;f++) {
        h.run(g,1,keys); if(g.store.save.checkpoint?.index===checkpoint) break outer;
    }
    assert.equal(g.store.save.checkpoint?.index,checkpoint);
    const coins=g.coins, prior=g.player; h.keys([]); g.player.die('fall');
    for(let f=0;f<200 && g.player===prior;f++) h.run(g,1);
    assert.notEqual(g.player,prior); assert.equal(g.player.data.isDead,false);
    assert.equal(g.bridgeReady,true); assert.equal(g.finalBridgeReady,checkpoint===2);
    assert.equal(g.objects.get(G.finalValveId)!.active,checkpoint===2);
    assert.equal(g.coins,coins); assert.equal(g.finished,false);
    assert.equal(g.player.data.position.x,checkpoint===1?1024:1408);
    h.run(g,140); assert.equal(g.player.data.isGrounded,true); assert.equal(g.player.data.isDead,false);
    g.load(G.id); assert.equal(g.coins,0); assert.equal(g.store.save.checkpoint,null); assert.equal(g.finalBridgeReady,false);
});
test('two distinct challenges keep native mechanism and campaign contracts',()=>{
    const s=guairaTraversalStage();
    assert.equal(s.pickups.length,17); assert.equal(new Set(s.pickups.map(p=>p.id)).size,17);
    assert.equal(s.mechanisms.filter(m=>m.kind==='switch').length,2);
    assert.equal(s.mechanisms.filter(m=>m.kind==='lift').length,2);
    assert.deepEqual(s.exits,[]); assert.deepEqual(s.foes,[]);
});
test('final canal cannot be skipped by a running jump with its sluice closed', t=>{
    const h=guairaTraversalBrowser(t),g=h.create();
    for(const approach of [23,25,27,29,31]) {
        h.keys([]);g.load(G.id);
        outer: for(const [count,keys] of upper.runs) for(let f=0;f<count;f++) {
            h.run(g,1,keys);if(g.store.save.checkpoint?.index===1)break outer;
        }
        // Recover through the actual death pipeline to use the same safe takeoff origin.
        const prior=g.player;h.keys([]);g.player.die('fall');
        for(let f=0;f<200 && g.player===prior;f++)h.run(g,1);
        h.run(g,140);h.run(g,approach,['ArrowRight','ShiftLeft']);
        let died=false;
        for(let f=0;f<120;f++) {
            h.run(g,1,['ArrowRight','ShiftLeft','Space']);
            assert.ok(g.player.data.position.x<1360);
            if(g.player.data.isDead){died=true;break;}
        }
        assert.equal(died,true);assert.equal(g.objects.get(G.finalValveId)!.active,false);assert.equal(g.finished,false);
    }
});
