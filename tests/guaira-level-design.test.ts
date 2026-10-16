import assert from 'node:assert/strict';
import test from 'node:test';
import { guairaTraversalBrowser } from './helpers/guairaTraversalHarness';
import { guairaRespirosBrowser } from './helpers/guairaRespirosHarness';
import { guairaGalleryBrowser } from './helpers/guairaGalleryHarness';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';
import { GUAIRA_RESPIROS as R } from '../src/adventure/experimental/guaira/respiros/GuairaRespirosStage';
import { GUAIRA_GALLERY as G } from '../src/adventure/experimental/guaira/gallery/GuairaGalleryStage';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { TileType } from '../src/constants';
import recording from './helpers/guairaLevelDesignReplays.json';
import readableRoutes from './helpers/guairaReadableRoutesReplays.json';

type Run=[number,string[]];
const dt=1000/60;
const factories={travessia:guairaTraversalBrowser,respiros:guairaRespirosBrowser,galeria:guairaGalleryBrowser,subida:guairaAscentBrowser};
type Game=ReturnType<ReturnType<typeof guairaTraversalBrowser>['create']>|ReturnType<ReturnType<typeof guairaRespirosBrowser>['create']>
    |ReturnType<ReturnType<typeof guairaGalleryBrowser>['create']>|ReturnType<ReturnType<typeof guairaAscentBrowser>['create']>;
const feet=(g:Game)=>g.player.data.position.y+g.player.data.height;

for(const name of Object.keys(factories) as Array<keyof typeof factories>)
    for(const touch of [false,true])for(const reducedMotion of [false,true])
        test(`${name}: complete exploration with native ${touch?'touch':'keyboard'}, reduced=${reducedMotion}`,t=>{
            const h=factories[name](t,{touch,reducedMotion}),g=h.create();
            const supported=new Set<number>();let frames=0,firstIsolation=-1,independentDanger=false;
            const route=name==='galeria'?readableRoutes.galeria:recording[name];
            for(const[count,keys]of route.runs as Run[]) {
                // Use actual canvas touch events for all four adapters, including
                // those whose old harness exposes keyboard-only run helpers.
                if(touch) {
                    const x:Record<string,number>={ArrowLeft:.08,ArrowRight:.22,ArrowDown:.5,ShiftLeft:.78,Space:.93};
                    const touches=keys.map((key,i)=>({identifier:i+1,target:h.canvas,clientX:x[key]*640,clientY:330}));
                    h.canvas.dispatch(touches.length?'touchstart':'touchend',{touches});
                } else h.keys(keys);
                for(let n=0;n<count;n++) {
                    g.update(dt);frames++;
                    assert.equal(g.player.data.isDead,false,`alive at ${frames}`);
                    assert.equal(g.player.data.hasHelmet,true,`no damage at ${frames}`);
                    assert.ok(g.player.data.position.y-4-g.camera.y>=23-1e-6,`helmet visible at ${frames}`);
                    assert.ok(feet(g)-g.camera.y<=172.01,`landing visible at ${frames}`);
                    if(g.player.data.isGrounded)supported.add(feet(g));
                    if(name==='respiros'&&g.objects.get(R.serviceValveId)?.active) {
                        if(firstIsolation<0)firstIsolation=frames;
                        assert.equal(g.objects.get(R.thirdJetId)!.active,true);
                        assert.equal(jetCycle(g.objects.get(R.thirdJetId)!,g.objects.time).danger,null);
                        independentDanger ||= !!jetCycle(g.objects.get(R.fourthJetId)!,g.objects.time).danger;
                    }
                }
            }
            assert.equal(frames,route.frames);assert.equal(g.finished,true);
            const expected={travessia:[176,144],respiros:[288,240,192],galeria:[352,288],subida:[240,192,144]}[name];
            for(const y of expected)assert.ok(supported.has(y),`used new route at y${y}`);
            assert.equal(g.coins,{travessia:16,respiros:5,galeria:5,subida:4}[name]);
            if(name==='respiros') {
                assert.ok(firstIsolation>0);assert.ok(independentDanger,'D remains a real timing challenge');
                assert.equal(g.store.save.checkpoint?.index,1,'safe point precedes the service detour');
                for(const id of[R.firstJetId,R.secondJetId,R.fourthJetId])assert.equal(g.objects.get(id)!.active,false);
            }
            assert.deepEqual(g.store.save.completed,[]);assert.deepEqual(h.storageCalls,[]);
            const before=structuredClone({p:g.player.data,objects:g.objects,tiles:g.level.data.tiles,coins:g.coins});
            g.render();assert.deepEqual(structuredClone({p:g.player.data,objects:g.objects,tiles:g.level.data.tiles,coins:g.coins}),before);
        });

