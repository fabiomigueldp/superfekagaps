import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import tapes from './helpers/guairaFoeEncounters.json';

for(const [name,tape]of Object.entries(tapes))for(const reduced of [false,true])
test(`${name}: native checkpoint approach, visible tells and real damage/counterplay; reduced=${reduced}`,t=>{
    const h=sceneLifecycleBrowser(t);h.media.matches=reduced;const g=h.create(GuairaTraversal);
    g.store.save.checkpoint={stage:g.stage.id,index:tape.checkpoint,helmet:true};g.load(g.stage.id,true);
    const e=g.foes.find(e=>e.spec.id.endsWith(tape.foeId))!;
    let held=new Set<string>(),frame=0,outsideBodyHit=false;const damage:number[]=[],hints=new Set<string>();
    const snapshot=()=>JSON.stringify({p:g.player.data,foes:g.foes,objects:g.objects,c:g.camera,t:g.time,coins:g.coins});
    for(const[count,keys]of tape.runs as Array<[number,string[]]>){
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        for(let n=0;n<count;n++){
            const helmet=g.player.data.hasHelmet;g.update(1000/60);frame++;
            if(helmet&&!g.player.data.hasHelmet){damage.push(frame);outsideBodyHit||=g.player.data.position.x+g.player.data.width<e.x;}
            const p=g.player.data;assert.equal(p.isDead,false);assert.ok(p.position.y-4-g.camera.y>=23);
            assert.ok(p.position.y+p.height-g.camera.y<=172.01);
            hints.add(guairaCourseGuidance(g,'travessia')?.hint??'');
            if(name==='loader-counter'&&frame>=256&&frame<=334){
                assert.ok(e.y-25-g.camera.y>=23,'the high throw warning remains below the HUD');
                assert.ok(e.y+e.height-g.camera.y<=180,'the short dodge keeps the thrower and its platform visible');
            }
            if(frame%30===0){const before=snapshot();g.render();assert.equal(snapshot(),before);}
        }
    }
    assert.equal(frame,tape.frames);assert.deepEqual(damage,tape.damage);assert.equal(e.dead,tape.killed);
    assert.ok(hints.has(name.startsWith('loader')?'ARREMESSO ALTO A CAMINHO':'PINCA: PREPARE O SALTO'));
    if(name==='pincer-hit')assert.ok(outsideBodyHit,'the pincer can hit beyond the body');
    assert.deepEqual(g.store.save.completed,[]);g.dispose();
});

for(const name of ['pincer-counter','loader-counter'] as const)test(`${name}: pausing a visible wind-up freezes pose, timing and projectiles`,t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaTraversal),tape=tapes[name];
    g.store.save.checkpoint={stage:g.stage.id,index:tape.checkpoint,helmet:true};g.load(g.stage.id,true);
    const e=g.foes.find(e=>e.spec.id.endsWith(tape.foeId))!;let held=new Set<string>();
    outer:for(const[count,keys]of tape.runs as Array<[number,string[]]>){
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        for(let n=0;n<count;n++){g.update(1000/60);if(e.phase==='warning'&&e.timer>200&&(name.startsWith('pincer')||e.highThrow))break outer;}
    }
    assert.equal(e.phase,'warning');g.toggleTraversalPause();
    const before=JSON.stringify({p:g.player.data,foes:g.foes,o:g.objects,t:g.time});
    for(let n=0;n<120;n++){g.update(1000/60);g.render();}
    assert.equal(JSON.stringify({p:g.player.data,foes:g.foes,o:g.objects,t:g.time}),before);
    g.toggleTraversalPause();g.update(1000/60);assert.notEqual(JSON.stringify(g.foes),JSON.stringify(JSON.parse(before).foes));g.dispose();
});
