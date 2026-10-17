import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {guairaCourseGuidance} from '../src/adventure/experimental/guaira/GuairaCourseGuidance';
import {sampleGuairaExploration} from '../src/adventure/experimental/guaira/GuairaCourseExploration';
import {crossGuairaRiceLock} from './helpers/guairaSluiceController';
import {continueGuairaCourse} from './helpers/guairaCourseController';
import {dockControls} from './helpers/guairaDockController';
import tapes from './helpers/guairaSluiceReplays.json';

const c=GUAIRA_COURSES.travessia;
function controls(h:ReturnType<typeof sceneLifecycleBrowser>,g:GuairaTraversal){
    let held=new Set<string>(),frame=0;
    return (keys:readonly string[])=>{
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        g.update(1000/60);return ++frame;
    };
}
function prefix(g:GuairaTraversal,step:(keys:string[])=>void,tape=tapes.main,stop=tape.prefixFrames){
    let frame=0;outer:for(const[n,keys]of tape.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        step(keys);if(++frame===stop)break outer;
    }
    assert.ok(g.player.data.hasHelmet&&!g.player.data.isDead);
}

for(const mode of ['main','high','recovery','return'] as const)for(const reduced of [false,true])
test(`rice lock ${mode}: real choices, clear landing, completion and optional discoveries; reduced=${reduced}`,t=>{
    const h=sceneLifecycleBrowser(t);h.media.matches=reduced;const g=h.create(GuairaTraversal),step=controls(h,g),tape=tapes[mode];
    const outlet=g.objects.bodies.find(b=>b.id.endsWith(':lock-outlet'))!,bridge=g.objects.bodies.find(b=>b.id.endsWith(':course:bridge:784'))!;
    const guard=g.foes.find(e=>e.spec.id.endsWith(':maintenance:guard'))!;
    let refuge=0,fragile=0,returning=0,receiving=0,collapse=0;
    const snapshot=()=>JSON.stringify({p:g.player.data,o:g.objects,c:g.camera,e:g.foes,coins:g.coins,tiles:g.level.data.tiles});
    for(const[n,keys]of tape.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        const previousCameraX=g.camera.x,frame=step(keys),p=g.player.data,feet=p.position.y+p.height,local=p.position.x-c.start;
        assert.ok(p.hasHelmet&&!p.isDead,`native route needs no hit at ${frame}`);
        if(frame>tape.prefixFrames&&frame<=tape.crossingEnd){
            assert.ok(Math.abs(g.camera.x-previousCameraX)<=8.01,'changing route direction does not jerk the camera');
            assert.ok(p.position.y-10-g.camera.y>=23&&feet-g.camera.y<=172,'complete avatar remains visible');
            const hint=guairaCourseGuidance(g,'travessia')?.hint;
            if(hint==='TABUA CEDE - CONTINUE')fragile++;
            if(hint==='RETORNO: PROCURE APOIOS')returning++;
            if(p.isGrounded&&feet===192&&local>=880&&local<916)refuge++;
            if(local>=960&&local<1056&&feet>80&&!p.isGrounded&&mode==='main'){
                assert.ok(192-g.camera.y<=176,'lower jump previews the far bank');receiving++;
            }
            if(g.level.getFallingPlatformRenderData().some(b=>b.col*16>=c.start+864&&b.col*16<c.start+912&&b.phase==='falling'))collapse++;
        }
        if(frame%150===0){const before=snapshot();g.render();assert.equal(snapshot(),before,'drawing never advances a mechanism');}
    }
    assert.ok(g.finished);assert.equal(g.coins,tape.coins);
    if(mode==='high'||mode==='return'){
        assert.ok(guard.dead&&outlet.active&&fragile>0);
        assert.equal(sampleGuairaExploration(g)?.['travessia:maintenance']?.length,5);
    }else assert.ok(!guard.dead&&!outlet.active&&refuge>5,'the floor keeps its own danger and does not auto-solve the upper route');
    if(mode==='high')assert.equal(bridge.active,false,'the upper passage is a genuinely independent crossing');
    if(mode==='main')assert.ok(bridge.active&&receiving>10);
    if(mode==='recovery')assert.ok(collapse>0&&refuge>0,'the real broken board drops onto the dry pier');
    if(mode==='return')assert.ok(returning>30&&bridge.active);
    assert.deepEqual(g.store.save.completed,[]);g.dispose();
});

for(const route of ['low','high'] as const)for(const wait of [0,71,137,239])
test(`rice lock ${route}: phase shifted by ${wait} ordinary frames remains completable without damage`,t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaTraversal),step=controls(h,g);prefix(g,step);
    dockControls(g,step).brake();for(let i=0;i<wait;i++)step([]);
    const safe=(keys:string[])=>{step(keys);assert.ok(g.player.data.hasHelmet&&!g.player.data.isDead);};
    assert.ok(crossGuairaRiceLock(g,safe,route));assert.ok(continueGuairaCourse(g,safe).finished);g.dispose();
});

function reachRefuge(g:GuairaTraversal,step:(keys:string[])=>void){
    outer:for(const[n,keys]of tapes.main.runs as Array<[number,string[]]>)for(let i=0;i<n;i++){
        step(keys);const p=g.player.data;
        if(p.isGrounded&&p.position.x>=c.start+894&&p.position.x<c.start+916&&p.position.y+p.height===192)break outer;
    }
    dockControls(g,step).brake();
}
test('the dry island allows a long look at the discharge, then a new timing decision',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaTraversal),step=controls(h,g);reachRefuge(g,step);
    const position={...g.player.data.position};let live=0,warn=0;const outlet=g.objects.bodies.find(b=>b.id.endsWith(':lock-outlet'))!;
    for(let n=0;n<600;n++){step([]);assert.ok(g.player.data.hasHelmet&&!g.player.data.isDead);
        if(g.objects.jetDanger(outlet))live++;if(guairaCourseGuidance(g,'travessia')?.hint==='PRESSAO SUBINDO')warn++;}
    assert.ok(Math.abs(position.x-g.player.data.position.x)<1);assert.ok(live>0&&warn>0);
    const safe=(keys:string[])=>{step(keys);assert.ok(g.player.data.hasHelmet&&!g.player.data.isDead);};
    assert.ok(crossGuairaRiceLock(g,safe));assert.ok(continueGuairaCourse(g,safe).finished);g.dispose();
});
test('ignoring the discharge hurts, missing the second bank kills, and the earned checkpoint recovers the crossing',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaTraversal),step=controls(h,g);reachRefuge(g,step);
    const checkpoint={...g.store.save.checkpoint!},coins=g.coins;
    for(let i=0;i<100&&g.player.data.position.x<c.start+930;i++)step(['ArrowRight']);
    dockControls(g,step).brake();
    for(let i=0;i<320&&g.player.data.hasHelmet;i++)step([]);
    assert.equal(g.player.data.hasHelmet,false,'the warned discharge deals native damage');
    for(let i=0;i<150&&!g.player.data.isDead;i++)step(['ArrowRight']);
    assert.ok(g.player.data.isDead,'running without the second jump reaches real water');
    for(let i=0;i<150;i++)step([]);
    assert.ok(!g.player.data.isDead&&g.player.data.hasHelmet);assert.deepEqual(g.store.save.checkpoint,checkpoint);assert.ok(g.coins>=coins);
    const result=continueGuairaCourse(g,step);assert.ok(result.finished&&!result.dead);assert.equal(result.damage,0);g.dispose();
});