function reachValve(h:ReturnType<typeof guairaRespirosBrowser>,g:ReturnType<typeof h.create>) {
    let remaining=701;
    for(const[n,k]of recording.respiros.runs as Run[]) {
        const amount=Math.min(n,remaining);h.run(g,amount,k);remaining-=amount;if(!remaining)break;
    }
    assert.equal(g.objects.get(R.serviceValveId)!.active,true);
    assert.equal(feet(g),192);assert.equal(g.player.data.hasHelmet,true);
}

test('service valve reopens with the full native warning, pauses safely and resets at the nearby checkpoint',t=>{
    const h=guairaRespirosBrowser(t),g=h.create();reachValve(h,g);
    const jet=g.objects.get(R.thirdJetId)!;
    g.toggleRespirosPause();const frozen=structuredClone(g.objects);h.run(g,90);g.render();
    assert.deepEqual(structuredClone(g.objects),frozen);g.toggleRespirosPause();
    h.run(g,8,['Space']);
    let reopened=false;
    for(let n=0;n<60;n++) {
        h.run(g,1,['ArrowDown']);
        if(!jet.active){reopened=true;break;}
    }
    assert.equal(reopened,true);assert.equal(jetCycle(jet,g.objects.time).phase,'charging');
    const reopenedAt=g.objects.time;
    for(let n=0;n<47;n++){h.run(g,1);assert.equal(jetCycle(jet,g.objects.time).danger,null);}
    assert.ok(g.objects.time-reopenedAt>=780);
    // This explicit death fixture verifies reconstruction; it is not a played loss.
    const previous=g.player,coins=g.coins;g.player.die('fall');
    for(let n=0;n<180&&g.player===previous;n++)h.run(g,1);
    assert.notEqual(g.player,previous);assert.equal(g.player.data.position.x,R.finalCheckpointX);
    assert.equal(g.objects.get(R.serviceValveId)!.active,false);assert.equal(g.objects.get(R.thirdJetId)!.active,false);
    assert.equal(g.coins,coins);assert.equal(g.objects.time,0);
    h.keys([]);g.load(R.id);assert.equal(g.coins,0);assert.equal(g.store.save.checkpoint,null);
});

for(const hole of[0,1,2])test(`cache single hole ${hole} remains escapable without helmet`,t=>{
    const h=guairaGalleryBrowser(t),g=h.create();
    // Focused partial-break fixture; the complete native descent is covered above.
    g.level.breakTile(G.cacheStart/16+hole,G.cacheY/16);
    const p=g.player.data;p.position={x:G.cacheStart+hole*16+1,y:G.cacheFloor-p.height};
    p.velocity={x:0,y:0};p.isGrounded=true;p.hasHelmet=false;
    h.run(g,12,['Space']);h.run(g,30,['Space',hole===0?'ArrowLeft':'ArrowRight']);h.run(g,25);
    assert.equal(p.isDead,false);assert.ok(feet(g)<=G.cacheY,'an ordinary jump leaves the pocket');
    assert.equal(g.finished,false,'optional cache cannot award the room result');
});

test('cache death restores the lid but preserves collected coins, and retry clears the attempt',t=>{
    const h=guairaGalleryBrowser(t),g=h.create();
    let remaining=400;
    for(const[n,k]of readableRoutes.galeria.runs as Run[]) {
        const amount=Math.min(n,remaining);h.run(g,amount,k);remaining-=amount;if(!remaining)break;
    }
    assert.equal(g.coins,5);assert.equal(g.store.save.checkpoint?.index,0);
    const previous=g.player;g.player.die('fall');for(let n=0;n<180&&g.player===previous;n++)h.run(g,1);
    assert.notEqual(g.player,previous);assert.equal(g.coins,5);
    for(let x=G.cacheStart;x<G.cacheEnd;x+=16)assert.equal(g.level.getTile(x/16,G.cacheY/16),TileType.BRICK_BREAKABLE);
    h.keys([]);g.load(G.id);assert.equal(g.coins,0);assert.equal(g.store.save.checkpoint,null);
});
